-- Backs checkRapidEngagement()'s dedup check (src/lib/engagement.ts) with an
-- atomic conditional UPDATE instead of a findFirst-then-create Notification
-- check, closing the race where two concurrent inbound messages for the
-- same lead within the 15-minute window could both create a duplicate
-- "lead is actively replying" notification. One additive column; nothing
-- existing changes shape.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "lastRapidEngagementNotifiedAt" TIMESTAMP(3);
