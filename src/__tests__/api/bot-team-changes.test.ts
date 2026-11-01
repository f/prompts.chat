import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as LIST, POST } from "@/app/api/bots/teams/[slug]/changes/route";
import { GET, PATCH, DELETE } from "@/app/api/bots/teams/[slug]/changes/[changeId]/route";
import { GET as VERSIONS } from "@/app/api/bots/teams/[slug]/versions/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { botTeamWriteLimiter } from "@/lib/rate-limit";
import type { TeamSnapshot } from "@/lib/bots/team-snapshot";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn() },
    botTeam: { findUnique: vi.fn(), update: vi.fn() },
    botTeamMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    botTeamLink: { deleteMany: vi.fn(), createMany: vi.fn() },
    botTeamVersion: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    botTeamChangeRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: { findUnique: vi.fn() },
    tag: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ botTeamWriteLimiter: { check: vi.fn() } }));
vi.mock("@/lib/seo", () => ({ getBaseUrl: () => "https://prompts.chat" }));

const params = { params: Promise.resolve({ slug: "research-crew" }) };
const changeParams = { params: Promise.resolve({ slug: "research-crew", changeId: "cr-1" }) };

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

let bots: Record<string, ReturnType<typeof bot>>;

function teamRecord() {
  const members = [
    { botId: "a", role: "Researcher", description: "Finds sources" },
    { botId: "b", role: null, description: null },
  ];
  return {
    id: "team-1",
    slug: "research-crew",
    title: "Research crew",
    description: null,
    isFeatured: false,
    isUnlisted: false,
    unlistedAt: null,
    authorId: "owner",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    author: { username: "owner", name: "Owner", avatar: null, verified: false },
    _count: { votes: 0 },
    members: members.map((member) => ({ ...member, bot: bots[member.botId] })),
    links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
    category: null,
    tags: [],
  };
}

const currentSnapshot: TeamSnapshot = {
  title: "Research crew",
  description: null,
  category: null,
  tags: [],
  members: [
    { botId: "a", title: "Bot a", role: "Researcher", description: "Finds sources" },
    { botId: "b", title: "Bot b", role: null, description: null },
  ],
  links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
};

const unchangedBody = {
  title: "Research crew",
  members: [{ botId: "a", role: "Researcher", description: "Finds sources" }, { botId: "b" }],
  links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
};

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

function signIn(id: string, role = "USER") {
  vi.mocked(auth).mockResolvedValue({ user: { id, role } } as never);
}

function changeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "cr-1",
    teamId: "team-1",
    status: "PENDING",
    reason: "Sharper roles",
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    authorId: "bob",
    author: { id: "bob", name: "Bob", username: "bob", avatar: null },
    reviewer: null,
    originalSnapshot: currentSnapshot,
    proposedSnapshot: { ...currentSnapshot, title: "Research squad" },
    ...overrides,
  };
}

