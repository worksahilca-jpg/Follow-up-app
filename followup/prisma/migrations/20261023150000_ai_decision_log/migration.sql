-- The decision log (2026-10-23): one row per AI call (src/lib/aiDecisionLog.ts), so a change to FollowUp's prompts,
-- lessons or model can be measured and undone. Additive only: one new table. Ids, models, counts and fingerprints;
-- never the words of a prompt or an answer.
CREATE TABLE IF NOT EXISTS "AiDecision" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" TEXT NOT NULL,
    "businessId" TEXT,
    "leadId" TEXT,
    "modelRequested" TEXT NOT NULL,
    "modelUsed" TEXT,
    "fellBack" BOOLEAN NOT NULL DEFAULT false,
    "ok" BOOLEAN NOT NULL,
    "errorStatus" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costMicros" INTEGER,
    "promptHash" TEXT NOT NULL,
    "lessonsHash" TEXT,
    "rules" INTEGER,
    "examples" INTEGER,
    "responseId" TEXT,
    "choice" TEXT,

    CONSTRAINT "AiDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiDecision_createdAt_idx" ON "AiDecision"("createdAt");
CREATE INDEX IF NOT EXISTS "AiDecision_businessId_createdAt_idx" ON "AiDecision"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiDecision_purpose_createdAt_idx" ON "AiDecision"("purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "AiDecision_responseId_idx" ON "AiDecision"("responseId");

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "AiDecision" ENABLE ROW LEVEL SECURITY;
