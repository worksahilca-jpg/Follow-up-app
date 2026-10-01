-- A caller who hid their number becomes their own customer, found again by
-- Twilio's id for that call (founder, 2026-09-30). One nullable column and
-- its unique index: no backfill, existing rows are all NULL.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "hiddenCallSid" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_hiddenCallSid_key" ON "Lead"("hiddenCallSid");
