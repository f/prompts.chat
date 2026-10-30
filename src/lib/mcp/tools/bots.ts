import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAISearchEnabled, semanticSearch } from "@/lib/ai/embeddings";
import {
  BOT_COLORS,
  BOT_ICONS,
  BOT_PLATFORM_INFO,
  BOT_PLATFORMS,
  BOT_SORTS,
  botCategoryJson,
  botRoutineSchema,
  botSelect,
  botSkillSchema,
  botTagsJson,
  botToJson,
  findVisibleBot,
  getBotUrls,
  listBots,
  listBotsByAuthor,
  publicBotWhere,
  toBotView,
  type BotView,
} from "@/lib/bots";
import { botPairingsJson, getBotPairings } from "@/lib/bots/pairings";
import { findOwnBot, upsertOwnBot } from "@/lib/bots/upsert";
import { isTrending } from "@/lib/trending";
import type { McpContext } from "../context";
import { botDetailOutput, botSummaryOutput, cursorInput, decodeCursor, limitInput, nextCursor } from "../schemas";
import { findOrCreateTagIds, resolveCategoryId, resourceLink } from "../shared";
import { defineTool, toolResult, ToolError, unwrapWriteResult } from "../tool";

/** A bot as returned to its owner: the public JSON plus visibility fields only the owner sees */
function ownBotJson(ctx: McpContext, bot: BotView) {
  return {
    ...botToJson(bot, ctx.baseUrl),
    isPrivate: bot.isPrivate,
    isUnlisted: bot.isUnlisted,
    delistReason: bot.delistReason,
  };
}

function botSummary(ctx: McpContext, bot: BotView) {
  return {
    id: bot.id,
    slug: bot.slug,
    name: bot.title,
    description: bot.description,
    platforms: bot.platforms,
    platformNames: bot.platforms.map((platform) => BOT_PLATFORM_INFO[platform].name),
    icon: bot.icon,
    color: bot.color,
    category: botCategoryJson(bot),
    tags: botTagsJson(bot),
    author: bot.author.name || bot.author.username,
    votes: bot.voteCount,
    isTrending: isTrending(bot.trendingUntil),
    link: getBotUrls(bot, ctx.baseUrl).page,
  };
}

function botLink(bot: BotView) {
  return resourceLink("bots", { id: bot.id, title: bot.title, description: bot.description });
}

const platformInput = z.enum(BOT_PLATFORMS);

