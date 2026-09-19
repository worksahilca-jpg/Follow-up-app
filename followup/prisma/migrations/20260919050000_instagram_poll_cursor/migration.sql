-- How far src/lib/instagramPoll.ts has read this business's Instagram
-- conversations. Additive and nullable: null means "never polled", which
-- the poller treats as a short lookback window rather than a full history
-- import.
ALTER TABLE "Business" ADD COLUMN "instagramSyncedAt" TIMESTAMP(3);
