import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CLASSIFIER_CATEGORIES } from "./categories";
import { CURATED_CLASSIFIER_ID_PREFIX, parseClassifierConfig, definitionFromConfig } from "./schema";
export { CURATED_CHAIN_ID_PREFIX, CURATED_CLASSIFIER_ID_PREFIX, curatedChainId, curatedClassifierId } from "./schema";
import type {
  ChainBranch,
  ChainInputRef,
  ChainScenario,
  ChainTerminal,
  ClassifierChain,
  ClassifierInput,
  ClassifierRecord,
  ClassifierSource,
  ReferenceKind,
} from "./types";

/** Cache tag of every classifier read; prompt writes also revalidate "prompts", which the catalog listens to */
export const CLASSIFIERS_CACHE_TAG = "classifiers";

const visibleClassifierWhere = {
  type: "CLASSIFIER",
  isPrivate: false,
  deletedAt: null,
  classifierSlug: { not: null },
} satisfies Prisma.PromptWhereInput;

export const classifierPromptSelect = {
  id: true,
  title: true,
  description: true,
  classifierSlug: true,
  classifierConfig: true,
  isPrivate: true,
  isUnlisted: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { id: true, name: true, username: true, avatar: true, verified: true } },
  classifierPairingsFrom: {
    where: { to: visibleClassifierWhere },
    orderBy: { position: "asc" },
    select: { reason: true, to: { select: { classifierSlug: true } } },
  },
} satisfies Prisma.PromptSelect;

type ClassifierRow = Prisma.PromptGetPayload<{ select: typeof classifierPromptSelect }>;

