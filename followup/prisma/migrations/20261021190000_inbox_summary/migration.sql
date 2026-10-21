-- "Your last 90 days" on Today (A-306): when the owner pressed "Got it". Additive only.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "inboxSummarySeenAt" TIMESTAMP(3);
