-- The "we didn't import this, and here's why" record, extended to
-- WhatsApp.
--
-- Until now every row was a mailbox thread, so senderEmail was required.
-- A WhatsApp chat has a number instead, and putting a phone number in a
-- column called senderEmail is the kind of quiet lie this codebase keeps
-- having to undo — so the column is relaxed and a matching one added.
-- Exactly one of the two is set per row, decided by `provider`.
--
-- Additive and widening: every existing row keeps its senderEmail and
-- gains a NULL senderPhone.
ALTER TABLE "FilteredEmail" ALTER COLUMN "senderEmail" DROP NOT NULL;
ALTER TABLE "FilteredEmail" ADD COLUMN "senderPhone" TEXT;

-- WhatsApp only: the thread itself, so Restore can actually restore it.
-- A mailbox row re-fetches from Gmail/Graph by thread id; WhatsApp's
-- history arrives once in one webhook and is never queryable again, so
-- without this the restore button would return an empty conversation.
ALTER TABLE "FilteredEmail" ADD COLUMN "threadPayload" JSONB;
