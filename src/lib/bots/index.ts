import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getBotUrl } from "@/lib/urls";
import { isTrending } from "@/lib/trending";
import {
  BOT_PLATFORM_INFO,
  computerRequirementText,
  isBotColor,
  isBotIconName,
  parseBotConfig,
  resolveBotPlatforms,
  type BotColor,
  type BotComputerRequirement,
  type BotConfig,
  type BotIconName,
  type BotPlatform,
} from "./schema";

export * from "./schema";

export const botSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  content: true,
  botPlatform: true,
  botPlatforms: true,
  botIcon: true,
  botColor: true,
  computerRequirement: true,
  installUrl: true,
  botConfig: true,
  isPrivate: true,
  isUnlisted: true,
  isFeatured: true,
  trendingUntil: true,
  delistReason: true,
  deletedAt: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { username: true, name: true, avatar: true, verified: true } },
  _count: { select: { votes: true } },
  category: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
} satisfies Prisma.PromptSelect;

type BotRecord = Prisma.PromptGetPayload<{ select: typeof botSelect }>;

export interface BotView {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  instructions: string;
  /** Always non-empty, in BOT_PLATFORMS order */
  platforms: BotPlatform[];
  /** Preset icon key; null means the default icon */
  icon: BotIconName | null;
  /** Preset color key; null means the neutral default */
  color: BotColor | null;
  /** Whether the bot needs a cloud computer or the user's own to run */
  computerRequirement: BotComputerRequirement;
  installUrl: string | null;
  config: BotConfig;
  isPrivate: boolean;
  isUnlisted: boolean;
  isFeatured: boolean;
  trendingUntil: Date | null;
  delistReason: BotRecord["delistReason"];
  deletedAt: Date | null;
  authorId: string;
  author: BotRecord["author"];
  voteCount: number;
  category: BotRecord["category"];
  tags: BotRecord["tags"][number]["tag"][];
  createdAt: Date;
  updatedAt: Date;
}

export function formatBotPlatforms(platforms: BotPlatform[]): string {
  return platforms.map((platform) => BOT_PLATFORM_INFO[platform].name).join(", ");
}

export function toBotView(record: BotRecord): BotView {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    instructions: record.content,
    platforms: resolveBotPlatforms(record),
    icon: record.botIcon && isBotIconName(record.botIcon) ? record.botIcon : null,
    color: record.botColor && isBotColor(record.botColor) ? record.botColor : null,
    computerRequirement: record.computerRequirement,
    installUrl: record.installUrl,
    config: parseBotConfig(record.botConfig),
    isPrivate: record.isPrivate,
    isUnlisted: record.isUnlisted,
    isFeatured: record.isFeatured,
    trendingUntil: record.trendingUntil,
    delistReason: record.delistReason,
    deletedAt: record.deletedAt,
    authorId: record.authorId,
    author: record.author,
    voteCount: record._count.votes,
    category: record.category,
    tags: record.tags.map(({ tag }) => tag),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** Public, listed bots: the same visibility rules as the prompts listing */
export const publicBotWhere = {
  type: "BOT",
  isPrivate: false,
  isUnlisted: false,
  deletedAt: null,
} satisfies Prisma.PromptWhereInput;

export const BOT_SORTS = ["newest", "oldest", "upvotes"] as const;
export type BotSort = (typeof BOT_SORTS)[number];

export interface BotListFilters {
  platform?: BotPlatform;
  computerRequirement?: BotComputerRequirement;
  /** Matches the category and, for a parent category, its subcategories */
  categorySlug?: string;
  /** Every tag must match */
  tagSlugs?: string[];
  /** Comma-separated keywords; any of them may match */
  q?: string;
  sort?: BotSort;
}

function botListWhere({ platform, computerRequirement, categorySlug, tagSlugs = [], q }: BotListFilters): Prisma.PromptWhereInput {
  const keywords = (q ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return {
    ...publicBotWhere,
    ...(platform && { botPlatforms: { has: platform } }),
    ...(computerRequirement && { computerRequirement }),
    ...(categorySlug && { category: { OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] } }),
    ...(tagSlugs.length > 0 && { AND: tagSlugs.map((slug) => ({ tags: { some: { tag: { slug } } } })) }),
    ...(keywords.length > 0 && {
      OR: keywords.flatMap((keyword) => [
        { title: { contains: keyword, mode: "insensitive" as const } },
        { description: { contains: keyword, mode: "insensitive" as const } },
        { content: { contains: keyword, mode: "insensitive" as const } },
      ]),
    }),
  };
}

const BOT_ORDER: Record<BotSort, Prisma.PromptOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }],
  upvotes: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
};

