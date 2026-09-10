-- Twilio delivery-status tracking for outbound SMS/WhatsApp messages
-- (task #96) — previously only the synchronous "Twilio accepted it"
-- response was recorded; this adds the real async delivery outcome.
ALTER TABLE "Message" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryErrorCode" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryErrorMessage" TEXT;
ALTER TABLE "Message" ADD COLUMN "deliveryUpdatedAt" TIMESTAMP(3);
