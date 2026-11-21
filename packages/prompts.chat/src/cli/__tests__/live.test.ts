import { describe, expect, it } from 'vitest';
import { createCatalogClient } from '../catalog';

/**
 * Read-only requests against the public prompts.chat API, to catch contract drift like the
 * prompts.json change that broke 0.1.1. Opt in with `npm run test:live` (PROMPTS_CHAT_LIVE=1);
 * PROMPTS_CHAT_URL points it at another instance.
 */
const live = process.env.PROMPTS_CHAT_LIVE === '1';
const client = createCatalogClient({ baseUrl: process.env.PROMPTS_CHAT_URL || 'https://prompts.chat', timeoutMs: 60_000 });

describe.skipIf(!live)('live public API contract', () => {
  it('prompts.json?full_content=true includes content for the TUI', async () => {
    const response = await fetch(`${client.baseUrl}/prompts.json?full_content=true&limit=3`);
    expect(response.ok).toBe(true);
    const body = (await response.json()) as { prompts: Array<{ content?: unknown }> };
    expect(body.prompts.length).toBeGreaterThan(0);
    for (const prompt of body.prompts) expect(typeof prompt.content).toBe('string');
  }, 60_000);

  it.each(['SKILL', 'TASTE', 'CLASSIFIER'])('lists %s prompts with content', async (type) => {
    const page = await client.listPrompts({ type, perPage: 2 });
    expect(page.total).toBeGreaterThan(0);
    expect(page.prompts[0].type).toBe(type);
    expect(typeof page.prompts[0].content).toBe('string');
  }, 60_000);

  it('searches and fetches a prompt by id', async () => {
    const page = await client.listPrompts({ q: 'code', perPage: 1 });
    const prompt = await client.getPrompt(page.prompts[0].id);
    expect(prompt.id).toBe(page.prompts[0].id);
    expect(typeof prompt.content).toBe('string');
  }, 60_000);

  it('lists bots and reads a bot file and SKILL.md', async () => {
    const { bots, total } = await client.listBots({ limit: 1 });
    expect(total).toBeGreaterThan(0);
    const bot = await client.getBot(bots[0].id);
    expect(typeof bot.instructions).toBe('string');
    expect(Array.isArray(bot.install)).toBe(true);
    expect(await client.getBotMarkdown(bots[0].id, 'skill')).toMatch(/^---\nname: /);
  }, 60_000);

  it('lists teams and reads one with install options', async () => {
    const { teams } = await client.listTeams({ perPage: 1 });
    const team = await client.getTeam(teams[0].slug);
    expect(team.members.length).toBeGreaterThan(0);
    const { options } = await client.getTeamInstall(teams[0].slug);
    expect(options[0].installPrompt.length).toBeGreaterThan(0);
  }, 60_000);
});
