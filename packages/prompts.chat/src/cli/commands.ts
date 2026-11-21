import {
  BOT_PLATFORM_PARAMS,
  CatalogError,
  MAX_PER_PAGE,
  PROMPT_TYPES,
  SORTS,
  normalizePromptType,
  parseReference,
  type CatalogClient,
  type CatalogPrompt,
  type Sort,
} from './catalog.js';
import {
  formatBotDetail,
  formatBotList,
  formatInstallOption,
  formatPromptDetail,
  formatPromptList,
  formatTeamDetail,
  formatTeamList,
  handle,
} from './format.js';

export interface CommandFlags {
  json?: boolean;
  raw?: boolean;
  type?: string;
  tag?: string;
  category?: string;
  platform?: string;
  sort?: string;
  trending?: boolean;
  page?: number;
  limit?: number;
  install?: string;
  skill?: boolean;
  markdown?: boolean;
}

export interface CommandIO {
  client: CatalogClient;
  out: (text: string) => void;
  err: (text: string) => void;
}

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Non-interactive catalog commands; the TUI, `new` and `mcp` are handled by the entrypoint */
export const CATALOG_COMMANDS = ['search', 'prompts', 'skills', 'tastes', 'classifiers', 'bots', 'teams', 'show', 'bot', 'team'] as const;
export type CatalogCommand = (typeof CATALOG_COMMANDS)[number];

export function isCatalogCommand(command: string | undefined): command is CatalogCommand {
  return (CATALOG_COMMANDS as readonly string[]).includes(command ?? '');
}

const TYPE_PRESETS: Partial<Record<CatalogCommand, string>> = {
  skills: 'SKILL',
  tastes: 'TASTE',
  classifiers: 'CLASSIFIER',
};

function parseSort(sort: string | undefined): Sort | undefined {
  if (!sort) return undefined;
  const value = sort.toLowerCase();
  if ((SORTS as readonly string[]).includes(value)) return value as Sort;
  throw new UsageError(`Unknown sort "${sort}". Use one of: ${SORTS.join(', ')}`);
}

function parsePositive(name: string, value: number | undefined, max?: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) throw new UsageError(`--${name} must be a positive whole number`);
  return max ? Math.min(value, max) : value;
}

function parsePlatform(platform: string | undefined): string | undefined {
  if (!platform) return undefined;
  const value = platform.toLowerCase().replace(/[\s_-]+/g, '');
  const aliases: Record<string, string> = { grokbot: 'grok', hermesagent: 'hermes', openaidots: 'dots', claudeduet: 'duet', metamuse: 'muse' };
  const param = aliases[value] ?? value;
  if ((BOT_PLATFORM_PARAMS as readonly string[]).includes(param)) return param;
  throw new UsageError(`Unknown platform "${platform}". Use one of: ${BOT_PLATFORM_PARAMS.join(', ')}`);
}

/** Matches a platform flag against an install option's enum (GROK_BOT) or display name (Grok Bot) */
function matchesPlatform(flag: string, platform: string, platformName?: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
  const wanted = norm(flag);
  const param = parsePlatformSafe(flag);
  return [platform, platformName ?? ''].some((candidate) => {
    const c = norm(candidate);
    return c === wanted || (param !== undefined && (c === param || c.startsWith(param)));
  });
}

function parsePlatformSafe(flag: string): string | undefined {
  try {
    return parsePlatform(flag);
  } catch {
    return undefined;
  }
}

function json(io: CommandIO, value: unknown): void {
  io.out(JSON.stringify(value, null, 2));
}

function pageHint(io: CommandIO, command: string, query: string, page: number, totalPages: number, total: number): void {
  if (totalPages > 1) {
    const q = query ? ` ${JSON.stringify(query)}` : '';
    const next = page < totalPages ? ` Next: prompts.chat ${command}${q} --page ${page + 1}` : '';
    io.err(`\nPage ${page} of ${totalPages} (${total} total).${next}`);
  }
}

