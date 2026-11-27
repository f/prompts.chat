import { describe, it, expect } from "vitest";
import { MCP_CLIENTS, getMcpClientConfig, type McpClient } from "@/lib/mcp/client-config";

const mcpUrl = "https://prompts.chat/api/mcp";
const apiKey = "pchat_test";

describe("MCP_CLIENTS", () => {
  it("lists newer agents first, Devin in Windsurf's former place before Cursor, and editors last", () => {
    expect(MCP_CLIENTS).toEqual([
      "claude-code",
      "claude-desktop",
      "codex",
      "grok-bot",
      "openclaw",
      "devin",
      "cursor",
      "gemini",
      "vscode",
    ]);
    expect(MCP_CLIENTS).not.toContain("windsurf");
  });

  it("has a config for every client and mode", () => {
    for (const client of MCP_CLIENTS) {
      for (const mode of ["remote", "local"] as const) {
        expect(getMcpClientConfig(client, mode, { mcpUrl }).code).not.toBe("");
      }
    }
  });
});

describe("getMcpClientConfig", () => {
  it("adds Claude Code over HTTP with the key as a header", () => {
    expect(getMcpClientConfig("claude-code", "remote", { mcpUrl, apiKey }).code).toBe(
      `claude mcp add --transport http prompts.chat ${mcpUrl} --header "PROMPTS_API_KEY: ${apiKey}"`
    );
  });

  it("puts the server name before Claude Code's variadic --env flags", () => {
    expect(getMcpClientConfig("claude-code", "local", { mcpUrl, apiKey, queryParams: "tags=a" }).code).toBe(
      'claude mcp add prompts.chat --env PROMPTS_API_KEY="pchat_test" --env PROMPTS_QUERY="tags=a" -- npx -y @fkadev/prompts.chat-mcp'
    );
  });

  it("gives Claude Desktop and Grok Bot only the URL and says the key is left out", () => {
    for (const client of ["claude-desktop", "grok-bot"] as McpClient[]) {
      const config = getMcpClientConfig(client, "remote", { mcpUrl, apiKey });
      expect(config.code).toBe(mcpUrl);
      expect(config.omitsApiKey).toBe(true);
    }
    expect(getMcpClientConfig("grok-bot", "remote", { mcpUrl }).omitsApiKey).toBe(false);
  });

  it("uses Codex's http_headers for the key", () => {
    expect(getMcpClientConfig("codex", "remote", { mcpUrl, apiKey }).code).toBe(
      `[mcp_servers.prompts_chat]\nurl = "${mcpUrl}"\nhttp_headers = { "PROMPTS_API_KEY" = "${apiKey}" }`
    );
  });

  it("configures OpenClaw with the streamable-http transport", () => {
    expect(JSON.parse(getMcpClientConfig("openclaw", "remote", { mcpUrl, apiKey }).code)).toEqual({
      mcp: { servers: { "prompts-chat": { url: mcpUrl, transport: "streamable-http", headers: { PROMPTS_API_KEY: apiKey } } } },
    });
  });

  it("adds Devin with its CLI, or its config file when a key needs a header", () => {
    expect(getMcpClientConfig("devin", "remote", { mcpUrl }).code).toBe(`devin mcp add prompts.chat ${mcpUrl}`);
    expect(JSON.parse(getMcpClientConfig("devin", "remote", { mcpUrl, apiKey }).code)).toEqual({
      mcpServers: { "prompts.chat": { url: mcpUrl, transport: "http", headers: { PROMPTS_API_KEY: apiKey } } },
    });
    expect(getMcpClientConfig("devin", "local", { mcpUrl }).code).toBe("devin mcp add prompts.chat -- npx -y @fkadev/prompts.chat-mcp");
  });

  it("adds Gemini CLI over streamable HTTP, since the server has no SSE stream", () => {
    expect(getMcpClientConfig("gemini", "remote", { mcpUrl }).code).toBe(`gemini mcp add --transport http prompts.chat ${mcpUrl}`);
  });
});
