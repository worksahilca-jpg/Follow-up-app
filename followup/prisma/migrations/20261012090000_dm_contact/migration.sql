-- How an Instagram or Messenger customer said to reach them, typed into the
-- DM, and when a reply first asked (src/lib/dmContact.ts, A-238). Follow-ups
-- continue by email once Meta's 24-hour window has closed. Additive only.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dmEmail" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dmPhone" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dmContactAskedAt" TIMESTAMP(3);
