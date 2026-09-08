# Code audit — newer surface area — 2026-09-08

Ad-hoc audit pass, scoped to feature surface that shipped after the 2026-09-05 code-audit pass
(`research/audit/2026-09-05-code-audit.md`) and this session's task #37/#41/#38 core-app passes
(leads, scoring, sending, Gmail, Twilio SMS/voice): WhatsApp Business, the live AI voice agent
(both `followup/` and the separate `voice-agent/` bridge project in this workspace), Outlook/
Microsoft 365 capture, Meta Business Agent capture (Instagram + Messenger direct-reply echo
handling), CRM sync (Follow Up Boss + HubSpot), Facebook Messenger DMs + Lead Ads, one-click
Instagram/Facebook OAuth Connect, Smart Views, Ponds (shared claimable lead pool), and the new
consent/AI-audit-trail panel (`src/lib/consent.ts`, `src/components/LeadTrustPanel.tsx`,
`getLeadAuditTrail`).

Each finding below was traced through the actual code path, not inferred from a code smell.
Ranked most severe first. Findings-only — no fixes applied here.

**Not re-reported:** the known, already-documented Meta Business Agent `standby`/Handover-Protocol
risk flagged at the top of `src/app/api/instagram/webhook/route.ts` and in
`research/integrations/2026-09-08-meta-business-agent-webhook-behavior.md`. Also not re-reported:
the exact-same-shape "no idempotency key on inbound `Message.create`" gap that already exists,
pre-dating this pass, in the core (previously-audited) Twilio SMS webhook
(`src/app/api/twilio/sms/[secret]/route.ts`) and is mirrored unchanged in the new WhatsApp webhook —
see the note under finding #3 for why that one specific instance is excluded while the Meta-webhook
instance of the same class of bug is still reported.

**Investigated and ruled out:** a suspected transcript-duplication bug in
`src/app/api/twilio/voice-agent-callback/[secret]/route.ts` (no idempotency key on the
`Message.createMany` there). The obvious next question — does the bridge service ever retry a
failed callback POST, which would duplicate the whole transcript — is answerable here because the
bridge (`voice-agent/api/stream.js`) is itself part of this workspace: `postTranscript()` is a single
`fetch` with no retry loop, and the `reported` boolean guard (`handleCall`, lines 97/101-107)
correctly prevents the three event paths that could call `reportAndClose()` (Twilio `stop`, Twilio
`close`, OpenAI socket `close`) from ever posting more than once per call. This one does not fire in
practice; not reported as a finding. (Investigating the bridge itself surfaced #1 below.)

---

## 1. The voice-agent bridge's WebSocket endpoint has no authentication at all — anyone can trigger real, billed OpenAI Realtime API usage and inject a fabricated call transcript into any business's lead pipeline — security/cost, critical severity, confirmed

**Where:** `voice-agent/api/stream.js`, the `wss.on("connection", ...)` handler (lines 67–82) and
`handleCall()` (lines 90–230).

Every other Twilio-facing endpoint in this codebase checks two things before doing anything
expensive: the per-business `twilioSecret` in the URL (routing) **and** Twilio's own
`X-Twilio-Signature` HMAC (proof the request really came from Twilio) — see
`validateTwilioRequestSignature()` in `src/lib/twilio.ts`, used by every route under
`src/app/api/twilio/`. The voice-agent bridge's WebSocket endpoint — the one place in this whole
integration that actually opens a real-time, per-second-billed connection to OpenAI on the
business's behalf — checks neither of those things. It only requires *a* `secret` query parameter
to be present, not that it's valid for any business, and never checks any Twilio signature on the
WebSocket upgrade request at all:

```js
wss.on("connection", (twilioWs, request) => {
  const url = new URL(request.url, "http://internal");
  const secret = url.searchParams.get("secret");
  if (!secret) {
    twilioWs.close(1008, "Missing secret");
    return;
  }
  handleCall(twilioWs, secret).catch((err) => { ... });
});
```

`handleCall()` never looks up a `Business` row by `secret` at all — the bridge is entirely
stateless about which business a call belongs to; it only forwards `secret` untouched into the
final `postTranscript()` call. So the value doesn't even need to be a real `twilioSecret`: anyone
who opens a raw WebSocket to the bridge's public URL (`VOICE_AGENT_WS_URL`, a stable Vercel
deployment URL — not itself meant to be a secret, since it doesn't route by business) with any
non-empty `?secret=` value gets a live session. Sending the same JSON `{event: "start", start: {...}}`
message Twilio's Media Streams protocol uses (its shape is fully documented in this very file's own
comments, and in Twilio's public docs) is all it takes to reach `connectToOpenAi()`
(lines 131–137), which opens a real WebSocket to `wss://api.openai.com/v1/realtime` using the
bridge operator's own `OPENAI_API_KEY` and immediately sends `response.create` — the agent starts
speaking (generating billed output audio) the instant the fake "call" connects, with zero caller
audio required. From there an attacker can feed arbitrary fake "media" (audio) frames to keep a
real, metered OpenAI Realtime session running for as long as they want, then send a `"stop"` event
to trigger `postTranscript()`, which POSTs the (fully attacker-authored) transcript to
`/api/twilio/voice-agent-callback/[secret]` in the main app using the *shared* bearer secret
(`VOICE_AGENT_CALLBACK_SECRET`, an env var the bridge legitimately holds).

**Concrete failure scenario:** two independent, both realistic:

1. **Pure cost/DoS abuse, no valid secret needed at all.** An attacker who has merely discovered
   the bridge's public URL (it's a plain Vercel deployment, no secret gates the connection itself)
   opens a WebSocket with any junk `secret` value, sends a synthetic `start` event, and holds the
   session open — the bridge happily relays it to OpenAI's Realtime API, generating real billed
   usage on the bridge operator's OpenAI account, indefinitely, with no per-connection duration cap
   and no way to distinguish this from a real call. Repeated across many concurrent connections,
   this is an open-ended way to run up the operator's OpenAI bill or exhaust its rate limits —
   `voiceAgentStreamUrl()`'s only "protection" (`src/lib/twilio.ts:218-227`) is that the URL isn't
   printed anywhere in the FollowUp UI, i.e. security through the URL simply not being advertised,
   not through any actual authentication.
