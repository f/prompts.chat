import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { triggerWebhooks } from "@/lib/webhook";
import { generatePromptEmbedding, findAndSaveRelatedPrompts } from "@/lib/ai/embeddings";
import { generatePromptSlug } from "@/lib/slug";
import { checkPromptQuality } from "@/lib/ai/quality-check";
import { isSimilarContent, normalizeContent } from "@/lib/similarity";
import { BOT_PLATFORMS, EMPTY_BOT_CONFIG, botColorSchema, botComputerRequirementSchema, botConfigSchema, botIconSchema, botPairingsSchema, botPlatformsData, botPlatformsSchema, installUrlSchema } from "@/lib/bots/schema";
import { BotPairingError, buildPairingRows, findInvalidPairingTargets, replaceBotPairings } from "@/lib/bots/pairings";

/**
 * Prompt (and bot) create and update logic shared by POST /api/prompts, PATCH /api/prompts/[id]
 * and the MCP server (src/lib/mcp), so every client goes through the same validation, limits and side effects.
 */

export interface PromptWriter {
  id: string;
  role: string;
}

export type PromptWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: { error: string; message: string; [key: string]: unknown } };

function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}): PromptWriteResult<never> {
  return { ok: false, status, body: { error, message, ...extra } };
}

export const promptCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  content: z.string().min(1),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "SKILL", "TASTE", "BOT"]), // Output type, SKILL, TASTE, or BOT
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
  // BOT prompts only
  botPlatforms: botPlatformsSchema.optional(),
  /** Deprecated single-platform alias for botPlatforms */
  botPlatform: z.enum(BOT_PLATFORMS).optional(),
  botIcon: botIconSchema.nullish().or(z.literal("")),
  botColor: botColorSchema.nullish().or(z.literal("")),
  computerRequirement: botComputerRequirementSchema.optional(),
  installUrl: installUrlSchema.optional().or(z.literal("")),
  botConfig: botConfigSchema.optional(),
  /** "Better together with" links to other bots; admins only */
  pairings: botPairingsSchema.optional(),
}).refine((data) => data.type !== "BOT" || !!data.botPlatforms || !!data.botPlatform, {
  message: "botPlatforms is required for bots",
  path: ["botPlatforms"],
}).refine((data) => data.type === "BOT" || data.pairings === undefined, {
  message: "pairings are only supported for bots",
  path: ["pairings"],
});

export const promptUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "SKILL", "TASTE", "BOT"]).optional(), // Output type, SKILL, TASTE, or BOT
  structuredFormat: z.enum(["JSON", "YAML"]).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
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
  // BOT prompts only
  botPlatforms: botPlatformsSchema.optional(),
  /** Deprecated single-platform alias for botPlatforms */
  botPlatform: z.enum(BOT_PLATFORMS).optional(),
  botIcon: botIconSchema.nullish().or(z.literal("")),
  botColor: botColorSchema.nullish().or(z.literal("")),
  computerRequirement: botComputerRequirementSchema.optional(),
  installUrl: installUrlSchema.optional().or(z.literal("")).nullable(),
  botConfig: botConfigSchema.optional(),
  /** Replaces every "Better together with" link of the bot; admins only */
  pairings: botPairingsSchema.optional(),
});

/** A failed cache revalidation must not fail a write that has already been committed */
function revalidateTags(tags: string[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag, "max");
    } catch (error) {
      console.warn(`Could not revalidate cache tag "${tag}":`, error instanceof Error ? error.message : error);
    }
  }
}

