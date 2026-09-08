# Can FollowUp *pull* conversation history from Meta, not just wait for webhook echoes?

Checked: 2026-09-08. Follows directly from
`research/integrations/2026-09-08-meta-business-agent-webhook-behavior.md`, which covered whether
real-time webhook events reveal Business Agent's activity and flagged a `standby`/Handover Protocol
risk. This pass asks the complementary question: independent of webhooks, does the Graph API expose
a GET endpoint FollowUp could call to fetch a thread's message history — usable both as a backfill
when a business connects FollowUp after Business Agent has already been running, and as a safety net
if `captureDirectReply`'s webhook path misses an echo.

**WebFetch is still blocked in this sandbox — everything below is WebSearch-snippet-sourced, mostly
via third-party integration vendors and dev blogs, not a direct read of Meta's current docs pages.
Grade accordingly; nothing here should be treated as verified until read against Meta's own docs or
tested against a live account.**

## Headline finding: yes, a pull-based Conversations API exists and looks usable for backfill — but the central open question from the prior doc (does it even see Business Agent's activity) is not resolved, and may not even be answerable by this endpoint

**The endpoint exists.** The Messenger Platform / Instagram Messaging API has long exposed a
`/conversations` and `/{conversation-id}/messages` read path, separate from webhooks entirely:

1. `GET /{ig-user-id}/conversations?platform=instagram&access_token=...` — returns a list of
   conversation IDs plus each conversation's most-recent-message timestamp.
2. `GET /{conversation-id}?fields=messages{id,created_time,from,to,message}` or
   `GET /{conversation-id}/messages` — returns message IDs in that thread.
3. `GET /{message-id}?fields=id,created_time,from,to,message,reply_to` — returns the full message
   detail (text, sender, timestamp) for one message.

**[Grade C — converged across several vendor/integration blogs (Unipile, a Medium walkthrough,
Blotato, wpsocialninja) describing the same endpoint shape with matching field names; none is
Meta's own docs page, so exact current parameter names/behavior aren't independently confirmed.]**
Sources: https://medium.com/@ritikkhndelwal/getting-all-the-instagram-conversations-and-messages-using-facebook-graph-api-3993fde3d6a ,
https://www.unipile.com/instagram-graph-api-integration-for-software-publishers/ ,
https://developers.facebook.com/docs/messenger-platform/conversations/ (indexed, not fetched)

