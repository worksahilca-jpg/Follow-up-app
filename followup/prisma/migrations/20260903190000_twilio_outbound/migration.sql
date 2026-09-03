-- Twilio outbound SMS sending: Account SID + the number to send from.
ALTER TABLE "Business" ADD COLUMN "twilioAccountSid" TEXT;
ALTER TABLE "Business" ADD COLUMN "twilioPhoneNumber" TEXT;
