import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import appConfig from "@/../prompts.config";
import { mcpAiToolLimiter, mcpGeneralLimiter, mcpToolCallLimiter, mcpWriteToolLimiter } from "@/lib/rate-limit";
import { getBaseUrl } from "@/lib/seo";
import { authenticateApiKey, getMcpApiKey } from "./auth";
import type { McpContext } from "./context";
import { createMcpServer } from "./server";
import { getToolKind } from "./tool";

const MAX_BODY_BYTES = 1024 * 1024;

function jsonRpcError(status: number, code: number, message: string, headers: HeadersInit = {}): Response {
  return Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status, headers });
}

function listParam(url: URL, name: string): string[] | undefined {
  const value = url.searchParams.get(name);
  return value ? value.split(",").map((v) => v.trim()) : undefined;
}

/** Reads the body up to the size limit; null when it is larger */
async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

function toolCalls(body: unknown): ToolCall[] {
  const messages = Array.isArray(body) ? body : [body];
  return messages
    .filter(
      (m): m is { method: string; params?: { name?: unknown; arguments?: unknown } } =>
        typeof m === "object" && m !== null && m.method === "tools/call"
    )
    .map(({ params }) => ({
      name: typeof params?.name === "string" ? params.name : "",
      args: typeof params?.arguments === "object" && params.arguments !== null ? (params.arguments as Record<string, unknown>) : {},
    }));
}

/** The first rate limit a request exceeds, as a 429 response */
function checkRateLimits(rateLimitId: string, body: unknown): Response | null {
  const tooMany = (message: string) => jsonRpcError(429, -32000, message);

  const general = mcpGeneralLimiter.check(rateLimitId);
  if (!general.allowed) return tooMany(`Rate limit exceeded. Try again in ${general.retryAfterSeconds}s.`);

  for (const { name: toolName, args } of toolCalls(body)) {
    const toolCall = mcpToolCallLimiter.check(rateLimitId);
    if (!toolCall.allowed) return tooMany(`Tool call rate limit exceeded. Try again in ${toolCall.retryAfterSeconds}s.`);

    const kind = getToolKind(toolName, args);
    if (kind === "ai") {
      const ai = mcpAiToolLimiter.check(rateLimitId);
      if (!ai.allowed) return tooMany(`AI tool rate limit exceeded (${toolName}). Try again in ${ai.retryAfterSeconds}s.`);
    } else if (kind === "write") {
      const write = mcpWriteToolLimiter.check(rateLimitId);
      if (!write.allowed) return tooMany(`Write tool rate limit exceeded (${toolName}). Try again in ${write.retryAfterSeconds}s.`);
    }
  }
  return null;
}

/**
 * Streamable HTTP endpoint, stateless: each POST gets a fresh server and transport, and the
 * response is plain JSON once every request in it is answered. There is no SSE stream to
 * resume, so GET is refused and DELETE (session end) is a no-op.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (!appConfig.features.mcp) {
    return Response.json({ error: "MCP is not enabled" }, { status: 404 });
  }

  if (request.method === "GET") {
    return jsonRpcError(
      405,
      -32000,
      "Method not allowed. This MCP server does not support SSE. Use POST for JSON-RPC requests.",
      { "Cache-Control": "no-store", Allow: "POST, DELETE" }
    );
  }
  if (request.method === "DELETE") {
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") {
    return jsonRpcError(405, -32000, "Method not allowed", { Allow: "POST, DELETE" });
  }

  const raw = await readBody(request);
  if (raw === null) return jsonRpcError(413, -32600, "Payload too large. Maximum body size is 1MB.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonRpcError(400, -32700, "Parse error: Invalid JSON");
  }

  const url = new URL(request.url);
  const apiKey = getMcpApiKey(request, url);
  const ctx: McpContext = {
    user: await authenticateApiKey(apiKey),
    filters: { categories: listParam(url, "categories"), tags: listParam(url, "tags"), users: listParam(url, "users") },
    baseUrl: getBaseUrl(),
  };

  const server = createMcpServer(ctx);
  const rateLimitId =
    apiKey || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const limited = checkRateLimits(rateLimitId, body);
  if (limited) {
    await server.close();
    return limited;
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request, { parsedBody: body });
  } catch (error) {
    console.error("MCP error:", error);
    return jsonRpcError(500, -32603, "Internal server error");
  } finally {
    await transport.close();
    await server.close();
  }
}
