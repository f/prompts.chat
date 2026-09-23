import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatePromptEmbedding, findAndSaveRelatedPrompts } from "@/lib/ai/embeddings";
import { generatePromptSlug, slugify } from "@/lib/slug";
import { checkPromptQuality } from "@/lib/ai/quality-check";

const updatePromptSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "SKILL", "TASTE"]).optional(), // Output type, SKILL, or TASTE
  structuredFormat: z.enum(["JSON", "YAML"]).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  newTags: z.array(z.string()).optional(),
  contributorIds: z.array(z.string()).optional(),
  isPrivate: z.boolean().optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")).nullable(),
  requiresMediaUpload: z.boolean().optional(),
  requiredMediaType: z.enum(["IMAGE", "VIDEO", "DOCUMENT"]).optional().nullable(),
  requiredMediaCount: z.number().int().min(1).max(10).optional().nullable(),
  bestWithModels: z.array(z.string()).max(3).optional(),
  bestWithMCP: z.array(z.object({
    command: z.string(),
    tools: z.array(z.string()).optional(),
  })).optional(),
  workflowLink: z.string().url().optional().or(z.literal("")).nullable(),
});

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

    // Omit embedding from response (it's large binary data)
    const { embedding: _embedding, ...promptWithoutEmbedding } = prompt;

    return NextResponse.json({
      ...promptWithoutEmbedding,
      voteCount: prompt._count.votes,
      hasVoted,
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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    // Check if prompt exists and user owns it
    const existing = await db.prompt.findUnique({
      where: { id },
      select: { authorId: true, content: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "not_found", message: "Prompt not found" },
        { status: 404 }
      );
    }

    if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "forbidden", message: "You can only edit your own prompts" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updatePromptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { tagIds, newTags, contributorIds, categoryId, mediaUrl, title, bestWithModels, bestWithMCP, workflowLink, ...data } = parsed.data;

    // Regenerate slug if title changed
    let newSlug: string | undefined;
    if (title) {
      newSlug = await generatePromptSlug(title);
    }

    // Convert empty strings to null for optional foreign keys
    const cleanedData = {
      ...data,
      ...(title && { title }),
      ...(newSlug && { slug: newSlug }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
      ...(mediaUrl !== undefined && { mediaUrl: mediaUrl || null }),
      ...(bestWithModels !== undefined && { bestWithModels }),
      ...(bestWithMCP !== undefined && { bestWithMCP }),
      ...(workflowLink !== undefined && { workflowLink: workflowLink || null }),
    };

    let finalTagIds: string[] | undefined = tagIds ? [...tagIds] : undefined;
    if (newTags && newTags.length > 0) {
      if (!finalTagIds) finalTagIds = [];
      for (const tagName of newTags) {
        const normalized = tagName.trim();
        if (!normalized) continue;
        const tagSlug = slugify(normalized);
        if (!tagSlug) continue;

        let tag = await db.tag.findUnique({ where: { slug: tagSlug } });
        if (!tag) {
          try {
            tag = await db.tag.create({
              data: {
                name: normalized,
                slug: tagSlug,
              },
            });
          } catch (e) {
            // Handle race condition where another request created it
            tag = await db.tag.findUnique({ where: { slug: tagSlug } });
          }
        }
        if (tag && !finalTagIds.includes(tag.id)) {
          finalTagIds.push(tag.id);
        }
      }
    }

    // Update prompt
    const prompt = await db.prompt.update({
      where: { id },
      data: {
        ...cleanedData,
        ...(finalTagIds && {
          tags: {
            deleteMany: {},
            create: finalTagIds.map((tagId) => ({ tagId })),
          },
        }),
        ...(contributorIds !== undefined && {
          contributors: {
            set: contributorIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
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
      },
    });

    // Create new version if content changed
    if (data.content && data.content !== existing.content) {
      const latestVersion = await db.promptVersion.findFirst({
        where: { promptId: id },
        orderBy: { version: "desc" },
      });

      await db.promptVersion.create({
        data: {
          promptId: id,
          version: (latestVersion?.version || 0) + 1,
          content: data.content,
          changeNote: "Content updated",
          createdBy: session.user.id,
        },
      });
    }

    // Regenerate embedding if content, title, or description changed (non-blocking)
    // Only for public prompts - the function checks if aiSearch is enabled
    // After embedding is regenerated, update related prompts
    const contentChanged = data.content || title || data.description !== undefined;
    if (contentChanged && !prompt.isPrivate) {
      generatePromptEmbedding(id)
        .then(() => findAndSaveRelatedPrompts(id))
        .catch((err) =>
          console.error("Failed to regenerate embedding/related prompts for:", id, err)
        );
    }

    // Run quality check for auto-delist on content changes (non-blocking)
    // Only for public prompts that aren't already delisted
    if (contentChanged && !prompt.isPrivate && !prompt.isUnlisted) {
      const checkTitle = title || prompt.title;
      const checkContent = data.content || prompt.content;
      const checkDescription = data.description !== undefined ? data.description : prompt.description;
      
      console.log(`[Quality Check] Starting check for updated prompt ${id}`);
      checkPromptQuality(checkTitle, checkContent, checkDescription).then(async (result) => {
        console.log(`[Quality Check] Result for prompt ${id}:`, JSON.stringify(result));
        if (result.shouldDelist && result.reason) {
          console.log(`[Quality Check] Auto-delisting prompt ${id}: ${result.reason} - ${result.details}`);
          await db.prompt.update({
            where: { id },
            data: {
              isUnlisted: true,
              unlistedAt: new Date(),
              delistReason: result.reason,
            },
          });
          console.log(`[Quality Check] Prompt ${id} delisted successfully`);
        }
      }).catch((err) => {
        console.error("[Quality Check] Failed to run quality check for prompt:", id, err);
      });
    }

    // Propagate workflow link to all prompts in the same workflow chain (not "related" ones)
    if (workflowLink !== undefined) {
      const newWorkflowLink = workflowLink || null;
      
      // Get all flow connections (excluding "related")
      const allFlowConnections = await db.promptConnection.findMany({
        where: {
          label: { not: "related" },
        },
        select: {
          sourceId: true,
          targetId: true,
        },
      });

      // Build adjacency list for the workflow graph
      const adjacency = new Map<string, Set<string>>();
      allFlowConnections.forEach((conn) => {
        if (!adjacency.has(conn.sourceId)) adjacency.set(conn.sourceId, new Set());
        if (!adjacency.has(conn.targetId)) adjacency.set(conn.targetId, new Set());
        adjacency.get(conn.sourceId)!.add(conn.targetId);
        adjacency.get(conn.targetId)!.add(conn.sourceId);
      });

      // BFS to find all prompts in the same workflow chain
      const workflowPromptIds = new Set<string>();
      const queue = [id];
      workflowPromptIds.add(id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = adjacency.get(current);
        if (neighbors) {
          neighbors.forEach((neighborId) => {
            if (!workflowPromptIds.has(neighborId)) {
              workflowPromptIds.add(neighborId);
              queue.push(neighborId);
            }
          });
        }
      }

      // Remove current prompt from update set (already updated above)
      workflowPromptIds.delete(id);

      // Update all prompts in the workflow with the same workflow link
      if (workflowPromptIds.size > 0) {
        await db.prompt.updateMany({
          where: {
            id: { in: Array.from(workflowPromptIds) },
          },
          data: {
            workflowLink: newWorkflowLink,
          },
        });
      }
    }

    // Revalidate prompts and flow cache
    revalidateTag("prompts", "max");
    revalidateTag("prompt-flow", "max");

    return NextResponse.json(prompt);
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
