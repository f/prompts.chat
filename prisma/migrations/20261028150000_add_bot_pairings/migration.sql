-- CreateTable
CREATE TABLE "bot_pairings" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_pairings_pkey" PRIMARY KEY ("fromId","toId"),
    -- Each pair is stored once in a fixed order: no self-links, no reversed duplicates.
    -- COLLATE "C" compares bytes, matching the JavaScript string order the app uses.
    CONSTRAINT "bot_pairings_ordered_check" CHECK ("fromId" COLLATE "C" < "toId" COLLATE "C")
);

-- CreateIndex
CREATE INDEX "bot_pairings_toId_idx" ON "bot_pairings"("toId");

-- AddForeignKey
ALTER TABLE "bot_pairings" ADD CONSTRAINT "bot_pairings_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_pairings" ADD CONSTRAINT "bot_pairings_toId_fkey" FOREIGN KEY ("toId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
