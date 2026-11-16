import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user profile metadata (strictly excluding sensitive credentials)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        customLinks: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "not_found", message: "User not found" },
        { status: 404 }
      );
    }

    // Fetch all prompts authored by the user (public, private, unlisted, and soft-deleted)
    const prompts = await db.prompt.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        content: true,
        type: true,
        isPrivate: true,
        isUnlisted: true,
        deletedAt: true,
        mediaUrl: true,
        viewCount: true,
        structuredFormat: true,
        bestWithModels: true,
        bestWithMCP: true,
        workflowLink: true,
        botPlatforms: true,
        botIcon: true,
        botColor: true,
        installUrl: true,
        computerRequirements: true,
        botConfig: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
        versions: {
          orderBy: { version: "asc" },
          select: {
            id: true,
            version: true,
            content: true,
            changeNote: true,
            createdAt: true,
          },
        },
        userExamples: {
          where: { userId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            mediaUrl: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    // Fetch user prompt examples on other authors' prompts (AI usage artifacts)
    const additionalExamples = await db.userPromptExample.findMany({
      where: {
        userId,
        prompt: { authorId: { not: userId } },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        mediaUrl: true,
        comment: true,
        createdAt: true,
        prompt: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Format prompts payload with clean tag arrays
    const formattedPrompts = prompts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      content: p.content,
      type: p.type,
      isPrivate: p.isPrivate,
      isUnlisted: p.isUnlisted,
      deletedAt: p.deletedAt,
      mediaUrl: p.mediaUrl,
      viewCount: p.viewCount,
      structuredFormat: p.structuredFormat,
      bestWithModels: p.bestWithModels,
      bestWithMCP: p.bestWithMCP,
      workflowLink: p.workflowLink,
      botPlatforms: p.botPlatforms,
      botIcon: p.botIcon,
      botColor: p.botColor,
      installUrl: p.installUrl,
      computerRequirements: p.computerRequirements,
      botConfig: p.botConfig,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      category: p.category,
      tags: p.tags.map((t) => t.tag),
      versions: p.versions,
      examples: p.userExamples,
    }));

    const activePrompts = prompts.filter((p) => !p.deletedAt);
    const softDeletedPrompts = prompts.filter((p) => p.deletedAt !== null);

    const exportData = {
      $schema: "https://prompts.chat/schemas/export-v1.json",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        customLinks: user.customLinks,
        role: user.role,
        createdAt: user.createdAt,
      },
      stats: {
        totalPrompts: prompts.length,
        activePrompts: activePrompts.length,
        softDeletedPrompts: softDeletedPrompts.length,
        publicPrompts: activePrompts.filter((p) => !p.isPrivate && !p.isUnlisted).length,
        privatePrompts: activePrompts.filter((p) => p.isPrivate).length,
        unlistedPrompts: activePrompts.filter((p) => p.isUnlisted).length,
        promptExamplesCount: prompts.reduce((acc, p) => acc + p.userExamples.length, 0) + additionalExamples.length,
      },
      prompts: formattedPrompts,
      externalPromptExamples: additionalExamples,
    };

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `prompts-export-${user.username}-${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    console.error("Export user data error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to export user data" },
      { status: 500 }
    );
  }
}
