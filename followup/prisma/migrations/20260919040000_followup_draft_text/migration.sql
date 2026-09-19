-- The AI draft as it stood at send time, stored only for businesses that
-- opted in to improving FollowUp (Business.allowModelTraining). Additive.
ALTER TABLE "FollowUp" ADD COLUMN "draftText" TEXT;