export async function listBots({ skip = 0, take = 24, ...filters }: BotListFilters & { skip?: number; take?: number } = {}) {
  const where = botListWhere(filters);
  const [records, total] = await Promise.all([
    db.prompt.findMany({ where, orderBy: BOT_ORDER[filters.sort ?? "newest"], skip, take, select: botSelect }),
    db.prompt.count({ where }),
  ]);
  return { bots: records.map(toBotView), total };
}

/** Public bots matching the same filters /bots applies, for linking to a filtered /bots listing */
export function countBots(filters: Omit<BotListFilters, "sort"> = {}) {
  return db.prompt.count({ where: botListWhere(filters) });
}

/** A user's bots for their profile; private ones only for the owner */
export async function listBotsByAuthor(
  authorId: string,
  { includePrivate = false, skip = 0, take = 24 }: { includePrivate?: boolean; skip?: number; take?: number } = {}
): Promise<{ bots: BotView[]; total: number }> {
  const where: Prisma.PromptWhereInput = { authorId, type: "BOT", deletedAt: null, ...(includePrivate ? {} : { isPrivate: false }) };
  const [records, total] = await Promise.all([
    db.prompt.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, select: botSelect }),
    db.prompt.count({ where }),
  ]);
  return { bots: records.map(toBotView), total };
}

/**
 * Sidebar options for /bots: categories that hold public bots (parents included, with bot
 * counts that roll subcategories up into their parent) and tags used on public bots
 */
