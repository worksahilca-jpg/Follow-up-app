-- A provider outage should delay a message, not lose it.
--
-- Until now a failed provider call inside sendFollowUpToLead() returned
-- { success: false } and the caller moved on. For an automated send that
-- usually meant the message was simply never sent: a transient Twilio 500 or
-- a Gmail rate limit cost a real follow-up, silently.
--
-- This table holds the ones worth trying again. Deliberately NOT a status on
-- FollowUp: that table is the record of what WAS sent and is read by the
-- weekly report, rescued-lead attribution, reply detection and the daily send
-- fuse (sendCaps.ts counts FollowUp rows) — a queued row there would count
-- against the fuse before anything left, and "sent" would stop being a fact.
--
-- Additive and self-contained: no existing table or column changes.

-- CreateTable
CREATE TABLE IF NOT EXISTS "OutboundSend" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  -- The envelope, exactly as sendFollowUpToLead() was asked for it. Stored
  -- rather than re-derived: a retry must send the message the risk gate
  -- already approved, not a fresh draft nobody reviewed.
  "channel" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "subject" TEXT,
  "emailThreadId" TEXT,
  "emailInReplyTo" TEXT,
  "trigger" TEXT,
  "auditMeta" JSONB,
  -- queued | sending | sent | failed | canceled
  "status" TEXT NOT NULL DEFAULT 'queued',
  -- Counts the original inline attempt, so a row starts at 1.
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL,
  -- When the current attempt claimed the row. A stale lock means an
  -- invocation was killed mid-attempt: outcome unknown, so the row is retired
  -- rather than retried.
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundSend_pkey" PRIMARY KEY ("id")
);

-- The worker's "what is due right now" scan, across every business.
CREATE INDEX IF NOT EXISTS "OutboundSend_status_nextAttemptAt_idx" ON "OutboundSend"("status", "nextAttemptAt");
-- "Is there already a send in flight for this lead" — the guard that stops a
-- caller starting a second send while a retry for the same lead is pending.
CREATE INDEX IF NOT EXISTS "OutboundSend_leadId_status_idx" ON "OutboundSend"("leadId", "status");
CREATE INDEX IF NOT EXISTS "OutboundSend_businessId_status_idx" ON "OutboundSend"("businessId", "status");

-- AddForeignKey
ALTER TABLE "OutboundSend" DROP CONSTRAINT IF EXISTS "OutboundSend_businessId_fkey";
ALTER TABLE "OutboundSend" ADD CONSTRAINT "OutboundSend_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OutboundSend" DROP CONSTRAINT IF EXISTS "OutboundSend_leadId_fkey";
ALTER TABLE "OutboundSend" ADD CONSTRAINT "OutboundSend_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
