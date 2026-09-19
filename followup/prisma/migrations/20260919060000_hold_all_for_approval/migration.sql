-- Every automated follow-up waits for a human tap on this account
-- (src/lib/automation.ts). Additive with a default, so existing
-- businesses are unaffected; the beta plan turns it on for testers.
ALTER TABLE "Business" ADD COLUMN "holdAllForApproval" BOOLEAN NOT NULL DEFAULT false;
