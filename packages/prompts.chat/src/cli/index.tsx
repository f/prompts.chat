import React, { useState } from 'react';
import { render } from 'ink';
import meow from 'meow';
import clipboardy from 'clipboardy';
import { spawn } from 'child_process';
import { PromptList } from './components/PromptList.js';
import { PromptDetail } from './components/PromptDetail.js';
import type { Prompt } from './api.js';
import { createNew } from './new.js';
import { createCatalogClient } from './catalog.js';
import { EXIT_USAGE, isCatalogCommand, runCatalogCommandSafely } from './commands.js';
import { resolveBaseUrl, setBaseUrl } from './config.js';

type View = 'list' | 'detail';

interface AppState {
  view: View;
  selectedPrompt: Prompt | null;
  searchQuery: string;
  page: number;
  selectedCategory: string | null;
  selectedIndex: number;
}

function App() {
  const [state, setState] = useState<AppState>({
    view: 'list',
    selectedPrompt: null,
    searchQuery: '',
    page: 1,
    selectedCategory: null,
    selectedIndex: 0,
  });

  const handleSelectPrompt = (prompt: Prompt) => {
    setState(prev => ({
      ...prev,
      view: 'detail',
      selectedPrompt: prompt,
    }));
  };

  const handleBack = () => {
    setState(prev => ({
      ...prev,
      view: 'list',
      selectedPrompt: null,
    }));
  };

  const handleSearchChange = (query: string) => {
    setState(prev => ({ ...prev, searchQuery: query, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, page }));
  };

  const handleCategoryChange = (category: string | null) => {
    setState(prev => ({ ...prev, selectedCategory: category, page: 1, selectedIndex: 0 }));
  };

  const handleIndexChange = (index: number) => {
    setState(prev => ({ ...prev, selectedIndex: index }));
  };

  const handleCopy = async (content: string) => {
    try {
      await clipboardy.write(content);
    } catch {
      // Clipboard might not be available in some environments
    }
  };

  const handleQuit = () => {
    process.exit(0);
  };

  if (state.view === 'detail' && state.selectedPrompt) {
    return (
      <PromptDetail
        prompt={state.selectedPrompt}
        onBack={handleBack}
        onCopy={handleCopy}
      />
    );
  }

  return (
    <PromptList
      onSelect={handleSelectPrompt}
      onQuit={handleQuit}
      searchQuery={state.searchQuery}
      onSearchChange={handleSearchChange}
      page={state.page}
      onPageChange={handlePageChange}
      selectedCategory={state.selectedCategory}
      onCategoryChange={handleCategoryChange}
      selectedIndex={state.selectedIndex}
      onIndexChange={handleIndexChange}
    />
  );
}

