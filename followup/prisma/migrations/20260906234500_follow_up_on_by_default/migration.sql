-- New leads start in ASSISTED: FollowUp follows up on its own, holding anything risky for approval.
ALTER TABLE "Lead" ALTER COLUMN "automationTier" SET DEFAULT 'ASSISTED';
-- Existing open leads move to the new default too (won/lost stay untouched).
UPDATE "Lead" SET "automationTier" = 'ASSISTED' WHERE "automationTier" = 'OFF' AND stage NOT IN ('WON', 'LOST');
-- Every business gets the master switch, on, with a 5-day silence window — unless it already made a choice.
INSERT INTO "Automation" (id, "businessId", name, "triggerDays", action, enabled)
SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), b.id, 'Auto follow-up on silence', 5, 'auto_send', true
FROM "Business" b
WHERE NOT EXISTS (SELECT 1 FROM "Automation" a WHERE a."businessId" = b.id AND a.action = 'auto_send');
