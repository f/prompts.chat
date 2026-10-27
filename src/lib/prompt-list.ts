import type { Prisma, PromptType } from "@prisma/client";
import { trendingWhere } from "@/lib/trending";

/**
 * Bots have their own listing at /bots, so general prompt listings leave them
 * out. Spread into a where clause.
 */
export const NON_BOT_PROMPTS = { type: { not: "BOT" } } satisfies Prisma.PromptWhereInput;

/**
 * The type condition for a general prompt listing: the requested type when one
 * is given (including BOT), otherwise every type except BOT
 */
export function promptListTypeWhere(type?: string | null): Pick<Prisma.PromptWhereInput, "type"> {
  return type ? { type: type as PromptType } : NON_BOT_PROMPTS;
}

/**
 * Public, non-bot prompts that are currently trending, matching what
 * /prompts?trending=1 lists without a type filter
 */
export function trendingPromptListWhere(now?: number) {
  return {
    isPrivate: false,
    isUnlisted: false,
    deletedAt: null,
    ...NON_BOT_PROMPTS,
    ...trendingWhere(now),
  } satisfies Prisma.PromptWhereInput;
}
