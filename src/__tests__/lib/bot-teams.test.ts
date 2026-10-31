import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  botTeamInputSchema,
  canEditTeam,
  createTeam,
  diffTeam,
  getTeam,
  getTeamInstallPrompt,
  getTeamPlatforms,
  teamLinkIssues,
  teamToJson,
  toTeamView,
  uniqueTeamSlug,
  upsertOwnTeam,
} from "@/lib/bots/teams";
import { pairingGroups, teamTitleFromBots, teamsFromPairings, type ConversionBot } from "@/lib/bots/team-conversion";
import { clampToCell, edgeGeometry, initialPositions, nodeBounds, teamGridLayout, truncateLabel } from "@/lib/bots/team-graph";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    prompt: { findMany: vi.fn() },
    botTeam: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    botTeamMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    botTeamLink: { createMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

const baseUrl = "https://prompts.chat";

function botRecord(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `${id}-slug`,
    title: `Bot ${id}`,
    description: null,
    content: "Do the thing.",
    type: "BOT",
    botPlatform: "OPENCLAW",
    botPlatforms: ["OPENCLAW"],
    botIcon: null,
    botColor: null,
    installUrl: null,
    botConfig: { routines: [], skills: [], connectors: [] },
    isPrivate: false,
    isUnlisted: false,
    isFeatured: false,
    trendingUntil: null,
    delistReason: null,
    deletedAt: null,
    authorId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    author: { username: "alice", name: "Alice", avatar: null, verified: false },
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
    description: "Finds and writes things up",
    isFeatured: false,
    authorId: "user-1",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-02-02T00:00:00Z"),
    author: { username: "alice", name: "Alice", avatar: null, verified: false },
    members: [
      { role: "Researcher", bot: botRecord("a") },
      { role: "Writer", bot: botRecord("b", { botPlatforms: ["OPENCLAW", "HERMES"] }) },
      { role: null, bot: botRecord("c", { isPrivate: true, authorId: "user-2" }) },
    ],
    links: [
      { fromBotId: "a", toBotId: "b", label: "Research brief" },
      { fromBotId: "b", toBotId: "c", label: "Draft" },
    ],
    ...overrides,
  };
}

const alice = { id: "user-1", role: "USER" };

