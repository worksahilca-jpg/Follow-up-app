# Security audit — application logic (2026-09-26)

**Branch:** `security/2026-09-26-app-logic-audit`, cut from `main` at `8d48d7c` (#333).
**Scope:** application logic only — tenancy/IDOR, authN/authZ, webhooks and cron, public surfaces,
injection/SSRF/XSS, secrets and data exposure, OAuth flows. Perimeter work (headers/CSP in
`next.config.*`, rate-limit helpers, dependencies, cookie flags) belongs to the parallel agent and was
not touched; anything found there is listed in §4.
**Method:** first-hand read of every route under `src/app/api/**` (110 route files), every page under
`src/app/**`, and the libs they call; prior passes read first so nothing is re-found
(`2026-09-16-security-audit-auth-tenancy-and-api.md`, `2026-09-16-security-audit-meta-surface.md`,
`2026-09-25-security-pass-live-channels.md`, `backend-backlog.md`). Nothing was run against
production; no `.env` was read; no message was sent.
**Founder instruction mid-pass:** fix every real finding (each with a regression test and its own
commit), including the larger ones; name any change to real-user behaviour plainly. Done — every
finding below is fixed except where §3 says why not.

Line numbers in "Where" are from `8d48d7c` (before the fix).

**Verification at the end of the pass:** `npx tsc --noEmit` clean; `npx eslint .` clean;
`npx vitest run` — 188 files, 2,250 tests, all pass; `rm -rf .next && npx next build --webpack`
passes. (`next build` with Turbopack refuses to start in this worktree only because `node_modules`
is a symlink to the main checkout — "Symlink [project]/node_modules is invalid". Environmental; the
webpack build compiles the same code. `npm run build` was not used because it runs
`prisma migrate deploy` first.)

---

## 1. Findings

Severity is impact × reach as the code stands, not a CVSS score. "Real-user change" says whether a
legitimate user will notice the fix.

| ID | Sev | Finding | Status | Real-user change |
|---|---|---|---|---|
| A-1 | High | `/admin/office` readable without a session: the layout's guard is skipped on a client-navigation (RSC) request | Fixed `0306d52` | None |
| A-2 | Medium | Outbound-webhook SSRF guard bypassed by IPv6 spellings (`[::ffff:7f00:1]`) and by DNS rebinding | Fixed `1420d03` | None for public URLs |
| A-3 | Low | `/api/cron/office` compared `CRON_SECRET` with `!==` and never reported failures (2026-09-16 L-1, still open) | Fixed `ea27aa3` | None |
| A-4 | Medium | Stranger-typed text (lead name/company, AI reason) injected Slack mrkdwn — links, `<!channel>` — into the founder's Slack | Fixed `02f4f2d` | None |
| A-5 | Low | Google sign-in did not refuse an address Google marks unverified; the email is the identity for existing accounts, testers and invites | Fixed `7dca182` | None (only an explicit `false` is refused) |
| A-6 | Low | `ig:`/`fb:` DM addresses accepted as a phone from the embed form, lead webhook, manual form and CSV (2026-09-16 Meta #7, still open) | Fixed `75a16bb` | None for real numbers |
| A-7 | Medium | Facebook Page picker cookie forgeable when `TOKEN_ENCRYPTION_KEY` is unset → claim another business's Page (2026-09-16 Meta #4, still open) | Fixed `c670138` | None |
| A-8 | Medium | Missing `TOKEN_ENCRYPTION_KEY` in production stores every credential in plaintext with only a console line (2026-09-16 M-3, still open) | Mitigated `a973aa5` (alert, not fail-closed — see §3) | None |
| A-9 | Medium | No-card free trial re-granted on every checkout → Pro indefinitely for free | Fixed `4a12dc4` | **Yes** — a business that had a subscription before pays at checkout |
| A-10 | Low | Gmail/Outlook import looked conversations up by global `externalId` alone → another tenant's conversation could receive this mailbox's mail | Fixed `d5dad71` | None |
| A-11 | Medium | Public booking link: unlimited bookings per lead (calendar flood + invites) (2026-09-16 M-2, still open) | Fixed `1316ac4` | **Yes** — one upcoming booking per lead |
| A-12 | Low | Public booking API returned the lead's full name (part of M-2) | Fixed `3626160` | None (page only ever showed first name) |
| A-13 | Low | `DELETE /api/leads/[id]` did not pass the tenant to the cascade's own guard (2026-09-16 L-2, still open) | Fixed `3c3ff33` | None |
| A-14 | Low | 17 routes echoed raw SDK/driver/network error text (Prisma query/host, OpenAI org id, keys) (2026-09-16 L-3, still open) | Fixed `309f6fd`, `0c8ee0b` | Internal errors now read as the route's fallback sentence |
| A-15 | Low | Office prompt took every tenant's feedback text with no untrusted framing (2026-09-16 L-4, still open) | Fixed `91dab06` | None |
| A-16 | High | Any business admin could pre-claim an email: first sign-in silently joined that person to the stranger's team (2026-09-16 H-2, still open) | Fixed `4785ee3`, `b71f332` | **Yes** — invitees must open their invite link |
| A-17 | Medium | Customer lead names, companies and AI summaries posted to FollowUp's internal Slack (2026-09-16 M-4, still open) | Fixed `aacb9a0` | **Yes** — the Slack line names the business only |
| A-18 | Low | Erasure left a deleted business's Meta/WhatsApp webhook envelopes (DM text, sender ids) for 14–90 days (2026-09-16 Meta #9, still open) | Fixed `04b68cf` | None |
| A-19 | Low | Erasure kept personal data in `AuditEvent.meta` / `ip` (2026-09-16 H-1(b), still open) | Fixed `f8fc4dd` | None |
| A-20 | Low | Data export omitted five tables holding personal data (2026-09-16 H-1(c), still open) | Fixed `6dee143` | Export is larger |
| A-21 | Low | Set-aside WhatsApp chats (owner's private conversations) kept forever in plaintext (2026-09-25 F3, still open) | Fixed `a15831e` | **Yes** — Restore after 30 quiet days cannot bring the messages back |

### A-1 — High — `/admin/office` answers an unauthenticated RSC request

**Where.** `src/app/admin/office/page.tsx:160-164` called `syncRoles()` and `getFloor()` with no
check of its own; `getFloor()` (`src/lib/office/floor.ts:55`) had none either. The only guard was
`requirePlatformAdmin()` in `src/app/admin/layout.tsx:17`.

**Why that is not enough.** In the App Router a layout is not a security boundary. On a client
navigation the browser sends `RSC: 1` plus a `Next-Router-State-Tree` header describing what is
already mounted; the server renders only the segments that differ and does not call the shared
layout. Next's own guide says so (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1352`).

**Reproduced** against `next dev` on this branch before the fix, with `PLATFORM_ADMIN_EMAILS` empty
and no session: `GET /admin/office` → 404; the same URL with `RSC: 1` and
`Next-Router-State-Tree: ["",{"children":["admin",{"children":["__PAGE__",{}]}]}]` (URL-encoded) →
**200**, flight payload rooted at the `office` segment, and the page's Prisma queries executed. With a
real database that payload carries every desk's last note (written from all tenants' product
feedback), briefs and spend. The plain GET also executed `syncRoles()` (a DB write) for anyone.

**Fix.** `OfficePage` calls `requirePlatformAdmin()` first; `getFloor()` checks again itself (the
`getPlatformAdminData()` pattern). After the fix the same RSC request returns the not-found fallback
and no query runs. **Test** `adminPagesGuarded.test.ts`: `getFloor` refuses without a platform-admin
session before any query; a source scan fails if any `src/app/admin/**/page.tsx` lacks a guard call.

`src/app/admin/page.tsx` was already safe (`getPlatformAdminData()` re-checks). The `(app)` pages were
checked the same way: every data function they call re-derives the tenant from the session
(`getLeads`, `getLeadById`, `getAnalytics`, `getUpcomingBookings`, …) and returns nothing without one.

### A-2 — Medium — two SSRF bypasses in the outbound-webhook guard

**Where.** `src/lib/ssrf.ts:39-48`, `src/lib/outboundWebhook.ts:50,69`,
`src/app/api/webhooks/outbound/route.ts:115-116`.

1. **IPv6 spellings.** The WHATWG URL parser rewrites `http://[::ffff:127.0.0.1]/` to hostname
   `[::ffff:7f00:1]`. The guard only matched the dotted form (`/^::ffff:(\d+\.\d+\.\d+\.\d+)$/`), so
   `[::ffff:7f00:1]`, `[::ffff:a9fe:a9fe]` (169.254.169.254), `[::127.0.0.1]`, NAT64 `64:ff9b::…`,
   6to4 `2002:…` and Teredo all passed; `100.64/10` (CGNAT, where some clouds put metadata) passed too.
   Confirmed by unit test: 23 new cases fail against the old guard.
2. **DNS rebinding.** `assertSafeWebhookUrl()` resolved and checked the host, then `fetch()` resolved
   it again. A host whose answers alternate public/private passes the check and is dialled privately.
   The PUT test-fire returns the status code, so it is a reachability oracle.

**Attack.** An admin of any business saves `http://[::ffff:a9fe:a9fe]/latest/meta-data/` (or a
rebinding hostname) as the outbound webhook and presses "Send test". Whether the IPv6 form reaches
loopback depends on the runtime's IPv6 socket support (this sandbox returns `EAFNOSUPPORT`, so
reachability on Vercel is PLAUSIBLE, not demonstrated); the rebinding path does not depend on it.

**Fix.** IPv6 is parsed into its eight groups and the embedded IPv4 checked for every mapping form;
extra internal IPv4 ranges blocked. Both call sites now use `postJsonToTenantUrl()`: node:http(s) with
a `lookup` that re-checks every resolved address at connect time, no redirect following, body never
read. **Tests** `ssrf.test.ts` (+30 cases), including a real local server that must receive zero
requests from a rebinding hostname.

### A-3 — Low — `/api/cron/office` bypassed the shared cron guard

`src/app/api/cron/office/route.ts:22-25`: `auth !== \`Bearer ${secret}\`` (timing side-channel) and no
`recordAuthFailure`. Now `requireCronSecret(request, "office")`. **Test** `cronAuth.test.ts`: every
`src/app/api/cron/*/route.ts` must call it; the office route refuses and reports a wrong bearer.

### A-4 — Medium — Slack mrkdwn injection from a contact form

`src/lib/scoring.ts:240` interpolated `lead.name`, `lead.company` and the AI reason into Slack text;
`src/sentry.server.config.ts:39` did the same with error messages. Slack parses `<url|label>` and
`<!channel>`. **Attack:** anyone submits the public embed form with name
`<https://evil.example/login|Your Stripe payout failed — verify now>` and a buying message; when the
lead turns hot, the founder's Slack shows a disguised phishing link (or pages the channel).
**Fix:** `escapeSlackText()` (`&`, `<`, `>` — Slack's rule) at both call sites.
**Test** `slackEscape.test.ts`.

### A-5 — Low — unverified Google address could sign in as its owner

`src/lib/auth.ts:246` — the `signIn` callback finds the existing `User` by email and signs straight
in, and matches testers and invites by email; next-auth's Google provider does not check the ID
token's `email_verified`. Refused now when the claim is explicitly `false` (a response without the
claim behaves as before, so nobody is locked out). Defence in depth: Google normally verifies an
address before an account can use it. **Test** `signupGate.test.ts`.

### A-6 — Low — DM pseudo-addresses from public inputs

`Lead.phone` holding `ig:<igsid>`/`fb:<psid>` decides the channel and recipient of every send
(`src/lib/instagramId.ts`). `cleanedText(40)` accepted them in `embed/[businessId]/lead/route.ts:20`,
`webhooks/lead/[secret]/route.ts:19`, `leads/route.ts:23` and `leads/import/route.ts:147`. **Attack:**
an anonymous visitor submits `phone: "ig:<id>"`; the tenant gets a lead it treats as an Instagram
contact, or, with a real IGSID of an existing lead, the stranger's text is merged into that
customer's thread through the duplicate-phone path (`src/lib/inbound/leadForm.ts:81-84`).
**Fix:** `cleanedPhone()` / `sanitizeUserPhone()` turn such a value into `""`.
**Test** `dmAddressInjection.test.ts`.

### A-7 — Medium — Page picker cookie forgeable without the encryption key

`src/app/api/facebook/oauth/select-page/route.ts:30-41` trusted the page id/token pairs in
`fb_pending_pages`. With `TOKEN_ENCRYPTION_KEY` unset, `encryptSecret()` is a pass-through
(`src/lib/crypto.ts:47-50`), so an admin of business X can write business Y's Page id into the cookie
and claim it; Messenger DMs route by `facebookPageId`. **Fix:** in the unencrypted state the route asks
Graph which Page the token belongs to and refuses a mismatch; with the key set nothing changes.
**Test** `facebookPageSubscription.test.ts`.

### A-8 — Medium — plaintext credentials with nothing alerting

`src/lib/crypto.ts:25-37` — no key ⇒ plaintext storage, one `console.warn`. In production this now
raises a `security_alert` Sentry event once per process. **Not fail-closed on purpose** (§3).
`.env.local.example` corrected (it claimed a blank key makes storage fail). **Test** `crypto.test.ts`.

### A-9 — Medium — repeatable no-card trial

`src/app/api/billing/checkout/route.ts:123` set `trial_period_days` on every session with
`payment_method_collection: "if_required"`. After a trial lapses unpaid, `hasActiveAccess` is false so
the "already subscribed" guard (`:61-66`) lets the admin check out again — another 14 days of Pro,
no card, forever. **Fix:** no trial if the business has ever had a subscription (its own
`stripeSubscriptionId`, or any subscription on its Stripe customer via
`subscriptions.list({status:"all"})`). **Real-user change:** a returning business pays at checkout.
The Settings tier picker still says "14-day free trial" to them — copy follow-up for frontend (§3).
**Test** `billingCheckoutTrial.test.ts`.

### A-10 — Low — cross-tenant conversation by thread id

`src/lib/integrations/gmail.ts:614-617,792-805`, `src/lib/integrations/outlook.ts:369-372,504-509`
looked `Conversation` up by `externalId` alone, and `externalId` is unique across all businesses. If
another tenant already held that id, the import skipped classification and upserted this mailbox's
messages onto the other tenant's lead. Collision likelihood is low (Gmail/Graph ids are
per-mailbox), impact is a cross-tenant write. **Fix:** owner business checked on the early lookup and
on the row finally resolved; mismatch ⇒ skip with a warning. **Test**
`crossTenantThreadCollision.test.ts`. (Same class, not changed: `Message.externalId` upserts use
`update: {}`, so a collision drops a message rather than leaking it.)

