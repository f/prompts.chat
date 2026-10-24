-- AlterTable
ALTER TABLE "execution_records" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "compositions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "promptId" TEXT NOT NULL,
    "fallbackPromptId" TEXT,
    "successThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "extractFields" TEXT[],
    "transformRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compositions_organizationId_idx" ON "compositions"("organizationId");

-- CreateIndex
CREATE INDEX "stages_compositionId_idx" ON "stages"("compositionId");

-- CreateIndex
CREATE UNIQUE INDEX "stages_compositionId_order_key" ON "stages"("compositionId", "order");

-- AddForeignKey
ALTER TABLE "compositions" ADD CONSTRAINT "compositions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
