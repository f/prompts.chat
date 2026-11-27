import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { botSelect, toBotView, type BotView } from "@/lib/bots";

export type RelatedKind = "SKILL" | "BOT";

/** Cards shown per section */
export const RELATED_LIMIT = 4;
/** Ids kept per kind, so the page can drop ones it already shows and still fill a section */
const RELATED_POOL = RELATED_LIMIT * 2;
/** Same bar the AI search uses; cross-type matches score lower than same-type ones */
export const SEMANTIC_THRESHOLD = 0.4;
/** Below this a lexical match is noise, e.g. one broad shared tag like "workflow" */
export const LEXICAL_MIN_SCORE = 4;
const LEXICAL_BOOST = 0.02;
const MAX_KEYWORD_POINTS = 3;
const CACHE_SECONDS = 6 * 60 * 60;

/** Public, listed, not deleted: the same visibility rules as every public listing */
const publicWhere = {
  isPrivate: false,
  isUnlisted: false,
  deletedAt: null,
} satisfies Prisma.PromptWhereInput;

export interface RelevanceItem {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryParentId: string | null;
  tagIds: string[];
}

export interface RelevanceCandidate extends RelevanceItem {
  type: RelatedKind;
}

const STOP_WORDS = new Set(
  (
    "a an and are as at be by for from has have how in into is it its of on or that the this to was were will with " +
    "you your our we they them their can do does not but all any use using used make makes create creates help helps " +
    "get gets new best more most other one two way ways like just also about over than then when what which who why " +
    "prompt prompts skill skills bot bots agent agents assistant ai act acts"
  ).split(" ")
);

/** Distinct lowercase words of 3+ letters, without stop words */
export function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return new Set(words.filter((word) => !STOP_WORDS.has(word)));
}

/**
 * 3 points per shared tag, 2 for the same category (1 for a parent, child or
 * sibling category) and 1 per shared title/description keyword, at most 3.
 * Keywords alone are too noisy to relate items, so without a shared tag or
 * category the score is 0.
 */
export function lexicalScore(source: RelevanceItem, sourceKeywords: Set<string>, candidate: RelevanceItem): number {
  const sourceTags = new Set(source.tagIds);
  let score = candidate.tagIds.filter((tagId) => sourceTags.has(tagId)).length * 3;

  if (source.categoryId && candidate.categoryId) {
    if (source.categoryId === candidate.categoryId) {
      score += 2;
    } else if (
      candidate.categoryParentId === source.categoryId ||
      candidate.categoryId === source.categoryParentId ||
      (source.categoryParentId !== null && candidate.categoryParentId === source.categoryParentId)
    ) {
      score += 1;
    }
  }
  if (score === 0) return 0;

  let shared = 0;
  for (const keyword of extractKeywords(`${candidate.title} ${candidate.description ?? ""}`)) {
    if (sourceKeywords.has(keyword) && ++shared === MAX_KEYWORD_POINTS) break;
  }
  return score + shared;
}

/**
 * Ranks candidates of each kind: embedding matches above SEMANTIC_THRESHOLD
 * first (lexical score as a small boost), then lexical matches to fill up
 */
