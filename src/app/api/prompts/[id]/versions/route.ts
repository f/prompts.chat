import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkPromptAccess } from "@/lib/prompt-access";

const createVersionSchema = z.object({
  content: z.string().min(1, "Content is required"),
  changeNote: z.string().max(500).optional(),
});

// POST - Create a new version
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

    // Check if prompt exists and user is owner
    const prompt = await db.prompt.findUnique({
      where: { id: promptId },
      select: { authorId: true, content: true },
    });

    if (!prompt) {
      return NextResponse.json(
        { error: "not_found", message: "Prompt not found" },
        { status: 404 }
      );
    }

    if (prompt.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "You can only add versions to your own prompts" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createVersionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { content, changeNote } = parsed.data;

    // Check if content is different
    if (content === prompt.content) {
      return NextResponse.json(
        { error: "no_change", message: "Content is the same as current version" },
        { status: 400 }
      );
    }

    // Get latest version number
    const latestVersion = await db.promptVersion.findFirst({
      where: { promptId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const newVersionNumber = (latestVersion?.version || 0) + 1;

    // Create new version and update prompt content in a transaction
    const version = await db.$transaction(async (tx) => {
      const created = await tx.promptVersion.create({
        data: {
          promptId,
          version: newVersionNumber,
          content,
          changeNote: changeNote || `Version ${newVersionNumber}`,
          createdBy: session.user.id,
        },
        include: {
          author: {
            select: {
              name: true,
              username: true,
            },
          },
        },
      });
      await tx.prompt.update({
        where: { id: promptId },
        data: { content },
      });
      return created;
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Create version error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// GET - Get all versions
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

    const versions = await db.promptVersion.findMany({
      where: { promptId },
      orderBy: { version: "desc" },
      include: {
        author: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Get versions error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