2. **Fabricated call data landing in a real business's leads.** If an attacker obtains (leaked,
   guessed, or previously exposed some other way) a specific business's real `twilioSecret`, the
   same technique lets them post a fully attacker-authored "call transcript" straight into that
   business's real lead pipeline via `voice-agent-callback` — `findBusinessByTwilioSecret` +
   `voiceAgentEnabled` + billing checks in that route all pass normally, since from the main app's
   point of view this looks exactly like a legitimate bridge-relayed call. `findOrCreateLeadByPhone`
   then creates or updates a real Lead from the attacker-chosen `from` number and transcript content,
   which gets scored and drafted like any other lead.

**Fix direction (not applied):** the bridge needs to validate that the WebSocket upgrade request
actually came from Twilio before doing anything — Twilio signs the initial HTTP upgrade request for
Media Streams with the same `X-Twilio-Signature` scheme used for ordinary webhooks (keyed by the
business's Twilio Auth Token), so the same validation logic already in `src/lib/twilio.ts`
(`validateTwilioSignature`) should run here too — which in turn means the bridge needs a way to look
up the right business's Auth Token for a given `secret` (e.g. a small authenticated internal
endpoint on the main app, since the bridge doesn't have direct DB access today). At minimum, some
authentication should gate opening the expensive OpenAI leg at all, rather than opening it eagerly
on any inbound WebSocket claiming to be a call.

---

## 2. CRM sync can never finish backfilling any account with more contacts than fit in 5 pages — permanently stalls, silently, for realistic account sizes — backend, high severity, confirmed

**Where:** `src/lib/crmSync.ts` `syncCrmForBusiness()` (lines 36–80), `src/lib/crm/followupboss.ts`
`fetchPage()`, `src/lib/crm/hubspot.ts` `fetchPage()`.

`syncCrmForBusiness` pages through the CRM with a local `cursor` variable, capped at
`MAX_PAGES_PER_RUN = 5` pages of `PAGE_SIZE = 100` (500 contacts) per invocation:

```ts
let cursor: string | null = null;
let pages = 0;
do {
  const page = await client.fetchPage(conn.apiKey, cursor, since);
  ...
  cursor = page.nextCursor;
  pages++;
  if (pages >= MAX_PAGES_PER_RUN && page.hasMore) { truncated = true; break; }
} while (cursor);

await prisma.crmConnection.update({
  where: { businessId },
  data: { lastSyncedAt: truncated ? conn.lastSyncedAt : startedAt, lastSyncError: null },
});
```

When a run truncates (more than 500 contacts remain), **`lastSyncedAt` is deliberately left
unchanged** — that part is correct, it's meant to make the next run pick up where this one left
off. But nothing on `CrmConnection` persists the pagination `cursor` itself (the Prisma model has
only `lastSyncedAt`/`lastSyncError`, no cursor field — checked `prisma/schema.prisma:717-727`).
`cursor` is a plain local variable inside this one function call. So the *next* invocation of
`syncCrmForBusiness` (next cron tick, or a manual re-sync) starts the whole `do`/`while` over again
with `cursor = null` and the *same* `since` value as before — i.e. it re-issues the exact same first
5 pages of the query it already ran last time, and stops at the exact same page-5 boundary again.

The two CRM clients make this concrete and, for Follow Up Boss, deterministic every single time:

- **Follow Up Boss** (`src/lib/crm/followupboss.ts` `fetchPage()`): ignores `since` entirely (its
  own doc comment explains why — no confirmed "updated since" filter) and sorts
  `?sort=-created` — **newest contacts first**, offset-paginated. With `cursor` never persisted,
  every run starts at `offset=0` and re-fetches the newest 500 contacts, forever. Any Follow Up
  Boss account with more than 500 contacts will **never** import contact #501 onward — not "slowly
  over many ticks," but never, on any schedule, because the run always restarts at the top of the
  same newest-first list.
- **HubSpot** (`src/lib/crm/hubspot.ts` `fetchPage()`): sorts `lastmodifieddate ASCENDING` and does
  filter on `since` (`lastmodifieddate >= since`), which is more forgiving in principle — but since
  `since` never advances past a truncated run either, the next run reissues the identical
  oldest-modified-first query and truncates at the identical page-5 boundary again. A HubSpot portal
  with a backlog of >500 contacts modified since the last successful full sync gets stuck the same
  way, re-importing (a cheap no-op, thanks to the idempotent `(businessId, crmProvider, crmId)`
  upsert) the same oldest 500 every tick and never reaching the 501st.

**Concrete failure scenario:** A real-estate or services business with an existing Follow Up Boss or
HubSpot account of, say, 3,000 contacts connects it in Settings. The very first sync run imports the
newest (FUB) or oldest-matching (HubSpot) 500 and truncates. Every subsequent cron tick — forever —
re-runs the identical first-500-contact query and imports nothing new (idempotent upsert skips
them). The other 2,500 contacts are never surfaced as Leads, never scored, never followed up on, and
there is no error anywhere (`lastSyncError` stays `null`, `imported`/`touched` just report 0 or
small numbers indefinitely) — nothing tells the business owner the sync stalled. This is not a rare
edge case for this feature's actual target customer (an established small business is exactly the
kind of account likely to already have a CRM with a real contact backlog).

