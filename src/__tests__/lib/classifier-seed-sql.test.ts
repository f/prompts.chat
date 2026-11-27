import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildClassifierSeedStatements, prepareClassifierCatalog, sqlString } from "../../../prisma/classifiers/seed-sql";
import { CLASSIFIER_MIGRATION_NAME, buildRecordMigrationSql, buildSeedSql, splitSqlStatements } from "../../../scripts/generate-classifier-sql";

describe("classifier seed SQL", () => {
  const statements = buildClassifierSeedStatements({ firstAdmin: true });

  it("counts the curated catalog", () => {
    expect(prepareClassifierCatalog().counts).toEqual({
      classifiers: 59,
      scenarios: 252,
      pairings: 172,
      chains: 16,
      steps: 61,
      paths: 109,
      sources: 16,
    });
  });

  it("only inserts, and never over existing rows", () => {
    for (const statement of statements) {
      expect(statement.replace(/ON COMMIT DROP/g, "")).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/);
      if (/INSERT INTO (prompts|classifier_|prompt_versions)/.test(statement)) expect(statement).toMatch(/ON CONFLICT DO NOTHING/);
    }
  });

  it("escapes quotes in string literals", () => {
    expect(sqlString("it's")).toBe("'it''s'");
    expect(() => sqlString("a\u0000b")).toThrow();
  });

  it("is deterministic and splits back into the same statements", () => {
    expect(buildSeedSql({ firstAdmin: true })).toBe(buildSeedSql({ firstAdmin: true }));
    const script = buildSeedSql({ firstAdmin: true });
    expect(splitSqlStatements(script)).toEqual(["BEGIN", ...statements, "COMMIT"]);
  });

  it("splits the migration into single statements and records it with Prisma's checksum", () => {
    const migration = readFileSync(resolve(__dirname, "../../../prisma/migrations", CLASSIFIER_MIGRATION_NAME, "migration.sql"), "utf8");
    const parts = splitSqlStatements(migration);
    expect(parts).toHaveLength(19);
    expect(parts.filter((p) => p.startsWith("DO $$"))).toHaveLength(4);
    expect(buildRecordMigrationSql(migration)).toContain(CLASSIFIER_MIGRATION_NAME);
  });
});
