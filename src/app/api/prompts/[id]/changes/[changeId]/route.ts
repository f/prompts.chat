import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPromptAccess } from "@/lib/prompt-access";
import { botFieldsUpdateData, parseBotFields, versionBotSnapshot } from "@/lib/bots/change-snapshot";
import { classifierJson, parseClassifierFields, versionClassifierSnapshot } from "@/lib/classifiers/change-snapshot";
import { checkClassifierWrite, classifierContent, revalidateClassifiers } from "@/lib/classifiers/write";

const updateChangeRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  reviewNote: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const { id: promptId, changeId } = await params;

    // Check if prompt exists and user is owner
    const prompt = await db.prompt.findUnique({
      where: { id: promptId },
      select: { authorId: true, content: true, title: true, type: true, classifierSlug: true },
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "not_found", message: "Prompt not found" },
        { status: 404 }
      );
    }

    if (prompt.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "Only the prompt owner can review change requests" },
        { status: 403 }
      );
    }

    // Get change request
    const changeRequest = await db.changeRequest.findUnique({
      where: { id: changeId },
      select: { 
        id: true, 
        promptId: true, 
        status: true, 
        proposedContent: true, 
        proposedTitle: true,
        proposedBot: true,
        proposedClassifier: true,
        authorId: true,
        reason: true,
        author: {
          select: { username: true },
        },
      },
    });

    if (!changeRequest || changeRequest.promptId !== promptId) {
      return NextResponse.json(
        { error: "not_found", message: "Change request not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateChangeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { status, reviewNote } = parsed.data;

    // Validate state transitions
    if (changeRequest.status === "PENDING" && status === "PENDING") {
      return NextResponse.json(
        { error: "invalid_state", message: "Change request is already pending" },
        { status: 400 }
      );
    }

    if (changeRequest.status === "APPROVED") {
      return NextResponse.json(
        { error: "invalid_state", message: "Cannot modify an approved change request" },
        { status: 400 }
      );
    }

    // Allow reopening rejected requests (REJECTED -> PENDING)
    if (changeRequest.status === "REJECTED" && status !== "PENDING") {
      return NextResponse.json(
        { error: "invalid_state", message: "Rejected requests can only be reopened" },
        { status: 400 }
      );
    }

    // If reopening, just update status
    if (status === "PENDING") {
      await db.changeRequest.update({
        where: { id: changeId },
        data: { status, reviewNote: null },
      });
      return NextResponse.json({ success: true, status });
    }

    // If approving, also update the prompt content
    if (status === "APPROVED") {
      // Get current version number
      const latestVersion = await db.promptVersion.findFirst({
        where: { promptId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const nextVersion = (latestVersion?.version ?? 0) + 1;

      // Build change note with contributor info
      const changeNote = changeRequest.reason 
        ? `Contribution by @${changeRequest.author.username}: ${changeRequest.reason}`
        : `Contribution by @${changeRequest.author.username}`;

      // Bots also take the proposed bot fields; requests made before bots had them only change title and instructions
      const proposedBot = prompt.type === "BOT" ? parseBotFields(changeRequest.proposedBot) : null;
      const newTitle = changeRequest.proposedTitle || prompt.title;

      // Classifiers take the proposed fields only if they still make a valid classifier for the chains
      // that use it now; the content is derived again from the fields rather than taken from the request
      const isClassifier = prompt.type === "CLASSIFIER";
      const proposedClassifier = isClassifier ? parseClassifierFields(changeRequest.proposedClassifier) : null;
      let proposedContent = changeRequest.proposedContent;
      if (isClassifier) {
        if (!proposedClassifier || !prompt.classifierSlug) {
          return NextResponse.json(
            { error: "invalid_classifier", message: "The change request has no valid classifier fields" },
            { status: 400 }
          );
        }
        const problem = await checkClassifierWrite(promptId, prompt.classifierSlug, newTitle, proposedClassifier);
        if (problem) {
          return NextResponse.json(
            { error: problem.error, message: problem.message, details: problem.details },
            { status: 409 }
          );
        }
        proposedContent = classifierContent(prompt.classifierSlug, newTitle, proposedClassifier);
      }

      // Update prompt and create version in transaction
      await db.$transaction([
        // Create version record with the NEW content (the approved change)
        db.promptVersion.create({
          data: {
            prompt: { connect: { id: promptId } },
            content: proposedContent,
            changeNote,
            version: nextVersion,
            author: { connect: { id: changeRequest.authorId } },
            ...(proposedBot && { botSnapshot: versionBotSnapshot(newTitle, proposedBot) }),
            ...(proposedClassifier && { classifierSnapshot: classifierJson(versionClassifierSnapshot(newTitle, proposedClassifier)) }),
          },
        }),
        // Update prompt with proposed changes and add contributor
        db.prompt.update({
          where: { id: promptId },
          data: {
            content: proposedContent,
            ...(changeRequest.proposedTitle && { title: changeRequest.proposedTitle }),
            ...(proposedBot && botFieldsUpdateData(proposedBot)),
            ...(proposedClassifier && {
              description: proposedClassifier.description,
              classifierConfig: classifierJson(proposedClassifier.config),
            }),
            contributors: {
              connect: { id: changeRequest.authorId },
            },
          },
        }),
        // Update change request status
        db.changeRequest.update({
          where: { id: changeId },
          data: { status, reviewNote },
        }),
      ]);
      if (isClassifier) revalidateClassifiers();
    } else {
      // Just update the change request status
      await db.changeRequest.update({
        where: { id: changeId },
        data: { status, reviewNote },
      });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Update change request error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  try {
    const { id: promptId, changeId } = await params;

    const changeRequest = await db.changeRequest.findUnique({
      where: { id: changeId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        prompt: {
          select: {
            id: true,
            title: true,
            isPrivate: true,
            authorId: true,
          },
        },
      },
    });

    if (!changeRequest || changeRequest.prompt.id !== promptId) {
      return NextResponse.json(
        { error: "not_found", message: "Change request not found" },
        { status: 404 }
      );
    }

    const denied = await checkPromptAccess(changeRequest.prompt);
    if (denied) return denied;

    return NextResponse.json(changeRequest);
  } catch (error) {
    console.error("Get change request error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const { id: promptId, changeId } = await params;

    // Get change request
    const changeRequest = await db.changeRequest.findUnique({
      where: { id: changeId },
      select: {
        id: true,
        promptId: true,
        status: true,
        authorId: true,
      },
    });

    if (!changeRequest || changeRequest.promptId !== promptId) {
      return NextResponse.json(
        { error: "not_found", message: "Change request not found" },
        { status: 404 }
      );
    }

    // Only the author can dismiss their own change request
    if (changeRequest.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "Only the author can dismiss their change request" },
        { status: 403 }
      );
    }

    // Can only dismiss pending change requests
    if (changeRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "invalid_state", message: "Only pending change requests can be dismissed" },
        { status: 400 }
      );
    }

    // Delete the change request
    await db.changeRequest.delete({
      where: { id: changeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete change request error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
