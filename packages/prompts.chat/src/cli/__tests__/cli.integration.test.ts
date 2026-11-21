import { execFile } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { promisify } from 'util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMockServer, type MockServer } from '../../../scripts/mock-server.mjs';

const execFileAsync = promisify(execFile);
const packageDir = resolve(__dirname, '../../..');
const bin = join(packageDir, 'bin/cli.js');
const { version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8')) as { version: string };

let server: MockServer;
let home: string;

beforeAll(async () => {
  if (!existsSync(join(packageDir, 'dist/cli/index.js'))) {
    throw new Error('dist/ is missing. Run "npm run build" first (npm test does this via pretest).');
  }
  server = await startMockServer();
  home = mkdtempSync(join(tmpdir(), 'prompts-chat-cli-'));
});

afterAll(async () => {
  await server?.close();
  rmSync(home, { recursive: true, force: true });
});

async function cli(args: string[], env: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [bin, ...args], {
      env: { ...process.env, HOME: home, PROMPTS_CHAT_URL: server.url, NO_COLOR: '1', ...env },
      timeout: 20_000,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

describe('built CLI binary', () => {
  it('prints the package version', async () => {
    const { code, stdout } = await cli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(version);
  });

  it('documents every command in --help', async () => {
    const { code, stdout } = await cli(['--help']);
    expect(code).toBe(0);
    for (const command of ['search <query>', 'skills', 'tastes', 'classifiers', 'bots', 'teams', 'show <id|url>', 'bot <id|url>', 'team <slug|url>', 'new <dir>', 'mcp', '--base-url']) {
      expect(stdout).toContain(command);
    }
  });

  it('searches through PROMPTS_CHAT_URL and identifies itself', async () => {
    const { code, stdout } = await cli(['search', 'code']);
    expect(code).toBe(0);
    expect(stdout).toContain('Code Reviewer');
    expect(server.requests.at(-1)?.userAgent).toBe(`prompts.chat-cli/${version} (+https://github.com/f/prompts.chat)`);
  });

  it('lets --base-url override PROMPTS_CHAT_URL', async () => {
    const { code, stderr } = await cli(['teams', '--base-url', server.url], { PROMPTS_CHAT_URL: 'http://127.0.0.1:9' });
    expect(code).toBe(0);
    expect(stderr).not.toContain('Could not reach');
  });

  it('pipes raw prompt content', async () => {
    const { stdout } = await cli(['show', 'p1', '--raw']);
    expect(stdout).toBe('Review this ${language:TypeScript} code:\n${code}\n');
  });

  it('emits parseable JSON', async () => {
    const { stdout } = await cli(['team', 'lean-software-factory', '--json']);
    expect(JSON.parse(stdout).slug).toBe('lean-software-factory');
  });

  it('prints install prompts for bots and teams', async () => {
    expect((await cli(['bot', 'b1', '--install', 'hermes'])).stdout).toContain('hermes skills install');
    expect((await cli(['team', 'lean-software-factory', '--install', 'grok'])).stdout).toContain('Lean Software Factory');
  });

  it('fails with a message, not a stack trace, for errors', async () => {
    const missing = await cli(['show', 'nope']);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('Error: Not found.');
    expect(missing.stderr).not.toMatch(/\n\s+at /);

    const offline = await cli(['search', 'x'], { PROMPTS_CHAT_URL: 'http://127.0.0.1:9' });
    expect(offline.code).toBe(1);
    expect(offline.stderr).toMatch(/Could not reach http:\/\/127\.0\.0\.1:9/);

    const badUrl = await cli(['search', 'x', '--base-url', 'ftp://x']);
    expect(badUrl.code).toBe(2);
    expect(badUrl.stderr).toContain('Only http and https');
  });

  it('rejects unknown commands instead of opening the TUI', async () => {
    const { code, stderr } = await cli(['serach', 'x']);
    expect(code).toBe(2);
    expect(stderr).toContain('unknown command "serach"');
  });

  it('explains that the TUI needs a terminal when stdin is not a TTY', async () => {
    const { code, stderr } = await cli([]);
    expect(code).toBe(2);
    expect(stderr).toContain('The interactive browser needs a terminal (TTY).');
    expect(stderr).not.toContain('Raw mode is not supported');
  });

  it('asks for a directory for "new" without cloning anything', async () => {
    const { code, stderr } = await cli(['new']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage: npx prompts.chat new <directory>');
  });
});
