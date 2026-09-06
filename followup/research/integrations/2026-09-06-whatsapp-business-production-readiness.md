# WhatsApp Business Platform — production readiness

Checked: 2026-09-06. Current wiring: **nothing real exists.** `src/app/(app)/settings/page.tsx`
lists WhatsApp under "Outlook, Instagram, WhatsApp, SMS — coming soon"; `CopyWebhookUrl.tsx`
tells businesses to route WhatsApp through Zapier/Make into FollowUp's generic inbound webhook —
that's inbound-only lead capture with no sending capability and none of the compliance machinery
below. This file is scoping work for a not-yet-built integration, not an audit of existing code,
per `integrations-research-agent.md`. Prior research this cross-checks against:
`research/integrations/2026-09-06-instagram-meta-business-verification.md` (the other
Meta-platform messaging integration already in the codebase) and
`research/integrations/2026-09-06-twilio-sms-compliance.md` (the existing Twilio relationship —
`src/lib/twilio.ts`, `TwilioConfig.tsx` — this would sit next to).

## Recommendation, up front

**Twilio's WhatsApp API, using the same self-sign-up / BYO-credentials pattern `TwilioConfig.tsx`
already uses for SMS — not FollowUp's own Meta Tech Provider/Embedded Signup integration, and not
direct Meta Cloud API.** Each business pastes an Account SID, Auth Token, and now also a
WhatsApp-enabled sender number into the same settings panel; FollowUp's outbound calls just
prefix `whatsapp:` onto the existing Twilio send path. This is real reuse, not just "also
Twilio" — no new credential type, no new webhook-signing scheme (Twilio's existing
`validateTwilioSignature` in `src/lib/twilio.ts` already covers WhatsApp inbound webhooks, since
Twilio delivers them the same way as SMS). See "Technical shape" below for why the Instagram
Graph-API pattern is the wrong analog here despite WhatsApp also being a Meta platform.

The one thing this recommendation deliberately gives up: a smooth, embedded, one-click "Connect
WhatsApp" button. That requires FollowUp to join Twilio's WhatsApp ISV/Tech Provider program,
which itself requires FollowUp to stand up and get **its own Meta app reviewed** (see below) —
functionally a second Instagram-style App Review process. Not worth taking on for an MVP; revisit
once/if WhatsApp volume justifies the onboarding-friction cost.

## 1. Access model — Meta Cloud API direct vs. BSP (Twilio) vs. other BSPs

**All roads lead to Meta's Cloud API now — there's no more "on-premise" fork to choose.** Meta
deprecated the old on-premise WhatsApp Business API; as of October 23, 2025 the Cloud API is the
only path for new integrations, whether accessed directly or through a BSP. Source:
https://ominiflow.com/blog/whatsapp-cloud-api-vs-business-api (cross-checked against
https://www.messagecentral.com/blog/whatsapp-business-api-complete-guide, consistent on this).

**Direct Meta Cloud API**: cheapest per-message (no BSP markup) but FollowUp would own webhook
infrastructure, template submission/management, number registration, and rate-limit handling
itself — real engineering surface, not a config toggle.

**BSP (Twilio, 360dialog, MessageBird, etc.)**: managed infrastructure, a console/API layer over
the same underlying Cloud API, at a per-message markup. **Twilio specifically charges a flat
$0.005/message (in and out) on top of Meta's own per-message fee, passed through with no separate
markup on Meta's side** — so the delta versus going direct is exactly Twilio's $0.005, not a
hidden multiple. On 100k messages/month that's $500 — real money at scale, negligible at the
per-business volume FollowUp customers actually see (a small business sending a few hundred
follow-ups/month pays cents, not dollars, in Twilio's markup). Source:
https://www.socialvik.com/blog/twilio-whatsapp-pricing-vs-meta-cloud-api ,
cross-checked against https://wabulksend.com/blog/twilio-vs-meta-cloud-api-cost (both
independently state the same ~$0.005/message Twilio fee structure).

