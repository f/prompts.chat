-- AlterTable
ALTER TABLE "bot_teams" ADD COLUMN "isUnlisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unlistedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bot_teams_isUnlisted_createdAt_idx" ON "bot_teams"("isUnlisted", "createdAt" DESC);
