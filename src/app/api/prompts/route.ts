import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triggerWebhooks } from "@/lib/webhook";
import { generatePromptEmbedding, findAndSaveRelatedPrompts } from "@/lib/ai/embeddings";
import { generatePromptSlug } from "@/lib/slug";
import { checkPromptQuality } from "@/lib/ai/quality-check";
import { isSimilarContent, normalizeContent } from "@/lib/similarity";
import { logger } from "@/lib/logger";

const promptSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  content: z.string().min(1),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "SKILL"]), // Output type or SKILL
  structuredFormat: z.enum(["JSON", "YAML"]).nullish(), // Input type indicator
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()),
  contributorIds: z.array(z.string()).optional(),
  isPrivate: z.boolean(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  requiresMediaUpload: z.boolean().optional(),
  requiredMediaType: z.enum(["IMAGE", "VIDEO", "DOCUMENT"]).optional(),
  requiredMediaCount: z.number().int().min(1).max(10).optional(),
  bestWithModels: z.array(z.string()).max(3).optional(),
  bestWithMCP: z.array(z.object({
    command: z.string(),
    tools: z.array(z.string()).optional(),
  })).optional(),
  workflowLink: z.string().url().optional().or(z.literal("")),
});

// Create prompt
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = promptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { title, description, content, type, structuredFormat, categoryId, tagIds, contributorIds, isPrivate, mediaUrl, requiresMediaUpload, requiredMediaType, requiredMediaCount, bestWithModels, bestWithMCP, workflowLink } = parsed.data;

    // Check if user is flagged (for auto-delisting and daily limit)
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { flagged: true },
    });
    const isUserFlagged = currentUser?.flagged ?? false;

    // Daily limit for flagged users: 5 prompts per day
    if (isUserFlagged) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const todayPromptCount = await db.prompt.count({
        where: {
          authorId: session.user.id,
          createdAt: { gte: startOfDay },
        },
      });

      if (todayPromptCount >= 5) {
        return NextResponse.json(
          { error: "daily_limit", message: "You have reached the daily limit of 5 prompts" },
          { status: 429 }
        );
      }
    }

    // Rate limit: Check if user created a prompt in the last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const recentPrompt = await db.prompt.findFirst({
      where: {
        authorId: session.user.id,
        createdAt: { gte: thirtySecondsAgo },
      },
      select: { id: true },
    });

    if (recentPrompt) {
      return NextResponse.json(
        { error: "rate_limit", message: "Please wait 30 seconds before creating another prompt" },
        { status: 429 }
      );
    }

    // Check for duplicate title or content from the same user
    const userDuplicate = await db.prompt.findFirst({
      where: {
        authorId: session.user.id,
        deletedAt: null,
        OR: [
          { title: { equals: title, mode: "insensitive" } },
          { content: content },
        ],
      },
      select: { id: true, slug: true, title: true },
    });

    if (userDuplicate) {
      return NextResponse.json(
        { 
          error: "duplicate_prompt", 
          message: "You already have a prompt with the same title or content",
          existingPromptId: userDuplicate.id,
          existingPromptSlug: userDuplicate.slug,
        },
        { status: 409 }
      );
    }

    // Check for similar content system-wide (any user)
    // First, get a batch of public prompts to check similarity against
    const normalizedNewContent = normalizeContent(content);
    
    // Only check if normalized content has meaningful length
    if (normalizedNewContent.length > 50) {
      // Get recent public prompts to check for similarity (limit to avoid performance issues)
      const publicPrompts = await db.prompt.findMany({
        where: {
          deletedAt: null,
          isPrivate: false,
        },
        select: { 
          id: true, 
          slug: true, 
          title: true, 
          content: true,
          author: { select: { username: true } } 
        },
        orderBy: { createdAt: "desc" },
        take: 1000, // Check against last 1000 public prompts
      });

      // Find similar content using our similarity algorithm
      const similarPrompt = publicPrompts.find((p: { id: string; slug: string | null; title: string; content: string; author: { username: string } }) => isSimilarContent(content, p.content));

      if (similarPrompt) {
        return NextResponse.json(
          { 
            error: "content_exists", 
            message: "A prompt with similar content already exists",
            existingPromptId: similarPrompt.id,
            existingPromptSlug: similarPrompt.slug,
            existingPromptTitle: similarPrompt.title,
            existingPromptAuthor: similarPrompt.author.username,
          },
          { status: 409 }
        );
      }
    }

    // Generate slug from title (translated to English)
    const slug = await generatePromptSlug(title);

    // Create prompt with tags
    // Auto-delist if user is flagged
    const prompt = await db.prompt.create({
      data: {
        title,
        slug,
        description: description || null,
        content,
        type,
        structuredFormat: structuredFormat || null,
        isPrivate,
        mediaUrl: mediaUrl || null,
        requiresMediaUpload: requiresMediaUpload || false,
        requiredMediaType: requiresMediaUpload ? requiredMediaType : null,
        requiredMediaCount: requiresMediaUpload ? requiredMediaCount : null,
        bestWithModels: bestWithModels || [],
        bestWithMCP: bestWithMCP || [],
        workflowLink: workflowLink || null,
        authorId: session.user.id,
        categoryId: categoryId || null,
        // Auto-delist prompts from flagged users
        ...(isUserFlagged && {
          isUnlisted: true,
          unlistedAt: new Date(),
          delistReason: "UNUSUAL_ACTIVITY",
        }),
        tags: {
          create: tagIds.map((tagId) => ({
            tagId,
          })),
        },
        ...(contributorIds && contributorIds.length > 0 && {
          contributors: {
            connect: contributorIds.map((id) => ({ id })),
          },
        }),
      },
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
      },
    });

    // Create initial version
    await db.promptVersion.create({
      data: {
        promptId: prompt.id,
        version: 1,
        content,
        changeNote: "Initial version",
        createdBy: session.user.id,
      },
    });

    // Trigger webhooks for new prompt (non-blocking)
    if (!isPrivate) {
      triggerWebhooks("PROMPT_CREATED", {
        id: prompt.id,
        title: prompt.title,
        description: prompt.description,
        content: prompt.content,
        type: prompt.type,
        mediaUrl: prompt.mediaUrl,
        isPrivate: prompt.isPrivate,
        author: prompt.author,
        category: prompt.category,
        tags: prompt.tags,
      });
    }

    // Generate embedding for AI search (non-blocking)
    // Only for public prompts - the function checks if aiSearch is enabled
    // After embedding is generated, find and save related prompts
    if (!isPrivate) {
      generatePromptEmbedding(prompt.id)
        .then(() => findAndSaveRelatedPrompts(prompt.id))
        .catch((err) =>
          logger.error({ error: err, promptId: prompt.id }, "Failed to generate embedding/related prompts")
        );
    }

    // Run quality check for auto-delist (non-blocking for public prompts)
    // This runs in the background and will delist the prompt if quality issues are found
    if (!isPrivate) {
      logger.info({ promptId: prompt.id }, "[Quality Check] Starting check");
      checkPromptQuality(title, content, description).then(async (result) => {
        logger.info({ promptId: prompt.id, result }, "[Quality Check] Result");
        if (result.shouldDelist && result.reason) {
          logger.info({ promptId: prompt.id, reason: result.reason, details: result.details }, "[Quality Check] Auto-delisting prompt");
          await db.prompt.update({
            where: { id: prompt.id },
            data: {
              isUnlisted: true,
              unlistedAt: new Date(),
              delistReason: result.reason,
            },
          });
          logger.info({ promptId: prompt.id }, "[Quality Check] Prompt delisted successfully");
        }
      }).catch((err) => {
        logger.error({ error: err, promptId: prompt.id }, "[Quality Check] Failed to run quality check");
      });
    } else {
      logger.debug({ promptId: prompt.id }, "[Quality Check] Skipped - prompt is private");
    }

    // Revalidate caches (prompts, categories, tags counts change)
    revalidateTag("prompts", "max");
    revalidateTag("categories", "max");
    revalidateTag("tags", "max");

    return NextResponse.json(prompt);
  } catch (error) {
    console.error("Create prompt error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// List prompts (for API access)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "24");
    const type = searchParams.get("type");
    const categoryId = searchParams.get("category");
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sort");
    const q = searchParams.get("q");

    const where: Record<string, unknown> = {
      isPrivate: false,
      isUnlisted: false, // Exclude unlisted prompts from public API
      deletedAt: null, // Exclude soft-deleted prompts
      // Exclude intermediate flow prompts (only show first prompts or standalone)
      // Note: "related" connections are AI-suggested similar prompts, not flow connections
      incomingConnections: { none: { label: { not: "related" } } },
    };

    if (type) {
      where.type = type;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tag) {
      // Handle multiple tags (comma-separated)
      const tagSlugs = tag.split(",").map(t => t.trim()).filter(Boolean);
      if (tagSlugs.length > 0) {
        where.AND = tagSlugs.map(slug => ({
          tags: {
            some: {
              tag: { slug },
            },
          },
        }));
      }
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    // Build order by clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { createdAt: "desc" };
    if (sort === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (sort === "upvotes") {
      orderBy = { votes: { _count: "desc" } };
    }

    const [promptsRaw, total] = await Promise.all([
      db.prompt.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
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
              parent: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          contributors: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              votes: true,
              contributors: true,
              outgoingConnections: { where: { label: { not: "related" } } },
              incomingConnections: { where: { label: { not: "related" } } },
            },
          },
          userExamples: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              mediaUrl: true,
              user: {
                select: {
                  username: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      db.prompt.count({ where }),
    ]);

    // Transform to include voteCount and contributorCount, exclude internal fields
    const prompts = promptsRaw.map((promptRaw: any) => {
      const { embedding, isPrivate, isUnlisted, unlistedAt, deletedAt, ...p } = promptRaw;
      return {
        ...p,
        voteCount: p._count.votes,
        contributorCount: p._count.contributors,
        contributors: p.contributors,
      };
    });

    return NextResponse.json({
      prompts,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    logger.error({ error }, "List prompts error");
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