**Twilio reuses FollowUp's existing relationship, and that's the deciding factor, not price.**
Businesses already onboard Account SID + Auth Token for SMS/voice in `TwilioConfig.tsx`. Twilio's
own docs confirm WhatsApp senders are registered under the same Twilio account/subaccount model
SMS numbers use ("Register WhatsApp senders using Self Sign-up" —
https://www.twilio.com/docs/whatsapp/self-sign-up), and the send API is the existing
Messages resource with `whatsapp:` prefixed onto the `From`/`To` numbers — not a separate SDK,
separate signature scheme, or separate credential type. This is the lowest-friction path
architecturally, exactly as the task hypothesized.

## 2. Verification/approval — related to Instagram's, but NOT the same gate, and NOT identical in shape

This is the most important correction to the "same Meta platform, same burden" assumption in the
task brief: **WhatsApp's verification burden is per-business by default (self-sign-up), not
one-time-and-app-wide the way Instagram's was — unless FollowUp specifically builds the
embedded/ISV onboarding flow, in which case a second, FollowUp-side App Review appears.**

### Path A (recommended): Twilio self-sign-up, per business — no FollowUp-side Meta App Review
Under Twilio's plain "Self Sign-up" flow (what `TwilioConfig.tsx`'s pattern maps to), each
business creates or connects its own Meta Business Manager and WhatsApp Business Account (WABA)
through Twilio's console, then hands FollowUp the resulting Account SID/number, same as SMS
today. Key findings:
- **You can start sending immediately after sender registration, without completing Meta Business
  Verification first** — but an unverified/unreviewed sender is capped at **250
  business-initiated messages per 24-hour period** and the display name gets rejected if it
  doesn't exactly match the verified business name, at which point the 250/day cap sticks until
  fixed. Source: https://www.twilio.com/docs/whatsapp/self-sign-up , cross-checked against
  https://help.twilio.com/articles/360024008153-WhatsApp-Sender-Message-Limits-and-Quality-Rating
  (both independently state the 250-message ceiling tied to display-name/verification status).
- Full production readiness (no cap beyond the normal quality-rating tiers) requires **Meta
  Business Verification** on the business's own Meta Business Manager — legal business name,
  address, tax ID document, matched exactly to what's entered in Meta Business Manager. Reported
  timeline: **2-10 business days** once submitted correctly (this is Meta's standard Business
  Verification, the same process Instagram uses — see the shared-vs-separate note below). Source:
  https://www.messagecentral.com/blog/whatsapp-business-api-complete-guide.
- This verification burden sits with **each individual FollowUp customer business**, not with
  FollowUp itself, under this path — a materially different shape than Instagram, where FollowUp's
  own single Meta app absorbs the whole gate once for every customer. That's a real product
  friction (every business owner who wants WhatsApp has to go do a documents-and-DNS dance
  themselves, the same category of friction A2P 10DLC already imposes on SMS — see
  `2026-09-06-twilio-sms-compliance.md`), but it is NOT a blocker on FollowUp shipping the feature
  at all, and 250 messages/day per business is enough headroom for most FollowUp customers to use
  the feature productively while their own verification is pending.

### Path B: FollowUp's own Twilio ISV/Tech Provider program — a second App-Review-shaped gate
If FollowUp later wants the smoother "click Connect WhatsApp, no Twilio console required"
onboarding (parallel to how Instagram's OAuth connect flow works today), that requires FollowUp
to join Twilio's WhatsApp ISV/Tech Provider program, which explicitly requires:
1. FollowUp creates **its own Meta app and gets it approved by Meta** (submitted specifically as
   an "Independent Tech Provider"),
2. FollowUp's Meta Business Manager completes **Business Verification + turns on 2FA**,
3. Twilio links that Meta app as a "Partner Solution" (1-2 business days once submitted),
4. A technical integration using Meta's Embedded Signup SDK.

Reported timeline for steps 1-2 (the Meta app review + business verification): **3-4 weeks** —
the same order of magnitude as Instagram's App Review, not faster. There's also an initial
**200-new-customers-per-rolling-7-days cap** post-approval. Source:
https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/faq, cross-checked against
https://www.twilio.com/docs/whatsapp/isv/tech-provider-program (both describe the same
Meta-app-approval + Partner Solution + Embedded Signup sequence).

