import React from 'react';
import { EventEmitter } from 'events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink';
import { startMockServer, type MockServer } from '../../../scripts/mock-server.mjs';

let server: MockServer;
let home: string;
const originalHome = process.env.HOME;

beforeAll(async () => {
  server = await startMockServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'prompts-chat-home-'));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  vi.resetModules();
});

afterEach(() => {
  process.env.HOME = originalHome;
  vi.unstubAllGlobals();
  rmSync(home, { recursive: true, force: true });
});

async function loadApi(baseUrl = server.url) {
  const config = await import('../config');
  config.setBaseUrl(baseUrl);
  return import('../api');
}

describe('loadPrompts', () => {
  it('requests full content so prompt bodies are present', async () => {
    const api = await loadApi();
    const prompts = await api.loadPrompts();
    expect(server.requests.at(-1)).toMatchObject({ path: '/prompts.json', query: { full_content: 'true' } });
    expect(prompts.find((p) => p.id === 'p1')?.content).toBe('Review this ${language:TypeScript} code:\n${code}');
    expect(prompts.every((p) => typeof p.content === 'string')).toBe(true);
  });

  it('falls back to contentPreview when a server omits content (the 0.1.1 crash)', async () => {
    const api = await loadApi();
    const [prompt] = api.normalizePrompts([{ id: 'x', title: 'X', contentPreview: 'preview', tags: undefined }]);
    expect(prompt.content).toBe('preview');
    expect(prompt.tags).toEqual([]);
    expect(api.normalizePrompts(undefined)).toEqual([]);
  });

  it('revalidates the cache with the server ETag', async () => {
    const api = await loadApi();
    const calls: Array<Record<string, string>> = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push(headers);
      if (headers['If-None-Match'] === '"v1"') return new Response(null, { status: 304 });
      return new Response(JSON.stringify({ prompts: [{ id: 'a', title: 'A', content: 'body', author: { username: 'f' }, tags: [] }] }), {
        status: 200,
        headers: { ETag: '"v1"' },
      });
    });
    expect((await api.loadPrompts())[0].content).toBe('body');
    expect(existsSync(api.cacheFile())).toBe(true);

    vi.resetModules();
    const fresh = await loadApi();
    expect((await fresh.loadPrompts())[0].content).toBe('body');
    expect(calls[1]['If-None-Match']).toBe('"v1"');
  });

  it('uses the cache when offline and explains when there is none', async () => {
    const api = await loadApi();
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    await expect(api.loadPrompts()).rejects.toThrow(`Could not load prompts from ${server.url} (fetch failed)`);

    mkdirSync(join(home, '.prompts-chat'), { recursive: true });
    writeFileSync(api.cacheFile(), JSON.stringify({ prompts: [{ id: 'c', title: 'Cached', contentPreview: 'old', author: { username: 'f' } }], fetchedAt: 0 }));
    vi.resetModules();
    const offline = await loadApi();
    expect((await offline.loadPrompts())[0].content).toBe('old');
  });

  it('keeps one versioned cache per instance, ignoring 0.1.x caches', async () => {
    const api = await loadApi();
    const legacy = join(home, '.prompts-chat', 'prompts.json');
    mkdirSync(join(home, '.prompts-chat'), { recursive: true });
    writeFileSync(legacy, JSON.stringify({ prompts: [{ id: 'legacy' }] }));
    expect(api.cacheFile('https://prompts.chat')).not.toBe(api.cacheFile('http://localhost:3000'));
    expect(api.cacheFile()).toMatch(/prompts-v2-[0-9a-f]{10}\.json$/);
    const prompts = await api.loadPrompts();
    expect(prompts.some((p) => p.id === 'legacy')).toBe(false);
    expect(JSON.parse(readFileSync(api.cacheFile(), 'utf-8')).prompts.length).toBeGreaterThan(0);
  });
});

class FakeStdin extends EventEmitter {
  isTTY = true;
  setRawMode() {}
  setEncoding() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read() {
    return null;
  }
}

class FakeStdout extends EventEmitter {
  columns = 100;
  rows = 30;
  frames: string[] = [];
  write(frame: string) {
    this.frames.push(frame);
    return true;
  }
}

describe('PromptDetail', () => {
  it('renders a prompt whose content is missing instead of crashing', async () => {
    const { PromptDetail } = await import('../components/PromptDetail');
    const stdout = new FakeStdout();
    const prompt = {
      id: 'x', title: 'Preview Only Prompt', slug: 'preview-only', description: null,
      content: undefined as unknown as string, type: 'TEXT' as const, mediaUrl: null, voteCount: 0, viewCount: 0,
      author: { username: 'f', name: null, avatar: null, verified: false }, category: null, tags: [],
      createdAt: '', updatedAt: '',
    };
    const instance = render(<PromptDetail prompt={prompt} onBack={() => {}} onCopy={() => {}} />, {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: new FakeStdin() as unknown as NodeJS.ReadStream,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    });
    await new Promise((r) => setTimeout(r, 20));
    instance.unmount();
    expect(stdout.frames.join('')).toContain('Preview Only Prompt');
  });
});