### A-11 / A-12 — Medium / Low — public booking link

`src/lib/booking.ts:124-197` (no per-lead cap) and `:65-72` (full name). **Attack:** holder of one link
(it travels in emails and outbound-webhook payloads) POSTs every open slot for ten days, ~160
bookings, each a Google Calendar event inviting the lead's address, leaving no slot for any other lead.
**Fix:** one confirmed upcoming booking per lead, checked and inserted in one transaction under a
per-lead advisory lock; GET returns the first name only. **Real-user change:** a lead who wants to move
their call is told to reply to the business. Per-IP limits on this public route are the perimeter
agent's (§4). **Tests** `booking.test.ts`.

### A-13 — Low — lead delete without the cascade's tenant guard

`src/app/api/leads/[id]/route.ts:22` → `deleteLeadCascade(id, ctx.businessId)`. Not exploitable (the
route checks ownership first); keeps the irreversible delete guarded under refactor.
**Test** `leadDeleteRoute.test.ts`.

### A-14 — Low — raw upstream error text to the browser

Seventeen routes returned `err.message` from whatever they caught (list in commit `309f6fd`), e.g.
`leads/[id]/regenerate:127` (OpenAI: org id, limits), `reactivation/batch:42` (Prisma: query, host),
`billing/checkout:146`, `integrations/gmail/callback:63` (into a redirect URL). New
`publicErrorMessage(err, fallback)` keeps our own short sentences and replaces SDK/driver/network
errors with the route's fallback, logging the original. **Test** `publicError.test.ts`.

