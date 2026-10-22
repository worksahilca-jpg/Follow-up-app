-- The pilot: the owner's own numbers from the setup call (inquiries and appointments a month, hours a week replying).
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "pilotBaseline" JSONB;
