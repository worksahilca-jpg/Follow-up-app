-- The follow-up strategy (founder, 2026-09-25): four different reminders to
-- a quiet lead, a one-off welcome back at 45 days, and a reply within five
-- minutes of any new message.
--
-- "suggestedDraftKind": what the cached draft in "suggestedMessage" was
-- written AS — "reminder_1".."reminder_4", "reactivation", "belated_reply",
-- or null for an ordinary reply. Nullable with no default: every existing
-- draft is an ordinary reply as far as anyone can tell, and null makes the
-- automation rebuild a reminder once rather than reuse a reply as one.
ALTER TABLE "Lead" ADD COLUMN "suggestedDraftKind" TEXT;

-- The once-a-minute fresh-reply worker asks "which leads, across every
-- business, heard or said something in the last hour". Unprefixed for the
-- same reason as "Lead_ackDueAt_idx": a per-tenant index cannot serve a scan
-- that runs across all tenants at once.
CREATE INDEX "Lead_lastContacted_idx" ON "Lead"("lastContacted");