### A-15 — Low — office prompt injection

`src/lib/office/context.ts:66-76` — every tenant's `ProductFeedback.message` fenced in
`<user_feedback>` with the tag neutralised inside, plus a data-not-instructions notice.
**Test** `office.test.ts`.

### A-16 — High — silent pre-claimed team join

**Where.** `src/lib/auth.ts:287-293` (gate) and `:349-351` (join): a new or team-less account was
joined to *any* pending invite for its email, with no action by the invitee. `inviteMember`
(`src/lib/team.ts:160-190`) lets any admin invite any unclaimed address.

**Attack.** Admin of business B invites `victim@co.com` as ADMIN and names B "Victim Co". When the
victim first signs in — as an approved tester meaning to set up their own workspace, or because the
invite is their only way in — they land in B. Everything they connect (their Gmail inbox, as the
admin) or enter belongs to B's tenant; they cannot leave.

**Fix.** Each invite has a link carrying `HMAC(NEXTAUTH_SECRET, invite id + address)` — stateless, no
migration (`src/lib/inviteToken.ts`). `GET /api/invite/accept` verifies it against a live invite and
sets a 1-hour httpOnly cookie. The sign-in callback joins only the invite that cookie proves, only for
the address it was issued to; anyone else with a pending invite (tester, public sign-up) gets their own
business and the invite stays pending; someone admitted only by an invite but without the link is sent
to `/signin?error=InviteLink`; an invite cancelled mid-sign-in is not a free sign-up. The invite email
carries the link; Team settings shows admins "Copy invite link"; the sign-in page names the inviting
team (read server-side, never from the URL) before the join.

