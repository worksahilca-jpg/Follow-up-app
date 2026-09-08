-- Task #80 / research/audit/2026-09-08-newer-surface-audit.md finding #2:
-- persists a page-budget-truncated CRM sync run's pagination cursor so the
-- next run resumes instead of restarting at page 1 every time. Null =
-- no backfill in progress (either never started, or the last run
-- completed a full untruncated pass).
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "syncCursor" TEXT;
