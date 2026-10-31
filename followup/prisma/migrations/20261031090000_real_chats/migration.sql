-- Night plan A2 (2026-10-31): real conversations a business owner agreed to share, cleaned of names, emails, phone
-- numbers and links, kept as test cases (src/lib/realChats.ts). Additive only: one new table, linked to nothing.
CREATE TABLE IF NOT EXISTS "RealChatCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "next" JSONB NOT NULL,
    "asks" TEXT[],
    "told" TEXT[],
    "expect" TEXT,
    "closing" BOOLEAN NOT NULL DEFAULT false,
    "consent" TEXT NOT NULL,

    CONSTRAINT "RealChatCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RealChatCase_createdAt_idx" ON "RealChatCase"("createdAt");

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "RealChatCase" ENABLE ROW LEVEL SECURITY;