**Real-user change.** Invitees must open their link before signing in, including invites pending
today (admins can copy it from Team settings). Copy changes logged in
`design-brain/decisions/design-decisions.md` (`^invite-link-copy`). **Tests** `signupGate.test.ts`
(six attack cases), `auth.test.ts`, `inviteLink.test.ts`, `teamInviteLink.test.ts`,
`signinInviteNotice.test.ts`.

**Residual.** A page can bounce someone through a valid invite link (top-level navigation) and the
cookie lasts an hour; the sign-in page now names the team, so the join is no longer silent. Leaving a
team is still impossible for a member — product work (§3).

### A-17 — Medium — customers' names in FollowUp's internal Slack

`src/lib/scoring.ts:240` posted every tenant's hot lead's name, company and AI summary to the one
shared `SLACK_WEBHOOK_URL`; `src/lib/slack.ts:7-16` itself said this must stop before outsiders were
onboarded. The line now names the business only. **Real-user change:** whoever reads that channel no
longer sees who the lead is (the owner still gets the named in-app notification and alerts).
**Test** `slackEscape.test.ts`.

### A-18 / A-19 / A-20 — Low — erasure and access completeness

- **A-18** Meta/WhatsApp envelopes are stored with `businessId` NULL
  (`src/app/api/instagram/webhook/route.ts:101`, `whatsapp/webhook/route.ts:57`), so erasure never
  reached them. The erasure transaction now deletes NULL-business `meta` envelopes whose JSON payload
  contains one of the business's Meta ids as a quoted value (parameterised; digits-only ids).
  Tradeoff: an envelope that also carried another business's entry goes too; if that entry was still
  unprocessed it loses its replay copy.
