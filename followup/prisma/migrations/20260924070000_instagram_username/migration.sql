-- The Instagram handle captured at connect time, so Settings can say which
-- account is connected in words an owner recognises. Nullable: every row
-- connected before today has none and falls back to the numeric id.
ALTER TABLE "Business" ADD COLUMN "instagramUsername" TEXT;
