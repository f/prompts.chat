import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/prompts/route";
import { GET, PATCH } from "@/app/api/prompts/[id]/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    prompt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    promptVersion: { create: vi.fn(), findFirst: vi.fn() },
    promptVote: { findUnique: vi.fn() },
    promptConnection: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    botPairing: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/webhook", () => ({ triggerWebhooks: vi.fn() }));
vi.mock("@/lib/ai/embeddings", () => ({
  generatePromptEmbedding: vi.fn().mockResolvedValue(undefined),
  findAndSaveRelatedPrompts: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/slug", () => ({ generatePromptSlug: vi.fn().mockResolvedValue("bot-slug") }));
vi.mock("@/lib/ai/quality-check", () => ({
  checkPromptQuality: vi.fn().mockResolvedValue({ shouldDelist: false }),
}));
vi.mock("@/lib/similarity", () => ({
  isSimilarContent: vi.fn().mockReturnValue(false),
  normalizeContent: vi.fn().mockReturnValue("short"),
}));

const API_KEY = `pchat_${"a".repeat(64)}`;
const params = { params: Promise.resolve({ id: "m-bot" }) };

const botBody = {
  title: "Inbox Zero",
  content: "Triage my inbox",
  type: "BOT",
  tagIds: [],
  isPrivate: false,
  botPlatforms: ["HERMES"],
};

function jsonRequest(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function asSession(role: "ADMIN" | "USER", id = role === "ADMIN" ? "admin1" : "user1") {
  vi.mocked(auth).mockResolvedValue({ user: { id, role } } as never);
}

function asApiKey(role: "ADMIN" | "USER") {
  vi.mocked(auth).mockResolvedValue(null as never);
  vi.mocked(db.user.findUnique).mockImplementation((async ({ where }: { where: { apiKey?: string } }) =>
    where.apiKey ? { id: role === "ADMIN" ? "admin1" : "user1", role } : { flagged: false }) as never);
}

function targetsExist(...ids: string[]) {
  vi.mocked(db.prompt.findMany).mockImplementation((async ({ where }: { where: { id?: { in: string[] } } }) =>
    (where.id?.in ?? []).filter((id) => ids.includes(id)).map((id) => ({ id }))) as never);
}

describe("POST /api/prompts with pairings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ flagged: false } as never);
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
    vi.mocked(db.prompt.create).mockResolvedValue({ id: "new-bot", title: "Inbox Zero", type: "BOT", author: {} } as never);
    targetsExist("a-bot", "z-bot");
  });

  it("lets an admin API key create a bot with pairings stored in canonical order", async () => {
    asApiKey("ADMIN");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/prompts", "POST", {
        ...botBody,
        pairings: [{ botId: "z-bot", note: "Shares the inbox" }, { botId: "a-bot" }],
      }, { "x-api-key": API_KEY })
    );

    expect(response.status).toBe(200);
    expect(db.prompt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "admin1" }) }));
    expect(db.botPairing.createMany).toHaveBeenCalledWith({
      data: [
        { fromId: "new-bot", toId: "z-bot", note: "Shares the inbox" },
        { fromId: "a-bot", toId: "new-bot", note: null },
      ],
      skipDuplicates: true,
    });
    const data = await response.json();
    expect(data.pairings).toEqual([
      { botId: "z-bot", note: "Shares the inbox" },
      { botId: "a-bot", note: null },
    ]);
  });

  it("does not accept a non-admin user's API key", async () => {
    asApiKey("USER");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/prompts", "POST", botBody, { authorization: `Bearer ${API_KEY}` })
    );
    expect(response.status).toBe(401);
    expect(db.prompt.create).not.toHaveBeenCalled();
  });

  it("forbids pairings from non-admin users", async () => {
    asSession("USER");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/prompts", "POST", { ...botBody, pairings: [{ botId: "a-bot" }] })
    );
    expect(response.status).toBe(403);
    expect(db.prompt.create).not.toHaveBeenCalled();
  });

  it("still creates bots without pairings for regular users", async () => {
    asSession("USER");
    const response = await POST(jsonRequest("http://localhost:3000/api/prompts", "POST", botBody));
    expect(response.status).toBe(200);
    expect(db.botPairing.createMany).not.toHaveBeenCalled();
  });

  it("rejects pairings with unknown bots before creating anything", async () => {
    asSession("ADMIN");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/prompts", "POST", { ...botBody, pairings: [{ botId: "missing" }] })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_pairing");
    expect(db.prompt.create).not.toHaveBeenCalled();
  });

  it("rejects pairings on prompts that are not bots", async () => {
    asSession("ADMIN");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/prompts", "POST", { ...botBody, type: "TEXT", pairings: [{ botId: "a-bot" }] })
    );
    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/prompts/[id] with pairings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.prompt.findUnique).mockResolvedValue({ authorId: "owner", content: "Triage", type: "BOT" } as never);
    vi.mocked(db.prompt.update).mockResolvedValue({ id: "m-bot", isPrivate: false, isUnlisted: false } as never);
    vi.mocked(db.$transaction).mockResolvedValue([] as never);
    targetsExist("a-bot", "z-bot");
  });

  it("replaces every link of the bot, in both directions, for an admin API key", async () => {
    asApiKey("ADMIN");
    const response = await PATCH(
      jsonRequest("http://localhost:3000/api/prompts/m-bot", "PATCH", {
        pairings: [{ botId: "a-bot", note: "Morning digest" }, { botId: "z-bot" }],
      }, { "x-api-key": API_KEY }),
      params
    );

    expect(response.status).toBe(200);
    expect(db.botPairing.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ fromId: "m-bot" }, { toId: "m-bot" }] } });
    expect(db.botPairing.createMany).toHaveBeenCalledWith({
      data: [
        { fromId: "a-bot", toId: "m-bot", note: "Morning digest" },
        { fromId: "m-bot", toId: "z-bot", note: null },
      ],
      skipDuplicates: true,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("clears links with an empty list", async () => {
    asSession("ADMIN");
    const response = await PATCH(jsonRequest("http://localhost:3000/api/prompts/m-bot", "PATCH", { pairings: [] }), params);
    expect(response.status).toBe(200);
    expect(db.botPairing.deleteMany).toHaveBeenCalled();
    expect(db.botPairing.createMany).toHaveBeenCalledWith({ data: [], skipDuplicates: true });
  });

  it("leaves links alone when pairings is omitted", async () => {
    asSession("USER", "owner");
    const response = await PATCH(jsonRequest("http://localhost:3000/api/prompts/m-bot", "PATCH", { title: "Renamed" }), params);
    expect(response.status).toBe(200);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("forbids the bot owner from changing links", async () => {
    asSession("USER", "owner");
    const response = await PATCH(
      jsonRequest("http://localhost:3000/api/prompts/m-bot", "PATCH", { pairings: [{ botId: "a-bot" }] }),
      params
    );
    expect(response.status).toBe(403);
    expect(db.prompt.update).not.toHaveBeenCalled();
  });

  it("rejects a self-link", async () => {
    asSession("ADMIN");
    const response = await PATCH(
      jsonRequest("http://localhost:3000/api/prompts/m-bot", "PATCH", { pairings: [{ botId: "m-bot" }] }),
      params
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_pairing");
    expect(db.prompt.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate bots in the list", async () => {
    asSession("ADMIN");
    const response = await PATCH(
      jsonRequest("http://localhost:3000/api/prompts/m-bot", "PATCH", { pairings: [{ botId: "a-bot" }, { botId: "a-bot" }] }),
      params
    );
    expect(response.status).toBe(400);
  });

  it("rejects links on prompts that are not bots", async () => {
    asSession("ADMIN");
    vi.mocked(db.prompt.findUnique).mockResolvedValue({ authorId: "owner", content: "x", type: "TEXT" } as never);
    const response = await PATCH(
      jsonRequest("http://localhost:3000/api/prompts/m-bot", "PATCH", { pairings: [{ botId: "a-bot" }] }),
      params
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/prompts/[id] for a bot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes the linked bots", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "m-bot",
      type: "BOT",
      isPrivate: false,
      deletedAt: null,
      trendingUntil: null,
      _count: { votes: 0 },
    } as never);
    vi.mocked(db.botPairing.findMany).mockResolvedValue([{ fromId: "a-bot", toId: "m-bot", note: "Morning digest" }] as never);
    vi.mocked(db.prompt.findMany).mockResolvedValue([
      {
        id: "a-bot",
        slug: "digest",
        title: "Digest",
        description: null,
        content: "x",
        botPlatform: null,
        botPlatforms: ["HERMES"],
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
        authorId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { username: "alice", name: null, avatar: null, verified: false },
        _count: { votes: 0 },
        category: null,
        tags: [],
      },
    ] as never);

    const response = await GET(new Request("http://localhost:3000/api/prompts/m-bot"), params);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.betterTogetherWith).toEqual([
      expect.objectContaining({
        id: "a-bot",
        name: "Digest",
        note: "Morning digest",
        urls: expect.objectContaining({ page: "http://localhost:3000/bots/a-bot_digest" }),
      }),
    ]);
  });

  it("leaves non-bot prompts unchanged", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "p1",
      type: "TEXT",
      isPrivate: false,
      deletedAt: null,
      trendingUntil: null,
      _count: { votes: 0 },
    } as never);

    const data = await (await GET(new Request("http://localhost:3000/api/prompts/p1"), params)).json();
    expect(data).not.toHaveProperty("betterTogetherWith");
    expect(db.botPairing.findMany).not.toHaveBeenCalled();
  });
});
