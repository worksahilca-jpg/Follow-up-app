# Instagram DMs, Facebook Messenger, WhatsApp — will they actually work in production?

Checked: 2026-09-16. Branch `claude/followup-demo-to-production-4k39hr`.

Context for this pass: the three Meta-delivered channels are now **the** product (carrier SMS,
voicemail and calls are dropped as an offer; the code remains). Prior research in this folder
scoped these integrations *before they were built* or scoped the *approval paperwork*. This pass
is different: it audits the **code that exists today** against what the platforms actually allow,
and separates what was verified by reading the repo from what was read about the platforms.

## What this builds on, and what has changed since

| Prior doc | Still stands | What changed |
|---|---|---|
| `2026-09-06-whatsapp-business-production-readiness.md` | Access model (Twilio BSP, per-business self-sign-up), template-approval mechanics, opt-in requirement, pricing shape | It described a **not-yet-built** integration. WhatsApp send/receive now exists in code (`sendWhatsApp`, `/api/twilio/whatsapp/[secret]`). Its central prediction — "the re-engagement case is exactly the case that needs a template library" — was implemented as **one** template SID with **one** variable, which is thinner than what it recommended. |
| `2026-09-06-instagram-meta-business-verification.md` §"24-hour messaging window" | Correct and load-bearing | It recommended "at least a warning" in the UI before sending to an Instagram lead outside the window. **Nothing was built.** Ten days later the channel became the core of the product. |
| `2026-09-08-channel-unblocking-requirements.md` | Approval timelines and ownership table | WhatsApp template approval was rated "not actually a blocker." That was about *approval speed*, and it is still true. The blocker is the **send-path behaviour around the window**, which that doc did not examine because the send path did not exist yet. |
| `2026-09-08-meta-business-agent-webhook-behavior.md` | The `standby`/Handover-Protocol risk on `is_echo` capture | Unchanged and still unverified. Not re-litigated here. |
| `2026-09-10-meta-google-verification-playbook.md` | App Review + Business Verification, per permission, with timelines | Complete and not duplicated here. §6 below adds only the **operational** console steps that playbook does not cover (webhook field subscriptions, Page install, WhatsApp sender, template). |
| `2026-09-06-twilio-sms-compliance.md` (A2P 10DLC) | — | Now largely moot as an offer blocker: carrier SMS is dropped. The Twilio *account* is still required, because WhatsApp rides on it. |

## Method and its limits — read this before quoting anything below

- **Code findings are first-hand.** Every one carries a `file:line`. I read the repo; I changed nothing.
  Two other agents were editing `src/lib/inbound/meta.ts`, `src/lib/twilio.ts`, `src/lib/sending.ts`
  and the settings components while this pass ran (DM opt-out, settings UI). Line numbers are as of
  the working tree on 2026-09-16 and may have shifted; the surrounding code quoted in each finding is
  what to match on.
- **Platform findings are search-sourced only.** `developers.facebook.com` and `www.twilio.com` are
  both EGRESS_BLOCKED from this environment (verified this session — `WebFetch` returns
  `EGRESS_BLOCKED` for both). Every external claim below comes from WebSearch result summaries, not
  from a primary page I fetched. Each is graded:
  - **B** — multiple independent sources agreeing, at least one of them quoting/summarising Meta's or
    Twilio's own documentation page.
  - **C** — vendor/practitioner blogs, consistent with each other, no primary source seen.
  - **D** — single source, or sources that disagree.
- **Nothing here was exercised against a live account.** No Meta app, no Page, no IG Business
  account, no Twilio WhatsApp sender was available. See §5 for the explicit list of what that leaves
  unverified — including one assumption the whole WhatsApp window-handling design rests on.

---

# Ranked: what will most likely break at launch

1. **A WhatsApp follow-up can be reported as sent when WhatsApp never delivered it.** (§1)
2. **Instagram and Messenger have the same 24-hour window as WhatsApp, and the code has no handling
   for it at all** — no template equivalent exists on those channels, and the one legitimate
   extension (`human_agent`, 7 days) is documented as humans-only, so it cannot cover an AI-drafted
   automated follow-up. (§3a)
3. **Every connected Instagram account stops working at 60 days, silently, with no refresh path.** (§2)
4. **Connecting a Facebook Page never subscribes it to the app's webhooks** — no `subscribed_apps`
   call exists anywhere in the repo, so a Page connected by OAuth may deliver nothing. (§3c)
