-- Closes the "two conversation threads for one lead" race: every
-- non-email channel (instagram, messenger, whatsapp, text, call,
-- voice-agent, web) find-or-creates its Conversation the same
-- check-then-act way — look for one, create it if it's not there — with
-- nothing in the database stopping two near-simultaneous requests (a
-- redelivered webhook, two messages landing seconds apart) from both
-- deciding "doesn't exist yet" and each creating their own row, silently
-- splitting that lead's message history across two threads.
--
-- "email" is deliberately excluded from this constraint: a lead can
-- legitimately have several email Conversation rows over time — one per
-- Gmail/Outlook thread — already kept apart by Conversation.externalId's
-- own unique constraint. The invariant this migration adds ("at most one
-- conversation per lead per channel") only holds for the channels where
-- that's actually true.
--
-- Step 1: before adding the constraint, merge any duplicates this race
-- may have already created — move their messages onto the oldest
-- conversation for that (leadId, channel) and drop the now-empty
-- duplicate rows. Nothing is deleted from Message; two threads become
-- one, with everything from both kept. A database with no duplicates
-- yet (the common case) sees these two statements affect zero rows.

WITH ranked AS (
  SELECT
    id,
    "leadId",
    channel,
    ROW_NUMBER() OVER (
      PARTITION BY "leadId", channel
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Conversation"
  WHERE channel <> 'email'
),
losers AS (
  SELECT r.id AS loser_id, k.id AS keeper_id
  FROM ranked r
  JOIN ranked k ON k."leadId" = r."leadId" AND k.channel = r.channel AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE "Message" m
SET "conversationId" = losers.keeper_id
FROM losers
WHERE m."conversationId" = losers.loser_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "leadId", channel
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Conversation"
  WHERE channel <> 'email'
)
DELETE FROM "Conversation"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: a partial unique index (not a full @@unique — email is exempt,
-- see above) so this race can never create a duplicate again. The app
-- side of this fix is findOrCreateConversation() in src/lib/conversations.ts.
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_leadId_channel_non_email_key"
  ON "Conversation" ("leadId", channel)
  WHERE channel <> 'email';
