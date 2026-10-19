-- "Claude on the Train page" (A-298): the founder's talk with Claude, kept so it remembers. Additive only: one new table.
CREATE TABLE IF NOT EXISTS "TrainerMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "cards" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainerMessage_createdAt_idx" ON "TrainerMessage"("createdAt");

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "TrainerMessage" ENABLE ROW LEVEL SECURITY;
