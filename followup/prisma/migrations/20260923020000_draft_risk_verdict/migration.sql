-- The risk classifier's verdict on the draft currently stored in
-- Lead.suggestedMessage, kept alongside it rather than recomputed.
--
-- Both nullable with no default: every existing row is a draft written
-- before any verdict was recorded, and "unjudged" is the honest value for
-- those. Callers must treat null as "not known to be safe", never as safe.
ALTER TABLE "Lead" ADD COLUMN "suggestedRiskLevel" TEXT;
ALTER TABLE "Lead" ADD COLUMN "suggestedRiskReason" TEXT;
