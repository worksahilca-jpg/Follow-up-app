# Security & privacy roadmap — "the safest app in its category"

Set by the CEO 2026-09-07: FollowUp will hold a lot of other people's
conversations, and its models will be improved on that data. So security is a
standing program with levels, not a pass. `docs/security.md` is the current
state; this file is the plan. Each level is "done" only when every line is
checked and the re-audit checklist in `docs/security.md` passes.

## Level 1 — hygiene (DONE 2026-09-07)

- [x] Every data route requires a session; every per-id route is tenant-scoped.
- [x] Every inbound webhook verifies a signature or secret (Twilio now mandatory).
- [x] Third-party credentials encrypted at rest (AES-256-GCM, key in Vercel only).
- [x] Security headers: CSP, HSTS, no framing (except the widget), nosniff.
- [x] No secrets in code or git history; `.env` ignored.
- [x] Supabase: RLS on every table, no public policies; leaked-privilege function revoked.

## Level 2 — accountable and observable (IN PROGRESS)

- [x] **Audit trail.** `AuditEvent` rows for sends, deletes, imports, integration
      connect/disconnect, settings, team and billing actions (`src/lib/audit.ts`).
- [x] **Admin-only settings.** Integrations, billing, automation defaults, bulk
      cleanup and Gmail connect require the ADMIN role, checked fresh per request.
- [x] **Gmail disconnect revokes at Google**, stops the push watch, clears tokens.
- [x] **Rate limits on costly/abusable routes**: send, import, create, regenerate.
- [x] **CI on every PR**: typecheck, lint, build, dependency audit, gitleaks secret
      scan. Dependabot weekly.
