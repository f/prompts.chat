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

export interface ResolvedTags {
  ids: string[];
  unknownTags: string[];
}

/**
 * Matches each name to an existing tag by name or slug, ignoring case; never creates tags, since only
 * admins may. Returns matched ids in input order without duplicates, and the names that matched nothing.
 */
export async function resolveTagIds(tagNames: string[]): Promise<ResolvedTags> {
  const names = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return { ids: [], unknownTags: [] };

  const slugs = [...new Set([...names, ...names.map(slugify)].filter(Boolean))];
  const tags = await db.tag.findMany({
    where: { OR: [{ name: { in: names, mode: "insensitive" } }, { slug: { in: slugs, mode: "insensitive" } }] },
    select: { id: true, name: true, slug: true },
  });

  const ids: string[] = [];
  const unknownTags: string[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    const tagSlug = slugify(name);
    const tag =
      tags.find((t) => t.name.toLowerCase() === lower) ??
      tags.find((t) => t.slug.toLowerCase() === lower || (tagSlug && t.slug.toLowerCase() === tagSlug));
    if (!tag) unknownTags.push(name);
    else if (!ids.includes(tag.id)) ids.push(tag.id);
  }
  return { ids, unknownTags };
}

/** Fields added to a save result when some requested tags do not exist */
export function unknownTagsWarning(unknownTags: string[]): { unknownTags?: string[]; warning?: string } {
  if (unknownTags.length === 0) return {};
  return {
    unknownTags,
    warning: `Ignored tags that do not exist: ${unknownTags.join(", ")}. Only existing tags can be used; new tags are created by admins.`,
  };
}

/** The id of the category with this slug; undefined when no slug is given, null to clear */
export async function resolveCategoryId(slug: string | null | undefined): Promise<string | null | undefined> {
  if (slug === undefined || slug === null) return slug;
  const category = await db.category.findUnique({ where: { slug }, select: { id: true } });
  if (!category) throw new ToolError("invalid_category", `Category not found: ${slug}`);
  return category.id;
}
