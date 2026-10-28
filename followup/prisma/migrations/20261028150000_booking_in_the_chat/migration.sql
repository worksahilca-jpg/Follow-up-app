-- Booking in the chat (A-242, 2026-10-28): the two times FollowUp offered a customer, and the one they picked while
-- it waits for the owner's Confirm; and when the owner last opened a customer (the Customers row reads bold only until
-- then). Additive only: four nullable columns on an existing table.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "offeredTimes" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "pickedTime" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "pickedTimeAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
