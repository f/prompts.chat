import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  extractKeywords,
  getRelatedSkillsAndBots,
  lexicalScore,
  rankRelated,
  RELATED_LIMIT,
  type RelevanceCandidate,
  type RelevanceItem,
} from "@/lib/related-content";

vi.mock("next/cache", () => ({
  unstable_cache: <T>(fn: T) => fn,
}));

vi.mock("@/lib/db", () => ({
  db: {
    prompt: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

function item(id: string, overrides: Partial<RelevanceItem> = {}): RelevanceItem {
  return { id, title: "", description: null, categoryId: null, categoryParentId: null, tagIds: [], ...overrides };
}

function candidate(id: string, type: "SKILL" | "BOT", overrides: Partial<RelevanceItem> = {}): RelevanceCandidate {
  return { ...item(id, overrides), type };
}

describe("extractKeywords", () => {
  it("lowercases, drops short and stop words, and dedupes", () => {
    expect([...extractKeywords("Write a Python script for the Python CLI, an AI prompt")]).toEqual([
      "write",
      "python",
      "script",
      "cli",
    ]);
  });

  it("keeps non-Latin words", () => {
    expect(extractKeywords("Перевод текста")).toEqual(new Set(["перевод", "текста"]));
  });
});

describe("lexicalScore", () => {
  const source = item("p", {
    title: "Code review checklist",
    description: "Review pull requests for security issues",
    categoryId: "cat-dev",
    categoryParentId: "cat-tech",
    tagIds: ["t-code", "t-security"],
  });
  const keywords = extractKeywords(`${source.title} ${source.description}`);

  it("scores 3 per shared tag", () => {
    expect(lexicalScore(source, keywords, item("c", { tagIds: ["t-code", "t-security", "t-other"] }))).toBe(6);
  });

  it("scores 2 for the same category and 1 for a related one", () => {
    expect(lexicalScore(source, keywords, item("c", { categoryId: "cat-dev" }))).toBe(2);
    expect(lexicalScore(source, keywords, item("c", { categoryId: "cat-tech" }))).toBe(1);
    expect(lexicalScore(source, keywords, item("c", { categoryId: "cat-ops", categoryParentId: "cat-tech" }))).toBe(1);
    expect(lexicalScore(source, keywords, item("c", { categoryId: "cat-art" }))).toBe(0);
  });

  it("adds shared keywords, capped at 3, on top of a tag or category match", () => {
    expect(lexicalScore(source, keywords, item("c", { categoryId: "cat-dev", title: "Security review" }))).toBe(4);
    expect(
      lexicalScore(
        source,
        keywords,
        item("c", { tagIds: ["t-code"], title: "Code review", description: "security checklist for pull requests" })
      )
    ).toBe(6);
  });

  it("ignores keywords without a shared tag or category", () => {
    expect(lexicalScore(source, keywords, item("c", { title: "Code review security checklist" }))).toBe(0);
  });
});

describe("rankRelated", () => {
  const source = item("p", { title: "Kubernetes deployment helper", tagIds: ["t-devops"], categoryId: "cat-dev" });

  it("splits by kind and leaves out the source and weak matches", () => {
    const result = rankRelated(
      source,
      [
        candidate("s1", "SKILL", { tagIds: ["t-devops"], title: "Kubernetes" }),
        candidate("s2", "SKILL", { title: "Kubernetes deployment" }),
        candidate("s3", "SKILL", { tagIds: ["t-devops"] }),
        candidate("b1", "BOT", { tagIds: ["t-devops"], categoryId: "cat-dev" }),
        candidate("p", "SKILL", { tagIds: ["t-devops"], categoryId: "cat-dev" }),
      ],
      new Map()
    );
    expect(result).toEqual({ SKILL: ["s1"], BOT: ["b1"] });
  });

  it("ranks embedding matches first, then fills with lexical matches", () => {
    const result = rankRelated(
      source,
      [
        candidate("lex", "SKILL", { tagIds: ["t-devops"], categoryId: "cat-dev" }),
        candidate("sem-low", "SKILL"),
        candidate("sem-high", "SKILL"),
        candidate("below", "SKILL"),
      ],
      new Map([
        ["sem-low", 0.45],
        ["sem-high", 0.7],
        ["below", 0.3],
      ])
    );
    expect(result.SKILL).toEqual(["sem-high", "sem-low", "lex"]);
  });

  it("uses the lexical score to break close embedding ties", () => {
    const result = rankRelated(
      source,
      [candidate("plain", "BOT"), candidate("tagged", "BOT", { tagIds: ["t-devops"] })],
      new Map([
        ["plain", 0.51],
        ["tagged", 0.5],
      ])
    );
    expect(result.BOT).toEqual(["tagged", "plain"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => candidate(`s${i}`, "SKILL", { tagIds: ["t-devops"], categoryId: "cat-dev" }));
    expect(rankRelated(source, many, new Map(), 4).SKILL).toHaveLength(4);
  });
});

describe("getRelatedSkillsAndBots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function skillRow(id: string) {
    return {
      id,
      title: `Skill ${id}`,
      slug: null,
      description: null,
      type: "SKILL",
      author: { id: "u", name: null, username: "u", avatar: null },
      category: null,
      _count: { votes: 0 },
    };
  }

  it("returns nothing for a prompt with no matches", async () => {
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "p", title: "Unique", description: null, categoryId: null, category: null, tags: [],
    } as never);
    vi.mocked(db.prompt.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.prompt.count).mockResolvedValue(0);

    expect(await getRelatedSkillsAndBots("p")).toEqual({ skills: [], bots: [] });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("keeps ranked order, drops excluded ids and caps each section", async () => {
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "p", title: "Docs", description: null, categoryId: "c", category: null, tags: [{ tagId: "t" }],
    } as never);
    const candidates = Array.from({ length: 7 }, (_, i) => ({
      id: `s${i}`, type: "SKILL", title: "x", description: null, categoryId: "c", category: null, tags: [{ tagId: "t" }],
    }));
    vi.mocked(db.prompt.findMany)
      .mockResolvedValueOnce(candidates as never)
      .mockResolvedValueOnce(candidates.map((c) => skillRow(c.id)).reverse() as never);
    vi.mocked(db.prompt.count).mockResolvedValue(1);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ id: "s6", similarity: 0.9 }] as never);

    const { skills, bots } = await getRelatedSkillsAndBots("p", { excludeIds: ["s0"] });
    expect(skills.map((s) => s.id)).toEqual(["s6", "s1", "s2", "s3"]);
    expect(skills).toHaveLength(RELATED_LIMIT);
    expect(bots).toEqual([]);
  });

  it("hides the sections instead of failing the page when ranking throws", async () => {
    vi.mocked(db.prompt.findUnique).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getRelatedSkillsAndBots("p")).toEqual({ skills: [], bots: [] });
  });
});
