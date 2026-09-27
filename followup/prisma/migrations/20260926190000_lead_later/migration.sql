-- "Later" on a waiting reply (design brain A-046).
ALTER TABLE "Lead" ADD COLUMN "laterUntil" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "laterSetAt" TIMESTAMP(3);