export function registerBotTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: "search_bots",
      title: "Search Bots",
      description:
        "Search the public prompts.chat bots directory (/bots): ready-made agents with instructions, routines, skills and connectors for agent platforms. " +
        "Filter by platform, category and tags; sort by newest, oldest or upvotes. With `semantic: true` and AI search enabled on the server, results are ranked by meaning instead of keywords (sort is then ignored). " +
        "Returns bot summaries with a resource link each; call get_bot for the full definition and install instructions.",
      kind: "read",
      // Semantic search embeds the query through the AI provider, so it shares the AI tool budget
      rateLimitKind: (args) => (args.semantic === true ? "ai" : "read"),
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Keywords matched against name, description and instructions; separate alternatives with commas"),
        platform: platformInput.optional().describe("Only bots that run on this platform"),
        category: z.string().optional().describe("Category slug; a parent category also matches its subcategories"),
        tags: z.array(z.string()).max(10).optional().describe("Tag slugs; every tag must match"),
        sort: z.enum(BOT_SORTS).default("newest").describe("Sort order for keyword results"),
        semantic: z.boolean().default(false).describe("Rank by meaning using AI search when the server supports it"),
        limit: limitInput(10, 50, "bots"),
        cursor: cursorInput,
      },
      outputSchema: {
        searchMode: z.enum(["keyword", "semantic"]),
        total: z.number().optional(),
        count: z.number(),
        bots: z.array(botSummaryOutput),
        nextCursor: z.string().optional(),
        notice: z.string().optional(),
      },
      failureMessage: "Failed to search bots",
    },
    async ({ query, platform, category, tags, sort, semantic, limit, cursor }) => {
      const offset = decodeCursor(cursor);
      const q = query?.trim();

      if (semantic && q && (await isAISearchEnabled())) {
        const where: Prisma.PromptWhereInput = {
          ...publicBotWhere,
          ...(platform && { botPlatforms: { has: platform } }),
          ...(category && { category: { OR: [{ slug: category }, { parent: { slug: category } }] } }),
          ...(tags?.length && { AND: tags.map((slug) => ({ tags: { some: { tag: { slug } } } })) }),
        };
        const ranked = (await semanticSearch(q, offset + limit + 1, { where })).slice(offset);
        const pageIds = ranked.slice(0, limit).map((r) => r.id);
        const records = await db.prompt.findMany({ where: { id: { in: pageIds } }, select: botSelect });
        const byId = new Map(records.map((r) => [r.id, toBotView(r)]));
        const bots = pageIds.map((id) => byId.get(id)).filter((bot): bot is BotView => !!bot);

        return toolResult(
          {
            searchMode: "semantic",
            count: bots.length,
            bots: bots.map((bot) => botSummary(ctx, bot)),
            nextCursor: ranked.length > limit ? nextCursor(offset, limit, limit) : undefined,
          },
          bots.map(botLink)
        );
      }

      const { bots, total } = await listBots({ platform, categorySlug: category, tagSlugs: tags, q, sort, skip: offset, take: limit });
      return toolResult(
        {
          searchMode: "keyword",
          total,
          count: bots.length,
          bots: bots.map((bot) => botSummary(ctx, bot)),
          nextCursor: nextCursor(offset, bots.length, limit, total),
          ...(semantic && q && { notice: "AI search is not enabled on this server; used keyword search instead." }),
        },
        bots.map(botLink)
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "get_bot",
      title: "Get Bot",
      description:
        "Get a bot from the prompts.chat bots directory by id (or its \"id_slug\" URL segment) or slug: its instructions, platforms, routines, skills, connectors, and per-platform install options " +
        "(one-click install link, a prompt to paste into the agent, or a CLI command), plus bots that work well with it. " +
        "Public and unlisted bots are visible to everyone; private bots only to their owner.",
      kind: "read",
      inputSchema: {
        id: z.string().optional().describe("Bot id or \"id_slug\" URL segment"),
        slug: z.string().optional().describe("Bot slug, used when no id is given"),
      },
      outputSchema: {
        ...botDetailOutput.shape,
        betterTogetherWith: z.array(
          z.looseObject({ id: z.string(), slug: z.string().nullable(), name: z.string(), note: z.string().nullable() })
        ),
      },
      failureMessage: "Failed to get bot",
    },
    async ({ id, slug }) => {
      if (!id && !slug) throw new ToolError("validation_error", "Provide an id or a slug");
      const bot = await findVisibleBot({ id, slug }, ctx.user);
      if (!bot) throw new ToolError("not_found", "Bot not found");

      const isOwner = ctx.user?.id === bot.authorId;
      const pairings = await getBotPairings(bot.id);
      return toolResult(
        {
          ...(isOwner ? ownBotJson(ctx, bot) : botToJson(bot, ctx.baseUrl)),
          betterTogetherWith: botPairingsJson(pairings, ctx.baseUrl),
        },
        [botLink(bot), ...pairings.map(({ bot: paired }) => botLink(paired))]
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "save_bot",
      title: "Save Bot",
      description:
        "Create or update one of your own bots in the prompts.chat bots directory (/bots), e.g. so an agent can back up its own definition. " +
        "Idempotent upsert: updates your bot matching `id`, else `slug`, else `name` (case-insensitive), and creates a new bot only when none matches. " +
        "Calling it again with the same definition changes nothing (action \"unchanged\"). On update, omitted optional fields keep their stored values and null clears them. " +
        "Uses the same validation, limits and moderation as the bot form on the website; new bots are private by default unless configured otherwise in settings. " +
        "Returns the action taken (created, updated or unchanged), the changed fields, and the saved bot with its id and slug: store the id to target this bot in later calls. Requires API key authentication.",
      kind: "write",
      requiresAuth: true,
      annotations: { idempotentHint: true },
      inputSchema: {
        id: z.string().optional().describe("Id of your existing bot to update. Fails if it is not one of your bots."),
        slug: z.string().optional().describe("Slug of your existing bot to update, as returned by save_bot or list_my_bots. Falls back to matching by name."),
        name: z.string().trim().min(1).max(200).describe("Bot name"),
        description: z.string().trim().max(500).optional().describe("Short summary of what the bot does"),
        instructions: z.string().trim().min(1).describe("The bot's standing instructions (its system prompt)"),
        platforms: z.array(platformInput).min(1).describe("Agent platforms the bot runs on"),
        icon: z.enum(BOT_ICONS).nullable().optional().describe("Preset icon; null for the default"),
        color: z.enum(BOT_COLORS).nullable().optional().describe("Preset color; null for the neutral default"),
        installUrl: z.string().nullable().optional().describe("https link that installs the bot in one click (Grok Bot template link)"),
        routines: z
          .array(botRoutineSchema.extend({ triggerLabel: botRoutineSchema.shape.triggerLabel.default("") }))
          .max(20)
          .optional()
          .describe("Routines: type \"schedule\" with a cron trigger, or \"event\" with a plain-language trigger, plus a self-contained task prompt. Replaces all routines."),
        skills: z
          .array(
            botSkillSchema.extend({
              description: botSkillSchema.shape.description.default(""),
              source: botSkillSchema.shape.source.default(""),
            })
          )
          .max(20)
          .optional()
          .describe("Skills the bot uses; source is a platform install ref or SKILL.md URL. Replaces all skills."),
        connectors: z
          .array(z.string().trim().min(1).max(50))
          .max(20)
          .optional()
          .describe("Connectors the user must connect, e.g. \"Gmail\". Replaces all connectors."),
        category: z.string().nullable().optional().describe("Category slug; null removes the category"),
        tags: z.array(z.string()).max(10).optional().describe("Tag names (created if they don't exist). Replaces all tags."),
        isPrivate: z.boolean().optional().describe("Whether the bot is private (new bots default to your account setting)"),
      },
      outputSchema: {
        success: z.literal(true),
        action: z.enum(["created", "updated", "unchanged"]),
        changedFields: z.array(z.string()),
        bot: botDetailOutput,
        link: z.string().nullable(),
      },
      failureMessage: "Failed to save bot",
    },
    async (
      { id, slug, name, description, instructions, platforms, icon, color, installUrl, routines, skills, connectors, category, tags, isPrivate },
      { user }
    ) => {
      const { action, bot, changedFields } = unwrapWriteResult(
        await upsertOwnBot(
          { id: user.id, role: user.role },
          {
            id,
            slug,
            title: name,
            description,
            content: instructions,
            botPlatforms: platforms,
            botIcon: icon,
            botColor: color,
            installUrl,
            routines,
            skills,
            connectors,
            categoryId: await resolveCategoryId(category),
            tagIds: tags === undefined ? undefined : await findOrCreateTagIds(tags),
            isPrivate,
          },
          { defaultPrivate: !user.mcpPromptsPublicByDefault }
        )
      );

      return toolResult(
        {
          success: true,
          action,
          changedFields,
          bot: ownBotJson(ctx, bot),
          link: bot.isPrivate ? null : getBotUrls(bot, ctx.baseUrl).page,
        },
        [botLink(bot)]
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "list_my_bots",
      title: "List My Bots",
      description:
        "List your own bots on prompts.chat, including private ones, newest first. Use it to find the id or slug of a bot before updating it with save_bot. Requires API key authentication.",
      kind: "read",
      requiresAuth: true,
      inputSchema: {
        limit: limitInput(50, 100, "bots"),
        cursor: cursorInput,
        offset: z.number().int().min(0).optional().describe("Deprecated: number of bots to skip. Use cursor instead."),
      },
      outputSchema: {
        total: z.number(),
        count: z.number(),
        bots: z.array(
          z.looseObject({
            id: z.string(),
            slug: z.string().nullable(),
            name: z.string(),
            description: z.string().nullable(),
            platforms: z.array(z.string()),
            isPrivate: z.boolean(),
            isUnlisted: z.boolean(),
            createdAt: z.string(),
            updatedAt: z.string(),
            link: z.string(),
          })
        ),
        nextCursor: z.string().optional(),
      },
      failureMessage: "Failed to list bots",
    },
    async ({ limit, cursor, offset: legacyOffset }, { user }) => {
      const offset = cursor ? decodeCursor(cursor) : (legacyOffset ?? 0);
      const { bots, total } = await listBotsByAuthor(user.id, { includePrivate: true, skip: offset, take: limit });
      return toolResult(
        {
          total,
          count: bots.length,
          bots: bots.map((bot) => ({
            id: bot.id,
            slug: bot.slug,
            name: bot.title,
            description: bot.description,
            platforms: bot.platforms,
            isPrivate: bot.isPrivate,
            isUnlisted: bot.isUnlisted,
            createdAt: bot.createdAt.toISOString(),
            updatedAt: bot.updatedAt.toISOString(),
            link: getBotUrls(bot, ctx.baseUrl).page,
          })),
          nextCursor: nextCursor(offset, bots.length, limit, total),
        },
        bots.map(botLink)
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "get_my_bot",
      title: "Get My Bot",
      description:
        "Get the full definition of one of your own bots (instructions, platforms, routines, skills, connectors, install options), including private ones, by id or slug. Use it to restore a bot from its prompts.chat backup. Requires API key authentication.",
      kind: "read",
      requiresAuth: true,
      inputSchema: {
        id: z.string().optional().describe("Bot id"),
        slug: z.string().optional().describe("Bot slug, used when no id is given"),
      },
      outputSchema: botDetailOutput.shape,
      failureMessage: "Failed to get bot",
    },
    async ({ id, slug }, { user }) => {
      if (!id && !slug) throw new ToolError("validation_error", "Provide an id or a slug");
      const bot = await findOwnBot(user.id, { id, slug });
      if (!bot) throw new ToolError("not_found", "Bot not found or you don't own it");
      return toolResult(ownBotJson(ctx, bot), [botLink(bot)]);
    }
  );
}
