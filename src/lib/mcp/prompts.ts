import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  McpError,
  type Prompt as McpPrompt,
} from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";
import type { McpContext } from "./context";
import { getPromptName } from "./shared";
import { extractVariables, fillVariables } from "./variables";

const PAGE_SIZE = 20;

/**
 * Prompts offered through the MCP prompts capability: listed public prompts, plus the caller's
 * private ones unless a ?users= filter leaves them out, narrowed by the URL filters
 */
export function mcpPromptsWhere({ user, filters }: McpContext): Prisma.PromptWhereInput {
  const { categories = [], tags = [], users = [] } = filters;
  const includeOwnPrivate = !!user && (users.length === 0 || users.includes(user.username));
  return {
    isUnlisted: false,
    deletedAt: null,
    ...NON_BOT_PROMPTS,
    ...(includeOwnPrivate ? { OR: [{ isPrivate: false }, { isPrivate: true, authorId: user.id }] } : { isPrivate: false }),
    ...(categories.length > 0 && { category: { slug: { in: categories } } }),
    ...(tags.length > 0 && { tags: { some: { tag: { slug: { in: tags } } } } }),
    ...(users.length > 0 && { author: { username: { in: users } } }),
  };
}

/** Placeholders read per prompt, and characters kept of each, so a list page stays small */
const MAX_PLACEHOLDERS = 50;
const MAX_PLACEHOLDER_LENGTH = 200;

/**
 * The ${...} placeholders of each prompt, in order of use. Postgres extracts them so list pages
 * never load full prompt content (see #1118); extractVariables then parses them as usual.
 */
async function findPlaceholders(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.$queryRaw<{ id: string; placeholder: string }[]>`
    SELECT p.id, left(m.match[1], ${MAX_PLACEHOLDER_LENGTH}::int) AS placeholder
    FROM prompts p, regexp_matches(p.content, '\\$\\{([^}]*)\\}', 'g') WITH ORDINALITY AS m(match, ord)
    WHERE p.id = ANY(${ids}) AND m.ord <= ${MAX_PLACEHOLDERS}::int
    ORDER BY p.id, m.ord`;
  const placeholders = new Map<string, string>();
  for (const { id, placeholder } of rows) {
    placeholders.set(id, `${placeholders.get(id) ?? ""}\${${placeholder}}`);
  }
  return placeholders;
}

function promptArguments(placeholders: string | undefined): McpPrompt["arguments"] {
  const variables = placeholders ? extractVariables(placeholders) : [];
  if (variables.length === 0) return undefined;
  return variables.map((variable) => ({
    name: variable.name,
    ...(variable.defaultValue !== undefined && { description: `Default: ${variable.defaultValue}` }),
    required: variable.defaultValue === undefined,
  }));
}

/** Cursors are page numbers, as before the server was restructured, so saved cursors keep working */
function parsePage(cursor: string | undefined): number {
  if (!cursor) return 1;
  const page = Number(cursor);
  if (!Number.isInteger(page) || page < 1) throw new McpError(ErrorCode.InvalidParams, "Invalid cursor");
  return page;
}

export function registerPrompts(server: McpServer, ctx: McpContext) {
  const where = mcpPromptsWhere(ctx);

  server.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    const page = parsePage(request.params?.cursor);
    const prompts = await db.prompt.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, slug: true, title: true, description: true },
    });

    const hasMore = prompts.length > PAGE_SIZE;
    const results = prompts.slice(0, PAGE_SIZE);
    const placeholders = await findPlaceholders(results.map((p) => p.id));
    return {
      prompts: results.map((p) => ({
        name: getPromptName(p),
        title: p.title,
        description: p.description || undefined,
        arguments: promptArguments(placeholders.get(p.id)),
      })),
      nextCursor: hasMore ? String(page + 1) : undefined,
    };
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const name = request.params.name;
    const select = { id: true, slug: true, title: true, description: true, content: true } as const;

    const prompt =
      (await db.prompt.findFirst({ where: { ...where, slug: name }, select })) ??
      (await db.prompt.findFirst({ where: { ...where, id: name }, select })) ??
      // Prompts created before slugs were stored are named after their slugified title
      (await db.prompt.findFirst({
        where: { ...where, slug: null, title: { contains: name.replace(/-/g, " "), mode: "insensitive" } },
        select,
      }));

    if (!prompt) throw new McpError(ErrorCode.InvalidParams, `Prompt not found: ${name}`);

    return {
      description: prompt.description || prompt.title,
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: fillVariables(prompt.content, request.params.arguments ?? {}) },
        },
      ],
    };
  });
}
