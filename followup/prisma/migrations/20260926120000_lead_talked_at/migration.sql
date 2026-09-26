-- "We talked" (design brain A-039): when the owner spoke with a customer
-- outside FollowUp. Nullable, no default, no backfill: null means the owner
-- never said so, which is every existing row.
ALTER TABLE "Lead" ADD COLUMN "talkedAt" TIMESTAMP(3);
