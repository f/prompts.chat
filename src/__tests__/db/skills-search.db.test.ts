import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { db } from "@/lib/db";
import { skillListWhere } from "@/lib/prompt-list";
import { GET as listPromptsRoute } from "@/app/api/prompts/route";

const AUTHOR = "skills-search-author";
const WORD = "Quokkaflux";

const rows = [
  { id: "skill-title", title: `${WORD} deploy helper`, type: "SKILL" },
  { id: "skill-description", title: "Release notes", description: `Writes notes for ${WORD.toLowerCase()} builds`, type: "SKILL" },
  { id: "skill-content", title: "Changelog", content: `# Steps\nRun ${WORD.toUpperCase()} checks`, type: "SKILL" },
  { id: "skill-other", title: "Unrelated skill", type: "SKILL" },
  { id: "skill-private", title: `${WORD} private`, type: "SKILL", isPrivate: true },
  { id: "skill-unlisted", title: `${WORD} unlisted`, type: "SKILL", isUnlisted: true },
  { id: "skill-deleted", title: `${WORD} deleted`, type: "SKILL", deletedAt: new Date() },
  { id: "prompt-not-skill", title: `${WORD} text prompt`, type: "TEXT" },
] as const;

const PUBLIC_MATCHES = ["skill-content", "skill-description", "skill-title"];

async function pageIds(q: string) {
  const found = await db.prompt.findMany({ where: { ...skillListWhere(q), authorId: AUTHOR }, select: { id: true } });
  return found.map((p) => p.id).sort();
}

async function apiIds(q: string) {
  const response = await listPromptsRoute(
    new NextRequest(`http://localhost/api/prompts?type=SKILL&q=${encodeURIComponent(q)}&perPage=50`)
  );
  const body = await response.json();
  return (body.prompts as { id: string; author: { id: string } }[])
    .filter((p) => p.author.id === AUTHOR)
    .map((p) => p.id)
    .sort();
}

beforeAll(async () => {
  await db.user.create({ data: { id: AUTHOR, email: `${AUTHOR}@example.test`, username: AUTHOR } });
  for (const row of rows) {
    await db.prompt.create({ data: { content: "Skill body", ...row, authorId: AUTHOR } });
  }
});

afterAll(async () => {
  await db.prompt.deleteMany({ where: { authorId: AUTHOR } });
  await db.user.delete({ where: { id: AUTHOR } });
});

describe("skills search", () => {
  it("finds public skills by title, description or content, ignoring case", async () => {
    expect(await pageIds(WORD.toLowerCase())).toEqual(PUBLIC_MATCHES);
    expect(await pageIds(WORD.toUpperCase())).toEqual(PUBLIC_MATCHES);
  });

  it("never returns private, unlisted, deleted or non-skill prompts", async () => {
    const ids = await pageIds(WORD);
    for (const hidden of ["skill-private", "skill-unlisted", "skill-deleted", "prompt-not-skill"]) {
      expect(ids).not.toContain(hidden);
    }
  });

  it("lists every public skill without a query and ignores surrounding whitespace", async () => {
    expect(await pageIds("")).toEqual([...PUBLIC_MATCHES, "skill-other"].sort());
    expect(await pageIds(`  ${WORD}  `)).toEqual(PUBLIC_MATCHES);
  });

  it("returns nothing for a query no skill matches", async () => {
    expect(await pageIds("zzzz-no-such-skill")).toEqual([]);
  });

  it("matches the API that loads further pages", async () => {
    expect(await apiIds(WORD)).toEqual(await pageIds(WORD));
    expect(await apiIds("zzzz-no-such-skill")).toEqual([]);
  });
});