### Is Meta Business Verification for WhatsApp the same one Instagram needs? Partially shared, not identical
Both platforms gate on the same underlying Meta **Business Verification** primitive (one Meta
Business Manager account, same document types: registration/incorporation doc, tax ID, or
utility bill; same "legal name must exactly match" failure mode). **If FollowUp's own Meta
Business Manager account already clears Business Verification for Instagram, that verification
does NOT need to be redone from scratch for WhatsApp under Path B** — it's verification of the
Business Manager entity, not per-product. But it does not eliminate the *separate* App Review
FollowUp would need for its own Meta app under Path B (analogous to Instagram's
`instagram_business_manage_messages` scope review), and under Path A (the recommended path) the
verification obligation isn't FollowUp's at all — it's each customer business's own Meta Business
Manager that needs it, which is a distinct account from FollowUp's. **Correction worth flagging
explicitly per the charter**: don't assume "we already cleared Meta Business Verification for
Instagram" pre-clears WhatsApp for FollowUp's customers — those are two different Business
Manager accounts (FollowUp's own vs. each customer's), so Instagram's cleared verification buys
nothing for a customer's WhatsApp setup under the recommended Path A.

## 3. Pricing — per-message now, not per-conversation, and about to expand further

**The conversation-based pricing model the task brief describes is already gone.** WhatsApp
switched from per-24-hour-conversation to **per-message** billing on July 1, 2025. Under the old
model, five replies inside one 24-hour conversation cost the same as one; under the current model,
each one is billed separately. Source: https://blueticks.co/blog/whatsapp-business-pricing-change-2026-per-message,
cross-checked against https://mmdsmart.com/blog/whatsapp-business-pricing-changes-2026-how-to-prepare
(both independently confirm the July 1, 2025 per-message cutover).

**Rates are per delivered message, by category and by recipient country** — representative 2026
marketing-template rates: ~$0.0094-0.025/message in India, ~$0.025/message in the US, ~$0.0625 in
Brazil, up to $0.124+ in Germany. Utility and authentication templates are typically cheaper than
marketing and are the only categories eligible for Meta's volume discounts. Source:
https://www.engagelab.com/blog/whatsapp-business-api-pricing, cross-checked against
https://blueticks.co/blog/whatsapp-business-api-pricing-2026 (consistent on category/country
structure, though exact per-country cents figures vary slightly by source/snapshot date — treat
as directional, not a rate card to quote to customers).

