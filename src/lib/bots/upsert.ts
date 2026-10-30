import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createPrompt, updatePrompt, type PromptWriter, type PromptWriteResult } from "@/lib/prompt-write";
import { botSelect, toBotView, type BotView } from "./index";
import { botConfigSchema, normalizeBotPlatforms, type BotConfig, type BotPlatform } from "./schema";

/**
 * A bot as its owner describes it. Undefined optional fields keep their stored value on update;
 * null clears icon, color, install URL and category.
 */
export interface OwnBotInput {
  /** Update this bot; it must belong to the caller */
  id?: string;
  /** Match an existing bot of the caller by slug when no id is given */
  slug?: string;
  title: string;
  description?: string;
  /** The bot's standing instructions, stored as the prompt content */
  content: string;
  botPlatforms: BotPlatform[];
  botIcon?: string | null;
  botColor?: string | null;
  installUrl?: string | null;
  routines?: BotConfig["routines"];
  skills?: BotConfig["skills"];
  connectors?: BotConfig["connectors"];
  categoryId?: string | null;
  tagIds?: string[];
  isPrivate?: boolean;
}

export type OwnBotAction = "created" | "updated" | "unchanged";

export interface OwnBotUpsertResult {
  action: OwnBotAction;
  bot: BotView;
  /** Fields sent to the update; empty when created or unchanged */
  changedFields: string[];
}

const ownBotsWhere = (authorId: string) =>
  ({ authorId, type: "BOT", deletedAt: null }) satisfies Prisma.PromptWhereInput;

/** The caller's own bot by id, else by slug, else by case-insensitive title (titles are unique per author) */
export async function findOwnBot(
  authorId: string,
  { id, slug, title }: { id?: string; slug?: string; title?: string }
): Promise<BotView | null> {
  const where = ownBotsWhere(authorId);
  if (id) {
    const record = await db.prompt.findFirst({ where: { ...where, id }, select: botSelect });
    return record ? toBotView(record) : null;
  }
  if (slug) {
    const record = await db.prompt.findFirst({ where: { ...where, slug }, orderBy: { createdAt: "asc" }, select: botSelect });
    if (record) return toBotView(record);
  }
  if (title) {
    const record = await db.prompt.findFirst({
      where: { ...where, title: { equals: title.trim(), mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
      select: botSelect,
    });
    if (record) return toBotView(record);
  }
  return null;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  const key = (list: readonly string[]) => JSON.stringify([...new Set(list)].sort());
  return key(a) === key(b);
}

/** The PATCH /api/prompts/[id] body holding only the fields that differ from the stored bot */
export function diffOwnBot(existing: BotView, input: OwnBotInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.title !== existing.title) patch.title = input.title;
  if (input.content !== existing.instructions) patch.content = input.content;
  if (input.description !== undefined && input.description !== (existing.description ?? "")) {
    patch.description = input.description;
  }
  if (!sameList(normalizeBotPlatforms(input.botPlatforms), existing.platforms)) patch.botPlatforms = input.botPlatforms;
  if (input.botIcon !== undefined && (input.botIcon || null) !== existing.icon) patch.botIcon = input.botIcon;
  if (input.botColor !== undefined && (input.botColor || null) !== existing.color) patch.botColor = input.botColor;
  if (input.installUrl !== undefined && (input.installUrl || null) !== existing.installUrl) patch.installUrl = input.installUrl;
  if (input.categoryId !== undefined && (input.categoryId || null) !== (existing.category?.id ?? null)) {
    patch.categoryId = input.categoryId;
  }
  if (input.tagIds !== undefined && !sameList(input.tagIds, existing.tags.map((tag) => tag.id))) patch.tagIds = input.tagIds;
  if (input.isPrivate !== undefined && input.isPrivate !== existing.isPrivate) patch.isPrivate = input.isPrivate;

  if (input.routines !== undefined || input.skills !== undefined || input.connectors !== undefined) {
    const nextConfig = {
      routines: input.routines ?? existing.config.routines,
      skills: input.skills ?? existing.config.skills,
      connectors: input.connectors ?? existing.config.connectors,
    };
    const normalized = botConfigSchema.safeParse(nextConfig);
    // An invalid config is still sent so the update schema reports the validation error
    if (!normalized.success || JSON.stringify(normalized.data) !== JSON.stringify(existing.config)) {
      patch.botConfig = nextConfig;
    }
  }

  return patch;
}

async function loadBot(id: string): Promise<BotView> {
  const record = await db.prompt.findUniqueOrThrow({ where: { id }, select: botSelect });
  return toBotView(record);
}

/**
 * Creates the caller's bot, or updates it when one already matches by id, slug or title.
 * Writes go through createPrompt/updatePrompt, the same code behind the /bots web forms,
 * and an update that changes nothing writes nothing, so repeated backups are idempotent.
 */
export async function upsertOwnBot(
  user: PromptWriter,
  input: OwnBotInput,
  { defaultPrivate = false }: { defaultPrivate?: boolean } = {}
): Promise<PromptWriteResult<OwnBotUpsertResult>> {
  const existing = await findOwnBot(user.id, input);

  if (input.id && !existing) {
    return { ok: false, status: 404, body: { error: "not_found", message: "Bot not found or you don't own it" } };
  }

  if (existing) {
    const patch = diffOwnBot(existing, input);
    const changedFields = Object.keys(patch);
    if (changedFields.length === 0) {
      return { ok: true, data: { action: "unchanged", bot: existing, changedFields } };
    }
    const result = await updatePrompt(user, existing.id, patch);
    if (!result.ok) return result;
    return { ok: true, data: { action: "updated", bot: await loadBot(existing.id), changedFields } };
  }

  const result = await createPrompt(user, {
    type: "BOT",
    title: input.title,
    description: input.description,
    content: input.content,
    botPlatforms: input.botPlatforms,
    botIcon: input.botIcon,
    botColor: input.botColor,
    installUrl: input.installUrl ?? undefined,
    botConfig: {
      routines: input.routines ?? [],
      skills: input.skills ?? [],
      connectors: input.connectors ?? [],
    },
    categoryId: input.categoryId ?? undefined,
    tagIds: input.tagIds ?? [],
    isPrivate: input.isPrivate ?? defaultPrivate,
  });
  if (!result.ok) return result;
  return { ok: true, data: { action: "created", bot: await loadBot(result.data.id), changedFields: [] } };
}
