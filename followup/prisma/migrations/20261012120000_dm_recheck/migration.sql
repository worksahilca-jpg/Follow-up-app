-- "Customer or not?" is asked again on each new Instagram/Messenger message
-- until a real reply has gone out (src/lib/inbound/dmRecheck.ts, A-239).
-- Additive only.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dmConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dmCheckedAt" TIMESTAMP(3);
