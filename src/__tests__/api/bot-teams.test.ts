import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as LIST, POST } from "@/app/api/bots/teams/route";
import { GET, PUT, DELETE } from "@/app/api/bots/teams/[slug]/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { botTeamWriteLimiter } from "@/lib/rate-limit";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn() },
    botTeam: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    botTeamMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    botTeamLink: { deleteMany: vi.fn(), createMany: vi.fn() },
    category: { findUnique: vi.fn() },
    tag: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ botTeamWriteLimiter: { check: vi.fn() } }));
vi.mock("@/lib/seo", () => ({ getBaseUrl: () => "https://prompts.chat" }));

const params = { params: Promise.resolve({ slug: "research-crew" }) };

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
    computerRequirements: [],
    botConfig: null,
    isPrivate: false,
    isUnlisted: false,
    isFeatured: false,
    trendingUntil: null,
    delistReason: null,
    deletedAt: null,
    authorId: "owner",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    author: { username: "owner", name: null, avatar: null, verified: false },
    _count: { votes: 0 },
    category: null,
    tags: [],
    ...overrides,
  };
}

const team = {
  id: "team-1",
  slug: "research-crew",
  title: "Research crew",
  description: null,
  isFeatured: false,
  authorId: "owner",
  createdAt: new Date("2026-02-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  author: { username: "owner", name: "Owner", avatar: null, verified: false },
  members: [
    { role: "Researcher", description: "Finds sources", bot: bot("a") },
    { role: null, description: null, bot: bot("b") },
  ],
  links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
  category: null,
  tags: [],
};

const validBody = {
  title: "Research crew",
  members: [{ botId: "a", role: "Researcher", description: "Finds sources" }, { botId: "b" }],
  links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function signIn(id: string, role = "USER") {
  vi.mocked(auth).mockResolvedValue({ user: { id, role } } as never);
}

describe("bot teams API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(botTeamWriteLimiter.check).mockReturnValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 } as never);
    vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: typeof db) => unknown) => fn(db)) as never);
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(team as never);
    vi.mocked(db.botTeam.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
  });

  describe("GET /api/bots/teams", () => {
    it("lists team summaries without bot instructions", async () => {
      vi.mocked(db.botTeam.findMany).mockResolvedValue([team] as never);
      vi.mocked(db.botTeam.count).mockResolvedValue(1);
      const response = await LIST(new Request("http://localhost/api/bots/teams?q=research&limit=5"));
      const body = await response.json();
      expect(body.total).toBe(1);
      expect(body.teams[0]).toMatchObject({ slug: "research-crew", handoffCount: 1, link: "https://prompts.chat/bots/teams/research-crew" });
      expect(JSON.stringify(body)).not.toContain("Secret instructions");
      expect(vi.mocked(db.botTeam.findMany).mock.calls[0][0]).toMatchObject({ take: 5 });
    });

    it("filters by category and comma-separated tags", async () => {
      vi.mocked(db.botTeam.count).mockResolvedValue(0);
      await LIST(new Request("http://localhost/api/bots/teams?category=coding&tag=agents,ci"));
      expect(vi.mocked(db.botTeam.findMany).mock.calls[0][0]!.where).toMatchObject({
        category: { OR: [{ slug: "coding" }, { parent: { slug: "coding" } }] },
        AND: [{ tags: { some: { tag: { slug: "agents" } } } }, { tags: { some: { tag: { slug: "ci" } } } }],
      });
    });
  });

  describe("POST /api/bots/teams", () => {
    it("requires sign-in", async () => {
      const response = await POST(jsonRequest("http://localhost/api/bots/teams", "POST", validBody));
      expect(response.status).toBe(401);
      expect(db.botTeam.create).not.toHaveBeenCalled();
    });

    it("rate limits writes per user", async () => {
      signIn("owner");
      vi.mocked(botTeamWriteLimiter.check).mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 30 } as never);
      const response = await POST(jsonRequest("http://localhost/api/bots/teams", "POST", validBody));
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("30");
      expect(botTeamWriteLimiter.check).toHaveBeenCalledWith("user:owner");
    });

    it.each([
      ["no title", { ...validBody, title: "" }],
      ["one bot", { ...validBody, members: [{ botId: "a" }], links: [] }],
      ["a handoff to a non-member", { ...validBody, links: [{ fromBotId: "a", toBotId: "z" }] }],
    ])("rejects %s", async (_name, body) => {
      signIn("owner");
      const response = await POST(jsonRequest("http://localhost/api/bots/teams", "POST", body));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("validation_error");
    });

    it("rejects bots the user may not add", async () => {
      signIn("owner");
      vi.mocked(db.prompt.findMany).mockResolvedValue([{ id: "a" }] as never);
      const response = await POST(jsonRequest("http://localhost/api/bots/teams", "POST", validBody));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_bots", botIds: ["b"] });
    });

    it("rejects unknown categories and tags", async () => {
      signIn("owner");
      vi.mocked(db.category.findUnique).mockResolvedValue(null);
      let response = await POST(jsonRequest("http://localhost/api/bots/teams", "POST", { ...validBody, categoryId: "nope" }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("invalid_category");

      vi.mocked(db.tag.findMany).mockResolvedValue([{ id: "tag-1" }] as never);
      response = await POST(jsonRequest("http://localhost/api/bots/teams", "POST", { ...validBody, tagIds: ["tag-1", "tag-2"] }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_tags", tagIds: ["tag-2"] });
      expect(db.botTeam.create).not.toHaveBeenCalled();
    });

    it("saves the category and tags on update", async () => {
      signIn("owner");
      vi.mocked(db.category.findUnique).mockResolvedValue({ id: "cat-1" } as never);
      vi.mocked(db.tag.findMany).mockResolvedValue([{ id: "tag-1" }] as never);
      const response = await PUT(
        jsonRequest("http://localhost/api/bots/teams/research-crew", "PUT", { ...validBody, categoryId: "cat-1", tagIds: ["tag-1", "tag-1"] }),
        params
      );
      expect(response.status).toBe(200);
      expect(db.botTeam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: "cat-1", tags: { deleteMany: {}, create: [{ tagId: "tag-1" }] } }),
        })
      );
    });

    it("creates the team", async () => {
      signIn("owner");
      vi.mocked(db.botTeam.create).mockResolvedValue({ id: "team-1" } as never);
      const response = await POST(jsonRequest("http://localhost/api/bots/teams", "POST", validBody));
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: "team-1", slug: "research-crew" });
      expect(db.botTeamLink.createMany).toHaveBeenCalled();
    });
  });

  describe("/api/bots/teams/[slug]", () => {
    it("returns the team", async () => {
      const response = await GET(new Request("http://localhost/api/bots/teams/research-crew"), params);
      const body = await response.json();
      expect(body.handoffs).toEqual([{ from: "a", to: "b", fromName: "Bot a", toName: "Bot b", label: "Brief" }]);
    });

    it("returns 404 for unknown teams", async () => {
      vi.mocked(db.botTeam.findUnique).mockResolvedValue(null);
      const response = await GET(new Request("http://localhost/api/bots/teams/nope"), params);
      expect(response.status).toBe(404);
    });

    it("only lets the owner update", async () => {
      signIn("someone-else");
      const response = await PUT(jsonRequest("http://localhost/api/bots/teams/research-crew", "PUT", validBody), params);
      expect(response.status).toBe(403);
      expect(db.botTeam.update).not.toHaveBeenCalled();
    });

    it("replaces members and handoffs on update", async () => {
      signIn("owner");
      const response = await PUT(jsonRequest("http://localhost/api/bots/teams/research-crew", "PUT", validBody), params);
      expect(response.status).toBe(200);
      expect(db.botTeamLink.deleteMany).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
      expect(db.botTeamMember.createMany).toHaveBeenCalledWith({
        data: [
          { botId: "a", role: "Researcher", description: "Finds sources", order: 0, teamId: "team-1" },
          { botId: "b", role: null, description: null, order: 1, teamId: "team-1" },
        ],
      });
    });

    it("lets admins delete any team", async () => {
      signIn("admin", "ADMIN");
      const response = await DELETE(new Request("http://localhost/api/bots/teams/research-crew", { method: "DELETE" }), params);
      expect(response.status).toBe(200);
      expect(db.botTeam.delete).toHaveBeenCalledWith({ where: { id: "team-1" } });
    });
  });
});
