-- Records that a human overruled the AI prospect classifier for this lead
-- ("this was a lead" in Settings). The retroactive clean-up pass
-- (POST /api/leads/cleanup) excludes any lead carrying this stamp, so a
-- rescued lead can never be re-judged and deleted by the same classifier
-- the owner already overruled.
--
-- Additive and nullable: existing rows get NULL, which means "never
-- overruled" — the correct reading for every lead that came straight from
-- sync. No backfill, no data loss.
ALTER TABLE "Lead" ADD COLUMN "classificationOverriddenAt" TIMESTAMP(3);
