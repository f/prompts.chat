/**
 * Builds the SQL that inserts the curated classifier catalog. The same statements are run by
 * prisma/classifiers/import.ts (local seeding and tests) and written to the production artifact
 * by scripts/generate-classifier-sql.ts, so both paths insert exactly the same rows.
 *
 * Guarantees:
 * - The fixtures are validated in full (catalog rules, field schema, sizes, slugs) before any SQL
 *   is produced; an invalid catalog throws and nothing is written.
 * - Insert-only: every INSERT is ON CONFLICT DO NOTHING; nothing is updated, deleted or truncated.
 *   Rows that already exist (including curated rows edited since, and every user classifier) are
 *   left exactly as they are.
 * - Curated rows have fixed ids (`classifier-<slug>`, `chain-<slug>`). A precheck aborts the whole
 *   transaction if a fixture slug is held by any other prompt or chain, so user content is never
 *   overwritten and never silently shadows curated content.
 * - Pairings, versions and chain steps are only inserted for classifiers and chains created by
 *   this run, so a later deletion of a pairing or step by an admin is not undone by a re-run.
 * - A postcheck verifies every curated classifier, chain and step reference before commit.
 */
import { CLASSIFIERS, CHAINS, SOURCES } from "./fixtures";
import { formatClassifierDefinition, validateCatalog } from "../../src/lib/classifiers/index";
import {
  CLASSIFIER_LIMITS,
  configFromDefinition,
  curatedChainId,
  curatedClassifierId,
  definitionFromConfig,
  parseClassifierConfig,
  type ClassifierConfig,
} from "../../src/lib/classifiers/schema";

export const CLASSIFIER_SEED_BATCH_SIZE = 10;

export type ClassifierSeedAuthor = { id: string } | { username: string } | { firstAdmin: true };

export interface ClassifierSeedCounts {
  classifiers: number;
  scenarios: number;
  pairings: number;
  chains: number;
  steps: number;
  paths: number;
  sources: number;
}

interface PreparedClassifier {
  id: string;
  slug: string;
  name: string;
  summary: string;
  config: ClassifierConfig;
  content: string;
}

