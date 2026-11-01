-- Change requests and version history for bots and bot teams. Additive only: two nullable
-- columns on existing tables, two new tables, and a backfill of version 1 for existing teams.

-- AlterTable: bot fields (description, platforms, icon, color, computers, install URL, config)
-- of a BOT prompt when a change request was made and as proposed; null for other prompt types
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "originalBot" JSONB;
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "proposedBot" JSONB;

-- AlterTable: title and bot fields of a BOT prompt at each version; null on older versions
ALTER TABLE "prompt_versions" ADD COLUMN IF NOT EXISTS "botSnapshot" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "bot_team_versions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "bot_team_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bot_team_change_requests" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewNote" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "originalSnapshot" JSONB NOT NULL,
    "proposedSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_team_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bot_team_versions_teamId_version_key" ON "bot_team_versions"("teamId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bot_team_change_requests_teamId_status_idx" ON "bot_team_change_requests"("teamId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bot_team_change_requests_authorId_idx" ON "bot_team_change_requests"("authorId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_team_versions_teamId_fkey') THEN
    ALTER TABLE "bot_team_versions" ADD CONSTRAINT "bot_team_versions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bot_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_team_versions_createdById_fkey') THEN
    ALTER TABLE "bot_team_versions" ADD CONSTRAINT "bot_team_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_team_change_requests_teamId_fkey') THEN
    ALTER TABLE "bot_team_change_requests" ADD CONSTRAINT "bot_team_change_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bot_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_team_change_requests_authorId_fkey') THEN
    ALTER TABLE "bot_team_change_requests" ADD CONSTRAINT "bot_team_change_requests_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_team_change_requests_reviewerId_fkey') THEN
    ALTER TABLE "bot_team_change_requests" ADD CONSTRAINT "bot_team_change_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: version 1 of every existing team, a snapshot of the team as it is now, credited to its
-- author and dated at its last update. Same shape as teamSnapshot() in src/lib/bots/team-snapshot.ts.
-- Safe to re-run: teams that already have a version 1 are skipped.
INSERT INTO "bot_team_versions" ("id", "teamId", "version", "snapshot", "changeNote", "createdAt", "createdById")
SELECT
    'btv' || substr(md5(t."id" || ':v1'), 1, 22),
    t."id",
    1,
    jsonb_build_object(
        'title', t."title",
        'description', t."description",
        'category', (
            SELECT jsonb_build_object('id', c."id", 'name', c."name")
            FROM "categories" c
            WHERE c."id" = t."categoryId"
        ),
        'tags', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', g."id", 'name', g."name") ORDER BY g."name")
            FROM "bot_team_tags" bt
            JOIN "tags" g ON g."id" = bt."tagId"
            WHERE bt."teamId" = t."id"
        ), '[]'::jsonb),
        'members', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('botId', m."botId", 'title', p."title", 'role', m."role", 'description', m."description")
                ORDER BY m."order", m."id"
            )
            FROM "bot_team_members" m
            JOIN "prompts" p ON p."id" = m."botId"
            WHERE m."teamId" = t."id"
        ), '[]'::jsonb),
        'links', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('fromBotId', l."fromBotId", 'toBotId', l."toBotId", 'label', l."label")
                ORDER BY l."order", l."createdAt"
            )
            FROM "bot_team_links" l
            WHERE l."teamId" = t."id"
        ), '[]'::jsonb)
    ),
    'Initial version',
    t."updatedAt",
    t."authorId"
FROM "bot_teams" t
ON CONFLICT ("teamId", "version") DO NOTHING;
