# Error monitoring & security alerts (Sentry)

Without this, an unhandled error or a spike in forged webhook/signature
attempts is invisible — nobody finds out until a customer complains, or
never. This is the one-time Sentry setup that turns it on; the code
already ships and is a complete no-op until you do.

## 1. Create a Sentry project

1. [sentry.io](https://sentry.io) → create an account (or an org) → **New
   Project** → platform **Next.js**.
2. Sentry shows a DSN (`https://<key>@o<org>.ingest.us.sentry.io/<project>`,
   or an `.ingest.de.sentry.io`/plain `.ingest.sentry.io` host depending on
   your org's data region). Copy it.

## 2. Add the DSN to Vercel

Project `follow-up-app` (and `followup`/`followup-voice-agent` if they run
this same code), Production environment:

- `SENTRY_DSN` = the DSN from step 1
- `NEXT_PUBLIC_SENTRY_DSN` = the **same** DSN value

Both are needed — one for server/edge code, one inlined into the browser
bundle (only `NEXT_PUBLIC_`-prefixed vars ever are). A Sentry DSN is
meant to be public; it only grants "submit an event," never read access.

Redeploy. That alone turns on error capture for every unhandled server
error, Route Handler exception, and browser-side crash.

## 3. (Optional) Source maps

Without this, Sentry still receives every error — stack traces just show
minified code instead of your actual source. To fix that, add:

- `SENTRY_ORG` — your org slug (Sentry → Settings → General)
- `SENTRY_PROJECT` — the project slug from step 1
- `SENTRY_AUTH_TOKEN` — Sentry → Settings → Auth Tokens → New Token, scope
  `project:releases` at minimum

All three are build-time only. Missing any of them just skips source-map
upload with a build warning — it has never failed a build, on purpose.

## 4. Set up the two alerts that matter

Sentry doesn't alert on anything by default — an Issue just sits in the
dashboard until someone looks. Two Alert Rules (Sentry → Alerts → Create
Alert, scoped to this project) are worth setting up on day one:

**A. Any new error type** — "An issue is first seen" → notify (email,
Slack, whatever you use). Catches a genuinely new class of failure the
moment it happens, not the tenth time it's happened.

**B. Auth-failure spike** — every forged/failed Twilio signature, wrong
webhook secret, bad cron bearer token, or failed Meta webhook
verification reports to Sentry tagged `security_alert:true` and
`auth_failure_kind:<kind>` (see the full list below), each kind grouped
into its own Issue by a stable fingerprint. Create a rule: **"An issue is
seen more than 10 times in 10 minutes"**, filtered to
`security_alert:true` (Sentry's alert condition builder has a tag filter
for this), notify the same way. Ten failures of the same kind in ten
minutes is a real attempt at something (credential stuffing a Twilio
Auth Token, brute-forcing a webhook secret) — one or two is just a
misconfigured integration or a stale bookmark.

Kinds currently reported (`src/lib/monitoring.ts`):
`twilio_signature`, `voice_agent_callback`, `webhook_secret`,
`gmail_push_secret`, `cron_secret`, `meta_webhook_verify`.

## What is and isn't sent

- `sendDefaultPii` is off everywhere Sentry is initialized — no IP
  address, no user email, nothing by default.
- A shared `beforeSend` (`src/lib/sentryScrub.ts`) redacts anything that
  still looks like an email address or phone number out of exception
  messages and breadcrumbs, and strips request bodies, cookies, and query
  strings entirely, keeping only a short allowlist of headers
  (`user-agent`, `content-type`, `accept-language`).
- An auth-failure report never includes the credential/secret/signature
  that was tried — only which check failed and a route name or business
  id.
- None of this replaces judgment: don't paste a real error's stack trace
  or request payload into a shared channel without checking it yourself
  first — the scrubbing here is a backstop for what Sentry receives
  automatically, not a guarantee about every field a future
  `Sentry.captureException(err, { extra: {...} })` call might add.

## What this does NOT change

- Client-side error/trace beacons are tunneled through this app's own
  `/monitoring` route (via `tunnelRoute` in `next.config.ts`) rather than
  posting straight to Sentry's domain — no CSP change was needed for
  this (it's covered by the existing `connect-src 'self'`), and it means
  an ad-blocker won't silently eat error reports the way it does a direct
  `sentry.io` request.
- `app/error.tsx` and the new `app/global-error.tsx` both still show the
  same user-facing fallback UI as before; they now also report to Sentry
  in the background.