**Free-form service replies inside the 24-hour window are free today, but that's changing:**
non-template messages sent by a business in response to a customer-initiated message, inside the
24-hour customer service window, have been free since November 2024. **Starting October 1, 2026 —
about three weeks after this research was checked — Meta begins charging per message for these
service replies too.** This directly affects FollowUp's core reply-to-inbound-lead pattern (the
common case: a lead messages in on WhatsApp, AI drafts a reply, human approves, it sends within
the window) — today that's free, from October 1, 2026 it isn't. Source:
https://www.ycloud.com/blog/whatsapp-service-messages-24-hour-window-pricing, cross-checked
against a second, independent summary (the general 2026 pricing-changes roundup at
https://www.aichat.com/blog/whatsapp-business-pricing-changes-2026) which states the same October
1, 2026 date for service-message charging. **Flag for whoever prices this feature**: any
per-business or per-message pricing math done before October 1, 2026 needs re-checking against
the post-October-1 rate card before it ships, since the free tier this research found is expiring
inside the likely build window.

**Cost estimate at FollowUp's likely volume**: a single small-business customer sending, say,
200-500 WhatsApp messages/month (a realistic range for a lead-follow-up tool, well below A2P
10DLC-scale SMS volume) would cost low single-digit dollars/month in Meta fees post-October-2026,
plus Twilio's $0.005/message ($1-2.50/month) — immaterial next to the $29/mo subscription price,
but worth disclosing in-product the same way A2P 10DLC costs should be (per the Twilio SMS
research file) rather than presented as free.

**Business-initiated vs. user-initiated does change the rules, not just the price**: a
business-initiated conversation (FollowUp's AI re-engaging a lead that hasn't messaged in >24h)
must open with an **approved template message** and is billed at the template's category rate
regardless of window; a user-initiated conversation (lead messages in) lets the business reply
free-form for 24 hours from that inbound message, no template required, but every free-form reply
in that window will itself be billed per-message starting October 1, 2026 (see above). So both
directions become metered — the meaningful behavioral difference isn't cost, it's the template
requirement on the business-initiated side (see Compliance below).

## 4. Compliance — opt-in and the template-approval gate on unprompted outreach

**Opt-in is a hard requirement before any business-initiated message, and Meta polices it more
concretely than Twilio's SMS TCPA posture does today.** Meta requires documented, explicit opt-in
— "a clear action where the user expects to receive WhatsApp messages from your specific
business" — before the first business-initiated template send, and can request proof of opt-in
during template review. Source: https://wetarseel.ai/whatsapp-business-api-opt-in-rules/,
directionally consistent with the general WhatsApp Business Policy summary at
https://whatsappbusiness.com/policy/. Unlike the SMS TCPA gap flagged in the Twilio research file
(no visible opt-out/consent enforcement wired into FollowUp today), WhatsApp's opt-in requirement
is enforced at the platform level via template review, not just a legal-exposure question for the
business owner — a template built around an ungated "we noticed you haven't replied" re-engagement
message is a plausible rejection candidate if opt-in evidence isn't in order.

**Template approval is per-template, automated, and fast — nothing like Instagram's App Review.**
This is the single biggest structural difference from the Instagram analog worth stating plainly:
Instagram's gate is a slow, whole-app, human-reviewed permission scope (weeks, real rejection
risk, App Review). WhatsApp's template gate is a fast, per-message-template, largely automated
content check — most templates clear in **15-30 minutes** via Meta's ML-assisted review; anything
flagged for manual review takes **24-48 hours**. Source:
https://chati.ai/blog/whatsapp-template-approval-time-2026-common-rejections-how-to-get-approved-faster,
cross-checked against https://m.aisensy.com/blog/whatsapp-template-approval-process/ (both
independently give the same minutes-to-48-hours range). Common rejection reasons: promotional
language inside a "utility" template (the single most-cited cause across sources), formatting
errors in variable placeholders, requesting sensitive data (full card/ID numbers), and
near-duplicate templates. None of these require FollowUp to resubmit an entire app for review —
just the one offending template.

