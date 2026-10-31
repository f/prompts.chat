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
    category: { findUnique: vi.fn() },
    tag: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
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
    computerRequirement: "NONE",
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
      { role: "Researcher", description: "Finds sources", bot: bot("a") },
      { role: null, description: null, bot: bot("b", { botPlatforms: ["HERMES"] }) },
    ],
    links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
    category: null,
    tags: [],
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
      category: null,
      tags: [],
      members: [
        { id: "a", name: "Bot a", role: "Researcher", computerRequirement: "NONE" },
        { id: "b", name: "Bot b", role: null, computerRequirement: "NONE" },
      ],
      handoffCount: 1,
      link: "https://prompts.chat/bots/teams/research-crew",
    });
    expect(result.structuredContent).toEqual(data);
  });

  it("list_teams filters by category, tags and keywords", async () => {
    vi.mocked(db.botTeam.findMany).mockResolvedValue([
      teamRecord({
        category: { id: "cat-1", name: "Coding", slug: "coding", parent: null },
        tags: [{ tag: { id: "tag-1", name: "Agents", slug: "agents", color: "#000000" } }],
      }),
    ] as never);
    vi.mocked(db.botTeam.count).mockResolvedValue(1);
    await connect(null);

    const { isError, data } = await callTool("list_teams", { query: "review", category: "coding", tags: ["agents", "ci"] });

    expect(isError).toBe(false);
    expect(data.teams[0]).toMatchObject({
      category: { name: "Coding", slug: "coding", parent: null },
      tags: [{ name: "Agents", slug: "agents" }],
    });
    const where = vi.mocked(db.botTeam.findMany).mock.calls[0][0]!.where;
    expect(where).toMatchObject({
      category: { OR: [{ slug: "coding" }, { parent: { slug: "coding" } }] },
      AND: [{ tags: { some: { tag: { slug: "agents" } } } }, { tags: { some: { tag: { slug: "ci" } } } }],
    });
    expect(JSON.stringify(where)).toContain("review");
  });

  it("gets a team with handoffs and an install prompt for a platform", async () => {
    await connect(null);
    const { isError, data, result } = await callTool("get_team", { slug: "research-crew", platform: "OPENCLAW" });

    expect(isError).toBe(false);
    expect(data.handoffs).toEqual([{ from: "a", to: "b", fromName: "Bot a", toName: "Bot b", label: "Brief" }]);
    expect(data.install).toMatchObject({ platform: "OPENCLAW", bots: ["Bot a"], skipped: ["Bot b"] });
    expect(data.install.installPrompt).toContain('Set up the "Research crew" team');
    expect(data.install.installPrompt).toContain("   Team responsibility: Finds sources");
    expect(JSON.stringify(data)).not.toContain("Secret instructions");
    const links = (result.content as { type: string; uri?: string }[]).filter((c) => c.type === "resource_link");
    expect(links).toHaveLength(2);
  });

  it("get_team shows which members need a computer, in its output and install prompt", async () => {
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(
      teamRecord({
        members: [
          { role: "Researcher", description: null, bot: bot("a", { computerRequirement: "CLOUD" }) },
          { role: null, description: null, bot: bot("b", { computerRequirement: "LOCAL" }) },
        ],
      }) as never
    );
    await connect(null);

    const { isError, data } = await callTool("get_team", { slug: "research-crew", platform: "OPENCLAW" });

    expect(isError).toBe(false);
    expect(data.members).toEqual([
      expect.objectContaining({ id: "a", computerRequirement: "CLOUD" }),
      expect.objectContaining({ id: "b", computerRequirement: "LOCAL" }),
    ]);
    expect(data.install.installPrompt).toContain('"Bot a" (Researcher) [needs a cloud computer]');
    expect(data.install.installPrompt).toContain("Bots that need a cloud computer");
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
      members: [{ bot: "a_bot-a", role: "Researcher", description: "Finds sources" }, { bot: "b" }],
      handoffs: [{ from: "a", to: "b", label: "Brief" }],
    });

    expect(isError).toBe(false);
    expect(data).toMatchObject({ success: true, action: "created", team: { slug: "research-crew" } });
    expect(db.botTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          members: {
            create: [
              { botId: "a", role: "Researcher", description: "Finds sources", order: 0 },
              { botId: "b", role: null, description: null, order: 1 },
            ],
          },
        }),
      })
    );
  });

  it("save_team sets the category by slug and tags by name", async () => {
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(null);
    vi.mocked(db.botTeam.create).mockResolvedValue({ id: "team-1" } as never);
    vi.mocked(db.category.findUnique).mockResolvedValue({ id: "cat-1" } as never);
    vi.mocked(db.tag.findMany).mockResolvedValueOnce([
      { id: "tag-1", name: "Agents", slug: "agents" },
      { id: "tag-2", name: "Code Review", slug: "code-review" },
    ] as never);
    vi.mocked(db.tag.findMany).mockResolvedValueOnce([{ id: "tag-1" }, { id: "tag-2" }] as never);
    await connect(alice);

    const { isError, data } = await callTool("save_team", {
      title: "Review crew",
      category: "coding",
      tags: ["agents", "code-review"],
      members: [{ bot: "a" }, { bot: "b" }],
    });

    expect(isError).toBe(false);
    expect(data.unknownTags).toBeUndefined();
    expect(db.tag.create).not.toHaveBeenCalled();
    expect(vi.mocked(db.botTeam.create).mock.calls[0][0]).toMatchObject({
      data: { categoryId: "cat-1", tags: { create: [{ tagId: "tag-1" }, { tagId: "tag-2" }] } },
    });
  });

  it("save_team skips unknown tags and reports them instead of creating them", async () => {
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(null);
    vi.mocked(db.botTeam.create).mockResolvedValue({ id: "team-1" } as never);
    vi.mocked(db.tag.findMany).mockResolvedValueOnce([{ id: "tag-1", name: "Agents", slug: "agents" }] as never);
    vi.mocked(db.tag.findMany).mockResolvedValueOnce([{ id: "tag-1" }] as never);
    await connect(alice);

    const { isError, data } = await callTool("save_team", {
      title: "Review crew",
      tags: ["Agents", "Made Up"],
      members: [{ bot: "a" }, { bot: "b" }],
    });

    expect(isError).toBe(false);
    expect(data.unknownTags).toEqual(["Made Up"]);
    expect(data.warning).toMatch(/Made Up/);
    expect(db.tag.create).not.toHaveBeenCalled();
    expect(vi.mocked(db.botTeam.create).mock.calls[0][0]).toMatchObject({ data: { tags: { create: [{ tagId: "tag-1" }] } } });
  });

  it("save_team rejects an unknown category", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(null);
    await connect(alice);
    const { isError, data } = await callTool("save_team", { title: "Crew", category: "nope", members: [{ bot: "a" }, { bot: "b" }] });
    expect(isError).toBe(true);
    expect(data.code).toBe("invalid_category");
    expect(db.botTeam.create).not.toHaveBeenCalled();
  });

  it("save_team is a no-op when nothing changed", async () => {
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(teamRecord() as never);
    await connect(alice);

    const { data } = await callTool("save_team", { slug: "research-crew", title: "Research crew", members: [{ bot: "a", role: "Researcher" }, { bot: "b" }] });

    expect(data).toMatchObject({ success: true, action: "unchanged", changedFields: [] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("get_team returns what each member does in the team", async () => {
    await connect(null);
    const { data } = await callTool("get_team", { slug: "research-crew" });
    expect(data.members.map((m: { role: string | null; description: string | null }) => [m.role, m.description])).toEqual([
      ["Researcher", "Finds sources"],
      [null, null],
    ]);
  });

  it("save_team saves a hub team with handoffs to every member and back", async () => {
    const ids = ["chief", "a", "b", "c"];
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(null);
    vi.mocked(db.prompt.findMany).mockResolvedValue(ids.map((id) => ({ id })) as never);
    vi.mocked(db.botTeam.create).mockResolvedValue({ id: "team-1" } as never);
    await connect(alice);

    const handoffs = ids.slice(1).flatMap((id) => [
      { from: "chief", to: id, label: "Task" },
      { from: id, to: "chief", label: "Result" },
    ]);
    const { isError, data } = await callTool("save_team", {
      title: "Chief of staff",
      description: "## How it works\nThe **chief** routes every request.",
      members: ids.map((bot) => ({ bot, ...(bot === "chief" && { role: "Chief of staff", description: "Routes work and merges results" }) })),
      handoffs,
    });

    expect(isError).toBe(false);
    expect(data.action).toBe("created");
    const [{ data: links }] = vi.mocked(db.botTeamLink.createMany).mock.calls[0] as unknown as [{ data: { fromBotId: string; toBotId: string }[] }];
    expect(links).toHaveLength(6);
    expect(links.filter((link) => link.fromBotId === "chief")).toHaveLength(3);
    expect(links.filter((link) => link.toBotId === "chief")).toHaveLength(3);
    expect(vi.mocked(db.botTeam.create).mock.calls[0][0]).toMatchObject({
      data: { description: "## How it works\nThe **chief** routes every request." },
    });
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