5. **A Lead Ads submission whose fetch fails is permanently lost**, past the "persist first, replay
   later" durability machinery that was built precisely to stop that. (§4)
6. **When an automated follow-up permanently fails, nobody is told** on the silence/unanswered path
   (the sequences path does notify — the asymmetry is the bug). (§1d)
7. **The template path rewrites what the lead receives but records the discarded draft** in the
   thread and the audit trail. (§1c)
8. **Settings tells the owner something the code does not do** ("a follow-up past 24 hours goes by
   email instead" — there is no email fallback). (§1e)
9. Phone-only Facebook Lead Ads leads now route to a channel the product no longer offers. (§4b)

---

## 1. The WhatsApp 24-hour window — does `sendWhatsApp` work, or does it only avoid crashing?

**Verdict: it avoids crashing. Whether it works depends on an assumption about Twilio that this
repo has never verified, and in the failure mode I consider more likely it reports success for a
message the lead never received.**

### 1a. The code path, exactly

`src/lib/twilio.ts:596-605` posts the free-form message. `src/lib/twilio.ts:607` is the whole
window-handling design:

```ts
if (data.code === 63016) {
```

`data` there is the **JSON body of the synchronous `POST /Messages.json` response**, read at
`src/lib/twilio.ts:603`, and the branch is only reachable because `res.ok` was false
(`src/lib/twilio.ts:605`). So this design assumes 63016 arrives as a **synchronous non-2xx with a
`code` field**. The test suite encodes the same assumption:
`src/lib/__tests__/whatsappTemplate.test.ts:49` mocks `jsonResponse(400, { code: 63016 })`. The
tests prove the code behaves correctly *given* that assumption. They cannot prove the assumption.

### 1b. The assumption is doubtful, and that is the single most important finding here

Twilio's own error page documents 63016 as "Outside messaging window. For WhatsApp, use a Message
Template instead." Multiple secondary sources describe it arriving **asynchronously, in the status
callback**, on a message Twilio already accepted with `201 Created` and status `queued` — the
`ErrorCode` field on a `failed`/`undelivered` status callback is exactly where they describe seeing
it. **[Grade C — Twilio's docs pages are EGRESS_BLOCKED here; this is from search summaries of
Twilio's own status-callback and error pages plus practitioner write-ups. Sources disagree in
emphasis and I could not confirm which is authoritative for a WhatsApp sender in 2026.]**

If 63016 is asynchronous (even *sometimes* — e.g. synchronous when Twilio has session state cached,
asynchronous when Meta rejects it downstream), then for that message:

- `src/lib/twilio.ts:605` returns `{ success: true, sid }` — the template retry at
  `src/lib/twilio.ts:616` **never runs**.
- `src/lib/sending.ts:524-527` sets `lead.lastContacted = now`, which takes the lead **out of the
  silence window** — so no later tick retries it.
- `src/lib/sending.ts:531-538` writes an outbound `Message`; `:540-550` writes a `FollowUp` row with
  `status: "sent"`; `:574-580` writes an `ai.send` audit event.
- Twilio's status callback then lands on `src/app/api/twilio/status/[secret]/route.ts:60-69`, which
  writes `deliveryStatus: "failed"` and `deliveryErrorCode: "63016"`.
- **Nothing in the application ever reads `deliveryStatus` or `deliveryErrorCode`.** Verified by
  grep across `src/`: the only non-test references are the two write sites in that same route
  (`:64-65`). No UI, no notification, no automation input.

Net: the owner's dashboard says the follow-up was sent, the thread shows the message, the audit
trail says `ai.send`, the weekly report counts it — and the lead's phone never buzzed. For a
product whose entire promise is "nobody is lost because nobody followed up," a silent
false-positive send is the worst available failure mode, worse than a visible failure.

### 1c. When the template path *does* fire, the record of it is wrong

`src/lib/twilio.ts:616-623` re-sends via the Content API with `ContentSid` and
`ContentVariables: {"1": leadFirstName}` — and **drops `body` entirely**. The lead receives the
approved template wording. But `src/lib/sending.ts:531-538` and `:540-550` store the *original AI
draft* as the `Message.body` and `FollowUp.message`, and `:578` records `length: body.length` in the
`ai.send` audit event.

So the conversation thread, the FollowUp record and the audit trail all show a message that was
never delivered, in place of one that was. This is squarely a trust-guarantee/audit-correctness
defect, not a cosmetic one: `Business.whatsappTemplateBody` already exists in the schema
(`prisma/schema.prisma:154`) precisely because the real wording is worth storing — it just never
reaches the message record.

Also: `ContentVariables` is hardcoded to exactly one variable. A template approved with zero
variables, or two, will be rejected by Twilio; the UI at `src/components/WhatsAppConfig.tsx:412-413`
tells the owner "a single variable for the lead's first name is enough," which is guidance, not
enforcement — nothing validates the pasted Content SID's variable count.

### 1d. What happens to a day-3 follow-up, concretely

Tracing `automation.ts` → `sending.ts` → `twilio.ts` for a lead whose last inbound was a WhatsApp
message four days ago:

| Situation | What actually happens |
|---|---|
| 63016 synchronous, **no** template SID saved | `src/lib/twilio.ts:608-614` returns an honest failure. `providerFailure` (`src/lib/sending.ts:196-206`) classifies it **permanent** (no `status` field is set on this branch, and the prose doesn't match the transient allowlist), so it is **not** queued for retry. `automation.ts:623-625` returns `{ kind: "skipped" }`. That note travels to `src/app/api/cron/automation/route.ts:50`, which returns it as JSON to Vercel Cron. **Nobody is notified.** The lead keeps its automation claim for the ~20h recheck window (`src/lib/automation.ts:626-647`), then qualifies again — so FollowUp re-drafts the same message via OpenAI roughly once a day, forever, and throws it away each time. Silent, recurring spend on a message that can never send. |
| 63016 synchronous, template SID saved | Sent as the template, with the lead's first name. Delivered. But recorded wrongly (§1c). |
| 63016 asynchronous (see §1b) | Reported as **sent**, in every surface. Never delivered. Nobody told. |

To answer the question as asked — "template, skipped, or silently failed?" — **all three, depending
on a Twilio behaviour nobody here has observed.** The one case that is unambiguously fine is the
in-window reply, which is not the case the product is built around.

Note the asymmetry worth fixing regardless: `src/lib/sequences.ts:642` calls `notifySequenceIssue`
on *every* failed send, so a workflow step that can't send does reach a human. The
silence/unanswered trigger in `automation.ts` — the flagship behaviour — does not.

### 1e. Settings promises a fallback that does not exist

`src/components/WhatsAppConfig.tsx:414-415`: "Until then, a follow-up past 24 hours goes by email
instead." There is no such fallback. `src/lib/sending.ts:420-423` calls `sendWhatsApp`, and on
failure returns; no other channel is attempted anywhere in `sendFollowUpToLead`. The doc comment at
`src/lib/twilio.ts:556-557` ("so the caller can fall back to text/email") describes an intention
that was never implemented on the caller side. The settings UI is being edited by another agent
right now — this copy needs to change with the behaviour, in whichever direction it's resolved.

### Proposed patches (for `backend-ai-agent` — not applied)

**P1 — pre-flight the window instead of discovering it from an error.** The decisive fix, and it
removes the dependency on Twilio's error timing entirely. Before an automated WhatsApp send, read
the lead's last **inbound** message time (the same query shape already in
`src/lib/sending.ts:47-54`); if it is older than 24h, go straight to the template path when one is
configured, and hold-and-notify when it isn't. Failure scenario it fixes: lead's last inbound was
4 days ago, business has a template, Twilio accepts the free-form send with `201` and fails it
asynchronously → today the follow-up is recorded as delivered and never retried; with P1 the
template is used on the first attempt and the lead actually receives something.

**P2 — make the status callback load-bearing.** In
`src/app/api/twilio/status/[secret]/route.ts`, on `MessageStatus` in `{failed, undelivered}`, call
the existing `notifyUndeliveredSend`-style path so a human hears about it, and mark the `FollowUp`
row so the weekly report can't count it as sent. Special-case `ErrorCode === "63016"` with a
message the owner can act on. This is the only place that knows the truth about delivery, and today
it writes two columns nobody reads.

**P3 — record what was actually sent.** Have `sendWhatsApp` return which path it took (e.g.
`{ success, sid, sentVia: "template" | "freeform", sentBody }`) and have `src/lib/sending.ts:531`
store `sentBody`. `Business.whatsappTemplateBody` already holds the approved wording. Add the
`sentVia` flag to the `ai.send` audit meta.

**P4 — validate the Content SID's variable count** at save time in `/api/twilio/config`, via
Twilio's Content API, rather than assuming one variable.

**P5 — notify on permanent automated failures** in `automation.ts`, matching
`sequences.ts:642`.

**Test gap to close with the fix** (`src/lib/__tests__/whatsappTemplate.test.ts`): every current
case mocks a synchronous `400 { code: 63016 }`. Add the asynchronous case — `201 { sid }` followed
by a status callback carrying `ErrorCode=63016` — and assert that the follow-up does **not** end up
recorded as a successful send with nobody notified. That test fails today.

---

## 2. Token expiry — does the channel go quiet with nobody told?

**Yes, for Instagram, on a 60-day fuse. There is no refresh path in the repo.**

### 2a. Instagram: a hard 60-day cliff

`src/lib/instagram.ts:299-331` exchanges the auth code for a long-lived token and saves it
(`src/app/api/instagram/oauth/callback/route.ts:41`). `Business.instagramAccessToken` is a bare
`String?` (`prisma/schema.prisma:186`) — **there is no expiry column**, so nothing can even know
when it dies. Grep for `ig_refresh_token` / `refresh_access_token` across `src/`: **no matches**
outside the Outlook integration's unrelated OAuth refresh.

Platform behaviour: Instagram long-lived tokens expire in 60 days; they can be refreshed via
`grant_type=ig_refresh_token` only while the token is **at least 24 hours old, still valid, and the
user still grants `instagram_business_basic`**; and **"tokens that have not been refreshed in 60
days will expire and can no longer be refreshed."** **[Grade B — search summaries of Meta's own
`refresh_access_token` and `access_token` reference pages, corroborated by two independent
practitioner write-ups.]**

