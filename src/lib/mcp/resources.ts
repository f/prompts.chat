import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError, type ListResourcesResult } from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { botToMarkdown, findVisibleBot, listBotsByAuthor } from "@/lib/bots";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";
import { parseSkillFiles } from "@/lib/skill-files";
import type { McpContext } from "./context";
import { directVisibility, resourceUri, skillFileUri, type ResourceKind } from "./shared";

/** Resource lists hold only the caller's own items, newest first, so they stay short */
const OWN_LIST_LIMIT = 50;

function mimeTypeFor(filename: string): string {
  if (/\.mdx?$/i.test(filename)) return "text/markdown";
  if (/\.json$/i.test(filename)) return "application/json";
  if (/\.ya?ml$/i.test(filename)) return "application/yaml";
  return "text/plain";
}

function notFound(uri: URL): never {
  throw new McpError(ErrorCode.InvalidParams, `Resource not found: ${uri}`);
}

function single(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function promptMarkdown(prompt: { title: string; description: string | null; content: string }): string {
  return [`# ${prompt.title}`, ...(prompt.description ? [prompt.description] : []), prompt.content].join("\n\n") + "\n";
}

async function listOwn(ctx: McpContext, kind: ResourceKind, where: Prisma.PromptWhereInput): Promise<ListResourcesResult> {
  if (!ctx.user) return { resources: [] };
  const items = await db.prompt.findMany({
    where: { authorId: ctx.user.id, deletedAt: null, ...where },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: OWN_LIST_LIMIT,
    select: { id: true, title: true, description: true },
  });
  return {
    resources: items.map((item) => ({
      uri: resourceUri(kind, item.id),
      name: item.title,
      title: item.title,
      ...(item.description && { description: item.description }),
      mimeType: "text/markdown",
    })),
  };
}

async function findSkill(ctx: McpContext, id: string) {
  return db.prompt.findFirst({
    where: { id, type: "SKILL", ...directVisibility(ctx.user) },
    select: { id: true, content: true },
  });
}

export function registerResources(server: McpServer, ctx: McpContext) {
  const icons = [{ src: `${ctx.baseUrl}/logo.svg`, mimeType: "image/svg+xml" }];

  server.registerResource(
    "prompt",
    new ResourceTemplate("prompts-chat://prompts/{id}", { list: () => listOwn(ctx, "prompts", { type: { notIn: ["BOT", "SKILL"] } }) }),
    {
      title: "Prompt",
      description: "A prompt as Markdown: its title, description and content with ${variable} placeholders",
      mimeType: "text/markdown",
      icons,
    },
    async (uri, { id }) => {
      const prompt = await db.prompt.findFirst({
        where: { id: single(id), ...NON_BOT_PROMPTS, ...directVisibility(ctx.user) },
        select: { title: true, description: true, content: true },
      });
      if (!prompt) notFound(uri);
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: promptMarkdown(prompt) }] };
    }
  );

  // Registered before the skill template so a file URI is never read as a skill id
  server.registerResource(
    "skill-file",
    new ResourceTemplate("prompts-chat://skills/{id}/files/{+path}", { list: undefined }),
    {
      title: "Skill file",
      description: "One file of an Agent Skill, e.g. SKILL.md or scripts/helper.py",
      icons,
    },
    async (uri, { id, path }) => {
      const skill = await findSkill(ctx, single(id));
      const filename = single(path);
      const file = skill && parseSkillFiles(skill.content).find((f) => f.filename === filename);
      if (!file) notFound(uri);
      return { contents: [{ uri: uri.href, mimeType: mimeTypeFor(filename), text: file.content }] };
    }
  );

  server.registerResource(
    "skill",
    new ResourceTemplate("prompts-chat://skills/{id}", { list: () => listOwn(ctx, "skills", { type: "SKILL" }) }),
    {
      title: "Agent Skill",
      description: "Every file of an Agent Skill, each with its own prompts-chat://skills/{id}/files/{path} URI",
      icons,
    },
    async (uri, { id }) => {
      const skill = await findSkill(ctx, single(id));
      if (!skill) notFound(uri);
      return {
        contents: parseSkillFiles(skill.content).map((file) => ({
          uri: skillFileUri(skill.id, file.filename),
          mimeType: mimeTypeFor(file.filename),
          text: file.content,
        })),
      };
    }
  );

  server.registerResource(
    "bot",
    new ResourceTemplate("prompts-chat://bots/{id}", {
      list: async () => {
        if (!ctx.user) return { resources: [] };
        const { bots } = await listBotsByAuthor(ctx.user.id, { includePrivate: true, take: OWN_LIST_LIMIT });
        return {
          resources: bots.map((bot) => ({
            uri: resourceUri("bots", bot.id),
            name: bot.title,
            title: bot.title,
            ...(bot.description && { description: bot.description }),
            mimeType: "text/markdown",
          })),
        };
      },
    }),
    {
      title: "Bot",
      description: "A bot's full definition as Markdown: instructions, routines, skills, connectors and setup steps",
      mimeType: "text/markdown",
      icons,
    },
    async (uri, { id }) => {
      const bot = await findVisibleBot({ id: single(id) }, ctx.user);
      if (!bot) notFound(uri);
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: botToMarkdown(bot, ctx.baseUrl) }] };
    }
  );
}
