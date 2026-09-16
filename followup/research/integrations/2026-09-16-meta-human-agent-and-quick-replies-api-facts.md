# Meta quick replies and the `human_agent` tag — the platform facts before PR B and PR C

**Date checked:** 2026-09-16. Branch `claude/followup-demo-to-production-4k39hr`. **No code changed.**

**Why this exists:** two things are about to be built — quick replies on Instagram DM and Messenger
(PR B), and an owner-tapped out-of-window send under `human_agent` (PR C). Every field, limit,
error and policy line those PRs depend on is pinned here, graded, or explicitly marked *not found*.
Nothing below is invented; where a fact could not be sourced the entry says so.

**Builds on, does not repeat:** `2026-09-16-meta-channels-production-audit.md` §3a (the window,
error 10/2018278, tag retirement) and `../product/2026-09-16-meta-window-close-what-shipped-products-do.md`
§1 (only the person's action resets the clock), §3.2 (allowances) and §8.2 (the SleekFlow
contradiction, resolved in §B1 below).

## Evidence quality — read before quoting

`developers.facebook.com` is **EGRESS_BLOCKED** from this sandbox (re-verified this session on
three separate Meta URLs). So are `web.archive.org`, `r.jina.ai`, `postman.com`, `conferbot.com`,
`chatwoot.com`, `developers.chatwoot.com`, `help.sleekflow.io`, `developers.cm.com`,
`developers.sinch.com`, `community.manychat.com`, and GitHub repos not attached to this session
(`api.github.com` answers 403 for `chatwoot/chatwoot`). **No primary page was read in full.** Every
platform claim comes from WebSearch result summaries of the URLs listed at the end.

| Grade | Means |
|---|---|
| **B** | Several independent sources agree and at least one is a summary of Meta's own page (URL given). |
| **C** | Vendor/practitioner sources agree with each other; no Meta wording seen. |
| **D** | Single source, or sources disagree. Recorded so nobody re-finds it and trusts it. |
| **Code** | First-hand read of the working tree today. |
| **Inference** | My reasoning. Never quote as a finding. |

---

## A. Quick replies

### A1. Does Instagram support quick replies on the endpoint `instagram.ts` uses?

**Yes.** Meta publishes a dedicated quick-replies page under *Instagram API with Instagram Login*
(`/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies/`), the
same product family whose host (`graph.instagram.com`) and token type (Instagram User access token)
`src/lib/instagram.ts:10` and `:118` already use. A second copy lives under the Messenger-Platform
"Instagram Messaging" tree for the Facebook-Login route. **[Grade B — three Meta URLs surfaced with
consistent summaries; CM.com and Sinch ship the feature on Instagram.]**

### A2. Request shape (both platforms)

Quick replies are a property of the `message` object, alongside `text`:

```json
"message": {
  "text": "...",
  "quick_replies": [
    { "content_type": "text", "title": "...", "payload": "..." }
  ]
}
```

**[Grade B — field names `content_type`/`title`/`payload` appear in every Meta summary and every
secondary source; identical on Instagram and Messenger.]**

### A3. Limits

