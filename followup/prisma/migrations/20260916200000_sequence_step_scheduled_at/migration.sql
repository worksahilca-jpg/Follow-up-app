-- When a lead's current workflow step was scheduled. Additive and nullable.
--
-- Stop-on-reply used to fire on ANY inbound being the newest message, with
-- no notion of "since the workflow last acted" — so enrolling a lead whose
-- last message was already unanswered cancelled the workflow at step 0.
-- Now only an inbound newer than this stamp stops it. No backfill: a null
-- keeps the old rule for leads enrolled before this landed, which errs
-- towards stopping rather than sending. See Lead.sequenceStepScheduledAt.

ALTER TABLE "Lead" ADD COLUMN "sequenceStepScheduledAt" TIMESTAMP(3);
