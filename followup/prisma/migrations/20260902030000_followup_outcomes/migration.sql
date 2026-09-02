-- Outcome tracking: did a sent follow-up actually get a reply. Nullable,
-- additive column plus its own index — safe to run any time, no data loss.

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN "repliedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "FollowUp_status_repliedAt_idx" ON "FollowUp"("status", "repliedAt");