async function listPrompts(command: CatalogCommand, query: string, flags: CommandFlags, io: CommandIO): Promise<number> {
  const type = TYPE_PRESETS[command] ?? normalizePromptType(flags.type);
  if (type === null) {
    throw new UsageError(`Unknown type "${flags.type}". Use one of: ${[...PROMPT_TYPES, 'BOT'].map((t) => t.toLowerCase()).join(', ')}`);
  }
  if (type === 'BOT') return listBots(query, flags, io);
  const page = parsePositive('page', flags.page) ?? 1;
  const perPage = parsePositive('limit', flags.limit, MAX_PER_PAGE) ?? 20;
  const result = await io.client.listPrompts({
    type,
    q: query || undefined,
    tag: flags.tag,
    sort: parseSort(flags.sort),
    trending: flags.trending,
    page,
    perPage,
  });
  if (flags.json) {
    json(io, result);
    return EXIT_OK;
  }
  if (result.prompts.length === 0) {
    io.err(query ? `No results for "${query}".` : 'No results.');
    return EXIT_OK;
  }
  io.out(formatPromptList(result.prompts, (result.page - 1) * result.perPage + 1));
  pageHint(io, command, query, result.page, result.totalPages, result.total);
  io.err('Show one with: prompts.chat show <id>');
  return EXIT_OK;
}

async function listBots(query: string, flags: CommandFlags, io: CommandIO): Promise<number> {
  const result = await io.client.listBots({
    q: query || undefined,
    platform: parsePlatform(flags.platform),
    category: flags.category,
    tag: flags.tag,
    sort: parseSort(flags.sort),
    limit: parsePositive('limit', flags.limit) ?? 20,
  });
  if (flags.json) {
    json(io, result);
    return EXIT_OK;
  }
  if (result.bots.length === 0) {
    io.err(query ? `No bots match "${query}".` : 'No bots found.');
    return EXIT_OK;
  }
  io.out(formatBotList(result.bots));
  if (result.total > result.bots.length) io.err(`\nShowing ${result.bots.length} of ${result.total}. Use --limit or a search query to see more.`);
  io.err('Show one with: prompts.chat bot <id>');
  return EXIT_OK;
}

async function listTeams(query: string, flags: CommandFlags, io: CommandIO): Promise<number> {
  const page = parsePositive('page', flags.page) ?? 1;
  const result = await io.client.listTeams({
    q: query || undefined,
    category: flags.category,
    tag: flags.tag,
    sort: parseSort(flags.sort),
    page,
    perPage: parsePositive('limit', flags.limit, MAX_PER_PAGE) ?? 20,
  });
  if (flags.json) {
    json(io, result);
    return EXIT_OK;
  }
  if (result.teams.length === 0) {
    io.err(query ? `No teams match "${query}".` : 'No teams found.');
    return EXIT_OK;
  }
  io.out(formatTeamList(result.teams, (result.page - 1) * result.perPage + 1));
  pageHint(io, 'teams', query, result.page, result.totalPages, result.total);
  io.err('Show one with: prompts.chat team <slug>');
  return EXIT_OK;
}

function printPrompt(prompt: CatalogPrompt, flags: CommandFlags, io: CommandIO): number {
  if (flags.json) json(io, prompt);
  else if (flags.raw) io.out(prompt.content ?? '');
  else io.out(formatPromptDetail(prompt, io.client.baseUrl));
  return EXIT_OK;
}

async function showPrompt(ref: string, flags: CommandFlags, io: CommandIO): Promise<number> {
  const parsed = parseReference(ref);
  if (parsed.kind === 'bot') return showBot(ref, flags, io);
  if (parsed.kind === 'team') return showTeam(parsed.id, flags, io);
  if (parsed.kind === 'classifier') {
    const classifier = await io.client.findClassifier(parsed.id);
    if (!classifier) throw new CatalogError(`No public classifier "${parsed.id}". Try: prompts.chat classifiers ${parsed.id}`, 404);
    return printPrompt(classifier, flags, io);
  }
  const prompt = await io.client.getPrompt(parsed.id);
  if (prompt.type === 'BOT' && !flags.json && !flags.raw) {
    return showBot(handle(prompt.id, prompt.slug), flags, io);
  }
  return printPrompt(prompt, flags, io);
}

