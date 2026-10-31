import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "@/lib/db";
import { createPrompt, updatePrompt, promptCreateSchema } from "@/lib/prompt-write";
import { isAISearchEnabled, semanticSearch } from "@/lib/ai/embeddings";
import { createMcpServer } from "@/lib/mcp/server";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), count: vi.fn() },
    tag: { findUnique: vi.fn(), create: vi.fn() },
    category: { findUnique: vi.fn() },
    botPairing: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/ai/embeddings", () => ({ isAISearchEnabled: vi.fn(), semanticSearch: vi.fn() }));

vi.mock("@/lib/prompt-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prompt-write")>();
  return { ...actual, createPrompt: vi.fn(), updatePrompt: vi.fn() };
});

vi.mock("@/lib/rate-limit", () => ({
  mcpGeneralLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpToolCallLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpWriteToolLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpAiToolLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
}));

vi.mock("@/../prompts.config", () => ({ default: { features: { mcp: true } } }));

vi.mock("@/lib/seo", () => ({ getBaseUrl: () => "https://prompts.chat" }));

const alice = { id: "user-1", username: "alice", role: "USER", mcpPromptsPublicByDefault: false };

function botRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "bot-1",
    slug: "inbox-triage",
    title: "Inbox Triage",
    description: null,
    content: "Triage my inbox.",
    botPlatform: "OPENCLAW",
    botPlatforms: ["OPENCLAW"],
    botIcon: null,
    botColor: null,
    installUrl: null,
    computerRequirement: "NONE",
    botConfig: { routines: [], skills: [], connectors: [] },
    isPrivate: true,
    isUnlisted: false,
    isFeatured: false,
    trendingUntil: null,
    delistReason: null,
    deletedAt: null,
    authorId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    author: { username: "alice", name: "Alice", avatar: null, verified: false },
    _count: { votes: 0 },
    category: null,
    tags: [],
    ...overrides,
  };
}

let client: Client;