**Fix direction (not applied):** persist the pagination cursor itself on `CrmConnection` (a new
`syncCursor String?` column) and resume from it — not just `since` — on the next truncated-run
continuation; only advance/clear `since`+cursor together once a full untruncated pass completes.
For Follow Up Boss specifically, sorting newest-first with no `since` filter and no persisted offset
is fundamentally incompatible with a "catch up over several ticks" backfill — worth switching to
oldest-first (`sort=created`) at minimum, so a stalled backfill at least converges monotonically
forward instead of being stuck re-scanning the same static newest-500 window forever.

---

## 3. Instagram DM, Messenger DM, and Facebook Lead Ads inbound-message capture has no idempotency guard against Meta's webhook redelivery — duplicate `Message` rows on retry — backend, medium-high severity, confirmed

**Where:** `src/app/api/instagram/webhook/route.ts`, the non-echo inbound branch (lines 103–115)
and the Facebook Lead Ads branch inside `handlePageEvents()` (lines 168–189); also the Messenger
non-echo inbound branch (lines 155–166).

The route's own doc comment states plainly: *"Meta expects a fast 200 response regardless of what's
inside — retries aggressively on non-2xx"* (lines 35–38). Yet the primary inbound-message path
writes the new `Message` unconditionally, with no dedup key:

```ts
const lead = await findOrCreateLeadByInstagram(business.id, senderId);
let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id, channel: "instagram" } });
if (!conversation) conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "instagram" } });
await prisma.message.create({
  data: { conversationId: conversation.id, direction: "inbound", body: text, sentAt: new Date() },
});
```

This is a real inconsistency **within the same file**: the `is_echo` branch just above it
(`captureDirectReply()` in `src/lib/instagram.ts`, lines 178–202) *does* dedupe correctly, via
`prisma.message.upsert({ where: { externalId: event.message?.mid }, ... })` — `Message.externalId`
is `@unique` and documented exactly for this ("Gmail message id, for idempotent sync" —
`prisma/schema.prisma:346`). The primary inbound path has the identical `event.message?.mid` value
available (it's read one line later as `event.message?.mid` in the echo branch) but never uses it.
The Facebook Lead Ads branch (`entry.changes[]`, field `"leadgen"`) has the same gap: on a redelivered
`leadgen` change event for the same `leadgen_id`, `upsertLeadFromLeadgen` correctly no-ops on the
Lead itself (matched by email/phone), but the `prisma.message.create` a few lines later
(`src/app/api/instagram/webhook/route.ts:181-183`) is unconditional and creates a second identical
inbound "Submitted a Facebook lead form." message every redelivery.

**Concrete failure scenario:** A lead sends an Instagram DM. The handler for that event does several
sequential awaited steps per event — lead lookup, conversation lookup/create, message create,
`acknowledgeNewLead` (an outbound send), `scoreAndDraftForLead` (an OpenAI call), `checkRapidEngagement`
— inside a loop over every event in the delivery. If a single POST carries several events (a business
getting DMs from more than one person in one batch), or the classification/scoring step is slow, the
handler can plausibly run past Meta's webhook delivery timeout; Meta retries. The retry reprocesses
the same `entry`/`event` and calls `prisma.message.create` again for the same inbound text with no
key to detect it's already been recorded — a second, duplicate `Message` row appears in that lead's
conversation history. This is directly visible in the UI (the same DM shown twice), inflates message
counts feeding scoring/engagement heuristics, and doubles the OpenAI classification/scoring API calls
for that event. (Note: this does *not* cause a duplicate outbound reply — `acknowledgeNewLead` is
separately guarded by the one-time `Lead.acknowledgedAt` claim, so the visible symptom is duplicate
inbound history and wasted API calls, not a duplicate message sent to the lead.)

**Why this is reported here and not the identical-shaped SMS gap:** the pre-existing Twilio SMS
webhook (`src/app/api/twilio/sms/[secret]/route.ts`, already covered by earlier audit passes per the
task brief) has this same unguarded `message.create` shape and is not re-reported. This finding is
scoped to the Instagram/Messenger/Lead-Ads webhook specifically because (a) it's newer surface named
in this pass's brief, and (b) the file *itself* already demonstrates the correct fix one branch away
(`captureDirectReply`'s `externalId` upsert), making the omission in the primary path a clear,
easily-fixed inconsistency rather than a novel design problem.

**Fix direction (not applied):** capture `event.message?.mid` (Instagram/Messenger) or
`change.value.leadgen_id` (Lead Ads) as `Message.externalId` and switch these three `create` calls to
the same `upsert`-by-`externalId` pattern `captureDirectReply()` already uses.

---

## 4. Outlook OAuth callback has no CSRF `state` validation, unlike Instagram/Facebook Connect — the codebase demonstrates the correct pattern elsewhere but doesn't apply it here — backend/security, medium severity, confirmed present, shared with a pre-existing Gmail gap

**Where:** `src/app/api/integrations/outlook/connect/route.ts` and
`src/app/api/integrations/outlook/callback/route.ts`.

`buildOutlookAuthUrl()` (`src/lib/integrations/outlook.ts:96-108`) sets Microsoft's `state` param to
whatever `next` was passed in (literally just the string `"onboarding"` or `undefined` — not a
per-request random token), and the callback route only ever reads it back to decide which page to
redirect to:

```ts
const returnTo = new URL(searchParams.get("state") === "onboarding" ? "/onboarding" : "/settings", request.url);
...
const { email } = await exchangeOutlookAuthCode(code, ctx.userId);
```

Nothing compares `state` against a value that was actually issued for *this* session. Contrast this
with the Instagram and Facebook OAuth "Connect" flows added in the same wave of work
(`src/app/api/instagram/oauth/start|callback/route.ts`,
`src/app/api/facebook/oauth/start|callback/route.ts`), which both generate a random `state` via
`randomBytes(24)`, store it in an httpOnly cookie, and hard-fail the callback if the returned `state`
doesn't match the cookie — exactly the standard OAuth-CSRF ("login CSRF") mitigation. The Outlook
flow (and the pre-existing Gmail flow it deliberately mirrors — `src/app/api/integrations/gmail/
connect|callback/route.ts` has the identical no-validation shape) has none of that.

**Concrete failure scenario:** an attacker starts their own Microsoft OAuth consent flow against
FollowUp's registered redirect URI, authorizes with *their own* Microsoft account, and captures the
resulting `code` from the redirect before it's consumed (Microsoft auth codes are short-lived but
this is a normal login-CSRF setup, not a race). The attacker then gets a signed-in FollowUp user to
open `https://<app>/api/integrations/outlook/callback?code=<attacker's code>&state=onboarding`
(an ordinary link/image/redirect works — no special access needed). `exchangeOutlookAuthCode(code,
ctx.userId)` exchanges the attacker's code and saves the resulting tokens against the *victim's*
`userId`/business. The victim's FollowUp account is now sending/reading email through the
*attacker's* Outlook mailbox — the business's "connected email" silently becomes an account the
attacker controls, which they could pre-stage to see whatever mail lands there, or simply use to
disrupt the victim's email channel.

**Fix direction (not applied):** mirror the Instagram/Facebook `state`-cookie pattern already
present in this codebase: issue a random `state`, store it httpOnly, validate it on the callback
before calling `exchangeOutlookAuthCode`/`exchangeCodeForTokens`. Since Gmail's callback has the
identical gap and Outlook was explicitly built to mirror it, the same fix should probably land in
both at once — Gmail is technically outside this pass's "newer surface" scope, so it's noted here for
context rather than as a separate numbered finding.

---

## Summary

Four findings. #1 (the voice-agent bridge's unauthenticated WebSocket endpoint) is the most severe —
a confirmed, no-credentials-required way to trigger real billed OpenAI usage and, with a leaked
`twilioSecret`, inject fabricated data into a real business's leads; it only surfaced by reading the
separate `voice-agent/` bridge project that also lives in this workspace, not just the `followup/`
app. #2 (CRM sync stalls permanently past ~500 contacts) and #3 (Instagram/Messenger/Lead-Ads webhook
redelivery duplicates messages) are confirmed by direct code + schema inspection. #4 (Outlook OAuth
CSRF) is confirmed present in the code as written; exploitability is standard login-CSRF mechanics
rather than anything Outlook-specific, and it's inherited unchanged from the pre-existing Gmail flow
rather than a defect newly introduced by the Outlook work. One suspected finding (voice-agent-callback
transcript duplication on a retried bridge POST) was investigated and ruled out — see the note above
the numbered findings — by reading the bridge's actual retry (or rather, no-retry) behavior.