export async function getBotFilterOptions() {
  const [byCategory, tagRows] = await Promise.all([
    db.prompt.groupBy({ by: ["categoryId"], where: { ...publicBotWhere, categoryId: { not: null } }, _count: { _all: true } }),
    db.tag.findMany({
      where: { prompts: { some: { prompt: publicBotWhere } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, color: true },
    }),
  ]);
  const direct = new Map(byCategory.map((row) => [row.categoryId as string, row._count._all]));
  const used = await db.category.findMany({
    where: { id: { in: [...direct.keys()] } },
    select: { id: true, parentId: true },
  });
  const counts = new Map(direct);
  for (const category of used) {
    if (category.parentId) counts.set(category.parentId, (counts.get(category.parentId) ?? 0) + (direct.get(category.id) ?? 0));
  }
  const categories = await db.category.findMany({
    where: { id: { in: [...counts.keys()] } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true },
  });
  return {
    categories: categories.map((category) => ({ ...category, count: counts.get(category.id) ?? 0 })),
    tags: tagRows,
  };
}

/** Most recently added public bots, newest first */
export async function listLatestBots(take = 6): Promise<BotView[]> {
  const records = await db.prompt.findMany({
    where: publicBotWhere,
    orderBy: { createdAt: "desc" },
    take,
    select: botSelect,
  });
  return records.map(toBotView);
}

/** Finds a bot by id, skipping soft-deleted ones unless asked. Callers check privacy with canViewPrompt. */
export async function getBotById(id: string, { includeDeleted = false } = {}): Promise<BotView | null> {
  const record = await db.prompt.findFirst({
    where: { id, type: "BOT", ...(includeDeleted ? {} : { deletedAt: null }) },
    select: botSelect,
  });
  return record ? toBotView(record) : null;
}

/**
 * A live bot by id (or "id_slug" URL segment), else by slug, with the visibility rules of the bot page:
 * public and unlisted bots for everyone, private ones for their author and admins. Slugs are not
 * unique, so a slug resolves to the oldest visible match.
 */
export async function findVisibleBot(
  { id, slug }: { id?: string; slug?: string },
  viewer: { id: string; role: string } | null = null
): Promise<BotView | null> {
  if (!id && !slug) return null;
  const visibility: Prisma.PromptWhereInput =
    viewer?.role === "ADMIN" ? {} : { OR: [{ isPrivate: false }, ...(viewer ? [{ authorId: viewer.id }] : [])] };
  const record = await db.prompt.findFirst({
    where: { type: "BOT", deletedAt: null, ...visibility, ...(id ? { id: extractBotId(id) } : { slug }) },
    orderBy: { createdAt: "asc" },
    select: botSelect,
  });
  return record ? toBotView(record) : null;
}

/** Extracts the id from a bot URL segment: "abc123" or "abc123_some-slug" */
export function extractBotId(param: string): string {
  const underscoreIndex = param.indexOf("_");
  return underscoreIndex === -1 ? param : param.substring(0, underscoreIndex);
}

export function getBotUrls(bot: Pick<BotView, "id" | "slug">, baseUrl: string) {
  const page = `${baseUrl}${getBotUrl(bot.id, bot.slug)}`;
  return {
    page,
    markdown: `${page}.md`,
    json: `${page}.json`,
    skill: `${page}/SKILL.md`,
  };
}

/** Agent Skills names must match ^[a-z][a-z0-9_-]*$ */
export function getBotSkillName(bot: Pick<BotView, "id" | "slug">): string {
  const name = (bot.slug || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return /^[a-z]/.test(name) ? name : `bot-${bot.id.toLowerCase()}`;
}

/** Where a bot lands on the platform; AutoGPT keeps instructions, skills and routines on an Expert */
export function getInstallTarget(platform: BotPlatform, count = 1): string {
  const platformName = BOT_PLATFORM_INFO[platform].name;
  if (platform === "AUTOGPT") return `as ${count === 1 ? "an Expert" : "Experts"} on ${platformName}`;
  return `on ${platformName}`;
}

/** Prompt the user pastes into an agent that cannot import bots from a URL */
export function getInstallPrompt(bot: BotView, platform: BotPlatform, baseUrl: string): string {
  const computer = computerRequirementText(bot.computerRequirement, "user");
  return `${computer ? `${computer} ` : ""}Go to ${getBotUrls(bot, baseUrl).markdown} and create the "${bot.title}" bot ${getInstallTarget(platform)} exactly as described there: adopt its instructions as your standing instructions, install its skills, ask me to connect the required connectors, and set up each routine with the given schedule or trigger. Confirm each step when done.`;
}

/** Marks a bot in a list of bots to install, e.g. ` [needs a cloud computer]` */
export function computerListMark(requirement: BotComputerRequirement): string {
  if (requirement === "CLOUD") return " [needs a cloud computer]";
  if (requirement === "LOCAL") return " [needs my computer]";
  return "";
}

/** What the marks in a list of bots mean, for the requirements present; empty when none are */
export function computerListNotes(bots: Pick<BotView, "computerRequirement">[]): string[] {
  const present = new Set(bots.map((bot) => bot.computerRequirement));
  return [
    ...(present.has("CLOUD") ? ["Bots that need a cloud computer need their own remote computer, desktop or browser to work in: set one up for each or ask me to connect one."] : []),
    ...(present.has("LOCAL") ? ["Bots that need my computer need access to my own machine, files and apps: ask me before connecting it."] : []),
  ];
}

/** Hermes installs SKILL.md files straight from a URL */
export function getHermesInstallCommand(bot: BotView, baseUrl: string): string {
  return `hermes skills install ${getBotUrls(bot, baseUrl).skill}`;
}

export interface BotInstallOption {
  platform: BotPlatform;
  platformName: string;
  /** One-click link; only Grok Bot templates have one */
  installUrl: string | null;
  installPrompt: string;
  /** Only Hermes can install a bot with a single CLI command */
  command: string | null;
}

export function getBotInstallOptions(bot: BotView, baseUrl: string): BotInstallOption[] {
  return bot.platforms.map((platform) => ({
    platform,
    platformName: BOT_PLATFORM_INFO[platform].name,
    installUrl: platform === "GROK_BOT" ? bot.installUrl : null,
    installPrompt: getInstallPrompt(bot, platform, baseUrl),
    command: platform === "HERMES" ? getHermesInstallCommand(bot, baseUrl) : null,
  }));
}

function setupCommands(bot: BotView, platform: BotPlatform): string[] {
  const lines: string[] = [];
  const quote = (s: string) => JSON.stringify(s);
  const { routines, skills } = bot.config;

  if (platform === "OPENCLAW") {
    for (const skill of skills) {
      if (skill.source) lines.push(`openclaw skills install ${skill.source}`);
    }
    for (const routine of routines) {
      if (routine.type === "schedule") {
        lines.push(`openclaw automations create ${quote(routine.trigger)} ${quote(routine.prompt)} --name ${quote(routine.name)}`);
      }
    }
  } else if (platform === "HERMES") {
    for (const skill of skills) {
      if (skill.source) lines.push(`hermes skills install ${skill.source}`);
    }
    const skillFlags = skills.map((skill) => ` --skill ${skill.name}`).join("");
    for (const routine of routines) {
      if (routine.type === "schedule") {
        lines.push(`hermes cron create ${quote(routine.trigger)} ${quote(routine.prompt)} --name ${quote(routine.name)}${skillFlags}`);
      }
    }
  }
  return lines;
}

function botBody(bot: BotView, baseUrl: string): string {
  const { routines, skills, connectors } = bot.config;
  const sections: string[] = [];

  if (bot.description) sections.push(bot.description);
  sections.push(`## Platforms\n\n${bot.platforms.map((platform) => `- ${BOT_PLATFORM_INFO[platform].name}`).join("\n")}`);
  const computer = computerRequirementText(bot.computerRequirement);
  if (computer) sections.push(`## Computer\n\n${computer}`);
  sections.push(`## Instructions\n\n${bot.instructions}`);

  if (routines.length > 0) {
    const items = routines.map((routine) =>
      [
        `### ${routine.name}`,
        "",
        `- Type: ${routine.type}`,
        `- ${routine.type === "schedule" ? "Schedule (cron)" : "Trigger"}: ${routine.trigger}`,
        ...(routine.triggerLabel ? [`- When: ${routine.triggerLabel}`] : []),
        `- Task: ${routine.prompt}`,
      ].join("\n")
    );
    sections.push(`## Routines\n\n${items.join("\n\n")}`);
  }

  if (skills.length > 0) {
    const items = skills.map(
      (skill) =>
        `- **${skill.name}**${skill.description ? `: ${skill.description}` : ""}${skill.source ? ` (install: \`${skill.source}\`)` : ""}`
    );
    sections.push(`## Skills\n\n${items.join("\n")}`);
  }

  if (connectors.length > 0) {
    sections.push(`## Required connectors\n\n${connectors.map((c) => `- ${c}`).join("\n")}`);
  }

  const setup = [
    "1. Adopt the instructions above as your standing instructions for this bot.",
    "2. Install the listed skills.",
    "3. Ask the user to connect each required connector.",
    "4. Create every routine with its schedule or trigger and task.",
  ];
  for (const platform of bot.platforms) {
    const commands = setupCommands(bot, platform);
    if (commands.length > 0) {
      setup.push(
        "",
        `Equivalent ${BOT_PLATFORM_INFO[platform].name} CLI commands for scheduled routines and skills:`,
        "",
        "```bash",
        ...commands,
        "```"
      );
    }
  }
  sections.push(`## Setup\n\n${setup.join("\n")}`);
  sections.push(`Source: ${getBotUrls(bot, baseUrl).page}`);

  return sections.join("\n\n");
}

export function botToMarkdown(bot: BotView, baseUrl: string): string {
  const frontmatter = [
    "---",
    `name: ${JSON.stringify(bot.title)}`,
    `platforms: [${bot.platforms.join(", ")}]`,
    `computer: ${bot.computerRequirement}`,
    ...(bot.description ? [`description: ${JSON.stringify(bot.description)}`] : []),
    ...(bot.category ? [`category: ${JSON.stringify(bot.category.name)}`] : []),
    ...(bot.tags.length > 0 ? [`tags: [${bot.tags.map((tag) => JSON.stringify(tag.name)).join(", ")}]`] : []),
    `author: ${bot.author.username}`,
    "---",
  ].join("\n");
  return `${frontmatter}\n\n# ${bot.title}\n\n${botBody(bot, baseUrl)}\n`;
}

/** Agent Skills formatted file, installable with `hermes skills install <url>` */
export function botToSkill(bot: BotView, baseUrl: string): string {
  const summary = bot.description ? `${bot.description} ` : "";
  const frontmatter = [
    "---",
    `name: ${getBotSkillName(bot)}`,
    `description: ${JSON.stringify(`${summary}Use this skill to set up or run the "${bot.title}" bot on ${formatBotPlatforms(bot.platforms)}.`)}`,
    "---",
  ].join("\n");
  return `${frontmatter}\n\n# ${bot.title}\n\n${botBody(bot, baseUrl)}\n`;
}

export function botCategoryJson(bot: Pick<BotView, "category">) {
  if (!bot.category) return null;
  const { name, slug, parent } = bot.category;
  return { name, slug, parent: parent ? { name: parent.name, slug: parent.slug } : null };
}

export function botTagsJson(bot: Pick<BotView, "tags">) {
  return bot.tags.map(({ name, slug }) => ({ name, slug }));
}

export function botToJson(bot: BotView, baseUrl: string) {
  return {
    id: bot.id,
    slug: bot.slug,
    name: bot.title,
    description: bot.description,
    platforms: bot.platforms,
    platformNames: bot.platforms.map((platform) => BOT_PLATFORM_INFO[platform].name),
    icon: bot.icon,
    color: bot.color,
    computerRequirement: bot.computerRequirement,
    instructions: bot.instructions,
    routines: bot.config.routines,
    skills: bot.config.skills,
    connectors: bot.config.connectors,
    installUrl: bot.installUrl,
    category: botCategoryJson(bot),
    tags: botTagsJson(bot),
    isTrending: isTrending(bot.trendingUntil),
    trendingUntil: bot.trendingUntil,
    author: { username: bot.author.username, name: bot.author.name },
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    urls: getBotUrls(bot, baseUrl),
    install: getBotInstallOptions(bot, baseUrl).map(({ platform, installUrl, installPrompt, command }) => ({
      platform,
      installUrl,
      installPrompt,
      command,
    })),
  };
}
