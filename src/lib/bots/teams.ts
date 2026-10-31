import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PromptWriter, PromptWriteResult } from "@/lib/prompt-write";
import { slugify } from "@/lib/slug";
import { getBotTeamUrl } from "@/lib/urls";
import {
  BOT_PLATFORM_INFO,
  BOT_PLATFORMS,
  botCategoryJson,
  botSelect,
  botTagsJson,
  computerListMark,
  computerListNotes,
  getBotUrls,
  getInstallTarget,
  isBotColor,
  isBotIconName,
  normalizeComputerRequirements,
  resolveBotPlatforms,
  toBotView,
  type BotColor,
  type BotComputerRequirement,
  type BotIconName,
  type BotPlatform,
  type BotView,
} from "./index";
import { buildBundleInstallOptions, type BotBundleInstallOption } from "./pairings";
import type { TeamGraphTeam } from "./team-graph";
import {
  markdownToPlainText,
  teamLinkIssues,
  type BotTeamInput,
  type BotTeamLinkInput,
  type BotTeamMemberInput,
} from "./team-schema";

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
  computerRequirements: BotComputerRequirement[];
}

export interface TeamCategory {
  id: string;
  name: string;
  slug: string;
  parent: { id: string; name: string; slug: string } | null;
}

export interface TeamTag {
  id: string;
  name: string;
  slug: string;
  color: string;
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
  voteCount: number;
  category: TeamCategory | null;
  tags: TeamTag[];
  createdAt: Date;
  updatedAt: Date;
  /** Members the viewer may see, in team order, with what each does in the team */
  members: { bot: B; role: string | null; description: string | null }[];
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
  computerRequirements: true,
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
  _count: { select: { votes: true } },
  category: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true, color: true } } }, orderBy: { tag: { name: "asc" } } },
  links: {
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { fromBotId: true, toBotId: true, label: true },
  },
} satisfies Prisma.BotTeamSelect;

const memberOrder = [{ order: "asc" }, { id: "asc" }] satisfies Prisma.BotTeamMemberOrderByWithRelationInput[];

const teamSummarySelect = {
  ...teamBaseSelect,
  members: { orderBy: memberOrder, select: { role: true, description: true, bot: { select: teamBotSummarySelect } } },
} satisfies Prisma.BotTeamSelect;

const teamDetailSelect = {
  ...teamBaseSelect,
  members: {
    orderBy: memberOrder,
    select: { role: true, description: true, bot: { select: { ...botSelect, ...visibilityFields } } },
  },
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
    computerRequirements: normalizeComputerRequirements(record.computerRequirements),
  };
}

