import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PromptWriter, PromptWriteResult } from "@/lib/prompt-write";
import { slugify } from "@/lib/slug";
import { getBotTeamUrl } from "@/lib/urls";
import {
  BOT_PLATFORM_INFO,
  BOT_PLATFORMS,
  botSelect,
  getBotUrls,
  getInstallTarget,
  isBotColor,
  isBotIconName,
  resolveBotPlatforms,
  toBotView,
  type BotColor,
  type BotIconName,
  type BotPlatform,
  type BotView,
} from "./index";
import { buildBundleInstallOptions, type BotBundleInstallOption } from "./pairings";
import type { TeamGraphTeam } from "./team-graph";
import { teamLinkIssues, type BotTeamInput, type BotTeamLinkInput, type BotTeamMemberInput } from "./team-schema";

export * from "./team-schema";

/** Who is looking at a team; private member bots are shown only to their author and admins */
export interface TeamViewer {
  id: string;
  role?: string | null;
}

/** Enough of a bot to draw it in the teams graph */
export interface BotTeamBot {
  id: string;
  slug: string | null;
  title: string;
  icon: BotIconName | null;
  color: BotColor | null;
  platforms: BotPlatform[];
}

export interface BotTeamLinkView {
  fromBotId: string;
  toBotId: string;
  label: string;
}

export interface BotTeamView<B extends { id: string } = BotTeamBot> {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isFeatured: boolean;
  authorId: string;
  author: { username: string; name: string | null; avatar: string | null; verified: boolean };
  createdAt: Date;
  updatedAt: Date;
  /** Members the viewer may see, in team order */
  members: { bot: B; role: string | null }[];
  /** Handoffs between visible members, in team order */
  links: BotTeamLinkView[];
}

const visibilityFields = { type: true, isPrivate: true, deletedAt: true, authorId: true } satisfies Prisma.PromptSelect;

const teamBotSummarySelect = {
  ...visibilityFields,
  id: true,
  slug: true,
  title: true,
  botIcon: true,
  botColor: true,
  botPlatform: true,
  botPlatforms: true,
} satisfies Prisma.PromptSelect;

const teamBaseSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  isFeatured: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { username: true, name: true, avatar: true, verified: true } },
  links: {
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { fromBotId: true, toBotId: true, label: true },
  },
} satisfies Prisma.BotTeamSelect;

const memberOrder = [{ order: "asc" }, { id: "asc" }] satisfies Prisma.BotTeamMemberOrderByWithRelationInput[];

const teamSummarySelect = {
  ...teamBaseSelect,
  members: { orderBy: memberOrder, select: { role: true, bot: { select: teamBotSummarySelect } } },
} satisfies Prisma.BotTeamSelect;

const teamDetailSelect = {
  ...teamBaseSelect,
  members: { orderBy: memberOrder, select: { role: true, bot: { select: { ...botSelect, ...visibilityFields } } } },
} satisfies Prisma.BotTeamSelect;

type TeamSummaryRecord = Prisma.BotTeamGetPayload<{ select: typeof teamSummarySelect }>;
type TeamDetailRecord = Prisma.BotTeamGetPayload<{ select: typeof teamDetailSelect }>;
type VisibilityRecord = Prisma.PromptGetPayload<{ select: typeof visibilityFields }>;

export function canViewTeamBot(bot: VisibilityRecord, viewer: TeamViewer | null): boolean {
  if (bot.type !== "BOT" || bot.deletedAt) return false;
  return !bot.isPrivate || viewer?.role === "ADMIN" || viewer?.id === bot.authorId;
}

function toTeamBot(record: TeamSummaryRecord["members"][number]["bot"]): BotTeamBot {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    icon: record.botIcon && isBotIconName(record.botIcon) ? record.botIcon : null,
    color: record.botColor && isBotColor(record.botColor) ? record.botColor : null,
    platforms: resolveBotPlatforms(record),
  };
}