What the customer experiences: on day 60, inbound Instagram DMs stop producing leads and every
outbound DM starts failing with a Graph error. `sendInstagramMessage`
(`src/lib/instagram.ts:124-132`) returns `{ success: false, status: 400 }` → classified
**permanent** → `automation.ts` "skipped" → cron JSON → nobody told. The repo's own documentation
already concedes this: `docs/meta-oauth-setup.md:64-67` — *"not yet automated; today a business
reconnects when Instagram capture silently stops working."* That was an acceptable note when
Instagram was one channel among many. It is not acceptable now that it is a core channel: every
customer's Instagram integration is guaranteed to fail within 60 days of connecting, and the
product's only notification mechanism is the customer eventually noticing.

### 2b. Facebook Page tokens: better, but unmonitored

`src/lib/facebook.ts:222-255` derives Page access tokens from a long-lived **user** token. The
comment at `src/lib/facebook.ts:216-219` states Page tokens don't expire on their own and die only
if the user token is revoked or the person loses their Page role — consistent with what I could
find, though I could not fetch Meta's Page-token documentation directly to confirm the 2026 wording.
**[Grade C.]** Real-world invalidations (password change, session invalidation, the admin leaving
the Page, the customer removing the app in Business Settings) produce the same silent-death shape as
Instagram's, with the same absence of monitoring.

