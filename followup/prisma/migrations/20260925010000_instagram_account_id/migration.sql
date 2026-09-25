-- The Instagram professional-account id (`user_id` from /me), stored beside
-- the app-scoped `id` already in "instagramUserId". Webhooks and the
-- Conversations API identify the account by this one, so routing and the
-- poller's own-message check match on it. Additive and nullable: every row
-- connected before today stays null until
-- scripts/backfill-instagram-account-id.ts fills it. Unique, like
-- "instagramUserId": one Instagram account feeds one FollowUp account.
ALTER TABLE "Business" ADD COLUMN "instagramAccountId" TEXT;
CREATE UNIQUE INDEX "Business_instagramAccountId_key" ON "Business"("instagramAccountId");
