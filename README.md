<h1 align="center">
  <a href="https://prompts.chat">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://prompts.chat/logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://prompts.chat/logo.svg">
      <img height="60" alt="prompts.chat" src="https://prompts.chat/logo.svg">
    </picture>
    <br>
    prompts.chat
  </a>
</h1>

<p align="center">
  <strong>The world's largest open-source prompt library for AI</strong><br>
  <sub>Works with ChatGPT, Claude, Gemini, Llama, Mistral, and more</sub>
</p>
<p align="center">
  <sub>formerly known as Awesome ChatGPT Prompts</sub>
</p>

<p align="center">
  <a href="https://prompts.chat"><img src="https://img.shields.io/badge/Website-prompts.chat-blue?style=flat-square" alt="Website"></a>
  <a href="https://github.com/sindresorhus/awesome"><img src="https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg" alt="Awesome"></a>
  <a href="https://huggingface.co/datasets/fka/prompts.chat"><img src="https://img.shields.io/badge/🤗-Hugging_Face-yellow?style=flat-square" alt="Hugging Face"></a>
  <a href="https://deepwiki.com/f/prompts.chat"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

<p align="center">
  <a href="https://prompts.chat/prompts">🌐 Browse Prompts</a> •
  <a href="https://fka.gumroad.com/l/art-of-chatgpt-prompting">📖 Read the Book</a> •
  <a href="https://raw.githubusercontent.com/f/prompts.chat/main/PROMPTS.md">📄 View on GitHub</a> •
  <a href="#-self-hosting">🚀 Self-Host</a>
</p>

<p align="center">
  <sub>
    🏆 Featured in <a href="https://www.forbes.com/sites/tjmccue/2023/01/19/chatgpt-success-completely-depends-on-your-prompt/">Forbes</a> ·
    🎓 Referenced by <a href="https://www.huit.harvard.edu/news/ai-prompts">Harvard</a>, <a href="https://etc.cuit.columbia.edu/news/columbia-prompt-library-effective-academic-ai-use">Columbia</a> ·
    📄 <a href="https://scholar.google.com/citations?user=AZ0Dg8YAAAAJ&hl=en">40+ academic citations</a> ·
    ❤️ <a href="https://huggingface.co/datasets/fka/prompts.chat">Most liked dataset</a> on Hugging Face<br>
    ⭐ 143k+ GitHub stars ·
    🏅 <a href="https://spotlights-feed.github.com/spotlights/prompts-chat/index/">GitHub Staff Pick</a> ·
    🚀 First prompt library (Dec 2022)
  </sub>
</p>

<p align="center">
  <sub><strong>Loved by AI pioneers:</strong></sub><br>
  <sub>
    <a href="https://x.com/gdb/status/1602072566671110144"><strong>Greg Brockman</strong></a> (OpenAI Co-Founder) ·
    <a href="https://x.com/woj_zaremba/status/1601362952841760769"><strong>Wojciech Zaremba</strong></a> (OpenAI Co-Founder) ·
    <a href="https://x.com/clementdelangue/status/1830976369389642059"><strong>Clement Delangue</strong></a> (Hugging Face CEO) ·
    <a href="https://x.com/ashtom/status/1887250944427237816"><strong>Thomas Dohmke</strong></a> (Former GitHub CEO)
  </sub>
</p>

---

## What is this?

A curated collection of **prompts** for AI chat models. Originally created for ChatGPT, these prompts work great with any modern AI assistant.

