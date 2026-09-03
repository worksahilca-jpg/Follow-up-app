-- Twilio SMS/voice lead capture.
ALTER TABLE "Business" ADD COLUMN "twilioSecret" TEXT;
ALTER TABLE "Business" ADD COLUMN "twilioAuthToken" TEXT;
CREATE UNIQUE INDEX "Business_twilioSecret_key" ON "Business"("twilioSecret");
