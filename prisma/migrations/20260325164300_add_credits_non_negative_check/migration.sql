-- AlterTable: Add CHECK constraint to prevent negative generation credits
ALTER TABLE "users" ADD CONSTRAINT "credits_non_negative" CHECK ("generationCreditsRemaining" >= 0);
