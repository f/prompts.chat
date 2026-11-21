import { describe, it, expect, vi } from 'vitest';
import {
  CatalogError,
  createCatalogClient,
  normalizePromptType,
  parseReference,
  stripHandle,
  type FetchLike,
} from '../catalog';
import { DEFAULT_BASE_URL, resolveBaseUrl } from '../config';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('parseReference', () => {
  it('reads ids and id_slug handles', () => {
    expect(parseReference('cmw4o8kqi000bl907icyyseeq')).toEqual({ kind: 'unknown', id: 'cmw4o8kqi000bl907icyyseeq' });
    expect(parseReference('cmw4o8kqi000bl907icyyseeq_postgres-explain')).toEqual({ kind: 'unknown', id: 'cmw4o8kqi000bl907icyyseeq' });
  });

  it('reads prompt, bot, team and classifier URLs', () => {
    expect(parseReference('https://prompts.chat/prompts/abc_slug')).toEqual({ kind: 'prompt', id: 'abc' });
    expect(parseReference('https://prompts.chat/bots/b1_rate-limit')).toEqual({ kind: 'bot', id: 'b1' });
    expect(parseReference('https://prompts.chat/bots/b1_rate-limit.json')).toEqual({ kind: 'bot', id: 'b1' });
    expect(parseReference('https://prompts.chat/bots/b1_rate-limit/SKILL.md')).toEqual({ kind: 'bot', id: 'b1' });
    expect(parseReference('https://prompts.chat/bots/teams/lean-software-factory')).toEqual({ kind: 'team', id: 'lean-software-factory' });
    expect(parseReference('https://prompts.chat/classifiers/account-takeover-signal')).toEqual({ kind: 'classifier', id: 'account-takeover-signal' });
    expect(parseReference('http://localhost:3000/prompts/xyz')).toEqual({ kind: 'prompt', id: 'xyz' });
  });

  it('does not treat chain pages as classifiers', () => {
    expect(parseReference('https://prompts.chat/classifiers/chains/support-triage').kind).toBe('unknown');
  });
});

describe('stripHandle', () => {
  it('drops slugs and file extensions like the site does', () => {
    expect(stripHandle('abc_slug.prompt.md')).toBe('abc');
    expect(stripHandle('abc.SKILL.md')).toBe('abc');
    expect(stripHandle('abc.json')).toBe('abc');
    expect(stripHandle('classifier-account-takeover-signal')).toBe('classifier-account-takeover-signal');
  });
});

describe('normalizePromptType', () => {
  it('accepts lowercase, plurals and aliases', () => {
    expect(normalizePromptType('skill')).toBe('SKILL');
    expect(normalizePromptType('skills')).toBe('SKILL');
    expect(normalizePromptType('Classifiers')).toBe('CLASSIFIER');
    expect(normalizePromptType('json')).toBe('STRUCTURED');
    expect(normalizePromptType('prompt')).toBe('TEXT');
    expect(normalizePromptType('bot')).toBe('BOT');
    expect(normalizePromptType(undefined)).toBeUndefined();
  });

  it('returns null for unknown types', () => {
    expect(normalizePromptType('workflow')).toBeNull();
  });
});

describe('resolveBaseUrl', () => {
  it('defaults to prompts.chat', () => {
    expect(resolveBaseUrl(undefined, {})).toBe(DEFAULT_BASE_URL);
  });

  it('prefers the flag over PROMPTS_CHAT_URL and trims trailing slashes', () => {
    expect(resolveBaseUrl(undefined, { PROMPTS_CHAT_URL: 'https://prompts.example.com/' })).toBe('https://prompts.example.com');
    expect(resolveBaseUrl('http://localhost:3000///', { PROMPTS_CHAT_URL: 'https://x.test' })).toBe('http://localhost:3000');
    expect(resolveBaseUrl('https://example.com/prompts/', {})).toBe('https://example.com/prompts');
  });

  it('rejects invalid and non-http URLs', () => {
    expect(() => resolveBaseUrl('not a url', {})).toThrow(/Invalid base URL/);
    expect(() => resolveBaseUrl('file:///etc/passwd', {})).toThrow(/Only http and https/);
  });
});