### Proposed patches

**P6 — an Instagram refresh cron.** Add `instagramTokenExpiresAt` to `Business`, set it at connect
time, and refresh on a schedule comfortably inside 60 days (e.g. every 30). The refresh call is a
single GET; the constraint is that it must run *before* expiry, because an expired token cannot be
refreshed at all.

**P7 — a connection-health check with a real notification.** A daily ping of
`GET /me` per connected account (Instagram) and per Page (Facebook); on failure, mark the
integration degraded, surface it in Settings, and create a `Notification` for the admins —
"Instagram disconnected; leads coming in on Instagram are not reaching FollowUp" is the message an
owner needs and never gets today.

---

## 3. Rate limits, messaging windows and Meta's policies — what will get an account restricted

### 3a. Instagram and Messenger have the same 24-hour window, and the code respects nothing about it

This is the finding with the widest product consequences, and it is not new information — it was
flagged on 2026-09-06 (`2026-09-06-instagram-meta-business-verification.md:75-80`) with a specific
recommendation. Nothing was built, and the channel mix has since made it central.

Platform rules, as found:
- **A business may send free-form messages only within 24 hours of the person's last message**, on
  both Messenger and Instagram. Outside it, the Send API returns error **code 10, subcode 2018278**
  ("This message is sent outside of allowed window"). The window re-opens each time the person
  messages, clicks Get Started, messages from a Click-to-Messenger ad, reacts, or comments on a
  Page post. **[Grade B — consistent across Meta's Messenger Platform/IG Messaging policy page and
  Send API error reference as surfaced in search summaries, plus two independent vendor error
  references.]**
