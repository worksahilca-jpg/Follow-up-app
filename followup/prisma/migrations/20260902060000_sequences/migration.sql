-- Workflow builder: multi-step automated sequences a business can build
-- and enroll leads into. Two new tables, one new enum, and additive
-- enrollment columns on Lead — nothing existing changes shape.

-- CreateEnum
CREATE TYPE "SequenceAction" AS ENUM ('EMAIL', 'CHANGE_STAGE');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "sequenceId" TEXT,
ADD COLUMN "sequenceStepIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sequenceStepDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "action" "SequenceAction" NOT NULL,
    "stageTo" "PipelineStage",
    "messageHint" TEXT,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sequence_businessId_idx" ON "Sequence"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceStep_sequenceId_order_key" ON "SequenceStep"("sequenceId", "order");

-- CreateIndex: the workflow cron's "which enrolled leads are due right now" scan.
CREATE INDEX "Lead_businessId_sequenceStepDueAt_idx" ON "Lead"("businessId", "sequenceStepDueAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
