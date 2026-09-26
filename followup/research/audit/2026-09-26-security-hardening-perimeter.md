# Security hardening: the perimeter (2026-09-26)

## In plain words

1. The browser now gets tighter rules. Origins nothing uses are gone from the Content-Security-Policy, the embed widget and the booking page each get their own narrower policy, and a few more protective headers are on. The landing page, sign-in, privacy, booking and embed pages were checked in a real browser with zero CSP errors.
2. A signed-in session now really ends a week after sign-in. Before, it was a week after the **last use**, so a cookie in steady use (including a stolen one) never expired.
3. More endpoints have rate limits: public booking, the two "run now" AI buttons, team invites and feedback. The limits are far above normal use. Rate-limit rows are now deleted after 14 days, so a flood can't grow that table forever.
4. Oversized requests are refused: any JSON body over 1 MB, and any text field far longer than real use.
5. Twelve newer database tables were missing Supabase's row-level security. A migration turns it on for all of them. The app itself is not affected.
6. No secrets are committed, now or in git history. `npm audit` finds one high-severity issue, only in the Prisma **CLI**, and it can't be reached at runtime. The fix is a major upgrade, so it's listed for you and not applied.
7. Some things only you can do, in the Vercel, Supabase, Google and Meta dashboards. They're in the checklist at the end.

