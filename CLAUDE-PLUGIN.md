# Claude Code Plugin

Access prompts.chat directly in [Claude Code](https://code.claude.com) with our official plugin. Search prompts, discover skills, and improve your prompts without leaving your IDE.

## Installation

Add the prompts.chat marketplace to Claude Code:

```
/plugin marketplace add f/prompts.chat
```

Then install the plugin:

```
/plugin install prompts.chat@prompts.chat
```

## Features

| Feature | Description |
|---------|-------------|
| **MCP Server** | Connect to prompts.chat API for real-time prompt access |
| **Commands** | `/prompts.chat:prompts` and `/prompts.chat:skills` slash commands |
| **Agents** | Prompt Manager and Skill Manager agents for complex workflows |
| **Skills** | Auto-activating skills for prompt and skill discovery |

## Commands

### Search Prompts

```
/prompts.chat:prompts <query>
/prompts.chat:prompts <query> --type IMAGE
/prompts.chat:prompts <query> --category coding
/prompts.chat:prompts <query> --tag productivity
```

**Examples:**
```
/prompts.chat:prompts code review
/prompts.chat:prompts writing assistant --category writing
/prompts.chat:prompts midjourney --type IMAGE
/prompts.chat:prompts react developer --tag coding
```

### Search Skills

```
/prompts.chat:skills <query>
/prompts.chat:skills <query> --category coding
/prompts.chat:skills <query> --tag automation
```

**Examples:**
```
/prompts.chat:skills testing automation
/prompts.chat:skills documentation --category coding
/prompts.chat:skills api integration
```

## MCP Tools

The plugin provides these tools via the prompts.chat MCP server:

### Prompt Tools

| Tool | Description |
|------|-------------|
| `search_prompts` | Search prompts by keyword, category, tag, or type |
| `get_prompt` | Retrieve a prompt; pass `variables` to fill its `${name}` placeholders |
| `save_prompt` | Save a new prompt (requires API key) |
| `improve_prompt` | Enhance prompts using AI |

### Skill Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Search for Agent Skills |
| `get_skill` | Get a skill with all its files |
| `save_skill` | Create multi-file skills (requires API key) |
| `add_file_to_skill` | Add a file to an existing skill |
| `update_skill_file` | Update a file in a skill |
| `remove_file_from_skill` | Remove a file from a skill |

### Bot Tools

| Tool | Description |
|------|-------------|
| `search_bots` | Search the public bots directory by keyword, platform, category and tags (semantic ranking when AI search is enabled) |
| `get_bot` | Get a public bot by id or slug, with install options per platform |
| `save_bot` | Create or update one of your bots (idempotent upsert by id, slug or name; requires API key) |
| `list_my_bots` | List your own bots, including private ones (requires API key) |
| `get_my_bot` | Get the full definition of one of your bots (requires API key) |

Tools return `structuredContent` matching their `outputSchema`, plus resource links. Paged tools return `nextCursor`; pass it back as `cursor`.

### Resources

| URI | Contents |
|-----|----------|
| `prompts-chat://prompts/{id}` | A prompt as Markdown |
| `prompts-chat://skills/{id}` | Every file of a skill |
| `prompts-chat://skills/{id}/files/{path}` | One skill file |
| `prompts-chat://bots/{id}` | A bot's definition and setup steps as Markdown |

## Agents

### Prompt Manager

The `prompt-manager` agent helps you:
- Search for prompts across prompts.chat
- Get and fill prompt variables
- Save new prompts to your account
- Improve prompts using AI

### Skill Manager

The `skill-manager` agent helps you:
- Search for Agent Skills
- Get and install skills to your workspace
- Create new skills with multiple files
- Manage skill file contents

## Skills (Auto-Activating)

### Prompt Lookup

Automatically activates when you:
- Ask for prompt templates
- Want to search for prompts
- Need to improve a prompt
- Mention prompts.chat

### Skill Lookup

Automatically activates when you:
- Ask for Agent Skills
- Want to extend Claude's capabilities
- Need to install a skill
- Mention skills for Claude

## Authentication

To save prompts and skills, you need an API key from [prompts.chat/settings](https://prompts.chat/settings).

### Option 1: Environment Variable

Set the `PROMPTS_API_KEY` environment variable:

```bash
export PROMPTS_API_KEY=your_api_key_here
```

### Option 2: MCP Header

Add the header when connecting to the MCP server:

```
PROMPTS_API_KEY: your_api_key_here
```

## Plugin Structure

```
plugins/claude/prompts.chat/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── .mcp.json                 # MCP server configuration
├── commands/
│   ├── prompts.md           # /prompts.chat:prompts command
│   └── skills.md            # /prompts.chat:skills command
├── agents/
│   ├── prompt-manager.md    # Prompt management agent
│   └── skill-manager.md     # Skill management agent
└── skills/
    ├── prompt-lookup/
    │   └── SKILL.md         # Prompt discovery skill
    └── skill-lookup/
        └── SKILL.md         # Skill discovery skill
```

## Links

- **[prompts.chat](https://prompts.chat)** - Browse all prompts and skills
- **[API Documentation](https://prompts.chat/api/mcp)** - MCP server endpoint
- **[Settings](https://prompts.chat/settings)** - Get your API key
