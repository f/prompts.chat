import type { CallToolResult, GetPromptResult, ReadResourceResult, WebMcpEnv } from "./types";

/** The site's own MCP server (src/lib/mcp), which holds the search and lookup logic */
export const MCP_ENDPOINT = "/api/mcp";

export interface ServerTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[]; [key: string]: unknown };
  annotations?: { readOnlyHint?: boolean; [key: string]: unknown };
}

export class McpRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

let requestId = 0;

/**
 * One JSON-RPC request to the stateless /api/mcp endpoint. It is same-origin, so it runs under the
 * same rate limits as any other client; it authenticates by API key only, so browser calls are
 * anonymous and see public content.
 */
export async function mcpRequest<T>(
  env: WebMcpEnv,
  method: string,
  params?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const response = await env.fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, ...(params && { params }) }),
    signal,
  });

  let body: { result?: T; error?: { message?: string } } | null = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error pages fall through to the status check
  }
  if (body?.error) throw new McpRequestError(body.error.message || "MCP request failed", response.status);
  if (!response.ok || !body || body.result === undefined) {
    throw new McpRequestError(`MCP request failed with status ${response.status}`, response.status);
  }
  return body.result;
}

export async function listServerTools(env: WebMcpEnv, signal?: AbortSignal): Promise<ServerTool[]> {
  const { tools } = await mcpRequest<{ tools: ServerTool[] }>(env, "tools/list", undefined, signal);
  return tools;
}

export function callServerTool(env: WebMcpEnv, name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  return mcpRequest<CallToolResult>(env, "tools/call", { name, arguments: args });
}

export function getServerPrompt(env: WebMcpEnv, name: string, args: Record<string, string>): Promise<GetPromptResult> {
  return mcpRequest<GetPromptResult>(env, "prompts/get", { name, arguments: args });
}

export function readServerResource(env: WebMcpEnv, uri: string): Promise<ReadResourceResult> {
  return mcpRequest<ReadResourceResult>(env, "resources/read", { uri });
}

/** The JSON a tool returned: structuredContent, else its first text block parsed */
export function toolData(result: CallToolResult): Record<string, unknown> | null {
  if (result.structuredContent) return result.structuredContent as Record<string, unknown>;
  const text = result.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") return null;
  try {
    const parsed = JSON.parse(text.text);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
