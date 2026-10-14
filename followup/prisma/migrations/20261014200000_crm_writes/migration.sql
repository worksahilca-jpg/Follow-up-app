-- The record of every write FollowUp makes in the owner's CRM (A-252), and "Pause writing there".
-- Additive only: a new table, and one empty column on CrmConnection (null = writing is on, as today).
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "writesPausedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CrmWrite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextTryAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmWrite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmWrite_businessId_createdAt_idx" ON "CrmWrite"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmWrite_status_nextTryAt_idx" ON "CrmWrite"("status", "nextTryAt");

DO $$ BEGIN
    ALTER TABLE "CrmWrite" ADD CONSTRAINT "CrmWrite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "CrmWrite" ADD CONSTRAINT "CrmWrite_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "CrmWrite" ENABLE ROW LEVEL SECURITY;
