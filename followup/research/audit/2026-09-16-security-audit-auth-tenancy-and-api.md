# Security audit — auth, multi-tenancy, and the API surface

**Date:** 2026-09-16. **Branch audited:** `claude/followup-demo-to-production-4k39hr` (working tree; `origin/main` at `7abc135`).
**Scope:** every route under `src/app/api/**` (91 route files), the session/auth layer, the public
surfaces (`/book/[leadId]`, `/embed/[businessId]`, `/api/unsubscribe`, all `[secret]` webhooks), input
validation, rate limiting, secrets posture, and data export/erasure. Report only — nothing under
`src/` was changed. No server actions exist (`"use server"` grep is empty); there is no `middleware.ts`.
**Method:** first-hand read of every route and the libs they call; `git log -15 origin/main` bodies
and `research/audit/backend-backlog.md` read first so fixed items are confirmed, not re-found.
Line numbers are from the working tree as of this date.

---

## 0. This month's fixes — confirmed in place (no regressions)

| Fix claimed on main | Verified at |
|---|---|
| CSRF `state` on every OAuth callback | Random 24-byte state in httpOnly/secure/lax 10-min cookie, compared on callback: `facebook/oauth/{start:17-20,callback:31-43}`, `instagram/oauth/{start:24-27,callback:17-29}`, `integrations/gmail/{connect:22-29,callback:17-36}`, `integrations/outlook/{connect:18-25,callback:19-36}`. `next` rides in its own cookie, never in `state`. Tests: `__tests__/oauthCsrf.test.ts:49-78`. |
| SSRF on outbound webhooks | `src/lib/ssrf.ts` (IP literal + DNS all-addresses + IPv6/mapped + fail-closed); applied at save (`webhooks/outbound/route.ts:69`), before every real fire (`src/lib/outboundWebhook.ts:50`), and before the test-fire (`:115`); `redirect: "manual"` both places. Only admins can set/fire it (`:49-50, 98-99`). |
| Atomic rate limiters | `src/lib/rateLimit.ts:24-39` — count + insert inside one `pg_advisory_xact_lock` transaction. Test `rateLimit.test.ts:42-76`. |
| zod on every body | Every JSON-body route goes through `parseJsonBody`/`parseObject` (`src/lib/validation.ts`) except `office/run` (manual `typeof` check, platform-admin only) and `leads/import` (multipart; 2 MB / 1000-row caps at `:12-13,68-104`). |
| Cleanup-route guards | `leads/cleanup/route.ts:43` admin, `:59-65` paid-only, `:85` 2/hour, `:76,154` batch of 200, `:133-146` `deletable` filter, `:233` `deleteLeadCascade(lead.id, ctx.businessId)`. |
| Team-invite race | `src/lib/auth.ts:105-142` — lookup, upsert and `deleteMany` in one transaction. Test `auth.test.ts:158`. |
| Prompt-injection defence | `src/lib/integrations/openai.ts:65-102` — delimiter neutralised inside lead text, `<lead_conversation>` wrapper, `UNTRUSTED_CONVERSATION_NOTICE` at all seven lead-text prompt sites (`:241,587,686,934,1113,1219` + the risk gate). |
| Voice-bridge auth | `src/lib/twilio.ts:279-292` timing-safe bearer, fails closed if unset; bridge calls `voice-agent-auth` before opening OpenAI (`voice-agent/api/stream.js:140-147`); `voice-agent-auth/[secret]/route.ts:44-58` requires bearer + real business + agent enabled + active billing. Tests `voiceAgentAuth.test.ts:43-85`. |
| Twilio status-callback cross-tenant write (#248) | `twilio/status/[secret]/route.ts:60-62` — `updateMany` scoped through `conversation.lead.businessId`. |
| Outbound-webhook admin gate (#242) | `webhooks/outbound/route.ts:49-50, 98-99`. |

---

## 1. Findings, ranked

### H-1 — Right-to-erasure fails with a foreign-key violation for any business that has a consent record or a reactivation run, after Stripe has already been cancelled

**Where.** `src/lib/businessData.ts:181-215` deletes 21 tables but never `Suppression` or
`ReactivationRun`. Both carry a required FK to `Business` with no `onDelete`
(`prisma/schema.prisma:226, 280`), and the migrations create them `ON DELETE RESTRICT`
(`prisma/migrations/20260915190000_email_suppression/migration.sql:35-36`,
`prisma/migrations/20260915180000_reactivation_run/migration.sql:39-40`). The Stripe cancellation runs
*before* and *outside* the transaction (`businessData.ts:170-179`). The route does not catch
(`src/app/api/business/delete/route.ts:61`), so Prisma's `P2003` becomes a 500.

**Steps (customer, not attacker).** (1) Any lead of the business clicks one-click unsubscribe
(`/api/unsubscribe` → `suppress()`, `suppression.ts:212-224`) or DMs "STOP" on Instagram/Messenger
(`inbound/meta.ts:95`) — one `Suppression` row now exists. (2) Admin re-authenticates and posts the
business name to `/api/business/delete`. (3) `subscriptions.cancel` succeeds. (4)
`prisma.business.delete` throws `P2003`; the whole `$transaction` rolls back. (5) Response is 500;
retrying does the same forever.

**Impact.** Erasure is broken for precisely the businesses that honoured an opt-out (the most
compliance-relevant ones); billing is cancelled while every lead, message and credential stays. The
mocked test suite cannot see this — `businessData.test.ts` mocks Prisma wholesale (`:81-141`), so a
missing table never fails a test. Both tables were added on 2026-09-15 (`#247`, `#248`) after
`deleteBusinessData` was written; nothing forces the two lists to stay in step.

**Related gaps, same fix window.** (a) Meta envelopes are stored with `businessId: null`
(`instagram/webhook/route.ts:86-91`) and hold IGSIDs/PSIDs and DM text; erasure's
`inboundWebhookEvent.deleteMany({ where: { businessId } })` (`businessData.ts:208`) cannot reach them —
they persist up to 14/90 days (`inboundEvents.ts:240-245`). (b) `AuditEvent.meta` retains lead
names/emails after erasure — `lead.cleanup_deleted` writes `{ name, email }` (`leads/cleanup/route.ts:237-240`),
`email.unsubscribed` writes `{ address }` (`unsubscribe/route.ts:109-112`) — deliberate per
`businessData.ts:217-220`, but it is PII surviving a GDPR Art. 17 request and should be a documented
decision with a scrub-on-erasure of `meta`. (c) Export (`businessData.ts:53-149`) omits `Suppression`,
`FilteredEmail` (sender names/emails), `OutboundSend` (message bodies), `AIInsight`, `ReactivationRun` —
all personal data under the access right.

**Patch.** Add `prisma.suppression.deleteMany({ where: { businessId } })` and
`prisma.reactivationRun.deleteMany({ where: { businessId } })` before `user.deleteMany`
(`ReactivationRun.stoppedById` references `User`). Run the DB transaction first, cancel Stripe after
(or cancel, then on DB failure log loudly and surface — never the current silent half-state). Scrub
`AuditEvent.meta` PII for the business on erasure. Add the missing tables to export.

**Test that proves it.** A schema-driven test: read `Prisma.dmmf.datamodel.models`, collect every model
with a `businessId` field relating to `Business`, run `deleteBusinessData` against the mock, and assert a
`deleteMany`/`delete` was issued for each — so the next table added on `Business` fails CI unless it is
also erased. Plus one integration test on a real Postgres (`prisma migrate deploy` in CI already exists
for the build) that seeds a Suppression row and asserts deletion succeeds.

---

### H-2 — Any business admin can pre-claim an email address; that person's first sign-in silently lands them inside the attacker's workspace, with no consent step and no way to leave

**Where.** `src/lib/auth.ts:105-142` — a brand-new (or team-less) email is joined to
`tx.invite.findFirst({ where: { email } })` and the invite is consumed, with no acceptance link, no
token, no expiry, no ordering (`findFirst` with several invites for one email is arbitrary — the
`@@unique` is `[businessId, email]`, `schema.prisma:995`). `inviteMember` (`team.ts:142-172`) only checks
the address is not already in a business. `removeMember` is admin-only and refuses self-removal
(`team.ts:216`), so the victim cannot leave. In production `ALLOWED_EMAILS` is meant to be empty
(`auth.ts:23-25`), i.e. open signup.

**Steps.** Attacker (admin of business B) posts `{ email: "victim@co.com" }` to `/api/team/invites`
(needs only active billing on B). Nothing is sent to the victim unless B has Gmail connected, and even
then the mail says "sign in and you'll be added automatically" (`team.ts:130`). Weeks later the victim
signs up for FollowUp. They are now a SALES member of B: their dashboard is B's, and anything they enter
— manual leads (`POST /api/leads`, no admin gate), a CSV import (`/api/leads/import`, no admin gate), a
test lead carrying their own email, saved views — is written into B's tenant and visible to B's admin.
Onboarding is skipped because B is already onboarded (`(app)/layout.tsx`).

**Impact.** Tenant capture of a new user by a stranger; leads the victim thinks are theirs belong to
someone else; the victim has no exit. This is the one place the multi-tenant boundary is decided by an
unauthenticated third party's prior action rather than by the signed-in user.

**Patch.** Make acceptance explicit: invite email carries a signed token link (`/invite/[token]`); the
sign-in callback never auto-joins — it creates the user's own business unless an `invite_token` cookie
set by that link is present and matches. Expire invites (7 days). If auto-join must stay for now: on
first sign-in with a pending invite, render "You've been invited to join *B* — Join / Create my own
workspace" before any business is assigned, and let a member leave a team.

**Test.** `auth.test.ts`: "a brand-new email with a pending invite it did not arrive through gets its own
business and the invite remains"; "two invites for one email never join silently".

---

### M-1 — The Instagram, Gmail and Outlook OAuth *callbacks* do not check admin; a SALES teammate can complete the flow by minting the state cookie in their own browser

**Where.** Only the *start* routes are admin-gated (`instagram/oauth/start:17`, `gmail/connect:19`,
`outlook/connect:15`). The callbacks check the session alone: `instagram/oauth/callback/route.ts:9-11`,
`integrations/gmail/callback/route.ts:10-11`, `integrations/outlook/callback/route.ts:12-13`. The
Facebook callback is the one that does it right (`facebook/oauth/callback/route.ts:21-25`).

**Steps (SALES user).** Set cookie `ig_oauth_state=abc` in devtools (httpOnly only stops scripts, not the
cookie's owner). Open Instagram's authorize URL with `client_id=<app id>` (public — it is even in a code
comment, `src/lib/instagram.ts:13`), `redirect_uri=<app>/api/instagram/oauth/callback`, `state=abc`.
Approve with *their own* Instagram account. The callback writes `instagramAccessToken` +
`instagramUserId` onto the business (`callback:39-42`), replacing the real connection: the business's
Instagram DMs now route through, and outbound DMs are sent from, the attacker's account. Same for Gmail:
`exchangeCodeForTokens(code, ctx.userId)` stores an `Integration` under the SALES user (`gmail.ts:175-200`)
and the business picks *any* connected user's mailbox (`getGmailIntegration`, `gmail.ts:113-118`), so
business sends/syncs can start flowing through a rep's personal mailbox.

**Impact.** SALES → admin-only privilege on integrations; integration hijack. The admin gate on start is
decorative for three of four providers.

**Patch.** `if (!(await requireAdmin(ctx))) return fail("Only an admin can connect …")` in all three
callbacks (mirror Facebook). Bind state to the session so a self-minted cookie cannot pass: store
`HMAC(NEXTAUTH_SECRET, state + ":" + ctx.userId)` and verify it on callback, or keep the state
server-side keyed by userId.

**Test.** Extend `oauthCsrf.test.ts`: "callback refuses a SALES session even when state matches the
cookie"; "callback refuses a state cookie that was not issued to this user".

---

### M-2 — Public booking endpoint: unlimited unauthenticated slot creation, and it returns the lead's full name

**Where.** `src/app/api/book/[leadId]/route.ts:34-44` (POST; zod only), `src/lib/booking.ts:124-197`
(no per-lead cap, no rate limit), `getBookingContext` (`booking.ts:65-72`) returns `lead.name` whole.
Lead ids are cuids (`schema.prisma:344`) and leave the tenant legitimately: in every booking link, in the
outbound-webhook payload (`outboundWebhook.ts:54`), and in the `/api/webhooks/lead` response (`:131`).

**Steps.** Holder of one link: `GET /api/book/<id>` → all open slots for 10 days; `POST` each one (~160
requests). Every slot is now booked, each creating a real Google Calendar event on the business's
connected calendar (`booking.ts:179`) and moving `nextFollowUp`; no other lead can book. The slot list
also exposes when the business is busy (Google busy blocks are subtracted, `:103-113`).

**Impact.** Calendar denial-of-service/pollution and mild disclosure (full name, availability). Not
cross-tenant; the id is the credential by design.

**Patch.** Rate-limit POST per business via the existing atomic limiter (e.g. 10/hour); allow one
confirmed future booking per lead (refuse or replace); return first name only.

**Test.** `booking.test.ts`: "refuses a second confirmed future booking for the same lead"; route test:
"returns 429 after the cap".

---

### M-3 — `TOKEN_ENCRYPTION_KEY` absent fails *open*: third-party credentials are stored in plaintext with one console warning; the onboarding example documents the opposite

**Where.** `src/lib/crypto.ts:25-37` returns `null` and `encryptSecret` returns the plaintext
(`:47-50`). `.env.local.example:97-98` says a blank key means "connecting Gmail … will fail to store the
token" — it does not; it stores it unencrypted. (`NEXTAUTH_SECRET` is the good example: next-auth
refuses to start in production, `node_modules/next-auth/src/core/lib/assert.ts:60-61`, and the
unsubscribe signer throws, `suppression.ts:128-129`.)

**Impact.** A production deploy missing the variable silently persists Gmail refresh tokens, Twilio
auth tokens, Meta page tokens and CRM keys in plaintext, and nothing alerts.

**Patch.** In `loadKey()`, when `NODE_ENV === "production"` and the key is missing, throw (fail
closed) and `recordAuthFailure`-style report to Sentry; fix the example comment.

**Test.** `crypto.test.ts`: "encryptSecret throws in production when TOKEN_ENCRYPTION_KEY is unset".

---

### M-4 — Customer lead names flow into the founder's team-wide Slack

**Where.** `src/lib/scoring.ts:131` posts `lead.name` + `lead.company` + the score reason to the single
`SLACK_WEBHOOK_URL`. `src/lib/slack.ts:7-16` already says this must change "before onboarding anyone
outside the team" — this audit is that moment.

**Impact.** Every real customer's hot leads are announced, by name, in an internal channel the customer
has never heard of.

**Patch.** Drop the name/company from the Slack line (business id + "a lead became hot" is enough for
ops), or make it a per-business setting. **Test:** `slack.test.ts` — "the hot-lead notice contains no lead
name/company/email".

---

### L-1 — Two bearer/query secret comparisons are not timing-safe; one commit body says only one remains

`src/lib/cronAuth.ts:18` (`auth !== \`Bearer ${secret}\``), the duplicated inline copy in
`src/app/api/cron/office/route.ts:22-25` (which also skips `recordAuthFailure`), and
`integrations/gmail/push/route.ts:37` (`!==` on the query secret). Commit `9168c62` (#248) states "the
Gmail push secret is the one comparison left in the codebase that isn't timing-safe" — the two cron
sites were missed. Network jitter makes exploitation impractical, hence Low, but it is cheap to close:
a shared `timingSafeEqualStrings()` in `crypto.ts`, and route `cron/office` through `requireCronSecret`.
**Test:** `cronAuth.test.ts` — "compares with timingSafeEqual (spy)".

### L-2 — `DELETE /api/leads/[id]` is open to SALES and passes no tenant to the cascade

Ownership is checked (`leads/[id]/route.ts:17-20`), so no cross-tenant bug, but any rep can
irreversibly delete any lead while the bulk cleanup is admin-only (`cleanup:43`), and `:22` calls
`deleteLeadCascade(id)` without `ctx.businessId` — the one call site that leaves the last-line tenant
guard (`leads-admin.ts:23-25`) unused. Decide the role policy; pass the businessId regardless.

### L-3 — Upstream error text echoed to clients

`leads/[id]/regenerate/route.ts:101-102` (OpenAI), `gmail/filtered/[id]/restore/route.ts:69-71`
(importer), `twilio/number/route.ts:58,98` (Twilio API), `billing/checkout/route.ts:118` (Stripe).
Information leak only; map to fixed messages and log the original.

### L-4 — Office runner feeds cross-tenant free text to a model without the untrusted framing

`src/lib/office/context.ts:43-76` puts `ProductFeedback.message` from every business into the user turn
(`runner.ts:197-212`) with no `UNTRUSTED_CONVERSATION_NOTICE` (`openai.ts:102`). Output is a
founder-read note, so the blast radius is a misleading note — but any customer can type the payload.
Wrap it the same way lead text is wrapped.

### L-5 — Content-Security-Policy is deliberately loose

`next.config.ts:24-35`: `script-src 'unsafe-inline' 'unsafe-eval'`, `img-src https:`; HSTS without
`preload`. Documented as intentional pending nonces; the `/embed/*` `frame-ancestors *` exception is
correctly scoped (`:57-63`) and `/api/embed/**` still gets `DENY`.

### L-6 — Hard-coded Meta verify token is returned to any signed-in user

`src/lib/instagram.ts:46` (constant, by documented design) is echoed by `instagram/config/route.ts:35`
and `facebook/config/route.ts:29` to SALES users. It only gates Meta's GET handshake; real authenticity
is the HMAC. Acceptable; note it so nobody mistakes it for a secret.

### L-7 — Local hygiene: an untracked `followup/.env` exists on this machine

Git-ignored (`.gitignore:32`) and not tracked (verified with `git ls-files`), so nothing is committed.
It holds `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` (values not inspected
beyond shape). The repo's own guidance is `.env.local`; a `.env` with a non-localhost Postgres URL on an
audit box is worth rotating if it is a real environment.

---

## 2. Route inventory — where `businessId` comes from, and whether every query is scoped

Legend: **S** = `getSessionContext()`; **A** = also `requireAdmin` (fresh DB role read, `session.ts:38-41`);
**R** = re-auth (`reauth.ts`); **B** = billing gate; **RL** = rate-limited; **sig** = provider signature.

| Route | Auth | businessId from | Scoping verified |
|---|---|---|---|
| `leads/[id]/{assign,automation,claim,dismiss-hold,followup,regenerate,send,sequence,stage}` | S (+B, RL on send/regenerate) | session | Every one loads the lead and compares/filters `businessId` before writing: `assign`→`assignment.ts:57-58`; `automation:27`; `claim`→`assignment.ts:93-95` then atomic `updateMany`; `dismiss-hold`→`pendingApprovals.ts:136`; `followup:30-33`; `regenerate:35-37`; `send:32-33`; `sequence`→`sequences.ts:236-241`; `stage:24-27`. |
| `leads/[id]` DELETE | S | session | `:17-20` (see L-2). |
| `leads` POST, `leads/import`, `leads/test-lead`, `leads/cleanup` | S (+B, RL; cleanup A) | session | Writes carry `ctx.businessId`; import pre-reads scoped (`import:106-118`); cleanup `deletable` (`:133-146`). |
| `sequences`, `sequences/[id]`, `sequences/run` | S (+B) | session | `sequences.ts:128-131,179-181,216-217` compare `businessId`. |
| `saved-filters`, `saved-filters/[id]` | S | session | `savedFilters.ts:31,68-70` (plus creator check). |
| `source-rules` | S (POST A+B) | session | `:26-27,86-89,92-96`. |
| `notifications`, `notifications/[id]`, `notifications/read-all` | S | userId | `[id]:14-16` compares `userId`. |
| `team`, `team/invites`, `team/invites/[id]`, `team/members/[id]` | S (mutations A inside `team.ts:98-103`) | session | `team.ts:178-181,198-199,218-219`. Invite auto-join: H-2. |
| `automation/settings`, `automation/run` | S (POST A+B) | session | All `where: { businessId: ctx.businessId }`. |
| `business/export`, `business/delete`, `business/booking-source` | S+A (delete +R) | session | H-1 for delete completeness. |
| `billing/{checkout,portal,status}` | S (checkout/portal A) | session | `client_reference_id: ctx.businessId` (`checkout:96`). |
| `billing/webhook` | Stripe sig, fails closed | Stripe `client_reference_id` / customer id | `:101-105` select-only lookup; idempotent (`:36-61`); superseded-subscription guard (`:162-175`). |
| `twilio/config`, `twilio/number` | S (POST/DELETE A) | session | Auth token write-only (`config:54`). |
| `crm/config` | S (POST/DELETE A) | session | one connection per business. |
| `facebook/config`, `instagram/config` | S (POST/DELETE A) | session | Meta ids `@unique` → P2002 handled. |
| `facebook/oauth/{start,callback,select-page,pending-pages}` | S+A (pending-pages S) | session | pages list travels encrypted in cookie (`callback:71-75`). |
| `instagram/oauth/{start,callback}`, `integrations/gmail/{connect,callback}`, `integrations/outlook/{connect,callback}` | start S+A; **callback S only** | session | **M-1.** |
| `integrations/gmail/{status,sync,scan-spam,disconnect,filtered}`, `filtered/[id]/restore`, `integrations/outlook/{status,sync,disconnect}` | S (+B, RL; disconnect A) | session | `restore:26` `findFirst({ id, businessId })`, `:52-55` `updateMany` with businessId. |
| `integrations/gmail/push` | query secret (fails closed `:35-36`) | Gmail address → `findBusinessIdByGmailAddress` | sync scoped to that business. L-1 compare. |
| `webhooks/config` | S+A+R (POST) | session | 24-byte `base64url` secret (192 bits) `:53`; rotation revokes immediately. |
| `webhooks/lead/[secret]` | secret lookup `:43` (unique index; 404 + Sentry on miss) | the row the secret resolves to | RL 100/10m; persist-first; every write via `processLeadFormSubmission(businessId, …)`. |
| `webhooks/outbound` | S+A | session | SSRF re-check before fetch (`:115`). |
| `embed/[businessId]/lead` | none (by design) | URL, existence-checked `:65-68` | RL 20/10m; honeypot; zod-cleaned. GET leaks only the business name. |
| `embed/config` | S | session | — |
| `book/[leadId]` | none | lead row's `businessId` (`booking.ts:76,125-134`) | **M-2** (no cap). |
| `unsubscribe` | HMAC token (timing-safe, throws without secret) | token claim | GET renders, POST acts (`:17-22`); HTML escaped `:35`. |
| `feedback`, `onboarding` (A) | S | session | — |
| `reactivation/batch` (S), `reactivation/classify` (S+A, paid-only, RL 6/10m) | S | session | `reactivation.ts:155-157,286,314,351` every write carries businessId. |
| `twilio/{sms,whatsapp}/[secret]` | secret → business, then Twilio sig (timing-safe `twilio.ts:34-36`; refuses if no auth token) | resolved business | persist-first, then `processTwilioInbound(businessId, …)`. |
| `twilio/status/[secret]` | same | resolved business | `:60-62` scoped `updateMany` (fixed cross-tenant write). |
| `twilio/voice/[secret]`, `voice/transcription/[secret]` | same (+B) | resolved business | `transcription:76` `findFirst({ businessId, phone })`. |
| `twilio/voice-agent-auth/[secret]`, `voice-agent-callback/[secret]` | bearer (timing-safe, fails closed) + secret + agent enabled + B | resolved business | — |
| `instagram/webhook` | Meta HMAC (fails closed `instagram.ts:80-83`), GET verify token | per-entry `instagramUserId`/`facebookPageId` `@unique` lookups (`inbound/meta.ts:140-144,216`) | persist-first with `businessId: null` (see H-1 related). |
| `cron/*` (9 routes) | `CRON_SECRET` bearer, fails closed when unset | fan-out per business inside libs | `cron/office` inline copy (L-1). |
| `office/run` | `isPlatformAdmin(session email)` → 404 | n/a (cross-tenant by design) | Manual JSON parse `:34-36`. |
| `auth/[...nextauth]` | next-auth | — | See §3. |
| `/admin/**` pages | `requirePlatformAdmin()` in layout **and** in `getPlatformAdminData()` (`admin-data.ts:101`); `PLATFORM_ADMIN_EMAILS` empty ⇒ nobody (`platformAdmin.ts:35`) | — | aggregate queries only. |
| `(app)` pages | `(app)/layout.tsx` redirects without session; data layer re-derives `businessId` from session (`leads-data.ts:104-125`, `analytics-data.ts:120-128`, `activity.ts:35-52`) | — | `getLeadById` compares `businessId` (`:122`). |

No route reads `businessId` or an email from the request body to decide tenancy. The only client-chosen
identifiers that select a tenant are the `[secret]`/`[businessId]`/`[leadId]` path segments of the
deliberately public routes above.

---

## 3. Checked and sound (so the next pass need not re-do it)

- **Session.** JWT strategy, 7-day max age (`auth.ts:41`); `businessId`/`userId` re-checked against the DB every 5 min so a removed member loses access within that window (`:189-202`); `authTime` stamped only on a real Google round-trip (`:146-157`) and used for the 5-min step-up on secret rotation and business deletion (`session.ts:26-30`, `reauth.ts`). `requireAdmin` reads the role fresh (`session.ts:38-41`). `NEXTAUTH_SECRET` missing ⇒ next-auth refuses in production; unsubscribe signing throws.
- **Sign-in.** Google-only; `ALLOWED_EMAILS` gate when set (`auth.ts:66-68`); no client-supplied email is trusted anywhere — `test-lead` reads the user's email from the DB (`:39`), `office/run` from the session (`:26-28`).
- **Platform admin.** Fails closed, 404 not 403, double-gated (`platformAdmin.ts`, `admin/layout.tsx:17`, `admin-data.ts:101`).
- **Webhook secrets.** `webhookSecret`/`twilioSecret` are 24 random bytes base64url, `@unique`, looked up by index (`webhooks/config:53`, `twilio/config:113`); rotation is admin + recent-auth; Twilio's is deliberately stable (`config:64-70`). Sentry never sees the secret path (`sentryScrub.ts:41-45,114-117`).
- **Signatures.** Twilio HMAC-SHA1 timing-safe with apex/www/forwarded-host candidates (host spelling only — HMAC still required); Meta HMAC-SHA256 timing-safe, two app secrets, fails closed; Stripe `constructEvent`.
- **Input.** `parseJsonBody` on every JSON route; zod `.object()` strips unknown keys (no prototype-pollution shape reaches a query); `cleanedText` coerces non-strings to `""`; CSV import capped at 2 MB/1000 rows with per-field length caps and pre-checked duplicates; webhook form-encoded path goes through the same schema (`webhooks/lead:71-83`).
- **Rate limits (atomic).** embed 20/10m, webhook 100/10m, `leads.create` 100/10m, `leads.send` 60/10m, regenerate 30+15/10m, import 5/10m, test-lead 5/10m, cleanup 2/h, gmail-sync 5/10m, scan-spam 5/10m, outlook-sync 5/10m, reactivation-classify 6/10m. Sign-in is Google's problem; Twilio/Meta inbound rely on signature + persist-first (unlimited but non-spending until `checkAiEligibility`).
- **Encrypted-field discipline.** `select`-only reads where only a plain column is needed: `billing/webhook:101-104`, `cleanup:59-62`, `cron/reactivation:67-77`, `classify:83-86`, `outboundWebhook.ts:38-41`, `twilio.ts:487-490`. Export allowlists fields and never includes a credential (`businessData.ts:101-126`).
- **SSRF.** Only one tenant-supplied URL is ever fetched server-side (outbound webhook); CRM clients use fixed bases (`crm/hubspot.ts:11`, `crm/followupboss.ts:32`).
- **Erasure/cascade.** `deleteLeadCascade` throws on tenant mismatch when given a businessId (`leads-admin.ts:23-25`); `Notification.leadId` is deliberately not an FK (`schema.prisma:1003-1009`) so it never blocks a lead delete.
- **PII in logs.** No `console.*` interpolates a lead email/phone/name (grep negative); Sentry `beforeSend` scrubs emails, phones, secret paths, query strings, cookies, bodies and all but three headers; `sendDefaultPii` off.
- **Secrets in the repo.** Tracked files swept for Stripe/OpenAI/Google/Slack/Twilio/Meta/GitHub/JWT/private-key/DSN/Postgres-URL shapes: only placeholders (`.env.example`, `.env.local.example`, `docs/least-privilege-db-role.md:52`, CI's dummy `NEXTAUTH_SECRET`). `.gitignore` is deny-all-env with two named templates; `.audit-scratch/` ignored.
- **Headers.** `X-Frame-Options: DENY` + `frame-ancestors 'none'` everywhere but `/embed/*`; nosniff; HSTS 1y; Referrer-Policy; Permissions-Policy; `poweredByHeader: false`; Sentry tunnelled via `/monitoring`.
- **Trust-guarantee tests exist and were read, not re-derived:** approval-first/risk gate (`automation.test.ts:349-385,717`), never-neglected-once-replied (`:266-329`), opt-out/suppression on every channel including manual DMs (`sendingAudit.test.ts:102-237`), consent audit rows (`consent.test.ts`, `optOut.test.ts`). The send funnel enforces `optedOutAt`, DM suppression, email suppression and send caps in one place (`sending.ts:261-346`).
- **De-identification boundary** exists and is opt-in-gated (`deidentify.ts:138-143`); nothing calls it yet.

---

## 4. Handover

1. **H-1 (backend-ai-agent, small, urgent):** add `suppression`/`reactivationRun` deletes to `deleteBusinessData`, reorder Stripe cancel after the DB transaction, scrub `AuditEvent.meta`, extend export; add the DMMF-driven "every Business-related model is erased" test and one real-Postgres test.
2. **H-2 (product decision first, then backend):** explicit invite acceptance (token link + confirm), invite expiry, ability to leave a team; interim: never auto-join without an invite cookie. Test in `auth.test.ts`.
3. **M-1 (backend, small):** `requireAdmin` in the Instagram/Gmail/Outlook callbacks; bind OAuth state to the session. Extend `oauthCsrf.test.ts`.
4. **M-2 (backend, small):** per-business cap + one-future-booking-per-lead on `POST /api/book/[leadId]`; first name only in the GET.
5. **M-3 (backend, tiny):** `crypto.ts` fail closed in production; correct `.env.local.example:97-98`.
6. **M-4 (backend, tiny):** strip lead name/company from the Slack hot-lead line (`scoring.ts:131`).
7. **L-1:** shared timing-safe string compare for `cronAuth.ts:18`, `cron/office:24`, `gmail/push:37`; route `cron/office` through `requireCronSecret`.
8. **L-2/L-3/L-4:** decide SALES lead-delete policy and pass `ctx.businessId`; stop echoing upstream error text; wrap office feedback text as untrusted.
9. **Ops:** rotate whatever `followup/.env` on this box points at if it is a real environment (L-7).
10. **Next audit:** this pass did not re-derive `automation.ts`/`sequences.ts` send logic (only its tests); the `sequences.ts`/`validation.ts` working-tree edits (hours-based delays) were read but are mid-change and should be re-checked once committed.