/** Keeps the members the viewer may see and the handoffs between them */
export function toTeamView<R extends VisibilityRecord & { id: string }, B extends { id: string }>(
  record: Omit<TeamSummaryRecord, "members"> & { members: { role: string | null; bot: R }[] },
  mapBot: (bot: R) => B,
  viewer: TeamViewer | null
): BotTeamView<B> {
  const members = record.members
    .filter((member) => canViewTeamBot(member.bot, viewer))
    .map((member) => ({ bot: mapBot(member.bot), role: member.role || null }));
  const visible = new Set(members.map((member) => member.bot.id));
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    isFeatured: record.isFeatured,
    authorId: record.authorId,
    author: record.author,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    members,
    links: record.links.filter((link) => visible.has(link.fromBotId) && visible.has(link.toBotId)),
  };
}

function summaryView(record: TeamSummaryRecord, viewer: TeamViewer | null) {
  return toTeamView(record, toTeamBot, viewer);
}

function detailView(record: TeamDetailRecord, viewer: TeamViewer | null) {
  return toTeamView(record, toBotView, viewer);
}

/** Teams are listed when at least one member is a public bot */
const listedTeamWhere = {
  members: { some: { bot: { type: "BOT", deletedAt: null, isPrivate: false } } },
} satisfies Prisma.BotTeamWhereInput;

function teamListWhere({ q, authorId }: { q?: string; authorId?: string }): Prisma.BotTeamWhereInput {
  const keywords = (q ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return {
    ...listedTeamWhere,
    ...(authorId && { authorId }),
    ...(keywords.length > 0 && {
      OR: keywords.flatMap((keyword) => [
        { title: { contains: keyword, mode: "insensitive" as const } },
        { description: { contains: keyword, mode: "insensitive" as const } },
        { members: { some: { bot: { title: { contains: keyword, mode: "insensitive" as const }, isPrivate: false } } } },
      ]),
    }),
  };
}

/** Featured teams first, then newest */
export async function listTeams({
  q,
  authorId,
  skip = 0,
  take = 24,
  viewer = null,
}: { q?: string; authorId?: string; skip?: number; take?: number; viewer?: TeamViewer | null } = {}) {
  const where = teamListWhere({ q, authorId });
  const [records, total] = await Promise.all([
    db.botTeam.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: teamSummarySelect,
    }),
    db.botTeam.count({ where }),
  ]);
  return { teams: records.map((record) => summaryView(record, viewer)), total };
}

/** A team by id, else by slug, with full member bots */
export async function getTeam(
  { id, slug }: { id?: string; slug?: string },
  viewer: TeamViewer | null = null
): Promise<BotTeamView<BotView> | null> {
  if (!id && !slug) return null;
  const record = await db.botTeam.findUnique({ where: id ? { id } : { slug }, select: teamDetailSelect });
  return record ? detailView(record, viewer) : null;
}

export function canEditTeam(team: Pick<BotTeamView<{ id: string }>, "authorId">, user: TeamViewer | null): boolean {
  return !!user && (user.id === team.authorId || user.role === "ADMIN");
}

/** Platforms any member runs on, the ones most members support first */
export function getTeamPlatforms(bots: Pick<BotView, "platforms">[]): BotPlatform[] {
  const coverage = (platform: BotPlatform) => bots.filter((bot) => bot.platforms.includes(platform)).length;
  return BOT_PLATFORMS.filter((platform) => coverage(platform) > 0).sort((a, b) => coverage(b) - coverage(a));
}