Areas that came back clean on this pass: WhatsApp Business messaging (`src/lib/twilio.ts`
WhatsApp paths, `src/app/api/twilio/whatsapp/[secret]/route.ts` — correctly reuses the phone-based
`(businessId, phone)` unique constraint and shares opt-out state with SMS as intended); the consent
panel and AI audit trail (`src/lib/consent.ts`, `src/components/LeadTrustPanel.tsx`,
`getLeadAuditTrail` — properly business-scoped, pure/side-effect-free classification logic, no
apparent bugs); Smart Views (`src/lib/savedFilters.ts` — correctly scoped and permissioned); Ponds/
lead claiming (`src/lib/assignment.ts` `claimLead()` — correctly atomic via conditional
`updateMany`); the Instagram/Facebook one-click OAuth Connect flows (properly `state`-validated,
correctly business-scoped, tokens encrypted before ever touching a cookie); and the
`ENCRYPTED_FIELDS` credential-encryption pattern (`src/lib/db.ts`) — every newer integration that
stores a real secret (`Integration.accessToken`/`refreshToken` for Outlook, `CrmConnection.apiKey`
for Follow Up Boss/HubSpot) correctly rides the existing encryption-at-rest wrapper; no newer
integration was found storing a secret in a field the wrapper doesn't cover.