/** Keeps the members the viewer may see and the handoffs between them */
export function toTeamView<R extends VisibilityRecord & { id: string }, B extends { id: string }>(
  record: Omit<TeamSummaryRecord, "members"> & { members: { role: string | null; description: string | null; bot: R }[] },
  mapBot: (bot: R) => B,
  viewer: TeamViewer | null
): BotTeamView<B> {
  const members = record.members
    .filter((member) => canViewTeamBot(member.bot, viewer))
    .map((member) => ({ bot: mapBot(member.bot), role: member.role || null, description: member.description || null }));
  const visible = new Set(members.map((member) => member.bot.id));
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    isFeatured: record.isFeatured,
    authorId: record.authorId,
    author: record.author,
    voteCount: record._count.votes,
    category: record.category,
    tags: record.tags.map(({ tag }) => tag),
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

export interface TeamListFilters {
  q?: string;
  authorId?: string;
  /** Matches the category and, for a parent category, its subcategories */
  categorySlug?: string;
  /** Every tag must match */
  tagSlugs?: string[];
  /** At least one public member runs on the platform */
  platform?: BotPlatform;
}

export const TEAM_SORTS = ["newest", "oldest", "upvotes"] as const;
export type TeamSort = (typeof TEAM_SORTS)[number];

export function teamSortFromParam(param: string | undefined): TeamSort {
  return TEAM_SORTS.includes(param as TeamSort) ? (param as TeamSort) : "newest";
}

const TEAM_ORDER: Record<TeamSort, Prisma.BotTeamOrderByWithRelationInput[]> = {
  newest: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  upvotes: [{ votes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }],
};

function teamListWhere({ q, authorId, categorySlug, tagSlugs = [], platform }: TeamListFilters): Prisma.BotTeamWhereInput {
  const keywords = (q ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return {
    ...(platform
      ? { members: { some: { bot: { type: "BOT", deletedAt: null, isPrivate: false, botPlatforms: { has: platform } } } } }
      : listedTeamWhere),
    ...(authorId && { authorId }),
    ...(categorySlug && { category: { OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] } }),
    ...(tagSlugs.length > 0 && { AND: tagSlugs.map((slug) => ({ tags: { some: { tag: { slug } } } })) }),
    ...(keywords.length > 0 && {
      OR: keywords.flatMap((keyword) => [
        { title: { contains: keyword, mode: "insensitive" as const } },
        { description: { contains: keyword, mode: "insensitive" as const } },
        { members: { some: { bot: { title: { contains: keyword, mode: "insensitive" as const }, isPrivate: false } } } },
      ]),
    }),
  };
}

/** Newest first, with featured teams ahead of the rest, unless sorted otherwise */
export async function listTeams({
  skip = 0,
  take = 24,
  viewer = null,
  sort = "newest",
  ...filters
}: TeamListFilters & { skip?: number; take?: number; viewer?: TeamViewer | null; sort?: TeamSort } = {}) {
  const where = teamListWhere(filters);
  const [records, total] = await Promise.all([
    db.botTeam.findMany({
      where,
      orderBy: TEAM_ORDER[sort],
      skip,
      take,
      select: teamSummarySelect,
    }),
    db.botTeam.count({ where }),
  ]);
  return { teams: records.map((record) => summaryView(record, viewer)), total };
}

/** Which of the given teams the user has upvoted */
export async function getVotedTeamIds(userId: string | null | undefined, teamIds: string[]): Promise<Set<string>> {
  if (!userId || teamIds.length === 0) return new Set();
  const votes = await db.botTeamVote.findMany({ where: { userId, teamId: { in: teamIds } }, select: { teamId: true } });
  return new Set(votes.map((vote) => vote.teamId));
}

/** Listed teams the bot is a member of, with its role in each; featured and most upvoted first */
export async function getBotTeams(botId: string) {
  const memberships = await db.botTeamMember.findMany({
    where: { botId, team: listedTeamWhere },
    orderBy: [{ team: { isFeatured: "desc" } }, { team: { votes: { _count: "desc" } } }, { team: { createdAt: "desc" } }],
    take: 12,
    select: {
      role: true,
      team: {
        select: {
          id: true,
          slug: true,
          title: true,
          isFeatured: true,
          category: { select: { name: true, slug: true, parent: { select: { name: true } } } },
          _count: { select: { members: true, votes: true } },
        },
      },
    },
  });
  return memberships.map(({ role, team }) => ({
    id: team.id,
    slug: team.slug,
    title: team.title,
    isFeatured: team.isFeatured,
    category: team.category,
    memberCount: team._count.members,
    voteCount: team._count.votes,
    role: role || null,
  }));
}

/** Categories (with team counts, parents including their subcategories) and tags used by listed teams */
export async function getTeamFilterOptions() {
  const [byCategory, tags] = await Promise.all([
    db.botTeam.groupBy({ by: ["categoryId"], where: { ...listedTeamWhere, categoryId: { not: null } }, _count: { _all: true } }),
    db.tag.findMany({
      where: { botTeams: { some: { team: listedTeamWhere } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, color: true },
    }),
  ]);
  const direct = new Map(byCategory.map((row) => [row.categoryId as string, row._count._all]));
  const used = await db.category.findMany({ where: { id: { in: [...direct.keys()] } }, select: { id: true, parentId: true } });
  const counts = new Map(direct);
  for (const category of used) {
    if (category.parentId) counts.set(category.parentId, (counts.get(category.parentId) ?? 0) + (direct.get(category.id) ?? 0));
  }
  const categories = await db.category.findMany({
    where: { id: { in: [...counts.keys()] } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true },
  });
  return { categories: categories.map((category) => ({ ...category, count: counts.get(category.id) ?? 0 })), tags };
}

/** Every category and tag, for the category and tag pickers of the team form */
export async function getTeamFormOptions() {
  const [categories, tags] = await Promise.all([
    db.category.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, parentId: true } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, color: true } }),
  ]);
  return { categories, tags };
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

