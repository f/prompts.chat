import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";
import { createPrompt } from "@/lib/prompt-write";
import type { McpContext } from "../context";
import {
  categorySlugInput,
  cursorInput,
  decodeCursor,
  isPrivateInput,
  limitInput,
  nextCursor,
  promptSummaryOutput,
  tagNamesInput,
} from "../schemas";
import {
  authorName,
  directVisibility,
  findOrCreateTagIds,
  getPromptName,
  listingVisibility,
  promptWebUrl,
  resolveCategoryId,
  resourceLink,
} from "../shared";
import { defineTool, toolResult, ToolError, unwrapWriteResult } from "../tool";
import { extractVariables, fillVariables, missingVariables } from "../variables";

const PROMPT_TYPES = ["TEXT", "STRUCTURED", "IMAGE", "VIDEO", "AUDIO"] as const;

/**
 * The web form stores structured prompts as TEXT with a structuredFormat; older MCP clients
 * stored them with the STRUCTURED type, so the filter matches both
 */
function promptTypeWhere(type: (typeof PROMPT_TYPES)[number] | undefined): Prisma.PromptWhereInput {
  if (!type) return NON_BOT_PROMPTS;
  if (type === "STRUCTURED") return { OR: [{ type: "STRUCTURED" }, { type: "TEXT", structuredFormat: { not: null } }] };
  return { type };
}

