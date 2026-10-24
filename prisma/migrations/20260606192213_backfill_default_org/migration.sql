-- Step 1b: Backfill default organization for existing rows.
-- DATA-ONLY migration. No schema changes, no constraints altered.
-- Idempotent: safe to run more than once (ON CONFLICT on slug; UPDATEs scoped to NULLs).
-- The NOT NULL flip on organizationId is intentionally DEFERRED to a later migration
-- (Step 1c), after application write-paths set organizationId. See HANDOFF-STEP1B.md.

-- 1. Create the single default internal organization.
--    id is supplied explicitly because cuid() is a Prisma application-level default,
--    not a database default; raw SQL must provide it. updatedAt likewise has no DB
--    default (@updatedAt is app-level), so it is set explicitly.
INSERT INTO "organizations" ("id", "name", "slug", "tier", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Vyaxis (Internal)', 'internal', 'internal', now(), now())
ON CONFLICT ("slug") DO NOTHING;

-- 2. Assign all existing org-less users to the internal org.
UPDATE "users"
SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'internal')
WHERE "organizationId" IS NULL;

-- 3. Assign all existing org-less prompts to the internal org.
UPDATE "prompts"
SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'internal')
WHERE "organizationId" IS NULL;
