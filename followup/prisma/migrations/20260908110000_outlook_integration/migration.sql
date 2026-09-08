-- Outlook / Microsoft 365 capture (src/lib/integrations/outlook.ts):
--   * Integration.tokenExpiresAt — Graph access tokens aren't
--     auto-refreshed by a client library like Gmail's; this is when the
--     stored one actually expires so a call can refresh just ahead of it.
--   * Integration.deltaLink — Graph's delta-query cursor, so an
--     incremental sync asks "what changed since here" instead of
--     re-pulling the whole inbox every tick.
--   * Conversation.emailProvider — which mailbox (gmail | outlook) an
--     email conversation actually lives in, once a business can have
--     both connected. Null means Gmail (the pre-existing default).
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "deltaLink" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "emailProvider" TEXT;