- **A-19** `AuditEvent.meta` and `ip` are set to NULL for the erased business (action, time and target
  id remain; the deletion's own record is written after, unchanged).
- **A-20** Export now includes `Suppression`, `FilteredEmail`, `OutboundSend`, `AIInsight`,
  `ReactivationRun` (none holds a credential).

**Tests** `businessData.test.ts`.

### A-21 — Low — set-aside private chats kept forever

`FilteredEmail.threadPayload` (plain JSON, up to 50 messages of the owner's family/bank chats) was
never swept although the schema said it was. The hourly automation cron now clears it on WhatsApp rows
quiet for 30 days; the row stays. **Real-user change:** Restore on an older set-aside chat says the
messages weren't kept (existing branch in the restore route). **Tests** `setAsideRetention.test.ts`,
`cronResilience.test.ts`.

---

## 2. Checked and sound (this pass)

- **Tenant scoping.** Every session route derives `businessId` from `getSessionContext()`; no route
  reads a tenant id from a body or query. Every `[id]` route loads and compares before writing:
  leads (`assign`, `automation`, `claim`, `dismiss-hold`, `followup`, `regenerate`, `send`,
  `sequence`, `stage`, DELETE), `sequences/[id]`, `saved-filters/[id]`, `notifications/[id]` (by
  `userId`), `team/invites/[id]`, `team/members/[id]`, `integrations/gmail/filtered/[id]/restore`.
  New since 2026-09-16 and clean: `alerts`, `alerts/push` (endpoint allow-list, key-proof before
  re-binding an endpoint), `approvals/send-safe` (admin, server-derived queue), `automation/send-preview`
  (admin), `business/privacy` and `business/setup-step` (admin writes), `facebook/subscribe`,
  `instagram/subscribe`, `instagram/diagnose` (admin, token never returned), `leads/bulk-automation`
  (admin, autonomy permission + tier), `whatsapp/config` and `whatsapp/connect` (admin, token proves
  the number, P2002 ⇒ 409, token never returned), `access-request` (platform admin; `notFound()` in a
  route handler becomes a real 404 — `next/dist/server/route-modules/app-route/module.js:493`).
- **Roles.** Integration connects, billing, team, export, delete, webhook config, automation settings,
  source rules, bulk actions: admin-gated with a fresh DB role read. All four OAuth callbacks now
  check admin (2026-09-16 M-1 fixed upstream).
- **Webhooks/cron.** Meta signature over the raw body before any write, timing-safe, fails closed;
  Twilio signature per business; Stripe `constructEvent`; Gmail push secret timing-safe; voice-agent
  bearer timing-safe; every cron route through `requireCronSecret` (A-3 was the last one).
- **OAuth.** State cookie compared on every callback; `redirect_uri` from `appUrl()`; return target is
  an allow-list of two pages (`src/lib/oauthReturn.ts`) — no open redirect.
- **XSS.** No `dangerouslySetInnerHTML` except static JSON-LD (`layout.tsx:70`); owner-alert email HTML
  escapes every interpolation (`ownerAlerts.ts:274`); service-worker notification URLs are forced
  same-origin (`public/sw.js:27-30`); the WhatsApp signup `message` listener checks origin.
- **SQL.** Only tagged-template `$executeRaw` (parameterised) anywhere.
- **Secrets in responses.** No GET returns a token; `ENCRYPTED_FIELDS` reads are select-scoped on
  config GETs.

## 3. Not fixed, and why

- **A-8 fail-closed.** Throwing when `TOKEN_ENCRYPTION_KEY` is missing in production would take every
  integration down at once if the live deployment lacks it today, and that cannot be checked from
  here (no dashboard access by instruction). **Owner action:** confirm the variable is set in Vercel
  Production; once confirmed, `loadKey()` can throw in production.
- **SALES can delete any lead in their business** (2026-09-16 L-2 policy half). Least-privilege, not a
  tenancy hole; restricting it blocks what reps do today. Product decision.
- **A member cannot leave a team** (H-2 follow-up). Needs a product flow (what happens to their leads,
  their connected inbox).
- **Tier picker copy after A-9.** "14-day free trial" / "Start free trial" (`settings/page.tsx:1731-1767`)
  now overpromises to a returning business. Frontend copy pass through the design-brain loop.
- **Embed / lead-webhook conflict path.** A stranger who knows a customer's email or phone can append
  a message to that customer's existing lead (`leadForm.ts:81-84`), and the acknowledgement email goes
  to whatever address a form submitter types (20 per 10 min per business). Inherent to an
  unauthenticated contact form; mitigations (verify-by-email before merging into a lead from another
  source) change product behaviour.
- **`Message.externalId` global uniqueness across tenants** (2026-09-16 Meta #5). Still unverified
  whether two tenants DMing each other share a `mid`; a collision drops a message, it does not leak.

## 4. For the perimeter / rate-limit agent (not touched here)

- `POST /api/automation/run` and `POST /api/sequences/run`: any member, no rate limit. Parallel calls
  multiply the `checkSendCap` race (backlog B-006) by the number of concurrent runs.
- `POST /api/book/[leadId]`: per-IP/per-business limit on the public route (A-11 caps per lead).
- Meta connect/token-paste routes (`instagram/config` POST, `facebook/config` POST, both OAuth
  callbacks): no limit (2026-09-16 Meta #6).
- Unauthenticated Sentry event amplification on the public webhooks (Meta #10) — throttled per
  instance only.
- CSP still `'unsafe-inline' 'unsafe-eval'` (2026-09-16 L-5).
- `next-auth` session cookie flags were not reviewed here.

## Sources

- Code as cited, at `8d48d7c` and on this branch, read 2026-09-26.
- Next.js 16.3.5 docs shipped in `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1352`
  (layouts do not re-render on navigation); router-state schema
  `node_modules/next/dist/server/app-render/types.js:50-63`; A-1 reproduced against `next dev`.
- Slack escaping rule ("three characters you must convert to HTML entities and only three: &, <,
  and >"): Slack Developer Docs, "Formatting message text"
  (<https://docs.slack.dev/messaging/formatting-message-text/>) and Slack's own
  `slackhq/slack-api-docs` `page_formatting.md`
  (<https://github.com/slackhq/slack-api-docs/blob/master/page_formatting.md>). Seen via a web search
  summary on 2026-09-26; `api.slack.com` was egress-blocked from this sandbox, so the page itself was
  not read first-hand.
