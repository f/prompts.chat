-- CreateEnum
CREATE TYPE "BotComputerRequirement" AS ENUM ('NONE', 'CLOUD', 'LOCAL');

-- AlterTable
ALTER TABLE "prompts" ADD COLUMN "computerRequirement" "BotComputerRequirement" NOT NULL DEFAULT 'NONE';
