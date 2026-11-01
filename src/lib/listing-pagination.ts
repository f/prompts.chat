import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";

export const TAG_PROMPTS_PER_PAGE = 24;
export const CATEGORY_PROMPTS_PER_PAGE = 30;
export const PROFILE_PROMPTS_PER_PAGE = 24;

/**
 * Parses a `?page=N` value. Missing, invalid and non-positive values mean the first page.
 */
export function parsePageParam(value?: string | null): number {
  return Math.max(1, Number.parseInt(value || "1", 10) || 1);
}

/**
 * Last page number of a listing. An empty listing still has its first page.
 */
export function lastPage(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

export function isPageOutOfRange(page: number, total: number, perPage: number): boolean {
  return page > lastPage(total, perPage);
}

/**
 * Query parameters of the current request, forwarded by the proxy. Layouts
 * don't receive searchParams, but they must reject out-of-range pages before
 * the loading.tsx boundary below them starts streaming with a 200 status.
 */
export async function getRequestSearchParams(): Promise<URLSearchParams> {
  const headersList = await headers();
  return new URLSearchParams(headersList.get("x-search") ?? "");
}

/**
 * Prompts listed on a tag page. Signed-in users also see their own private prompts.
 */
export function tagPromptsWhere(tagId: string, viewerId?: string | null): Prisma.PromptWhereInput {
  return {
    tags: { some: { tagId } },
    isUnlisted: false,
    deletedAt: null,
    ...NON_BOT_PROMPTS,
    OR: viewerId ? [{ isPrivate: false }, { authorId: viewerId }] : [{ isPrivate: false }],
  };
}

/**
 * Prompts listed on a category page, optionally narrowed by a search query
 */
export function categoryPromptsWhere(categoryId: string, q?: string | null): Prisma.PromptWhereInput {
  return {
    categoryId,
    isPrivate: false,
    isUnlisted: false,
    deletedAt: null,
    ...NON_BOT_PROMPTS,
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
}

/**
 * Parses a `YYYY-MM-DD` day filter into the start and end of that day, or
 * null when it is missing or not a real date
 */
export function parseDayFilter(date?: string | null): { start: Date; end: Date } | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

/**
 * Prompts listed on a profile. Unlisted prompts are visible there, private
 * ones only to their author. Intermediate flow steps are left out ("related"
 * connections are AI-suggested similar prompts, not flow connections).
 */
export function profilePromptsWhere(
  userId: string,
  { includePrivate, date }: { includePrivate: boolean; date?: string | null }
): Prisma.PromptWhereInput {
  const day = parseDayFilter(date);
  return {
    authorId: userId,
    deletedAt: null,
    ...NON_BOT_PROMPTS,
    incomingConnections: { none: { label: { not: "related" } } },
    ...(!includePrivate && { isPrivate: false }),
    ...(day && { createdAt: { gte: day.start, lte: day.end } }),
  };
}
