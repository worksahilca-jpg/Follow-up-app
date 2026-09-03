-- Outbound lead-event webhook URL — the reverse direction of webhookSecret.
ALTER TABLE "Business" ADD COLUMN "outboundWebhookUrl" TEXT;