async function connect(authenticatedUser: typeof alice | null) {
  const server = createMcpServer({ user: authenticatedUser, filters: {}, baseUrl: "https://prompts.chat" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-bot", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
}

async function callTool(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const [content] = result.content as { type: string; text: string }[];
  return { isError: result.isError === true, data: JSON.parse(content.text) };
}

describe("MCP bot tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.botPairing.findMany).mockResolvedValue([]);
  });
  afterEach(async () => client?.close());

  it("lists the bot tools", async () => {
    await connect(alice);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["save_bot", "list_my_bots", "get_my_bot"]));
    const saveBot = tools.find((tool) => tool.name === "save_bot");
    expect(saveBot?.inputSchema.required).toEqual(expect.arrayContaining(["name", "instructions", "platforms"]));
  });

  it.each([
    ["save_bot", { name: "A", instructions: "B", platforms: ["OPENCLAW"] }],
    ["list_my_bots", {}],
    ["get_my_bot", { id: "bot-1" }],
  ])("%s requires an API key", async (name, args) => {
    await connect(null);
    const { isError, data } = await callTool(name, args);
    expect(isError).toBe(true);
    expect(data.error).toMatch(/Authentication required/);
    expect(db.prompt.findFirst).not.toHaveBeenCalled();
    expect(createPrompt).not.toHaveBeenCalled();
  });

  describe("save_bot", () => {
    it("creates a new private bot through the web creation flow", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
      vi.mocked(db.category.findUnique).mockResolvedValue({ id: "cat-1" } as never);
      vi.mocked(db.tag.findUnique).mockResolvedValueOnce({ id: "tag-1" } as never).mockResolvedValueOnce(null);
      vi.mocked(db.tag.create).mockResolvedValue({ id: "tag-2" } as never);
      vi.mocked(createPrompt).mockResolvedValue({ ok: true, data: { id: "bot-1" } } as never);
      vi.mocked(db.prompt.findUniqueOrThrow).mockResolvedValue(botRecord() as never);
      await connect(alice);

      const { isError, data } = await callTool("save_bot", {
        name: "  Inbox Triage ",
        instructions: "Triage my inbox.",
        platforms: ["OPENCLAW"],
        icon: "inbox",
        routines: [{ name: "Morning", type: "schedule", trigger: "0 8 * * *", prompt: "Triage the inbox." }],
        skills: [{ name: "gmail" }],
        connectors: ["Gmail"],
        category: "productivity",
        tags: ["Email", "Inbox"],
      });

      expect(isError).toBe(false);
      expect(data).toMatchObject({ success: true, action: "created", link: null, bot: { id: "bot-1", slug: "inbox-triage", isPrivate: true } });
      const [writer, body] = vi.mocked(createPrompt).mock.calls[0];
      expect(writer).toEqual({ id: "user-1", role: "USER" });
      expect(body).toEqual({
        type: "BOT",
        title: "Inbox Triage",
        description: undefined,
        content: "Triage my inbox.",
        botPlatforms: ["OPENCLAW"],
        botIcon: "inbox",
        botColor: undefined,
        installUrl: undefined,
        botConfig: {
          routines: [{ name: "Morning", type: "schedule", trigger: "0 8 * * *", triggerLabel: "", prompt: "Triage the inbox." }],
          skills: [{ name: "gmail", description: "", source: "" }],
          connectors: ["Gmail"],
        },
        categoryId: "cat-1",
        tagIds: ["tag-1", "tag-2"],
        isPrivate: true,
      });
      expect(promptCreateSchema.safeParse(body).success).toBe(true);
    });

    it("is a no-op when called again with the same definition", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);
      await connect(alice);

      const { isError, data } = await callTool("save_bot", { name: "Inbox Triage", instructions: "Triage my inbox.", platforms: ["OPENCLAW"] });

      expect(isError).toBe(false);
      expect(data).toMatchObject({ success: true, action: "unchanged", changedFields: [] });
      expect(createPrompt).not.toHaveBeenCalled();
      expect(updatePrompt).not.toHaveBeenCalled();
    });

    it("updates the caller's bot matched by slug", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);
      vi.mocked(updatePrompt).mockResolvedValue({ ok: true, data: { id: "bot-1" } } as never);
      vi.mocked(db.prompt.findUniqueOrThrow).mockResolvedValue(
        botRecord({ title: "Inbox Zero", botPlatforms: ["OPENCLAW", "HERMES"], isPrivate: false }) as never
      );
      await connect(alice);

      const { data } = await callTool("save_bot", {
        slug: "inbox-triage",
        name: "Inbox Zero",
        instructions: "Triage my inbox.",
        platforms: ["HERMES", "OPENCLAW"],
        isPrivate: false,
      });

      expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toMatchObject({ authorId: "user-1", type: "BOT", slug: "inbox-triage" });
      expect(updatePrompt).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "bot-1", {
        title: "Inbox Zero",
        botPlatforms: ["HERMES", "OPENCLAW"],
        isPrivate: false,
      });
      expect(data).toMatchObject({
        action: "updated",
        changedFields: ["title", "botPlatforms", "isPrivate"],
        link: "https://prompts.chat/bots/bot-1_inbox-triage",
      });
    });

    it("reports web-flow errors with their code", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
      vi.mocked(createPrompt).mockResolvedValue({
        ok: false,
        status: 409,
        body: { error: "content_exists", message: "A prompt with similar content already exists", existingPromptId: "p-9" },
      });
      await connect(alice);

      const { isError, data } = await callTool("save_bot", { name: "Copy", instructions: "Same text", platforms: ["MUSE"] });

      expect(isError).toBe(true);
      expect(data).toEqual({ error: "A prompt with similar content already exists", code: "content_exists", existingPromptId: "p-9" });
    });

    it("rejects an unknown category before writing", async () => {
      vi.mocked(db.category.findUnique).mockResolvedValue(null);
      await connect(alice);

      const { isError, data } = await callTool("save_bot", { name: "A", instructions: "B", platforms: ["DOTS"], category: "nope" });

      expect(isError).toBe(true);
      expect(data.code).toBe("invalid_category");
      expect(createPrompt).not.toHaveBeenCalled();
    });

    it("rejects platforms outside BotPlatform", async () => {
      await connect(alice);

      const result = await client.callTool({ name: "save_bot", arguments: { name: "A", instructions: "B", platforms: ["SKYNET"] } });

      expect(result.isError).toBe(true);
      expect(createPrompt).not.toHaveBeenCalled();
    });

    it("saves the computer requirement, and keeps the stored one when it is omitted", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
      vi.mocked(createPrompt).mockResolvedValue({ ok: true, data: { id: "bot-1" } } as never);
      vi.mocked(db.prompt.findUniqueOrThrow).mockResolvedValue(botRecord({ computerRequirement: "CLOUD" }) as never);
      await connect(alice);

      const created = await callTool("save_bot", { name: "Desk", instructions: "Use the browser.", platforms: ["MUSE"], computerRequirement: "CLOUD" });

      expect(vi.mocked(createPrompt).mock.calls[0][1]).toMatchObject({ computerRequirement: "CLOUD" });
      expect(created.data.bot).toMatchObject({ computerRequirement: "CLOUD" });

      vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord({ computerRequirement: "CLOUD" }) as never);
      const unchanged = await callTool("save_bot", { name: "Inbox Triage", instructions: "Triage my inbox.", platforms: ["OPENCLAW"] });
      expect(unchanged.data).toMatchObject({ action: "unchanged", changedFields: [] });

      vi.mocked(updatePrompt).mockResolvedValue({ ok: true, data: { id: "bot-1" } } as never);
      const updated = await callTool("save_bot", {
        name: "Inbox Triage",
        instructions: "Triage my inbox.",
        platforms: ["OPENCLAW"],
        computerRequirement: "LOCAL",
      });
      expect(updatePrompt).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "bot-1", { computerRequirement: "LOCAL" });
      expect(updated.data).toMatchObject({ action: "updated", changedFields: ["computerRequirement"] });
    });

    it("rejects an unknown computer requirement", async () => {
      await connect(alice);

      const result = await client.callTool({
        name: "save_bot",
        arguments: { name: "A", instructions: "B", platforms: ["MUSE"], computerRequirement: "DESKTOP" },
      });

      expect(result.isError).toBe(true);
      expect(createPrompt).not.toHaveBeenCalled();
    });
  });

  it("list_my_bots returns the caller's bots including private ones", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([botRecord()] as never);
    vi.mocked(db.prompt.count).mockResolvedValue(1);
    await connect(alice);

    const { data } = await callTool("list_my_bots", { limit: 10 });

    const where = { authorId: "user-1", type: "BOT", deletedAt: null };
    expect(vi.mocked(db.prompt.findMany).mock.calls[0][0]).toMatchObject({ where, skip: 0, take: 10 });
    expect(data).toEqual({
      total: 1,
      count: 1,
      bots: [
        {
          id: "bot-1",
          slug: "inbox-triage",
          name: "Inbox Triage",
          description: null,
          platforms: ["OPENCLAW"],
          computerRequirement: "NONE",
          isPrivate: true,
          isUnlisted: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          link: "https://prompts.chat/bots/bot-1_inbox-triage",
        },
      ],
    });
  });

  describe("get_my_bot", () => {
    it("returns the full definition of the caller's bot", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);
      await connect(alice);

      const { data } = await callTool("get_my_bot", { slug: "inbox-triage" });

      expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toMatchObject({ authorId: "user-1", slug: "inbox-triage" });
      expect(data).toMatchObject({ id: "bot-1", instructions: "Triage my inbox.", platforms: ["OPENCLAW"], isPrivate: true, routines: [] });
    });

    it("needs an id or a slug", async () => {
      await connect(alice);
      const { isError } = await callTool("get_my_bot", {});
      expect(isError).toBe(true);
    });

    it("does not reveal other users' bots", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
      await connect(alice);
      const { isError, data } = await callTool("get_my_bot", { id: "bot-2" });
      expect(isError).toBe(true);
      expect(data.error).toMatch(/not found/);
    });
  });

  describe("search_bots", () => {
    it("filters public bots by platform, category and tags, and pages with a cursor", async () => {
      vi.mocked(db.prompt.findMany).mockResolvedValue([botRecord({ isPrivate: false })] as never);
      vi.mocked(db.prompt.count).mockResolvedValue(3);
      await connect(null);

      const first = await client.callTool({
        name: "search_bots",
        arguments: { query: "inbox", platform: "OPENCLAW", category: "productivity", tags: ["email"], limit: 1 },
      });

      const args = vi.mocked(db.prompt.findMany).mock.calls[0][0];
      expect(args).toMatchObject({
        skip: 0,
        take: 1,
        where: {
          type: "BOT",
          isPrivate: false,
          isUnlisted: false,
          deletedAt: null,
          botPlatforms: { has: "OPENCLAW" },
          category: { OR: [{ slug: "productivity" }, { parent: { slug: "productivity" } }] },
          AND: [{ tags: { some: { tag: { slug: "email" } } } }],
        },
      });
      const data = first.structuredContent as { searchMode: string; total: number; bots: unknown[]; nextCursor: string };
      expect(data).toMatchObject({
        searchMode: "keyword",
        total: 3,
        count: 1,
        bots: [{ id: "bot-1", name: "Inbox Triage", platforms: ["OPENCLAW"], platformNames: ["OpenClaw"], author: "Alice", link: "https://prompts.chat/bots/bot-1_inbox-triage" }],
      });
      expect(first.content).toContainEqual(expect.objectContaining({ type: "resource_link", uri: "prompts-chat://bots/bot-1" }));

      await client.callTool({ name: "search_bots", arguments: { query: "inbox", limit: 1, cursor: data.nextCursor } });
      expect(vi.mocked(db.prompt.findMany).mock.calls[1][0]).toMatchObject({ skip: 1, take: 1 });
    });

    it("filters by computer requirement and returns it in each summary", async () => {
      vi.mocked(db.prompt.findMany).mockResolvedValue([botRecord({ isPrivate: false, computerRequirement: "LOCAL" })] as never);
      vi.mocked(db.prompt.count).mockResolvedValue(1);
      await connect(null);

      const { data } = await callTool("search_bots", { computerRequirement: "LOCAL" });

      expect(vi.mocked(db.prompt.findMany).mock.calls[0][0]?.where).toMatchObject({ type: "BOT", computerRequirement: "LOCAL" });
      expect(data.bots).toEqual([expect.objectContaining({ id: "bot-1", computerRequirement: "LOCAL" })]);
    });

    it("falls back to keyword search when AI search is off", async () => {
      vi.mocked(isAISearchEnabled).mockResolvedValue(false);
      vi.mocked(db.prompt.findMany).mockResolvedValue([]);
      vi.mocked(db.prompt.count).mockResolvedValue(0);
      await connect(null);

      const { data } = await callTool("search_bots", { query: "triage", semantic: true });

      expect(data).toMatchObject({ searchMode: "keyword", count: 0, notice: expect.stringMatching(/not enabled/) });
      expect(semanticSearch).not.toHaveBeenCalled();
    });

    it("ranks by embeddings when semantic search is available", async () => {
      vi.mocked(isAISearchEnabled).mockResolvedValue(true);
      vi.mocked(semanticSearch).mockResolvedValue([{ id: "bot-2" }, { id: "bot-1" }] as never);
      vi.mocked(db.prompt.findMany).mockResolvedValue([botRecord({ isPrivate: false }), botRecord({ id: "bot-2", title: "Second", isPrivate: false })] as never);
      await connect(null);

      const { data } = await callTool("search_bots", { query: "triage", semantic: true, platform: "MUSE", limit: 1 });

      expect(vi.mocked(semanticSearch).mock.calls[0]).toEqual([
        "triage",
        2,
        { where: { type: "BOT", isPrivate: false, isUnlisted: false, deletedAt: null, botPlatforms: { has: "MUSE" } } },
      ]);
      expect(data).toMatchObject({ searchMode: "semantic", count: 1, bots: [{ id: "bot-2" }], nextCursor: expect.any(String) });
    });
  });

  describe("get_bot", () => {
    it("returns a public bot with install options and pairings, without owner fields", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(
        botRecord({ isPrivate: false, authorId: "user-2", botPlatforms: ["GROK_BOT", "HERMES"], installUrl: "https://grok.com/t/1" }) as never
      );
      await connect(null);

      const result = await client.callTool({ name: "get_bot", arguments: { id: "bot-1_inbox-triage" } });

      expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toEqual({ type: "BOT", deletedAt: null, OR: [{ isPrivate: false }], id: "bot-1" });
      const data = result.structuredContent as Record<string, unknown>;
      expect(data).toMatchObject({
        id: "bot-1",
        install: [
          { platform: "GROK_BOT", installUrl: "https://grok.com/t/1", command: null },
          { platform: "HERMES", installUrl: null, command: "hermes skills install https://prompts.chat/bots/bot-1_inbox-triage/SKILL.md" },
        ],
        betterTogetherWith: [],
      });
      expect(data).not.toHaveProperty("isPrivate");
    });

    it("lets the owner see a private bot by slug", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);
      await connect(alice);

      const { data } = await callTool("get_bot", { slug: "inbox-triage" });

      expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toMatchObject({
        OR: [{ isPrivate: false }, { authorId: "user-1" }],
        slug: "inbox-triage",
      });
      expect(data).toMatchObject({ id: "bot-1", isPrivate: true });
    });

    it("reports a missing bot as a tool error", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
      await connect(null);
      const { isError, data } = await callTool("get_bot", { id: "nope" });
      expect(isError).toBe(true);
      expect(data).toEqual({ error: "Bot not found", code: "not_found" });
    });
  });
});