**The real product constraint is structural, not procedural: FollowUp's "AI drafts an unprompted
follow-up" pattern cannot send arbitrary free text on WhatsApp outside the 24-hour window.** Email
and SMS both let the AI draft genuinely free-form text for any follow-up, any time. WhatsApp does
not — a business-initiated message (exactly the "lead's gone quiet, let's re-engage" case that is
the mission's central pitch per `PRODUCT_DIRECTION.md`) must use a pre-approved template with
fixed structure and named variable slots (e.g. `Hi {{1}}, following up on {{2}} — still
interested?`). The AI can still choose *which* approved template to use and fill in the variables
contextually, and can still draft fully free-form replies to anything a lead sends within the
24-hour window (which covers most day-to-day conversation) — but the "rescue a cold lead that's
been silent for a week" flow, WhatsApp's best-fit use case per the mission's own framing, is
exactly the case that needs a template library, approved once per template shape (fast, per the
timeline above) and then reusable indefinitely. This needs product design, not just backend
plumbing: FollowUp would need a small set of pre-approved, categorized templates (utility-style
"following up on your inquiry" framing reads best for approval odds, per the rejection-reasons
research above) that the AI selects and fills, rather than a single generic drafting path shared
with email/SMS.

## 5. Technical shape — closer to the Twilio SMS pattern than to Instagram's

Recommendation with reasoning, per the charter's ask for a real call, not just an inventory:

- **Signature validation**: reuse `validateTwilioSignature` in `src/lib/twilio.ts` as-is — Twilio
  delivers WhatsApp inbound webhooks through the same signed-webhook mechanism as SMS, not Meta's
  `X-Hub-Signature-256` HMAC scheme `validateMetaSignature` implements for Instagram. No new crypto
  needed.
- **Sending**: reuse the existing Twilio Messages-resource send path with `whatsapp:` prefixed
  onto `From`/`To`, not a new SDK call or new credential shape.
  Business identification/routing: same `twilioSecret`-per-business URL pattern
  `findBusinessByTwilioSecret` already implements for SMS — a WhatsApp inbound webhook is a
  per-business URL, the same shape as SMS/voice, not the single app-wide shared endpoint Instagram
  uses (`instagramUserId`-based routing in `src/lib/instagram.ts`). This follows directly from the
  access-model finding above: WhatsApp-via-Twilio-self-sign-up is a per-business credential
  relationship, structurally unlike Instagram's one-Meta-app-for-everyone model.
- **New work Twilio SMS doesn't already need**: a template-message data model (name, category,
  approval status, variable slots) and a settings UI for submitting/tracking template approval
  status per business, since Twilio's Content API / template registration is a genuinely new
  surface neither SMS nor Instagram needed. This is the one piece of real net-new engineering, not
  something already lying around from the SMS integration.
- **What NOT to build**: Meta's Embedded Signup / ISV Tech Provider flow (Path B above) — that's
  real, separate engineering plus its own ~3-4 week App-Review-shaped wait, and buys UX polish,
  not capability. Skip it for a first version; the manual Account-SID/number entry pattern
  `TwilioConfig.tsx` already has is sufficient to ship the feature.

## Hard blocker before this can be real

- **Nothing blocks shipping a first version.** Unlike Instagram (hard-blocked on a
  multi-week App Review with real rejection risk before any customer's Instagram account works
  above a 25-test-user cap), WhatsApp via Twilio self-sign-up lets a business start sending real
  messages immediately, capped at 250 business-initiated messages/24h until their own Meta
  Business Verification clears (2-10 business days, paperwork-shaped, not code-shaped) — headroom
  most FollowUp customers won't hit.
- **The template-approval requirement for business-initiated messages is a real, load-bearing
  product constraint that must be designed before this ships**, not a "nice to have later" — it
  changes the shape of the AI-drafting flow for WhatsApp specifically (template selection +
  variable-filling instead of free text) for exactly the re-engagement use case the product's
  mission is built around. This is a design decision for whoever specs the feature, not something
  to discover after launch.
- **Opt-in evidence needs to exist before the first business-initiated template send** — Meta can
  request it during template review. FollowUp's UI needs to prompt/capture this at connect time
  the same way the TCPA notice does for SMS today.

## Should do before scale, not before launch

- **The October 1, 2026 service-message pricing change** lands inside the likely build window —
  re-verify actual per-message service-reply rates against Meta's live rate card before quoting
  costs to customers or building any per-business usage-based pricing on top of the $29/mo tier.
- **A2P-10DLC-style per-business friction**: like SMS, this pushes a paperwork step (Meta Business
  Verification) onto each customer business, not just FollowUp once. Worth bundling into the same
  "here's what you need to register before this fully works" UX pattern the SMS research
  recommends building for A2P 10DLC, rather than solving each channel's registration friction as
  a one-off.
- **Twilio's WhatsApp ISV/Tech Provider program (Path B)** — worth revisiting once WhatsApp
  adoption among customers is proven, to replace manual credential entry with an embedded connect
  flow. Budget ~3-4 weeks for FollowUp's own Meta app review plus ongoing 200-customers/week
  onboarding cap, the same order of magnitude as the Instagram gate.
