-- Where Google's limit stopped the last full Gmail pass, so the next one picks up there instead of starting over
-- (src/lib/gmailSync.ts, 2026-10-27). Additive only: one nullable column on an existing table.
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "deepSyncOffset" INTEGER;
