-- "Write like me" (Settings → Your data): with the owner's yes, FollowUp
-- reads the replies they sent from Gmail in the last 12 months and keeps a
-- cleaned, de-identified copy of each, used only as a style sample for THIS
-- business's own drafts (src/lib/pastReplies.ts, src/lib/voice.ts). Never
-- shared with another business and never used to train a shared model.
--
-- New nullable columns and one new table: no backfill, no lock beyond the
-- brief ALTER.

ALTER TABLE "Business" ADD COLUMN "pastRepliesAllowedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "pastRepliesStatus" TEXT;
ALTER TABLE "Business" ADD COLUMN "pastRepliesPageToken" TEXT;
ALTER TABLE "Business" ADD COLUMN "pastRepliesScanned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN "pastRepliesError" TEXT;

CREATE TABLE IF NOT EXISTS "PastReply" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "gmailMessageId" TEXT NOT NULL,
  -- A short one-way hash of the recipient's address, for spreading samples
  -- across people. Never the address itself.
  "recipientKey" TEXT NOT NULL,
  -- Cleaned and de-identified before it is written; the raw message never is.
  "body" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PastReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PastReply_businessId_gmailMessageId_key"
  ON "PastReply"("businessId", "gmailMessageId");
CREATE INDEX IF NOT EXISTS "PastReply_businessId_sentAt_idx"
  ON "PastReply"("businessId", "sentAt");

ALTER TABLE "PastReply" ADD CONSTRAINT "PastReply_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Closed to Supabase's public Data API like every other table
-- (20260927000000_enable_rls_all_public_tables); the app's own roles bypass it.
ALTER TABLE "PastReply" ENABLE ROW LEVEL SECURITY;
