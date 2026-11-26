// A local stand-in for the public prompts.chat read API, shaped like the real responses.
// Used by the CLI integration tests and the packed-tarball smoke test.
import { createServer } from 'node:http';

const author = { id: 'u1', username: 'f', name: 'Fatih Kadir Akın', avatar: null, verified: true };

export const fixtures = {
  prompts: [
    {
      id: 'p1', title: 'Code Reviewer', slug: 'code-reviewer', description: 'Reviews code for bugs',
      content: 'Review this ${language:TypeScript} code:\n${code}', type: 'TEXT', mediaUrl: null,
      voteCount: 12, isTrending: true, classifierSlug: null, author,
      category: { id: 'c1', name: 'Coding', slug: 'coding' },
      tags: [{ tag: { id: 't1', name: 'Code', slug: 'code' } }],
    },
    {
      id: 'p2', title: 'Postgres EXPLAIN Analyzer', slug: 'postgres-explain-analyzer', description: 'Finds slow query causes',
      content: '---\nname: postgres-explain-analyzer\n---\nAnalyze plans.', type: 'SKILL', mediaUrl: null,
      voteCount: 3, isTrending: false, classifierSlug: null, author, category: null, tags: [],
    },
    {
      id: 'p3', title: 'Next.js App taste', slug: 'nextjs-app-taste', description: 'Style guide',
      content: 'Prefer server components.', type: 'TASTE', mediaUrl: null,
      voteCount: 0, isTrending: false, classifierSlug: null, author, category: null, tags: [],
    },
    {
      id: 'classifier-account-takeover-signal', title: 'Account takeover signal', slug: 'account-takeover-signal',
      description: 'Flags account takeover messages', content: 'Classify: ${text}', type: 'CLASSIFIER', mediaUrl: null,
      voteCount: 1, isTrending: false, classifierSlug: 'account-takeover-signal', author, category: null, tags: [],
    },
  ],
  privatePromptId: 'secret1',
  bot: {
    id: 'b1', slug: 'rate-limit-budgeter', name: 'API Rate Limit Budgeter', description: 'Plans API call budgets',
    platforms: ['GROK_BOT', 'HERMES'], platformNames: ['Grok Bot', 'Hermes Agent'], icon: 'wrench', color: 'emerald',
    computerRequirements: [], installUrl: null,
    category: { name: 'DevOps', slug: 'devops', parent: { name: 'Coding', slug: 'coding' } },
    tags: [{ name: 'API', slug: 'api' }], isTrending: false, trendingUntil: null,
  },
  team: {
    id: 'tm1', slug: 'lean-software-factory', title: 'Lean Software Factory', description: 'A five-role software team',
    isFeatured: false, isUnlisted: false, category: null, tags: [{ name: 'Software', slug: 'software' }],
    members: [
      { id: 'b2', slug: 'product-owner', name: 'Product Owner', role: 'Product Owner', description: 'Files issues', computerRequirements: [] },
      { id: 'b3', slug: 'reviewer', name: 'Quality Reviewer', role: 'Quality Reviewer', description: 'Gates merges', computerRequirements: [] },
    ],
  },
};

function botUrls(base, bot) {
  const h = `${bot.id}_${bot.slug}`;
  return { page: `${base}/bots/${h}`, markdown: `${base}/bots/${h}.md`, json: `${base}/bots/${h}.json`, skill: `${base}/bots/${h}/SKILL.md` };
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function paginate(items, url, maxPer = 100) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const perPage = Math.min(maxPer, Math.max(1, Number(url.searchParams.get('perPage')) || 24));
  return { page, perPage, total: items.length, totalPages: Math.ceil(items.length / perPage), slice: items.slice((page - 1) * perPage, page * perPage) };
}

