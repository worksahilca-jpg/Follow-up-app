-- An account has to be told it may send unreviewed, not told to be safe.
--
-- `holdAllForApproval` defaulted to false, with grantBetaPlan
-- (src/lib/billing.ts) switching it on for every tester it creates. That
-- covers an account made the one expected way and silently misses every
-- other: a teammate signing in, or an account carrying a stale "active"
-- subscriptionStatus from earlier billing work, arrived with the hold OFF.
-- Such an account passes hasActiveAccess, so a lead reaching it by email
-- or website form would get an instant reply sent to a stranger with
-- nobody having read it — the one thing the founder ruled out in those
-- words on 2026-09-20: "They'll put us on spam, or they might report us."
--
-- Six accounts were in that state when this was found. None had sent
-- anything and none had real leads, which is luck, not design.
--
-- Two changes, both safe in either order:

-- 1. The default, so a new account is held unless someone decides
--    otherwise in Settings.
ALTER TABLE "Business" ALTER COLUMN "holdAllForApproval" SET DEFAULT true;

-- 2. The accounts already in the gap. Deliberately every row that is not
--    already held, rather than the beta-only predicate the 2026-09-20
--    backfill used — that narrower rule is exactly why these were missed.
--    Nobody on this deployment is meant to be sending unreviewed today,
--    and an owner who wants it can turn it off in Settings.
UPDATE "Business" SET "holdAllForApproval" = true WHERE "holdAllForApproval" = false;
