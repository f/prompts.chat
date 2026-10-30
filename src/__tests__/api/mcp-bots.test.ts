import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "@/lib/db";
import { createPrompt, updatePrompt, promptCreateSchema } from "@/lib/prompt-write";
import { createServer } from "@/pages/api/mcp";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), count: vi.fn() },
    tag: { findUnique: vi.fn(), create: vi.fn() },
    category: { findUnique: vi.fn() },
  },
}));

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
  const server = createServer({ authenticatedUser });
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
  beforeEach(() => vi.clearAllMocks());
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
});
