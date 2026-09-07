-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "trigger" TEXT;
CREATE INDEX IF NOT EXISTS "FollowUp_trigger_sentAt_idx" ON "FollowUp"("trigger", "sentAt");
