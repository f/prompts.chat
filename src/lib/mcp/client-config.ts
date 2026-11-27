export type McpClient =
  | "claude-code"
  | "claude-desktop"
  | "codex"
  | "grok-bot"
  | "openclaw"
  | "devin"
  | "cursor"
  | "gemini"
  | "vscode";

export type McpMode = "remote" | "local";

/** Display order: newer agents first, editors last */
export const MCP_CLIENTS: McpClient[] = [
  "claude-code",
  "claude-desktop",
  "codex",
  "grok-bot",
  "openclaw",
  "devin",
  "cursor",
  "gemini",
  "vscode",
];

export const MCP_CLIENT_LABELS: Record<McpClient, string> = {
  "claude-code": "Claude Code",
  "claude-desktop": "Claude Desktop",
  codex: "Codex",
  "grok-bot": "Grok Bot",
  openclaw: "OpenClaw",
  devin: "Devin",
  cursor: "Cursor",
  gemini: "Gemini CLI",
  vscode: "VS Code",
};

/** Keys of the mcp.clientNotes translations shown under a config */
export type McpClientNote =
  | "claudeDesktopRemote"
  | "claudeDesktopLocal"
  | "codex"
  | "grokBotRemote"
  | "grokBotLocal"
  | "openclaw"
  | "devinRemote"
  | "devinLocal";

export interface McpClientConfig {
  /** Command, config file snippet or URL to copy */
  code: string;
  note?: McpClientNote;
  /** The client only takes a URL or command, so the API key can't be passed along */
  omitsApiKey?: boolean;
}

export interface McpClientConfigOptions {
  mcpUrl: string;
  apiKey?: string | null;
  /** URL parameters (users, categories, tags) passed to the local server as PROMPTS_QUERY */
  queryParams?: string;
}

export const MCP_NPM_PACKAGE = "@fkadev/prompts.chat-mcp";

const SERVER_NAME = "prompts.chat";

export function buildLocalEnv(apiKey?: string | null, queryParams?: string): Record<string, string> | undefined {
  const env: Record<string, string> = {};
  if (apiKey) env.PROMPTS_API_KEY = apiKey;
  if (queryParams) env.PROMPTS_QUERY = queryParams;
  return Object.keys(env).length > 0 ? env : undefined;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function apiKeyHeaders(apiKey?: string | null) {
  return apiKey ? { headers: { PROMPTS_API_KEY: apiKey } } : {};
}

function npxServer(env?: Record<string, string>) {
  return { command: "npx", args: ["-y", MCP_NPM_PACKAGE], ...(env && { env }) };
}

function envFlags(flag: string, env?: Record<string, string>): string {
  return env ? Object.entries(env).map(([key, value]) => `${flag} ${key}="${value}" `).join("") : "";
}

/** Install instructions for one client, following each client's documented MCP setup */
export function getMcpClientConfig(client: McpClient, mode: McpMode, { mcpUrl, apiKey, queryParams }: McpClientConfigOptions): McpClientConfig {
  const localEnv = buildLocalEnv(apiKey, queryParams);

  switch (client) {
    case "claude-code":
      if (mode === "remote") {
        const header = apiKey ? ` --header "PROMPTS_API_KEY: ${apiKey}"` : "";
        return { code: `claude mcp add --transport http ${SERVER_NAME} ${mcpUrl}${header}` };
      }
      // --env is variadic, so the server name has to come before it
      return { code: `claude mcp add ${SERVER_NAME} ${envFlags("--env", localEnv)}-- npx -y ${MCP_NPM_PACKAGE}` };

    case "claude-desktop":
      if (mode === "remote") {
        // Custom connectors take only a URL and authenticate with OAuth
        return { code: mcpUrl, note: "claudeDesktopRemote", omitsApiKey: !!apiKey };
      }
      return { code: json({ mcpServers: { [SERVER_NAME]: npxServer(localEnv) } }), note: "claudeDesktopLocal" };

    case "codex": {
      if (mode === "remote") {
        let config = `[mcp_servers.prompts_chat]\nurl = "${mcpUrl}"`;
        if (apiKey) config += `\nhttp_headers = { "PROMPTS_API_KEY" = "${apiKey}" }`;
        return { code: config, note: "codex" };
      }
      let config = `[mcp_servers.prompts_chat]\ncommand = "npx"\nargs = ["-y", "${MCP_NPM_PACKAGE}"]`;
      if (localEnv) {
        config += "\n\n[mcp_servers.prompts_chat.env]";
        for (const [key, value] of Object.entries(localEnv)) {
          config += `\n${key} = "${value}"`;
        }
      }
      return { code: config, note: "codex" };
    }

    case "grok-bot":
      // Grok Bot adds servers from chat and has no way to store a secret header
      if (mode === "remote") {
        return { code: mcpUrl, note: "grokBotRemote", omitsApiKey: !!apiKey };
      }
      return { code: `npx -y ${MCP_NPM_PACKAGE}`, note: "grokBotLocal", omitsApiKey: !!apiKey };

    case "openclaw":
      if (mode === "remote") {
        return {
          code: json({ mcp: { servers: { "prompts-chat": { url: mcpUrl, transport: "streamable-http", ...apiKeyHeaders(apiKey) } } } }),
          note: "openclaw",
        };
      }
      return { code: json({ mcp: { servers: { "prompts-chat": npxServer(localEnv) } } }), note: "openclaw" };

    case "devin":
      if (mode === "remote") {
        // `devin mcp add` has no header flag, so a key goes in the config file
        const code = apiKey
          ? json({ mcpServers: { [SERVER_NAME]: { url: mcpUrl, transport: "http", ...apiKeyHeaders(apiKey) } } })
          : `devin mcp add ${SERVER_NAME} ${mcpUrl}`;
        return { code, note: "devinRemote" };
      }
      return {
        code: localEnv
          ? json({ mcpServers: { [SERVER_NAME]: npxServer(localEnv) } })
          : `devin mcp add ${SERVER_NAME} -- npx -y ${MCP_NPM_PACKAGE}`,
        note: "devinLocal",
      };

    case "cursor":
      if (mode === "remote") {
        return { code: json({ mcpServers: { [SERVER_NAME]: { url: mcpUrl, ...apiKeyHeaders(apiKey) } } }) };
      }
      return { code: json({ mcpServers: { [SERVER_NAME]: npxServer(localEnv) } }) };

    case "gemini":
      if (mode === "remote") {
        const header = apiKey ? ` --header "PROMPTS_API_KEY: ${apiKey}"` : "";
        return { code: `gemini mcp add --transport http ${SERVER_NAME} ${mcpUrl}${header}` };
      }
      return { code: `gemini mcp add ${envFlags("-e", localEnv)}${SERVER_NAME} -- npx -y ${MCP_NPM_PACKAGE}` };

    case "vscode":
      if (mode === "remote") {
        return { code: json({ mcp: { servers: { [SERVER_NAME]: { type: "http", url: mcpUrl, ...apiKeyHeaders(apiKey) } } } }) };
      }
      return { code: json({ mcp: { servers: { [SERVER_NAME]: { type: "stdio", ...npxServer(localEnv) } } } }) };
  }
}
