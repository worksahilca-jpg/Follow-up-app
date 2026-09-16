-- The durable landing pad for every inbound lead-bearing payload.
--
-- Written BEFORE the work the payload implies (find-or-create the lead,
-- store the message, acknowledge, score) and only AFTER the provider
-- signature has been verified. Twilio and Meta both stop retrying once they
-- see a 2xx, and these routes must answer 2xx — so without this row, a
-- failure anywhere in that work destroyed the message with nothing left on
-- disk to replay.
--
-- Deliberately a sibling of "ProcessedWebhookEvent" rather than an
-- extension of it: that table is Stripe's exactly-once marker, keyed on a
-- provider event id, carrying no payload, and DELETED again when processing
-- fails. Here a failed row has to survive.
--
-- Additive and nullable throughout; nothing existing changes.

CREATE TABLE IF NOT EXISTS "InboundWebhookEvent" (
  "id" TEXT NOT NULL,
  -- Nullable: a Meta envelope is app-wide and is attributed per-entry
  -- during processing. No foreign key on purpose — a raw-capture log must
  -- never block a business deletion; deleteBusinessData() clears these.
  "businessId" TEXT,
  -- twilio | meta | http
  "provider" TEXT NOT NULL,
  -- sms | whatsapp | instagram_or_messenger | webhook_lead | embed_form
  "channel" TEXT NOT NULL,
  -- The provider's delivery id when it has one (a Twilio MessageSid).
  -- Informational; de-dup is enforced downstream on "Message"."externalId".
  "externalId" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- pending | processed | failed
  "status" TEXT NOT NULL DEFAULT 'pending',
  "processedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "InboundWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- The replay query: everything not yet processed, oldest first.
CREATE INDEX IF NOT EXISTS "InboundWebhookEvent_status_receivedAt_idx"
  ON "InboundWebhookEvent"("status", "receivedAt");

CREATE INDEX IF NOT EXISTS "InboundWebhookEvent_businessId_receivedAt_idx"
  ON "InboundWebhookEvent"("businessId", "receivedAt");
