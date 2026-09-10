-- Pre-approved WhatsApp template (Twilio Content API) for reopening a
-- conversation past Meta's 24-hour free-form-reply window.
ALTER TABLE "Business" ADD COLUMN "whatsappTemplateSid" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappTemplateBody" TEXT;
