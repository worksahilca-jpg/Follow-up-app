# Least-privilege database role for the running app

Until now, the app's own connection (`DATABASE_URL`) used the same
`postgres` role as migrations (`DIRECT_URL`) — full owner rights on the
whole database, including the ability to alter or drop any table. That's
far more than a running web app needs day to day, and it means a bug
that lets an attacker run arbitrary SQL (or a leaked `DATABASE_URL`) would
hand over the whole database, not just the rows FollowUp actually touches.

A new role, `followup_app`, has been created directly on the Supabase
project (not tracked by a Prisma migration — this is role/grant
management, not a schema change) with exactly what the app needs and
nothing else:

- `SELECT, INSERT, UPDATE, DELETE` on every app table (the full list in
  `prisma/schema.prisma`) — no `CREATE`, `ALTER`, `DROP`, or any other DDL.
- No access at all to `_prisma_migrations` — only `prisma migrate deploy`,
  run via `DIRECT_URL`, ever needs to read or write that table.
- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE` — can't create databases,
  other roles, or escalate itself.
- `BYPASSRLS` — every table already has row-level security *enabled with
  no policies* (correct: it's what keeps Supabase's own public
  PostgREST API, via the `anon`/`authenticated` roles, from reading this
  data at all). This app was never built against that RLS layer though —
  every query already filters by `businessId` in the Prisma/application
  code, which is where tenant isolation actually lives — so the app's own
  connection needs to keep behaving exactly like the current
  `postgres`-owner connection does. Real per-tenant RLS policies enforced
  at the database layer (keyed to a session-scoped `businessId`) would be
  a separate, considerably larger project; this change doesn't create or
  close that gap either way, it only removes the unrelated
  superuser/DDL/cross-schema risk from the app's everyday connection.
- A connection limit (20) so a runaway serverless fan-out can't exhaust
  every connection slot on its own.

Verified directly against the database (`pg_roles`, `has_table_privilege`,
`has_schema_privilege`) before handing off the connection string: full
CRUD on every app table including the one below, zero access to
`_prisma_migrations`, and `CREATE` on the `public` schema correctly
denied.

## What actually needs to change

**Nothing in code** — `prisma/schema.prisma` already splits `url`
(`DATABASE_URL`, the app's runtime connection) from `directUrl`
(`DIRECT_URL`, migrations only). This is purely a credential swap:

In Vercel (project `follow-up-app`, and `followup`/`followup-voice-agent`
if they also hold a copy), update **`DATABASE_URL`** to:

```
postgresql://followup_app.vzlbjatinvixmatoaena:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

(same host/port/pooler flag as today — only the username and password
change; Supabase's pooler authenticates any database role the same way,
via `<role>.<project-ref>` as the username).

**Leave `DIRECT_URL` exactly as it is** — it must keep using the
`postgres` role, since `followup_app` deliberately has no rights to run
a migration.

The actual password is not written here — it was generated once and
needs to go straight into Vercel's environment variable, not sit in a
committed file. (Whoever applies this can also just rotate it: `ALTER
ROLE followup_app WITH PASSWORD '<new password>';` against the database,
then update Vercel to match.)

## One thing I couldn't verify from here

I confirmed every grant is exactly right by querying the database
directly, but this sandbox has no outbound access to raw Postgres
connections (HTTPS through a proxy only) — I couldn't personally open a
live connection through Supabase's pooler as `followup_app` to prove the
pooler itself accepts it end to end. It's the same, well-documented
mechanism Supabase's pooler already uses for the `postgres` role today,
so I'd expect it to just work, but test it (a preview deploy, or `npx
prisma db pull` locally against the new `DATABASE_URL`) before relying on
it in production, and keep the old value handy to revert to in Vercel
if anything doesn't connect.

## A bug found and fixed along the way

While confirming the table list to grant against, `CrmConnection`
(the CRM integration's own table — `/api/crm/config`,
`src/lib/crmSync.ts`) turned out not to exist in the live database at
all, even though `prisma/schema.prisma` declares it and
`_prisma_migrations` shows migration `20260908100000_crm_connection` as
successfully applied. The `Lead.crmProvider`/`crmId` columns from that
same migration file *were* live (applied earlier, directly, before the
migration file existed) — only the brand-new `CREATE TABLE` statement
had never actually run; the migration was seemingly marked applied
without every one of its statements having been executed. This meant
connecting a CRM has been silently broken in production since it
shipped — the very first `prisma.crmConnection.findUnique(...)` call
would throw "relation does not exist."

Fixed by running the missing `CREATE TABLE`/index statements directly
(the same SQL already in that migration file, which is safely
idempotent via `IF NOT EXISTS`) — verified the table now exists and is
included in `followup_app`'s grants above.