/**
 * One prompt that sets up the team's bots on a platform: the team description, each bot with its
 * role and in-team description (added to that bot's instructions as its team responsibility), and
 * the handoffs between them
 */
export function getTeamInstallPrompt(
  team: Pick<BotTeamView<BotView>, "title" | "description" | "members" | "links">,
  members: BotView[],
  platform: BotPlatform,
  baseUrl: string
): string {
  const ids = new Set(members.map((bot) => bot.id));
  const teamMembers = new Map(team.members.map((member) => [member.bot.id, member]));
  const titles = new Map(members.map((bot) => [bot.id, bot.title]));
  const list = members
    .map((bot, index) => {
      const { role, description } = teamMembers.get(bot.id) ?? {};
      const line = `${index + 1}. "${bot.title}"${role ? ` (${role})` : ""}${computerListMark(bot.computerRequirements)}: ${getBotUrls(bot, baseUrl).markdown}`;
      return description ? `${line}\n   Team responsibility: ${description.trim()}` : line;
    })
    .join("\n");
  const handoffs = team.links
    .filter((link) => ids.has(link.fromBotId) && ids.has(link.toBotId))
    .map((link) => `- "${titles.get(link.fromBotId)}" hands off to "${titles.get(link.toBotId)}"${link.label ? `: ${link.label}` : ""}`);

  const teamDescription = team.description?.trim();
  const hasResponsibilities = members.some((bot) => !!teamMembers.get(bot.id)?.description?.trim());
  const teamContext =
    teamDescription && hasResponsibilities
      ? " Then add the team context to each bot's standing instructions: what the team is for (from the team description above) and, where listed, the bot's team responsibility, as its job within this team."
      : teamDescription
        ? " Then add what the team is for (from the team description above) to each bot's standing instructions, as the context it works in."
        : hasResponsibilities
          ? " Then add each listed team responsibility to that bot's standing instructions, as its job within this team."
          : "";

  return [
    `Set up the "${team.title}" team: ${members.length === 1 ? "1 bot" : `${members.length} bots`} ${getInstallTarget(platform, members.length)} that hand work off to each other. Install all of them.`,
    ...(teamDescription ? [`Team description:\n${teamDescription}`] : []),
    `Bots:\n${list}`,
    ...(handoffs.length > 0 ? [`Handoffs:\n${handoffs.join("\n")}`] : []),
    "For each bot, go to its URL and create it exactly as described there: adopt its instructions as the standing instructions for that bot, install its skills, and set up each routine with the given schedule or trigger." +
      teamContext +
      (handoffs.length > 0 ? " Then wire up the handoffs: when a bot finishes its part, it passes what is listed to the next bot." : "") +
      " Ask me to connect each required connector once, even when several bots need it. Confirm each bot when done." +
      computerListNotes(members).map((note) => ` ${note}`).join(""),
  ].join("\n\n");
}

/** "Install team" options, one per platform any member supports */
export function getTeamInstallOptions(team: BotTeamView<BotView>, baseUrl: string): BotBundleInstallOption[] {
  const bots = team.members.map((member) => member.bot);
  return buildBundleInstallOptions(bots, getTeamPlatforms(bots), baseUrl, (members, platform) =>
    getTeamInstallPrompt(team, members, platform, baseUrl)
  );
}

export function toTeamGraphTeam(team: BotTeamView<BotTeamBot | BotView>, { voted = false }: { voted?: boolean } = {}): TeamGraphTeam {
  return {
    id: team.id,
    slug: team.slug,
    title: team.title,
    description: team.description,
    author: team.author,
    isFeatured: team.isFeatured,
    voteCount: team.voteCount,
    voted,
    installable: getTeamPlatforms(team.members.map((member) => member.bot)).length > 0,
    members: team.members.map(({ bot, role, description }) => ({
      id: bot.id,
      slug: bot.slug,
      title: bot.title,
      icon: bot.icon,
      color: bot.color,
      computerRequirements: bot.computerRequirements,
      role,
      description,
    })),
    links: team.links,
  };
}

function teamUrl(team: { slug: string }, baseUrl: string) {
  return `${baseUrl}${getBotTeamUrl(team.slug)}`;
}

const EXCERPT_LENGTH = 280;

