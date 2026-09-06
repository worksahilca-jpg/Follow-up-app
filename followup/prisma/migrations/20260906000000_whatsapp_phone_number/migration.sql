-- WhatsApp Business channel (Phase 1) — see
-- research/integrations/2026-09-06-whatsapp-business-production-readiness.md.
-- Separate from twilioPhoneNumber: a business's plain-SMS number and its
-- WhatsApp sender are commonly two different Twilio numbers.

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "whatsappPhoneNumber" TEXT;
