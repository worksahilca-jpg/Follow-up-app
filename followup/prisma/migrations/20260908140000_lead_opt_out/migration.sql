-- TCPA/CTIA SMS/WhatsApp opt-out: set the moment a lead texts STOP (or an
-- equivalent keyword). Every send path checks this before texting/
-- WhatsApp-ing a lead again — see sendFollowUpToLead() in
-- src/lib/sending.ts.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "optedOutAt" TIMESTAMP(3);
