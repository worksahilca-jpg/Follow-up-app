-- The atomic half of the duplicate-send guard.
--
-- src/lib/sending.ts already refuses a send whose exact body went to the
-- same lead in the last sixty seconds — but it did so by counting recent
-- Message rows and then deciding, which two simultaneous requests both
-- pass. A real lead received the identical 409-character follow-up twice
-- on 2026-09-20 (two Gmail ids, one body), and the queue's disabled-button
-- state is client-side only, so a double-tap, a retry or a second tab all
-- defeat it.
--
-- This table makes the claim itself the arbiter: the unique index means the
-- database, not a read from a moment ago, decides who owns the send.
--
-- Purely additive: a new table, no column or constraint changed anywhere
-- else, nothing backfilled. An empty table means "no send in flight",
-- which is the correct state for every lead at deploy time.
CREATE TABLE "SendClaim" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendClaim_pkey" PRIMARY KEY ("id")
);

-- The whole point: one live claim per (lead, exact message).
CREATE UNIQUE INDEX "SendClaim_leadId_bodyHash_key" ON "SendClaim"("leadId", "bodyHash");

-- For pruning rows whose window has long since passed.
CREATE INDEX "SendClaim_claimedAt_idx" ON "SendClaim"("claimedAt");

ALTER TABLE "SendClaim" ADD CONSTRAINT "SendClaim_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
