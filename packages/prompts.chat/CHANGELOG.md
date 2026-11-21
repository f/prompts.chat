# Changelog

## 0.2.0 (unreleased)

### Fixed

- **Opening any prompt in `npx prompts.chat` crashed** with
  `TypeError: Cannot read properties of undefined (reading 'replace')`. Since March 2026
  `prompts.json` only sends `content` when `full_content=true` is passed, and 0.1.1 did not pass it.
  The CLI now requests full content, falls back to `contentPreview` if a server leaves `content` out,
  and ignores old 0.1.x caches that hold preview-only prompts.
- `import 'prompts.chat'` (ESM) failed with `ERR_MODULE_NOT_FOUND` because `exports` pointed at
  `.mjs` files that were never built, and `require('prompts.chat')` failed on Node 18 with
  `ERR_REQUIRE_ESM`. The `exports` map now points at the built `.js` (ESM) and `.cjs` (CommonJS) files.
- Running the TUI without a terminal (pipes, CI) crashed with an Ink raw-mode stack trace; it now
  prints how to use the non-interactive commands and exits with code 2.
- Unknown commands (`prompts.chat serach`) opened the TUI; they now print an error and exit with code 2.
- `prompts.chat mcp` forwards its flags to the MCP server and only uses a shell on Windows.

### Added

- Non-interactive, read-only commands for the public catalog:
  `search`, `prompts`, `skills`, `tastes`, `classifiers`, `bots`, `teams`, `show`, `bot` and `team`.
- `show --raw` prints only the prompt body for piping; `--json` prints the API response.
- `bot <id> --install <platform>` and `team <slug> --install <platform>` print the install prompt
  (and command, when the platform has one); `bot --skill` / `--markdown` print the bot's files.
- `show` accepts prompt, bot, team and classifier page URLs.
- `--base-url` and `PROMPTS_CHAT_URL` point the CLI (and the TUI) at a self-hosted instance.
- The TUI tags skills, tastes and media prompts in the list and revalidates its cached catalog with
  the server's ETag instead of downloading it on every start.
- The CLI sends a `prompts.chat-cli/<version>` User-Agent and never sends credentials; only public
  content is read.

### Not included

- Classifier chains have no public JSON API yet, so the CLI does not list them.
- Writing (creating prompts, voting, installing bots on a platform) is out of scope; use the website.