const cli = meow(`
  Usage
    $ npx prompts.chat [command] [options]

  Interactive
    (no command)            Browse prompts in a terminal UI (needs a TTY)

  Browse & search (read-only, public content)
    search <query>          Search prompts, skills, tastes and more
    prompts [query]         List prompts (all types except bots and classifiers)
    skills [query]          List agent skills
    tastes [query]          List tastes (coding style guides for agents)
    classifiers [query]     List classifiers
    bots [query]            List bots
    teams [query]           List bot teams
    show <id|url>           Show a prompt, skill, taste or classifier
    bot <id|url>            Show a bot
    team <slug|url>         Show a bot team

  Other
    new <dir>               Create a new self-hosted prompts.chat instance
    mcp                     Start the prompts.chat MCP server (stdio)

  Options
    --type <type>           Filter search/prompts: text, image, video, audio,
                            structured, skill, taste, classifier, bot
    --tag <slug[,slug]>     Filter by tag slugs
    --category <slug>       Filter bots/teams by category slug
    --platform <name>       Filter bots: grok, openclaw, hermes, autogpt, dots, duet, muse
    --sort <order>          newest, oldest or upvotes
    --trending              Only trending prompts
    --page <n>              Page number (prompts, teams)
    --limit <n>             Results per page (default 20, max 100)
    --raw                   show/bot: print only the prompt or bot instructions
    --skill                 bot: print the bot's SKILL.md
    --markdown              bot: print the bot's Markdown file
    --install <platform>    bot/team: print the install prompt for a platform
    --json                  Print the API response as JSON
    --base-url <url>        Use another instance (env: PROMPTS_CHAT_URL)
    --help                  Show this help
    --version               Show version

  Navigation (TUI)
    ↑/↓ or j/k    Navigate list
    Enter         Select prompt
    /             Search prompts
    c             Pick a category (list) or copy prompt with variables (detail)
    n/p           Next/Previous page
    r             Run prompt (open in ChatGPT, Claude, etc.)
    C             Copy raw prompt
    o             Open in browser
    b             Go back
    q             Quit

  Examples
    $ npx prompts.chat
    $ npx prompts.chat search "code review"
    $ npx prompts.chat skills postgres
    $ npx prompts.chat show <id> --raw | pbcopy
    $ npx prompts.chat bots --platform hermes
    $ npx prompts.chat team lean-software-factory --install hermes
    $ npx prompts.chat new my-prompts
`, {
  importMeta: import.meta,
  flags: {
    json: { type: 'boolean' },
    raw: { type: 'boolean' },
    type: { type: 'string' },
    tag: { type: 'string' },
    category: { type: 'string' },
    platform: { type: 'string' },
    sort: { type: 'string' },
    trending: { type: 'boolean' },
    page: { type: 'number' },
    limit: { type: 'number' },
    install: { type: 'string' },
    skill: { type: 'boolean' },
    markdown: { type: 'boolean' },
    baseUrl: { type: 'string' },
  },
});

const write = (stream: NodeJS.WriteStream) => (text: string) => {
  stream.write(text.endsWith('\n') ? text : `${text}\n`);
};

async function main(): Promise<number | undefined> {
  const [command, ...args] = cli.input;

  try {
    setBaseUrl(resolveBaseUrl(cli.flags.baseUrl));
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    return EXIT_USAGE;
  }

  if (command === 'new') {
    const directory = args[0];
    if (!directory) {
      console.error('\n❌ Please specify a directory name.\n');
      console.error('   Usage: npx prompts.chat new <directory>\n');
      return 1;
    }
    await createNew({ directory });
    return;
  }

  // Proxies to the published stdio MCP server package
  if (command === 'mcp') {
    const child = spawn('npx', ['-y', '@fkadev/prompts.chat-mcp', ...process.argv.slice(process.argv.indexOf('mcp') + 1)], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (error) => {
      console.error(`Error: could not start the MCP server (${error.message}).`);
      process.exit(1);
    });
    child.on('close', (code) => process.exit(code ?? 0));
    return;
  }

  if (isCatalogCommand(command)) {
    const client = createCatalogClient({ baseUrl: resolveBaseUrl(cli.flags.baseUrl) });
    return runCatalogCommandSafely(command, args, cli.flags, {
      client,
      out: write(process.stdout),
      err: write(process.stderr),
    });
  }

  if (command) {
    console.error(`Error: unknown command "${command}". Run "npx prompts.chat --help" for usage.`);
    return EXIT_USAGE;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('The interactive browser needs a terminal (TTY).');
    console.error('For scripts and pipes use a command instead, e.g.:');
    console.error('  npx prompts.chat search "code review"');
    console.error('  npx prompts.chat show <id> --raw');
    console.error('Run "npx prompts.chat --help" for all commands.');
    return EXIT_USAGE;
  }

  console.clear();

  const { waitUntilExit } = render(<App />, {
    exitOnCtrlC: true,
  });

  await waitUntilExit();
  console.clear();
}

main().then(
  (code) => {
    if (code !== undefined) process.exitCode = code;
  },
  (error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  },
);
