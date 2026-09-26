-- Row-level security ON for every table in the public schema.
--
-- Why: Supabase exposes the public schema through its Data API (PostgREST)
-- to the `anon` and `authenticated` roles. On 2026-09-08 every table then
-- in existence had RLS enabled with no policies, which denies those roles
-- everything (docs/least-privilege-db-role.md). Tables created by
-- migrations since then — AccessRequest, AgentRole, AgentRun, AgentTask,
-- InboundWebhookEvent, OutboundSend, OwnerAlert, ProcessedWebhookEvent,
-- PushSubscription, ReactivationRun, SendClaim, Suppression — never
-- got it, so nothing but the secrecy of the project's anon key stood
-- between them and the public API.
--
-- Safe for the app: FollowUp never uses the Data API. Its own connection
-- is either the table owner (`postgres`, which bypasses RLS on tables it
-- owns) or `followup_app`, created with BYPASSRLS. No policies are added,
-- so `anon`/`authenticated` see nothing.
--
-- Written to never fail a deploy: only tables still without RLS, and only
-- those the migrating role owns (ALTER TABLE requires ownership — a table
-- someone created by hand under another role is skipped, not an error).
-- Re-running it is a no-op.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
      AND tableowner = current_user
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