/** The team description as plain text, cut to about `max` characters */
export function teamExcerpt(description: string | null, max = EXCERPT_LENGTH): string | null {
  if (!description) return null;
  const text = markdownToPlainText(description);
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text || null;
}

/** A small team summary for listings and MCP; the description is a plain-text excerpt */
export function teamSummaryJson(team: BotTeamView<BotTeamBot | BotView>, baseUrl: string) {
  return {
    id: team.id,
    slug: team.slug,
    title: team.title,
    description: teamExcerpt(team.description),
    author: team.author.name || team.author.username,
    isFeatured: team.isFeatured,
    category: botCategoryJson(team),
    tags: botTagsJson(team),
    members: team.members.map(({ bot, role }) => ({ id: bot.id, name: bot.title, role, computerRequirements: bot.computerRequirements })),
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
    category: botCategoryJson(team),
    tags: botTagsJson(team),
    members: team.members.map(({ bot, role, description }) => ({
      id: bot.id,
      slug: bot.slug,
      name: bot.title,
      role,
      description,
      computerRequirements: bot.computerRequirements,
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
  return members.map((member, order) => ({
    botId: member.botId,
    role: member.role || null,
    description: member.description || null,
    order,
  }));
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
  if (input.categoryId && !(await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
    return fail(400, "invalid_category", "Category not found");
  }
  if (input.tagIds.length > 0) {
    const found = await db.tag.findMany({ where: { id: { in: input.tagIds } }, select: { id: true } });
    const known = new Set(found.map((tag) => tag.id));
    const unknown = input.tagIds.filter((id) => !known.has(id));
    if (unknown.length > 0) return fail(400, "invalid_tags", "Some tags do not exist", { tagIds: unknown });
  }
  return null;
}

function tagRows(tagIds: string[]) {
  return tagIds.map((tagId) => ({ tagId }));
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
            categoryId: input.categoryId || null,
            members: { create: memberRows(input.members) },
            tags: { create: tagRows(input.tagIds) },
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

/** Replaces the team's title, description, category, tags, members and handoffs; the slug stays stable */
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
      data: {
        title: input.title,
        description: input.description || null,
        categoryId: input.categoryId || null,
        tags: { deleteMany: {}, create: tagRows(input.tagIds) },
      },
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
  /** Undefined keeps the stored category on update; null clears it */
  categoryId?: string | null;
  /** Undefined keeps the stored tags on update */
  tagIds?: string[];
  /** A member's undefined description keeps the stored one */
  members: BotTeamMemberInput[];
  /** Undefined keeps the stored handoffs between bots that stay in the team */
  links?: BotTeamLinkInput[];
}

export type OwnTeamAction = "created" | "updated" | "unchanged";

function comparable(team: Pick<BotTeamInput, "title" | "description" | "categoryId" | "tagIds" | "members" | "links">) {
  return {
    title: team.title,
    description: team.description || null,
    category: team.categoryId || null,
    tags: [...new Set(team.tagIds)].sort(),
    members: team.members.map((m) => [m.botId, m.role || null, m.description || null]),
    links: team.links.map((l) => [l.fromBotId, l.toBotId, l.label]),
  };
}

/** Fields of `next` that differ from the stored team */
export function diffTeam(
  existing: Pick<BotTeamView<{ id: string }>, "title" | "description" | "category" | "tags" | "members" | "links">,
  next: BotTeamInput
): string[] {
  const before = comparable({
    title: existing.title,
    description: existing.description,
    categoryId: existing.category?.id ?? null,
    tagIds: existing.tags.map((tag) => tag.id),
    members: existing.members.map((m) => ({ botId: m.bot.id, role: m.role, description: m.description })),
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
  const stored = new Map((existing?.members ?? []).map((m) => [m.bot.id, m]));
  const next: BotTeamInput = {
    title: input.title,
    description: input.description === undefined ? (existing?.description ?? null) : input.description || null,
    categoryId: input.categoryId === undefined ? (existing?.category?.id ?? null) : input.categoryId || null,
    tagIds: [...new Set(input.tagIds ?? existing?.tags.map((tag) => tag.id) ?? [])],
    members: input.members.map((member) => ({
      ...member,
      description: member.description === undefined ? (stored.get(member.botId)?.description ?? null) : member.description || null,
    })),
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