- **The `human_agent` tag extends this to 7 days — for human-sent messages only.** The sources are
  explicit and consistent: "The Human Agent tag only applies to human-sent messages, automated
  messages are not allowed during the 7-day window," and it requires the Human Agent permission via
  App Review. **[Grade B — Meta's policy page via search summary + Manychat's help doc + two vendor
  guides, all agreeing on both the 7 days and the humans-only restriction.]**
- **The old tag escape hatches are gone.** `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE` and
  `POST_PURCHASE_UPDATE` were retired effective **2026-04-27**; requests carrying them now fail with
  error code 100. Meta's stated migration path is Utility Templates or the Marketing Messages API.
  **[Grade C — Meta's Messenger changelog and a Manychat product-update post via search summaries;
  I could not fetch the changelog directly. This date is five months in the past, so treat it as
  current state, not a deadline.]**
- Outside the window the remaining paths are `human_agent` (humans, 7 days), the **Marketing
  Messages API** (requires explicit opt-in captured *inside* the 24-hour window), One-Time
  Notifications, and Sponsored Messages (paid). **[Grade C — vendor guides agreeing with each
  other; no primary source fetched.]**

What the code does: **nothing.** `src/lib/facebook.ts:46-50` sends
`messaging_type: "RESPONSE"` — correct in-window, and a guaranteed rejection out of window.
`src/lib/instagram.ts:118-122` sends `{ recipient, message }` with no `messaging_type` and no tag
at all. Neither path checks how long ago the lead last messaged. `automation.ts` will happily
select `"instagram"` or `"messenger"` for a lead that went quiet three days ago
(`src/lib/sending.ts:121-122`), draft a message with OpenAI, send it, get code 10 back, classify it
permanent, and log a line in a cron JSON response.

**The product consequence the founder needs to weigh, stated plainly:** on Instagram and Messenger
there is no template mechanism as there is on WhatsApp. The *only* documented way to send a
follow-up on day 3 is the `human_agent` tag, which the sources consistently say is for human-sent
messages — so an AI-drafted, automatically-sent day-3 follow-up on Instagram or Messenger has **no
compliant API path**. What remains legitimate and valuable on those two channels: instant
acknowledgement, in-window AI-drafted replies (the first 24h, which is where most inbound
conversation actually happens), capture, scoring, and escalating to the owner to reply themselves —
with FollowUp drafting the words the human sends. That is a product shape decision, not a bug fix,
and it belongs to `PRODUCT_DIRECTION.md` rather than to a patch.

### 3b. Rate limits are not the problem

Instagram messaging: **100 calls/second** for text/links, 10/s for audio/video; Conversations API
2 calls/s; Private Replies 750/hour on posts and reels. There is no Meta-published "DMs per hour"
cap on the API path. **[Grade C — one limits-reference site plus two vendor blogs agreeing; no
primary page fetched.]** FollowUp's own daily send cap (`src/lib/sendCaps.ts`) is orders of
magnitude below these. Rate limiting is not a launch risk on these channels.

What *does* get an account restricted is policy, not volume: "repeatedly contacting people without
consent or automating messages to mass audiences," and cold DMs to people who never engaged — for
which "no API path allows this in 2026." A restricted Page is notified by email to the Page Support
Inbox. Escalating enforcement is described as 24-48h blocks, then 3-7 day blocks, then suspension.
**[Grade C/D — vendor blogs; the enforcement-ladder specifics are single-sourced and I would not
quote them to a customer.]** FollowUp's posture is structurally on the right side of this — every
message is a reply to someone who contacted the business first, and volume is capped — but the
out-of-window automated send in §3a is precisely the behaviour these policies describe, and it is
currently attempted.

### 3c. Connecting a Page never subscribes it to the webhook

