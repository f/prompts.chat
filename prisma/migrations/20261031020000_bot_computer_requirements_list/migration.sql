-- A bot can need a cloud computer, the user's own computer, or both: replace the single
-- "computerRequirement" with a "computerRequirements" list. An empty list means the bot needs no
-- computer, so the NONE enum value is no longer used. It stays in the enum because Postgres cannot
-- drop an enum value without recreating the type.

-- AlterTable
ALTER TABLE "prompts" ADD COLUMN "computerRequirements" "BotComputerRequirement"[] NOT NULL DEFAULT '{}';

-- Backfill: NONE becomes the empty list
UPDATE "prompts"
SET "computerRequirements" = ARRAY["computerRequirement"]
WHERE "computerRequirement" <> 'NONE';

-- AlterTable
ALTER TABLE "prompts" DROP COLUMN "computerRequirement";