describe("bot team change requests API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bots = { a: bot("a"), b: bot("b"), c: bot("c") };
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(botTeamWriteLimiter.check).mockReturnValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 } as never);
    vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: typeof db) => unknown) => fn(db)) as never);
    vi.mocked(db.botTeam.findUnique).mockImplementation((() => Promise.resolve(teamRecord())) as never);
    vi.mocked(db.prompt.findMany).mockImplementation(((args: { where: { id: { in: string[] } } }) =>
      Promise.resolve(args.where.id.in.map((id) => bots[id]).filter(Boolean))) as never);
    vi.mocked(db.botTeamChangeRequest.create).mockResolvedValue({ id: "cr-1" } as never);
    vi.mocked(db.botTeamVersion.findFirst).mockResolvedValue({ version: 3 } as never);
  });

  describe("POST /api/bots/teams/[slug]/changes", () => {
    it("requires sign-in", async () => {
      const response = await POST(jsonRequest("http://localhost/api/bots/teams/research-crew/changes", "POST", unchangedBody), params);
      expect(response.status).toBe(401);
    });

    it("does not let owners propose changes to their own team", async () => {
      signIn("owner");
      const response = await POST(
        jsonRequest("http://localhost/api/bots/teams/research-crew/changes", "POST", { ...unchangedBody, title: "New" }),
        params
      );
      expect(response.status).toBe(403);
      expect(db.botTeamChangeRequest.create).not.toHaveBeenCalled();
    });

    it("rejects a proposal that changes nothing", async () => {
      signIn("bob");
      const response = await POST(jsonRequest("http://localhost/api/bots/teams/research-crew/changes", "POST", unchangedBody), params);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("no_change");
    });

    it("stores the current and proposed team with the reason", async () => {
      signIn("bob");
      const body = {
        ...unchangedBody,
        members: [{ botId: "a", role: "Lead researcher" }, { botId: "b" }, { botId: "c", role: "Writer" }],
        reason: "Add a writer",
      };
      const response = await POST(jsonRequest("http://localhost/api/bots/teams/research-crew/changes", "POST", body), params);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: "cr-1" });
      const data = vi.mocked(db.botTeamChangeRequest.create).mock.calls[0][0].data;
      expect(data).toMatchObject({ teamId: "team-1", authorId: "bob", reason: "Add a writer", originalSnapshot: currentSnapshot });
      expect((data.proposedSnapshot as unknown as TeamSnapshot).members).toEqual([
        { botId: "a", title: "Bot a", role: "Lead researcher", description: null },
        { botId: "b", title: "Bot b", role: null, description: null },
        { botId: "c", title: "Bot c", role: "Writer", description: null },
      ]);
    });

    it("keeps members the proposer cannot see", async () => {
      bots.b = bot("b", { isUnlisted: true });
      signIn("bob");
      const body = { title: "Research crew", members: [{ botId: "a" }, { botId: "c" }], links: [] };
      const response = await POST(jsonRequest("http://localhost/api/bots/teams/research-crew/changes", "POST", body), params);
      expect(response.status).toBe(201);
      const proposed = vi.mocked(db.botTeamChangeRequest.create).mock.calls[0][0].data.proposedSnapshot as unknown as TeamSnapshot;
      expect(proposed.members.map((member) => member.botId)).toEqual(["a", "c", "b"]);
      expect(proposed.links).toEqual([{ fromBotId: "a", toBotId: "b", label: "Brief" }]);
    });

    it("rejects bots the proposer may not add", async () => {
      bots.c = bot("c", { isPrivate: true, authorId: "someone" });
      vi.mocked(db.prompt.findMany).mockImplementation(((args: { where: { id: { in: string[] } }; select: Record<string, unknown> }) =>
        Promise.resolve(
          args.where.id.in.map((id) => bots[id]).filter((record) => record && !(record.isPrivate && args.select.isPrivate === undefined))
        )) as never);
      signIn("bob");
      const body = { ...unchangedBody, members: [...unchangedBody.members, { botId: "c" }] };
      const response = await POST(jsonRequest("http://localhost/api/bots/teams/research-crew/changes", "POST", body), params);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("invalid_bots");
    });

    it("hides unlisted teams from other users", async () => {
      vi.mocked(db.botTeam.findUnique).mockResolvedValue({ ...teamRecord(), isUnlisted: true } as never);
      signIn("bob");
      const response = await POST(
        jsonRequest("http://localhost/api/bots/teams/research-crew/changes", "POST", { ...unchangedBody, title: "New" }),
        params
      );
      expect(response.status).toBe(404);
    });
  });

  describe("GET change requests", () => {
    it("lists change requests with their titles", async () => {
      vi.mocked(db.botTeamChangeRequest.findMany).mockResolvedValue([changeRequest()] as never);
      const response = await LIST(new Request("http://localhost/api/bots/teams/research-crew/changes"), params);
      const [item] = await response.json();
      expect(item).toMatchObject({ id: "cr-1", status: "PENDING", originalTitle: "Research crew", proposedTitle: "Research squad" });
      expect(item.originalSnapshot).toBeUndefined();
    });

    it("leaves members the viewer cannot see out of a change request", async () => {
      bots.b = bot("b", { isPrivate: true });
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest() as never);
      const response = await GET(new Request("http://localhost/api/bots/teams/research-crew/changes/cr-1"), changeParams);
      const body = await response.json();
      expect(body.originalSnapshot.members.map((m: { botId: string }) => m.botId)).toEqual(["a"]);
      expect(body.originalSnapshot.links).toEqual([]);
      expect(body.proposedSnapshot.title).toBe("Research squad");
    });

    it("returns 404 for a change request of another team", async () => {
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest({ teamId: "team-2" }) as never);
      const response = await GET(new Request("http://localhost/api/bots/teams/research-crew/changes/cr-1"), changeParams);
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/bots/teams/[slug]/changes/[changeId]", () => {
    const url = "http://localhost/api/bots/teams/research-crew/changes/cr-1";

    it("only lets the owner or an admin review", async () => {
      signIn("bob");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest() as never);
      const response = await PATCH(jsonRequest(url, "PATCH", { status: "APPROVED" }), changeParams);
      expect(response.status).toBe(403);
      expect(db.botTeam.update).not.toHaveBeenCalled();
    });

    it("applies an approved proposal and saves a version credited to the proposer", async () => {
      signIn("owner");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest() as never);
      const response = await PATCH(jsonRequest(url, "PATCH", { status: "APPROVED" }), changeParams);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, status: "APPROVED" });
      expect(vi.mocked(db.botTeam.update).mock.calls[0][0].data).toMatchObject({ title: "Research squad" });
      expect(vi.mocked(db.botTeamVersion.create).mock.calls[0][0].data).toMatchObject({
        teamId: "team-1",
        version: 4,
        changeNote: "Contribution by @bob: Sharper roles",
        createdById: "bob",
      });
      expect(vi.mocked(db.botTeamChangeRequest.update).mock.calls[0][0]).toMatchObject({
        where: { id: "cr-1" },
        data: { status: "APPROVED", reviewerId: "owner" },
      });
    });

    it("lets admins approve", async () => {
      signIn("admin", "ADMIN");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest() as never);
      const response = await PATCH(jsonRequest(url, "PATCH", { status: "APPROVED" }), changeParams);
      expect(response.status).toBe(200);
    });

    it("rejects with a review note without touching the team", async () => {
      signIn("owner");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest() as never);
      const response = await PATCH(jsonRequest(url, "PATCH", { status: "REJECTED", reviewNote: "Not needed" }), changeParams);
      expect(response.status).toBe(200);
      expect(db.botTeam.update).not.toHaveBeenCalled();
      expect(vi.mocked(db.botTeamChangeRequest.update).mock.calls[0][0].data).toMatchObject({
        status: "REJECTED",
        reviewNote: "Not needed",
        reviewerId: "owner",
      });
    });

    it("reopens a rejected request and clears the review", async () => {
      signIn("owner");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest({ status: "REJECTED" }) as never);
      const response = await PATCH(jsonRequest(url, "PATCH", { status: "PENDING" }), changeParams);
      expect(response.status).toBe(200);
      expect(vi.mocked(db.botTeamChangeRequest.update).mock.calls[0][0].data).toEqual({
        status: "PENDING",
        reviewNote: null,
        reviewerId: null,
        reviewedAt: null,
      });
    });

    it.each([
      ["an approved request", "APPROVED", "REJECTED"],
      ["a rejected request to approved", "REJECTED", "APPROVED"],
      ["a pending request to pending", "PENDING", "PENDING"],
    ])("refuses to change %s", async (_name, current, next) => {
      signIn("owner");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest({ status: current }) as never);
      const response = await PATCH(jsonRequest(url, "PATCH", { status: next }), changeParams);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("invalid_state");
    });
  });

  describe("DELETE /api/bots/teams/[slug]/changes/[changeId]", () => {
    const url = "http://localhost/api/bots/teams/research-crew/changes/cr-1";

    it("lets the author dismiss their pending request", async () => {
      signIn("bob");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest() as never);
      const response = await DELETE(jsonRequest(url, "DELETE"), changeParams);
      expect(response.status).toBe(200);
      expect(db.botTeamChangeRequest.delete).toHaveBeenCalledWith({ where: { id: "cr-1" } });
    });

    it("does not let others dismiss it", async () => {
      signIn("owner");
      vi.mocked(db.botTeamChangeRequest.findUnique).mockResolvedValue(changeRequest() as never);
      const response = await DELETE(jsonRequest(url, "DELETE"), changeParams);
      expect(response.status).toBe(403);
      expect(db.botTeamChangeRequest.delete).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/bots/teams/[slug]/versions", () => {
    it("lists versions newest first with hidden members left out", async () => {
      bots.b = bot("b", { isUnlisted: true });
      vi.mocked(db.botTeamVersion.findMany).mockResolvedValue([
        { id: "v2", version: 2, changeNote: "Team updated", createdAt: new Date(), snapshot: currentSnapshot, createdBy: { name: null, username: "owner" } },
        { id: "v1", version: 1, changeNote: "Initial version", createdAt: new Date(), snapshot: { ...currentSnapshot, members: [] }, createdBy: null },
      ] as never);
      const response = await VERSIONS(new Request("http://localhost/api/bots/teams/research-crew/versions"), params);
      const versions = await response.json();
      expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
      expect(versions[0].snapshot.members.map((m: { botId: string }) => m.botId)).toEqual(["a"]);
      expect(versions[0].author).toEqual({ name: null, username: "owner" });
    });
  });
});