describe('createCatalogClient', () => {
  it('builds list URLs with only the given filters and identifies itself', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ prompts: [], total: 0, page: 2, perPage: 5, totalPages: 0 }));
    const client = createCatalogClient({ baseUrl: 'https://prompts.chat/', fetch });
    await client.listPrompts({ type: 'SKILL', q: 'sql review', page: 2, perPage: 5, trending: true, sort: 'upvotes' });

    const [url, init] = fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://prompts.chat/api/prompts');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ type: 'SKILL', q: 'sql review', page: '2', perPage: '5', trending: '1', sort: 'upvotes' });
    expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/^prompts\.chat-cli\//);
  });

  it('never sends credentials', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ total: 0, bots: [] }));
    await createCatalogClient({ baseUrl: 'https://prompts.chat', fetch }).listBots({ platform: 'hermes' });
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('authorization');
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('cookie');
  });

  it('uses the public bot file and team endpoints', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({}));
    const client = createCatalogClient({ baseUrl: 'https://prompts.chat', fetch });
    await client.getBot('b1');
    await client.getTeam('lean-software-factory');
    await client.getTeamInstall('lean-software-factory');
    fetch.mockImplementationOnce(async () => new Response('---\nname: x\n---'));
    await client.getBotMarkdown('b1', 'skill');
    expect(fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/bots/b1.json',
      '/api/bots/teams/lean-software-factory',
      '/api/bots/teams/lean-software-factory/install',
      '/bots/b1/SKILL.md',
    ]);
  });

  it('turns 403 into a private-content error without leaking server detail', async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ error: 'forbidden', message: 'This prompt is private' }, 403));
    const error = await createCatalogClient({ baseUrl: 'https://prompts.chat', fetch }).getPrompt('x').catch((e) => e);
    expect(error).toBeInstanceOf(CatalogError);
    expect(error.status).toBe(403);
    expect(error.message).toMatch(/private/);
  });

  it('reports 404, 429 and 5xx clearly', async () => {
    const statuses = [404, 429, 500];
    for (const status of statuses) {
      const fetch = vi.fn<FetchLike>(async () => jsonResponse({ error: 'x' }, status));
      const error = await createCatalogClient({ baseUrl: 'https://prompts.chat', fetch }).getPrompt('x').catch((e) => e);
      expect(error.status).toBe(status);
    }
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ error: 'server_error', message: 'Something went wrong' }, 500));
    const error = await createCatalogClient({ baseUrl: 'https://prompts.chat', fetch }).getPrompt('x').catch((e) => e);
    expect(error.message).toBe('Request failed with HTTP 500. Something went wrong');
  });

  it('explains network failures and timeouts', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), { cause: new Error('connect ECONNREFUSED 127.0.0.1:9') });
    const fetch = vi.fn<FetchLike>(async () => {
      throw refused;
    });
    const error = await createCatalogClient({ baseUrl: 'http://127.0.0.1:9', fetch }).listTeams().catch((e) => e);
    expect(error.message).toBe('Could not reach http://127.0.0.1:9 (connect ECONNREFUSED 127.0.0.1:9). Check your connection or --base-url.');

    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    const slow = vi.fn<FetchLike>(async () => {
      throw timeout;
    });
    const timedOut = await createCatalogClient({ baseUrl: 'https://prompts.chat', fetch: slow, timeoutMs: 5000 }).listTeams().catch((e) => e);
    expect(timedOut.message).toMatch(/timed out after 5s/);
  });

  it('explains non-JSON responses (wrong --base-url)', async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response('<html></html>', { status: 200 }));
    const error = await createCatalogClient({ baseUrl: 'https://example.com', fetch }).listPrompts().catch((e) => e);
    expect(error.message).toMatch(/non-JSON.*--base-url/);
  });

  it('finds classifiers by classifier slug across pages', async () => {
    const pages = [
      { prompts: [{ id: 'a', slug: 'a', classifierSlug: 'other' }], total: 2, page: 1, perPage: 1, totalPages: 2 },
      { prompts: [{ id: 'b', slug: 'b', classifierSlug: 'account-takeover-signal' }], total: 2, page: 2, perPage: 1, totalPages: 2 },
    ];
    const fetch = vi.fn<FetchLike>(async (url) => jsonResponse(pages[Number(new URL(url).searchParams.get('page')) - 1]));
    const client = createCatalogClient({ baseUrl: 'https://prompts.chat', fetch });
    expect((await client.findClassifier('account-takeover-signal'))?.id).toBe('b');
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('type')).toBe('CLASSIFIER');

    fetch.mockClear();
    expect(await client.findClassifier('missing')).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