/** A SQL string literal; standard_conforming_strings is on, so only single quotes need escaping */
export function sqlString(value: string): string {
  if (value.includes("\u0000")) throw new Error("NUL characters cannot be stored in Postgres text");
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values: readonly string[]): string {
  return values.length === 0 ? "ARRAY[]::text[]" : `ARRAY[${values.map(sqlString).join(", ")}]::text[]`;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Validates the full fixture dataset; throws with every problem found */
export function prepareClassifierCatalog() {
  const problems: string[] = [];
  problems.push(...validateCatalog(CLASSIFIERS, CHAINS, SOURCES.map((s) => s.id)));

  const seen = new Set<string>();
  for (const id of [...SOURCES.map((s) => `source:${s.id}`), ...CLASSIFIERS.map((c) => `slug:${c.slug}`), ...CHAINS.map((c) => `slug:${c.slug}`)]) {
    if (seen.has(id)) problems.push(`duplicate ${id}`);
    seen.add(id);
  }

  const classifiers: PreparedClassifier[] = [];
  for (const c of CLASSIFIERS) {
    if (c.name.length > CLASSIFIER_LIMITS.name) problems.push(`classifier "${c.slug}": name is longer than ${CLASSIFIER_LIMITS.name}`);
    if (c.summary.length > CLASSIFIER_LIMITS.summary) problems.push(`classifier "${c.slug}": summary is longer than ${CLASSIFIER_LIMITS.summary}`);
    const config = parseClassifierConfig(configFromDefinition(c));
    if (!config) {
      problems.push(`classifier "${c.slug}": fields do not match the classifier schema`);
      continue;
    }
    const content = formatClassifierDefinition(definitionFromConfig({ slug: c.slug, name: c.name, summary: c.summary }, config));
    classifiers.push({ id: curatedClassifierId(c.slug), slug: c.slug, name: c.name, summary: c.summary, config, content });
  }

  if (problems.length > 0) {
    throw new Error(`Classifier fixtures are invalid:\n- ${problems.join("\n- ")}`);
  }

  const counts: ClassifierSeedCounts = {
    classifiers: classifiers.length,
    scenarios: CLASSIFIERS.reduce((n, c) => n + c.scenarios.length, 0),
    pairings: CLASSIFIERS.reduce((n, c) => n + c.betterTogether.length, 0),
    chains: CHAINS.length,
    steps: CHAINS.reduce((n, c) => n + c.steps.length, 0),
    paths: CHAINS.reduce((n, c) => n + c.scenarios.length, 0),
    sources: SOURCES.length,
  };
  return { classifiers, counts };
}

function authorCondition(author: ClassifierSeedAuthor): string {
  if ("id" in author) return `id = ${sqlString(author.id)}`;
  if ("username" in author) return `username = ${sqlString(author.username)}`;
  return `role = 'ADMIN'`;
}

/**
 * The seed as an ordered list of single statements, to be run inside one transaction (the temp
 * tables are dropped on commit). Statements never take parameters.
 */
export function buildClassifierSeedStatements(author: ClassifierSeedAuthor = { firstAdmin: true }): string[] {
  const { classifiers } = prepareClassifierCatalog();
  const classifierIds = classifiers.map((c) => `(${sqlString(c.slug)}, ${sqlString(c.id)})`).join(",\n    ");
  const chainIds = CHAINS.map((c) => `(${sqlString(c.slug)}, ${sqlString(curatedChainId(c.slug))})`).join(",\n    ");

  const statements: string[] = [];

  statements.push(`CREATE TEMP TABLE classifier_seed_author ON COMMIT DROP AS
  SELECT id FROM users WHERE ${authorCondition(author)} ORDER BY "createdAt", id LIMIT 1`);
  statements.push(`CREATE TEMP TABLE classifier_seed_fixture_classifiers ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ${classifierIds}
  ) AS f(slug, id)`);
  statements.push(`CREATE TEMP TABLE classifier_seed_fixture_chains ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ${chainIds}
  ) AS f(slug, id)`);
  statements.push(`CREATE TEMP TABLE classifier_seed_new_prompts (id text PRIMARY KEY) ON COMMIT DROP`);
  statements.push(`CREATE TEMP TABLE classifier_seed_new_chains (id text PRIMARY KEY) ON COMMIT DROP`);

  statements.push(`DO $classifier_seed$
DECLARE
  conflicts text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM classifier_seed_author) THEN
    RAISE EXCEPTION 'classifier seed: the curated catalog owner (${authorCondition(author).replace(/'/g, "''")}) does not exist';
  END IF;

  SELECT string_agg(f.slug || ' (prompt ' || p.id || ')', ', ') INTO conflicts
  FROM classifier_seed_fixture_classifiers f JOIN prompts p ON p."classifierSlug" = f.slug AND p.id <> f.id;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: curated classifier slugs are held by other prompts: %', conflicts;
  END IF;

  SELECT string_agg(f.id, ', ') INTO conflicts
  FROM classifier_seed_fixture_classifiers f JOIN prompts p ON p.id = f.id
  WHERE p.type::text <> 'CLASSIFIER' OR p."classifierSlug" IS DISTINCT FROM f.slug;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: curated classifier ids exist with another type or slug: %', conflicts;
  END IF;

  SELECT string_agg(f.slug || ' (chain ' || c.id || ')', ', ') INTO conflicts
  FROM classifier_seed_fixture_chains f JOIN classifier_chains c ON c.slug = f.slug AND c.id <> f.id;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: curated chain slugs are held by other chains: %', conflicts;
  END IF;

  SELECT string_agg(f.slug, ', ') INTO conflicts
  FROM classifier_seed_fixture_chains f JOIN prompts p ON p."classifierSlug" = f.slug;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: curated chain slugs are used by classifiers: %', conflicts;
  END IF;

  SELECT string_agg(f.slug, ', ') INTO conflicts
  FROM classifier_seed_fixture_classifiers f JOIN classifier_chains c ON c.slug = f.slug;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: curated classifier slugs are used by chains: %', conflicts;
  END IF;
END
$classifier_seed$`);

  for (const batch of chunk(SOURCES.map((s, position) => ({ ...s, position })), CLASSIFIER_SEED_BATCH_SIZE)) {
    statements.push(`INSERT INTO classifier_sources (id, title, url, publisher, kind, note, position)
VALUES
  ${batch
    .map((s) => `(${[s.id, s.title, s.url, s.publisher, s.kind, s.note].map(sqlString).join(", ")}, ${s.position})`)
    .join(",\n  ")}
ON CONFLICT DO NOTHING`);
  }

  for (const batch of chunk(classifiers, CLASSIFIER_SEED_BATCH_SIZE)) {
    statements.push(`WITH inserted AS (
  INSERT INTO prompts (id, title, slug, description, content, type, "isPrivate", "authorId", "classifierSlug", "classifierConfig", "bestWithModels", "createdAt", "updatedAt")
  SELECT v.id, v.title, v.slug, v.description, v.content, 'CLASSIFIER'::"PromptType", false, a.id, v.slug, v.config, ARRAY[]::text[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM (VALUES
    ${batch
      .map((c) => `(${sqlString(c.id)}, ${sqlString(c.name)}, ${sqlString(c.slug)}, ${sqlString(c.summary)}, ${sqlString(c.content)}, ${sqlJson(c.config)})`)
      .join(",\n    ")}
  ) AS v(id, title, slug, description, content, config)
  CROSS JOIN classifier_seed_author a
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO classifier_seed_new_prompts (id) SELECT id FROM inserted`);
  }

  statements.push(`INSERT INTO prompt_versions (id, version, content, "changeNote", "promptId", "createdBy", "classifierSnapshot")
SELECT p.id || '-v1', 1, p.content, 'Initial version', p.id, p."authorId",
  jsonb_build_object('title', p.title, 'description', p.description, 'config', p."classifierConfig")
FROM prompts p JOIN classifier_seed_new_prompts n ON n.id = p.id
ON CONFLICT DO NOTHING`);

  const pairings = CLASSIFIERS.flatMap((c) =>
    c.betterTogether.map((link, position) => ({
      fromId: curatedClassifierId(c.slug),
      toId: curatedClassifierId(link.slug),
      reason: link.reason,
      position,
    }))
  );
  for (const batch of chunk(pairings, CLASSIFIER_SEED_BATCH_SIZE * 4)) {
    statements.push(`INSERT INTO classifier_pairings ("fromId", "toId", reason, position)
SELECT v."fromId", v."toId", v.reason, v.position
FROM (VALUES
  ${batch.map((p) => `(${sqlString(p.fromId)}, ${sqlString(p.toId)}, ${sqlString(p.reason)}, ${p.position})`).join(",\n  ")}
) AS v("fromId", "toId", reason, position)
WHERE v."fromId" IN (SELECT id FROM classifier_seed_new_prompts)
  AND EXISTS (SELECT 1 FROM prompts p WHERE p.id = v."toId")
ON CONFLICT DO NOTHING`);
  }

  for (const batch of chunk(CHAINS.map((c, position) => ({ c, position })), CLASSIFIER_SEED_BATCH_SIZE)) {
    statements.push(`WITH inserted AS (
  INSERT INTO classifier_chains (id, slug, name, category, summary, goal, input, entry, terminals, scenarios, notes, "references", position, "createdAt", "updatedAt")
  VALUES
    ${batch
      .map(
        ({ c, position }) =>
          `(${[curatedChainId(c.slug), c.slug, c.name, c.category, c.summary, c.goal].map(sqlString).join(", ")}, ${sqlJson(c.input)}, ${sqlString(c.entry)}, ${sqlJson(c.terminals)}, ${sqlJson(c.scenarios)}, ${sqlTextArray(c.notes)}, ${sqlTextArray(c.references)}, ${position}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .join(",\n    ")}
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO classifier_seed_new_chains (id) SELECT id FROM inserted`);
  }

  const steps = CHAINS.flatMap((c) =>
    c.steps.map((s, position) => ({ chainId: curatedChainId(c.slug), s, position, classifierId: curatedClassifierId(s.classifier) }))
  );
  for (const batch of chunk(steps, CLASSIFIER_SEED_BATCH_SIZE * 2)) {
    statements.push(`INSERT INTO classifier_chain_steps ("chainId", "stepId", position, "classifierId", purpose, receives, branches)
SELECT v."chainId", v."stepId", v.position, v."classifierId", v.purpose, v.receives, v.branches
FROM (VALUES
  ${batch
    .map(
      ({ chainId, s, position, classifierId }) =>
        `(${sqlString(chainId)}, ${sqlString(s.id)}, ${position}, ${sqlString(classifierId)}, ${sqlString(s.purpose)}, ${sqlJson(s.receives)}, ${sqlJson(s.branches)})`
    )
    .join(",\n  ")}
) AS v("chainId", "stepId", position, "classifierId", purpose, receives, branches)
WHERE v."chainId" IN (SELECT id FROM classifier_seed_new_chains)
ON CONFLICT DO NOTHING`);
  }

  statements.push(`DO $classifier_seed$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(f.id, ', ') INTO missing
  FROM classifier_seed_fixture_classifiers f
  LEFT JOIN prompts p ON p.id = f.id AND p.type::text = 'CLASSIFIER' AND p."classifierSlug" = f.slug AND p."classifierConfig" IS NOT NULL
  WHERE p.id IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: curated classifiers missing after import: %', missing;
  END IF;

  SELECT string_agg(f.id, ', ') INTO missing
  FROM classifier_seed_fixture_chains f LEFT JOIN classifier_chains c ON c.id = f.id AND c.slug = f.slug
  WHERE c.id IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: curated chains missing after import: %', missing;
  END IF;

  SELECT string_agg(s."chainId" || '/' || s."stepId", ', ') INTO missing
  FROM classifier_chain_steps s JOIN classifier_seed_new_chains n ON n.id = s."chainId"
  LEFT JOIN prompts p ON p.id = s."classifierId" AND p.type::text = 'CLASSIFIER'
  WHERE p.id IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'classifier seed: chain steps reference missing classifiers: %', missing;
  END IF;

  IF (SELECT count(*) FROM classifier_chain_steps s JOIN classifier_seed_new_chains n ON n.id = s."chainId")
     <> (SELECT count(*) FROM classifier_seed_new_chains n JOIN (VALUES
       ${CHAINS.map((c) => `(${sqlString(curatedChainId(c.slug))}, ${c.steps.length})`).join(", ")}
     ) AS e(id, steps) ON e.id = n.id CROSS JOIN LATERAL generate_series(1, e.steps)) THEN
    RAISE EXCEPTION 'classifier seed: new chains are missing steps';
  END IF;
END
$classifier_seed$`);

  return statements;
}

/** What this run inserted; run inside the seed transaction, before commit */
export const CLASSIFIER_SEED_SUMMARY_SQL = `SELECT
  (SELECT count(*) FROM classifier_seed_new_prompts)::int AS "classifiersInserted",
  (SELECT count(*) FROM classifier_seed_new_chains)::int AS "chainsInserted",
  (SELECT id FROM classifier_seed_author) AS "authorId"`;
