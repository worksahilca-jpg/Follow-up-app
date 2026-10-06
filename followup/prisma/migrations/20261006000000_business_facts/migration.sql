-- What FollowUp knows about a business (A-096, founder 2026-10-06): facts
-- learned from every reply sent through FollowUp, or typed in Settings.
-- Additive only: a new table and two nullable columns on FollowUp.
CREATE TABLE IF NOT EXISTS "BusinessFact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessFact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BusinessFact_businessId_idx" ON "BusinessFact"("businessId");

-- Locked to the app's own server connection like every other table: no
-- policies, so Supabase's public API roles can read or write nothing here.
ALTER TABLE "BusinessFact" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  ALTER TABLE "BusinessFact" ADD CONSTRAINT "BusinessFact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Replies from the last 60 days are read back once, so FollowUp starts out
-- knowing what the owner has already told customers. Older ones are marked
-- read, which keeps the first run a bounded job.
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "factsCheckedAt" TIMESTAMP(3);
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "ownerFilled" TEXT;
UPDATE "FollowUp" SET "factsCheckedAt" = CURRENT_TIMESTAMP WHERE "factsCheckedAt" IS NULL AND ("sentAt" IS NULL OR "sentAt" < CURRENT_TIMESTAMP - INTERVAL '60 days');

-- The learning job's sweep: sent replies not read yet.
CREATE INDEX IF NOT EXISTS "FollowUp_status_factsCheckedAt_idx" ON "FollowUp"("status", "factsCheckedAt");