/** One prompt that sets up the team's bots on a platform, with their roles and handoffs */
export function getTeamInstallPrompt(
  team: Pick<BotTeamView<BotView>, "title" | "members" | "links">,
  members: BotView[],
  platform: BotPlatform,
  baseUrl: string
): string {
  const ids = new Set(members.map((bot) => bot.id));
  const roles = new Map(team.members.map((member) => [member.bot.id, member.role]));
  const titles = new Map(members.map((bot) => [bot.id, bot.title]));
  const list = members
    .map((bot, index) => {
      const role = roles.get(bot.id);
      return `${index + 1}. "${bot.title}"${role ? ` (${role})` : ""}: ${getBotUrls(bot, baseUrl).markdown}`;
    })
    .join("\n");
  const handoffs = team.links
    .filter((link) => ids.has(link.fromBotId) && ids.has(link.toBotId))
    .map((link) => `- "${titles.get(link.fromBotId)}" hands off to "${titles.get(link.toBotId)}"${link.label ? `: ${link.label}` : ""}`);

  return [
    `Set up the "${team.title}" team: ${members.length === 1 ? "1 bot" : `${members.length} bots`} ${getInstallTarget(platform, members.length)} that hand work off to each other. Install all of them:`,
    list,
    ...(handoffs.length > 0 ? [`Handoffs:\n${handoffs.join("\n")}`] : []),
    "For each bot, go to its URL and create it exactly as described there: adopt its instructions as the standing instructions for that bot, install its skills, and set up each routine with the given schedule or trigger." +
      (handoffs.length > 0 ? " Then wire up the handoffs: when a bot finishes its part, it passes what is listed to the next bot." : "") +
      " Ask me to connect each required connector once, even when several bots need it. Confirm each bot when done.",
  ].join("\n\n");
}

/** "Install team" options, one per platform any member supports */
export function getTeamInstallOptions(team: BotTeamView<BotView>, baseUrl: string): BotBundleInstallOption[] {
  const bots = team.members.map((member) => member.bot);
  return buildBundleInstallOptions(bots, getTeamPlatforms(bots), baseUrl, (members, platform) =>
    getTeamInstallPrompt(team, members, platform, baseUrl)
  );
}

export function toTeamGraphTeam(team: BotTeamView<BotTeamBot | BotView>): TeamGraphTeam {
  return {
    slug: team.slug,
    title: team.title,
    description: team.description,
    author: team.author.name || team.author.username,
    isFeatured: team.isFeatured,
    members: team.members.map(({ bot, role }) => ({ id: bot.id, slug: bot.slug, title: bot.title, icon: bot.icon, color: bot.color, role })),
    links: team.links,
  };
}

function teamUrl(team: { slug: string }, baseUrl: string) {
  return `${baseUrl}${getBotTeamUrl(team.slug)}`;
}

/** A small team summary for listings and MCP */
export function teamSummaryJson(team: BotTeamView<BotTeamBot | BotView>, baseUrl: string) {
  return {
    id: team.id,
    slug: team.slug,
    title: team.title,
    description: team.description,
    author: team.author.name || team.author.username,
    isFeatured: team.isFeatured,
    members: team.members.map(({ bot, role }) => ({ id: bot.id, name: bot.title, role })),
    handoffCount: team.links.length,
    link: teamUrl(team, baseUrl),
  };
}

/** A team with its members' links and handoffs, without bot instructions */
export function teamToJson(team: BotTeamView<BotView>, baseUrl: string) {
  const titles = new Map(team.members.map(({ bot }) => [bot.id, bot.title]));
  const bots = team.members.map((member) => member.bot);
  return {
    id: team.id,
    slug: team.slug,
    title: team.title,
    description: team.description,
    isFeatured: team.isFeatured,
    author: { username: team.author.username, name: team.author.name },
    members: team.members.map(({ bot, role }) => ({
      id: bot.id,
      slug: bot.slug,
      name: bot.title,
      role,
      platforms: bot.platforms,
      link: getBotUrls(bot, baseUrl).page,
    })),
    handoffs: team.links.map((link) => ({
      from: link.fromBotId,
      to: link.toBotId,
      fromName: titles.get(link.fromBotId) ?? "",
      toName: titles.get(link.toBotId) ?? "",
      label: link.label,
    })),
    platforms: getTeamPlatforms(bots).map((platform) => ({
      platform,
      name: BOT_PLATFORM_INFO[platform].name,
      botCount: bots.filter((bot) => bot.platforms.includes(platform)).length,
    })),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    link: teamUrl(team, baseUrl),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}): PromptWriteResult<never> {
  return { ok: false, status, body: { error, message, ...extra } };
}

