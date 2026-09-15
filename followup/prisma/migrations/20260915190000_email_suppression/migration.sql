-- An address that asked a business to stop sending it automated mail.
--
-- Keyed on the ADDRESS rather than a Lead row, because that is what the
-- person actually opted out. A lead can be deleted and re-imported from the
-- same mailbox tomorrow, arrive again through another channel, or exist
-- twice before a merge — a column on Lead would forget in every one of those
-- cases and quietly start mailing them again.
--
-- Deliberately separate from Lead."optedOutAt", which is the SMS/WhatsApp
-- STOP mechanism: different law, different channel, different lifecycle.

CREATE TABLE IF NOT EXISTS "Suppression" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  -- "email" today; a string rather than an enum so adding a DM opt-out
  -- later needs no type migration.
  "channel" TEXT NOT NULL,
  -- Normalised: trimmed and lowercased by normaliseAddress().
  "address" TEXT NOT NULL,
  -- unsubscribe_link | one_click | manual | complaint
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

-- The send path's only question — "is this exact address suppressed" —
-- asked before every automated email, so it is the unique index itself.
CREATE UNIQUE INDEX IF NOT EXISTS "Suppression_businessId_channel_address_key"
  ON "Suppression"("businessId", "channel", "address");

CREATE INDEX IF NOT EXISTS "Suppression_businessId_channel_idx"
  ON "Suppression"("businessId", "channel");

ALTER TABLE "Suppression" DROP CONSTRAINT IF EXISTS "Suppression_businessId_fkey";
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