export async function createPrompt(user: PromptWriter, body: unknown) {
  const parsed = promptCreateSchema.safeParse(body);

  if (!parsed.success) {
    return fail(400, "validation_error", "Invalid input", { details: parsed.error.issues });
  }

  const { title, description, content, type, structuredFormat, categoryId, tagIds, contributorIds, isPrivate, mediaUrl, requiresMediaUpload, requiredMediaType, requiredMediaCount, bestWithModels, bestWithMCP, workflowLink, botPlatforms, botPlatform, botIcon, botColor, computerRequirement, installUrl, botConfig, pairings } = parsed.data;
  const isBot = type === "BOT";

  if (pairings !== undefined) {
    if (user.role !== "ADMIN") {
      return fail(403, "forbidden", "Only admins can pair bots");
    }
    const invalid = await findInvalidPairingTargets(pairings.map((pairing) => pairing.botId));
    if (invalid.length > 0) {
      return fail(400, "invalid_pairing", "Paired bots must be existing bots", { botIds: invalid });
    }
  }

  // Check if user is flagged (for auto-delisting and daily limit)
  const currentUser = await db.user.findUnique({
    where: { id: user.id },
    select: { flagged: true },
  });
  const isUserFlagged = currentUser?.flagged ?? false;

  // Daily limit for flagged users: 5 prompts per day
  if (isUserFlagged) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayPromptCount = await db.prompt.count({
      where: {
        authorId: user.id,
        createdAt: { gte: startOfDay },
      },
    });

    if (todayPromptCount >= 5) {
      return fail(429, "daily_limit", "You have reached the daily limit of 5 prompts");
    }
  }

  // Rate limit: Check if user created a prompt in the last 30 seconds
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const recentPrompt = await db.prompt.findFirst({
    where: {
      authorId: user.id,
      createdAt: { gte: thirtySecondsAgo },
    },
    select: { id: true },
  });

  if (recentPrompt) {
    return fail(429, "rate_limit", "Please wait 30 seconds before creating another prompt");
  }

  // Check for duplicate title or content from the same user
  const userDuplicate = await db.prompt.findFirst({
    where: {
      authorId: user.id,
      deletedAt: null,
      OR: [
        { title: { equals: title, mode: "insensitive" } },
        { content: content },
      ],
    },
    select: { id: true, slug: true, title: true },
  });

  if (userDuplicate) {
    return fail(409, "duplicate_prompt", "You already have a prompt with the same title or content", {
      existingPromptId: userDuplicate.id,
      existingPromptSlug: userDuplicate.slug,
    });
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
        author: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // Check against last 1000 public prompts
    });

    // Find similar content using our similarity algorithm
    const similarPrompt = publicPrompts.find(p => isSimilarContent(content, p.content));

    if (similarPrompt) {
      return fail(409, "content_exists", "A prompt with similar content already exists", {
        existingPromptId: similarPrompt.id,
        existingPromptSlug: similarPrompt.slug,
        existingPromptTitle: similarPrompt.title,
        existingPromptAuthor: similarPrompt.author.username,
      });
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
      ...(isBot && {
        ...botPlatformsData(botPlatforms ?? (botPlatform ? [botPlatform] : [])),
        botIcon: botIcon || null,
        botColor: botColor || null,
        computerRequirement: computerRequirement ?? "NONE",
        installUrl: installUrl || null,
        botConfig: botConfig ?? EMPTY_BOT_CONFIG,
      }),
      authorId: user.id,
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

  if (pairings && pairings.length > 0) {
    await db.botPairing.createMany({ data: buildPairingRows(prompt.id, pairings), skipDuplicates: true });
  }

  // Create initial version
  await db.promptVersion.create({
    data: {
      promptId: prompt.id,
      version: 1,
      content,
      changeNote: "Initial version",
      createdBy: user.id,
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
  revalidateTags(["prompts", "categories", "tags"]);

  return {
    ok: true as const,
    data: {
      ...prompt,
      ...(pairings && { pairings: pairings.map(({ botId, note }) => ({ botId, note: note || null })) }),
    },
  };
}

export async function updatePrompt(user: PromptWriter, id: string, body: unknown) {
  // Check if prompt exists and user owns it
  const existing = await db.prompt.findUnique({
    where: { id },
    select: { authorId: true, content: true, type: true },
  });

  if (!existing) {
    return fail(404, "not_found", "Prompt not found");
  }

  if (existing.authorId !== user.id && user.role !== "ADMIN") {
    return fail(403, "forbidden", "You can only edit your own prompts");
  }

  const parsed = promptUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return fail(400, "validation_error", "Invalid input", { details: parsed.error.issues });
  }

  const { tagIds, contributorIds, categoryId, mediaUrl, title, bestWithModels, bestWithMCP, workflowLink, installUrl, botPlatforms, botPlatform, botIcon, botColor, pairings, ...data } = parsed.data;

  let pairingRows: ReturnType<typeof buildPairingRows> | undefined;
  if (pairings !== undefined) {
    if (user.role !== "ADMIN") {
      return fail(403, "forbidden", "Only admins can pair bots");
    }
    if ((data.type ?? existing.type) !== "BOT") {
      return fail(400, "validation_error", "pairings are only supported for bots");
    }
    try {
      pairingRows = buildPairingRows(id, pairings);
    } catch (error) {
      if (error instanceof BotPairingError) {
        return fail(400, "invalid_pairing", error.message);
      }
      throw error;
    }
    const invalid = await findInvalidPairingTargets(pairings.map((pairing) => pairing.botId));
    if (invalid.length > 0) {
      return fail(400, "invalid_pairing", "Paired bots must be existing bots", { botIds: invalid });
    }
  }
  const nextBotPlatforms = botPlatforms ?? (botPlatform ? [botPlatform] : undefined);

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
    ...(installUrl !== undefined && { installUrl: installUrl || null }),
    ...(nextBotPlatforms && botPlatformsData(nextBotPlatforms)),
    ...(botIcon !== undefined && { botIcon: botIcon || null }),
    ...(botColor !== undefined && { botColor: botColor || null }),
  };

  // Update prompt
  const prompt = await db.prompt.update({
    where: { id },
    data: {
      ...cleanedData,
      ...(tagIds && {
        tags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({ tagId })),
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

  if (pairingRows) {
    await replaceBotPairings(id, pairingRows);
  }

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
        createdBy: user.id,
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
  revalidateTags(["prompts", "prompt-flow"]);

  return {
    ok: true as const,
    data: {
      ...prompt,
      ...(pairings && { pairings: pairings.map(({ botId, note }) => ({ botId, note: note || null })) }),
    },
  };
}
