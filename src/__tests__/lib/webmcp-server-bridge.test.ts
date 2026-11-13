import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { mcpAiToolLimiter, mcpGeneralLimiter, mcpToolCallLimiter, mcpWriteToolLimiter } from "@/lib/rate-limit";
import { handleMcpRequest } from "@/lib/mcp/http";
import { toolData } from "@/lib/webmcp/server-client";
import { createTools, PROXIED_SERVER_TOOLS } from "@/lib/webmcp/tools";
import type { WebMcpEnv } from "@/lib/webmcp/types";

/** The browser tools against the real /api/mcp handler and MCP server, with only the database mocked */

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    tag: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    category: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  mcpGeneralLimiter: { check: vi.fn() },
  mcpToolCallLimiter: { check: vi.fn() },
  mcpWriteToolLimiter: { check: vi.fn() },
  mcpAiToolLimiter: { check: vi.fn() },
}));

const config = vi.hoisted(() => ({ features: { mcp: true, promptEnhancer: true } }));
vi.mock("@/../prompts.config", () => ({ default: config }));
vi.mock("@/lib/config", () => ({ getConfig: async () => config }));
vi.mock("@/lib/seo", () => ({ getBaseUrl: () => "https://prompts.chat" }));

function env(path: string): WebMcpEnv {
  const url = new URL(path, "https://prompts.chat");
  return {
    // jsdom's AbortSignal is not one Node's Request accepts (Node 24 rejects it), so it stays out of the server side
    fetch: ((input: string, init?: RequestInit) =>
      handleMcpRequest(new Request(new URL(input, url), { ...init, signal: undefined }))) as typeof fetch,
    location: () => url,
    document: () => document,
    navigate: vi.fn(),
    refresh: vi.fn(),
    setLocale: vi.fn(),
    locales: ["en"],
  };
}

const prompt = {
  id: "p1",
  slug: "poem",
  title: "Poem",
  description: null,
  content: "Write a ${style:haiku} about ${topic}",
  type: "TEXT",
  structuredFormat: null,
  isPrivate: false,
  author: { username: "alice", name: null },
  category: null,
  tags: [],
};

describe("WebMCP tools against /api/mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.features.mcp = true;
    for (const limiter of [mcpGeneralLimiter, mcpToolCallLimiter, mcpWriteToolLimiter, mcpAiToolLimiter]) {
      vi.mocked(limiter.check).mockReturnValue({ allowed: true, remaining: 1 });
    }
  });

  it("mirrors every allowlisted tool from the server's tools/list", async () => {
    const tools = await createTools(env("/"));
    const mirrored = tools.filter((tool) => (PROXIED_SERVER_TOOLS as readonly string[]).includes(tool.name));
    expect(mirrored.map((tool) => tool.name).sort()).toEqual([...PROXIED_SERVER_TOOLS].sort());
    expect(tools.map((tool) => tool.name)).not.toContain("save_prompt");
    for (const tool of mirrored) expect(tool.inputSchema.type).toBe("object");
  });

  it("fills a prompt template through the server's get_prompt, anonymously", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(prompt as never);
    const site = env("/prompts/p1_poem");
    const fill = (await createTools(site)).find((tool) => tool.name === "fill_prompt_variables")!;

    const data = toolData(await fill.execute({ variables: { topic: "the sea" } }));

    expect(data).toMatchObject({ id: "p1", content: "Write a haiku about the sea", originalContent: prompt.content });
    expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]).toMatchObject({
      where: { id: "p1", deletedAt: null, OR: [{ isPrivate: false, isUnlisted: false }] },
    });
  });

  it("falls back to page tools when MCP is disabled", async () => {
    config.features.mcp = false;
    const names = (await createTools(env("/"))).map((tool) => tool.name);
    expect(names).toContain("get_current_page");
    expect(names).not.toContain("search_prompts");
  });
});