- **Quality-rating tier management**: WhatsApp senders start around a 250-1,000
  unique-recipients/day tier and scale up automatically based on sustained volume + quality
  rating; a business with a low quality rating (driven by block/report rates) can be tier-demoted
  or restricted. Not a launch blocker at FollowUp's likely per-business volume, but worth
  surfacing in-product later if the AI drafting quality ever risks WhatsApp-specific block/report
  rates the way a bad SMS draft risks STOP replies.

## Correction to flag for anyone assuming "same Meta platform, same burden as Instagram"
The task brief's framing — check whether WhatsApp shares Instagram's verification burden — turned
up a real, non-obvious answer: **it's not that WhatsApp's burden is bigger or smaller than
Instagram's, it's that it's shaped completely differently.** Instagram is a slow, one-time,
FollowUp-side gate that every customer benefits from once cleared. WhatsApp (via the recommended
Twilio self-sign-up path) is a fast-to-start, per-customer-business gate — no FollowUp-side App
Review at all unless FollowUp later opts into the ISV/embedded-signup path, at which point it
becomes an Instagram-shaped gate on FollowUp's own account. Anyone estimating "WhatsApp go-live
timeline" needs to know which of the two paths is being built before quoting a number — Path A
(recommended) has no FollowUp-side wait at all; Path B has one comparable to Instagram's.

## Sources checked 2026-09-06
- https://www.twilio.com/docs/whatsapp/self-sign-up
- https://www.twilio.com/docs/whatsapp/key-concepts
- https://www.twilio.com/docs/whatsapp/api
- https://www.twilio.com/docs/whatsapp/isv/tech-provider-program
- https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/faq
- https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide
- https://www.twilio.com/docs/whatsapp/isv/register-senders
- https://help.twilio.com/articles/360024008153-WhatsApp-Sender-Message-Limits-and-Quality-Rating
- https://ominiflow.com/blog/whatsapp-cloud-api-vs-business-api
- https://www.messagecentral.com/blog/whatsapp-business-api-complete-guide
- https://www.socialvik.com/blog/twilio-whatsapp-pricing-vs-meta-cloud-api
- https://wabulksend.com/blog/twilio-vs-meta-cloud-api-cost
- https://www.engagelab.com/blog/whatsapp-business-api-pricing
- https://blueticks.co/blog/whatsapp-business-api-pricing-2026
- https://blueticks.co/blog/whatsapp-business-pricing-change-2026-per-message
- https://mmdsmart.com/blog/whatsapp-business-pricing-changes-2026-how-to-prepare
- https://www.ycloud.com/blog/whatsapp-service-messages-24-hour-window-pricing
- https://www.aichat.com/blog/whatsapp-business-pricing-changes-2026
- https://wetarseel.ai/whatsapp-business-api-opt-in-rules/
- https://whatsappbusiness.com/policy/
- https://chati.ai/blog/whatsapp-template-approval-time-2026-common-rejections-how-to-get-approved-faster
- https://m.aisensy.com/blog/whatsapp-template-approval-process/
- https://learn.turn.io/l/en/article/uvdz8tz40l-quality-ratings-and-messaging-limits
- https://www.uptail.ai/blog/whatsapp-business-message-limits-2026-broadcast-caps-tier-progression-what-happens-when-you-hit-the-ceiling

## Note: WebFetch unavailable this session
Per the task instructions, WebFetch was blocked throughout this research pass; all findings above
come from WebSearch result snippets (titles + summarized excerpts), not full fetched pages. Every
load-bearing claim (pricing dates, timelines, caps) was cross-checked against at least two
independently-authored sources per the charter's sourcing discipline, and is flagged inline where
sources gave slightly different numbers (e.g. exact per-country cents figures). None of these are
Meta's or Twilio's own primary-source pages fetched directly — treat specific dollar figures as
directional and re-verify against Meta's live Cloud API pricing page and Twilio's pricing page
before quoting numbers to a customer or building pricing logic against them.
