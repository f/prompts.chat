-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AdaptationMode" AS ENUM ('CONFIG', 'LLM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "prompts" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_records" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "input" TEXT NOT NULL,
    "finalOutput" TEXT,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "execution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_traces" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL,
    "promptId" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "rawInput" TEXT NOT NULL,
    "adaptedInput" TEXT NOT NULL,
    "output" TEXT,
    "adaptationMode" "AdaptationMode" NOT NULL DEFAULT 'CONFIG',
    "rulesApplied" TEXT[],
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "score" DOUBLE PRECISION,
    "thresholdMet" BOOLEAN,
    "fallbackApplied" BOOLEAN NOT NULL DEFAULT false,
    "fallbackPromptId" TEXT,
    "error" TEXT,

    CONSTRAINT "stage_traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "execution_records_organizationId_idx" ON "execution_records"("organizationId");

-- CreateIndex
CREATE INDEX "execution_records_compositionId_idx" ON "execution_records"("compositionId");

-- CreateIndex
CREATE INDEX "stage_traces_executionId_idx" ON "stage_traces"("executionId");

-- CreateIndex
CREATE INDEX "stage_traces_promptId_idx" ON "stage_traces"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "stage_traces_executionId_stageOrder_key" ON "stage_traces"("executionId", "stageOrder");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "prompts_organizationId_idx" ON "prompts"("organizationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_traces" ADD CONSTRAINT "stage_traces_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "execution_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