| | Instagram (Instagram Login) | Messenger |
|---|---|---|
| Max quick replies | **13** **[B — Meta IG page]** | **13** **[B — Meta reference wording "up to 13 buttons" via summary; CM.com, Rasa, Ampalibe agree]** |
| Title | **20 characters, truncated** beyond that (not rejected) **[B]** | **20 characters** **[B]**; whether over-length is truncated or rejected: *not found* |
| Payload | *Length limit not found for Instagram* | **1000 characters** **[B/C — the phrase "custom data that will be sent back … 1000 character limit" reads as Meta's own field description via summary; CM.com and Ampalibe repeat it]** |
| `content_type` values | **`text` only** — "quick replies only support plain text" **[B]** | `text`, plus `user_phone_number` / `user_email` and an optional `image_url` on `text` **[C — Meta reference not readable; from library docs]** |
| Where they render | **Instagram app only — "not available on desktop"** **[B — Meta IG page]** | Messenger surfaces |

Ignore the "11 quick replies" figure some search results carry — it is LivePerson's own cap, not
Meta's. **[D — noted so nobody re-finds it.]**

### A4. How a tap arrives on the webhook

A tap is delivered as a **`messages` event, not a `postback`**. Meta's IG page: "the title of the
tapped button is posted to the conversation as a message … a messages event will be sent to your
webhook that contains the button title and an optional payload. The `text` property of the event
will correspond to the title of the Quick Reply, and the message object will also contain a field
named `quick_reply` containing the payload data." Messenger's `messages` webhook reference shows the
same shape:

```json
"message": {
  "mid": "<MID>",
  "text": "<TITLE OF TAPPED BUTTON>",
  "quick_reply": { "payload": "<DEVELOPER_DEFINED_PAYLOAD>" }
}
```

**[Grade B — Meta's IG quick-replies page and Meta's Messenger `messages` webhook reference, both
via summary; Sunshine Conversations and Rasa show identical parsing.]** One wrinkle to flag: Meta's
own *payload* field description on the Messenger page says the payload comes back "via the
`messaging_postbacks` webhook event" — that sentence is contradicted by Meta's own webhook reference
and by every implementation; the payload arrives inside the `messages` event. **[Inference on the
contradiction; the `messages` delivery is Grade B.]** `messaging_postbacks` is only for buttons,
Get Started and ice breakers, none of which PR B uses.

### A5. Does a tap reset the 24-hour window? — the one that matters

**I could not confirm the words "quick reply" in Meta's eligible-actions list from a Meta page.**
What Meta's pages *do* say (via summary):

1. The standard window is opened/reset when "a person sends a message to your Page or Instagram
   Professional account" (plus Get Started, Click-to-Messenger ad + message, plugins, m.me links,
   reactions, comments). **[B — Meta policy page via summary; beesender and customers.ai reproduce
   the same list.]**
2. A quick-reply tap "is posted to the conversation as a message" and is delivered as a `messages`
   event (A4). **[B]**

