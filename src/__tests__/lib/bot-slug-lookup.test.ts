import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { botSlugFromParam, findBotBySlug } from "@/lib/bots";

vi.mock("@/lib/db", () => ({
  db: {
    prompt: { findFirst: vi.fn() },
  },
}));

const record = {
  id: "bot1",
  title: "Code Reviewer",
  slug: "code-reviewer",
  description: null,
  content: "Review code",
  isPrivate: false,
  isUnlisted: false,
  delistReason: null,
  isFeatured: false,
  trendingUntil: null,
  installUrl: null,
  botPlatform: null,
  botPlatforms: [],
  botIcon: null,
  botColor: null,
  computerRequirements: [],
  botConfig: null,
  deletedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  authorId: "author1",
  author: { id: "author1", name: "Author", username: "author", avatar: null, verified: false },
  category: null,
  tags: [],
  _count: { votes: 3 },
};

describe("botSlugFromParam", () => {
  it("should use the whole segment when there is no id prefix", () => {
    expect(botSlugFromParam("code-reviewer")).toBe("code-reviewer");
  });

  it("should use the part after the id prefix", () => {
    expect(botSlugFromParam("staleid_code-reviewer")).toBe("code-reviewer");
  });

  it("should lowercase the slug", () => {
    expect(botSlugFromParam("Code-Reviewer")).toBe("code-reviewer");
  });

  it.each(["teams", "new", "abc_teams"])("should never treat reserved segment %s as a slug", (param) => {
    expect(botSlugFromParam(param)).toBeNull();
  });

  it.each(["", "abc_", "has space", "a.b", "x_y_z"])("should reject %j", (param) => {
    expect(botSlugFromParam(param)).toBeNull();
  });
});

describe("findBotBySlug", () => {
  beforeEach(() => {
    vi.mocked(db.prompt.findFirst).mockReset();
  });

  it("should pick the best visible live bot deterministically", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(record as never);

    const bot = await findBotBySlug("code-reviewer");

    expect(bot).toMatchObject({ id: "bot1", slug: "code-reviewer", voteCount: 3 });
    const args = vi.mocked(db.prompt.findFirst).mock.calls[0][0]!;
    expect(args.where).toEqual({ type: "BOT", deletedAt: null, slug: "code-reviewer", OR: [{ isPrivate: false }] });
    expect(args.orderBy).toEqual([
      { isPrivate: "asc" },
      { isUnlisted: "asc" },
      { votes: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });

  it("should let a signed-in user find their own private bots", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);

    await findBotBySlug("code-reviewer", { id: "user1", role: "USER" });

    expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]!.where).toMatchObject({
      OR: [{ isPrivate: false }, { authorId: "user1" }],
    });
  });

  it("should not restrict visibility for admins", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);

    await findBotBySlug("code-reviewer", { id: "admin1", role: "ADMIN" });

    expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]!.where).not.toHaveProperty("OR");
  });

  it("should return null for an unknown slug", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);

    expect(await findBotBySlug("nope")).toBeNull();
  });
});
