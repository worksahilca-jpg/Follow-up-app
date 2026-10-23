-- Step 2 of the self-improving plan (2026-10-23): each draft remembers the AI answer that wrote it, and each send
-- records which answer it came from and how much a person changed it (a number, never the words). Additive only.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "suggestedResponseId" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "responseId" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "editSize" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "FollowUp_responseId_idx" ON "FollowUp"("responseId");
