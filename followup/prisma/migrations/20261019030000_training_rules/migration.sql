-- "Tell FollowUp what's wrong" (A-297): the founder's rules for one kind of business, from his own words. Additive only: one new table.
CREATE TABLE IF NOT EXISTS "TrainingRule" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingRule_trade_createdAt_idx" ON "TrainingRule"("trade", "createdAt");

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "TrainingRule" ENABLE ROW LEVEL SECURITY;
