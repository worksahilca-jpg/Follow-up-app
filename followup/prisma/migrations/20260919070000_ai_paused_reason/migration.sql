-- Why FollowUp did not read a lead or write anything for it.
--
-- Additive and nullable: every existing row keeps NULL, which reads as
-- "nothing is paused here" — the correct answer for every lead that was
-- processed normally, and the safe answer for one that was refused before
-- this column existed (the next pass recomputes it either way).
ALTER TABLE "Lead" ADD COLUMN "aiPausedReason" TEXT;
