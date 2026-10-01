-- "Don't send" is remembered on the lead (founder, 2026-09-30): nothing
-- automatic follows until a message from either side is newer than it.
-- One nullable column: no backfill, no rewrite of existing rows.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "holdDismissedAt" TIMESTAMP(3);