To receive Page webhooks, the app must be *installed on the Page*:
`POST /{page-id}/subscribed_apps?subscribed_fields=...` with the Page access token. Meta's own Lead
Ads webhook documentation is explicit that "webhook notifications will only be sent if your Page has
installed your Webhooks configured-app," and that subscribing to `leadgen` requires
`leads_retrieval`. **[Grade B — Meta's `webhooks-for-leadgen` and Marketing API webhook-integration
pages via search summaries, plus three independent implementation write-ups showing the same call.]**

**No `subscribed_apps` call exists anywhere in this repo.** Verified by grep across `src/` and
`docs/`: zero matches for `subscribed_apps` or `subscribed_fields`. `docs/meta-oauth-setup.md` does
not mention the step either. `pages_manage_metadata` — the permission that authorises it — is
already requested (`src/lib/facebook.ts:190`), which suggests the step was intended and then
missed.

The practical effect: a Page connected through the one-click OAuth flow may be fully "connected" in
Settings and deliver **no Messenger DMs and no Lead Ads** at all. A Page the founder wires up by
hand in the App Dashboard (Messenger → Settings → add Page) will work, which is exactly how this
survives testing and breaks for the first real customer.

**P8 — call `subscribed_apps` at connect time** in
`/api/facebook/oauth/callback` and `/select-page` (and in the paste-a-token path in
`/api/facebook/config`), subscribing `messages`, `messaging_postbacks`, `message_echoes` and
`leadgen`, and surface a clear error if it fails rather than reporting "connected."

### 3d. Instagram has a customer-side toggle no code can substitute for