/** Member ids that are not live bots the writer may add: public ones, their own, or any for admins */
export async function findInvalidTeamBots(botIds: string[], user: PromptWriter): Promise<string[]> {
  if (botIds.length === 0) return [];
  const found = await db.prompt.findMany({
    where: {
      id: { in: botIds },
      type: "BOT",
      deletedAt: null,
      ...(user.role === "ADMIN" ? {} : { OR: [{ isPrivate: false }, { authorId: user.id }] }),
    },
    select: { id: true },
  });
  const valid = new Set(found.map((bot) => bot.id));
  return botIds.filter((id) => !valid.has(id));
}

/** The title's slug, numbered when another team already uses it */
export async function uniqueTeamSlug(title: string, excludeTeamId?: string): Promise<string> {
  const base = slugify(title) || "team";
  const taken = await db.botTeam.findMany({
    where: { slug: { startsWith: base }, ...(excludeTeamId && { id: { not: excludeTeamId } }) },
    select: { slug: true },
  });
  const slugs = new Set(taken.map((team) => team.slug));
  if (!slugs.has(base)) return base;
  let n = 2;
  while (slugs.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function memberRows(members: BotTeamMemberInput[]) {
  return members.map((member, order) => ({ botId: member.botId, role: member.role || null, order }));
}

function linkRows(teamId: string, links: BotTeamLinkInput[]) {
  return links.map((link, order) => ({ teamId, fromBotId: link.fromBotId, toBotId: link.toBotId, label: link.label, order }));
}

async function checkTeamInput(user: PromptWriter, input: BotTeamInput): Promise<PromptWriteResult<never> | null> {
  const issues = teamLinkIssues(input.members.map((m) => m.botId), input.links);
  if (issues.length > 0) return fail(400, "validation_error", issues[0]);
  const invalid = await findInvalidTeamBots(input.members.map((m) => m.botId), user);
  if (invalid.length > 0) {
    return fail(400, "invalid_bots", "Some bots do not exist or cannot be added to a team", { botIds: invalid });
  }
  return null;
}

function isSlugConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && JSON.stringify(error.meta ?? {}).includes("slug");
}

export async function createTeam(user: PromptWriter, input: BotTeamInput): Promise<PromptWriteResult<BotTeamView<BotView>>> {
  const invalid = await checkTeamInput(user, input);
  if (invalid) return invalid;

  // Two teams with the same title can race for a slug; the unique index decides and the loser retries
  for (let attempt = 0; ; attempt++) {
    const slug = await uniqueTeamSlug(input.title);
    try {
      const id = await db.$transaction(async (tx) => {
        const team = await tx.botTeam.create({
          data: {
            slug,
            title: input.title,
            description: input.description || null,
            authorId: user.id,
            members: { create: memberRows(input.members) },
          },
          select: { id: true },
        });
        if (input.links.length > 0) await tx.botTeamLink.createMany({ data: linkRows(team.id, input.links) });
        return team.id;
      });
      const team = await getTeam({ id }, user);
      return { ok: true, data: team! };
    } catch (error) {
      if (attempt < 2 && isSlugConflict(error)) continue;
      throw error;
    }
  }
}

/** Replaces the team's title, description, members and handoffs; the slug stays stable */
export async function updateTeam(
  user: PromptWriter,
  teamId: string,
  input: BotTeamInput
): Promise<PromptWriteResult<BotTeamView<BotView>>> {
  const invalid = await checkTeamInput(user, input);
  if (invalid) return invalid;

  await db.$transaction(async (tx) => {
    await tx.botTeam.update({
      where: { id: teamId },
      data: { title: input.title, description: input.description || null },
    });
    await tx.botTeamLink.deleteMany({ where: { teamId } });
    await tx.botTeamMember.deleteMany({ where: { teamId } });
    await tx.botTeamMember.createMany({ data: memberRows(input.members).map((row) => ({ ...row, teamId })) });
    if (input.links.length > 0) await tx.botTeamLink.createMany({ data: linkRows(teamId, input.links) });
  });
  const team = await getTeam({ id: teamId }, user);
  return { ok: true, data: team! };
}

export async function deleteTeam(teamId: string): Promise<void> {
  await db.botTeam.delete({ where: { id: teamId } });
}

/** The caller's own team by id, else by slug, else by case-insensitive title */
export async function findOwnTeam(
  user: PromptWriter,
  { id, slug, title }: { id?: string; slug?: string; title?: string }
): Promise<BotTeamView<BotView> | null> {
  const where: Prisma.BotTeamWhereInput = { authorId: user.id };
  const select = teamDetailSelect;
  let record: TeamDetailRecord | null = null;
  if (id) {
    record = await db.botTeam.findFirst({ where: { ...where, id }, select });
    return record ? detailView(record, user) : null;
  }
  if (slug) record = await db.botTeam.findFirst({ where: { ...where, slug }, select });
  if (!record && title) {
    record = await db.botTeam.findFirst({
      where: { ...where, title: { equals: title.trim(), mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
      select,
    });
  }
  return record ? detailView(record, user) : null;
}

export interface OwnTeamInput {
  id?: string;
  slug?: string;
  title: string;
  /** Undefined keeps the stored description on update; null or "" clears it */
  description?: string | null;
  members: BotTeamMemberInput[];
  /** Undefined keeps the stored handoffs between bots that stay in the team */
  links?: BotTeamLinkInput[];
}

export type OwnTeamAction = "created" | "updated" | "unchanged";

function comparable(team: Pick<BotTeamInput, "title" | "description" | "members" | "links">) {
  return {
    title: team.title,
    description: team.description || null,
    members: team.members.map((m) => [m.botId, m.role || null]),
    links: team.links.map((l) => [l.fromBotId, l.toBotId, l.label]),
  };
}

/** Fields of `next` that differ from the stored team */
export function diffTeam(existing: BotTeamView<{ id: string }>, next: BotTeamInput): string[] {
  const before = comparable({
    title: existing.title,
    description: existing.description,
    members: existing.members.map((m) => ({ botId: m.bot.id, role: m.role })),
    links: existing.links,
  });
  const after = comparable(next);
  return (Object.keys(after) as (keyof typeof after)[]).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

/**
 * Creates the caller's team, or updates the one matching by id, slug or title. An update that
 * changes nothing writes nothing, so calling it again with the same team is idempotent.
 */
export async function upsertOwnTeam(
  user: PromptWriter,
  input: OwnTeamInput
): Promise<PromptWriteResult<{ action: OwnTeamAction; team: BotTeamView<BotView>; changedFields: string[] }>> {
  const existing = await findOwnTeam(user, input);
  if (input.id && !existing) return fail(404, "not_found", "Team not found or you don't own it");

  const memberIds = new Set(input.members.map((m) => m.botId));
  const next: BotTeamInput = {
    title: input.title,
    description: input.description === undefined ? (existing?.description ?? null) : input.description || null,
    members: input.members,
    links:
      input.links ??
      (existing?.links ?? []).filter((link) => memberIds.has(link.fromBotId) && memberIds.has(link.toBotId)),
  };

  if (existing) {
    const changedFields = diffTeam(existing, next);
    if (changedFields.length === 0) return { ok: true, data: { action: "unchanged", team: existing, changedFields } };
    const result = await updateTeam(user, existing.id, next);
    if (!result.ok) return result;
    return { ok: true, data: { action: "updated", team: result.data, changedFields } };
  }

  const result = await createTeam(user, next);
  if (!result.ok) return result;
  return { ok: true, data: { action: "created", team: result.data, changedFields: [] } };
}
