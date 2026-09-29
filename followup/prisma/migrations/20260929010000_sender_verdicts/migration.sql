-- "Learn from corrections" (founder, 2026-09-29): the owner's own call on a
-- sender ("this was a customer" / "Not a customer"), remembered for this
-- business only (src/lib/senderVerdicts.ts). Sender and subject line only,
-- never a message body. Never shared with another business and never used
-- to train a model.
--
-- One new table: no backfill, no lock on existing tables.

CREATE TABLE IF NOT EXISTS "SenderVerdict" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "verdict" TEXT NOT NULL,
  "subject" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SenderVerdict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SenderVerdict_businessId_sender_key"
  ON "SenderVerdict"("businessId", "sender");
CREATE INDEX IF NOT EXISTS "SenderVerdict_businessId_updatedAt_idx"
  ON "SenderVerdict"("businessId", "updatedAt");

ALTER TABLE "SenderVerdict" ADD CONSTRAINT "SenderVerdict_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Closed to Supabase's public Data API like every other table
-- (20260927000000_enable_rls_all_public_tables); the app's own roles bypass it.
ALTER TABLE "SenderVerdict" ENABLE ROW LEVEL SECURITY;
