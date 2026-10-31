-- CreateTable
CREATE TABLE "bot_team_votes" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_team_votes_pkey" PRIMARY KEY ("userId","teamId")
);

-- CreateIndex
CREATE INDEX "bot_team_votes_teamId_idx" ON "bot_team_votes"("teamId");

-- AddForeignKey
ALTER TABLE "bot_team_votes" ADD CONSTRAINT "bot_team_votes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bot_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_votes" ADD CONSTRAINT "bot_team_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

