import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { mcpAiToolLimiter, mcpGeneralLimiter, mcpToolCallLimiter, mcpWriteToolLimiter } from "@/lib/rate-limit";
import { clearAuthCache } from "@/lib/mcp/auth";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    tag: { findUnique: vi.fn(), create: vi.fn() },
    category: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  mcpGeneralLimiter: { check: vi.fn() },
  mcpToolCallLimiter: { check: vi.fn() },
  mcpWriteToolLimiter: { check: vi.fn() },
  mcpAiToolLimiter: { check: vi.fn() },
}));

const config = vi.hoisted(() => ({ features: { mcp: true } }));
vi.mock("@/../prompts.config", () => ({ default: config }));

vi.mock("@/lib/seo", () => ({ getBaseUrl: () => "https://prompts.chat" }));

const API_KEY = `pchat_${"a".repeat(64)}`;
const ALICE = { id: "user-1", username: "alice", role: "USER", mcpPromptsPublicByDefault: false };

async function loadRoute() {
  return import("@/app/api/mcp/route");
}

function rpc(body: unknown, { headers = {}, url = "http://localhost/api/mcp" }: { headers?: Record<string, string>; url?: string } = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
};

const callSaveBot = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: { name: "save_bot", arguments: { name: "A", instructions: "B", platforms: ["OPENCLAW"] } },
};

