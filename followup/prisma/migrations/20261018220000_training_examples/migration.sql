-- "Train FollowUp" (A-292): scrubbed conversations from businesses of every kind, and the examples taken from them. Additive only: two new tables.
CREATE TABLE IF NOT EXISTS "TrainingConversation" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "addedById" TEXT,
    "turnCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingConversation_createdAt_idx" ON "TrainingConversation"("createdAt");

CREATE TABLE IF NOT EXISTS "TrainingExample" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "customerSaid" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "followUpReply" TEXT,
    "verdict" TEXT,
    "scoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingExample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingExample_trade_createdAt_idx" ON "TrainingExample"("trade", "createdAt");
CREATE INDEX IF NOT EXISTS "TrainingExample_verdict_idx" ON "TrainingExample"("verdict");

DO $$ BEGIN
    ALTER TABLE "TrainingExample" ADD CONSTRAINT "TrainingExample_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TrainingConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "TrainingConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingExample" ENABLE ROW LEVEL SECURITY;
