-- Per-source lead routing: what happens automatically the moment a NEW
-- lead is created from a given source (e.g. "Gmail", "SMS", "Webhook").
-- One new table; nothing existing changes shape.

-- CreateTable
CREATE TABLE "SourceRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sequenceId" TEXT,
    "automationTierDefault" "AutomationTier",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceRule_businessId_source_key" ON "SourceRule"("businessId", "source");

-- AddForeignKey
ALTER TABLE "SourceRule" ADD CONSTRAINT "SourceRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRule" ADD CONSTRAINT "SourceRule_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