| Browse Prompts | Data Formats |
|----------------|--------------|
| [prompts.chat](https://prompts.chat/prompts) | [prompts.csv](prompts.csv) |
| [PROMPTS.md](https://raw.githubusercontent.com/f/prompts.chat/main/PROMPTS.md) | [Hugging Face Dataset](https://huggingface.co/datasets/fka/prompts.chat) |

**Want to contribute?** Add prompts at [prompts.chat/prompts/new](https://prompts.chat/prompts/new) — they sync here automatically.

---

## 🤖 Bots & Bot Teams

prompts.chat also hosts **always-on AI agents** and the teams they work in.

- **[Bots](https://prompts.chat/bots)** — Share and discover bots (OpenClaw, Hermes Agent, Grok Bot, and more). Each bot page has install instructions per platform, the computer it needs (**cloud**, **the user's computer**, or **both**), "Better together with" pairings, upvotes, comments, and change requests.
- **[Bot Teams](https://prompts.chat/bots/teams)** — Groups of bots that hand work off to each other, shown as an interactive graph. Upvote a team or install every bot in it at once. Featured teams appear on the homepage, and **Teams** is in the top navigation.
- **Profiles** — User profiles have Bots and Teams tabs with counts.
- **Moderation** — Bots and teams can be unlisted to hide them from public listings.

Teams are also available as JSON: `GET /api/teams?sort=newest` (also `oldest` or `upvotes`, paginated with `page` and `perPage`).

---

## 📖 The Interactive Book of Prompting

Learn prompt engineering with our **free, interactive guide** — 30+ chapters covering everything from basics to advanced techniques like chain-of-thought reasoning, few-shot learning, and AI agents. Newer chapters cover going **from prompt to team** (prompt, skill, agent, bot, team), always-on bots, agent teams, computer use, and who may give a bot work — available in 17 languages.

**[Start Reading →](https://fka.gumroad.com/l/art-of-chatgpt-prompting)** (Source: https://github.com/f/prompts.chat/tree/main/src/content/book)

---

## 🎮 Prompting for Kids

<p>
  <a href="https://prompts.chat/kids">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://prompts.chat/promi-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://prompts.chat/promi.svg">
      <img height="60" alt="Promi" src="https://prompts.chat/promi.svg" align="left">
    </picture>
  </a>
</p>

An interactive, game-based adventure to teach children (ages 8-14) how to communicate with AI through fun puzzles and stories.

**[Start Playing →](https://prompts.chat/kids)**

<br clear="left">

---

## 🚀 Self-Hosting

Deploy your own private prompt library with custom branding, themes, and authentication.

**Quick Start:**
```bash
npx prompts.chat new my-prompt-library
cd my-prompt-library
```

**Manual Setup:**
```bash
git clone https://github.com/f/prompts.chat.git
cd prompts.chat
npm install && npm run setup
```

The setup wizard configures branding, theme, authentication (GitHub/Google/Azure AD), and features.

**Recommended database:** prompts.chat uses PostgreSQL. For a hosted database, we recommend [Neon](https://get.neon.com/VqfnMo4).

<div>
  <p>Sponsored by</p>
  <a href="https://get.neon.com/VqfnMo4">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon.svg">
      <img width="250px" alt="Neon Logo fallback" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon-dark.svg">
    </picture>
  </a>
</div>

📖 **[Full Self-Hosting Guide](SELF-HOSTING.md)** • 🐳 **[Docker Guide](DOCKER.md)**

---

## 🔌 Integrations

### CLI
```bash
npx prompts.chat
```

### Claude Code Plugin
```
/plugin marketplace add f/prompts.chat
/plugin install prompts.chat@prompts.chat
```
📖 [Plugin Documentation](CLAUDE-PLUGIN.md)

### MCP Server
Use prompts.chat as an MCP server in your AI tools.

**Remote (recommended):**
```json
{
  "mcpServers": {
    "prompts.chat": {
      "url": "https://prompts.chat/api/mcp"
    }
  }
}
```

**Local:**
```json
{
  "mcpServers": {
    "prompts.chat": {
      "command": "npx",
      "args": ["-y", "prompts.chat", "mcp"]
    }
  }
}
```

Tools cover prompts and skills, plus bots (`search_bots`, `get_bot`, `save_bot`, `list_my_bots`, `get_my_bot`) and bot teams (`list_teams`, `get_team`, `save_team`).

📖 [MCP Documentation](https://prompts.chat/docs/api)

---

## 💖 Sponsors

<p align="center">
  <!-- Neon (py-1) -->
  <a href="https://get.neon.com/VqfnMo4">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon.svg">
      <img height="30" alt="Neon" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon.svg">
    </picture>
  </a>&nbsp;&nbsp;
  <!-- Clemta -->
  <a href="https://clemta.com/?utm_source=prompts.chat">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/clemta-dark.webp">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/clemta.webp">
      <img height="35" alt="Clemta" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/clemta.webp">
    </picture>
  </a>&nbsp;&nbsp;
  <!-- Wiro (py-1) -->
  <a href="https://wiro.ai/?utm_source=prompts.chat">
    <img height="30" alt="Wiro" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/wiro.png">
  </a>&nbsp;&nbsp;
  <!-- Cognition -->
  <a href="https://wind.surf/prompts-chat">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/cognition-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/cognition.svg">
      <img height="35" alt="Cognition" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/cognition.svg">
    </picture>
  </a>&nbsp;&nbsp;
  <!-- CodeRabbit (py-1) -->
  <a href="https://coderabbit.link/fatih">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/coderabbit-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/coderabbit.svg">
      <img height="30" alt="CodeRabbit" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/coderabbit.svg">
    </picture>
  </a>&nbsp;&nbsp;
  <!-- Sentry (py-1) -->
  <a href="https://sentry.io/?utm_source=prompts.chat">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/sentry-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/sentry.svg">
      <img height="30" alt="Sentry" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/sentry.svg">
    </picture>
  </a>&nbsp;&nbsp;
  <!-- Each Labs (py-[6px]) -->
  <a href="https://www.eachlabs.ai/?utm_source=promptschat&utm_medium=referral">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/eachlabs-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/eachlabs.png">
      <img height="28" alt="Each Labs" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/eachlabs.png">
    </picture>
  </a>&nbsp;&nbsp;
  <!-- CommandCode (py-1) -->
  <a href="https://commandcode.ai/?utm_source=prompts.chat">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/commandcode-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/commandcode.svg">
      <img height="30" alt="CommandCode" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/commandcode.svg">
    </picture>
  </a>
</p>

<p align="center">
  <sub>Built with <a href="https://wind.surf/prompts-chat">Windsurf</a> and <a href="https://devin.ai">Devin</a></sub><br>
  <a href="https://github.com/sponsors/f/sponsorships?sponsor=f&tier_id=558224&preview=false"><strong>Become a Sponsor →</strong></a>
</p>

---

## 👥 Contributors

<a href="https://github.com/f/prompts.chat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=f/prompts.chat" />
</a>

---

## 📜 License

This project is dual-licensed:

- **Source code and site-authored content** is licensed under the [MIT License](LICENSE-MIT),
  including the interactive book content in [`src/content/book`](src/content/book).
- **Prompt content and data** (prompts.csv, PROMPTS.md, user-submitted prompts) is dedicated to the public domain under [CC0 1.0 Universal](LICENSE-CC0).

See [LICENSE](LICENSE) for details.

## Personal Prompt Library

Visit **`/my-library`** (also in the header's More menu). Search, select a prompt,
fill any inputs, and copy the completed text. The directory and filters use the
available categories and source types. The layout supports keyboard navigation,
mobile screens, and the application's light/dark theme.

This read-only view uses the checked-in **`prompts.csv`**, not a second database.
`PROMPTS.md` is another presentation of the same repository dataset; importing
both would duplicate entries. The existing social platform's authentication,
account collections, editing, change requests, and database versions remain
available through their existing routes. Library favorites and imports are a
separate, **browser-local workspace**; they do not sync with account collections.
Nothing in this feature writes to a database or changes original prompt text.

### Customize, import, and back up

- Inputs recognize `[TOPIC]`, `[TARGET MARKET]`, and the repository's native
  `${name}` / `${name:default}` syntax. Empty inputs retain placeholders or native
  defaults. Repeated variables share an input. Original content remains visible.
- Import a JSON array of prompt objects, or CSV with `title` (or `act`) and
  `prompt` columns. Optional fields: `description`, `category`, `subcategory`,
  `tags`, `source`, and `updatedAt` (ISO timestamp). CSV `tags` cells contain a JSON
  array, quoted according to CSV rules. Source links must use HTTPS.
- Imports are validated as a whole: maximum 25 MB, 10,000 total records, 200,000
  characters per prompt, 500 per title, and 100 tags. Invalid imports leave stored
  data unchanged. Browser storage quotas may impose a smaller practical limit.
- Use **Export JSON** or **Export CSV** to back up repository and imported entries
  together. Favorites are saved locally and are not part of those exports. Do not
  clear site storage without backing up imports you want to keep.
- Entries have deterministic IDs and content revision fingerprints. Exact
  duplicates are ignored; changed prompt text creates a distinct entry rather
  than overwriting the original. Content fingerprints are revision identifiers,
  not cryptographic integrity signatures. IDs supplied by imports are recomputed.
- The index includes `id`, `title`, `description`, `category`, `subcategory`, `tags`,
  `prompt`, `variables`, `source`, `version`, and `updatedAt`. Missing timestamps
  remain `null`; missing descriptions/tags stay empty. Categories are inferred
  from titles when absent (`for_devs` maps to Coding); subcategories fall back to
  the source's `type`. These are organizational hints, not curated metadata.
- New interface messages use the `myLibrary` translation namespace. All configured
  locale files currently include English fallback copy for this new namespace.

### Portable selector and chat directory

From the repository root, after `npm ci` with Node 24:

```bash
npx tsx scripts/export-prompt-library.ts
# Or choose an output folder:
npx tsx scripts/export-prompt-library.ts /tmp/my-prompt-library
```

The default ignored output folder is `out/prompt-library/`, containing:

- `prompt-selector.html`: a self-contained, offline search/category/preview/copy
  selector. Open it locally. Clipboard permissions vary for local files; if copying
  fails, select the preview text and copy it manually.
- `prompt-directory.json`: the complete normalized prompt records and content.
- `prompt-directory.compact.json`: a smaller chat-friendly directory with IDs, titles,
  categories, variables, and short previews. Resolve a chosen ID against the full
  JSON export to retrieve its unchanged prompt. Load directory pages or search
  results into a chat UI instead of putting the entire collection in one message.
- `prompt-directory.csv`: a round-trip CSV export.

The running application also provides downloads at `/my-library/export?format=json`,
`?format=csv`, `?format=compact`, and `?format=html` (the **Offline selector** button). These exports
contain repository data; browser-local imports are included only in the dashboard's
JSON/CSV exports. The portable selector uses safe text rendering, does not fetch
remote resources, and bounds its rendered results to 60 at a time. It deliberately
keeps a smaller feature set than the dashboard. Refresh it by rerunning the script
or downloading it again after `prompts.csv` changes. No live GitHub synchronization
is implied. Standalone HTML cannot execute inside every ChatGPT conversation;
use the compact directory with a compatible chat interface, retaining the full
export for prompt lookup.

### Validation

```bash
npm test -- src/lib/my-library/index.test.ts src/components/my-library/prompt-library.test.tsx
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

`/my-library` and its exports do not require database access. Other existing routes
still require the documented PostgreSQL/authentication configuration. The root
layout also uses Google-hosted fonts during compilation, so a build needs access
to those font destinations. For a production standalone deployment, retain
`prompts.csv` beside the server (the explicit filesystem trace includes it).
