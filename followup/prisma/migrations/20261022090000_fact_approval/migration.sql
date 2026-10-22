-- A-308: what FollowUp learns from a reply waits for the owner's OK before replies use it.
ALTER TABLE "BusinessFact" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "BusinessFact" ADD COLUMN IF NOT EXISTS "proposedValue" TEXT;
-- Everything already in use stays in use: the owner's words, and what was learned before this change.
UPDATE "BusinessFact" SET "approvedAt" = "updatedAt" WHERE "approvedAt" IS NULL;
