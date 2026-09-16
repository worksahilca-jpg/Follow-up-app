-- Every message FollowUp sends now records what it was sent under, the same
-- value as the FollowUp row written beside it. Additive and nullable.
--
-- Why: the instant acknowledgement is an ordinary outbound Message, so
-- "did anyone answer this lead" saw it as a reply, and the 3-hour and
-- 20-hour unanswered rules never fired for a lead who wrote once. An
-- owner's reply synced from Gmail/Outlook carries no marker either, so the
-- ack cannot be told apart from a real reply by structure alone — hence a
-- column, not a heuristic. See Message.trigger in schema.prisma.
--
-- Backfill: sendFollowUpToLead writes the Message and the FollowUp in the
-- same call with the same body, so joining them per lead on body recovers
-- the trigger for history. A lead with two identical bodies under different
-- triggers is ambiguous; PostgreSQL picks one. Untagged outbound rows keep
-- today's (conservative) behaviour: treated as a real reply.

ALTER TABLE "Message" ADD COLUMN "trigger" TEXT;

UPDATE "Message" m
SET "trigger" = f."trigger"
FROM "Conversation" c, "FollowUp" f
WHERE m."conversationId" = c."id"
  AND f."leadId" = c."leadId"
  AND m."direction" = 'outbound'
  AND m."source" IS NULL
  AND m."trigger" IS NULL
  AND f."trigger" IS NOT NULL
  AND f."message" = m."body";
