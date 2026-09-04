-- Instagram DM lead capture.
ALTER TABLE "Business" ADD COLUMN "instagramUserId" TEXT;
ALTER TABLE "Business" ADD COLUMN "instagramAccessToken" TEXT;
CREATE UNIQUE INDEX "Business_instagramUserId_key" ON "Business"("instagramUserId");
