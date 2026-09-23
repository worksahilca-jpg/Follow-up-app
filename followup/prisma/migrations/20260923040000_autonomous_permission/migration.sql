-- May a lead on this account be set to Auto, the mode that skips the risk
-- check entirely?
--
-- Defaults to false, INCLUDING for businesses that already have leads on
-- AUTONOMOUS. That is the point rather than an oversight: nobody has ever
-- been asked this question, so nobody has answered it, and treating an
-- unanswered question as a yes is what the column exists to stop. An
-- owner who wants it grants it once in Settings; a lead already set to
-- Auto is held until they do, and nothing is lost.
ALTER TABLE "Business" ADD COLUMN "autonomousAllowed" BOOLEAN NOT NULL DEFAULT false;
