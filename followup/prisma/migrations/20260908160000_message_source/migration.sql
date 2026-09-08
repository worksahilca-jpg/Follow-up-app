-- Task #68: distinguishes a message FollowUp actually sent from one it
-- only captured (e.g. a reply Meta's own Business AI sent on Instagram/
-- Messenger, seen as a webhook "echo"). Null = FollowUp sent it.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "source" TEXT;
