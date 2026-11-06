import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { formatClassifierDefinition, RESERVED_SLUGS, validateChain, validateClassifierDefinition } from "./index";
import { definitionFromConfig, CLASSIFIER_LIMITS } from "./schema";
import { CLASSIFIERS_CACHE_TAG, toClassifierChain, classifierPromptSelect, toClassifierRecord } from "./store";
import type { ClassifierFields } from "./change-snapshot";
import type { ClassifierDefinition } from "./types";

/**
 * Server-side rules for writing a CLASSIFIER prompt, shared by create, update, change requests and
 * their approval: the structured fields must be a valid classifier, curated chains that use it must
 * still line up with its outcomes, and Prompt.content is always derived from the fields.
 */

export interface ClassifierWriteProblem {
  error: "invalid_classifier" | "classifier_in_chain";
  message: string;
  details: string[];
}

export function classifierDefinition(slug: string, title: string, fields: ClassifierFields): ClassifierDefinition {
  return definitionFromConfig({ slug, name: title, summary: fields.description }, fields.config);
}

/** The plain-text definition stored in Prompt.content, used by search, copy and generic prompt readers */
export function classifierContent(slug: string, title: string, fields: ClassifierFields): string {
  return formatClassifierDefinition(classifierDefinition(slug, title, fields));
}

/**
 * Problems with writing these fields to the classifier `promptId` (null when creating): an invalid
 * definition, unknown sources, or a curated chain that would no longer validate.
 */
export async function checkClassifierWrite(
  promptId: string | null,
  slug: string,
  title: string,
  fields: ClassifierFields,
  { isPrivate = false }: { isPrivate?: boolean } = {}
): Promise<ClassifierWriteProblem | null> {
  if (title.trim().length === 0 || title.length > CLASSIFIER_LIMITS.name) {
    return { error: "invalid_classifier", message: "Invalid classifier", details: [`name must be 1-${CLASSIFIER_LIMITS.name} characters`] };
  }
  const definition = classifierDefinition(slug, title, fields);
  const sources = new Set((await db.classifierSource.findMany({ select: { id: true } })).map((s) => s.id));
  const errors = validateClassifierDefinition(definition, { sources });
  if (errors.length > 0) {
    return { error: "invalid_classifier", message: "Invalid classifier", details: errors };
  }
  if (!promptId) return null;

  const chainRows = await db.classifierChain.findMany({
    where: { steps: { some: { classifierId: promptId } } },
    include: {
      steps: {
        orderBy: { position: "asc" },
        include: { classifier: { select: { classifierSlug: true, isPrivate: true, deletedAt: true, type: true } } },
      },
    },
  });
  if (chainRows.length === 0) return null;
  if (isPrivate) {
    return {
      error: "classifier_in_chain",
      message: "Classifiers used by a chain must stay public",
      details: chainRows.map((c) => c.slug),
    };
  }

  const usedIds = [...new Set(chainRows.flatMap((c) => c.steps.map((s) => s.classifierId)))].filter((id) => id !== promptId);
  const others = await db.prompt.findMany({ where: { id: { in: usedIds } }, select: classifierPromptSelect });
  const bySlug = new Map<string, ClassifierDefinition>([[slug, definition]]);
  for (const row of others) {
    const record = toClassifierRecord(row);
    if (record) bySlug.set(record.slug, record);
  }
  const chainSlugs = new Set((await db.classifierChain.findMany({ select: { slug: true } })).map((c) => c.slug));
  const chainErrors = chainRows.flatMap((row) => {
    const chain = toClassifierChain({
      ...row,
      steps: row.steps.map((s) => (s.classifierId === promptId ? { ...s, classifier: { ...s.classifier, classifierSlug: slug } } : s)),
    });
    return chain ? validateChain(chain, { classifiers: bySlug, chainSlugs, sources }) : [`chain "${row.slug}" uses a classifier that is not public`];
  });
  if (chainErrors.length > 0) {
    return {
      error: "classifier_in_chain",
      message: "This change would break a chain that uses the classifier",
      details: chainErrors,
    };
  }
  return null;
}

/** A free, stable URL slug for a new classifier: from the title, never a chain's or reserved slug */
export async function allocateClassifierSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 60).replace(/-+$/, "") || "classifier";
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt < 5 ? attempt + 1 : Math.random().toString(36).slice(2, 7)}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const [prompt, chain] = await Promise.all([
      db.prompt.findUnique({ where: { classifierSlug: candidate }, select: { id: true } }),
      db.classifierChain.findUnique({ where: { slug: candidate }, select: { id: true } }),
    ]);
    if (!prompt && !chain) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** A failed cache revalidation must not fail a write that has already been committed */
export function revalidateClassifiers() {
  for (const tag of [CLASSIFIERS_CACHE_TAG, "prompts"]) {
    try {
      revalidateTag(tag, "max");
    } catch (error) {
      console.warn(`Could not revalidate cache tag "${tag}":`, error instanceof Error ? error.message : error);
    }
  }
}
