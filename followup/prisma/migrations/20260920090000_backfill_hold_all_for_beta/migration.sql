-- The hold that wasn't holding.
--
-- 20260919060000 added "holdAllForApproval" with DEFAULT false, and
-- grantBetaPlan() (src/lib/billing.ts) sets it true. But grantBetaPlan
-- only runs on a real round-trip through Google's sign-in screen — so a
-- tester already granted the beta plan BEFORE that column existed kept
-- `false` for as long as their session stayed alive. Nothing else in the
-- app ever writes the column true.
--
-- That is not a theoretical gap. On 2026-09-20 the founder's own account
-- read `subscriptionStatus: beta, tier: pro, holdAllForApproval: false`
-- — the one account whose owner had said, in as many words, "don't send
-- any replies without asking me, bro. They'll put us on spam, or they
-- might report us." Every hold shipped that day reads this column, so on
-- his account they all no-opped.
--
-- Same predicate as grantBetaPlan: a real Stripe subscription
-- disqualifies, a status string does not. A paying customer is never
-- touched, and a business already holding is left alone.
UPDATE "Business"
SET "holdAllForApproval" = true
WHERE "subscriptionStatus" = 'beta'
  AND "stripeSubscriptionId" IS NULL
  AND "holdAllForApproval" = false;
