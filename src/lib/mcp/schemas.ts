import { z } from "zod";
import { ToolError } from "./tool";
import { BOT_COMPUTER_REQUIREMENTS } from "@/lib/bots/schema";

/** Input fields shared by several tools */
export const limitInput = (defaultValue: number, max: number, noun: string) =>
  z.number().int().min(1).max(max).default(defaultValue).describe(`Maximum number of ${noun} to return (default ${defaultValue}, max ${max})`);

export const cursorInput = z.string().optional().describe("Pass the nextCursor of a previous result to get the next page");

export const TAG_NAMES_DESCRIPTION =
  "Names or slugs of existing tags (case-insensitive). Only existing tags are accepted; unknown ones are skipped and reported in unknownTags.";

export const tagNamesInput = z.array(z.string()).max(10).optional().describe(TAG_NAMES_DESCRIPTION);

/** Output fields of save tools, present when some requested tags do not exist */
export const unknownTagsOutput = {
  unknownTags: z.array(z.string()).optional().describe("Requested tags that do not exist and were not applied"),
  warning: z.string().optional(),
};

export const categorySlugInput = z.string().optional().describe("Category slug");

export const isPrivateInput = z.boolean().optional().describe("Whether it is private (default: your account setting)");

/** Cursors are opaque to clients; internally they hold the offset of the next page */
export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const offset = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!Number.isInteger(offset) || offset < 0 || encodeCursor(offset) !== cursor) {
    throw new ToolError("invalid_cursor", "Invalid cursor");
  }
  return offset;
}

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

/** The next cursor when a page came back full and more rows may follow */
export function nextCursor(offset: number, pageSize: number, limit: number, total?: number): string | undefined {
  const next = offset + pageSize;
  if (pageSize < limit || (total !== undefined && next >= total)) return undefined;
  return encodeCursor(next);
}

/**
 * Output schemas describe the documented fields; objects stay open so new fields can be added
 * without breaking clients that validate structuredContent.
 */
export const taxonomyOutput = z.looseObject({ name: z.string(), slug: z.string() });

export const promptSummaryOutput = z.looseObject({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  author: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  votes: z.number(),
  createdAt: z.string(),
});

export const skillSummaryOutput = z.looseObject({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  author: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  votes: z.number(),
  fileNames: z.array(z.string()),
  fileCount: z.number(),
  createdAt: z.string(),
  link: z.string(),
});

export const botSummaryOutput = z.looseObject({
  id: z.string(),
  slug: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  platforms: z.array(z.string()),
  platformNames: z.array(z.string()),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  computerRequirement: z.enum(BOT_COMPUTER_REQUIREMENTS),
  category: taxonomyOutput.nullable(),
  tags: z.array(taxonomyOutput),
  author: z.string(),
  votes: z.number(),
  isTrending: z.boolean(),
  link: z.string(),
});

/** botToJson plus, for the owner, visibility fields */
export const botDetailOutput = z.looseObject({
  id: z.string(),
  slug: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  platforms: z.array(z.string()),
  platformNames: z.array(z.string()),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  computerRequirement: z.enum(BOT_COMPUTER_REQUIREMENTS),
  instructions: z.string(),
  routines: z.array(z.looseObject({ name: z.string(), type: z.string(), trigger: z.string(), triggerLabel: z.string(), prompt: z.string() })),
  skills: z.array(z.looseObject({ name: z.string(), description: z.string(), source: z.string() })),
  connectors: z.array(z.string()),
  installUrl: z.string().nullable(),
  category: taxonomyOutput.nullable(),
  tags: z.array(taxonomyOutput),
  author: z.looseObject({ username: z.string(), name: z.string().nullable() }),
  urls: z.looseObject({ page: z.string(), markdown: z.string(), json: z.string(), skill: z.string() }),
  install: z.array(
    z.looseObject({
      platform: z.string(),
      installUrl: z.string().nullable(),
      installPrompt: z.string(),
      command: z.string().nullable(),
    })
  ),
  isPrivate: z.boolean().optional(),
  isUnlisted: z.boolean().optional(),
  delistReason: z.string().nullable().optional(),
});
