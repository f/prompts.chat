-- Classifiers as a prompt type, plus curated chains, pairings and sources. Additive only: one enum
-- value, nullable columns on existing tables and four new tables. Content is imported separately.

-- AlterEnum
ALTER TYPE "PromptType" ADD VALUE IF NOT EXISTS 'CLASSIFIER';

-- AlterTable: classifier fields of a CLASSIFIER prompt when a change request was made and as proposed
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "originalClassifier" JSONB;
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "proposedClassifier" JSONB;

-- AlterTable: title, summary and classifier config of a CLASSIFIER prompt at each version
ALTER TABLE "prompt_versions" ADD COLUMN IF NOT EXISTS "classifierSnapshot" JSONB;

-- AlterTable: stable URL slug and structured config of CLASSIFIER prompts; null for other types
ALTER TABLE "prompts" ADD COLUMN IF NOT EXISTS "classifierConfig" JSONB;
ALTER TABLE "prompts" ADD COLUMN IF NOT EXISTS "classifierSlug" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "classifier_pairings" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classifier_pairings_pkey" PRIMARY KEY ("fromId","toId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "classifier_chains" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "entry" TEXT NOT NULL,
    "terminals" JSONB NOT NULL,
    "scenarios" JSONB NOT NULL,
    "notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classifier_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "classifier_chain_steps" (
    "chainId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "classifierId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "receives" JSONB NOT NULL,
    "branches" JSONB NOT NULL,

    CONSTRAINT "classifier_chain_steps_pkey" PRIMARY KEY ("chainId","stepId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "classifier_sources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classifier_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classifier_pairings_toId_idx" ON "classifier_pairings"("toId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "classifier_chains_slug_key" ON "classifier_chains"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classifier_chains_category_idx" ON "classifier_chains"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classifier_chain_steps_classifierId_idx" ON "classifier_chain_steps"("classifierId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "prompts_classifierSlug_key" ON "prompts"("classifierSlug");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classifier_pairings_fromId_fkey') THEN
    ALTER TABLE "classifier_pairings" ADD CONSTRAINT "classifier_pairings_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classifier_pairings_toId_fkey') THEN
    ALTER TABLE "classifier_pairings" ADD CONSTRAINT "classifier_pairings_toId_fkey" FOREIGN KEY ("toId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classifier_chain_steps_chainId_fkey') THEN
    ALTER TABLE "classifier_chain_steps" ADD CONSTRAINT "classifier_chain_steps_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "classifier_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: a classifier used by a curated chain cannot be hard-deleted while the chain exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classifier_chain_steps_classifierId_fkey') THEN
    ALTER TABLE "classifier_chain_steps" ADD CONSTRAINT "classifier_chain_steps_classifierId_fkey" FOREIGN KEY ("classifierId") REFERENCES "prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
