-- A proper drafted subject line alongside the drafted body, so a sent
-- email reads like a real business email (Subject: ...) instead of the
-- generic "Following up, <first name>" placeholder.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "suggestedSubject" TEXT;
