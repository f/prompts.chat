/**
 * Writes the reviewed SQL for loading classifiers into a database without running the app, in the
 * order it is applied:
 *
 *   00-preflight.sql            read-only; every row should report ok = true before anything is applied
 *   01-migration.sql            the Prisma migration, byte for byte (its sha256 is Prisma's migration checksum)
 *   02-record-migration.sql     records 01 in _prisma_migrations exactly like `prisma migrate resolve --applied`
 *   03-seed.sql                 the insert-only catalog import in one transaction (same statements as db:seed:classifiers)
 *   04-verify.sql               read-only; every row should report ok = true
 *   *.statements.json           01, 02 and 03 as arrays of single statements, for clients that run a list of
 *                               statements in one transaction instead of a psql script
 *   SHA256SUMS, manifest.json   checksums, counts, migration name and checksum, catalog owner
 *   README.md                   the ordered procedure
 *
 * Usage: npx tsx scripts/generate-classifier-sql.ts --out=<dir> [--author=<username>]
 * Without --author the catalog is owned by the oldest ADMIN user.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CHAINS, SOURCES } from "../prisma/classifiers/fixtures";
import {
  CLASSIFIER_SEED_BATCH_SIZE,
  buildClassifierSeedStatements,
  prepareClassifierCatalog,
  sqlString,
  type ClassifierSeedAuthor,
} from "../prisma/classifiers/seed-sql";
import { CURATED_CHAIN_ID_PREFIX, CURATED_CLASSIFIER_ID_PREFIX } from "../src/lib/classifiers/schema";

export const CLASSIFIER_MIGRATION_NAME = "20261106200000_add_classifiers";

const PREVIOUS_MIGRATION_NAME = "20261101000000_bot_and_team_change_requests";

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

/**
 * Splits a SQL script into single statements on top-level semicolons, skipping comments and
 * respecting quoted strings, quoted identifiers and dollar-quoted bodies.
 */
