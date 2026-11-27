import { MAX_TEAM_LINKS, MAX_TEAM_MEMBERS, MIN_TEAM_MEMBERS, TEAM_LINK_LABEL_MAX_LENGTH, TEAM_TITLE_MAX_LENGTH, type BotTeamInput } from "./team-schema";

/**
 * Turns "better together" pairings into initial bot teams: every group of bots connected
 * through pairings becomes one team. Used by scripts/convert-pairings-to-teams.ts.
 */

export interface ConversionPairing {
  fromId: string;
  toId: string;
  note: string | null;
}

export interface ConversionBot {
  id: string;
  title: string;
  authorId: string;
  createdAt: Date;
  isPrivate?: boolean;
}

export interface ConvertedTeam extends BotTeamInput {
  authorId: string;
}

export interface SkippedGroup {
  botIds: string[];
  reason: "exists" | "too_large" | "too_many_links" | "private_bots";
}

function byAge(a: ConversionBot, b: ConversionBot): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Groups of bots connected through pairings, each ordered oldest bot first along the pairings */
export function pairingGroups(pairings: ConversionPairing[], bots: Map<string, ConversionBot>): ConversionBot[][] {
  const neighbors = new Map<string, Set<string>>();
  for (const { fromId, toId } of pairings) {
    if (fromId === toId || !bots.has(fromId) || !bots.has(toId)) continue;
    if (!neighbors.has(fromId)) neighbors.set(fromId, new Set());
    if (!neighbors.has(toId)) neighbors.set(toId, new Set());
    neighbors.get(fromId)!.add(toId);
    neighbors.get(toId)!.add(fromId);
  }

  const seen = new Set<string>();
  const groups: ConversionBot[][] = [];
  const starts = [...neighbors.keys()].map((id) => bots.get(id)!).sort(byAge);
  for (const start of starts) {
    if (seen.has(start.id)) continue;
    // Breadth-first from the oldest bot, visiting older neighbors first, so member order follows the pairings
    const group: ConversionBot[] = [];
    const queue = [start];
    seen.add(start.id);
    while (queue.length > 0) {
      const bot = queue.shift()!;
      group.push(bot);
      const next = [...neighbors.get(bot.id)!].map((id) => bots.get(id)!).filter((other) => !seen.has(other.id)).sort(byAge);
      for (const other of next) {
        seen.add(other.id);
        queue.push(other);
      }
    }
    groups.push(group);
  }
  return groups;
}

/** "A & B", "A, B & C", or "A, B, C & 2 more", cut to the title limit */
export function teamTitleFromBots(titles: string[]): string {
  const shown = titles.slice(0, 3);
  const rest = titles.length - shown.length;
  const title =
    rest > 0 ? `${shown.join(", ")} & ${rest} more` : shown.length > 1 ? `${shown.slice(0, -1).join(", ")} & ${shown.at(-1)}` : (shown[0] ?? "");
  return title.length > TEAM_TITLE_MAX_LENGTH ? `${title.slice(0, TEAM_TITLE_MAX_LENGTH - 1).trimEnd()}…` : title;
}

/**
 * The author who owns most of the group's bots; ties go to the author of the older bot. A team may
 * only include private bots of its own author, so private bots pin the author, and private bots of
 * more than one author leave the group without one (null).
 */
function groupAuthor(group: ConversionBot[]): string | null {
  const privateAuthors = new Set(group.filter((bot) => bot.isPrivate).map((bot) => bot.authorId));
  if (privateAuthors.size > 1) return null;
  if (privateAuthors.size === 1) return [...privateAuthors][0];
  const counts = new Map<string, number>();
  for (const bot of group) counts.set(bot.authorId, (counts.get(bot.authorId) ?? 0) + 1);
  let best = group[0].authorId;
  for (const bot of group) {
    if ((counts.get(bot.authorId) ?? 0) > (counts.get(best) ?? 0)) best = bot.authorId;
  }
  return best;
}

function setKey(ids: string[]): string {
  return [...ids].sort().join(",");
}

/** The --max-members operand: a whole number within the team size limits */
export function parseMaxMembers(value: string | undefined): number {
  const maxMembers = value !== undefined && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(maxMembers) || maxMembers < MIN_TEAM_MEMBERS || maxMembers > MAX_TEAM_MEMBERS) {
    throw new Error(`--max-members must be a whole number from ${MIN_TEAM_MEMBERS} to ${MAX_TEAM_MEMBERS}`);
  }
  return maxMembers;
}

/**
 * One team per group of paired bots. Pairings have no direction, so each becomes a handoff from
 * the older bot to the newer one, labelled with the pairing's note. Groups matching the members
 * of an existing team, larger than a team may be, with more handoffs than a team may have, or with
 * private bots of more than one author are skipped.
 */
export function teamsFromPairings(
  pairings: ConversionPairing[],
  bots: Map<string, ConversionBot>,
  { existingMemberSets = [], maxMembers = MAX_TEAM_MEMBERS }: { existingMemberSets?: string[][]; maxMembers?: number } = {}
): { teams: ConvertedTeam[]; skipped: SkippedGroup[] } {
  const existing = new Set(existingMemberSets.map(setKey));
  const teams: ConvertedTeam[] = [];
  const skipped: SkippedGroup[] = [];

  for (const group of pairingGroups(pairings, bots)) {
    const ids = group.map((bot) => bot.id);
    if (group.length < MIN_TEAM_MEMBERS) continue;
    if (existing.has(setKey(ids))) {
      skipped.push({ botIds: ids, reason: "exists" });
      continue;
    }
    if (group.length > maxMembers) {
      skipped.push({ botIds: ids, reason: "too_large" });
      continue;
    }

    const authorId = groupAuthor(group);
    if (authorId === null) {
      skipped.push({ botIds: ids, reason: "private_bots" });
      continue;
    }

    const members = new Set(ids);
    const order = new Map(ids.map((id, index) => [id, index]));
    const links = pairings
      .filter((pairing) => members.has(pairing.fromId) && members.has(pairing.toId) && pairing.fromId !== pairing.toId)
      .map((pairing) => {
        const [older, newer] = [bots.get(pairing.fromId)!, bots.get(pairing.toId)!].sort(byAge);
        return { fromBotId: older.id, toBotId: newer.id, label: (pairing.note ?? "").trim().slice(0, TEAM_LINK_LABEL_MAX_LENGTH) };
      })
      .sort((a, b) => order.get(a.fromBotId)! - order.get(b.fromBotId)! || order.get(a.toBotId)! - order.get(b.toBotId)!);
    if (links.length > MAX_TEAM_LINKS) {
      skipped.push({ botIds: ids, reason: "too_many_links" });
      continue;
    }

    teams.push({
      title: teamTitleFromBots(group.map((bot) => bot.title)),
      description: null,
      categoryId: null,
      tagIds: [],
      authorId,
      members: ids.map((botId) => ({ botId, role: null, description: null })),
      links,
    });
  }
  return { teams, skipped };
}
