# Supabase/Postgres — production-tier considerations beyond running migrations

Checked: 2026-09-06. Current wiring: `prisma/schema.prisma` already correctly splits
`DATABASE_URL` (pooled, port 6543, `?pgbouncer=true`) from `DIRECT_URL` (port 5432, used only by
`prisma migrate`) — this is the right shape for a serverless Next.js app on Vercel talking to
Supabase, and it's already documented in the schema file's own comments. This integration is in
better shape than the others; findings below are refinements, not missing foundations.

## No hard blocker found. One likely-missing parameter worth a quick check, and a real cost decision to make deliberately.

### `connection_limit=1` — commonly required alongside `pgbouncer=true`, not currently in `.env`
The `.env` and `.env.example` `DATABASE_URL` values use `?pgbouncer=true` but not
`&connection_limit=1`. Supabase/Prisma's own serverless guidance is that Prisma's connection pool
(which defaults to a per-instance pool size, not 1) should be capped to 1 per serverless function
invocation when sitting behind PgBouncer's transaction-mode pooler — each concurrent Vercel
function otherwise opens its own multi-connection Prisma pool against the already-pooled
connection, which can exhaust PgBouncer's own connection budget under real concurrent traffic in
a way that looks like intermittent "can't reach database" errors under load rather than a clean
failure. This is worth backend-agent verifying directly against Prisma's current Supabase guide
(check the exact current recommended parameter set, since Prisma's serverless-pooling guidance has
changed more than once across versions) rather than trusting this write-up as a source of truth —
this is exactly the kind of setting that's easy to get right at low traffic and only surfaces as a
problem at real concurrent volume, which is squarely this task's mandate.
Source: https://backupdrill.com/guides/backupdrill.com/guides/supabase-disaster-recovery (general
serverless-pooling guidance article) — this is a single, thin secondary source on the specific
parameter; treat the *existence of the concern* as solid (it's consistent with well-known
PgBouncer + Prisma behavior) but verify the exact parameter/value against Prisma's own current
docs before changing anything in `.env`.

### Backups / Point-in-Time Recovery — depends entirely on which Supabase plan tier is active
- **Free tier**: no PITR available; daily backups aren't guaranteed at the same retention as paid.
- **Pro tier**: 7 days of daily backups, no PITR by default.
- **PITR add-on**: available on Pro as a paid add-on (~$100/month range), giving second-granularity
  restore. Included by default on Team tier and above.
Source: https://axonbuild.com/blog/supabase-backup/ , cross-checked against Supabase's own docs
page referenced in search results (https://supabase.com/docs/guides/platform/backups) which
states the same Pro-tier 7-day daily backup baseline.

**This is a real decision, not a default to accept passively**: a production SaaS holding real
customer sales-lead data (names, contact info, deal conversations) on a 7-days-of-daily-backups
plan means any data-corruption or bad-migration incident more than a week old, or any incident
needing sub-day granularity to recover from cleanly, is unrecoverable. Whether that's acceptable
risk at FollowUp's current scale is a business call, not something to silently inherit from
whatever Supabase plan happens to be active — recommend backend-agent/manager-agent confirm the
current plan tier explicitly and decide on PITR deliberately rather than by default.

## Should do before scale, not before launch
- **Read-replica / connection-limit headroom**: Supabase's direct-connection limit (60 on smaller
  tiers) is only used by `prisma migrate` per the schema's own comment, which is the right
  pattern — but worth confirming migrations aren't ever run from a serverless function or cron job
  that could contend with that same limit under concurrent deploys.
- **Row-level security (RLS)**: Prisma bypasses Postgres RLS by default (it connects as a
  superuser-equivalent role) — multi-tenant isolation in this codebase is enforced entirely at the
  application layer (e.g. `getGmailIntegration`'s explicit `businessId` scoping, called out in
  `gmail.ts`'s own comments as a deliberate pattern). That's a legitimate approach, but it means
  there's no database-level backstop if an application-layer scoping bug ever slips through — not
  a defect, just worth backend-agent knowing this is a single-layer-of-defense design decision, not
  belt-and-suspenders.

Sources checked 2026-09-06:
- https://axonbuild.com/blog/supabase-backup/
- https://supabase.com/docs/guides/platform/backups (referenced via search; not independently
  fetched due to WebFetch being blocked in this sandbox — treat as a pointer to verify directly)
- https://supabase.com/docs/guides/deployment/going-into-prod (referenced via search, same caveat)
