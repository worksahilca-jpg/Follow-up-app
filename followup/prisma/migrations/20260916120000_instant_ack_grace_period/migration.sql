-- The DM grace period: let a present owner answer first.
--
-- On Instagram, Messenger and WhatsApp the instant acknowledgement
-- (src/lib/acknowledge.ts) no longer goes out from the webhook. It is
-- parked on the lead and sent ~2 minutes later by /api/cron/instant-ack,
-- so an owner who happens to be holding their phone and replies themselves
-- inside that window wins, and FollowUp stays silent instead of sending a
-- second, slightly different reply from the same business seconds later.
--
-- "ackDueAt" is both the due-at and the lock. A worker claims a row by
-- pushing the timestamp forward one lease inside the same conditional
-- UPDATE that matches "ackDueAt" <= now, so two overlapping cron ticks can
-- never both work the same lead — the same atomic-claim posture as
-- "Lead"."acknowledgedAt", "Lead"."lastRapidEngagementNotifiedAt" and
-- "OutboundSend"."status". "acknowledgedAt" remains the once-per-lead-ever
-- guarantee; nothing here weakens it.
--
-- The other three columns are the envelope the deferred send needs:
-- the lead's own words (never the synthesized attachment placeholder), the
-- channel to answer on, and when THEY wrote — so the staleness check still
-- measures from the lead's message rather than from whenever the cron ran.
--
-- Additive and nullable throughout; every existing row reads as "no
-- deferred acknowledgement queued", which is correct for all of them.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "ackDueAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "ackChannel" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "ackInboundText" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "ackInboundAt" TIMESTAMP(3);

-- The worker's once-a-minute "what is due right now" scan, across every
-- tenant at once — so deliberately not businessId-prefixed like the other
-- Lead indexes. Postgres does not index NULLs out of a btree entirely, but
-- the scan is a bounded range read on a column that is NULL for virtually
-- every row, which is the same shape as
-- "OutboundSend_status_nextAttemptAt_idx".
CREATE INDEX IF NOT EXISTS "Lead_ackDueAt_idx" ON "Lead"("ackDueAt");
