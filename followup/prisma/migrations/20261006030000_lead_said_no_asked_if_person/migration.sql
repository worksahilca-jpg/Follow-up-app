-- Situations audit (founder 2026-10-06): remember when a customer's newest
-- message said no, or asked whether they're talking to a real person.
-- Additive only: two nullable columns, empty until the next message is read.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "saidNoAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "askedIfPersonAt" TIMESTAMP(3);