Put together, a tap *is* the person sending a message in every mechanical sense Meta describes.
**[Inference from two Grade-B statements.]** Best secondary sources stating the reset outright:
Khoros' Messenger policy note ("clicking on a quick reply button" listed among clock-reset actions),
Trengo, customers.ai for Messenger; Manychat, Spur and creatorflow for Instagram ("when the user
clicks a button or selects a quick reply, it counts as a new interaction — which resets the 24-hour
messaging window"). **[Grade C — consistent across six vendors; none quotes Meta verbatim.]**
(`../product/2026-09-16-instagram-getting-a-reply-buttons-and-questions.md:69`, written the same
day, grades the same sentence B on Manychat's help page. Same fact; I hold it at C because no source
quotes Meta. Not a disagreement on what to build.)

**Working assumption for PR B: a tap resets the window on both platforms.** It is the industry-wide
assumption, it follows from Meta's own description of the mechanism, and FollowUp's own pre-flight
(when built — audit P1) will count it automatically because the tap lands as an inbound `Message`
row. **Verify with a live token** (§E) before any copy promises it. Note also that a tap starts a
fresh 7-day `human_agent` clock for the same reason — it is "a user's message" (§B4). **[Inference.]**

---

## B. The `human_agent` tag

### B1. Does it exist on Instagram? — resolving the contradiction

**Yes, on Instagram, on both API routes.** The evidence against SleekFlow's "Instagram doesn't have
a human agent tag":

- Meta's Instagram Platform overview: "If your app user uses a human agent to respond to messages
  and therefore may need more time to respond, your app can tag the response to allow your app to
  send the message outside the 24 hour messaging window … use the human agent tag to send a response
  within 7 days." **[B — Meta page via two independent summaries.]**
- Meta's feature reference page `/docs/features-reference/human-agent` is summarised as applying to
  "both Instagram and Messenger." **[B]**
- Meta's Instagram Send Messages page: "A message tag `HUMAN_AGENT` can be applied, allowing a human
  agent to respond … up to 7 days after the user's last message" and "you can provide an escalation
  path for human agent only messaging experiences with a custom inbox." **[B]**
- Meta's policy page: "some tags are available on both Messenger Platform and IG Messaging API";
  secondary sources list `ACCOUNT_UPDATE`, `CONFIRMED_EVENT_UPDATE`, `CUSTOMER_FEEDBACK` as "Not
  available" on Instagram — leaving `HUMAN_AGENT` as the one that is. **[B/C]**
- Meta's own Postman workspace contains a request titled "Send a message with HUMAN_AGENT tag |
  Instagram API." **[B for existence — the page itself is blocked here.]**
- Chatwoot issue #4689 records Chatwoot *receiving* the permission and changing code "to send the
  message_tag with Instagram messages"; CM.com and Sinch expose `INSTAGRAM_MESSAGE_TAG: HUMAN_AGENT`.
  **[C]**
- A Manychat community thread reports Instagram returning "Unsupported message tag" specifically for
  `HUMAN_AGENT` — which only happens if Instagram parses and gates the tag. **[C/D]**

SleekFlow's sentence is the sole dissent and most plausibly describes *SleekFlow's* Instagram channel
(they do use the tag on Messenger). **Treat the product research's §8.2 as resolved: build on it.**
**[Inference on why SleekFlow says it; Grade B on the platform fact.]**

**Which API version:** not found. No source ties the tag to a minimum Graph version; the Instagram
Login route (`graph.instagram.com`) is the one Meta's Postman collection targets. **[D on version.]**

### B2. What App Review requires

- **Name:** "Human Agent" is an App Review **feature**, not a permission scope — it sits in App
  Dashboard → App Review → Permissions and Features and is requested with its own "Request advanced
  access" button, separately from `instagram_business_manage_messages` / `pages_messaging`.
  **[B — Meta's features-reference URL is `/features-reference/human-agent`; Yeastar and LiveAgent
  submission guides describe the same screen; chatimize: "a separate App Review item … not bundled
  into the base messaging permission."]**
- **Use-case text Meta expects** (its own allowed-usage wording): "provide human agent support in
  cases where a user's issue cannot be resolved in the standard messaging window, such as when the
  business is closed for the weekend, or if the issue requires more than 24 hours to resolve."
  **[B]** Chatwoot's accepted template phrases it as "support agents follow up on customer
  conversations beyond the 24-hour window, so that on Monday morning an agent can follow up on a
  conversation from Friday night." **[C]**
- **Screencast:** required — "a screencast that demonstrates how your app uses a human agent tag to
  respond to customer messages." **[B — Meta features page via summary.]** The playbook's general
  screencast rules (`2026-09-10-meta-google-verification-playbook.md` §1.3) apply: show a human in
  FollowUp's inbox replying to a DM older than 24h and the reply landing in Instagram/Messenger.
- **Business Verification:** required (Advanced Access rule; chatimize states it for this feature
  specifically). **[C]**
- **Typical review time for this feature specifically: not found.** Use the playbook's general
  ~20-day expectation with one rejection cycle budgeted (§1.4, Grade C).
- **Red herrings:** Genesys' "HUMAN_AGENT message tag deprecation" is a 2021 note about early-adopter
  apps losing the beta grant at GA, not a Meta deprecation; Manychat's Feb-2026 "deprecation of the
  Message Tags feature" explicitly exempts `HUMAN_AGENT` ("not affected … will continue to work"). **[C]**

### B3. What Meta returns when the tag is sent without the feature

**Not found on any Meta page.** Best secondary evidence, graded:

| Situation | Response | Grade |
|---|---|---|
| `tag: "HUMAN_AGENT"` on an app without the feature (Instagram) | HTTP 400, message **"Unsupported message tag"**; code/subcode **not reported** | **C/D** — one Manychat community thread; keyapi's blog repeats the string |
| Feature-level permission missing, generic | code **10**, *no* subcode, "API Permission Denied. Permission is either not granted or has been removed" | **C** — conferbot |
| Out-of-window send with no valid tag | code **10**, subcode **2018278** *or* **2534022**, "This message is sent outside of allowed window" | **B/C** — conferbot, echoglobal, Re:amaze, an n8n thread showing it live on Instagram |
| Retired tags (`ACCOUNT_UPDATE` etc.) | code **100** ("Invalid parameter" per Chatwoot #14679) | **C** |

**Consequence for PR C:** the sender must log `error.code`, `error.error_subcode` and
`error.message` verbatim on every non-2xx, because the first live run is what will pin the
no-permission error — and today's code throws all three away (§D).

### B4. The 7-day limit and what it is measured from

**7 days, measured from the person's last message.** Meta: "within 7 days of a user's message";
Instagram Send Messages page: "up to 7 days after the user's last message." **[B — two Meta pages
via summary; Chatwoot, Manychat, respond.io, Tidio agree.]** Nothing the business sends restarts
either clock (product research §1). A quick-reply tap is a user message, so it restarts both.
**[Inference.]** What Meta returns on day 8 with the tag: **not found** — assume the same code-10
window error and verify.

### B5. Is the tag legitimately usable for a message a human tapped "send" on inside FollowUp?

**Yes — that is the documented shape, not a loophole.** The tag is an API concept: it exists
*because* businesses reply from custom inboxes via the API rather than Meta's own inbox. Meta's own
wording is "allows **your app** to have a human agent respond to user messages using the
`human_agent` tag" and "provide an escalation path for human agent only messaging experiences with a
**custom inbox**." **[B]** Manychat and respond.io apply it automatically on any human send from
their inbox; Chatwoot makes the agent apply it deliberately. **[B — product research §2.1.]**

**Where the policy line is** (URL: Meta's Messenger Platform and IG Messaging API policy page,
`/documentation/business-messaging/messenger-platform/policy`; feature page
`/docs/features-reference/human-agent`):

1. **Human-sent only.** "The Human Agent tag only applies to human-sent messages; automated messages
   are not allowed during the 7-day window." **[B — Manychat help quoting policy; every vendor
   agrees; Meta's feature page says "have a human agent respond".]** Meta is described as detecting
   misuse and revoking the feature. **[C]**
2. **Responsive to the person's inquiry.** The allowed usage is *support where the issue could not
   be resolved in 24h* — weekend closure, an answer that took more than a day. **[B]**

Two grey zones PR C must not paper over — both **Inference**, both consistent with the product
research's §7.3:

- **An AI-drafted message a human reads and taps.** No Meta wording addresses drafting tools either
  way. Manychat/respond.io users demonstrably paste drafts into inboxes that auto-tag. The defensible
  posture: the human sees the full text, can edit it, taps once per message, and the audit trail
  records a user id, not `userId: null`. Never batch-approve, never schedule-after-tap, never
  default-on.
- **A "still interested?" nudge that answers nothing.** The allowed-usage text is about *resolving
  the user's issue*. A day-3 message that actually answers the lead's open question (the quote, the
  availability) is squarely inside it; a bare re-engagement ping is a weaker fit. The draft the owner
  is handed should be anchored on what the lead asked. This is a product-copy constraint, not an
  API one.

---

## C. The exact bodies FollowUp should send

Version placeholders: `facebook.ts` pins `v21.0`, usable until **2027-01-21** **[C — Meta versions
changelog via summary]**; `instagram.ts` pins nothing (§D). Pick one current version for both.

**(1) In-window Instagram DM with 3 quick replies — Instagram Login route**
`POST https://graph.instagram.com/v{N}/{IG_USER_ID}/messages` (Meta documents `/<IG_ID>/messages`;
`/me/messages` is reported to work but is not the documented path **[C/D]**), Instagram User token.

```json
{
  "recipient": { "id": "<IGSID>" },
  "message": {
    "text": "Want me to pencil you in? Pick one:",
    "quick_replies": [
      { "content_type": "text", "title": "Yes, book me",   "payload": "QR_BOOK" },
      { "content_type": "text", "title": "Send a quote",   "payload": "QR_QUOTE" },
      { "content_type": "text", "title": "Not right now",  "payload": "QR_LATER" }
    ]
  }
}
```
**Field names and limits: confirmed from Meta docs (via summary). Path/version: best reconstruction,
verify with a live token.** No `messaging_type` — Meta's Instagram examples omit it. Titles ≤20
chars; `text` only.

**(2) In-window Messenger message with 3 quick replies**
`POST https://graph.facebook.com/v{N}/{PAGE_ID}/messages`, Page token.

```json
{
  "recipient": { "id": "<PSID>" },
  "messaging_type": "RESPONSE",
  "message": {
    "text": "Want me to pencil you in? Pick one:",
    "quick_replies": [
      { "content_type": "text", "title": "Yes, book me",   "payload": "QR_BOOK" },
      { "content_type": "text", "title": "Send a quote",   "payload": "QR_QUOTE" },
      { "content_type": "text", "title": "Not right now",  "payload": "QR_LATER" }
    ]
  }
}
```
**Confirmed from Meta docs (via summary)** — this is the canonical Send API quick-replies example
plus the `messaging_type` the current code already sends. Payload ≤1000 chars, title ≤20.

**(3) Out-of-window (day 2–7) Instagram DM under `human_agent` — Instagram Login route**
Same endpoint and token as (1). Send **only** from a human's tap.

```json
{
  "recipient": { "id": "<IGSID>" },
  "messaging_type": "MESSAGE_TAG",
  "tag": "HUMAN_AGENT",
  "message": { "text": "Sorry for the wait — here's the quote you asked for: ..." }
}
```
**Best reconstruction, verify with a live token.** The `messaging_type`/`tag` pair is the Messenger
Send API shape (4); Meta's Postman collection confirms an Instagram-API `HUMAN_AGENT` request exists
but its body could not be read. Two things to test on first live use: whether the Instagram Login
host accepts `messaging_type` at all (if not, try `tag` alone), and the exact error before the
feature is granted (§B3).

**(4) Out-of-window (day 2–7) Messenger message under `human_agent`**
Same endpoint and token as (2).

```json
{
  "recipient": { "id": "<PSID>" },
  "messaging_type": "MESSAGE_TAG",
  "tag": "HUMAN_AGENT",
  "message": { "text": "Sorry for the wait — here's the quote you asked for: ..." }
}
```
**Confirmed from Meta docs (via summary):** "resend with `messaging_type` `MESSAGE_TAG` and `tag`
`HUMAN_AGENT`, valid within 7 days of the person's message, once your app holds the Human Agent
permission." Chatwoot #14679 independently shows that `MESSAGE_TAG` with a *retired* tag is
rejected and `RESPONSE` without a tag succeeds in-window — i.e. the two shapes are mutually
exclusive, never both.

Whether `quick_replies` may be combined with a `HUMAN_AGENT` send: **not found**. Do not ship that
combination in PR C; test it separately.

---

## D. What FollowUp's current code gets wrong against these facts

All **Code** grade, working tree 2026-09-16.

1. **`src/lib/instagram.ts:10`** — `GRAPH_API = "https://graph.instagram.com"` with **no version**,
   and `:118` calls `/me/messages` unversioned. Meta's own FAQ: unversioned calls are "converted to
   the oldest available version an app can access." **[B]** Every Instagram send today runs on
   whatever the oldest version is for this app, silently. Pin a version, and use the stored
   `Business.instagramUserId` (`/{IG_USER_ID}/messages`, the documented path) instead of `/me`.
2. **`src/lib/instagram.ts:102-105`** — signature is `(businessId, recipientId, text)`; **`:121`**
   builds `{ recipient, message: { text } }`. There is no way to pass `quick_replies`, a
   `messaging_type`, or a `tag`. PR B and PR C both need an options object here.
3. **`src/lib/instagram.ts:124-132`** and **`src/lib/facebook.ts:51-59`** — on a non-2xx, only
   `data.error.message` and `res.status` survive; **`error.code` and `error.error_subcode` are
   discarded.** That makes a closed window (10/2018278 or 10/2534022), a missing Human Agent
   feature ("Unsupported message tag"), a retired tag (100) and a dead token all look like "400 +
   prose." §B3 depends on these being logged verbatim from the first live send.
4. **`src/lib/facebook.ts:49`** — `messaging_type: "RESPONSE"` is hard-coded. Correct in-window;
   it must become `MESSAGE_TAG` + `tag: "HUMAN_AGENT"` on the human path and *only* there. Same
   missing `quick_replies` as (2).
5. **`src/lib/sending.ts:442-447`** — both senders receive only `body`. `sendFollowUpToLead` already
   knows `options.automated` and `options.trigger === "manual"` (`:216-229`), but nothing plumbs
   "a human tapped this" down to the sender, so there is no place today where the tag could be
   attached safely. The tag must be derived from an authenticated human action, never from a flag
   a cron can set.
6. **`src/lib/sending.ts:196-206` → `src/lib/transientError.ts:28-53`** — a Meta 400 is classified
   `permanent` (correct), but every out-of-window rejection is then a silent cron-JSON "skipped"
   (audit §1d). With window pre-flight absent, PR C's owner-tap path would inherit the same
   silence on a day-8 send. Pre-flight (audit P1) is a prerequisite, and day-8 must be refused
   *before* the API call.
7. **`src/lib/inbound/meta.ts:41-60`** — `messageContent` reads `message.text` and
   `message.attachments` only. **`message.quick_reply.payload` is dropped.** A tap therefore
   arrives as `ownWords = "<button title>"`: it is stored, it counts as an inbound `Message` (so the
   window pre-flight will correctly treat it as a reset — the one thing that works by accident), but
   nothing can branch on `QR_BOOK` vs `QR_LATER`, and **`:198` / `:252` hand the title to
   `acknowledgeNewLead` as if the lead had typed it**, so FollowUp would generate an acknowledgement
   to a button press. PR B must read the payload and route taps away from the free-text ack path.
8. **`src/lib/inbound/meta.ts:146-171`, `:222-239`** — the `is_echo` capture stores only `text`, so
   FollowUp's own quick-reply message is recorded without its buttons (the audit trail will not show
   what the lead was offered). And there is no `postback` branch anywhere in the file — not a PR B/C
   defect, noted so nobody adds buttons or ice breakers later and wonders why taps vanish.

---

## E. What only a live token can settle — in test order

1. Send (1) and (2); confirm the tap arrives as a `messages` event with `quick_reply.payload` and
   that a follow-up plain send succeeds >24h after the lead's last *typed* message but <24h after
   the tap. That single test settles §A5.
2. Send (3) and (4) **before** the Human Agent feature is granted and record the full error JSON
   (code, subcode, message). That settles §B3.
3. After the grant: send (3) — if the Instagram Login host rejects `messaging_type`, retry with
   `tag` alone and record which shape works.
4. Send (4) on day 8 and record the error, to pin what "7 days" looks like on the wire.

---

## Handover — PR B and PR C

- **PR B (quick replies), `backend-ai-agent`:** add an options object to `sendInstagramMessage` and
  `sendMessengerMessage` carrying `quickReplies?: { title: string; payload: string }[]`; enforce
  ≤13 items, titles ≤20 chars, payloads ≤1000 chars at the boundary, `content_type: "text"` only.
- **PR B:** pin a Graph version in `instagram.ts:10` and switch `/me/messages` to
  `/{instagramUserId}/messages`; keep `facebook.ts` on a version with a known sunset (v21.0 ends
  2027-01-21).
- **PR B:** `messageContent` in `inbound/meta.ts` must return `quickReplyPayload` when
  `message.quick_reply.payload` is present, and both inbound paths must route a tap to a payload
  handler instead of `acknowledgeNewLead`; the tap still writes an inbound `Message` row so the
  window pre-flight sees it as a reset.
- **PR B, copy/UX (`frontend-3d-agent` via the design-brain loop):** quick replies do not render on
  Instagram desktop; the owner-facing copy must not promise the lead "will see buttons."
- **PR C (`human_agent`), `backend-ai-agent`:** the tag is attached only when the send originates
  from an authenticated user's explicit per-message tap (`trigger: "manual"`, real `userId`), never
  from cron, sequences, `auto_send`, or a bulk action; the sender refuses if the last inbound is
  older than 7 days.
- **PR C:** both senders must log and return `error.code`, `error.error_subcode`, `error.message`
  verbatim on every non-2xx (D3) — the first live run is what pins the no-permission error.
- **PR C:** prerequisite is the window pre-flight (audit P1) on all Meta channels, so day-8 and
  out-of-window automated sends never reach the API.
- **PR C, audit trail (`qa-security-agent`):** `ai.send` meta must record `messagingTag:
  "HUMAN_AGENT"` and the acting user; extend `src/lib/__tests__/sendingAudit.test.ts` so an
  automated send can never carry the tag and a tagged send can never have `userId: null`.
- **PR C, App Review (founder):** request the "Human Agent" *feature* separately from the messaging
  permissions, with Meta's own allowed-usage wording (§B2) and a screencast of an owner replying
  from FollowUp's inbox to a DM older than 24h. Budget ~20 days plus one rejection.
- **PR C, copy:** the drafted out-of-window message should answer what the lead asked (§B5); a bare
  "still interested?" is the weaker policy fit and should not be the default draft.
- **Before either PR is marked done:** run §E steps 1–2 with a real token and paste the raw JSON
  into a dated follow-up file here; every "best reconstruction" in §C is waiting on it.
- **Do not build:** `quick_replies` combined with `HUMAN_AGENT` (unverified), `postback`-based
  buttons (out of scope), or any automated path that sets the tag.

---

## Sources checked 2026-09-16

All via WebSearch result summaries; no page fetched in full (see "Evidence quality").

**Meta pages (summaries only — origin blocked):**
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies/ · https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/quick-replies
- https://developers.facebook.com/docs/messenger-platform/send-messages/quick-replies/ · https://developers.facebook.com/docs/messenger-platform/reference/send-api/ · https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messages/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/ · https://developers.facebook.com/docs/instagram-platform/overview/
- https://developers.facebook.com/docs/features-reference/human-agent · https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy · https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages
- https://developers.facebook.com/docs/apps/faq (unversioned-call behaviour) · https://developers.facebook.com/docs/graph-api/changelog/versions/
- https://www.postman.com/meta/instagram/request/23987686-3f06ebc8-c5ad-4b8a-be9f-81acdc79245c (title only; blocked)

**Vendor documentation and open-source trackers:**
- https://www.chatwoot.com/hc/user-guide/articles/1745225158-what-is-human-agent-tag-in-instagram-messenger-channel · https://developers.chatwoot.com/self-hosted/instagram-app-review
- https://github.com/chatwoot/chatwoot/issues/4689 · https://github.com/chatwoot/chatwoot/issues/14679
- https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram
- https://community.manychat.com/product-updates/meta-s-deprecation-of-the-message-tags-feature-on-messenger-9010
- https://community.manychat.com/general-q-a-43/instagram-api-issue-getting-unsupported-message-tag-for-human-agent-and-silent-delivery-failure-with-other-tags-any-ideas-6434
- https://help.sleekflow.io/en_US/instagram-channel-overview (the dissenting claim) · https://developers.cm.com/messaging/docs/instagram-messaging · https://developers.sinch.com/docs/conversation/channel-support/instagram/properties/
- https://help.genesys.cloud/announcements/facebook-messenger-human-agent-message-tag-deprecation/ (2021; red herring)
- https://help.yeastar.com/en/p-series-cloud-edition/contact-center-guide/submit-app-for-review.html · https://support.liveagent.com/704852-How-to-submit-Facebook-application-for-review
- https://community.khoros.com/blog/release-notes/facebook-messenger-24-hour-response-policy-change/570636 · https://trengo.com/blog/facebook-messenger-implements-the-24-hour-rule · https://beesender.atlassian.net/wiki/spaces/UM/pages/2571108357/Facebook+messenger+policy
- https://docs.smooch.io/guide/v1/facebook-messenger/ · https://rasa.com/docs/reference/channels/facebook-messenger/ · https://ampalibe.readthedocs.io/en/latest/messenger.html
- https://community.n8n.io/t/instagram-messaging-api-this-message-is-sent-outside-of-allowed-window/262109

**Practitioner / explainer (Grade C–D; corroboration only):**
- https://www.conferbot.com/errors/messenger/10 · https://www.conferbot.com/errors/messenger/10-2018278 · https://echoglobal.helpdocs.io/article/pwmjgeso4n-facebook-errors · https://support.reamaze.com/kb/3rd-party-integrations/common-instagram-errors
- https://www.keyapi.ai/blog/instagram-messaging-api-policy/ · https://chatimize.com/facebook-messenger-policy/ · https://customers.ai/blog/facebook-messenger-policy
- https://www.spurnow.com/en/blogs/instagram-dm-automation-rules · https://creatorflow.so/blog/how-instagram-dm-automation-works/ · https://manychat.com/blog/instagram-dm-automation-rules/
- https://singhamandeep.com/meta-graph-api-version-deprecation/
- https://developers.liveperson.com/facebook-messenger-templates-quick-replies-template.html (source of the "11" figure — LivePerson's cap, not Meta's)
