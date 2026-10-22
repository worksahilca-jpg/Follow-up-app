-- Milestone 1 of the founder's assistant brief (2026-10-22): what FollowUp is taught keeps a status, a version and a
-- history, and can be rolled back. Additive only: new columns with defaults, one new table.

-- The founder's rules and examples for a kind of business. Everything already in use stays in use ("ACTIVE"),
-- approved by whoever added it, when they added it: the founder's save was the approval.
ALTER TABLE "TrainingRule" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "TrainingRule" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TrainingRule" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "TrainingRule" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "TrainingRule" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
UPDATE "TrainingRule" SET "approvedById" = "addedById", "approvedAt" = "createdAt" WHERE "approvedAt" IS NULL;

ALTER TABLE "TrainingExample" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "TrainingExample" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "TrainingExample" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "TrainingExample" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
UPDATE "TrainingExample" e SET "approvedById" = c."addedById", "approvedAt" = e."createdAt"
  FROM "TrainingConversation" c WHERE c."id" = e."conversationId" AND e."approvedAt" IS NULL;

-- Where a training conversation came from, and the stored permission for a pasted one. Left null for rows from
-- before this change: which of them were pasted can't be told for sure, and nothing is claimed that isn't known.
ALTER TABLE "TrainingConversation" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "TrainingConversation" ADD COLUMN IF NOT EXISTS "consentConfirmedAt" TIMESTAMP(3);
ALTER TABLE "TrainingConversation" ADD COLUMN IF NOT EXISTS "consentById" TEXT;

-- The one history of everything FollowUp learns (src/lib/learning.ts).
CREATE TABLE IF NOT EXISTS "LearningEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "trade" TEXT,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "version" INTEGER,
    "before" JSONB,
    "after" JSONB,
    "byUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LearningEvent_kind_targetId_createdAt_idx" ON "LearningEvent"("kind", "targetId", "createdAt");
CREATE INDEX IF NOT EXISTS "LearningEvent_businessId_createdAt_idx" ON "LearningEvent"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "LearningEvent_trade_createdAt_idx" ON "LearningEvent"("trade", "createdAt");

DO $$ BEGIN
  ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "LearningEvent" ENABLE ROW LEVEL SECURITY;
