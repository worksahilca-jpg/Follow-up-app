# Security — what is enforced, and what only the owner can do

Last audit: 2026-09-07. Re-run the checklist at the bottom after any change to
auth, webhooks, or credentials.

## What the code enforces

**Sign-in and sessions.** Google OAuth only (no passwords to leak). JWT sessions
via NextAuth with `NEXTAUTH_SECRET`; `ALLOWED_EMAILS` optionally gates who can
sign in at all. Every `/api/*` route that reads or writes tenant data calls
`getSessionContext()` and refuses without it.

**Tenant isolation.** Every per-id route (`leads/[id]/*`, `notifications/[id]`,
`saved-filters/[id]`, `sequences/[id]`, `team/*/[id]`, `gmail/filtered/[id]`)
either filters by `businessId`/`userId` in the query or checks it on the fetched
row before acting. Audited 2026-09-07: no route acts on another business's row.

**Inbound webhooks.**
- Twilio (SMS, WhatsApp, voice, recording callback): the URL secret identifies
  the business AND the `X-Twilio-Signature` must verify against that business's
  Auth Token. A business with no token saved is rejected, never trusted.
- Instagram: `X-Hub-Signature-256` verified against the Meta app secret.
- Stripe: `stripe-signature` verified with `constructEvent`.
- Voice-agent transcript callback: bearer `VOICE_AGENT_CALLBACK_SECRET`.
- Gmail push: shared secret in the subscription URL; endpoint disabled when unset.
- Generic lead webhook / website widget: per-business secret or id, plus
  per-business rate limits (`tooManyRecentLeads`).
- Cron routes: `Authorization: Bearer CRON_SECRET`, refused when unset.

**Credentials at rest.** Gmail OAuth tokens, each business's Twilio Auth Token
and Instagram token are encrypted with AES-256-GCM under `TOKEN_ENCRYPTION_KEY`
(`src/lib/crypto.ts`, applied by the Prisma extension in `src/lib/db.ts`).
Legacy plaintext rows are re-encrypted by `src/lib/secretsSweep.ts` on the next
cron ticks after the key is set. Without the key the app still works and logs a
warning — set it.

**Browser hardening** (`next.config.ts`): Content-Security-Policy, HSTS (1 year),
`X-Frame-Options: DENY` everywhere except the embeddable widget under `/embed/`,
`nosniff`, strict referrer policy, Permissions-Policy, no `X-Powered-By`.

**Database.** Prisma with parameterised queries throughout (no raw SQL with user
input). Supabase RLS is enabled on every table with no policies, so the
PostgREST/anon API cannot read anything; only the app's Postgres role can. The
`rls_auto_enable()` helper had EXECUTE granted to `anon`/`authenticated`; revoked
2026-09-07.

**Secrets in the repo.** None. `.env*` files are git-ignored; only `.env.example`
with empty values is tracked. Git history was scanned 2026-09-07 for API-key
patterns: nothing found.

## What only the owner can do (please do these)

1. **Make the GitHub repository private.** It is public today and has been
   forked once; a vendor already read the PR history to write a sales email.
   Settings → General → Danger Zone → Change visibility → Private.
2. **Turn on two-factor authentication** on GitHub, Google (the account that
   owns the OAuth client and Cloud project), Vercel, Supabase, Twilio, Stripe,
   and OpenAI. A stolen password on any of these bypasses everything above.
3. **Set `TOKEN_ENCRYPTION_KEY`** in Vercel (Production): `openssl rand -base64 32`.
   Store the value somewhere safe (a password manager); losing it means
   customers must reconnect Gmail/Twilio/Instagram.
4. **Rotate anything ever pasted into a chat or email**: the Vercel/Supabase/
   Twilio tokens are safe (never shared); the voice-agent callback secret and
   the Gmail push secret were generated in a private Claude session — fine, but
   rotate them if that transcript is ever shared.
5. **Enable GitHub secret scanning + Dependabot alerts** on the repo (Settings →
   Code security). Free, and catches an accidental commit before anyone else does.
6. **Keep `ALLOWED_EMAILS` set** until you deliberately open sign-up to strangers.

## Known, accepted for now

- `npm audit` reports `deepmerge-ts` (via the Prisma CLI's config loader) as
  high. It affects the build-time CLI, not the running app; the suggested "fix"
  is a Prisma downgrade. Revisit when Prisma ships a patched 6.x.
- CSP allows `'unsafe-inline'`/`'unsafe-eval'` for scripts because Next.js
  needs them without a nonce setup. Tighten once there is a page test suite.
- The booking page (`/book/[leadId]`) is public by design (a lead uses it);
  lead ids are unguessable cuids and the route creates only a booking.

## Re-audit checklist

- [ ] Every new `/api` route calls `getSessionContext()` or verifies a signature/secret.
- [ ] Every new per-id route filters by `businessId` (or `userId`).
- [ ] Every new credential column is added to `ENCRYPTED_FIELDS` in `src/lib/db.ts`.
- [ ] `npm audit --omit=dev` and Supabase security advisors clean.
- [ ] `git log -p | grep` for key patterns finds nothing.