/** Starts the mock server on a random port; resolves to { url, requests, close } */
export function startMockServer() {
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const base = `http://${req.headers.host}`;
    requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), userAgent: req.headers['user-agent'] });
    const path = url.pathname;

    if (path === '/api/prompts') {
      const type = url.searchParams.get('type');
      const q = (url.searchParams.get('q') || '').toLowerCase();
      let items = fixtures.prompts.filter((p) => (type ? p.type === type : p.type !== 'CLASSIFIER'));
      if (q) items = items.filter((p) => `${p.title} ${p.description} ${p.content}`.toLowerCase().includes(q));
      const { page, perPage, total, totalPages, slice } = paginate(items, url);
      return send(res, 200, { prompts: slice, total, page, perPage, totalPages });
    }
    let m = path.match(/^\/api\/prompts\/([^/]+)$/);
    if (m) {
      if (m[1] === fixtures.privatePromptId) return send(res, 403, { error: 'forbidden', message: 'This prompt is private' });
      const prompt = fixtures.prompts.find((p) => p.id === m[1]);
      return prompt ? send(res, 200, prompt) : send(res, 404, { error: 'not_found', message: 'Prompt not found' });
    }
    if (path === '/api/bots') {
      const platform = url.searchParams.get('platform');
      const bots = platform && platform !== 'grok' && platform !== 'hermes' ? [] : [fixtures.bot];
      return send(res, 200, { total: bots.length, bots: bots.map((b) => ({ ...b, author: 'f', urls: botUrls(base, b) })) });
    }
    m = path.match(/^\/bots\/([^/]+?)(\.json|\.md|\/SKILL\.md)$/);
    if (m) {
      const id = m[1].split('_')[0];
      const bot = fixtures.bot;
      if (id !== bot.id) return send(res, 404, 'Bot not found', 'text/plain');
      if (m[2] === '.md') return send(res, 200, `# ${bot.name}\n\nInstructions here.\n`, 'text/markdown; charset=utf-8');
      if (m[2] === '/SKILL.md') return send(res, 200, `---\nname: ${bot.slug}\n---\n\n# ${bot.name}\n`, 'text/markdown; charset=utf-8');
      return send(res, 200, {
        ...bot, author: { username: 'f', name: 'Fatih Kadir Akın' }, urls: botUrls(base, bot),
        instructions: 'You help plan API budgets.', routines: [{ name: 'Weekly check', type: 'schedule', trigger: '0 11 * * 1', triggerLabel: 'Mondays at 11:00' }],
        skills: [], connectors: ['GitHub'],
        install: [
          { platform: 'GROK_BOT', installUrl: null, installPrompt: `Go to ${base}/bots/b1_rate-limit-budgeter.md and create the bot on Grok Bot.`, command: null },
          { platform: 'HERMES', installUrl: null, installPrompt: 'Create the bot on Hermes Agent.', command: `hermes skills install ${base}/bots/b1_rate-limit-budgeter/SKILL.md` },
        ],
        betterTogetherWith: [],
      });
    }
    if (path === '/api/bots/teams') {
      const { page, perPage, total, totalPages, slice } = paginate([fixtures.team], url);
      return send(res, 200, {
        total, page, perPage, totalPages,
        teams: slice.map((t) => ({ ...t, author: 'Fatih Kadir Akın', handoffCount: 1, link: `${base}/bots/teams/${t.slug}` })),
      });
    }
    m = path.match(/^\/api\/bots\/teams\/([^/]+)(\/install)?$/);
    if (m) {
      if (m[1] !== fixtures.team.slug) return send(res, 404, { error: 'not_found', message: 'Team not found' });
      if (m[2]) {
        return send(res, 200, {
          options: [
            { platform: 'GROK_BOT', platformName: 'Grok Bot', bots: [], skipped: [], installPrompt: 'Set up the "Lean Software Factory" team on Grok Bot.', command: null },
            { platform: 'HERMES', platformName: 'Hermes Agent', bots: [], skipped: [], installPrompt: 'Set up the team on Hermes Agent.', command: 'hermes skills install https://example.test/a/SKILL.md' },
          ],
        });
      }
      return send(res, 200, {
        ...fixtures.team, author: { username: 'f', name: 'Fatih Kadir Akın' }, link: `${base}/bots/teams/${fixtures.team.slug}`,
        handoffs: [{ from: 'b2', to: 'b3', fromName: 'Product Owner', toName: 'Quality Reviewer', label: 'PR ready' }],
        platforms: [{ platform: 'GROK_BOT', name: 'Grok Bot', botCount: 2 }, { platform: 'HERMES', name: 'Hermes Agent', botCount: 2 }],
      });
    }
    if (path === '/prompts.json') {
      const full = url.searchParams.get('full_content') === 'true';
      const prompts = fixtures.prompts
        .filter((p) => p.type !== 'CLASSIFIER')
        .map(({ content, ...p }) => (full ? { ...p, content, contentPreview: content } : { ...p, contentPreview: content }));
      return send(res, 200, { count: prompts.length, prompts });
    }
    if (path === '/not-json/api/prompts') return send(res, 200, '<html></html>', 'text/html');
    return send(res, 404, { error: 'not_found' });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
