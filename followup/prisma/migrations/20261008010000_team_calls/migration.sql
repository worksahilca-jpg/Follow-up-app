-- The realtor team pilot (A-103, founder 2026-10-07): "Your team calls
-- customers", the call to make next, and each call someone tapped for.
-- Additive only.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "teamCalls" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nextCallAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CallAttempt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CallAttempt_businessId_createdAt_idx" ON "CallAttempt"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "CallAttempt_leadId_createdAt_idx" ON "CallAttempt"("leadId", "createdAt");

ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every table is closed to the public API roles (same as every table since RLS was turned on).
ALTER TABLE "CallAttempt" ENABLE ROW LEVEL SECURITY;
