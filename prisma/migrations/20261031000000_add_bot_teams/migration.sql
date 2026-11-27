-- CreateTable
CREATE TABLE "bot_teams" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(4000),
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "role" VARCHAR(80),
    "description" VARCHAR(500),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bot_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_team_links" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromBotId" TEXT NOT NULL,
    "toBotId" TEXT NOT NULL,
    "label" VARCHAR(200) NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_team_links_pkey" PRIMARY KEY ("id"),
    -- A bot never hands off to itself
    CONSTRAINT "bot_team_links_no_self_check" CHECK ("fromBotId" <> "toBotId")
);

-- CreateTable
CREATE TABLE "bot_team_tags" (
    "teamId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "bot_team_tags_pkey" PRIMARY KEY ("teamId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_teams_slug_key" ON "bot_teams"("slug");

-- CreateIndex
CREATE INDEX "bot_teams_authorId_idx" ON "bot_teams"("authorId");

-- CreateIndex
CREATE INDEX "bot_teams_categoryId_idx" ON "bot_teams"("categoryId");

-- CreateIndex
CREATE INDEX "bot_teams_isFeatured_createdAt_idx" ON "bot_teams"("isFeatured", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "bot_team_tags_tagId_idx" ON "bot_team_tags"("tagId");

-- CreateIndex
CREATE INDEX "bot_team_members_botId_idx" ON "bot_team_members"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_team_members_teamId_botId_key" ON "bot_team_members"("teamId", "botId");

-- CreateIndex
CREATE INDEX "bot_team_links_teamId_toBotId_idx" ON "bot_team_links"("teamId", "toBotId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_team_links_teamId_fromBotId_toBotId_key" ON "bot_team_links"("teamId", "fromBotId", "toBotId");

-- AddForeignKey
ALTER TABLE "bot_teams" ADD CONSTRAINT "bot_teams_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_teams" ADD CONSTRAINT "bot_teams_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_tags" ADD CONSTRAINT "bot_team_tags_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bot_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_tags" ADD CONSTRAINT "bot_team_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_members" ADD CONSTRAINT "bot_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bot_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_members" ADD CONSTRAINT "bot_team_members_botId_fkey" FOREIGN KEY ("botId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_links" ADD CONSTRAINT "bot_team_links_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "bot_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_links" ADD CONSTRAINT "bot_team_links_teamId_fromBotId_fkey" FOREIGN KEY ("teamId", "fromBotId") REFERENCES "bot_team_members"("teamId", "botId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_team_links" ADD CONSTRAINT "bot_team_links_teamId_toBotId_fkey" FOREIGN KEY ("teamId", "toBotId") REFERENCES "bot_team_members"("teamId", "botId") ON DELETE CASCADE ON UPDATE CASCADE;
