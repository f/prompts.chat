import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "@/lib/db";
import { createMcpServer } from "@/lib/mcp/server";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn() },
    botTeam: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    botTeamMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    botTeamLink: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  mcpGeneralLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpToolCallLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpWriteToolLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpAiToolLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
}));

vi.mock("@/../prompts.config", () => ({ default: { features: { mcp: true } } }));
vi.mock("@/lib/seo", () => ({ getBaseUrl: () => "https://prompts.chat" }));

const alice = { id: "user-1", username: "alice", role: "USER", mcpPromptsPublicByDefault: false };

function bot(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    title: `Bot ${id}`,
    description: null,
    content: "Secret instructions",
    type: "BOT",
    botPlatform: "OPENCLAW",
    botPlatforms: ["OPENCLAW"],
    botIcon: null,
    botColor: null,
    installUrl: null,
    botConfig: null,
    isPrivate: false,
    isUnlisted: false,
    isFeatured: false,
    trendingUntil: null,
    delistReason: null,
    deletedAt: null,
    authorId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    author: { username: "alice", name: null, avatar: null, verified: false },
    _count: { votes: 0 },
    category: null,
    tags: [],
    ...overrides,
  };
}

function teamRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    slug: "research-crew",
    title: "Research crew",
    description: null,
    isFeatured: true,
    authorId: "user-1",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    author: { username: "alice", name: "Alice", avatar: null, verified: false },
    members: [
      { role: "Researcher", bot: bot("a") },
      { role: null, bot: bot("b", { botPlatforms: ["HERMES"] }) },
    ],
    links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
    ...overrides,
  };
}

let client: Client;

async function connect(user: typeof alice | null) {
  const server = createMcpServer({ user, filters: {}, baseUrl: "https://prompts.chat" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-team", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
}

async function callTool(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const [content] = result.content as { type: string; text: string }[];
  return { isError: result.isError === true, data: JSON.parse(content.text), result };
}

describe("MCP team tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: typeof db) => unknown) => fn(db)) as never);
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(teamRecord() as never);
    vi.mocked(db.botTeam.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
  });
  afterEach(async () => client?.close());

  it("declares output schemas and marks save_team as an idempotent write", async () => {
    await connect(alice);
    const { tools } = await client.listTools();
    for (const name of ["list_teams", "get_team", "save_team"]) {
      expect(tools.find((tool) => tool.name === name)?.outputSchema).toBeDefined();
    }
    const saveTeam = tools.find((tool) => tool.name === "save_team");
    expect(saveTeam?.inputSchema.required).toEqual(expect.arrayContaining(["title", "members"]));
    expect(saveTeam?.annotations).toMatchObject({ readOnlyHint: false, idempotentHint: true });
  });

  it("lists small team summaries with a cursor", async () => {
    vi.mocked(db.botTeam.findMany).mockResolvedValue([teamRecord()] as never);
    vi.mocked(db.botTeam.count).mockResolvedValue(3);
    await connect(null);

    const { isError, data, result } = await callTool("list_teams", { query: "research", limit: 1 });

    expect(isError).toBe(false);
    expect(data).toMatchObject({ total: 3, count: 1, nextCursor: expect.any(String) });
    expect(data.teams[0]).toEqual({
      id: "team-1",
      slug: "research-crew",
      title: "Research crew",
      description: null,
      author: "Alice",
      isFeatured: true,
      members: [
        { id: "a", name: "Bot a", role: "Researcher" },
        { id: "b", name: "Bot b", role: null },
      ],
      handoffCount: 1,
      link: "https://prompts.chat/bots/teams/research-crew",
    });
    expect(result.structuredContent).toEqual(data);
  });

  it("gets a team with handoffs and an install prompt for a platform", async () => {
    await connect(null);
    const { isError, data, result } = await callTool("get_team", { slug: "research-crew", platform: "OPENCLAW" });

    expect(isError).toBe(false);
    expect(data.handoffs).toEqual([{ from: "a", to: "b", fromName: "Bot a", toName: "Bot b", label: "Brief" }]);
    expect(data.install).toMatchObject({ platform: "OPENCLAW", bots: ["Bot a"], skipped: ["Bot b"] });
    expect(data.install.installPrompt).toContain('Set up the "Research crew" team');
    expect(JSON.stringify(data)).not.toContain("Secret instructions");
    const links = (result.content as { type: string; uri?: string }[]).filter((c) => c.type === "resource_link");
    expect(links).toHaveLength(2);
  });

  it("reports unknown teams and unsupported platforms", async () => {
    await connect(null);
    expect((await callTool("get_team", {})).data.code).toBe("validation_error");
    expect((await callTool("get_team", { slug: "research-crew", platform: "MUSE" })).data.code).toBe("unsupported_platform");
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(null);
    expect((await callTool("get_team", { slug: "nope" })).data.code).toBe("not_found");
  });

  it("save_team requires an API key", async () => {
    await connect(null);
    const { isError, data } = await callTool("save_team", { title: "Crew", members: [{ bot: "a" }, { bot: "b" }] });
    expect(isError).toBe(true);
    expect(data.error).toMatch(/Authentication required/);
    expect(db.botTeam.create).not.toHaveBeenCalled();
  });

  it("save_team creates a team", async () => {
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(null);
    vi.mocked(db.botTeam.create).mockResolvedValue({ id: "team-1" } as never);
    await connect(alice);

    const { isError, data } = await callTool("save_team", {
      title: "Research crew",
      members: [{ bot: "a_bot-a", role: "Researcher" }, { bot: "b" }],
      handoffs: [{ from: "a", to: "b", label: "Brief" }],
    });

    expect(isError).toBe(false);
    expect(data).toMatchObject({ success: true, action: "created", team: { slug: "research-crew" } });
    expect(db.botTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ members: { create: [{ botId: "a", role: "Researcher", order: 0 }, { botId: "b", role: null, order: 1 }] } }),
      })
    );
  });

  it("save_team is a no-op when nothing changed", async () => {
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(teamRecord() as never);
    await connect(alice);

    const { data } = await callTool("save_team", { slug: "research-crew", title: "Research crew", members: [{ bot: "a", role: "Researcher" }, { bot: "b" }] });

    expect(data).toMatchObject({ success: true, action: "unchanged", changedFields: [] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("save_team rejects invalid handoffs", async () => {
    await connect(alice);
    const { isError, data } = await callTool("save_team", {
      title: "Crew",
      members: [{ bot: "a" }, { bot: "b" }],
      handoffs: [{ from: "a", to: "a" }],
    });
    expect(isError).toBe(true);
    expect(data.code).toBe("validation_error");
  });
});
