-- Sequence completion tracking for the Analytics "sequence health" metric
-- (src/lib/analytics-data.ts). Set only in runSequencesForBusiness()'s
-- "finished the last step" branch (src/lib/sequences.ts) — never on early
-- unenroll (manual, sequence deleted, or the stop-on-reply pause), which is
-- why those exits have no persisted signal to distinguish them by. One
-- additive column; nothing existing changes shape.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "sequenceCompletedAt" TIMESTAMP(3);

-- CreateIndex: getAnalytics()'s "completed in the last 30 days" scan.
CREATE INDEX "Lead_businessId_sequenceCompletedAt_idx" ON "Lead"("businessId", "sequenceCompletedAt");
