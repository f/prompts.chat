#!/usr/bin/env node
// Packs the package, installs the tarball into a throwaway project with its own HOME and npm
// cache, and runs it the way users do: both bin names, the `npx prompts.chat` equivalent, the
// library entry points and the TUI in a pseudo-terminal.
//
//   npm run test:pack                       current Node
//   SMOKE_NODE_BINARIES=/a/node:/b/node npm run test:pack
//   npm run test:pack -- --live             also read from https://prompts.chat
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const { name, version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8'));
const live = process.argv.includes('--live');
const keep = process.argv.includes('--keep');
const nodes = (process.env.SMOKE_NODE_BINARIES || process.execPath).split(delimiter).filter(Boolean);

const root = mkdtempSync(join(tmpdir(), 'prompts-chat-pack-'));
const home = join(root, 'home');
const project = join(root, 'project');
const npxDir = join(root, 'npx');
for (const dir of [home, project, npxDir]) mkdirSync(dir, { recursive: true });
writeFileSync(join(root, 'npmrc'), '');

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n     ${String(detail).trim().split('\n').join('\n     ')}` : ''}`);
  if (!ok) failures++;
}

function envFor(node, extra = {}) {
  return {
    ...process.env,
    PATH: `${dirname(node)}${delimiter}${process.env.PATH}`,
    HOME: home,
    USERPROFILE: home,
    npm_config_cache: join(root, 'cache'),
    npm_config_userconfig: join(root, 'npmrc'),
    npm_config_update_notifier: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    NO_COLOR: '1',
    ...extra,
  };
}

function run(cmd, args, options) {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', timeout: 180_000, ...options });
  return { code: result.status, stdout: result.stdout ?? '', stderr: (result.stderr ?? '') + (result.error ? String(result.error) : '') };
}