- [x] **Error monitoring with PII scrubbing + alerts on auth/webhook failure
      spikes** (task #70). Sentry wired through Next's instrumentation
      hooks (server, edge, client, plus `app/global-error.tsx`), a shared
      `beforeSend` (`src/lib/sentryScrub.ts`) that redacts email/phone
      patterns and strips request bodies/cookies/headers before anything
      leaves the app, and `recordAuthFailure()`
      (`src/lib/monitoring.ts`) reporting every forged Twilio signature,
      wrong webhook/cron secret, and failed Meta verification as a
      fingerprinted event Sentry groups and can alert on. Inert (no-op,
      breaks nothing) until `SENTRY_DSN` is set — see
      `docs/error-monitoring-setup.md`, which also has the exact two
      Alert Rules to create once a Sentry project exists (that account
      creation and alert-rule setup is the one manual step left).
- [x] **Least-privilege DB role for the app** (task #71). `followup_app`: full
      CRUD on app tables, no DDL, no access to `_prisma_migrations`,
      `NOSUPERUSER`/`NOCREATEDB`/`NOCREATEROLE`. Migrations keep using the
      owner role via `DIRECT_URL`. See `docs/least-privilege-db-role.md` —
      the role is created and verified, but the `DATABASE_URL` cutover in
      Vercel is a manual step still pending (needs a live test through
      the pooler first).
- [x] **Per-business data export and full deletion, audit-logged** (task #72).
      Settings → "Your data": `GET /api/business/export` hands back every
      lead, conversation, message, deal, task, booking, sequence, team
      member and audit-log entry as one JSON file — deliberately never
      includes an OAuth token, the Twilio auth token, a CRM API key, or
      either webhook secret (`src/lib/businessData.ts`'s explicit
      field allowlist, not an omit-list, so a new secret column has to be
      added on purpose to ever reach an export). `POST /api/business/delete`
      is admin-only and gated behind typing the business's own name back;
      it cancels any active Stripe subscription, then removes every
      dependent row across 19 tables inside one transaction in FK-safe
      order (no cascade is configured from `Business` — see the schema's
      `onDelete` comments), and finally writes one `AuditEvent` documenting
      the deletion. That audit row is the one thing that survives on
      purpose: `AuditEvent` isn't a foreign-key relation to `Business` or
      `User` (schema comment: "an audit row must outlive the thing it
      describes"), so the erasure leaves a permanent record even though
      everything else is gone. 9 tests cover the deletion order, the
      Stripe-failure-never-blocks-erasure guarantee, and that no
      credential ever appears in an export.
- [x] **Schema validation (zod) on every request body** (task #73). Every
      route with a JSON body validates it through a shared helper
      (`src/lib/validation.ts`) instead of ad-hoc `typeof` checks.
- [ ] Automated tests for the trust guarantees (task #59) — security regressions
      are caught by tests, not by luck.
- [x] **Session hardening.** Sessions now expire after 7 days (down from
      NextAuth's 30-day default — `SESSION_MAX_AGE_SECONDS` in
      `src/lib/auth.ts`). A step-up check (`requireRecentAuth()`,
      `src/lib/reauth.ts`) gates the two truly irreversible actions —
      rotating the lead-webhook secret (immediately revokes the old URL)
      and deleting a business — behind having actually gone through
      Google's login screen in the last 5 minutes, not just holding a
      still-valid cookie; the client reacts to that 401 by forcing a fresh
      Google sign-in (`handleReauthRequired()`,
      `src/lib/reauthClient.ts`) and the admin just retries. And a session
      is no longer trusted indefinitely once someone's removed from their
      team: the JWT's businessId is re-checked against the DB every 5
      minutes (`REVALIDATE_INTERVAL_MS`), so `removeMember()` or a full
      business deletion revokes data access within minutes instead of
      leaving the old token good for the rest of its (now 7-day) life —
      role *demotion* was already instant, since `requireAdmin()` has
      always re-checked role fresh on every admin-gated request. 13 new
      tests cover the jwt callback's revalidation/authTime-stamping logic
      and the step-up gate itself.
- [ ] Owner actions (see `docs/security.md`): private repo, 2FA everywhere,
      `TOKEN_ENCRYPTION_KEY` set, GitHub secret scanning + Dependabot alerts on.

## Level 3 — verified by outsiders (when the first paying customers are on)

- [ ] External penetration test; fix everything it finds (task #69).
- [ ] Supabase point-in-time recovery + a tested restore drill.
- [ ] Incident response plan: who is paged, how customers are told, within what time.
- [ ] Data-processing agreements with Google, Twilio, OpenAI, Stripe, Meta, Vercel, Supabase.
- [ ] Privacy policy and terms updated for: data used to improve models (opt-in),
      retention periods, sub-processors, CASL/PIPEDA/TCPA obligations of the business.
- [ ] SOC 2 Type I when a customer asks for it; the audit trail and CI above are
      most of the evidence.
- [ ] Bug bounty or at least a `security.txt` and a disclosure inbox.

## Training on customer data — the rules (binding from today)

The CEO intends to improve FollowUp's models on real conversations. That is
allowed only under these rules, enforced in code as they are built:

1. **Opt-in per business.** `Business.allowModelTraining` exists, default
   `false`. No data from a business with it off ever enters a training set.
2. **De-identify first.** Names, emails, phone numbers, addresses, and any
   free-text identifier are stripped or replaced before a message leaves the
   production database (task #74 builds this pipeline). Lead content is
   personal information under PIPEDA; the business is the custodian, not us.
3. **Separate store.** Training sets live outside the production DB, with their
   own retention (default 12 months) and their own access log.
4. **No third-party training by default.** The OpenAI API does not train on API
   traffic; keep it that way (no opt-in to data sharing) and say so in the
   privacy policy.
5. **Right to be forgotten propagates.** Deleting a business or a lead also
   deletes its rows from any training set not yet used, and blocks re-use.
6. **Written down for customers.** The privacy policy states all of the above
   in plain words before the first training run.

## What "safest" will mean, measurably

- Zero routes reachable without auth or a verified signature (CI-enforced test).
- Zero credentials stored in plaintext (sweep reports 0 every tick).
- Every sensitive action has an audit row with who/when/what.
- Every PR passes typecheck, lint, build, audit, and secret scan before merge.
- A restore from backup has been rehearsed.
- An outside tester has tried to break it and failed, in writing.
