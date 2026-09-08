# Meta Business Agent echoes — is `is_echo` really how it shows up?

Checked: 2026-09-08. Triggered by task #68 (`claude/meta-business-agent-source`, commit
79c2b0e), which ships `captureDirectReply` in `src/lib/instagram.ts` and wires it into
`src/app/api/instagram/webhook/route.ts` (both the Instagram and Facebook Page/Messenger event
branches) on the theory that when Meta's free Business AI answers a lead's DM on a connected
account's behalf, that reply arrives at FollowUp's existing webhook as a normal `is_echo: true`
event on the standard `messaging` field — same as a teammate replying from the native
Instagram/Messenger app — and the code deliberately treats both cases identically (labels the
message `instagram_direct`/`messenger_direct`, doesn't try to tell them apart).
**WebFetch is blocked in this sandbox; nothing below is verified against Meta's own current
developer docs directly — every claim is WebSearch-snippet-sourced, much of it via blog
secondary sources rather than Meta's docs pages themselves. Grade accordingly.**

## Headline finding: the premise is basically right, but likely incomplete — and there's a second, more authoritative mechanism the code isn't using

**Meta Business Agent is real and matches the stated timeline.** It's not a hypothetical or a
FollowUp misunderstanding of some other product. Meta announced global availability on June 3,
2026 at its Conversations conference (was free through a test window ending July 31, 2026; billed
per-token, $2.00/million tokens, from August 1, 2026), across WhatsApp, Messenger, and Instagram,
built on Llama. One million+ businesses were already on it pre-global-launch via WhatsApp/Messenger
pilots (India/Mexico/Brazil). **[Grade B — corroborated by Bloomberg, TechCrunch, and Meta's own
newsroom post (`about.fb.com/news/2026/06/meta-business-agent`), independently reported, consistent
dates/pricing across sources.]**
Sources: https://www.bloomberg.com/news/articles/2026-06-03/meta-sells-ai-agent-for-businesses-in-push-to-monetize-service ,
https://techcrunch.com/2026/06/03/metas-ai-agent-for-whatsapp-business-is-now-available-globally/ ,
https://about.fb.com/news/2026/06/meta-business-agent/

**But Meta appears to route third-party-app visibility into Business Agent conversations through
the pre-existing Messenger Platform "Handover Protocol," not (only) through bare `is_echo` tagging
on the standard `messaging` field.** This is the single most load-bearing correction to flag. The
Handover Protocol is a years-old Messenger Platform mechanism (Primary/Secondary Receiver apps,
Thread Control API, a `messaging_handovers` webhook field, and a separate `standby` webhook field)
that predates Business Agent — Meta appears to have plugged the AI agent into it as the "primary
receiver" a business's thread control passes to, rather than inventing something new. Per
secondary-source descriptions of this mechanism as applied to Business Agent: **while the agent
holds thread control, inbound consumer messages are delivered to a connected partner app on the
`standby` webhook field, not the regular `messages`/`messaging` field** — and separately, the
partner app is described as still receiving copies of the agent's own outbound sends (the
echo-equivalent) so it stays in sync. **[Grade C — multiple blog/vendor sources (360dialog,
SigServe, an "echoglobal" help-doc page, Bottender's own Handover Protocol reference docs)
converged on this shape, but none of these is Meta's own docs page, and I could not confirm via
search whether Instagram Messaging API specifically (as opposed to Messenger, which is where
Handover Protocol has classically lived) actually supports `standby`/secondary-receiver apps the
same way — historically Instagram Graph API only allowed a single connected app per IG account at
all, which would make a Messenger-style multi-app handover a new 2026 behavior specific to
Business Agent, not an old mechanism just being reused for Instagram.]**
Sources (all secondary, unverified against Meta's own docs):
https://360dialog.com/blog/meta-business-agent-complete-guide-whatsapp-api/ ,
https://www.sigserve.com/blog-meta-business-agent-handoff.html ,
https://echoglobal.helpdocs.io/article/9lfidaug6r-using-meta-s-handover-protocol ,
https://bottender.js.org/docs/channel-messenger-handover-protocol/

**Practical implication for the current code:** `route.ts` only reads `entry.messaging` (the
standard field) for both the Instagram and Page branches — it does not subscribe to or handle a
`standby` field, and does not implement Thread Control / `messaging_handovers`. If the standby-field
description above is accurate, there's a real risk the current implementation:
1. Never sees the lead's inbound message at all while Business Agent holds control (it'd arrive on
   `standby`, which nothing in `route.ts` reads) — meaning `checkRapidEngagement` / the neglect
   trigger could still fire wrongly, or FollowUp could stay completely blind to a conversation
   Business Agent is actively running, the opposite of what task #68 intended.
2. Or, if Meta does deliver Business Agent's own sends as plain `is_echo` events on the standard
   `messaging` field regardless of standby/handover state (also plausible — the two mechanisms
   aren't necessarily exclusive, and older/simpler integrations may just get the echo), then the
   current code's approach mostly works, just without point 2 below (attribution).

**This could not be resolved with confidence from WebSearch alone.** It needs either a direct read
of Meta's current Messenger Platform / Instagram Messaging docs (blocked here) or an empirical
test: connect a test Instagram/Page account, let Business Agent answer a DM, and inspect exactly
what FollowUp's webhook endpoint actually receives — the fields present, whether it arrives on
`messaging` or elsewhere, and whether `checkRapidEngagement`/scoring actually got suppressed
correctly. **Recommend this as a concrete pre-launch verification step**, not something to assume
correct from either this doc or the original implementation.

## Question 2: can "Meta's AI answered" be told apart from "a teammate replied natively"?

The task's code deliberately treats both the same. Partial answer, with a real caveat to the
"can't be told apart" reasoning:

- **`message_echoes` webhook events on the Messenger Platform have long included an `app_id`
  field** identifying which app sent the message — documented back to Graph API v12.0 per one
  search snippet, i.e. not a new 2026 field. When a human sends from the native app or Page Inbox
  directly (no app involved), the echo typically carries no `app_id` (or a Meta-owned pseudo-app
  ID for "Page Composer"); when a connected third-party app sends, its own `app_id` shows up.
  **If Meta Business Agent is itself registered as a distinct Meta-owned app with a stable,
  identifiable `app_id`, that field is the actual mechanism to distinguish "Business Agent
  answered" from "a human answered in the native app"** — the opposite of the code's current
  assumption that this isn't reliably knowable. **[Grade C — the `app_id`-on-echoes behavior
  itself is corroborated by two independent-looking search snippets referencing the same Graph
  API v12.0 changelog entry, so reasonably credible as a general Messenger Platform fact; but
  nothing found confirms what `app_id` (or equivalent identifier) Business Agent's own sends
  actually carry, or whether Instagram Messaging API's echo events carry the same field at all.]**
- **Separately, the Handover Protocol's `messaging_handovers` webhook (if Instagram/Business
  Agent actually uses it) is a more authoritative signal than inferring from message content**:
  it fires specifically when thread control passes to or from the agent, independent of whether
  any message was sent in that turn. That would be a cleaner "Business Agent is now handling
  this" / "control passed back" signal than pattern-matching on `is_echo` + guessing.
- **Net: the code's "can't reliably distinguish so don't try" reasoning is probably not correct**
  as a technical claim — there does appear to be at least one, possibly two, real signals
  (`app_id` on echoes; `messaging_handovers` events) that could distinguish the two cases. It may
  still be the *right product call* to treat them the same in the UI copy for now (simpler, and
  "not sent through FollowUp" is arguably the only fact that actually matters to the lead-rescue
  logic — see PRODUCT_DIRECTION.md's mission: the goal is noticing a lead was answered by *someone
  other than FollowUp*, not attributing credit), but that should be stated as a deliberate
  simplification, not "this can't be done."

## Question 3: gotchas — rate limits, extra subscription fields, permissions

- **Extra webhook subscription fields likely needed.** Beyond the `messages` field FollowUp
  presumably already subscribes to, actually seeing Business Agent activity may require
  subscribing to `message_echoes` explicitly (it's documented as a separate, opt-in subscription
  field alongside `messages`, `messaging_postbacks`, `message_deliveries` — not bundled into
  `messages` by default) and possibly `standby`/`messaging_handovers` if the Handover Protocol
  theory above holds. **[Grade C]** Worth an explicit check of exactly which fields FollowUp's
  Meta Developer Console webhook subscription currently has checked, since `message_echoes` not
  being subscribed would silently mean zero echoes ever arrive, Business-Agent-sourced or not —
  a config gap, not a code bug, but one that would make `captureDirectReply` dead code in
  production regardless of how correct its logic is.
- **Permissions**: no evidence found of any *additional* scope beyond what's already documented
  in `research/integrations/2026-09-06-instagram-meta-business-verification.md`
  (`instagram_business_manage_messages`) and the Facebook Messenger equivalent (`pages_messaging`)
  — receiving echoes/standby events rides on the same permission grant used to receive/send
  messages at all, not a separate scope. Not independently re-verified this session; flagging as
  "no new requirement found" rather than "confirmed none needed."
- **Rate limits**: nothing found suggesting echo/standby events count differently against the
  standard Instagram messaging rate limits (2 calls/sec per IG account for sends; ~200
  messages/hour/page practical throughput cap per one 2026 developer guide). These are limits on
  FollowUp's own *sends*, not on inbound webhook delivery volume, so Business Agent's own
  Meta-side sends shouldn't count against FollowUp's quota at all — but this wasn't found stated
  explicitly anywhere, it's an inference from how the rate limits are scoped (per sending app),
  not a confirmed fact. **[Grade C, low confidence — flag for empirical check.]**

## Recommendation

1. Treat this doc as raising a real, unresolved risk, not confirming task #68's implementation is
   correct — the standby-field possibility is the important thing to chase down before relying on
   `captureDirectReply` in production.
2. Cheapest concrete next step: check the Meta Developer Console's current webhook field
   subscriptions for the FollowUp app (is `message_echoes` checked? is `standby` an available/
   checked field for this app's product config?), and separately do one live test — have Business
   Agent answer a DM on a connected test account and log the raw webhook payload FollowUp
   receives, unfiltered, before trusting any of the parsing logic.
3. If `app_id` does turn out to reliably distinguish Business Agent's echoes, consider whether
   the product wants to say "Answered by Meta's AI" vs. "Sent directly on Instagram — not through
   FollowUp" rather than the current one-size-fits-all copy — a small UX upgrade, not required for
   correctness.

Sources checked 2026-09-08 (all via WebSearch; none WebFetch-verified):
- https://about.fb.com/news/2026/06/meta-business-agent/
- https://www.bloomberg.com/news/articles/2026-06-03/meta-sells-ai-agent-for-businesses-in-push-to-monetize-service
- https://techcrunch.com/2026/06/03/metas-ai-agent-for-whatsapp-business-is-now-available-globally/
- https://360dialog.com/blog/meta-business-agent-complete-guide-whatsapp-api/
- https://www.sigserve.com/blog-meta-business-agent-handoff.html
- https://echoglobal.helpdocs.io/article/9lfidaug6r-using-meta-s-handover-protocol
- https://bottender.js.org/docs/channel-messenger-handover-protocol/
- https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/message-echoes (indexed, not fetched)
- https://www.memacon.com/meta-business-agent-api-the-technical-onboarding-guide-for-developers/
- https://instantdm.com/blog/instagram-api-rate-limits-explained-2026-developer-guide