/** The classifier view of a CLASSIFIER prompt row; null when its stored config is not valid */
export function toClassifierRecord(row: ClassifierRow): ClassifierRecord | null {
  const config = parseClassifierConfig(row.classifierConfig);
  if (!config || !row.classifierSlug) {
    console.error(`Classifier ${row.id} has no valid classifier config`);
    return null;
  }
  const betterTogether = row.classifierPairingsFrom
    .filter((p) => p.to.classifierSlug)
    .map((p) => ({ slug: p.to.classifierSlug!, reason: p.reason }));
  return {
    ...definitionFromConfig({ slug: row.classifierSlug, name: row.title, summary: row.description ?? "" }, config, betterTogether),
    id: row.id,
    curated: row.id.startsWith(CURATED_CLASSIFIER_ID_PREFIX),
    author: row.author,
    isPrivate: row.isPrivate,
    isUnlisted: row.isUnlisted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const chainInclude = {
  steps: {
    orderBy: { position: "asc" },
    include: { classifier: { select: { classifierSlug: true, isPrivate: true, deletedAt: true, type: true } } },
  },
} satisfies Prisma.ClassifierChainInclude;

type ChainRow = Prisma.ClassifierChainGetPayload<{ include: typeof chainInclude }>;

/** The chain view of a stored chain; null when a step's classifier is missing, private or deleted */
export function toClassifierChain(row: ChainRow): ClassifierChain | null {
  if (
    row.steps.some(
      (s) => s.classifier.type !== "CLASSIFIER" || !s.classifier.classifierSlug || s.classifier.isPrivate || s.classifier.deletedAt
    )
  ) {
    console.error(`Chain ${row.slug} uses a classifier that is not public`);
    return null;
  }
  return {
    slug: row.slug,
    name: row.name,
    category: row.category as ClassifierChain["category"],
    summary: row.summary,
    goal: row.goal,
    input: row.input as unknown as ClassifierInput,
    entry: row.entry,
    steps: row.steps.map((s) => ({
      id: s.stepId,
      classifier: s.classifier.classifierSlug!,
      purpose: s.purpose,
      receives: s.receives as unknown as ChainInputRef[],
      branches: s.branches as unknown as ChainBranch[],
    })),
    terminals: row.terminals as unknown as ChainTerminal[],
    scenarios: row.scenarios as unknown as ChainScenario[],
    notes: row.notes,
    references: row.references,
  };
}

function categoryRank(category: string) {
  const rank = CLASSIFIER_CATEGORIES.indexOf(category as (typeof CLASSIFIER_CATEGORIES)[number]);
  return rank === -1 ? CLASSIFIER_CATEGORIES.length : rank;
}

export interface ClassifierCatalog {
  /** Public classifiers, unlisted ones included so chains and links that use them keep working */
  classifiers: ClassifierRecord[];
  chains: ClassifierChain[];
  sources: ClassifierSource[];
}

async function loadCatalog(): Promise<ClassifierCatalog> {
  const [classifierRows, chainRows, sourceRows] = await Promise.all([
    db.prompt.findMany({ where: visibleClassifierWhere, select: classifierPromptSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    db.classifierChain.findMany({ include: chainInclude, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.classifierSource.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
  ]);
  const classifiers = classifierRows
    .map(toClassifierRecord)
    .filter((c): c is ClassifierRecord => c !== null)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || Number(b.curated) - Number(a.curated));
  const chains = chainRows
    .map(toClassifierChain)
    .filter((c): c is ClassifierChain => c !== null)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
  const sources = sourceRows.map(({ id, title, url, publisher, kind, note }) => ({
    id,
    title,
    url,
    publisher,
    kind: kind as ReferenceKind,
    note,
  }));
  return { classifiers, chains, sources };
}

let cachedCatalog: (() => Promise<ClassifierCatalog>) | undefined;

/** The public catalog, cached until a classifier, prompt or chain write revalidates it */
export async function getClassifierCatalog(): Promise<ClassifierCatalog> {
  cachedCatalog ??= unstable_cache(loadCatalog, ["classifier-catalog"], {
    tags: [CLASSIFIERS_CACHE_TAG, "prompts"],
    revalidate: 300,
  });
  const catalog = await cachedCatalog();
  // unstable_cache returns JSON, so dates come back as strings
  return {
    ...catalog,
    classifiers: catalog.classifiers.map((c) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })),
  };
}

export interface ClassifierVotes {
  counts: Map<string, number>;
  /** Prompt ids the viewer has upvoted */
  voted: Set<string>;
}

/** Vote counts and the viewer's own votes, read outside the catalog cache so a vote shows on the next visit */
export async function getClassifierVotes(promptIds: string[], userId?: string): Promise<ClassifierVotes> {
  if (promptIds.length === 0) return { counts: new Map(), voted: new Set() };
  const [counts, own] = await Promise.all([
    db.promptVote.groupBy({ by: ["promptId"], where: { promptId: { in: promptIds } }, _count: { _all: true } }),
    userId ? db.promptVote.findMany({ where: { userId, promptId: { in: promptIds } }, select: { promptId: true } }) : [],
  ]);
  return {
    counts: new Map(counts.map((c) => [c.promptId, c._count._all])),
    voted: new Set(own.map((v) => v.promptId)),
  };
}

/** Classifiers listed in the catalog: public, not unlisted */
export function listedClassifiers(catalog: ClassifierCatalog): ClassifierRecord[] {
  return catalog.classifiers.filter((c) => !c.isUnlisted);
}

export const classifierPageSelect = {
  ...classifierPromptSelect,
  deletedAt: true,
  delistReason: true,
  isFeatured: true,
  trendingUntil: true,
  _count: { select: { votes: true } },
} satisfies Prisma.PromptSelect;

export type ClassifierPageRow = Prisma.PromptGetPayload<{ select: typeof classifierPageSelect }>;

/** A classifier by slug whatever its visibility; callers decide who may see it. Not cached. */
export async function findClassifierBySlug(slug: string, { includeDeleted = false } = {}) {
  const row = await db.prompt.findUnique({ where: { classifierSlug: slug }, select: { ...classifierPageSelect, type: true } });
  if (!row || row.type !== "CLASSIFIER" || (row.deletedAt && !includeDeleted)) return null;
  const record = toClassifierRecord(row);
  return record ? { record, row } : null;
}

export async function findChainBySlug(slug: string): Promise<ClassifierChain | null> {
  const row = await db.classifierChain.findUnique({ where: { slug }, include: chainInclude });
  return row ? toClassifierChain(row) : null;
}