An Instagram professional account must have **"Connected tools → Allow access to messages"** enabled
in the Instagram app, or messaging webhooks do not arrive. **[Grade C — Sinch's troubleshooting doc
and two vendor integration guides agreeing; not confirmed against Meta's own page.]** This is a
setting on each *customer's* phone, not in the founder's console and not in FollowUp's code. It
belongs in the connect flow's instructions and in whatever "why is Instagram quiet?" diagnostic gets
built alongside P7.

---

## 4. Lead Ads — does anything downstream assume a conversation thread?

**Nothing assumes a thread exists, which is correct. The problems are different, and two are real.**

`src/lib/inbound/meta.ts:192` explicitly creates a `"web"` conversation for a Lead Ads submission
and stores the form answers as a synthetic inbound message keyed on `leadgen_id` (`:196`). No
Messenger PSID is invented, and no send path tries to reply on Messenger to a Lead Ads lead — which
is right, because there is no thread and no PSID to reply to.

### 4a. A failed leadgen fetch loses the lead permanently — past the durability machinery

`src/lib/facebook.ts:139-151`: if the Graph call fails (expired Page token, missing
`leads_retrieval`, Graph hiccup), `fetchLeadgenLead` logs to `console.error` and returns `null`.
`src/lib/inbound/meta.ts:187-188` then does `if (!data) continue;`.

Because that `continue` is not a throw, `dispatch` returns normally and
`src/lib/inboundEvents.ts:123` marks the stored `InboundWebhookEvent` **processed**. And
`replayInboundWebhookEvent` refuses processed rows outright
(`src/lib/inboundEvents.ts:193`: `if (event.status === "processed") return { replayed: false, message: "Already processed." }`).

So the one mechanism built to guarantee "never lose an inbound message" is switched off for exactly
the failure it should catch. The webhook envelope only ever contained a `leadgen_id`, and the
fetchable lead data expires on Meta's side, so this is not theoretical recovery lost — it is a real
lead, from a paid ad, gone with a line in a serverless log.

The same shape applies at `src/lib/inbound/meta.ts:190` (`if (!result) continue;`) when
`upsertLeadFromLeadgen` returns `null` — which it does whenever the form captured **neither email
nor phone** (`src/lib/facebook.ts:158`). A lead form asking only "What are you looking for?" plus a
name produces nothing at all, silently.

**P9 — throw instead of `continue`** when `fetchLeadgenLead` returns `null`, so the event row is
marked failed and stays replayable. (Meta retries a non-2xx, but this route always answers 200 by
design — so the stored row is the only retry mechanism, which makes marking it `failed` the entire
point.) And create the lead from whatever the form *did* provide rather than dropping it, keying on
`leadgen_id` when there's no email or phone.

### 4b. Phone-only Lead Ads leads now point at a dropped channel

For a Lead Ad lead with a phone and no email: `detectAutomatedReplyChannel`
(`src/lib/sending.ts:107-129`) sees `lastChannel === "web"` (not send-capable), falls through the
static order — no email, `phone` is a real number so not an `ig:`/`fb:` id — and lands on
`detectPhoneChannel` (`:127`), which with no WhatsApp inbound returns **`"text"`**. SMS. The channel
the founder just dropped.

Worse if it silently "works": messaging a Lead Ads phone number on WhatsApp would be a
**business-initiated** conversation requiring a template *and* documented opt-in — and a Lead Ad form
submission is not, by itself, WhatsApp opt-in (Meta's opt-in requirement was covered in
`2026-09-06-whatsapp-business-production-readiness.md` §4 and can be requested during template
review). So the right behaviour is almost certainly: email if present, otherwise route to a human,
and never auto-WhatsApp a number that only ever appeared in an ad form. Today the code will pick SMS,
which after the channel drop means a Twilio number that may not exist and a send that fails
permanently and silently.

This is a product decision plus a code change and should go to `backend-ai-agent` with the founder's
call on it, not be patched unilaterally.

### 4c. Minor

- `src/lib/facebook.ts:150` hardcodes `formName: null` while explicitly requesting `form_id` in the
  same query — the field is fetched and thrown away.
- Lead Ads is the one Meta path that calls `notifyLeadEvent` (`src/lib/facebook.ts:178`), so the
  outbound-webhook SSRF protections apply to it and not to the DM paths. No defect found; noted so
  the next auditor doesn't re-derive it.

---

## 5. What is untested and unverifiable without live credentials — explicitly

I exercised **none** of the following. No Meta app, Page, Instagram Business account, Twilio
WhatsApp sender, or approved template was available in this environment, and both
`developers.facebook.com` and `www.twilio.com` are EGRESS_BLOCKED, so I could not even read the
primary documentation.

1. **Whether Twilio returns 63016 synchronously or asynchronously.** The entire WhatsApp
   window-handling design rests on "synchronously." Everything in §1b is inference from secondary
   sources. **This is the single highest-value thing to test with real credentials, and it takes
   ten minutes:** send a free-form WhatsApp message to a number with no open session and log both
   the HTTP response and every status callback.
2. **Whether the Content API template retry works end-to-end** against a real approved template —
   variable substitution, sender/template association, and what Twilio returns when the variable
   count doesn't match.
3. **Whether a Page connected purely through FollowUp's OAuth flow receives any webhooks at all**
   without a `subscribed_apps` call (§3c). Testing this needs a Page *not* wired up by hand in the
   App Dashboard, which is easy to get wrong.
4. **The exact Graph error for an out-of-window Instagram/Messenger send**, and therefore whether
   `isTransientError` classifies it the way this report assumes (permanent).
5. **Whether `is_echo` events actually arrive** for Meta Business Agent-held threads, or arrive on a
   `standby` field this route never reads — carried forward unchanged from
   `2026-09-08-meta-business-agent-webhook-behavior.md`; still open, still untested.
6. **Instagram token refresh mechanics** in practice (the 24h-minimum-age condition, behaviour near
   the boundary).
7. **Every timeline, limit, policy date and error code in §3.** All search-sourced, graded inline.
   I fetched no primary page this session.

---

## 6. What the founder must do in Meta's console — in order

App Review and Business Verification themselves are covered in detail in
`2026-09-10-meta-google-verification-playbook.md` (§1, and the phased checklist in §3) and are not
repeated. This is the **operational** sequence around them, including the steps that playbook does
not cover. Steps marked **[code gap]** are things that cannot be finished in the console because the
code doesn't do its half yet.

1. **Business Verification of the business portfolio** — gates Advanced Access for every permission
   below, and is the longest pole. Start it first. (Playbook §1.7, §1.8.)
2. **Data-deletion callback URL** in App Dashboard → Settings → Basic — a hard submission blocker
   per playbook §4.1. Do it before submitting anything.
3. **Webhooks product → Instagram**: subscribe the `messages` field to
   `https://followupbase.io/api/instagram/webhook`, verify token `followup_ig_a8f3c1e0d92b47`
   (`src/lib/instagram.ts:46`).
4. **Webhooks product → Page**: same callback URL, subscribe `messages`, `messaging_postbacks`,
   `message_echoes` and `leadgen`. App-level subscription only — **it does not subscribe any
   individual Page** (see step 8).
5. **Confirm both app secrets are set in Vercel**: `INSTAGRAM_APP_SECRET` *and* `FACEBOOK_APP_SECRET`.
   `validateMetaSignature` (`src/lib/instagram.ts:76-91`) tries both and **fails closed** if neither
   is configured — with only one set, every delivery signed by the other product is answered 403,
   and Meta eventually disables the subscription.
6. **App Review submissions** for `instagram_business_basic`,
   `instagram_business_manage_messages`, `pages_show_list`, `pages_messaging`,
   `pages_manage_metadata`, `pages_read_engagement`, `leads_retrieval` — screencast requirements and
   rejection reasons in playbook §1.3 and §1.5. Expect the Instagram DM scope to be the slow one.
7. **Decide about `human_agent`** (§3a). If day-3 Instagram/Messenger follow-up matters at all, this
   permission is the only documented route — and per the sources it authorises a *human's* message
   within 7 days, not an automated one. Worth resolving before the product promises day-3 follow-up
   on those channels.
8. **[code gap]** **Install the app on each customer's Page.** Meant to be automatic at connect time
   (P8) and currently isn't. Until it is, every connected Page needs the app added by hand in the App
   Dashboard (Messenger → Settings → Add Page), which does not scale past the founder's own test Page.
9. **WhatsApp, in the Twilio console** (not Meta's): register the WhatsApp sender under the
   customer's own Meta Business Manager via Twilio self-sign-up, and point its "When a message comes
   in" at `https://followupbase.io/api/twilio/whatsapp/<twilioSecret>`. Per
   `2026-09-06-whatsapp-business-production-readiness.md` §2 this is **per customer business**, not
   once for FollowUp, and an unverified sender is capped at 250 business-initiated messages/24h.
10. **Create and get one WhatsApp template approved** in Twilio's Content Template Builder, single
    variable, utility-style wording, and paste its Content SID into Settings. Without it, every
    WhatsApp follow-up past 24 hours fails (§1d) — and with it, §1c's recording bug applies until
    P3 lands.
11. **Each customer, on their own phone**: Instagram app → Settings → Messages → Connected tools →
    "Allow access to messages" (§3d). No console step and no code change substitutes for it.

---

## Sources checked 2026-09-16

All via WebSearch result summaries. `developers.facebook.com` and `www.twilio.com` both returned
`EGRESS_BLOCKED` on direct fetch this session — no primary page was read in full.

- https://www.twilio.com/docs/api/errors/63016
- https://help.twilio.com/articles/360038232293-Error-63016-Failed-to-send-freeform-message-because-you-are-outside-the-allowed-window-Please-use-a-Template-when-Sending-Programmable-Messages-to-WhatsApp
- https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks
- https://support.twilio.com/hc/en-us/articles/223134347-What-are-the-possible-SMS-and-MMS-message-statuses-and-what-do-they-mean
- https://www.telphiconsulting.com/blog/twilio-error-63016
- https://www.telphiconsulting.com/blog/twilio-status-callbacks
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy (search summary only — direct fetch blocked)
- https://developers.facebook.com/docs/messenger-platform/changelog/ (search summary only)
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/ (search summary only)
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/quickstart/webhooks-integration (search summary only)
- https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/ (search summary only)
- https://developers.facebook.com/docs/instagram-platform/reference/access_token/ (search summary only)
- https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram
- https://community.manychat.com/product-updates/meta-s-deprecation-of-the-message-tags-feature-on-messenger-9010
- https://www.conferbot.com/errors/messenger/10-2018278
- https://www.conferbot.com/limits/instagram
- https://www.keyapi.ai/blog/instagram-messaging-api-policy/
- https://creatorflow.so/blog/instagram-dm-compliance-meta-rules/
- https://community.sinch.com/t5/Instagram/Troubleshooting-the-integration-between-your-Instagram-business/ta-p/9197
- https://developers.sinch.com/docs/conversation/channel-support/instagram/set-up/
- https://www.getfishtank.com/insights/renewing-instagram-access-token
- https://sumgenius.ai/blog/instagram-dm-bot-ban-wave-2026/ (Grade D claims only)
