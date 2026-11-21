import { USER_AGENT } from './config.js';

/** Prompt types the public /api/prompts listing accepts in its `type` filter */
export const PROMPT_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'STRUCTURED', 'SKILL', 'TASTE', 'CLASSIFIER'] as const;
export type PromptType = (typeof PROMPT_TYPES)[number] | 'BOT';

export const SORTS = ['newest', 'oldest', 'upvotes'] as const;
export type Sort = (typeof SORTS)[number];

/** The /api/bots `platform` filter value for each BotPlatform */
export const BOT_PLATFORM_PARAM: Record<string, string> = {
  GROK_BOT: 'grok',
  OPENCLAW: 'openclaw',
  HERMES: 'hermes',
  AUTOGPT: 'autogpt',
  DOTS: 'dots',
  DUET: 'duet',
  MUSE: 'muse',
};

export const BOT_PLATFORM_PARAMS = Object.values(BOT_PLATFORM_PARAM);

/** The /api/prompts list caps perPage at 100 */
export const MAX_PER_PAGE = 100;

export interface Author {
  username: string;
  name?: string | null;
  verified?: boolean;
}

/** List endpoints send the author as a string; detail endpoints send an object */
export type AuthorField = string | { username: string; name?: string | null };

export interface TagRef {
  name: string;
  slug: string;
}

export interface CatalogPrompt {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  content: string;
  type: PromptType;
  mediaUrl?: string | null;
  voteCount?: number;
  isTrending?: boolean;
  classifierSlug?: string | null;
  author: Author;
  category?: { name: string; slug: string } | null;
  tags?: Array<{ tag?: TagRef } & Partial<TagRef>>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PromptPage {
  prompts: CatalogPrompt[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface BotSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  platforms: string[];
  platformNames: string[];
  computerRequirements: string[];
  installUrl: string | null;
  category: { name: string; slug: string } | null;
  tags: TagRef[];
  isTrending: boolean;
  author: AuthorField;
  urls: { page: string; markdown: string; json: string; skill: string };
}

export interface BotInstallOption {
  platform: string;
  installUrl: string | null;
  installPrompt: string;
  command: string | null;
}

export interface BotDetail extends BotSummary {
  instructions: string;
  routines?: Array<{ name: string; type: string; triggerLabel?: string; trigger?: string; prompt?: string }>;
  skills?: Array<{ name?: string; title?: string; url?: string } | string>;
  connectors?: Array<{ name?: string } | string>;
  install?: BotInstallOption[];
  betterTogetherWith?: Array<{ id: string; slug: string; name: string; note?: string | null }>;
}

export interface TeamMember {
  id: string;
  slug?: string;
  name: string;
  role: string;
  description?: string | null;
  link?: string;
}

export interface TeamSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  author: AuthorField;
  category: { name: string; slug: string } | null;
  tags: TagRef[];
  members: TeamMember[];
  handoffCount?: number;
  link: string;
}

export interface TeamDetail extends TeamSummary {
  handoffs: Array<{ from: string; to: string; fromName: string; toName: string; label: string | null }>;
  platforms?: Array<{ platform: string; name: string; botCount: number }>;
}

export interface TeamInstallOption {
  platform: string;
  platformName: string;
  bots: Array<{ id: string; title: string; installUrl: string | null }>;
  skipped: Array<{ id: string; title: string }>;
  installPrompt: string;
  command: string | null;
}

export class CatalogError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface CatalogClientOptions {
  baseUrl: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export interface ListPromptsOptions {
  type?: string;
  q?: string;
  tag?: string;
  sort?: Sort;
  trending?: boolean;
  page?: number;
  perPage?: number;
}

export interface ListBotsOptions {
  q?: string;
  platform?: string;
  category?: string;
  tag?: string;
  sort?: Sort;
  limit?: number;
}

export interface ListTeamsOptions {
  q?: string;
  category?: string;
  tag?: string;
  sort?: Sort;
  page?: number;
  perPage?: number;
}

/** What a user-supplied reference (id, id_slug, slug or URL) points at */
export interface Reference {
  kind: 'prompt' | 'bot' | 'team' | 'classifier' | 'unknown';
  id: string;
}

/**
 * Accepts ids, `id_slug` handles and prompts.chat URLs (prompt, bot, team and classifier pages,
 * including the .md/.json/SKILL.md variants) and says what they point at.
 */
export function parseReference(input: string): Reference {
  const value = input.trim();
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      path = new URL(value).pathname;
    } catch {
      return { kind: 'unknown', id: value };
    }
  }
  const segments = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const [first, second, third] = segments;
  if (first === 'prompts' && second) return { kind: 'prompt', id: stripHandle(second) };
  if (first === 'bots' && second === 'teams' && third) return { kind: 'team', id: third };
  if (first === 'bots' && second && second !== 'teams') return { kind: 'bot', id: stripHandle(second) };
  if (first === 'classifiers' && second && second !== 'chains') return { kind: 'classifier', id: second };
  return { kind: 'unknown', id: stripHandle(segments[segments.length - 1] ?? value) };
}

/** `abc123_some-slug.md` → `abc123`, matching how the site extracts ids from handles */
export function stripHandle(handle: string): string {
  const withoutExt = handle.replace(/(\.SKILL\.md|\.prompt\.md|\.prompt\.yml|\.md|\.json)$/i, '');
  const underscore = withoutExt.indexOf('_');
  return underscore === -1 ? withoutExt : withoutExt.slice(0, underscore);
}

