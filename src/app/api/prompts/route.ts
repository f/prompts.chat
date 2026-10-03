import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triggerWebhooks } from "@/lib/webhook";
import { generatePromptEmbedding, findAndSaveRelatedPrompts } from "@/lib/ai/embeddings";
import { generatePromptSlug, slugify } from "@/lib/slug";
import { checkPromptQuality } from "@/lib/ai/quality-check";
import { isSimilarContent, normalizeContent } from "@/lib/similarity";

const promptSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  content: z.string().min(1),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "SKILL", "TASTE"]), // Output type, SKILL, or TASTE
  structuredFormat: z.enum(["JSON", "YAML"]).nullish(), // Input type indicator
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()),
  newTags: z.array(z.string()).optional(),
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

    const { title, description, content, type, structuredFormat, categoryId, tagIds, newTags, contributorIds, isPrivate, mediaUrl, requiresMediaUpload, requiredMediaType, requiredMediaCount, bestWithModels, bestWithMCP, workflowLink } = parsed.data;

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
      const similarPrompt = publicPrompts.find(p => isSimilarContent(content, p.content));

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

    const finalTagIds = [...tagIds];
    if (newTags && newTags.length > 0) {
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
          create: finalTagIds.map((tagId) => ({
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
          console.error("Failed to generate embedding/related prompts for:", prompt.id, err)
        );
    }

    // Run quality check for auto-delist (non-blocking for public prompts)
    // This runs in the background and will delist the prompt if quality issues are found
    if (!isPrivate) {
      console.log(`[Quality Check] Starting check for prompt ${prompt.id}`);
      checkPromptQuality(title, content, description).then(async (result) => {
        console.log(`[Quality Check] Result for prompt ${prompt.id}:`, JSON.stringify(result));
        if (result.shouldDelist && result.reason) {
          console.log(`[Quality Check] Auto-delisting prompt ${prompt.id}: ${result.reason} - ${result.details}`);
          await db.prompt.update({
            where: { id: prompt.id },
            data: {
              isUnlisted: true,
              unlistedAt: new Date(),
              delistReason: result.reason,
            },
          });
          console.log(`[Quality Check] Prompt ${prompt.id} delisted successfully`);
        }
      }).catch((err) => {
        console.error("[Quality Check] Failed to run quality check for prompt:", prompt.id, err);
      });
    } else {
      console.log(`[Quality Check] Skipped - prompt ${prompt.id} is private`);
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
const MAX_API_PER_PAGE = 100;
const DEFAULT_API_PER_PAGE = 24;
const MAX_API_PAGE = 10000;
const DEFAULT_API_PAGE = 1;

const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .transform((value) => Math.min(value, MAX_API_PAGE))
    .catch(DEFAULT_API_PAGE),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .transform((value) => Math.min(value, MAX_API_PER_PAGE))
    .catch(DEFAULT_API_PER_PAGE),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage } = paginationQuerySchema.parse({
      page: searchParams.get("page"),
      perPage: searchParams.get("perPage"),
    });
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
    const prompts = promptsRaw.map(({ embedding: _e, isPrivate: _p, isUnlisted: _u, unlistedAt: _ua, deletedAt: _d, ...p }) => ({
      ...p,
      voteCount: p._count.votes,
      contributorCount: p._count.contributors,
      contributors: p.contributors,
    }));

    return NextResponse.json({
      prompts,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error("List prompts error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