**It's reachable via `graph.instagram.com` — the same host FollowUp already uses.** `src/lib/instagram.ts`
sets `GRAPH_API = "https://graph.instagram.com"`, i.e. FollowUp is on the newer "Instagram API with
Instagram Login" flow (no Facebook Page required), not the older Page-linked Instagram Graph API.
Search results indicate the messaging endpoints, including conversation/message retrieval, are
available on this same host under that flow. **[Grade C — one aggregator source (elfsight-style dev
guide) states this plainly; not cross-checked against a second independent source specifically for
the Instagram-Login-without-Page variant, so treat as plausible, not confirmed.]** This matters
because a chunk of generic "Instagram Graph API" material online still assumes the older
Page-linked flow (different permission set: `instagram_basic` + `pages_manage_metadata` +
`pages_messaging` vs. FollowUp's `instagram_business_manage_messages`); if FollowUp implements this,
it should test specifically against `graph.instagram.com` with the token/scope it already has, not
assume Page-linked docs apply verbatim.

**Permissions: likely no new grant needed.** Reading conversations/messages appears to ride on the
same messaging permission already used to send/receive (`instagram_business_manage_messages`, per
the prior doc and `research/integrations/2026-09-06-instagram-meta-business-verification.md`), not a
separate read scope — consistent with how `message_echoes` riding on the base permission was
characterized in the prior doc. **[Grade C, inferred rather than directly stated by any single
source — no source explicitly enumerated "these are the exact scopes required for /conversations
specifically," so this is a reasonable extrapolation, not a confirmed fact.]**

**Read access is not gated by the 24-hour customer-service window.** That window (and its
Human-Agent-tag 7-day extension) restricts *sending* new messages to a user who hasn't messaged in
24h — multiple sources describe it purely as a send-side throttle tied to BUC (business-use-case)
scoring, with nothing suggesting it also blocks reading existing conversation history. **[Grade C —
absence of evidence rather than a source stating "reads are unrestricted"; worth confirming
empirically since a false assumption here would silently break a backfill job.]** This is good news
for the specific use case in the task: a backfill call triggered once at "business connects
FollowUp" time isn't a send and shouldn't need an open window with the lead.

**History depth is capped, and sources disagree on the exact number — treat any number as
unverified.** One source says "only get details about the 20 most recent messages" in a
conversation; another describes a `limit` parameter capped at 100 with a default of 25. **[Grade C,
conflicting — do not rely on either number without a live test.]** Practically: if the cap is
anywhere near 20–100 messages, that's likely enough to backfill "what has Business Agent said in
this thread so far" for a typical short DM exchange, but not a guarantee of full history for a
long-running conversation — and there's no evidence of a documented way to page further back once
that cap is hit (unlike, e.g., an explicit older-messages cursor). Flag this as a real limitation
even if the pull-on-connect approach is built: it's a "recent context" backfill, not a guaranteed
complete history import.

**Rate limit for reads**: one source (already cited in the prior doc, `instantdm.com`) states 2
conversation reads/sec per IG account as a throughput cap. **[Grade C]** Fine for an on-connect,
one-time backfill or an hourly poll; would matter if this were designed as frequent polling across
many leads.

## The question this pass could not resolve — and it may be more fundamental than a search gap

**Whether Business Agent's own sent messages are actually written into the object this endpoint
returns is unconfirmed, and there's a real structural reason it might not be, independent of
FollowUp's search skill.** Meta's own Business Agent Platform overview (enterprise/API tier,
`developers.facebook.com/documentation/meta-business-agent/overview`, indexed but not fetched)
describes the agent as acting as "the primary responder... handing off to your app when needed."
Read alongside the prior doc's Handover Protocol theory (Business Agent registered as the Primary
Receiver app while it holds thread control), this suggests two different possible architectures with
opposite implications for the pull endpoint:

1. **If Business Agent's sends land in the same underlying conversation object** that FollowUp's own
   Page/IG-scoped token can read via `/conversations`, then this endpoint straightforwardly solves
   the backfill problem — pull on connect, done — regardless of whether real-time webhooks ever
   caught the individual echoes.
2. **If Business Agent operates as a distinct Primary Receiver with its own conversation state**,
   and FollowUp's app is a Secondary Receiver that only sees what's routed to it (the `standby`-field
   theory from the prior doc), then FollowUp's own read token may not have visibility into
   Business-Agent-authored turns at all via *any* mechanism — pull or push — until/unless thread
   control is explicitly handed back. In that world, "ingest what Business Agent handles" (Point 3's
   framing) would require a different mechanism than either webhooks or this GET endpoint: e.g.
   Meta directly supporting a merged transcript export, which nothing found in this pass confirms
   exists for Instagram specifically (the "hands off full conversation history" language found this
   pass is stated for WhatsApp's enterprise Business Agent Platform, not confirmed for Instagram DM
   or for the free consumer-tier product Instagram/Messenger actually ships).

**This is the load-bearing unknown, more so than the exact rate limit or message cap above.**
Nothing in this WebSearch pass — on either side of the webhook/pull question — settles it. It
genuinely needs either a direct read of Meta's current Instagram Messaging + Business Agent docs
(blocked here) or, more reliably, the same empirical test recommended in the prior doc, extended: connect
a test IG account, let Business Agent answer a DM, then **both** inspect the raw webhook payload
**and** immediately call `GET /{ig-user-id}/conversations` → `/{conversation-id}/messages` and see
whether the AI's reply shows up in either, neither, or only one.

## Practical recommendation for FollowUp

1. **Don't build the pull-based backfill yet on the assumption it solves the Business-Agent-visibility
   problem** — per the "central open question" above, it might not, and building it first risks
   shipping a feature that silently returns incomplete/empty history for exactly the conversations it
   was meant to help with (Business-Agent-run threads), while working fine for ordinary conversations.
2. **The one live test recommended in the prior doc should answer both docs' open questions at
   once** — it's the same test, just checking one more thing (the GET response) alongside the webhook
   payload. Prioritize running it before investing in either the webhook-parsing refinement or a new
   backfill endpoint.
3. **Independent of the Business Agent question, a pull-based backfill is still worth having** as a
   general resilience feature — the task's stated worry about `captureDirectReply` missing an echo
   applies to any dropped webhook delivery (Meta retries webhooks but delivery is not guaranteed
   forever), not just Business-Agent-specific gaps. A periodic reconciliation poll (e.g. on lead
   creation, and/or a daily sweep) that pulls each active conversation's recent messages and diffs
   against what FollowUp already has stored is a reasonable, independently-justified safety net —
   just don't oversell it internally as "solves the Business Agent visibility gap" until the live
   test says so.

Sources checked 2026-09-08 (all via WebSearch; none WebFetch-verified):
- https://medium.com/@ritikkhndelwal/getting-all-the-instagram-conversations-and-messages-using-facebook-graph-api-3993fde3d6a
- https://www.unipile.com/instagram-graph-api-integration-for-software-publishers/
- https://www.unipile.com/the-ultimate-guide-to-instagram-api-documentation/
- https://developers.facebook.com/docs/messenger-platform/conversations/ (indexed, not fetched)
- https://developers.facebook.com/docs/graph-api/reference/conversation/ (indexed, not fetched)
- https://developers.facebook.com/docs/graph-api/reference/conversation/messages/ (indexed, not fetched)
- https://developers.facebook.com/documentation/meta-business-agent/overview (indexed, not fetched)
- https://www.orai-robotics.com/post/meta-business-agent-setup-app-vs-api-and-what-meta-didn-t-ship-2026-guide-slug-meta-business-ag
- https://www.keyapi.ai/blog/instagram-messaging-api-policy/
- https://instantdm.com/blog/instagram-api-rate-limits-explained-2026-developer-guide (also cited in the prior doc)
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/ (indexed, not fetched)