/** Maps user input like "skills" or "json" to an API prompt type; null when it is not one */
export function normalizePromptType(value: string | undefined): PromptType | undefined | null {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  const aliases: Record<string, PromptType> = {
    PROMPT: 'TEXT',
    PROMPTS: 'TEXT',
    SKILLS: 'SKILL',
    TASTES: 'TASTE',
    CLASSIFIERS: 'CLASSIFIER',
    BOTS: 'BOT',
    JSON: 'STRUCTURED',
    YAML: 'STRUCTURED',
  };
  const type = aliases[upper] ?? upper;
  if ((PROMPT_TYPES as readonly string[]).includes(type) || type === 'BOT') return type as PromptType;
  return null;
}

export function tagNames(tags: CatalogPrompt['tags']): string[] {
  return (tags ?? []).map((t) => t.tag?.name ?? t.name ?? '').filter(Boolean);
}

/** fetch() wraps the useful reason (DNS failure, refused connection) in `cause` */
function describeFetchError(error: unknown, timeoutMs: number): string {
  if (!(error instanceof Error)) return String(error);
  if (error.name === 'TimeoutError') return `timed out after ${Math.round(timeoutMs / 1000)}s`;
  const cause = (error as Error & { cause?: unknown }).cause;
  return cause instanceof Error ? cause.message : error.message;
}

export function createCatalogClient(options: CatalogClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 30_000;

  function url(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const u = new URL(baseUrl + path);
    for (const [key, val] of Object.entries(params ?? {})) {
      if (val !== undefined && val !== '' && val !== false) u.searchParams.set(key, String(val));
    }
    return u.toString();
  }

  async function request(target: string, accept: string): Promise<Response> {
    let response: Response;
    try {
      response = await doFetch(target, {
        headers: { Accept: accept, 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason = describeFetchError(error, timeoutMs);
      throw new CatalogError(`Could not reach ${new URL(target).origin} (${reason}). Check your connection or --base-url.`, undefined, target);
    }
    if (!response.ok) {
      let detail = '';
      try {
        const text = await response.text();
        try {
          const body = JSON.parse(text) as { message?: string; error?: string };
          detail = body.message || body.error || '';
        } catch {
          detail = text.length < 200 ? text.trim() : '';
        }
      } catch {
        // Body is optional detail
      }
      const messages: Record<number, string> = {
        403: 'This item is private. The CLI only reads public content.',
        404: 'Not found.',
        429: 'Rate limited by the server. Try again in a moment.',
      };
      const message = messages[response.status] ?? `Request failed with HTTP ${response.status}.`;
      const showDetail = detail && response.status !== 403 && response.status !== 404;
      throw new CatalogError(showDetail ? `${message} ${detail}` : message, response.status, target);
    }
    return response;
  }

  async function json<T>(target: string): Promise<T> {
    const response = await request(target, 'application/json');
    try {
      return (await response.json()) as T;
    } catch {
      throw new CatalogError(`Unexpected non-JSON response from ${target}. Is --base-url a prompts.chat instance?`, response.status, target);
    }
  }

  async function text(target: string): Promise<string> {
    return (await request(target, 'text/markdown, text/plain')).text();
  }

  return {
    baseUrl,

    listPrompts(opts: ListPromptsOptions = {}): Promise<PromptPage> {
      return json<PromptPage>(url('/api/prompts', {
        type: opts.type,
        q: opts.q,
        tag: opts.tag,
        sort: opts.sort,
        trending: opts.trending ? '1' : undefined,
        page: opts.page,
        perPage: opts.perPage,
      }));
    },

    getPrompt(id: string): Promise<CatalogPrompt> {
      return json<CatalogPrompt>(url(`/api/prompts/${encodeURIComponent(id)}`));
    },

    /** Classifier pages are addressed by classifier slug, which the API cannot look up directly */
    async findClassifier(slug: string): Promise<CatalogPrompt | undefined> {
      for (let page = 1; page <= 20; page++) {
        const result = await this.listPrompts({ type: 'CLASSIFIER', page, perPage: MAX_PER_PAGE });
        const match = result.prompts.find((p) => p.classifierSlug === slug || p.slug === slug || p.id === slug);
        if (match) return match;
        if (page >= result.totalPages) break;
      }
      return undefined;
    },

    listBots(opts: ListBotsOptions = {}): Promise<{ total: number; bots: BotSummary[] }> {
      return json(url('/api/bots', {
        q: opts.q,
        platform: opts.platform,
        category: opts.category,
        tag: opts.tag,
        sort: opts.sort,
        limit: opts.limit,
      }));
    },

    getBot(id: string): Promise<BotDetail> {
      return json<BotDetail>(url(`/bots/${encodeURIComponent(id)}.json`));
    },

    getBotMarkdown(id: string, format: 'md' | 'skill'): Promise<string> {
      return text(url(format === 'skill' ? `/bots/${encodeURIComponent(id)}/SKILL.md` : `/bots/${encodeURIComponent(id)}.md`));
    },

    listTeams(opts: ListTeamsOptions = {}): Promise<{ total: number; page: number; perPage: number; totalPages: number; teams: TeamSummary[] }> {
      return json(url('/api/bots/teams', {
        q: opts.q,
        category: opts.category,
        tag: opts.tag,
        sort: opts.sort,
        page: opts.page,
        perPage: opts.perPage,
      }));
    },

    getTeam(slug: string): Promise<TeamDetail> {
      return json<TeamDetail>(url(`/api/bots/teams/${encodeURIComponent(slug)}`));
    },

    getTeamInstall(slug: string): Promise<{ options: TeamInstallOption[] }> {
      return json(url(`/api/bots/teams/${encodeURIComponent(slug)}/install`));
    },
  };
}

export type CatalogClient = ReturnType<typeof createCatalogClient>;