describe("MCP route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthCache();
    config.features.mcp = true;
    for (const limiter of [mcpGeneralLimiter, mcpToolCallLimiter, mcpWriteToolLimiter, mcpAiToolLimiter]) {
      vi.mocked(limiter.check).mockReturnValue({ allowed: true, remaining: 1 });
    }
  });

  describe("methods", () => {
    it("refuses GET with an uncached JSON-RPC 405, since there is no SSE stream", async () => {
      const { GET } = await loadRoute();
      const res = await GET(new Request("http://localhost/api/mcp"));

      expect(res.status).toBe(405);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({
        jsonrpc: "2.0",
        error: { code: -32000, message: expect.stringContaining("Method not allowed") },
        id: null,
      });
    });

    it("accepts DELETE as a no-op session end", async () => {
      const { DELETE } = await loadRoute();
      const res = await DELETE(new Request("http://localhost/api/mcp", { method: "DELETE" }));
      expect(res.status).toBe(204);
    });

    it.each(["PUT", "PATCH"] as const)("refuses %s", async (method) => {
      const route = await loadRoute();
      const res = await route[method](new Request("http://localhost/api/mcp", { method, body: "{}" }));
      expect(res.status).toBe(405);
    });

    it("returns 404 when MCP is disabled", async () => {
      config.features.mcp = false;
      const { POST } = await loadRoute();
      const res = await POST(rpc(initialize));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "MCP is not enabled" });
    });
  });

  describe("POST", () => {
    it("answers initialize with plain JSON and the server metadata", async () => {
      const { POST } = await loadRoute();
      const res = await POST(rpc(initialize));

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      expect(res.headers.get("mcp-session-id")).toBeNull();
      const { result } = await res.json();
      expect(result.serverInfo).toMatchObject({
        name: "prompts-chat",
        title: "prompts.chat",
        websiteUrl: "https://prompts.chat",
        icons: [{ src: "https://prompts.chat/logo.svg", mimeType: "image/svg+xml" }],
      });
      expect(result.capabilities).toMatchObject({ tools: {}, prompts: {}, resources: {} });
      expect(result.instructions).toMatch(/save_bot/);
    });

    it("serves sequential requests without a session", async () => {
      const { POST } = await loadRoute();
      await POST(rpc(initialize));
      const res = await POST(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }));

      const { result } = await res.json();
      expect(result.tools.map((t: { name: string }) => t.name)).toEqual([
        "search_prompts",
        "get_prompt",
        "save_prompt",
        "improve_prompt",
        "search_skills",
        "get_skill",
        "save_skill",
        "add_file_to_skill",
        "update_skill_file",
        "remove_file_from_skill",
        "search_bots",
        "get_bot",
        "save_bot",
        "list_my_bots",
        "get_my_bot",
        "list_teams",
        "get_team",
        "save_team",
      ]);
    });

    it("rejects invalid JSON with a parse error", async () => {
      const { POST } = await loadRoute();
      const res = await POST(rpc("{not json"));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe(-32700);
    });

    it("rejects bodies over 1MB", async () => {
      const { POST } = await loadRoute();
      const res = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "ping", params: { pad: "x".repeat(1024 * 1024) } }));
      expect(res.status).toBe(413);
      expect((await res.json()).error.message).toMatch(/1MB/);
    });

    it.each([
      ["PROMPTS_API_KEY header", { headers: { PROMPTS_API_KEY: API_KEY } }],
      ["prompts-api-key header", { headers: { "prompts-api-key": API_KEY } }],
      ["Authorization bearer", { headers: { authorization: `Bearer ${API_KEY}` } }],
      ["api_key query parameter", { url: `http://localhost/api/mcp?api_key=${API_KEY}` }],
    ])("authenticates with the %s", async (_label, options) => {
      vi.mocked(db.user.findUnique).mockResolvedValue(ALICE as never);
      vi.mocked(db.prompt.findMany).mockResolvedValue([]);
      vi.mocked(db.prompt.count).mockResolvedValue(0);
      const { POST } = await loadRoute();

      const res = await POST(rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_my_bots", arguments: {} } }, options));

      expect(vi.mocked(db.user.findUnique).mock.calls[0][0]).toMatchObject({ where: { apiKey: API_KEY } });
      const { result } = await res.json();
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toMatchObject({ total: 0, bots: [] });
    });

    it("rejects write tools without an API key as a tool error", async () => {
      const { POST } = await loadRoute();
      const { result } = await (await POST(rpc(callSaveBot))).json();
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text)).toMatchObject({ code: "unauthorized" });
    });
  });

  describe("rate limits", () => {
    it("applies the general limit to every POST", async () => {
      vi.mocked(mcpGeneralLimiter.check).mockReturnValue({ allowed: false, retryAfterSeconds: 7 });
      const { POST } = await loadRoute();
      const res = await POST(rpc(initialize));
      expect(res.status).toBe(429);
      expect((await res.json()).error.message).toBe("Rate limit exceeded. Try again in 7s.");
    });

    it("applies the write limit to write tools, keyed by API key", async () => {
      vi.mocked(mcpWriteToolLimiter.check).mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
      const { POST } = await loadRoute();

      const res = await POST(rpc(callSaveBot, { headers: { PROMPTS_API_KEY: API_KEY } }));

      expect(res.status).toBe(429);
      expect((await res.json()).error.message).toBe("Write tool rate limit exceeded (save_bot). Try again in 30s.");
      expect(mcpWriteToolLimiter.check).toHaveBeenCalledWith(API_KEY);
    });

    it("applies the AI limit to semantic search_bots, which calls the embeddings API", async () => {
      vi.mocked(mcpAiToolLimiter.check).mockReturnValue({ allowed: false, retryAfterSeconds: 45 });
      const { POST } = await loadRoute();

      const res = await POST(
        rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "search_bots", arguments: { query: "inbox", semantic: true } } })
      );

      expect(res.status).toBe(429);
      expect((await res.json()).error.message).toBe("AI tool rate limit exceeded (search_bots). Try again in 45s.");
      expect(db.prompt.findMany).not.toHaveBeenCalled();
    });

    it("rate limits keyword search_bots as a read", async () => {
      vi.mocked(mcpAiToolLimiter.check).mockReturnValue({ allowed: false, retryAfterSeconds: 45 });
      vi.mocked(db.prompt.findMany).mockResolvedValue([]);
      vi.mocked(db.prompt.count).mockResolvedValue(0);
      const { POST } = await loadRoute();

      const res = await POST(
        rpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "search_bots", arguments: { query: "inbox", semantic: false } } })
      );

      expect(res.status).toBe(200);
      expect(mcpAiToolLimiter.check).not.toHaveBeenCalled();
    });

    it("does not apply the write limit to read tools", async () => {
      vi.mocked(mcpWriteToolLimiter.check).mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
      vi.mocked(db.prompt.findMany).mockResolvedValue([]);
      vi.mocked(db.prompt.count).mockResolvedValue(0);
      const { POST } = await loadRoute();

      const res = await POST(
        rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "search_bots", arguments: {} } }, { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })
      );

      expect(res.status).toBe(200);
      expect(mcpWriteToolLimiter.check).not.toHaveBeenCalled();
      expect(mcpToolCallLimiter.check).toHaveBeenCalledWith("1.2.3.4");
    });
  });
});
