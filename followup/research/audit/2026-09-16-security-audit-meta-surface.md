# Security audit — Instagram / Messenger / Facebook Lead Ads / WhatsApp surface

Date: 2026-09-16. Branch `claude/followup-demo-to-production-4k39hr` at `557d20d` plus uncommitted edits.
Report only; nothing under `src/` was changed. Every line number below was read in the working tree
this session. Uncommitted in-progress edits to `src/lib/sequences.ts`, `prisma/schema.prisma`,
`src/app/(app)/workflows/page.tsx` and `src/lib/validation.ts` were ignored as instructed (the
`validation.ts` line cited in #7 is the `cleanedText` helper, which is not part of that edit).

Prior coverage not repeated: Meta signature verification (fifth pass, 2026-09-09), inbound idempotency
(newer-surface #3, confirmed fixed), the Outlook/Gmail `state` fix (newer-surface #4), and the
product-level Meta findings in `research/integrations/2026-09-16-meta-channels-production-audit.md`
(60-day expiry, `subscribed_apps`, 24-hour window, leadgen `continue`). This pass is the security
angle only.

`developers.facebook.com` is EGRESS_BLOCKED here; one platform claim (#5) is graded as unverified.

---

## Findings, ranked

### 1. Meta access tokens and the Facebook app secret reach Sentry via the outgoing-fetch breadcrumb — High (impact) / conditional trigger

**Where the secrets go on the wire in a query string:**
`src/lib/facebook.ts:231` (`client_secret=${appSecret}&code=…`), `:239` (`client_secret` +
`fb_exchange_token`), `:246`, `:22`, `:46`, `:67`, `:142` (page access tokens);
`src/lib/instagram.ts:95`, `:118` (Instagram access token), `:324` (`client_secret` + short-lived token).

**Why that reaches Sentry:** `@sentry/nextjs` 10.73.0 is initialised server-side
(`src/sentry.server.config.ts:14-41`). Its native-fetch instrumentation records a breadcrumb for every
outgoing `fetch` by default (`node_modules/@sentry/node-core/build/cjs/integrations/node-fetch/SentryNodeFetchInstrumentation.js:64-65`,
`breadCrumbsEnabled` defaults to `true`). The breadcrumb builder strips the query from `url` but then
stores it verbatim:

```js
// node_modules/@sentry/node-core/build/cjs/utils/outgoingFetchRequest.js:151-152
if (parsedUrl.search) {
  data["http.query"] = parsedUrl.search;
```

The app's own scrubber (`src/lib/sentryScrub.ts:80-87`) walks `crumb.data[key]` through `scrubText`
(`:65-67`), which only redacts e-mail/phone patterns and the `[secret]`-path routes (`:41`). A value
like `?access_token=IGQ…` or `?client_id=…&client_secret=…&code=…` passes through unchanged.
`sendDefaultPii: false` does not affect breadcrumbs.

**Trigger:** any error event captured in the same request after one of those fetches. Concrete paths:
`src/app/api/facebook/oauth/callback/route.ts:60` `throw err` (any non-P2002 DB failure after the
exchange at `:46`) — the event carries `http.query` with `FACEBOOK_APP_SECRET`; the hourly/minutely
crons (`vercel.json`) call `sendInstagramMessage`/`sendMessengerMessage`/`lookupSenderName`
for many leads per invocation, so any later unhandled throw in that invocation attaches every
preceding business's Instagram/Page token.

**Impact:** `FACEBOOK_APP_SECRET` is what `validateMetaSignature` (`src/lib/instagram.ts:77`) trusts —
whoever reads Sentry can forge webhook envelopes into any tenant (`entry.id` is a public Page ID) and
mint app tokens. Per-business tokens let the holder DM as the business and read its Lead Ads.
Sentry is a third party with its own access list, retention and (Slack echo at
`src/sentry.server.config.ts:37`, message only) fan-out.

**Patch (small, contained — `sentryScrub.ts`):**
```ts
const SECRET_QUERY_RE = /([?&](?:access_token|client_secret|fb_exchange_token|code|secret)=)[^&]*/gi;
function redactSecretQuery(text: string) { return text.replace(SECRET_QUERY_RE, "$1[redacted]"); }
function scrubText(text: string) { return redactSecretQuery(redactSecretPaths(scrubPii(text))); }
```
plus a unit case in `sentryScrub.test.ts` with a breadcrumb `{ data: { "http.query": "?access_token=x" } }`.
Longer-term (backend-ai-agent): send Graph tokens in an `Authorization: Bearer` header instead of
the query string (Graph documents this; verify — docs egress-blocked here), and add
`beforeSendTransaction` coverage since `tracesSampleRate: 0.05` spans were not traced in this pass.

### 2. Instagram OAuth callback skips `requireAdmin` — a MEMBER can replace the business's Instagram connection — Medium

`src/app/api/instagram/oauth/start/route.ts:17` gates on `requireAdmin`; the callback does not:
`src/app/api/instagram/oauth/callback/route.ts:9-11` checks only `getSessionContext()`, then
`:39-42` writes `instagramAccessToken` + `instagramUserId` on `ctx.businessId`. Compare
`src/app/api/facebook/oauth/callback/route.ts:21`, which does gate. The `state` cookie is the only
other check (`:17`, `:29`) and it is not bound to a role or user.

**Attacker steps (a non-admin teammate, own browser):** set `ig_oauth_state=abc` in devtools; open
`https://www.instagram.com/oauth/authorize?client_id=<FollowUp app id — public, in the authorize URL
and in the `src/lib/instagram.ts:14` comment>&redirect_uri=<appUrl>/api/instagram/oauth/callback&response_type=code&scope=instagram_business_basic,instagram_business_manage_messages&state=abc`;
authorise their own IG professional account; land on the callback.

**Impact:** the business's real account is silently replaced. Inbound DMs to the real account stop
routing (`src/lib/inbound/meta.ts:140-144` looks up by `instagramUserId`); outbound to existing
`ig:` leads now uses the teammate's token (`src/lib/instagram.ts:110-118`); the teammate's own DMs
become the business's leads. An admin-only integration change performed by a member, with the audit
row (`callback:49`) attributed to the member as if authorised.

**Patch:**
```ts
// src/app/api/instagram/oauth/callback/route.ts, after the !ctx check
if (!(await requireAdmin(ctx))) return fail("Only an admin can connect Instagram");
```
(move `fail` above it). Test gap: `src/lib/__tests__/oauthCsrf.test.ts:30-31` imports only the Gmail
and Outlook callbacks; add the two Meta callbacks with a "member → refused" case.

### 3. A DM STOP whose suppression write fails is unrecoverable — replay skips it — Medium (trust guarantee)

`src/lib/inbound/meta.ts:176` writes the Message row (`createInboundMessageIfNew`), and only then
`:182` records consent (`applyDmConsentKeyword` → `src/lib/suppression.ts:219` upsert). Messenger
mirrors it at `:243`/`:247`. If `:182` throws (DB blip, pool exhaustion), `processInboundEvent`
marks the row failed (`src/lib/inboundEvents.ts:127-130`). On replay (`:192-197`) the same code runs,
`:176` returns `false` (P2002 on the mid), and `:177 continue` skips the consent write forever. The
row is then marked **processed** (`:125`). The same short-circuit skips the deferred acknowledgement
(`:198`) and scoring (`:200`) on replay — the opposite of `src/lib/inbound/leadForm.ts:90-101`, which
deliberately ignores the return value for exactly this reason.

**Impact:** the person typed STOP; the product recorded their message, told the owner nothing, and
keeps sending automated DMs — the "silent, looks like compliance" failure the module comment warns
about (`meta.ts:66-70`).

**Patch (contained):** consent is already idempotent (`suppress` upserts, `unsuppress` deleteMany), so
run it before the short-circuit and gate only the audit row on `isNewMessage`:
```ts
const isNewMessage = await createInboundMessageIfNew(conversation.id, content.body, new Date(), event.message?.mid);
const optedOut = await applyDmConsentKeyword(business.id, lead.id, "instagram", senderId, content.ownWords, { audit: isNewMessage });
if (!isNewMessage) continue;
```
(same for the Messenger block). Extend `src/lib/__tests__/dmOptOut.test.ts` with "STOP on a
redelivered/replayed mid still suppresses".

### 4. The multi-Page picker cookie is forgeable when `TOKEN_ENCRYPTION_KEY` is unset — cross-tenant Page claim — Medium (conditional on misconfiguration the code explicitly tolerates)

`src/lib/crypto.ts:25-33` returns `null` with a one-time warning when the key is missing, and
`encryptSecret` then returns the plaintext (`:49-50`); `decryptSecret` passes non-prefixed input
through (`:59`). `src/app/api/facebook/oauth/callback/route.ts:71,75` relies on `encryptSecret` for
**integrity** of `fb_pending_pages`, not just confidentiality, and
`src/app/api/facebook/oauth/select-page/route.ts:30-41` trusts the decrypted `pageId`/`accessToken`
without re-verifying ownership. With the key set, AES-GCM makes the cookie unforgeable — sound. Without
it (a state `crypto.ts` was designed to run in):

**Attacker steps (admin of tenant X):** set `fb_pending_pages=[{"id":"<victimPageId>","name":"x","accessToken":"junk"}]`
in devtools; `POST /api/facebook/oauth/select-page {"pageId":"<victimPageId>"}` → `facebookPageId`
is now the victim's Page.

**Impact:** (a) webhook routing is by `facebookPageId` (`src/lib/inbound/meta.ts:216`), so every
Messenger DM for that Page is captured into tenant X — feasible whenever the Page is still subscribed
to the app, and disconnect never unsubscribes (`src/app/api/facebook/config/route.ts:64-67`; no
`subscribed_apps` call exists anywhere); (b) if the victim is not yet connected, X pre-claims the ID and
the victim's own connect fails with "already connected to another FollowUp account"
(`callback:57-59`). Real Page tokens also sit plaintext in a browser cookie for 10 minutes.

**Patch (contained):** make the cookie's contents untrusted regardless of the key —
in `select-page` after `:34`: `const resolved = await resolveFacebookPage(page.accessToken); if (resolved?.id !== pageId) return 400;`
(the same check the paste-a-token path already does at `facebook/config/route.ts:41`). Also refuse the
picker branch when `!encryptionEnabled()` (fail with "encryption not configured") and include
`ctx.userId` inside the encrypted JSON, checked on select.

### 5. `Message.externalId` is globally unique — a DM between two FollowUp tenants drops one side — Low/Medium, one platform claim unverified

`prisma/schema.prisma:615` (`externalId String? @unique`, no tenant/conversation scope).
`captureDirectReply` upserts on `{ externalId }` (`src/lib/instagram.ts:221-225`) and
`createInboundMessageIfNew` treats P2002 as "redelivered" (`:253-258`). Tenant A (connected) DMs
tenant B (connected): A's envelope arrives as `is_echo` (`meta.ts:164-170`), B's as inbound
(`:173-177`). If both carry the same `mid` — **unverified**: Meta's message-echoes reference could not
be fetched (EGRESS_BLOCKED); the echo is the same message object, so identical `mid` is the likely
case — whichever tenant processes second loses the record, and if it is B's inbound, `:177 continue`
also skips B's ack, scoring and any STOP. Same shape for Messenger (`:237`/`:243`).

**Patch (contained to the Meta path):** namespace the key — `externalId: \`${businessId}:${mid}\`` at
`instagram.ts:224`, `meta.ts:169,176,237,243,271` — or, larger, `@@unique([conversationId, externalId])`
(touches Gmail/Outlook sync; backend-ai-agent). Verify the `mid` question with one live A→B DM first.

### 6. No rate limit on the OAuth callbacks or token-paste endpoints — a signed-in user can drive unbounded Meta calls from FollowUp's app identity — Low

`src/app/api/instagram/oauth/callback/route.ts:32`, `src/app/api/facebook/oauth/callback/route.ts:46`
(one exchange per request, `code` attacker-chosen, `state` self-set as in #2),
`src/app/api/instagram/config/route.ts:57`, `src/app/api/facebook/config/route.ts:41`
(one Graph `/me` per request with an arbitrary string). `tooManyRecentActions` is used on every
other costly authenticated route (grep: 12 call sites) but none of these four. The atomic
check-and-record (`src/lib/rateLimit.ts:24-39`) is intact where it is used. Impact: Meta app-level
throttling hits every tenant's connect flow and Graph sends; the webhook itself needs no limiter
(signature-gated, and AI spend is capped per business by `checkAiEligibility` at
`src/lib/scoring.ts:56` and `src/lib/acknowledge.ts:448`).

**Patch:** `if (await tooManyRecentActions(ctx.businessId, "meta.connect", { windowMinutes: 10, max: 10 })) return fail("Too many attempts — try again in a few minutes.");`
at the top of all four handlers.

### 7. `Lead.phone` is the DM address namespace and user-supplied phone text is never validated against it — Low

`ig:`/`fb:` prefixes decide channel and recipient (`src/lib/sending.ts:247-257`, `:443`, `:446`;
`src/lib/suppression.ts:115-121`). User-supplied phone is free text: `src/lib/validation.ts:73`
(`cleanedText(40)`), used by `src/app/api/webhooks/lead/[secret]/route.ts:19`, the embed route
(`src/app/api/embed/[businessId]/lead/route.ts:102`), and CSV import
(`src/app/api/leads/import/route.ts:147`).

**Attacker steps (anonymous, via a tenant's public embed form):** submit `phone: "ig:1784…"`.
If the IGSID is a real lead of that tenant, the create hits `businessId_phone` (`schema.prisma:566`)
and `src/lib/inbound/leadForm.ts:81-84` merges the submission into the real Instagram lead's thread,
re-scores it, and later automated DMs to that person reference the injected text. If it is not, the
tenant's automation will attempt Instagram sends to an arbitrary IGSID from the business's account
(Meta refuses without an open window). Needs the IGSID, so in practice in-tenant; still the only
route by which a non-Meta source can mint a DM-addressed lead.

**Patch:** reject `/^(ig|fb):/i` in every user-supplied phone schema (one helper in `validation.ts`),
so the two prefixes can originate only from `src/lib/inbound/meta.ts`.

### 8. `leadgen_id` and PSID interpolated unescaped into Graph URL paths — Low

`src/lib/facebook.ts:142` (`${GRAPH}/${leadgenId}?fields=…&access_token=…`) and `:67`
(`${GRAPH}/${psid}?…`). Values come only from a Meta-signed envelope, and the host is a constant, so
this is not SSRF; but a value containing `/`, `?` or `#` redirects the call to a different Graph
endpoint with the Page token. **Patch:** `if (!/^\d+$/.test(id)) return null;` before both fetches
and `encodeURIComponent` regardless.

### 9. Meta durability rows are unattributable — erasure and scoped replay miss them — Low (privacy)

`src/app/api/instagram/webhook/route.ts:89` stores every Meta envelope with `businessId: null`.
`deleteBusinessData` clears by `businessId` (`src/lib/businessData.ts:208`), so a deleted business's
raw DM text and sender IGSIDs survive up to 14 days (processed) or 90 days (failed/pending)
(`src/lib/inboundEvents.ts:240-245`), contradicting the schema's own promise
(`prisma/schema.prisma:1193`). `replayOutstandingInboundEvents({ businessId })` (`:223`) can never
select them. **Patch:** have `processMetaEnvelope` return the matched business ids and, when exactly
one, `update({ businessId })` on the row; or persist one row per `entry`.

### 10. Unauthenticated Sentry-event amplification — Low

Every bad GET or unsigned POST to the public webhook emits a Sentry `captureMessage`
(`src/app/api/instagram/webhook/route.ts:21`, `:57`; `src/lib/monitoring.ts:34`). Anyone can burn
the event quota that the auth-failure alert rule depends on. Also, an unsigned POST is fully buffered
by `request.text()` (`:52`) before rejection — bounded only by the platform's body cap. **Patch:**
sample `meta_webhook_verify` (e.g. every Nth) or rely on Sentry's server-side spike protection, and
reject on a missing `x-hub-signature-256` header before reading the body.

### 11. Legacy-plaintext sweep omits `facebookPageAccessToken` — Low

`src/lib/secretsSweep.ts:34-48` re-encrypts `twilioAuthToken` and `instagramAccessToken` only. Any
Page token written before the key existed stays plaintext forever (new writes are encrypted by
`src/lib/db.ts:20`). **Patch:** add the field to both the `OR` and the `select`/`data`.

### 12. Hygiene (no exploit)

- Needless decryption: `src/app/api/instagram/config/route.ts:25-28` and
  `src/app/api/facebook/config/route.ts:19-22` select the encrypted token only to compute a boolean;
  `instagramUserId`/`facebookPageId` are set and cleared together with it and would do.
- `src/app/api/instagram/config/route.ts:65-68` has no P2002 handling, unlike the callback
  (`:44-46`) and the Facebook paste path — connecting an account another tenant holds returns a 500.

---

## Checked and sound

- **Signature verification** — HMAC-SHA256 over the raw body, `timingSafeEqual` after a length check,
  both app secrets tried (`src/lib/instagram.ts:76-91`); missing/malformed header → `false` (`:84`);
  fails closed with no secrets (`:80-83`); verified **before** `JSON.parse` and before any DB write
  (`src/app/api/instagram/webhook/route.ts:52-59`, `:61-91`). Covered by
  `src/lib/__tests__/metaWebhookSignature.test.ts`.
- **GET handshake** — echoes `hub.challenge` only on token match (`:18-19`); string-body `Response`
  is `text/plain`, so the reflection is not XSS; the verify token is public by design (`instagram.ts:34-46`).
- **CSRF `state` on both Meta callbacks** — 24 random bytes, httpOnly/secure/lax, 10-minute cookie,
  compared and cleared (`instagram/oauth/start:24-27`, `callback:17,29,53`; `facebook/oauth/start:17-20`,
  `callback:31,43,65,74`). Same pattern as the Gmail/Outlook fix (`integrations/gmail/callback:17,36`).
- **redirect_uri / open redirect** — built from `appUrl()` = `NEXTAUTH_URL` (`src/lib/stripe.ts:63-65`),
  never the Host header or a client param; every redirect targets `/settings` or `/signin`; the
  `message` query param is rendered as React text (`src/components/InstagramConfig.tsx:44`,
  `FacebookConfig.tsx:47`).
- **Tokens at rest** — `instagramAccessToken`, `facebookPageAccessToken`, and `twilioAuthToken` (the
  WhatsApp credential; WhatsApp rides Twilio) are all in `ENCRYPTED_FIELDS` (`src/lib/db.ts:18-22`).
  No token in the GDPR export (`src/lib/businessData.ts:105-126`, explicit allowlist), in audit meta
  (`callback:49`, `:62` — `via`/`pageId` only), in any API response (`config` GETs return booleans),
  in `recordAuthFailure` context, or in a `console.*` line on this surface.
- **Multi-tenant isolation** — routing by `@unique` `instagramUserId`/`facebookPageId`
  (`schema.prisma:185,192`); leads keyed `(businessId, phone)` (`:566`); suppression keyed
  `(businessId, channel, address)` (`:297`) so an IGSID and a PSID that collide as strings are
  separate rows; token lookups by `businessId` only with no fallback (`instagram.ts:110-116`,
  `facebook.ts:28-35`) — an expired 60-day token yields `{ success:false, status }`, never another
  tenant's credential; inbound routing needs no token, so expiry cannot re-route.
- **SSRF** — no payload-supplied URL is ever fetched: `messageContent` reads only `attachments[].type`
  (`src/lib/inbound/meta.ts:53-56`); Graph hosts are constants; profile pictures are never fetched.
- **Replay** — `replayInboundWebhookEvent`/`replayOutstandingInboundEvents` are exported functions
  with no route, cron, or action caller (grep); only `pruneInboundWebhookEvents` is wired
  (`src/app/api/cron/automation/route.ts:46`). Row growth is limited to Meta-signed envelopes and
  bounded by 14/90-day retention.
- **Lead race** — `findOrCreateLeadByInstagram`/`ByMessenger` use create-and-catch-P2002
  (`instagram.ts:157-180`, `facebook.ts:80-101`); conversations have the partial unique index
  (`src/lib/conversations.ts`).
- **DM consent enforcement at send time** — the one funnel every sender uses checks suppression
  before any provider call, manual sends included (`src/lib/sending.ts:293-301`); the deferred ack
  re-checks at send time (`src/lib/acknowledge.ts:417-420`). `sendInstagramMessage` has exactly one
  caller (`sending.ts:443`).
- **WhatsApp inbound** — per-business Twilio signature, persist only after verification
  (`src/app/api/twilio/whatsapp/[secret]/route.ts:33-40, 47-57`).
- **Picker cookie with the key set** — AES-GCM authenticated; the client-facing list is names only
  (`pending-pages/route.ts:15`).

---

## Handover

- **Fix #1 first** (`src/lib/sentryScrub.ts` + test): it is a five-line change and it is the only
  finding whose impact reaches the app secret. Then rotate `FACEBOOK_APP_SECRET`/`INSTAGRAM_APP_SECRET`
  if Sentry has ever received an error event from a request that performed an OAuth exchange.
- **#2** is a one-line `requireAdmin` in the Instagram callback; add the two Meta callbacks to
  `oauthCsrf.test.ts`.
- **#3** reorders two awaits in `src/lib/inbound/meta.ts` (both DM blocks) and adds a replay case to
  `dmOptOut.test.ts` — this is trust-guarantee territory, so run the suite.
- **#4** needs only the `resolveFacebookPage` ownership re-check in `select-page`; the
  "refuse without encryption key" guard is a bonus.
- **#5** hinges on one unverified Meta fact (echo `mid` == inbound `mid`); test with two connected
  accounts before choosing between the prefix fix and the schema change.
- **#6–#8, #11, #12** are each under ten lines; batch them for `backend-ai-agent`.
- **#9** is a data-model choice (attribute after processing vs. one row per entry) — same agent, with
  the erasure requirement stated.
- Not on this surface but noted while tracing: `beforeSendTransaction` was not audited for the same
  `http.query` leak in the 5% sampled spans.
- Everything in "Checked and sound" can be cited as already defended in the pentest scope document;
  a real engagement should spend its time on #1, #4 and the two-tenant collision in #5.
