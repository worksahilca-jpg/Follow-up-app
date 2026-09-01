-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false;


-- Businesses that already have real leads have clearly already been in
-- real use — don't force them through onboarding retroactively. A fresh
-- business with zero leads (like a brand-new signup) correctly stays
-- onboarded = false and will see the onboarding flow.
UPDATE "Business"
SET "onboarded" = true
WHERE EXISTS (SELECT 1 FROM "Lead" WHERE "Lead"."businessId" = "Business"."id");
