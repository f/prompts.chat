import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPromptAccess } from "@/lib/prompt-access";
import { botFieldsEqual, botFieldsFromInput, botFieldsFromRecord, botFieldsInputSchema, botFieldsSelect } from "@/lib/bots/change-snapshot";
import {
  classifierFieldsEqual,
  classifierFieldsFromRecord,
  classifierFieldsInputSchema,
  classifierJson,
  type ClassifierFields,
} from "@/lib/classifiers/change-snapshot";
import { parseClassifierConfig } from "@/lib/classifiers/schema";
import { checkClassifierWrite, classifierContent } from "@/lib/classifiers/write";

const createChangeRequestSchema = z.object({
  /** Required except for classifiers, whose content is derived from proposedClassifier */
  proposedContent: z.string().min(1).optional(),
  proposedTitle: z.string().optional(),
  reason: z.string().optional(),
  /** BOT prompts only: the proposed bot fields; omitted to keep them as they are */
  proposedBot: botFieldsInputSchema.optional(),
  /** CLASSIFIER prompts only: the proposed summary and structured fields; omitted to keep them as they are */
  proposedClassifier: classifierFieldsInputSchema.optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const { id: promptId } = await params;

    // Check if prompt exists
    const prompt = await db.prompt.findUnique({
      where: { id: promptId },
      select: { id: true, authorId: true, isPrivate: true, content: true, title: true, type: true, deletedAt: true, ...botFieldsSelect, classifierSlug: true, classifierConfig: true },
    });

    if (!prompt || prompt.deletedAt) {
      return NextResponse.json(
        { error: "not_found", message: "Prompt not found" },
        { status: 404 }
      );
    }

    // Can't create change request for your own prompt
    if (prompt.authorId === session.user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "You cannot create a change request for your own prompt" },
        { status: 403 }
      );
    }

    // Can't create change request for private prompts
    if (prompt.isPrivate) {
      return NextResponse.json(
        { error: "forbidden", message: "Cannot create change request for private prompts" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createChangeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { proposedTitle, reason, proposedBot, proposedClassifier } = parsed.data;
    let proposedContent = parsed.data.proposedContent;

    if (proposedClassifier && prompt.type !== "CLASSIFIER") {
      return NextResponse.json(
        { error: "validation_error", message: "proposedClassifier is only supported for classifiers" },
        { status: 400 }
      );
    }

    // Classifiers: validate the whole proposed classifier now, and derive its content from the fields
    let originalClassifier: ClassifierFields | null = null;
    let nextClassifier: ClassifierFields | null = null;
    if (prompt.type === "CLASSIFIER") {
      if (proposedBot) {
        return NextResponse.json({ error: "validation_error", message: "proposedBot is only supported for bots" }, { status: 400 });
      }
      originalClassifier = classifierFieldsFromRecord(prompt);
      const proposedConfig = proposedClassifier ? parseClassifierConfig(proposedClassifier.config) : null;
      nextClassifier = proposedClassifier
        ? proposedConfig && { description: proposedClassifier.description, config: proposedConfig }
        : originalClassifier;
      if (!nextClassifier || !originalClassifier || !prompt.classifierSlug) {
        return NextResponse.json(
          { error: "invalid_classifier", message: "Invalid classifier", details: ["classifier fields are missing or too large"] },
          { status: 400 }
        );
      }
      const nextTitle = proposedTitle || prompt.title;
      const problem = await checkClassifierWrite(prompt.id, prompt.classifierSlug, nextTitle, nextClassifier);
      if (problem) {
        return NextResponse.json({ error: problem.error, message: problem.message, details: problem.details }, { status: 400 });
      }
      if (nextTitle === prompt.title && classifierFieldsEqual(originalClassifier, nextClassifier)) {
        return NextResponse.json(
          { error: "no_change", message: "The change request does not change the classifier" },
          { status: 400 }
        );
      }
      proposedContent = classifierContent(prompt.classifierSlug, nextTitle, nextClassifier);
    }

    if (!proposedContent) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid input", details: [{ path: ["proposedContent"], message: "Required" }] },
        { status: 400 }
      );
    }

    if (proposedBot && prompt.type !== "BOT") {
      return NextResponse.json(
        { error: "validation_error", message: "proposedBot is only supported for bots" },
        { status: 400 }
      );
    }

    const originalBot = prompt.type === "BOT" ? botFieldsFromRecord(prompt) : null;
    const nextBot = originalBot ? (proposedBot ? botFieldsFromInput(proposedBot) : originalBot) : null;
    const titleChanged = !!proposedTitle && proposedTitle !== prompt.title;
    const botChanged = !!originalBot && !!nextBot && !botFieldsEqual(originalBot, nextBot);
    if (originalBot && proposedContent === prompt.content && !titleChanged && !botChanged) {
      return NextResponse.json(
        { error: "no_change", message: "The change request does not change the bot" },
        { status: 400 }
      );
    }

    const changeRequest = await db.changeRequest.create({
      data: {
        originalContent: prompt.content,
        originalTitle: prompt.title,
        proposedContent,
        proposedTitle,
        reason,
        promptId,
        authorId: session.user.id,
        ...(originalBot && {
          originalBot: originalBot as unknown as Prisma.InputJsonValue,
          proposedBot: nextBot as unknown as Prisma.InputJsonValue,
        }),
        ...(originalClassifier && nextClassifier && {
          originalClassifier: classifierJson(originalClassifier),
          proposedClassifier: classifierJson(nextClassifier),
        }),
      },
    });

    return NextResponse.json(changeRequest, { status: 201 });
  } catch (error) {
    console.error("Create change request error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: promptId } = await params;

    const prompt = await db.prompt.findUnique({
      where: { id: promptId },
      select: { isPrivate: true, authorId: true },
    });

    const denied = await checkPromptAccess(prompt);
    if (denied) return denied;

    const changeRequests = await db.changeRequest.findMany({
      where: { promptId },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json(changeRequests);
  } catch (error) {
    console.error("Get change requests error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
