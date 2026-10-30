import type { Prisma } from "@prisma/client";
import type { ResourceLink } from "@modelcontextprotocol/sdk/types.js";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getPromptUrl } from "@/lib/urls";
import type { McpContext, McpUser } from "./context";
import { ToolError } from "./tool";

export type ResourceKind = "prompts" | "skills" | "bots";

/** URIs of the resources served by src/lib/mcp/resources.ts */
export function resourceUri(kind: ResourceKind, id: string): string {
  return `prompts-chat://${kind}/${id}`;
}

export function skillFileUri(id: string, filename: string): string {
  return `${resourceUri("skills", id)}/files/${filename}`;
}

export function resourceLink(kind: ResourceKind, item: { id: string; title: string; description?: string | null }): ResourceLink {
  return {
    type: "resource_link",
    uri: resourceUri(kind, item.id),
    name: item.title,
    ...(item.description && { description: item.description }),
    mimeType: "text/markdown",
  };
}

/**
 * MCP name for a prompt: its slug, else the slugified title, else its id
 */
export function getPromptName(prompt: { id: string; slug?: string | null; title: string }): string {
  if (prompt.slug) return prompt.slug;
  return slugify(prompt.title) || prompt.id;
}

export function promptWebUrl(ctx: McpContext, prompt: { id: string; slug?: string | null; title: string }): string {
  return `${ctx.baseUrl}${getPromptUrl(prompt.id, getPromptName(prompt))}`;
}

export function authorName(author: { name: string | null; username: string }): string {
  return author.name || author.username;
}

/** Listed public items, plus the caller's own private ones */
export function listingVisibility(user: McpUser | null): Prisma.PromptWhereInput {
  return {
    isUnlisted: false,
    deletedAt: null,
    OR: user ? [{ isPrivate: false }, { isPrivate: true, authorId: user.id }] : [{ isPrivate: false }],
  };
}

/** What one item fetched by id may be: listed and public, or the caller's own in any state */
export function directVisibility(user: McpUser | null): Prisma.PromptWhereInput {
  return {
    deletedAt: null,
    OR: [{ isPrivate: false, isUnlisted: false }, ...(user ? [{ authorId: user.id }] : [])],
  };
}

/** Finds tags by the slug of each name, creating missing ones; returns ids in input order without duplicates */
export async function findOrCreateTagIds(tagNames: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const tagName of tagNames) {
    const tagSlug = slugify(tagName);
    if (!tagSlug) continue;

    let tag = await db.tag.findUnique({ where: { slug: tagSlug } });
    if (!tag) {
      tag = await db.tag.create({ data: { name: tagName, slug: tagSlug } });
    }
    if (!ids.includes(tag.id)) ids.push(tag.id);
  }
  return ids;
}

/** The id of the category with this slug; undefined when no slug is given, null to clear */
export async function resolveCategoryId(slug: string | null | undefined): Promise<string | null | undefined> {
  if (slug === undefined || slug === null) return slug;
  const category = await db.category.findUnique({ where: { slug }, select: { id: true } });
  if (!category) throw new ToolError("invalid_category", `Category not found: ${slug}`);
  return category.id;
}
