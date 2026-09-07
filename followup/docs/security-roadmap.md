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
- [ ] Error monitoring with PII scrubbing + alerts on auth/webhook failure spikes (task #70).
- [ ] Least-privilege DB role for the app; migrations only via DIRECT_URL (task #71).
- [ ] Per-business data export and full deletion, audit-logged (task #72).
- [ ] Schema validation (zod) on every request body (task #73).
- [ ] Automated tests for the trust guarantees (task #59) — security regressions
      are caught by tests, not by luck.
- [ ] Session hardening: 7-day max age, re-auth prompt before revealing/rotating
      secrets, sessions invalidated on role change or removal.
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