async function showBot(ref: string, flags: CommandFlags, io: CommandIO): Promise<number> {
  const { id } = parseReference(ref);
  if (flags.skill || flags.markdown) {
    io.out(await io.client.getBotMarkdown(id, flags.skill ? 'skill' : 'md'));
    return EXIT_OK;
  }
  const bot = await io.client.getBot(id);
  if (flags.install) {
    const option = bot.install?.find((o) => matchesPlatform(flags.install!, o.platform, bot.platformNames[bot.platforms.indexOf(o.platform)]));
    if (!option) throw new UsageError(`"${bot.name}" has no install option for "${flags.install}". Platforms: ${bot.platformNames.join(', ')}`);
    io.out(flags.json ? JSON.stringify(option, null, 2) : formatInstallOption(option));
    return EXIT_OK;
  }
  if (flags.json) json(io, bot);
  else if (flags.raw) io.out(bot.instructions ?? '');
  else io.out(formatBotDetail(bot));
  return EXIT_OK;
}

async function showTeam(ref: string, flags: CommandFlags, io: CommandIO): Promise<number> {
  const parsed = parseReference(ref);
  const slug = parsed.kind === 'team' ? parsed.id : ref.trim();
  if (flags.install) {
    const { options } = await io.client.getTeamInstall(slug);
    const option = options.find((o) => matchesPlatform(flags.install!, o.platform, o.platformName));
    if (!option) throw new UsageError(`No install option for "${flags.install}". Platforms: ${options.map((o) => o.platformName).join(', ')}`);
    io.out(flags.json ? JSON.stringify(option, null, 2) : formatInstallOption(option));
    return EXIT_OK;
  }
  const team = await io.client.getTeam(slug);
  if (flags.json) json(io, team);
  else io.out(formatTeamDetail(team));
  return EXIT_OK;
}

export async function runCatalogCommand(command: CatalogCommand, args: string[], flags: CommandFlags, io: CommandIO): Promise<number> {
  const query = args.join(' ').trim();
  switch (command) {
    case 'search':
      if (!query) throw new UsageError('Missing search query. Usage: prompts.chat search <query> [--type skill]');
      return listPrompts(command, query, flags, io);
    case 'prompts':
    case 'skills':
    case 'tastes':
    case 'classifiers':
      return listPrompts(command, query, flags, io);
    case 'bots':
      return listBots(query, flags, io);
    case 'teams':
      return listTeams(query, flags, io);
    case 'show':
      if (!query) throw new UsageError('Missing id or URL. Usage: prompts.chat show <id|url>');
      return showPrompt(args[0], flags, io);
    case 'bot':
      if (!query) throw new UsageError('Missing bot id or URL. Usage: prompts.chat bot <id|url>');
      return showBot(args[0], flags, io);
    case 'team':
      if (!query) throw new UsageError('Missing team slug or URL. Usage: prompts.chat team <slug|url>');
      return showTeam(args[0], flags, io);
  }
}

/** Runs a catalog command and turns errors into a message and exit code instead of a stack trace */
export async function runCatalogCommandSafely(command: CatalogCommand, args: string[], flags: CommandFlags, io: CommandIO): Promise<number> {
  try {
    return await runCatalogCommand(command, args, flags, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`Error: ${error.message}`);
      return EXIT_USAGE;
    }
    if (error instanceof CatalogError) {
      io.err(`Error: ${error.message}`);
      if (error.status === 404 && (command === 'show' || command === 'bot' || command === 'team')) {
        io.err(`Nothing public matches "${args[0]}". Find ids with: prompts.chat search <query>`);
      }
      return EXIT_ERROR;
    }
    io.err(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_ERROR;
  }
}
