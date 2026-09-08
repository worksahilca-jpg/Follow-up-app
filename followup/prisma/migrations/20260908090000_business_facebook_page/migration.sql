-- AlterTable
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "facebookPageId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "facebookPageName" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "facebookPageAccessToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Business_facebookPageId_key" ON "Business"("facebookPageId");
