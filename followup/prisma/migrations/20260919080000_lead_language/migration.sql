-- How a lead writes, decided once and held steady.
--
-- All five columns are additive and nullable. Every existing row keeps
-- NULL, which reads as "not decided yet" — the honest answer for a lead
-- captured before this existed, and the state the detector fills in on
-- the next pass that touches them.
ALTER TABLE "Lead" ADD COLUMN "language" TEXT;
ALTER TABLE "Lead" ADD COLUMN "languageScript" TEXT;
ALTER TABLE "Lead" ADD COLUMN "languageRegister" TEXT;
ALTER TABLE "Lead" ADD COLUMN "languageSetAt" TIMESTAMP(3);

-- The lead's language as it stood when a message was sent, copied onto
-- the send so the draft-versus-sent pairs can be grouped by language.
ALTER TABLE "FollowUp" ADD COLUMN "language" TEXT;
