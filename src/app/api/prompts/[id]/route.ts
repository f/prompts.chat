import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isTrending } from "@/lib/trending";
import { botPairingsJson, getBotPairings } from "@/lib/bots/pairings";
import { getSessionOrAdminApiKeyUser } from "@/lib/admin-auth";
import { updatePrompt } from "@/lib/prompt-write";

// Get single prompt
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const prompt = await db.prompt.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            verified: true,
          },
        },
        category: {
          include: {
            parent: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        versions: {
          orderBy: { version: "desc" },
          take: 10,
        },
        _count: {
          select: { votes: true },
        },
      },
    });

    if (!prompt || prompt.deletedAt) {
      return NextResponse.json(
        { error: "not_found", message: "Prompt not found" },
        { status: 404 }
      );
    }

    // Check if user can view private prompt
    if (prompt.isPrivate && prompt.authorId !== session?.user?.id) {
      return NextResponse.json(
        { error: "forbidden", message: "This prompt is private" },
        { status: 403 }
      );
    }

    // Check if logged-in user has voted
    let hasVoted = false;
    if (session?.user?.id) {
      const vote = await db.promptVote.findUnique({
        where: {
          userId_promptId: {
            userId: session.user.id,
            promptId: id,
          },
        },
      });
      hasVoted = !!vote;
    }

    const betterTogetherWith =
      prompt.type === "BOT"
        ? botPairingsJson(await getBotPairings(id, { includeHidden: session?.user?.role === "ADMIN" }), new URL(request.url).origin)
        : undefined;

    return NextResponse.json({
      ...prompt,
      isTrending: isTrending(prompt.trendingUntil),
      voteCount: prompt._count.votes,
      hasVoted,
      ...(betterTogetherWith && { betterTogetherWith }),
    });
  } catch (error) {
    console.error("Get prompt error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// Update prompt
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionOrAdminApiKeyUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const result = await updatePrompt(user, id, await request.json());
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Update prompt error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// Soft delete prompt
// - Admins can delete any prompt
// - Owners can delete their own delisted prompts (auto-delisted for quality issues)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    // Check if prompt exists and get ownership/delist status
    const existing = await db.prompt.findUnique({
      where: { id },
      select: { 
        id: true, 
        deletedAt: true, 
        authorId: true, 
        isUnlisted: true,
        delistReason: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "not_found", message: "Prompt not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "already_deleted", message: "Prompt is already deleted" },
        { status: 400 }
      );
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = existing.authorId === session.user.id;
    const isDelisted = existing.isUnlisted && existing.delistReason;

    // Owners can only delete their own delisted prompts (quality issues)
    // Admins can delete any prompt
    if (!isAdmin && !(isOwner && isDelisted)) {
      return NextResponse.json(
        { 
          error: "forbidden", 
          message: isOwner 
            ? "You can only delete prompts that have been delisted for quality issues. Contact an admin for other deletions."
            : "Prompts are released under CC0 and cannot be deleted. Contact an admin if there is an issue." 
        },
        { status: 403 }
      );
    }

    // Soft delete by setting deletedAt timestamp
    await db.prompt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Revalidate caches (prompts, categories, tags, flow counts change)
    revalidateTag("prompts", "max");
    revalidateTag("categories", "max");
    revalidateTag("tags", "max");
    revalidateTag("prompt-flow", "max");

    return NextResponse.json({ 
      success: true, 
      message: isOwner && isDelisted 
        ? "Delisted prompt deleted successfully" 
        : "Prompt soft deleted" 
    });
  } catch (error) {
    console.error("Delete prompt error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
