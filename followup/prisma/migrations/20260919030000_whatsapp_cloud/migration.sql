-- WhatsApp through Meta's Cloud API on the owner's own number (Coexistence).
-- Additive and nullable; the Twilio WhatsApp columns stay untouched.
ALTER TABLE "Business" ADD COLUMN "whatsappWabaId" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappPhoneNumberId" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappAccessToken" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappDisplayNumber" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappConnectMode" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappCloudTemplateName" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappCloudTemplateLanguage" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappCloudTemplateBody" TEXT;

CREATE UNIQUE INDEX "Business_whatsappPhoneNumberId_key" ON "Business"("whatsappPhoneNumberId");
