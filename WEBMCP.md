# WebMCP

Every page of prompts.chat registers [Model Context Protocol](https://modelcontextprotocol.io) tools, prompts and resources **in the browser**. An AI agent connected to the tab can read the page you are looking at, work with the prompt, skill, bot, team or classifier shown, navigate the site, and (with your consent and session) upvote or save prompts.

This complements the [remote MCP server](https://prompts.chat/docs/api) at `/api/mcp`, which needs no browser but only knows what you pass to it.

## Connect an MCP client

prompts.chat supports two ways of connecting. Both use the same tool definitions.

### 1. The webmcp.dev widget (works in any browser)

The round MCP button in the **bottom-left corner** is the [webmcp.dev](https://webmcp.dev/) widget. It connects the tab to your MCP client through a small bridge that runs on your computer (localhost only).

1. Add the bridge to your MCP client once. Use `claude`, `cursor`, `cline`, `windsurf` or a path to an MCP JSON config:

   ```bash
   npx -y @jason.today/webmcp@latest --config claude
   ```

   Or add it to the config by hand:

   ```json
   {
     "mcpServers": {
       "webmcp": {
         "command": "npx",
         "args": ["-y", "@jason.today/webmcp@latest", "--mcp"]
       }
     }
   }
   ```

2. Restart the client, then ask it for a WebMCP token. It calls the bridge's `_webmcp_get-token` tool. To keep the token away from the model, run `npx @jason.today/webmcp --new` instead.
3. Open prompts.chat, click the MCP button, paste the token and press **Connect**. The button shows a green dot while connected.
4. The site's tools now appear in your client, prefixed with the site's domain (for example `prompts-chat-search_prompts`). Some clients only pick up new tools after a restart or a new chat.

The connection is closed when you click **Disconnect**, close the tab, after 30 minutes without interaction, or when you stop the bridge with `npx @jason.today/webmcp -q`. Tokens are single use.

### 2. Browser-native WebMCP (progressive enhancement)

[WebMCP](https://webmachinelearning.github.io/webmcp/) is a proposed web standard from the W3C Web Machine Learning Community Group. It lets the browser itself expose a page's tools to agents. When the browser provides `document.modelContext` (or the earlier `navigator.modelContext`), prompts.chat registers the same tools there automatically, with no widget or token. Examples are Chrome or Edge with the WebMCP origin trial or the `chrome://flags/#enable-webmcp-testing` flag, and agentic browsers that implement the API.

The native API only covers **tools**. The prompts and resources below are only available through the widget.

## Tools

Page tools run in the tab. They read the DOM, drive the client-side router, and call the site's own REST endpoints with your session.

| Tool | What it does |
|------|--------------|
| `get_current_page` | Title, description, locale, text direction, route (page type and id), headings, links and the main text as Markdown. `maxLength` limits the text (default 8000). |
| `get_current_item` | The prompt, skill, bot, team or classifier shown on the current detail page, fetched in full. On category and tag pages it returns the listing. |
| `fill_prompt_variables` | Fills the `${variable}` / `${variable:default}` placeholders of the current prompt, or of `id`, and returns the ready-to-use text. |
| `navigate` | Opens a same-origin path, such as `/prompts/abc_slug` or `/tags/coding`, and returns the new page's title and route. Other origins are refused. |
| `show_search_results` | Opens the search results for `query` in the `prompts`, `skills`, `bots` or `classifiers` section so the user sees them. |
| `change_language` | Switches the interface language to one of the site's locales. This reloads the page. |
| `get_signed_in_user` | The signed-in user's username, name and profile link, or `signedIn: false`. No email or other private data. |
| `upvote_prompt` | Upvotes the current prompt or `id` as the signed-in user, or removes the upvote with `upvote: false`. Uses `/api/prompts/{id}/vote`. |
| `save_prompt_to_collection` | Saves the current prompt or `id` to the signed-in user's collection, or removes it with `save: false`. Uses `/api/collection`. |

Data tools are mirrored from the remote MCP server. Their names, descriptions and input schemas come from `/api/mcp`'s `tools/list` at load time, and calls are forwarded to `/api/mcp` unchanged. Only read-only tools are mirrored.

| Tool | What it does |
|------|--------------|
| `search_prompts` | Search public prompts by keyword, type, category or tag. |
| `get_prompt` | A prompt by id or slug, optionally with its variables filled. |
| `search_skills` / `get_skill` | Search Agent Skills, or get one with all its files. |
| `search_bots` / `get_bot` | Search public bots, or get one with its prompts and skills. |
| `list_teams` / `get_team` | List public bot teams, or get one with its members and workflow. |
| `search_classifiers` / `get_classifier` | Search classifiers by keyword or category, or get one with its definition, scenarios and chains. |
| `list_categories` | All categories with their subcategories. |
| `list_tags` | Tags ordered by popularity, optionally filtered by `query`. |

## Prompts

| Prompt | Arguments | What it returns |
|--------|-----------|-----------------|
| `use_prompt` | `prompt` (id or slug), `variables` (JSON object, optional) | The prompt as a user message with its variables filled. Uses the remote server's prompt template. |
| `use_current_prompt` | `variables` (JSON object, optional) | The prompt on the current page, filled. |
| `find_prompt` | `task` | Instructions for the model to find, fill and return the best prompt for a task. |

## Resources

| Resource | URI | Content |
|----------|-----|---------|
| Current page | `page://current` | The current page as Markdown, same as `get_current_page`. |
| Current item | `prompts-chat://current-item` | The item on the current detail page as JSON, same as `get_current_item`. |
| Prompt | `prompts-chat://prompts/{id}` | A prompt, read from the remote server. |
| Skill | `prompts-chat://skills/{id}` | A skill, read from the remote server. |
| Bot | `prompts-chat://bots/{id}` | A bot, read from the remote server. |

## Permissions and privacy

- Data tools run **anonymously**. `/api/mcp` authenticates with API keys, not cookies, so the browser cannot send your session there. Mirrored tools, `get_current_item` and `fill_prompt_variables` only see public content, even when you are signed in. A private prompt you can open is only readable through `get_current_page`, which reads what the page shows.
- `upvote_prompt` and `save_prompt_to_collection` call the same endpoints as the buttons on the page, with your session cookie, so the same permission checks apply. When you are signed out they return `unauthorized`. Upvoting team votes is not supported.
- `get_current_page` never includes form fields, scripts, hidden elements or the widget itself.
- Nothing is sent anywhere until you connect. The widget talks only to the bridge on `localhost`, and native WebMCP only to your browser.

## Configuration

WebMCP is on by default. Turn it off with `features.webmcp: false` in `prompts.config.ts` or, without rebuilding, with an environment variable:

```bash
PCHAT_FEATURE_WEBMCP=false
```

The data tools also need the MCP server (`features.mcp`). Without it, only the page tools are registered.

The widget script is vendored in `public/vendor/webmcp/` and served from your own origin, so no third-party script is loaded and it works the same on Vercel, Node, Docker or any static host. To upgrade it, change the version and integrity hash in `scripts/vendor-webmcp.mjs`, then run:

```bash
node scripts/vendor-webmcp.mjs
```

and update `WEBMCP_WIDGET_VERSION` in `src/lib/webmcp/widget.ts`.

## For developers

| Path | Purpose |
|------|---------|
| `src/lib/webmcp/tools.ts` | Page tools and mirroring of the remote server's tools |
| `src/lib/webmcp/prompts.ts` | MCP prompts |
| `src/lib/webmcp/resources.ts` | MCP resources |
| `src/lib/webmcp/page.ts` | Route parsing and page snapshots |
| `src/lib/webmcp/adapters.ts` | Registration with the widget and with `document.modelContext` |
| `src/lib/webmcp/widget.ts` | Loads the vendored widget and localizes it |
| `src/components/webmcp/webmcp-loader.tsx` | Starts everything when the browser is idle |
| `src/app/globals.css` (`[data-webmcp-widget]`) | Widget theme |

To add a tool, add it to `pageTools` in `tools.ts`. To expose a new remote MCP tool in the browser, add its name to `PROXIED_SERVER_TOOLS`. It must be annotated `readOnlyHint: true` on the server.

## Limitations

- The widget needs the local bridge and a token per tab. Some MCP clients only show newly registered tools after a restart.
- The widget disconnects after 30 minutes without user interaction in the tab. Tool calls do not count as interaction.
- Browser-native WebMCP is experimental and tools-only.
- Some text inside the widget panel (its title, tool list and status messages) is not translated.
- While the cookie banner is visible, it covers the widget button.