**Scope and method**
- Branch `worktree-agent-a0e661c2e563f77ed`, from `main` at `8d48d7c` (#333).
- Read first: `2026-09-16-security-audit-auth-tenancy-and-api.md`, `2026-09-25-security-pass-live-channels.md`, `backend-backlog.md`. Items those reports already cover are only re-checked here, not found again.
- Application logic was out of scope (tenant isolation, route authz, webhook signatures, IDOR). A parallel pass covers that. Where I found something there, it's listed under "Handed over".
- Nothing was run against production, no `.env` was opened, and no dashboard setting was changed.

**Verification**
- `npx tsc --noEmit`, `npm run lint` and `npx vitest run` pass: 182 files, 2,172 tests.
- `rm -rf .next && npm run build` passes.
- The built app was started locally with a throwaway `NEXTAUTH_SECRET` and no database. Then:
  - curl confirmed the headers on each route family;
  - Playwright (Chromium at `/opt/pw-browsers/chromium`) loaded `/`, `/signin`, `/privacy`, `/book/x` and `/embed/x`, plus a page on a second origin that frames `/embed/x` and `/signin`;
  - locally minted session cookies were sent to `/api/auth/session`, `/dashboard` and `/signin`.
- The only console errors were the 500s from API routes that had no database to reach. That's the same before and after these changes.

---

## What changed vs. what's proposed

| # | Area | Tightened (committed) | Proposed / left for you |
|---|---|---|---|
| 1 | CSP | Removed unused origins: `js.stripe.com`, `api.stripe.com`, Stripe frames, `*.supabase.co`, `fonts.googleapis.com`, `fonts.gstatic.com`. One CSP header per response instead of two. Own policy for `/embed/*` (self-only, no eval, `frame-src 'none'`, `frame-ancestors *`). Own policy for `/book/*` (no eval, no Meta). | Drop `'unsafe-eval'` app-wide once WhatsApp Embedded Signup is tried without it on a preview. Nonce-based CSP to drop `'unsafe-inline'`. Narrow `img-src https:`. |
| 2 | Other headers | COOP `same-origin-allow-popups`. `X-Permitted-Cross-Domain-Policies: none`. 10 more Permissions-Policy opt-outs. CORP `same-origin` on `/api/*`. HSTS raised from 1 year to 2 years. | HSTS `preload`: needs your decision and the apex domain serving HSTS (checklist). |
| 3 | Rate limits | Booking POST (10/h per link, 60/h per business). Booking GET (120 per 10 min per link). `automation/run` and `sequences/run` (10 per 10 min). `team/invites` (30/h). `feedback` (10 per 10 min per person). RateLimitHit rows pruned after 14 days. | Sign-in and other IP-level limits: Vercel WAF (checklist). |
| 4 | Session | Absolute 7-day cap from sign-in (it was idle-only). Expired tokens carry no claims, not even email. | "Sign out everywhere" / server-side revocation (needs a schema column). |
| 5 | Input | 1 MB JSON body cap (413). Max lengths on every unbounded string in API schemas. Booking `scheduledAt` ≤ 64. | — |
| 6 | Cron | `/api/cron/office` uses the shared constant-time check. A sweep test covers all 12 cron routes. | — |
| 7 | Database | Migration: RLS on for every public table the migrating role owns. Test: future tables must enable it. | Run Supabase Security Advisor after deploy (checklist). |
| 8 | Dependencies | Nothing to apply: `npm audit fix` without `--force` changes nothing. | `deepmerge-ts` ≥ 8 via Prisma: a major version (below). |
| 9 | Secrets | Clean (below). | Confirm `TOKEN_ENCRYPTION_KEY` is set in Production (checklist), then fail closed in code (handed over). |

---

## 1. Headers and CSP

**Before** (`next.config.ts` at `8d48d7c`)
- One policy everywhere, with `'unsafe-inline' 'unsafe-eval'`.
- Allowed Stripe script, connect and frame origins, Supabase, and Google Fonts.
- Every response carried two `Content-Security-Policy` values. Next keeps the last one set for a repeated key (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`, "Header Overriding Behavior"), so this worked, but only by accident.
- `/embed/*` got the full app policy plus `frame-ancestors *`.

**Why the removed origins were safe to remove**
- **Stripe:** Checkout and the Portal are opened with `window.location.assign(data.url)` (`src/app/(app)/settings/page.tsx`, `handleSubscribe`/`handleManageBilling`). That's a top-level navigation, which CSP doesn't restrict. There's no Stripe.js or Stripe frame anywhere in `src`.
- **Supabase:** there's no browser client. Prisma talks to Postgres from the server.
- **Google Fonts:** `next/font/google` self-hosts the files at build time (`src/lib/fonts.ts`). The one runtime fetch is server-side, in `src/app/opengraph-image.tsx`.
- **Confirmed in the browser:** Playwright recorded **zero** requests to any other origin on every page checked.

**Why `'unsafe-eval'` stays on the app policy**
- Next and React don't need it in production (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`, "Good to know").
- The built client bundle has no `eval(` or `new Function(`. The only `Function(...)` calls are `globalThis` and regenerator fallbacks that modern browsers never reach.
- Meta's JS SDK is the unknown. It's loaded only for WhatsApp Embedded Signup (`src/lib/useWhatsAppSignup.ts`).
  - A web search result says it uses `eval`. That's a secondary source.
  - `connect.facebook.net` is egress-blocked from this sandbox, so I couldn't check the SDK itself.
- Signup is the WhatsApp go-live path, so I didn't gamble on it.
- A CSP belongs to the document. Removing eval only on "public" pages is only safe where no client-side navigation can lead into Settings.
  - That holds for `/book/*` and `/embed/*`, so both now run without eval.
  - It doesn't hold for `/` or `/signin`: a signed-in visitor can soft-navigate from there to `/dashboard` and on to Settings.

**Proposed:** on a Vercel preview, remove `'unsafe-eval'` from `appCsp` and run WhatsApp Embedded Signup end to end. If it completes with no console error, remove it for good.

**COOP `same-origin-allow-popups`**
- It cuts the opener link to any cross-origin page that opened FollowUp, but keeps popups FollowUp opens itself. Meta's signup popup reports back through `postMessage` to `window.opener`.
- A Meta developer-forum thread reports that exactly this value fixed `FB.login`, where `same-origin` broke it. That comes from the search-result summary; the thread itself wasn't opened.
- Plain `same-origin` was rejected for that reason.

**CORP `same-origin`** is on `/api/*` only.
- It affects only no-cors loads from other sites (`<img>`/`<script>` tags). It doesn't affect navigations, same-origin fetches or server-to-server webhooks.
- Pages and static assets were left alone. Emails and customer sites may load images from the domain.

**Permissions-Policy**
- Added: `serial`, `hid`, `midi`, `accelerometer`, `gyroscope`, `magnetometer`, `display-capture`, `xr-spatial-tracking`, `browsing-topics`.
- `bluetooth` was tried and removed, because Chromium logs "Unrecognized feature: 'bluetooth'" on every page.

**Still open (proposed, not applied)**
- **`'unsafe-inline'` in `script-src`.** The documented fix is per-request nonces through a `proxy.ts`. That makes every page dynamically rendered, so the landing, privacy and terms pages lose static optimization (same guide, "Static vs Dynamic Rendering with CSP"). The Vercel Toolbar script, injected by Vercel, would also need handling. That's a product/performance trade, not a header tweak.
- **`img-src 'self' data: blob: https:`.** Lead avatars can come from Google, Meta and Instagram CDNs with changing hostnames. Narrowing this blind risks broken images. The first step is to log image origins for a week.
- **Embed `frame-ancestors *`.** A per-business allowlist of the customer's own domains would stop someone else's site framing the widget. That's a product feature (a Settings field), not a header change.

## 2. Rate limiting

All limits use the existing atomic limiter (`src/lib/rateLimit.ts`: `pg_advisory_xact_lock` plus count-and-insert in one transaction). They're keyed per business, because `RateLimitHit.businessId` is a required foreign key.

**Added**

| Endpoint | Key | Limit | Why |
|---|---|---|---|
| `POST /api/book/[leadId]` | `book.create:<leadId>` and `book.create` | 10/h per link, 60/h per business | One link could otherwise take every open slot and write a Calendar event for each. This closes the "unlimited" half of M-2 (09-16). An unknown link still answers 409 with the same text. |
| `GET /api/book/[leadId]` | `book.view:<leadId>` | 120 per 10 min | Each read can call Google Calendar free/busy on the business's own quota. |
| `POST /api/automation/run`, `/api/sequences/run` | per business | 10 per 10 min | One click runs a whole business's worth of AI drafting on the shared OpenAI key. |
| `POST /api/team/invites` | per business | 30/h | Each invite can send an email from the business's mailbox. Email is also capped at 320 characters. |
| `POST /api/feedback` | `feedback:<userId>` | 10 per 10 min | Rows are later read into the founder's office notes. |

**Already present (re-checked):** embed 20/10m, lead webhook 100/10m, `leads.create`, `send`, `regenerate`, `import`, `test-lead`, `cleanup`, Gmail and Outlook sync, `scan-spam`, `reactivation/classify`, `approvals/send-safe`, alerts, `instagram/facebook subscribe`, WhatsApp re-judge.

**Retention, new**
- Every attempt writes a row, including over-limit ones (by design, so a sustained flood stays blocked). Nothing deleted rows except erasing a whole business.
- `pruneRateLimitHits()` now runs in the hourly cron and deletes rows older than 14 days. That's twice the longest window in use: the weekly digest's 7-day "already sent" claim.
- `rateLimitRetention.test.ts` reads every `windowMinutes:` in `src`. A longer window added later fails CI.

**Not possible with this helper**
- **Sign-in** (`/api/auth/*`): there's no business yet, and the limiter needs one. Google does the credential check. Use a Vercel WAF rule (checklist).
- **`/api/access-request`**: it's platform-admin only now, not public.
- **"Classifier eval"**: it has no HTTP route; it isn't reachable from outside.
- **Twilio and Meta inbound**: they are signature-verified. Per-message AI spend on SMS is handed over (below).

## 3. Session and cookies (next-auth 4.24.15, JWT strategy)

**Found: the "7-day" session was an idle timeout**
- `core/routes/session.js` re-encodes the JWT with a fresh `maxAge` on every session read.
- `SessionProvider` (`src/components/AuthProvider.tsx`) reads the session on each page load and window focus.
- So an actively used cookie never expired, whether the owner's or a copy.

**Fixed** (`src/lib/auth.ts`)
- The `jwt` callback now returns `{ expired: true }` once `authTime` is more than 7 days old. Nothing else survives on that token, not even the email that `isPlatformAdmin()` and `/api/office/run` read.
- It returns before the "look the user up by email" branch, which would otherwise hand the claims back.
- The `session` callback then returns `{}`. Both `getServerSession` and `next-auth/react` treat that as signed out.
- Tokens without `authTime` were minted before #117 (2026-09-08). They get one forced re-sign-in.
- A step-up re-auth is a real Google round trip, so it restarts the week.
- Tested in `auth.test.ts` (7 new cases) and end to end against the built app:
  - a 1-day-old sign-in returns the session;
  - an 8-day-old one, or one with no `authTime`, returns `{}`;
  - `/dashboard` redirects to `/signin`, and `/signin` renders (no redirect loop).
- **Behaviour change:** everyone signs in with Google once a week. To change that, edit `SESSION_ABSOLUTE_MAX_AGE_MS`.

**Checked and sound**
- **Cookie flags:** next-auth defaults. `httpOnly`, `SameSite=Lax`, and `Secure` with the `__Secure-`/`__Host-` prefixes whenever the base URL is https (`core/lib/cookie.js`, `core/init.js`).
- **Lax is correct here:** `Strict` would drop the session on the Google redirect back and on every email-link arrival.
- **Origin:** with `NEXTAUTH_URL` unset on Vercel, next-auth trusts `x-forwarded-host` (`utils/detect-origin.js`). Setting `NEXTAUTH_URL` in Production pins it (checklist).
- **Redirects:** the default `redirect` callback only allows same-origin targets, and it isn't overridden.
- **JWT:** it's JWE-encrypted with `NEXTAUTH_SECRET`, which is required in production.

**Proposed:** real revocation ("sign out everywhere", or kill a stolen session now).
- `signOut` only clears the cookie in that browser. A copied JWT stays valid until the 7-day cap.
- The fix: a `User.sessionsValidAfter` column, checked in the existing 5-minute revalidation, and set from a "sign out everywhere" button.
- That's a schema change plus a product decision, so it's not applied.

## 4. Dependencies (`npm audit`, 2026-09-26)

| Package | Severity | Path | Reachable? | Fix |
|---|---|---|---|---|
| `deepmerge-ts` < 8.0.0 ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), CVE-2026-40345) | High | `prisma` (CLI) → `@prisma/config` 6.19.3 → `deepmerge-ts` 7.1.5 | **No.** The trigger is merging two self-referential object graphs. Only the Prisma CLI's config loader uses it, on developer-authored config, at build time. `@prisma/client` doesn't depend on it, and no request data reaches it. | None within the current majors. Even the newest `@prisma/config` pins `deepmerge-ts` 7.1.5. npm's only offer is `--force` (a Prisma downgrade that breaks CLI/client parity). **Major upgrade for you:** a Prisma release that moves to `deepmerge-ts` 8, or an npm `overrides` bump to `deepmerge-ts@^8` (a major). |

`npm audit fix` without `--force` changes nothing, so nothing was applied.

## 5. Input limits

**Body size**
- Next.js route handlers have no body limit of their own; `bodySizeLimit` is for Server Actions.
- Vercel caps function payloads at 4.5 MB.
- `parseJsonBody` now answers **413** when the declared `Content-Length` is over **1 MB**, before reading anything. The largest real body is a few KB.
- A chunked body with no length still hits Vercel's cap, plus each schema's per-field caps.

**Field lengths:** every previously unbounded `z.string()` in the API schemas now has a generous max.
- Workflow step hint: 4,000. It goes into the OpenAI prompt on every draft.
- Manual send: 50,000 message, 1,000 subject.
- Names: 200.
- Pasted credentials: 64–4,096.
- Outbound webhook URL: 2,048.

**Public inputs**
- The embed form and lead webhook already clamp every field (`cleanedText`).
- Booking `scheduledAt` is now ≤ 64.
- `unsubscribe` is an HMAC token.
- The Meta, Twilio, Stripe and Gmail webhooks are signature- or secret-gated first.

## 6. Secret hygiene

- **Tracked env files:** only `followup/.env.example` and `followup/.env.local.example`. In history, also `automations/.env.example`.
- **`.gitignore`:** ignores all env files except those two templates.
- **Full-history scan:** `git log --all -p`, 492 commits. I looked for Stripe, OpenAI, AWS, Google API and OAuth-secret, Slack, GitHub, private-key, Meta-token, Twilio SID/key, Sentry DSN, Postgres-URL-with-password and `NAME=value` shapes for the app's secret variables. Four hits, all placeholders:
  - `.env.local.example`: a localhost dev URL;
  - `.env.example`: a `postgres.xxxxx` template;
  - `docs/least-privilege-db-role.md`: a `<PASSWORD>` placeholder. It names the Supabase project ref, which is an identifier, not a secret;
  - `.github/workflows/ci.yml`: a dummy `NEXTAUTH_SECRET` that says it isn't real.
- **`NEXT_PUBLIC_*`:** only `SENTRY_DSN` (public by design), `SITE_URL` and `VERCEL_ENV`.
- **Client bundle:** the built `.next/static` has no server secret variable names.
- **Client imports:** every `@/lib` module imported by a `"use client"` file is either type-only or free of Prisma and server env (checked: `admin-data`, `analytics-data`, `pendingApprovals`, `pipeline`, `metaWindow`, `spotCheck`, `approvalGroups`, and others).
- **Not done:** a `server-only` import guard. It would need the `server-only` package to resolve under vitest, and new dependencies were out of scope.

## 7. Database perimeter (new finding)

**Finding**
- `docs/least-privilege-db-role.md` (2026-09-08) records that every table had RLS enabled with no policies. That's what keeps Supabase's Data API (`anon`/`authenticated`) out.
- 12 tables created by migrations since then have no `ENABLE ROW LEVEL SECURITY`: AccessRequest, AgentRole, AgentRun, AgentTask, InboundWebhookEvent, OutboundSend, OwnerAlert, ProcessedWebhookEvent, PushSubscription, ReactivationRun, SendClaim, Suppression.
- Only `AuditEvent` did it itself (`20260907090000_audit_event`).
- Unless someone enabled RLS by hand, these tables are readable through the public API by anyone holding the project's anon key. They include push endpoints and keys, opted-out emails and phones, raw inbound message payloads and outbound bodies.
- FollowUp never ships the anon key, which is the only reason this is **Medium** and not High.

**Fixed:** migration `20260926090000_enable_rls_all_public_tables`.
- It enables RLS on every public table that is still without it **and** owned by the migrating role.
- It's idempotent. It skips, rather than fails on, anything owned by another role, so it can't block future migrations. It adds no policies.
- The app is unaffected. It connects as the table owner or as `followup_app` (BYPASSRLS), and the older RLS tables already prove that path.
- `migrationsRls.test.ts` fails CI if a later migration creates a table without enabling RLS.
- **Not executed against a live Postgres here:** no non-root Postgres was available. It runs on the next deploy's `prisma migrate deploy`.

## 8. Handed over (application logic, outside this pass)

- **Upstream error text echoed to clients** (L-3 from 09-16, still open, about 30 sites): `twilio/number:58,98`, `billing/checkout:134`, `billing/portal:36`, `gmail/filtered/[id]/restore:92`, `leads/[id]/regenerate:127`, the OAuth callbacks' `?message=` parameter, `automation/run`, `sequences/run`.
  - Several lib errors are deliberately user-facing, so the fix is per call site: map known errors, log and genericise the rest.
  - Owner: backend-ai-agent.
- **Booking, the rest of M-2 (09-16):** only one confirmed future booking per lead, and return first name only from `getBookingContext` (`src/lib/booking.ts:65-72`). Both change what the lead sees. Owner: backend.
- **M-3 (09-16), `TOKEN_ENCRYPTION_KEY` fails open** (`src/lib/crypto.ts:25-37`).
  - Fail closed in production **after** you confirm the variable is set in Vercel Production. If it isn't, fail-closed breaks every integration connect.
- **SMS/WhatsApp scoring is capped per lead per month, not per message** (09-25 F2, last bullet). One lead texting in a loop still triggers AI calls. Owner: backend (billing gate).

---

## Founder checklist: dashboards only you can change

**Vercel**
1. **Environment:** in *Production only*, set `NEXTAUTH_URL=https://www.followupbase.io`. That pins the auth origin instead of trusting the forwarded host. Leave Preview unset so preview sign-in keeps working.
2. **Environment:** confirm `TOKEN_ENCRYPTION_KEY` (32 bytes, base64), `NEXTAUTH_SECRET` and `CRON_SECRET` are set in Production. Then tell backend to make `crypto.ts` fail closed.
3. **Firewall → WAF custom rules (rate limit, by IP):**
   - `/api/auth/*` about 30/min;
   - `/api/embed/*` and `/api/book/*` about 60/min;
   - `/api/webhooks/lead/*` about 120/min.
   - Start each on **Log** for a few days, then switch to **429**.
4. **Firewall → Bot protection:** turn on the managed bot ruleset. **Before you do,** add **bypass** rules for Stripe, Twilio, Meta and Google Pub/Sub webhooks (`/api/billing/webhook`, `/api/twilio/*`, `/api/instagram/webhook`, `/api/whatsapp/webhook`, `/api/integrations/gmail/push`) and for Vercel Cron (`/api/cron/*`).
5. **Attack Challenge Mode:** know where the switch is, and only turn it on during an attack. It's free on all plans and lets known bots through, but check that your webhooks still arrive while it's on.
6. **Account:** 2FA on the Vercel account. Review team members and deploy hooks.
7. **Deployment Protection:** keep Preview deployments behind Vercel Authentication. Previews run the same code against whatever env Preview has.

**Supabase**
8. **After the next deploy:** open *Advisors → Security Advisor* and confirm "RLS disabled in public" shows nothing. If any table remains, it's owned by a role other than `postgres`: enable RLS on it by hand.
9. **If nothing uses the Data API:** in API settings, remove `public` from the exposed schemas, or turn the Data API off. FollowUp only uses Prisma. Don't paste the anon or service key anywhere.
10. **Confirm `followup_app` has grants on the 12 newer tables**, if `DATABASE_URL` uses it.
11. **Network restrictions:** only useful with fixed egress IPs (Vercel Secure Compute). With normal Vercel functions the IPs change, so an allowlist would cut off the app. Leave it open unless you move to static IPs.
12. **Account:** 2FA on the Supabase account, and rotate the database password if it has ever been in a local `.env` on a shared machine (L-7, 09-16).

**Google Cloud (OAuth client)**
13. **Authorized redirect URIs:** only the production callbacks (`https://www.followupbase.io/api/auth/callback/google`, `/api/integrations/gmail/callback`). Use a separate OAuth client for localhost development.
14. **Account:** 2FA / passkey on the Google account that owns the project. It also signs you into FollowUp.

**Meta (developers.facebook.com)**
15. **Settings:** App → Settings → Basic → *App Secret Proof* on. OAuth redirect URIs limited to production. Remove test users you don't need.
16. **Tokens:** use a system-user token for WhatsApp, not the 24-hour test token (09-25). 2FA on the Business Manager admin accounts.

**Stripe, Twilio, GitHub**
17. **2FA** on each.
18. **Stripe:** restrict the secret key to the resources FollowUp uses (a restricted key).
19. **Twilio:** keep Geo Permissions (SMS/voice) to the countries you serve.
20. **GitHub:** keep branch protection on `main`, and turn on secret scanning with push protection.

**HSTS preload (decide first)**
21. Adding `preload` puts `followupbase.io` **and every subdomain** HTTPS-only in browsers. Removal takes months. It also needs the bare domain `followupbase.io` to send the HSTS header itself, which Vercel's apex→www redirect currently doesn't do from this app's config. If you want it: make the apex serve `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, add `preload` in `next.config.ts`, then submit at hstspreload.org. (hstspreload.org was egress-blocked from this sandbox. The two-year value is its widely documented recommendation, not re-read today.)

---

## Sources (checked 2026-09-26)

**Code**
- `next.config.ts`, `src/lib/auth.ts`, `src/lib/rateLimit.ts`, `src/lib/validation.ts`, `src/lib/booking.ts`, `src/lib/crypto.ts`, `docs/least-privilege-db-role.md`, `prisma/migrations/**`. Commit `8d48d7c`, then this branch.

**Next.js 16.3.5 bundled docs** (`node_modules/next/dist/docs/`)
- `01-app/02-guides/content-security-policy.md`: `unsafe-eval` isn't needed in production; nonces require dynamic rendering.
- `01-app/03-api-reference/05-config/01-next-config-js/headers.md`: the last value wins for a repeated key.

**next-auth 4.24.15 source** (`node_modules/next-auth/`)
- `core/routes/session.js`: the JWT is re-issued with a fresh `maxAge` on every session read.
- `core/lib/cookie.js`: cookie flags.
- `utils/detect-origin.js`: `VERCEL` means trust the forwarded host.
- `next/index.js`: `getServerSession` returns null for an empty body.

**External**
- [GitHub Advisory GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): `deepmerge-ts` < 8.0.0, High, published 2026-08-16. Needs recursive object graphs.
- `npm view @prisma/config@latest dependencies`: pins `deepmerge-ts` 7.1.5 (run 2026-09-26).
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations) and [FUNCTION_PAYLOAD_TOO_LARGE](https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE): 4.5 MB request body.
- Vercel [WAF custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Bot management](https://vercel.com/docs/bot-management) and [Attack Mode](https://vercel.com/docs/vercel-firewall/attack-challenge-mode). Read from search-result summaries, not opened.
- Supabase [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [Network restrictions](https://supabase.com/docs/guides/platform/network-restrictions) and [Security Advisor: RLS disabled in public](https://supabase.com/docs/guides/database/database-advisors?lint=0013_rls_disabled_in_public). Read from search-result summaries.
- [MDN: Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy), and a [Meta developer-forum thread](https://developers.facebook.com/community/threads/1230124084802751/) reporting that `same-origin-allow-popups` fixed `FB.login`. The thread is known only from the search-result summary.
- The claim that Meta's JS SDK needs `unsafe-eval` is from a secondary source ([javaspring.net](https://www.javaspring.net/blog/facebook-javascript-sdk-and-csp/)). It's unverified, which is why eval was kept.
