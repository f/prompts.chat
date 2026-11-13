import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import type { McpContext } from "../context";
import { limitInput } from "../schemas";
import { defineTool, toolResult } from "../tool";

const categoryOutput = z.looseObject({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  link: z.string(),
});

export function registerTaxonomyTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: "list_categories",
      title: "List Categories",
      description:
        "List the categories of prompts.chat as a tree: top-level categories in display order, each with its subcategories. " +
        "Use a category slug to filter search_prompts, search_skills, search_bots or list_teams.",
      kind: "read",
      inputSchema: {},
      outputSchema: {
        count: z.number(),
        categories: z.array(categoryOutput.extend({ children: z.array(categoryOutput) })),
      },
      failureMessage: "Failed to list categories",
    },
    async () => {
      const roots = await db.category.findMany({
        where: { parentId: null },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: {
          name: true,
          slug: true,
          description: true,
          children: { orderBy: [{ order: "asc" }, { name: "asc" }], select: { name: true, slug: true, description: true } },
        },
      });
      const link = (slug: string) => `${ctx.baseUrl}/categories/${slug}`;
      const categories = roots.map((category) => ({
        name: category.name,
        slug: category.slug,
        description: category.description,
        link: link(category.slug),
        children: category.children.map((child) => ({ ...child, link: link(child.slug) })),
      }));
      return toolResult({ count: categories.length, categories });
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "list_tags",
      title: "List Tags",
      description:
        "List tags on prompts.chat, most used first. Optionally filter by a keyword matched against the tag name or slug. " +
        "Use a tag slug to filter search_prompts.",
      kind: "read",
      inputSchema: {
        query: z.string().optional().describe("Keyword matched against tag names and slugs"),
        limit: limitInput(50, 200, "tags"),
      },
      outputSchema: {
        count: z.number(),
        tags: z.array(z.looseObject({ name: z.string(), slug: z.string(), link: z.string() })),
      },
      failureMessage: "Failed to list tags",
    },
    async ({ query, limit }) => {
      const q = query?.trim();
      const tags = await db.tag.findMany({
        where: q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }
          : undefined,
        orderBy: [{ prompts: { _count: "desc" } }, { name: "asc" }],
        take: limit,
        select: { name: true, slug: true, color: true },
      });
      return toolResult({
        count: tags.length,
        tags: tags.map((tag) => ({ ...tag, link: `${ctx.baseUrl}/tags/${tag.slug}` })),
      });
    }
  );
}