describe("team input validation", () => {
  it("accepts a team and defaults links to none", () => {
    const parsed = botTeamInputSchema.parse({ title: " Crew ", members: [{ botId: "a" }, { botId: "b" }] });
    expect(parsed).toMatchObject({ title: "Crew", links: [] });
  });

  it("needs at least two distinct bots", () => {
    expect(botTeamInputSchema.safeParse({ title: "Crew", members: [{ botId: "a" }] }).success).toBe(false);
    expect(botTeamInputSchema.safeParse({ title: "Crew", members: [{ botId: "a" }, { botId: "a" }] }).success).toBe(false);
  });

  it("rejects handoffs to self, to non-members and duplicates", () => {
    expect(teamLinkIssues(["a", "b"], [{ fromBotId: "a", toBotId: "a" }])).toEqual(["A bot cannot hand off to itself"]);
    expect(teamLinkIssues(["a", "b"], [{ fromBotId: "a", toBotId: "z" }])).toEqual(["Handoffs can only connect bots of the team"]);
    expect(
      teamLinkIssues(["a", "b"], [
        { fromBotId: "a", toBotId: "b" },
        { fromBotId: "a", toBotId: "b" },
      ])
    ).toEqual(["Each handoff can only be added once"]);
    expect(teamLinkIssues(["a", "b"], [{ fromBotId: "a", toBotId: "b" }, { fromBotId: "b", toBotId: "a" }])).toEqual([]);

    const parsed = botTeamInputSchema.safeParse({
      title: "Crew",
      members: [{ botId: "a" }, { botId: "b" }],
      links: [{ fromBotId: "a", toBotId: "z", label: "x" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("team views", () => {
  it("hides private members and their handoffs from other viewers", () => {
    const view = toTeamView(teamRecord() as never, (bot: { id: string }) => ({ id: bot.id }), null);
    expect(view.members.map((m) => m.bot.id)).toEqual(["a", "b"]);
    expect(view.links).toEqual([{ fromBotId: "a", toBotId: "b", label: "Research brief" }]);
  });

  it("shows private members to their author and to admins", () => {
    const mapBot = (bot: { id: string }) => ({ id: bot.id });
    expect(toTeamView(teamRecord() as never, mapBot, { id: "user-2" }).members).toHaveLength(3);
    expect(toTeamView(teamRecord() as never, mapBot, { id: "x", role: "ADMIN" }).links).toHaveLength(2);
  });

  it("lets only the owner and admins edit", () => {
    expect(canEditTeam({ authorId: "user-1" }, alice)).toBe(true);
    expect(canEditTeam({ authorId: "user-1" }, { id: "user-2", role: "USER" })).toBe(false);
    expect(canEditTeam({ authorId: "user-1" }, { id: "user-2", role: "ADMIN" })).toBe(true);
    expect(canEditTeam({ authorId: "user-1" }, null)).toBe(false);
  });

  it("serializes members, handoffs and platforms", async () => {
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(teamRecord() as never);
    const team = (await getTeam({ slug: "research-crew" }, { id: "user-2" }))!;
    const json = teamToJson(team, baseUrl);
    expect(json.link).toBe("https://prompts.chat/bots/teams/research-crew");
    expect(json.members.map((m) => [m.name, m.role])).toEqual([
      ["Bot a", "Researcher"],
      ["Bot b", "Writer"],
      ["Bot c", null],
    ]);
    expect(json.handoffs[0]).toEqual({ from: "a", to: "b", fromName: "Bot a", toName: "Bot b", label: "Research brief" });
    expect(json.platforms.map((p) => [p.platform, p.botCount])).toEqual([
      ["OPENCLAW", 3],
      ["HERMES", 1],
    ]);
    expect(JSON.stringify(json)).not.toContain("Do the thing.");
  });
});

describe("team install", () => {
  it("orders platforms by how many members support them", () => {
    expect(getTeamPlatforms([{ platforms: ["HERMES"] }, { platforms: ["OPENCLAW", "HERMES"] }])).toEqual(["HERMES", "OPENCLAW"]);
  });

  it("lists bots with roles and the handoffs between installed bots", async () => {
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(teamRecord() as never);
    const team = (await getTeam({ slug: "research-crew" }, { id: "user-2" }))!;
    const bots = team.members.map((m) => m.bot);
    const prompt = getTeamInstallPrompt(team, bots.slice(0, 2), "OPENCLAW", baseUrl);
    expect(prompt).toContain('Set up the "Research crew" team: 2 bots');
    expect(prompt).toContain('"Bot a" (Researcher)');
    expect(prompt).toContain('- "Bot a" hands off to "Bot b": Research brief');
    expect(prompt).not.toContain('"Bot c"');
    expect(prompt).toContain("wire up the handoffs");
  });
});

describe("team writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: typeof db) => unknown) => fn(db)) as never);
  });

  it("numbers slugs that are taken", async () => {
    vi.mocked(db.botTeam.findMany).mockResolvedValue([{ slug: "crew" }, { slug: "crew-2" }] as never);
    expect(await uniqueTeamSlug("Crew")).toBe("crew-3");
    vi.mocked(db.botTeam.findMany).mockResolvedValue([]);
    expect(await uniqueTeamSlug("!!!")).toBe("team");
  });

  it("rejects bots that are missing or private to someone else", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([{ id: "a" }] as never);
    const result = await createTeam(alice, { title: "Crew", description: null, members: [{ botId: "a" }, { botId: "b" }], links: [] });
    expect(result).toMatchObject({ ok: false, status: 400, body: { error: "invalid_bots", botIds: ["b"] } });
    expect(db.botTeam.create).not.toHaveBeenCalled();
  });

  it("creates a team with ordered members and handoffs", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
    vi.mocked(db.botTeam.findMany).mockResolvedValue([]);
    vi.mocked(db.botTeam.create).mockResolvedValue({ id: "team-1" } as never);
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(teamRecord() as never);

    const result = await createTeam(alice, {
      title: "Research crew",
      description: "",
      members: [{ botId: "a", role: "Researcher" }, { botId: "b" }],
      links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
    });

    expect(result.ok).toBe(true);
    expect(db.botTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "research-crew",
          description: null,
          authorId: "user-1",
          members: { create: [{ botId: "a", role: "Researcher", order: 0 }, { botId: "b", role: null, order: 1 }] },
        }),
      })
    );
    expect(db.botTeamLink.createMany).toHaveBeenCalledWith({
      data: [{ teamId: "team-1", fromBotId: "a", toBotId: "b", label: "Brief", order: 0 }],
    });
  });

  it("reports changed fields and writes nothing when the team is unchanged", async () => {
    const existing = teamRecord({ members: teamRecord().members.slice(0, 2), links: [teamRecord().links[0]] });
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(existing as never);

    const unchanged = await upsertOwnTeam(alice, {
      id: "team-1",
      title: "Research crew",
      members: [{ botId: "a", role: "Researcher" }, { botId: "b", role: "Writer" }],
    });
    expect(unchanged).toMatchObject({ ok: true, data: { action: "unchanged", changedFields: [] } });
    expect(db.$transaction).not.toHaveBeenCalled();

    const view = toTeamView(existing as never, (bot: { id: string }) => ({ id: bot.id }), alice);
    expect(
      diffTeam(view, {
        title: "Research crew",
        description: "Finds and writes things up",
        members: [{ botId: "a", role: "Researcher" }, { botId: "b", role: "Editor" }],
        links: [],
      })
    ).toEqual(["members", "links"]);
  });

  it("fails when the id is not one of the caller's teams", async () => {
    vi.mocked(db.botTeam.findFirst).mockResolvedValue(null);
    const result = await upsertOwnTeam(alice, { id: "other", title: "X", members: [{ botId: "a" }, { botId: "b" }] });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("converting pairings to teams", () => {
  const bot = (id: string, day: number, authorId = "u1"): ConversionBot => ({
    id,
    title: id.toUpperCase(),
    authorId,
    createdAt: new Date(`2026-01-0${day}T00:00:00Z`),
  });
  const bots = new Map([bot("a", 1), bot("b", 2), bot("c", 3, "u2"), bot("d", 4, "u2"), bot("e", 5, "u2")].map((b) => [b.id, b]));
  const pairings = [
    { fromId: "b", toId: "a", note: " Plan " },
    { fromId: "b", toId: "c", note: null },
    { fromId: "d", toId: "e", note: "Draft" },
    { fromId: "a", toId: "missing", note: null },
  ];

  it("groups connected bots, oldest first", () => {
    expect(pairingGroups(pairings, bots).map((group) => group.map((b) => b.id))).toEqual([["a", "b", "c"], ["d", "e"]]);
  });

  it("builds titles from member names", () => {
    expect(teamTitleFromBots(["A", "B"])).toBe("A & B");
    expect(teamTitleFromBots(["A", "B", "C"])).toBe("A, B & C");
    expect(teamTitleFromBots(["A", "B", "C", "D", "E"])).toBe("A, B, C & 2 more");
    expect(teamTitleFromBots(["x".repeat(200), "y"]).length).toBeLessThanOrEqual(120);
  });

  it("turns each group into a team with handoffs from older to newer bots", () => {
    const { teams, skipped } = teamsFromPairings(pairings, bots);
    expect(skipped).toEqual([]);
    expect(teams[0]).toEqual({
      title: "A, B & C",
      description: null,
      authorId: "u1",
      members: [{ botId: "a", role: null }, { botId: "b", role: null }, { botId: "c", role: null }],
      links: [
        { fromBotId: "a", toBotId: "b", label: "Plan" },
        { fromBotId: "b", toBotId: "c", label: "" },
      ],
    });
    expect(teams[1]).toMatchObject({ title: "D & E", authorId: "u2" });
    for (const team of teams) expect(botTeamInputSchema.safeParse(team).success).toBe(true);
  });

  it("skips groups that already are teams or are too large", () => {
    const { teams, skipped } = teamsFromPairings(pairings, bots, { existingMemberSets: [["e", "d"]], maxMembers: 2 });
    expect(teams).toEqual([]);
    expect(skipped).toEqual([
      { botIds: ["a", "b", "c"], reason: "too_large" },
      { botIds: ["d", "e"], reason: "exists" },
    ]);
  });
});

describe("team graph geometry", () => {
  it("lays teams out in as many columns as fit", () => {
    const { cells, columns, height } = teamGridLayout([2, 3, 2], 1000);
    expect(columns).toBe(3);
    expect(cells).toHaveLength(3);
    expect(cells[1].x).toBeGreaterThan(cells[0].x + cells[0].width);
    expect(height).toBe(cells[0].height);

    const narrow = teamGridLayout([2, 3], 320);
    expect(narrow.columns).toBe(1);
    expect(narrow.cells[1].y).toBeGreaterThan(narrow.cells[0].y);
  });

  it("keeps nodes inside their team's box", () => {
    const cell = { x: 0, y: 0, width: 300, height: 220 };
    const bounds = nodeBounds(cell);
    expect(clampToCell({ x: -50, y: 999 }, cell)).toEqual({ x: bounds.minX, y: bounds.maxY });
    for (const point of initialPositions(5, cell)) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(point.x).toBeLessThanOrEqual(bounds.maxX);
    }
  });

  it("draws edges between node borders, curved on request", () => {
    expect(edgeGeometry({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ d: "M20,0 L73,0", mid: { x: 46.5, y: 0 } });
    expect(edgeGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, { curve: 20 })?.d).toMatch(/^M20,0 Q46.5,20 73,0$/);
    expect(edgeGeometry({ x: 0, y: 0 }, { x: 30, y: 0 })).toBeNull();
  });

  it("truncates long labels", () => {
    expect(truncateLabel("Research brief", 40)).toBe("Research brief");
    expect(truncateLabel("Research brief", 9)).toBe("Research…");
  });
});