export function rankRelated(
  source: RelevanceItem,
  candidates: RelevanceCandidate[],
  similarities: Map<string, number>,
  limit = RELATED_POOL
): Record<RelatedKind, string[]> {
  const sourceKeywords = extractKeywords(`${source.title} ${source.description ?? ""}`);
  const result: Record<RelatedKind, string[]> = { SKILL: [], BOT: [] };

  for (const kind of ["SKILL", "BOT"] as const) {
    const scored = candidates
      .filter((candidate) => candidate.type === kind && candidate.id !== source.id)
      .map((candidate) => ({
        id: candidate.id,
        lexical: lexicalScore(source, sourceKeywords, candidate),
        similarity: similarities.get(candidate.id),
      }));

    const semantic = scored
      .filter((item) => item.similarity !== undefined && item.similarity >= SEMANTIC_THRESHOLD)
      .map((item) => ({ id: item.id, score: item.similarity! + LEXICAL_BOOST * Math.min(item.lexical, 6) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const picked = new Set(semantic.map((item) => item.id));
    const lexical = scored
      .filter((item) => !picked.has(item.id) && item.lexical >= LEXICAL_MIN_SCORE)
      .sort((a, b) => b.lexical - a.lexical || a.id.localeCompare(b.id));

    result[kind] = [...semantic, ...lexical].slice(0, limit).map((item) => item.id);
  }
  return result;
}

/**
 * Cosine similarity between the prompt's embedding and every public skill and
 * bot embedding, computed in Postgres so embeddings never leave the database
 */
async function embeddingSimilarities(promptId: string): Promise<Map<string, number>> {
  const hasEmbedding = await db.prompt.count({ where: { id: promptId, embedding: { not: Prisma.DbNull } } });
  if (hasEmbedding === 0) return new Map();

  const rows = await db.$queryRaw<{ id: string; similarity: number | null }[]>`
    WITH src AS (
      SELECT e.ord, e.val::float8 AS v
      FROM "prompts" p, jsonb_array_elements_text(p."embedding") WITH ORDINALITY AS e(val, ord)
      WHERE p."id" = ${promptId} AND jsonb_typeof(p."embedding") = 'array'
    )
    SELECT c."id",
      SUM(s.v * e.val::float8) / NULLIF(SQRT(SUM(s.v * s.v)) * SQRT(SUM(e.val::float8 * e.val::float8)), 0) AS similarity
    FROM "prompts" c
    CROSS JOIN LATERAL jsonb_array_elements_text(c."embedding") WITH ORDINALITY AS e(val, ord)
    JOIN src s ON s.ord = e.ord
    WHERE c."type"::text IN ('SKILL', 'BOT')
      AND c."isPrivate" = false
      AND c."isUnlisted" = false
      AND c."deletedAt" IS NULL
      AND c."id" <> ${promptId}
      AND jsonb_typeof(c."embedding") = 'array'
    GROUP BY c."id"
  `;
  return new Map(rows.filter((row) => row.similarity !== null).map((row) => [row.id, Number(row.similarity)]));
}

async function computeRelatedIds(promptId: string): Promise<Record<RelatedKind, string[]>> {
  const source = await db.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      title: true,
      description: true,
      categoryId: true,
      category: { select: { parentId: true } },
      tags: { select: { tagId: true } },
    },
  });
  if (!source) return { SKILL: [], BOT: [] };

  const [records, similarities] = await Promise.all([
    db.prompt.findMany({
      where: { ...publicWhere, type: { in: ["SKILL", "BOT"] }, id: { not: promptId } },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        categoryId: true,
        category: { select: { parentId: true } },
        tags: { select: { tagId: true } },
      },
    }),
    embeddingSimilarities(promptId),
  ]);

  const toItem = (record: NonNullable<typeof source>): RelevanceItem => ({
    id: record.id,
    title: record.title,
    description: record.description,
    categoryId: record.categoryId,
    categoryParentId: record.category?.parentId ?? null,
    tagIds: record.tags.map(({ tagId }) => tagId),
  });
  const candidates = records.map((record) => ({ ...toItem(record), type: record.type as RelatedKind }));
  return rankRelated(toItem(source), candidates, similarities);
}

/** Ranked ids only; cards are loaded fresh so visibility changes apply at once */
const getRelatedIds = unstable_cache(computeRelatedIds, ["related-skills-bots"], {
  revalidate: CACHE_SECONDS,
  tags: ["prompts"],
});

const skillCardSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  type: true,
  author: { select: { id: true, name: true, username: true, avatar: true } },
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { votes: true } },
} satisfies Prisma.PromptSelect;

export type RelatedSkill = Prisma.PromptGetPayload<{ select: typeof skillCardSelect }>;

function inOrder<T extends { id: string }>(ids: string[], items: T[], exclude: Set<string>): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item && !exclude.has(id) ? [item] : [];
  });
}

/**
 * Public skills and bots related to a prompt, up to RELATED_LIMIT of each.
 * Ids in excludeIds (e.g. related prompts already on the page) are skipped.
 */
export async function getRelatedSkillsAndBots(
  promptId: string,
  { excludeIds = [] }: { excludeIds?: string[] } = {}
): Promise<{ skills: RelatedSkill[]; bots: BotView[] }> {
  let ids: Record<RelatedKind, string[]>;
  try {
    ids = await getRelatedIds(promptId);
  } catch (error) {
    console.error("Failed to compute related skills and bots:", error);
    return { skills: [], bots: [] };
  }
  if (ids.SKILL.length === 0 && ids.BOT.length === 0) return { skills: [], bots: [] };

  const [skills, bots] = await Promise.all([
    ids.SKILL.length > 0
      ? db.prompt.findMany({ where: { ...publicWhere, type: "SKILL", id: { in: ids.SKILL } }, select: skillCardSelect })
      : [],
    ids.BOT.length > 0
      ? db.prompt.findMany({ where: { ...publicWhere, type: "BOT", id: { in: ids.BOT } }, select: botSelect })
      : [],
  ]);
  const exclude = new Set([promptId, ...excludeIds]);
  return {
    skills: inOrder(ids.SKILL, skills, exclude).slice(0, RELATED_LIMIT),
    bots: inOrder(ids.BOT, bots.map(toBotView), exclude).slice(0, RELATED_LIMIT),
  };
}
