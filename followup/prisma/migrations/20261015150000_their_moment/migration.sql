-- "Their moment" (A-262). Additive only: four empty columns on Lead.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "momentAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "momentQuote" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "momentSaidAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "momentNoteAt" TIMESTAMP(3);
