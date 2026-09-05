-- Missed-call text-back cooldown marker — see lastMissedCallTextAt in
-- schema.prisma. Caps the text-back to one per cooldown window per lead
-- instead of firing again on every repeat call from the same number.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "lastMissedCallTextAt" TIMESTAMP(3);