export function registerPromptTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: "search_prompts",
      title: "Search Prompts",
      description:
        "Search for AI prompts by keyword. Returns matching prompts with title, description, a content preview, author, category, and tags, plus a resource link per prompt. Use this to discover prompts for various AI tasks like coding, writing, analysis, and more. Your own private prompts are included when you are signed in.",
      kind: "read",
      inputSchema: {
        query: z.string().describe("Search query to find relevant prompts"),
        limit: limitInput(10, 50, "prompts"),
        cursor: cursorInput,
        type: z.enum(PROMPT_TYPES).optional().describe("Filter by prompt type"),
        category: categorySlugInput.describe("Filter by category slug"),
        tag: z.string().optional().describe("Filter by tag slug"),
      },
      outputSchema: {
        query: z.string(),
        count: z.number(),
        prompts: z.array(promptSummaryOutput.extend({ contentPreview: z.string() })),
        nextCursor: z.string().optional(),
      },
      failureMessage: "Failed to search prompts",
    },
    async ({ query, limit, cursor, type, category, tag }) => {
      const offset = decodeCursor(cursor);
      const where: Prisma.PromptWhereInput = {
        AND: [
          listingVisibility(ctx.user),
          promptTypeWhere(type),
          {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } },
            ],
          },
          ...(category ? [{ category: { slug: category } }] : []),
          ...(tag ? [{ tags: { some: { tag: { slug: tag } } } }] : []),
        ],
      };

      const prompts = await db.prompt.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          content: true,
          type: true,
          createdAt: true,
          author: { select: { username: true, name: true } },
          category: { select: { name: true, slug: true } },
          tags: { select: { tag: { select: { name: true, slug: true } } } },
          _count: { select: { votes: true } },
        },
      });

      const results = prompts.map((p) => ({
        id: p.id,
        slug: getPromptName(p),
        title: p.title,
        description: p.description,
        contentPreview: p.content.substring(0, 300) + (p.content.length > 300 ? "..." : ""),
        type: p.type,
        author: authorName(p.author),
        category: p.category?.name || null,
        tags: p.tags.map((t) => t.tag.name),
        votes: p._count.votes,
        createdAt: p.createdAt.toISOString(),
        link: promptWebUrl(ctx, p),
      }));

      return toolResult(
        { query, count: results.length, prompts: results, nextCursor: nextCursor(offset, results.length, limit) },
        prompts.map((p) => resourceLink("prompts", p))
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "get_prompt",
      title: "Get Prompt",
      description:
        "Get a prompt by ID, with its template variables (written as ${name} or ${name:default}). Pass `variables` to fill them in: `content` then holds the filled prompt and `originalContent` the template. When required variables are still missing, `missingVariables` lists them so you can ask the user and call again.",
      kind: "read",
      inputSchema: {
        id: z.string().describe("The ID of the prompt to retrieve"),
        variables: z.record(z.string(), z.string()).optional().describe("Values for the prompt's template variables, by name"),
        fill_variables: z
          .boolean()
          .default(false)
          .describe("Deprecated: this server cannot ask the user for values mid-call. Pass `variables` instead."),
      },
      outputSchema: {
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        content: z.string(),
        type: z.string(),
        author: z.string(),
        category: z.string().nullable(),
        tags: z.array(z.string()),
        link: z.string().nullable(),
        variables: z.array(z.looseObject({ name: z.string(), defaultValue: z.string().optional() })),
        originalContent: z.string().optional(),
        missingVariables: z.array(z.string()).optional(),
        hint: z.string().optional(),
      },
      failureMessage: "Failed to get prompt",
    },
    async ({ id, variables: values, fill_variables }) => {
      const prompt = await db.prompt.findFirst({
        where: { id, ...directVisibility(ctx.user) },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          content: true,
          type: true,
          structuredFormat: true,
          isPrivate: true,
          author: { select: { username: true, name: true } },
          category: { select: { name: true, slug: true } },
          tags: { select: { tag: { select: { name: true, slug: true } } } },
        },
      });
      if (!prompt) throw new ToolError("not_found", "Prompt not found");

      const variables = extractVariables(prompt.content);
      const missing = missingVariables(prompt.content, values ?? {});
      const filling = values !== undefined && variables.length > 0;

      return toolResult(
        {
          id: prompt.id,
          slug: getPromptName(prompt),
          title: prompt.title,
          description: prompt.description,
          content: filling ? fillVariables(prompt.content, values) : prompt.content,
          type: prompt.type,
          structuredFormat: prompt.structuredFormat,
          author: authorName(prompt.author),
          category: prompt.category?.name || null,
          tags: prompt.tags.map((t) => t.tag.name),
          link: prompt.isPrivate ? null : promptWebUrl(ctx, prompt),
          variables,
          ...(filling && { originalContent: prompt.content }),
          ...(missing.length > 0 && {
            missingVariables: missing,
            hint: `${fill_variables ? "Interactive filling is not supported. " : ""}Ask the user for ${missing.join(", ")} and call get_prompt again with them in \`variables\`.`,
          }),
        },
        [resourceLink("prompts", prompt)]
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "save_prompt",
      title: "Save Prompt",
      description:
        "Save a new prompt to your prompts.chat account. Requires API key authentication. Prompts are private by default unless configured otherwise in settings. Goes through the same validation, limits and duplicate checks as the website (e.g. one new prompt per 30 seconds; titles must be unique among your prompts).",
      kind: "write",
      requiresAuth: true,
      inputSchema: {
        title: z.string().min(1).max(200).describe("Title of the prompt"),
        content: z.string().min(1).describe("The prompt content. Can include variables like ${variable} or ${variable:default}"),
        description: z.string().max(500).optional().describe("Optional description of the prompt"),
        tags: tagNamesInput,
        category: categorySlugInput,
        isPrivate: isPrivateInput,
        type: z.enum(PROMPT_TYPES).optional().describe("Prompt type (default: TEXT)"),
        structuredFormat: z.enum(["JSON", "YAML"]).optional().describe("Format for structured prompts (default: JSON)"),
      },
      outputSchema: {
        success: z.literal(true),
        prompt: z.looseObject({
          id: z.string(),
          slug: z.string().nullable(),
          title: z.string(),
          isPrivate: z.boolean(),
          type: z.string(),
          tags: z.array(z.string()),
          category: z.string().nullable(),
          link: z.string().nullable(),
        }),
      },
      failureMessage: "Failed to save prompt",
    },
    async ({ title, content, description, tags, category, isPrivate, type, structuredFormat }, { user }) => {
      const isStructured = type === "STRUCTURED";
      const prompt = unwrapWriteResult(
        await createPrompt(user, {
          title,
          content,
          description,
          type: isStructured || !type ? "TEXT" : type,
          structuredFormat: isStructured ? structuredFormat || "JSON" : null,
          categoryId: (await resolveCategoryId(category)) ?? undefined,
          tagIds: await findOrCreateTagIds(tags ?? []),
          isPrivate: isPrivate ?? !user.mcpPromptsPublicByDefault,
        })
      );

      return toolResult(
        {
          success: true,
          prompt: {
            id: prompt.id,
            slug: prompt.slug,
            title: prompt.title,
            description: prompt.description,
            content: prompt.content,
            isPrivate: prompt.isPrivate,
            type: prompt.type,
            structuredFormat: prompt.structuredFormat,
            createdAt: prompt.createdAt.toISOString(),
            tags: prompt.tags.map((t) => t.tag.name),
            category: prompt.category?.name || null,
            link: prompt.isPrivate ? null : promptWebUrl(ctx, prompt),
          },
        },
        [resourceLink("prompts", prompt)]
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "improve_prompt",
      title: "Improve Prompt",
      description:
        "Transform a basic prompt into a well-structured, comprehensive prompt using AI. Optionally searches for similar prompts for inspiration. Supports different output types (text, image, video, sound) and formats (text, JSON, YAML). Requires API key authentication.",
      kind: "ai",
      requiresAuth: true,
      inputSchema: {
        prompt: z.string().min(1).max(10000).describe("The prompt to improve"),
        outputType: z.enum(["text", "image", "video", "sound"]).default("text").describe("Content type: text, image, video, or sound"),
        outputFormat: z
          .enum(["text", "structured_json", "structured_yaml"])
          .default("text")
          .describe("Response format: text, structured_json, or structured_yaml"),
      },
      failureMessage: "Failed to improve prompt",
    },
    async ({ prompt, outputType, outputFormat }) => {
      const { improvePrompt } = await import("@/lib/ai/improve-prompt");
      try {
        const result = await improvePrompt({ prompt, outputType, outputFormat });
        return toolResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        throw new ToolError("improve_failed", error instanceof Error ? error.message : "Failed to improve prompt");
      }
    }
  );
}