export function splitSqlStatements(script: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < script.length) {
    const rest = script.slice(i);
    if (rest.startsWith("--")) {
      const end = script.indexOf("\n", i);
      i = end === -1 ? script.length : end + 1;
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(rest);
    if (dollar) {
      const end = script.indexOf(dollar[0], i + dollar[0].length);
      if (end === -1) throw new Error("unterminated dollar-quoted string");
      current += script.slice(i, end + dollar[0].length);
      i = end + dollar[0].length;
      continue;
    }
    const ch = script[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < script.length && !(script[j] === ch && script[j + 1] !== ch)) j += script[j] === ch ? 2 : 1;
      if (j >= script.length) throw new Error("unterminated quoted string");
      current += script.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
    i++;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function buildPreflightSql(): string {
  const checks: [string, string, string][] = [
    ["postgres 12 or later (enum value added in a transaction)", "1", `(SELECT CASE WHEN current_setting('server_version_num')::int >= 120000 THEN 1 ELSE 0 END)`],
    [`previous migration ${PREVIOUS_MIGRATION_NAME} applied`, "1", `(SELECT count(*) FROM _prisma_migrations WHERE migration_name = ${sqlString(PREVIOUS_MIGRATION_NAME)} AND finished_at IS NOT NULL AND rolled_back_at IS NULL)`],
    ["no failed or pending migrations", "0", `(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)`],
    [`${CLASSIFIER_MIGRATION_NAME} not yet recorded`, "0", `(SELECT count(*) FROM _prisma_migrations WHERE migration_name = ${sqlString(CLASSIFIER_MIGRATION_NAME)})`],
    ["classifier tables not present yet", "0", `(SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('classifier_pairings', 'classifier_chains', 'classifier_chain_steps', 'classifier_sources'))`],
    ["an ADMIN user exists to own the curated catalog", "1", `(SELECT CASE WHEN EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN') THEN 1 ELSE 0 END)`],
  ];
  return checksSql("Read-only checks before 01-migration.sql. Every row should report ok = true.", checks);
}

export function buildRecordMigrationSql(migration: string): string {
  return [
    "-- Records 01-migration.sql as applied, the same row `prisma migrate resolve --applied` writes.",
    "-- Run it in the same transaction as 01-migration.sql, or right after it. Does nothing if already recorded.",
    `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, ${sqlString(sha256(migration))}, now(), ${sqlString(CLASSIFIER_MIGRATION_NAME)}, NULL, NULL, now(), 0
WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = ${sqlString(CLASSIFIER_MIGRATION_NAME)});`,
    "",
  ].join("\n");
}

export function buildSeedSql(author: ClassifierSeedAuthor): string {
  const statements = buildClassifierSeedStatements(author);
  return [
    "-- Curated classifier catalog: insert-only, validated, all-or-nothing.",
    "-- Generated by scripts/generate-classifier-sql.ts from prisma/classifiers/fixtures. Do not edit.",
    "-- Requires the migration " + CLASSIFIER_MIGRATION_NAME + " and the catalog owner user to exist.",
    "-- Safe to re-run: existing rows (curated or user) are never updated or deleted; a re-run inserts nothing.",
    "BEGIN;",
    ...statements.map((s) => `${s};`),
    "COMMIT;",
    "",
  ].join("\n\n");
}

function checksSql(title: string, checks: [string, string, string][]): string {
  return [
    `-- ${title}`,
    "-- Generated by scripts/generate-classifier-sql.ts. Do not edit.",
    `SELECT check_name, expected, actual, expected = actual AS ok FROM (VALUES\n${checks
      .map(([name, expected, actual]) => `  (${sqlString(name)}, ${expected}::bigint, ${actual}::bigint)`)
      .join(",\n")}\n) AS checks(check_name, expected, actual);`,
    "",
  ].join("\n\n");
}

export function buildVerifySql(): string {
  const { counts } = prepareClassifierCatalog();
  const classifierLike = sqlString(`${CURATED_CLASSIFIER_ID_PREFIX}%`);
  const chainLike = sqlString(`${CURATED_CHAIN_ID_PREFIX}%`);
  const sourceIds = SOURCES.map((s) => sqlString(s.id)).join(", ");
  const chainStepCounts = CHAINS.map((c) => `(${sqlString(CURATED_CHAIN_ID_PREFIX + c.slug)}, ${c.steps.length})`).join(", ");

  const checks: [string, string, string][] = [
    ["migration recorded as applied", "1", `(SELECT count(*) FROM _prisma_migrations WHERE migration_name = ${sqlString(CLASSIFIER_MIGRATION_NAME)} AND finished_at IS NOT NULL AND rolled_back_at IS NULL)`],
    ["curated classifiers", String(counts.classifiers), `(SELECT count(*) FROM prompts WHERE id LIKE ${classifierLike} AND type::text = 'CLASSIFIER')`],
    ["curated classifier scenarios", String(counts.scenarios), `(SELECT coalesce(sum(jsonb_array_length("classifierConfig"->'scenarios')), 0) FROM prompts WHERE id LIKE ${classifierLike})`],
    ["curated pairings", String(counts.pairings), `(SELECT count(*) FROM classifier_pairings WHERE "fromId" LIKE ${classifierLike} AND "toId" LIKE ${classifierLike})`],
    ["curated chains", String(counts.chains), `(SELECT count(*) FROM classifier_chains WHERE id LIKE ${chainLike})`],
    ["curated chain steps", String(counts.steps), `(SELECT count(*) FROM classifier_chain_steps WHERE "chainId" LIKE ${chainLike})`],
    ["curated chain paths", String(counts.paths), `(SELECT coalesce(sum(jsonb_array_length(scenarios)), 0) FROM classifier_chains WHERE id LIKE ${chainLike})`],
    ["sources", String(counts.sources), `(SELECT count(*) FROM classifier_sources WHERE id IN (${sourceIds}))`],
    ["curated classifiers with a first version", String(counts.classifiers), `(SELECT count(*) FROM prompt_versions v JOIN prompts p ON p.id = v."promptId" WHERE p.id LIKE ${classifierLike} AND v.version = 1 AND v."classifierSnapshot" IS NOT NULL)`],
    ["chains with every step", String(counts.chains), `(SELECT count(*) FROM (VALUES ${chainStepCounts}) AS e(id, steps) WHERE (SELECT count(*) FROM classifier_chain_steps s WHERE s."chainId" = e.id) = e.steps)`],
    ["classifiers missing slug or config", "0", `(SELECT count(*) FROM prompts WHERE type::text = 'CLASSIFIER' AND ("classifierSlug" IS NULL OR "classifierConfig" IS NULL OR jsonb_typeof("classifierConfig") <> 'object'))`],
    ["non-classifiers with classifier fields", "0", `(SELECT count(*) FROM prompts WHERE type::text <> 'CLASSIFIER' AND ("classifierSlug" IS NOT NULL OR "classifierConfig" IS NOT NULL))`],
    ["chain steps not pointing at a classifier", "0", `(SELECT count(*) FROM classifier_chain_steps s LEFT JOIN prompts p ON p.id = s."classifierId" AND p.type::text = 'CLASSIFIER' WHERE p.id IS NULL)`],
    ["chain steps on private or deleted classifiers", "0", `(SELECT count(*) FROM classifier_chain_steps s JOIN prompts p ON p.id = s."classifierId" WHERE p."isPrivate" OR p."deletedAt" IS NOT NULL)`],
    ["pairings not between classifiers", "0", `(SELECT count(*) FROM classifier_pairings x LEFT JOIN prompts a ON a.id = x."fromId" AND a.type::text = 'CLASSIFIER' LEFT JOIN prompts b ON b.id = x."toId" AND b.type::text = 'CLASSIFIER' WHERE a.id IS NULL OR b.id IS NULL)`],
    ["chain slugs shared with classifiers", "0", `(SELECT count(*) FROM classifier_chains c JOIN prompts p ON p."classifierSlug" = c.slug)`],
    ["curated classifier owners", "1", `(SELECT count(DISTINCT "authorId") FROM prompts WHERE id LIKE ${classifierLike})`],
  ];

  return checksSql("Read-only checks after the migration and seed. Every row should report ok = true.", checks);
}

function buildReadme(checksum: string, counts: ReturnType<typeof prepareClassifierCatalog>["counts"], files: Record<string, string>, username?: string): string {
  const sum = (name: string) => `\`${sha256(files[name])}\``;
  return `# Classifier catalog: migration and seed

Generated by \`npx tsx scripts/generate-classifier-sql.ts --out=<dir>${username ? ` --author=${username}` : ""}\` from
\`prisma/migrations/${CLASSIFIER_MIGRATION_NAME}\` and \`prisma/classifiers/fixtures\`. Regenerating from the same
commit produces the same files byte for byte.

Migration: \`${CLASSIFIER_MIGRATION_NAME}\`, Prisma checksum (sha256 of migration.sql) \`${checksum}\`.
Catalog owner: ${username ? `the user \`${username}\`` : "the oldest ADMIN user (by createdAt, then id)"}.

Expected after the seed: ${counts.classifiers} classifiers with ${counts.scenarios} scenarios, ${counts.pairings} pairings,
${counts.chains} chains with ${counts.steps} steps and ${counts.paths} paths, ${counts.sources} sources.

## Prerequisites

- Every earlier migration is applied, the last being \`${PREVIOUS_MIGRATION_NAME}\`, and none failed.
- The catalog owner user exists. The seed aborts without writing anything if it does not.
- Deploy the app after step 4. The new code needs the new columns. The old code ignores them, and the classifier
  pages show an empty catalog until the seed runs.

## Procedure

1. Run \`00-preflight.sql\`, which is read-only. Every row must report \`ok = true\`.
2. Run \`01-migration.sql\` and \`02-record-migration.sql\` in one transaction, either
   \`psql "$URL" -v ON_ERROR_STOP=1 -1 -f 01-migration.sql -f 02-record-migration.sql\` or the statements of
   \`01-migration.statements.json\` followed by \`02-record-migration.statements.json\` in one transaction.
   The migration is additive: one enum value, nullable columns and four new tables, with no rewrites of existing rows.
   Step 02 writes the same \`_prisma_migrations\` row as
   \`prisma migrate resolve --applied ${CLASSIFIER_MIGRATION_NAME}\`. Alternatively, run that command (or
   \`prisma migrate deploy\`, which runs the migration and records it) instead of steps 01 and 02.
3. Run \`03-seed.sql\` with \`psql "$URL" -v ON_ERROR_STOP=1 -f 03-seed.sql\` (it contains BEGIN and COMMIT), or the
   statements of \`03-seed.statements.json\` in one transaction. The seed is insert-only and all-or-nothing:
   - it aborts if the owner is missing or a curated slug or id is held by other content;
   - it never updates or deletes rows;
   - a re-run inserts nothing.
4. Run \`04-verify.sql\`, which is read-only. Every row must report \`ok = true\`. \`prisma migrate status\` reports
   the schema up to date.

## Rollback

Before user classifiers exist:

\`\`\`sql
BEGIN;
DROP TABLE classifier_chain_steps, classifier_chains, classifier_pairings, classifier_sources;
DELETE FROM prompts WHERE type = 'CLASSIFIER';  -- cascades to versions, change requests, votes, comments
ALTER TABLE prompts DROP COLUMN "classifierSlug", DROP COLUMN "classifierConfig";
ALTER TABLE prompt_versions DROP COLUMN "classifierSnapshot";
ALTER TABLE change_requests DROP COLUMN "originalClassifier", DROP COLUMN "proposedClassifier";
DELETE FROM _prisma_migrations WHERE migration_name = '${CLASSIFIER_MIGRATION_NAME}';
COMMIT;
\`\`\`

The \`CLASSIFIER\` enum value stays, because Postgres cannot drop enum values. It is unused once those rows are gone.

## Known drift, not from this migration

\`prisma migrate diff\` against the datamodel reports two indexes that \`main\` already declares without a migration:
\`prompts_slug_idx\` and \`prompts_isPrivate_isUnlisted_deletedAt_createdAt_idx\`. This migration does not touch them.

## Checksums (sha256)

${Object.keys(files).map((name) => `- \`${name}\` ${sum(name)}`).join("\n")}
`;
}

function main() {
  const out = arg("out");
  if (!out) throw new Error("Usage: npx tsx scripts/generate-classifier-sql.ts --out=<dir> [--author=<username>]");
  const username = arg("author");
  const author: ClassifierSeedAuthor = username ? { username } : { firstAdmin: true };
  const dir = resolve(out);
  mkdirSync(dir, { recursive: true });

  const migration = readFileSync(resolve(__dirname, "../prisma/migrations", CLASSIFIER_MIGRATION_NAME, "migration.sql"), "utf8");
  const recordMigration = buildRecordMigrationSql(migration);
  const files: Record<string, string> = {
    "00-preflight.sql": buildPreflightSql(),
    "01-migration.sql": migration,
    "02-record-migration.sql": recordMigration,
    "03-seed.sql": buildSeedSql(author),
    "04-verify.sql": buildVerifySql(),
    "01-migration.statements.json": JSON.stringify(splitSqlStatements(migration), null, 2) + "\n",
    "02-record-migration.statements.json": JSON.stringify(splitSqlStatements(recordMigration), null, 2) + "\n",
    "03-seed.statements.json": JSON.stringify(buildClassifierSeedStatements(author), null, 2) + "\n",
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  writeFileSync(join(dir, "SHA256SUMS"), Object.entries(files).map(([name, text]) => `${sha256(text)}  ${name}`).join("\n") + "\n");

  const { counts } = prepareClassifierCatalog();
  const manifest = {
    migration: { name: CLASSIFIER_MIGRATION_NAME, checksum: sha256(migration) },
    owner: username ? { username } : "oldest ADMIN user",
    counts,
    seed: { statements: buildClassifierSeedStatements(author).length, batchSize: CLASSIFIER_SEED_BATCH_SIZE },
    files: Object.fromEntries(Object.entries(files).map(([name, text]) => [name, { sha256: sha256(text), bytes: Buffer.byteLength(text) }])),
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(dir, "README.md"), buildReadme(manifest.migration.checksum, counts, files, username));
  console.log(JSON.stringify(manifest, null, 2));
}

if (require.main === module) main();
