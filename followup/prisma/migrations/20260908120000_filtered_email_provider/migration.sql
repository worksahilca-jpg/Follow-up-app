-- Which mailbox a filtered-out email came from (gmail | outlook), so the
-- "this was a lead" restore action calls the right provider's importer.
-- Every existing row predates Outlook, so it defaults to "gmail".
ALTER TABLE "FilteredEmail" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'gmail';
