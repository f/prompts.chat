import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  BOT_PLATFORM_INFO,
  botSelect,
  canonicalPair,
  getBotUrls,
  getHermesInstallCommand,
  getInstallPrompt,
  getInstallTarget,
  publicBotWhere,
  toBotView,
  type BotPairingInput,
  type BotPlatform,
  type BotView,
} from "@/lib/bots";

export { canonicalPair };

export interface BotPairingRow {
  fromId: string;
  toId: string;
  note: string | null;
}

export class BotPairingError extends Error {}

/** Turns a bot's pairing list into rows to store; throws BotPairingError on a self-link */
export function buildPairingRows(botId: string, pairings: BotPairingInput[]): BotPairingRow[] {
  const seen = new Set<string>();
  const rows: BotPairingRow[] = [];
  for (const { botId: otherId, note } of pairings) {
    if (otherId === botId) throw new BotPairingError("A bot cannot be paired with itself");
    if (seen.has(otherId)) continue;
    seen.add(otherId);
    rows.push({ ...canonicalPair(botId, otherId), note: note || null });
  }
  return rows;
}

/** The other side of each pairing that involves botId, in stored order */
export function pairedBotIds(rows: BotPairingRow[], botId: string): { botId: string; note: string | null }[] {
  return rows
    .filter((row) => row.fromId === botId || row.toId === botId)
    .map((row) => ({ botId: row.fromId === botId ? row.toId : row.fromId, note: row.note }));
}

/** Ids from the list that are not existing, non-deleted bots */
export async function findInvalidPairingTargets(botIds: string[]): Promise<string[]> {
  if (botIds.length === 0) return [];
  const found = await db.prompt.findMany({
    where: { id: { in: botIds }, type: "BOT", deletedAt: null },
    select: { id: true },
  });
  const valid = new Set(found.map((bot) => bot.id));
  return botIds.filter((id) => !valid.has(id));
}

/** Replaces every pairing that involves botId, in both directions */
export async function replaceBotPairings(botId: string, rows: BotPairingRow[]) {
  await db.$transaction([
    db.botPairing.deleteMany({ where: { OR: [{ fromId: botId }, { toId: botId }] } }),
    db.botPairing.createMany({ data: rows, skipDuplicates: true }),
  ]);
}

export interface BotPairingView {
  bot: BotView;
  note: string | null;
}

/**
 * Bots paired with botId, oldest link first. Only public, listed bots unless
 * includeHidden, which the edit form uses so saving never drops a hidden link.
 */
export async function getBotPairings(botId: string, { includeHidden = false } = {}): Promise<BotPairingView[]> {
  const rows = await db.botPairing.findMany({
    where: { OR: [{ fromId: botId }, { toId: botId }] },
    orderBy: { createdAt: "asc" },
    select: { fromId: true, toId: true, note: true },
  });
  const pairs = pairedBotIds(rows, botId);
  if (pairs.length === 0) return [];

  const where: Prisma.PromptWhereInput = includeHidden
    ? { type: "BOT", deletedAt: null }
    : publicBotWhere;
  const records = await db.prompt.findMany({
    where: { ...where, id: { in: pairs.map((pair) => pair.botId) } },
    select: botSelect,
  });
  const bots = new Map(records.map((record) => [record.id, toBotView(record)]));
  return pairs.flatMap(({ botId: id, note }) => {
    const bot = bots.get(id);
    return bot ? [{ bot, note }] : [];
  });
}

export function botPairingsJson(pairings: BotPairingView[], baseUrl: string) {
  return pairings.map(({ bot, note }) => ({
    id: bot.id,
    slug: bot.slug,
    name: bot.title,
    note,
    platforms: bot.platforms,
    urls: getBotUrls(bot, baseUrl),
  }));
}

/** One prompt that sets up every bot of a set on the same platform */
export function getBundleInstallPrompt(bots: BotView[], platform: BotPlatform, baseUrl: string): string {
  if (bots.length === 1) return getInstallPrompt(bots[0], platform, baseUrl);
  const list = bots.map((bot, index) => `${index + 1}. "${bot.title}": ${getBotUrls(bot, baseUrl).markdown}`).join("\n");
  return `Set up these ${bots.length} bots ${getInstallTarget(platform, bots.length)}. They are designed to work together, so install all of them:

${list}

For each bot, go to its URL and create it exactly as described there: adopt its instructions as the standing instructions for that bot, install its skills, and set up each routine with the given schedule or trigger. Ask me to connect each required connector once, even when several bots need it. Confirm each bot when done.`;
}

export interface BotBundleInstallOption {
  platform: BotPlatform;
  platformName: string;
  /** Bots of the set that support this platform, the current bot first */
  bots: { id: string; title: string; installUrl: string | null }[];
  /** Titles of bots in the set that do not support this platform */
  skipped: string[];
  installPrompt: string;
  /** Hermes installs each bot as a skill, one command per line */
  command: string | null;
}

/** Install options for a bot together with its paired bots, one per platform of the bot */
export function getBundleInstallOptions(bot: BotView, paired: BotView[], baseUrl: string): BotBundleInstallOption[] {
  const all = [bot, ...paired.filter((other) => other.id !== bot.id)];
  return bot.platforms.map((platform) => {
    const members = all.filter((member) => member.platforms.includes(platform));
    return {
      platform,
      platformName: BOT_PLATFORM_INFO[platform].name,
      bots: members.map((member) => ({
        id: member.id,
        title: member.title,
        installUrl: platform === "GROK_BOT" ? member.installUrl : null,
      })),
      skipped: all.filter((member) => !member.platforms.includes(platform)).map((member) => member.title),
      installPrompt: getBundleInstallPrompt(members, platform, baseUrl),
      command: platform === "HERMES" ? members.map((member) => getHermesInstallCommand(member, baseUrl)).join("\n") : null,
    };
  });
}