/** Runs the TUI in a 120x40 pseudo-terminal: open the first prompt, then quit */
function runTui(node, mockUrl) {
  return new Promise((resolve) => {
    const child = spawn('python3', [join(packageDir, 'scripts/pty-run.py'), '120', '40', join(project, 'node_modules/.bin/prompts.chat')], {
      cwd: project,
      env: { ...envFor(node, { PROMPTS_CHAT_URL: mockUrl }), TERM: 'xterm-256color' },
    });
    let output = '';
    // Keys are sent once the screen they act on has rendered; fixed delays race on slow CI runners
    const steps = [
      { waitFor: 'Code Reviewer', key: '\r' },
      { waitFor: 'Review this', key: 'q' },
    ];
    const onData = (d) => {
      output += d;
      const step = steps[0];
      if (step && output.includes(step.waitFor)) {
        steps.shift();
        setTimeout(() => child.stdin.write(step.key), 300);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const kill = setTimeout(() => child.kill('SIGKILL'), 30_000);
    child.on('close', (code) => {
      clearTimeout(kill);
      resolve({ code, output });
    });
  });
}

/** In a child process: this script blocks its own event loop in spawnSync while the CLI runs */
function startMockServerProcess() {
  const moduleUrl = new URL('./mock-server.mjs', import.meta.url).href;
  const child = spawn(process.execPath, ['--input-type=module', '-e',
    `const { startMockServer } = await import(${JSON.stringify(moduleUrl)}); const s = await startMockServer(); console.log(s.url);`]);
  return new Promise((resolve, reject) => {
    child.stdout.once('data', (d) => resolve({ url: d.toString().trim(), close: async () => child.kill() }));
    child.once('exit', (code) => reject(new Error(`mock server exited with ${code}`)));
  });
}

const server = await startMockServerProcess();
try {
  console.log(`# ${name}@${version}, temp dir ${root}`);
  execFileSync('npm', ['run', 'build'], { cwd: packageDir, stdio: ['ignore', 'ignore', 'inherit'] });
  // prepack would rebuild and print to stdout, which would corrupt --json
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', root], {
    cwd: packageDir,
    encoding: 'utf-8',
    env: { ...process.env, npm_config_update_notifier: 'false' },
    stdio: ['ignore', 'pipe', 'inherit'],
  }))[0];
  const tarball = join(root, packed.filename);
  const files = packed.files.map((f) => f.path);
  check('tarball has bin, CLI bundle, ESM+CJS entries and docs',
    ['bin/cli.js', 'dist/cli/index.js', 'dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/variables/index.cjs', 'README.md', 'CHANGELOG.md', 'package.json'].every((f) => files.includes(f)),
    files.join(', '));
  check('tarball leaves out sources, tests and scripts', !files.some((f) => /^(src|scripts)\//.test(f) || f.includes('__tests__')), files.join(', '));

  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'smoke', version: '1.0.0', private: true }));
  const install = run('npm', ['install', tarball], { cwd: project, env: envFor(process.execPath) });
  check('npm install <tarball> into an empty project', install.code === 0, install.stderr);

  for (const node of nodes) {
    const nodeVersion = execFileSync(node, ['--version'], { encoding: 'utf-8' }).trim();
    console.log(`\n# node ${nodeVersion}`);
    const env = envFor(node, { PROMPTS_CHAT_URL: server.url });
    const bin = (binName, args) => run(join(project, 'node_modules/.bin', binName), args, { cwd: project, env });

    for (const binName of ['prompts.chat', 'prompts-chat']) {
      const r = bin(binName, ['--version']);
      check(`${binName} --version prints ${version}`, r.code === 0 && r.stdout.trim() === version, r.stdout + r.stderr);
    }
    const help = bin('prompts.chat', ['--help']);
    check('--help lists the catalog commands', help.code === 0 && ['search <query>', 'skills', 'bots', 'teams', 'classifiers'].every((c) => help.stdout.includes(c)), help.stderr);

    const search = bin('prompts.chat', ['search', 'code']);
    check('search against a mock instance', search.code === 0 && search.stdout.includes('Code Reviewer'), search.stdout + search.stderr);
    const raw = bin('prompts.chat', ['show', 'p2', '--raw']);
    check('show --raw prints the skill body', raw.code === 0 && raw.stdout.includes('Analyze plans.'), raw.stdout + raw.stderr);
    const team = bin('prompts.chat', ['team', 'lean-software-factory', '--install', 'hermes']);
    check('team --install prints the install prompt', team.code === 0 && team.stdout.includes('hermes skills install'), team.stdout + team.stderr);

    const noTty = run(join(project, 'node_modules/.bin/prompts.chat'), [], { cwd: project, env, input: '' });
    check('TUI without a TTY exits 2 with guidance', noTty.code === 2 && noTty.stderr.includes('needs a terminal'), noTty.stderr);

    const esm = run(node, ['--input-type=module', '-e', "const m = await import('prompts.chat'); const v = await import('prompts.chat/variables'); if (typeof m.builder !== 'function' || typeof v.compile !== 'function') process.exit(1);"], { cwd: project, env });
    check("ESM import('prompts.chat') and subpath", esm.code === 0, esm.stderr);
    const cjs = run(node, ['-e', "const m = require('prompts.chat'); const v = require('prompts.chat/variables'); if (typeof m.builder !== 'function' || typeof v.compile !== 'function') process.exit(1);"], { cwd: project, env });
    check("CJS require('prompts.chat') and subpath", cjs.code === 0, cjs.stderr);

    const npx = run('npx', ['--yes', `--package=${tarball}`, 'prompts.chat', '--version'], { cwd: npxDir, env });
    check('npx --package=<tarball> prompts.chat --version (how `npx prompts.chat` resolves)', npx.code === 0 && npx.stdout.trim() === version, npx.stdout + npx.stderr);
    const npxSearch = run('npx', ['--yes', `--package=${tarball}`, 'prompts.chat', 'skills'], { cwd: npxDir, env });
    check('npx --package=<tarball> prompts.chat skills', npxSearch.code === 0 && npxSearch.stdout.includes('Postgres EXPLAIN Analyzer'), npxSearch.stdout + npxSearch.stderr);

    if (process.platform !== 'win32' && run('python3', ['--version']).code === 0) {
      const tui = await runTui(node, server.url);
      // eslint-disable-next-line no-control-regex
      const text = tui.output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');
      const listed = text.includes('Code Reviewer');
      const opened = text.includes('Review this');
      const crashed = /TypeError|Error:/.test(text);
      check('TUI in a pseudo-terminal lists prompts and opens one', listed && opened && !crashed,
        `listed=${listed} opened=${opened} crashed=${crashed} exit=${tui.code}\n${text.split('\n').filter((l) => l.trim()).slice(-25).join('\n')}`);
    }

    if (live) {
      const liveEnv = envFor(node, { PROMPTS_CHAT_URL: 'https://prompts.chat' });
      const skills = run(join(project, 'node_modules/.bin/prompts.chat'), ['skills', '--limit', '2'], { cwd: project, env: liveEnv });
      check('live: skills from prompts.chat', skills.code === 0 && skills.stdout.includes('[skill]'), skills.stdout + skills.stderr);
      const teams = run(join(project, 'node_modules/.bin/prompts.chat'), ['teams', '--limit', '1', '--json'], { cwd: project, env: liveEnv });
      let teamsOk = false;
      try {
        teamsOk = JSON.parse(teams.stdout).teams.length === 1;
      } catch {
        // reported below
      }
      check('live: teams --json from prompts.chat', teams.code === 0 && teamsOk, teams.stdout + teams.stderr);
    }
  }
} finally {
  await server.close();
  if (!keep) rmSync(root, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll pack smoke checks passed');
process.exit(failures ? 1 : 0);
