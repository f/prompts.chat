import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCatalogClient } from '../catalog';
import { EXIT_ERROR, EXIT_OK, EXIT_USAGE, isCatalogCommand, runCatalogCommandSafely, type CatalogCommand, type CommandFlags } from '../commands';
import { startMockServer, type MockServer } from '../../../scripts/mock-server.mjs';

let server: MockServer;

beforeAll(async () => {
  server = await startMockServer();
});

afterAll(async () => {
  await server.close();
});

async function run(command: CatalogCommand, args: string[] = [], flags: CommandFlags = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCatalogCommandSafely(command, args, flags, {
    client: createCatalogClient({ baseUrl: server.url }),
    out: (t) => out.push(t),
    err: (t) => err.push(t),
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

describe('isCatalogCommand', () => {
  it('knows the catalog commands and leaves new/mcp to the entrypoint', () => {
    expect(isCatalogCommand('search')).toBe(true);
    expect(isCatalogCommand('teams')).toBe(true);
    expect(isCatalogCommand('new')).toBe(false);
    expect(isCatalogCommand('mcp')).toBe(false);
    expect(isCatalogCommand(undefined)).toBe(false);
  });
});

describe('search and listings', () => {
  it('searches prompts and prints ids to show', async () => {
    const { code, stdout, stderr } = await run('search', ['code']);
    expect(code).toBe(EXIT_OK);
    expect(stdout).toContain('1. Code Reviewer  @f  ▲12  trending');
    expect(stdout).toContain('id: p1_code-reviewer');
    expect(stderr).toContain('prompts.chat show <id>');
  });

  it('requires a query for search', async () => {
    const { code, stderr } = await run('search');
    expect(code).toBe(EXIT_USAGE);
    expect(stderr).toMatch(/Missing search query/);
  });

  it('filters by --type', async () => {
    const { stdout } = await run('search', ['analyze'], { type: 'skill' });
    expect(stdout).toContain('Postgres EXPLAIN Analyzer [skill]');
    expect(server.requests.at(-1)?.query).toMatchObject({ type: 'SKILL', q: 'analyze' });
  });

  it('rejects unknown types, sorts, platforms and page numbers as usage errors', async () => {
    expect((await run('search', ['x'], { type: 'workflow' })).code).toBe(EXIT_USAGE);
    expect((await run('prompts', [], { sort: 'random' })).code).toBe(EXIT_USAGE);
    expect((await run('bots', [], { platform: 'skynet' })).code).toBe(EXIT_USAGE);
    expect((await run('prompts', [], { page: Number.NaN })).code).toBe(EXIT_USAGE);
    expect((await run('prompts', [], { limit: 0 })).code).toBe(EXIT_USAGE);
  });

  it('lists skills, tastes and classifiers with their type preset', async () => {
    expect((await run('skills')).stdout).toContain('Postgres EXPLAIN Analyzer');
    expect(server.requests.at(-1)?.query.type).toBe('SKILL');
    expect((await run('tastes')).stdout).toContain('Next.js App taste [taste]');
    const classifiers = await run('classifiers');
    expect(classifiers.stdout).toContain('Account takeover signal [classifier]');
    expect(classifiers.stdout).toContain('id: classifier-account-takeover-signal\n');
  });

  it('caps --limit at the API maximum', async () => {
    await run('prompts', [], { limit: 500 });
    expect(server.requests.at(-1)?.query.perPage).toBe('100');
  });

  it('routes --type bot to the bots listing', async () => {
    const { stdout } = await run('search', ['rate'], { type: 'bot' });
    expect(stdout).toContain('API Rate Limit Budgeter  @f');
    expect(server.requests.at(-1)?.path).toBe('/api/bots');
  });

  it('lists bots with platform filter and teams', async () => {
    const bots = await run('bots', [], { platform: 'Hermes Agent' });
    expect(bots.stdout).toContain('platforms: Grok Bot, Hermes Agent');
    expect(server.requests.at(-1)?.query.platform).toBe('hermes');

    const teams = await run('teams');
    expect(teams.stdout).toContain('1. Lean Software Factory  by Fatih Kadir Akın');
    expect(teams.stdout).toContain('members: Product Owner, Quality Reviewer');
  });

  it('says so when nothing matches', async () => {
    const { code, stdout, stderr } = await run('search', ['zzzz-nothing']);
    expect(code).toBe(EXIT_OK);
    expect(stdout).toBe('');
    expect(stderr).toBe('No results for "zzzz-nothing".');
  });

  it('passes the API response through with --json', async () => {
    const { stdout } = await run('skills', [], { json: true });
    const body = JSON.parse(stdout);
    expect(body).toMatchObject({ total: 1, page: 1, totalPages: 1 });
    expect(body.prompts[0].content).toContain('Analyze plans.');
  });
});

describe('show', () => {
  it('shows a prompt with metadata and full content', async () => {
    const { code, stdout } = await run('show', ['p1_code-reviewer']);
    expect(code).toBe(EXIT_OK);
    expect(stdout).toContain('Code Reviewer\nby @f · type: text · ▲12 · category: Coding');
    expect(stdout).toContain(`url: ${server.url}/prompts/p1_code-reviewer`);
    expect(stdout).toContain('Review this ${language:TypeScript} code:\n${code}');
  });

  it('prints only the content with --raw', async () => {
    const { stdout } = await run('show', [`${server.url}/prompts/p2_postgres`], { raw: true });
    expect(stdout).toBe('---\nname: postgres-explain-analyzer\n---\nAnalyze plans.');
  });

  it('links the skill download for skills', async () => {
    expect((await run('show', ['p2'])).stdout).toContain(`skill file: ${server.url}/api/prompts/p2/skill`);
  });

  it('resolves classifier page URLs by classifier slug', async () => {
    const { stdout } = await run('show', [`${server.url}/classifiers/account-takeover-signal`]);
    expect(stdout).toContain('Account takeover signal');
    expect(stdout).toContain(`url: ${server.url}/classifiers/account-takeover-signal`);
  });

  it('routes bot and team URLs to their commands', async () => {
    expect((await run('show', [`${server.url}/bots/b1_rate-limit-budgeter`])).stdout).toContain('## Instructions');
    expect((await run('show', [`${server.url}/bots/teams/lean-software-factory`])).stdout).toContain('## Members');
  });

  it('refuses private prompts without exposing them', async () => {
    const { code, stdout, stderr } = await run('show', ['secret1']);
    expect(code).toBe(EXIT_ERROR);
    expect(stdout).toBe('');
    expect(stderr).toContain('This item is private. The CLI only reads public content.');
  });

  it('explains missing items', async () => {
    const { code, stderr } = await run('show', ['nope']);
    expect(code).toBe(EXIT_ERROR);
    expect(stderr).toBe('Error: Not found.\nNothing public matches "nope". Find ids with: prompts.chat search <query>');
  });
});

describe('bot', () => {
  it('shows instructions, routines and install commands', async () => {
    const { stdout } = await run('bot', ['b1_rate-limit-budgeter']);
    expect(stdout).toContain('API Rate Limit Budgeter\nby @f · platforms: Grok Bot, Hermes Agent');
    expect(stdout).toContain('## Instructions\n\nYou help plan API budgets.');
    expect(stdout).toContain('- Weekly check (Mondays at 11:00)');
    expect(stdout).toContain('- GitHub');
    expect(stdout).toContain('- Grok Bot: prompts.chat bot b1_rate-limit-budgeter --install grok');
    expect(stdout).toContain(`  or run: hermes skills install ${server.url}/bots/b1_rate-limit-budgeter/SKILL.md`);
  });

  it('prints a platform install prompt', async () => {
    const { stdout } = await run('bot', ['b1'], { install: 'hermes' });
    expect(stdout).toBe(`Create the bot on Hermes Agent.\n\nOr run:\n\nhermes skills install ${server.url}/bots/b1_rate-limit-budgeter/SKILL.md`);
    expect((await run('bot', ['b1'], { install: 'GROK_BOT' })).stdout).toContain('create the bot on Grok Bot');
  });

  it('rejects platforms the bot does not support', async () => {
    const { code, stderr } = await run('bot', ['b1'], { install: 'muse' });
    expect(code).toBe(EXIT_USAGE);
    expect(stderr).toContain('Platforms: Grok Bot, Hermes Agent');
  });

  it('prints SKILL.md and markdown files', async () => {
    expect((await run('bot', ['b1'], { skill: true })).stdout).toContain('name: rate-limit-budgeter');
    expect((await run('bot', ['b1'], { markdown: true })).stdout).toContain('# API Rate Limit Budgeter');
  });
});

describe('team', () => {
  it('shows members, handoffs and platforms', async () => {
    const { stdout } = await run('team', ['lean-software-factory']);
    expect(stdout).toContain('Lean Software Factory\nby Fatih Kadir Akın');
    expect(stdout).toContain('platforms: Grok Bot, Hermes Agent');
    expect(stdout).toContain('- Product Owner → Quality Reviewer: PR ready');
    expect(stdout).toContain('Install prompt: prompts.chat team lean-software-factory --install <grok|hermes>');
  });

  it('prints a team install prompt by platform name', async () => {
    const { stdout } = await run('team', [`${server.url}/bots/teams/lean-software-factory`], { install: 'grok' });
    expect(stdout).toBe('Set up the "Lean Software Factory" team on Grok Bot.');
  });

  it('explains unknown teams', async () => {
    const { code, stderr } = await run('team', ['missing']);
    expect(code).toBe(EXIT_ERROR);
    expect(stderr).toContain('Nothing public matches "missing"');
  });
});
