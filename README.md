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

## 📖 The Interactive Book of Prompting

Learn prompt engineering with our **free, interactive guide** — 28+ chapters covering everything from basics to advanced techniques like chain-of-thought reasoning, few-shot learning, and AI agents.

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

## 📚 Resources

- [AI Prompt Architect](https://aipromptarchitect.co.uk) - Production-grade prompt engineering platform for developers using the STCO framework.

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
