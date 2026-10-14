-- Signed lead events (A-252): the secret each business's outgoing events are signed with. One empty column;
-- a business with a webhook URL gets its secret the next time an event is sent or the URL is saved.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "outboundWebhookSecret" TEXT;
