# FollowUp customers — ICP, pain points, AI-trust objections, pricing sensitivity

**Researched:** 2026-09-05, by customer-research-agent
**Status of this write-up:** first pass. `research/customers/` did not exist before this task (confirmed empty — created it as part of this write-up); nothing to extend, only to establish.

## Methodology note (read before treating anything below as settled)

**`WebFetch` was `EGRESS_BLOCKED` for every domain tried in this sandbox**, matching the identical
finding already on record in `research/integrations/gmail.md`'s own methodology note from the same
environment — this wasn't re-tested domain-by-domain again here since it was already confirmed
in two prior passes; every finding below comes from `WebSearch` instead.

That substitution matters **more** for this report than it did for `gmail.md`, and it's worth being
explicit about why:

- `gmail.md` was researching stable API documentation. A fact about a quota limit is the same fact
  no matter who paraphrases it back to me.
- This report is researching **customer reviews — other people's own words.** WebSearch returns
  short phrases inside quotation marks and represents them as verbatim reviewer text, pulled from a
  named, real, findable page (a specific G2 / Capterra / Trustpilot product-review URL). I have no
  way, from this sandbox, to open that raw page myself and confirm a quoted phrase is
  character-for-character what the reviewer typed, versus WebSearch's own tight paraphrase dressed
  in quotation marks.
- **Every quote below is attributed to a specific real review page, not invented, and not written by
  me to sound plausible.** That satisfies this agent's own bar ("attributed to a real, findable
  source... an invented-sounding quote is worse than none"). But there is a real, structural gap
  between "attributed to a real source" and "independently verified character-for-character," and I
  want that gap on the record rather than papered over. **Before any quote in this document is
  reused verbatim in external-facing material** (landing-page copy, a competitive battlecard, a
  sales deck) **someone with real browser access should open the cited page and re-confirm exact
  wording.** The *substance* of nearly every quote below was corroborated across 2-3 independent
  searches and sources, which is reasonable confidence in the theme — the *exact phrasing* is
  provisional.
- Separately, some numbers below (e.g., "$26,000/year lost to missed messages," "30-60% of missed
  calls recovered") come from vendor content-marketing blogs selling a related product, not from an
  audited or independently-published study. I've flagged these inline as such; treat them as
  plausible-sounding sales copy, not data.
- Where I could not find a real forum/review discussion at all despite several query variants
  (`reddit.com` in particular is not reachable through this tool's `allowed_domains` filter — it
  returns an explicit "not accessible to our user agent" error rather than results — so I could only
  catch Reddit content when it surfaced unprompted in an unfiltered search, which was rare), I've
  said so rather than filling the gap with a synthetic-sounding paraphrase.

---

## 1. ICP sharpening

Working ICP per the agent brief: small/local service businesses and small sales teams that get more
inbound leads than they reliably follow up with. The product's own channel list — Gmail, Twilio
SMS/voice, Instagram DM, website embed widget, generic inbound webhook, CSV import, manual entry
(`backend-agent.md`) — is the sharpest lens available: **who realistically gets leads through
several of those at once, badly enough to pay $29/mo to fix it?** Three segments triangulate
consistently across independent searches, none from a single knockdown source, but converging
enough to be a reasonable working answer:

### 1.1 The underlying problem is well-documented and not specific to any one vertical
"Most startups don't have a lead problem; they have a follow-up problem" and a widely repeated
industry figure that **40-50% of inbound sales leads are never followed up at all** show up
consistently across sales-ops commentary. (Source: [theleadnurturer.substack.com/p/the-follow-up-crisis-why-so-many](https://theleadnurturer.substack.com/p/the-follow-up-crisis-why-so-many), via WebSearch, checked 2026-09-05 — this specific
percentage recurs across many secondary sources without a single traceable original study behind
it in what I could find; directionally credible, not a precise figure I'd cite to a customer.)
Response-speed framing is similarly consistent: conversion **"up to 8x higher"** when a lead is
contacted within 5 minutes versus 30+ minutes later, and businesses responding to web inquiries
within an hour reportedly **"nearly seven times more likely to qualify the lead"** than those who
wait longer. (Same caveat on precision — corroborated directionally across independent
marketing/sales blogs during this search, checked 2026-09-05, no single primary study identified.)
This validates growth-agent's "lead-conversion, not lead-generation" framing as matching how the
category already talks about the problem, not a novel claim FollowUp invented.

### 1.2 Segment A — home/field services with fragmented, multi-source lead intake
HVAC, plumbing, electrical, roofing, and general contracting recur constantly in this research as
the vertical where "leads come in six different ways and nobody replies fast enough" is treated as
an accepted, almost boring fact of the business rather than a debatable claim:
- "Every contractor misses phone calls, but few promptly get back to potential customers. If their
  call goes unanswered, they'll move on to the next contractor" is the framing repeated across
  multiple missed-call-text-back vendor pages — directionally credible (it matches the general
  response-speed research above) but sourced from vendors selling the fix, so treat the specific
  recovery percentages ("30-60% of unanswered calls into booked jobs") as marketing copy, not audited
  data. (Sources: [dialraven.com/blog/missed-call-text-back-for-small-business](https://dialraven.com/blog/missed-call-text-back-for-small-business), [thevalleymarketinggroup.com/blog/missed-call-text-back-service-business-roi](https://thevalleymarketinggroup.com/blog/missed-call-text-back-service-business-roi/), checked 2026-09-05.)
- Contractors in this space genuinely aggregate leads from many disconnected sources at once —
  "Thumbtack, Angi, HomeAdvisor, Google LSA, and 30+ sources" is how one vendor page frames the
  aggregation need (source: search result summarizing taketheleads-style positioning, checked
  2026-09-05) — which maps directly onto FollowUp's webhook + CSV import + manual-entry channels for
  exactly this kind of third-party-lead-source sprawl, on top of Gmail/Twilio for the direct
  call/text/email intake.
- A concrete, named complaint from a **real Capterra review of Text Request** (an SMS tool, not a
  FollowUp competitor per se, but used by exactly this ICP): **"the biggest problem is that new texts
  do not appear on screen and the lack of indication of new or unread has caused many texts to go
  missed and unanswered."** (Source: [capterra.com/p/167015/Text-Request/reviews](https://www.capterra.com/p/167015/Text-Request/reviews/), via WebSearch, checked 2026-09-05.) This is a real, specific, attributable
  account of the exact failure mode FollowUp's unified inbox targets, in a tool this ICP actually
  uses today.

### 1.3 Segment B — solo and small-team real estate agents
This is the segment with the clearest revealed willingness-to-pay: an entire CRM sub-category
(Follow Up Boss, Ylopo, Structurely, BoldTrail) exists **solely** to solve "leads go cold," which is
strong evidence the pain is real and monetizable, not evidence FollowUp is unopposed there. Two
findings sharpen this further rather than just restating the growth-agent competitive file:
- Follow Up Boss's own pricing structure (**$69/user/month Grow tier; $499/mo for 10 users on Pro;
  $1,000/mo for 30 users on Platform**, per one source — a second source gave $49/user/month as the
  entry price, so treat the exact number as unconfirmed pending a primary check) means, per an
  independent review: **"if you are a team of 8+, the 'expensive' plan is usually the cheap one, as
  the per-user cost becomes more favorable at scale."** (Sources: [tomba.io/blog/follow-up-boss-pricing-reviews-pros-and-cons](https://tomba.io/blog/follow-up-boss-pricing-reviews-pros-and-cons), [inboundrem.com/follow-up-boss-pros-and-cons](https://inboundrem.com/follow-up-boss-pros-and-cons/), via WebSearch, checked 2026-09-05.) That's the sharpest
  ICP signal in this whole report: **per-seat pricing structurally punishes exactly the solo-agent /
  small-team segment FollowUp is targeting** — the segment least able to spread the fixed cost across
  users is the one paying the worst effective rate under every competitor's model. Flat $29/mo is
  most differentiated precisely for this segment, not incidentally.
- A recurring, named complaint pattern across reviews: **"cost for solo agents, a plain interface,
  and the fact that it is a CRM — not a lead source or a data provider"**, plus **"calling and texting
  run on purchased phone credits, and several integrations you assume are included are third-party
  subscriptions."** (Source: same Tomba/inboundREM review synthesis, via WebSearch, checked
  2026-09-05.) This is direct corroboration of growth-agent's existing note that Follow Up Boss
  treats calling as a paid add-on — and a preview of the exact "nickel-and-dimed on top of the base
  price" complaint pattern FollowUp's "$29, everything included" pitch is positioned against.

### 1.4 Segment C — appointment-based local service/beauty/wellness businesses leaning on Instagram DM
Salons, spas, fitness studios, personal trainers, photographers, and consultants surfaced repeatedly
as a segment whose lead intake is disproportionately **Instagram DM**-heavy — a channel none of the
three headline competitors (HubSpot, Follow Up Boss, Podium) treat as first-class, and one FollowUp
explicitly supports. Representative framing: "for creators and brands with overstuffed inboxes,
missed messages can mean missed opportunities... when messages are scattered across multiple
platforms like emails and Instagram DMs, it's easy for important ones to slip through the cracks,"
with vendor pages explicitly naming "salons, spas, fitness studios, clinics, coaches, consultants and
local brands" as the buyer profile for exactly this problem. (Source: [creatorflow.so/blog/instagram-dm-follow-up-coaches](https://creatorflow.so/blog/instagram-dm-follow-up-coaches/) and related PlugDialog-positioning
search results, via WebSearch, checked 2026-09-05 — vendor-authored, so treat the framing as
plausible market signal, not neutral evidence.)

### 1.5 The sharpest structural finding: the generalist unified-inbox category is priced above this ICP, not at it
The single most useful, falsifiable finding for ICP purposes: **"Front ($69-$229/user/month) and
Help Scout ($25-$80/user/month) dominate the unified inbox market but are built for support teams of
10-50 agents rather than 1-3 person small businesses."** (Source: search synthesis citing
[timetoscale.co.uk/features/inbox](https://timetoscale.co.uk/features/inbox) and [zoho.com/teaminbox/articles/omnichannel-inboxes-for-small-businesses](https://www.zoho.com/teaminbox/articles/omnichannel-inboxes-for-small-businesses.html), via WebSearch, checked 2026-09-05.) Combined with the same
source's claim that small businesses juggle messages "across up to 8 channels (email, website chat,
SMS, Facebook DMs, Instagram DMs, Google Business Profile messages, Google reviews, and marketing
platform replies)," this reads as a real, structural gap: **the tools built for "many channels, one
inbox" are sized and priced for 10-50-person support teams; the 1-3-person business with the same
channel-sprawl problem is currently either underserved or stitching it together by hand.** That gap
is the sharpest version of "who is this for" this research surfaced — a 1-3-person or very small
team, generating leads through 3+ channels simultaneously, too small to be Front/Help Scout's
customer and too underserved by category leaders (HubSpot/Podium) built for a different price point
or a different core job (Podium's core wedge is review-generation/texting, not scoring-and-drafting).

**Confidence on this section:** medium. Every sub-finding is corroborated by 2+ independent sources
and is internally consistent, but this is search-engine-accessible secondary material, not primary
interviews with actual FollowUp prospects — treat this as a well-reasoned starting hypothesis for
who to talk to first, not a validated segmentation.

---

## 2. Pain points and objections in customers' own words

Per the brief: a direct quote with a source beats a paraphrase. All quotes below are attributed to a
specific product's review aggregation page, checked 2026-09-05 via WebSearch — see the Methodology
note above for the exact-wording caveat that applies to every one of these.

### HubSpot
- **Trustpilot** (aggregate reviews at [trustpilot.com/review/hubspot.com](https://www.trustpilot.com/review/hubspot.com)): *"The Starter plan is extremely limited and feels designed
  mainly to push customers toward expensive upgrades."* *"HubSpot insists on enforcing the full
  12-month term even when the service had clearly not been fit for purpose and delivered no value."*
  *"Customers report having to attend multiple meetings with customer services to cancel services,
  yet still having to pay $500/month for services they don't use."* *"Sales people provide incorrect
  information about their own products, with customers reporting being sold features with false
  capabilities."*
- **G2/Capterra** (aggregate, via WebSearch synthesis of [g2.com/products/hubspot-sales-hub/reviews](https://www.g2.com/products/hubspot-sales-hub/reviews) and Capterra HubSpot pages): reviewers say
  HubSpot really knows how to *"nickel and dime"* customers toward the Enterprise tier, and one
  reviewer reported *"on signing the contract, the sales team had changed us from a month-to-month
  contract to an annual contract."*
- This directly corroborates growth-agent's existing headline finding (bloat/complexity as the
  category leader's biggest documented weakness) and sharpens it: the complaints found here are as
  much about **contract/billing rigidity** as product complexity — a distinct angle FollowUp's
  no-tiers, no-seats, presumably month-to-month framing could lean on harder than it currently does.

### Follow Up Boss
- **G2** ([g2.com/products/follow-up-boss/reviews](https://www.g2.com/products/follow-up-boss/reviews)): 4.6/5 over 115 reviews — genuinely well-liked, so this is not a
  "customers hate it" finding. Named complaints: *"It's a little pricey, especially if you want to
  add more users,"* limited customization (*"does not allow for custom salutations on mailing
  labels, with no choice of alternate fonts/colors or label styles"*), and agents on brokerage
  accounts reporting they *"lack[] true autonomy for marketing to their own uploaded contacts the way
  they want, having to ask the administrator to allow changes to their settings."*
- **Capterra/independent reviews**: *"Recurring complaints from reviewers are cost for solo agents, a
  plain interface, and the fact that it is a CRM — not a lead source or a data provider."*
  (Source: [tomba.io/blog/follow-up-boss-pricing-reviews-pros-and-cons](https://tomba.io/blog/follow-up-boss-pricing-reviews-pros-and-cons), checked 2026-09-05.)

### Podium
- **Trustpilot** ([trustpilot.com/review/podium.com](https://www.trustpilot.com/review/podium.com)): *"seven different customer success managers, meaning no one ever
  knew their account or business, with zero continuity or accountability."* One reviewer described
  *"an AI bot that answers questions incorrectly"* as part of a complaint about delayed notifications
  and unfulfilled call-screening promises — a directly relevant data point since it's a documented,
  named complaint about an AI feature misbehaving in-product, in the same product category FollowUp
  competes in.
- **Capterra**: *"CANNOT call or write in and cancel ever"* and Podium *"basically won't let you out
  of a contract"*; another reviewer said *"half of the things we were paying for did not work."*
  Independent reporting (via WebSearch synthesis) adds that Podium's BBB rating is **D-**, and that
  recovering a business's own phone number after cancellation has, per multiple complaints, cost
  **"$1,800"** and taken **"over three months."** (Sources: [capterra.com/p/164285/Podium/reviews](https://www.capterra.com/p/164285/Podium/reviews/), checked 2026-09-05 — the $1,800/BBB figures are
  WebSearch's synthesis of multiple complaint sources rather than one I can point to a single URL
  for; flagged as lower-confidence pending direct verification.)
- Pricing detail corroborating growth-agent's existing $300-500/mo finding: *"the full AI reply suite
  can add roughly $99/month to a Pro plan... a $500 network optimization fee per location, with phone
  seats running $30-$25/user/month"* — i.e., the sticker price understates real cost-to-serve via
  add-ons, a direct contrast point for FollowUp's flat, all-included $29.

### Close CRM
- **G2** ([g2.com/products/close/reviews](https://www.g2.com/products/close/reviews)): high satisfaction (4.7/5, 2,016 reviews, 79.3% from small-business
  users, entry pricing from **$9/seat/month** — the cheapest headline entry price of any competitor
  in this research). Named complaint: *"frustration with the inflexible pricing structure and
  occasional unexpected price hikes, especially for businesses on a budget"*, with *"certain
  integrations requiring higher tier plans and certain automation features locked behind higher
  price tiers."* Close is the one competitor here whose complaints are closer to FollowUp's own
  pricing-simplicity pitch than a point in FollowUp's favor — worth knowing Close already occupies
  some of the "we're not HubSpot" positioning space, even if its per-seat model still draws
  complaints FollowUp's flat model wouldn't.

### Generalist unified-inbox / SMS tools (adjacent, not direct competitors, but same buyer)
- **Capterra, Text Request**: *"the biggest problem is that new texts do not appear on screen and the
  lack of indication of new or unread has caused many texts to go missed and unanswered."* (Source: [capterra.com/p/167015/Text-Request/reviews](https://www.capterra.com/p/167015/Text-Request/reviews/), checked 2026-09-05.)

**What I could not find despite trying:** a genuine, attributable Reddit thread (r/smallbusiness,
r/realtors, r/Entrepreneur) with a specific person's own account of losing a deal to a missed
follow-up. Several query variants surfaced only marketing blogs, vendor landing pages, and
GoHighLevel funnel pages restating the same "leads slip through the cracks" framing without a named
poster or a real thread URL — and `reddit.com` could not be forced via this tool's domain filter (it
returned an explicit "not accessible" error). I'm flagging the absence rather than filling it with a
paraphrase that would look like a real forum quote but isn't one.

---

## 3. Trust objections specific to AI auto-drafting and auto-sending

This is the section that ties most directly to product design, so I've grounded it against the real
mechanism first (read from `prisma/schema.prisma` and `src/lib/integrations/openai.ts` directly,
not from external research — flagged inline as such), then laid the external evidence against it.

### 3.1 What the product actually does today (code-grounded, not external research)
Per `prisma/schema.prisma`'s `AutomationTier` enum and its own inline comment, and
`src/lib/integrations/openai.ts`'s `assessSendRisk`:
- **`OFF` (default on every lead)** — nothing is ever sent automatically; every draft needs manual
  approval. This matches `backend-agent.md`'s "approval-first by default" framing exactly.
- **`ASSISTED`** — automated sends are allowed, but every draft still passes `assessSendRisk()`
  first, and *"anything not low-risk is held for manual approval instead of sent."*
- **`AUTONOMOUS`** — the risk check is skipped entirely; explicitly opt-in **per lead**, per the
  schema comment, *"never a default."*
- The risk check itself is an OpenAI call whose system prompt instructs it: *"When genuinely unsure,
  prefer 'medium' over 'low' — the cost of an unnecessary human review is much lower than an
  autonomous message that overpromises, quotes a number, or mishandles a sensitive moment with a
  real prospect."* — i.e., the safeguard is deliberately biased toward caution, not just accuracy.

One nuance worth flagging to backend-agent/growth-agent, from reading the code rather than from
external research: **the safeguard that decides "is this safe to auto-send" is itself an LLM
call, judging another LLM's output.** It's a reasonable, pragmatic design (and the prompt's
explicit "prefer medium when unsure" bias is a real mitigation), but it means the honest answer to
"who checks the AI's own risk-checker" is "no one, structurally, on the Autonomous path" — the
same class of system is grading its own homework. This isn't a claim that it's broken; it's a claim
that if a sophisticated buyer (or a reporter, post-incident) asks the question, "a second AI call"
is a less reassuring answer than a hard rule engine would be, and the product's own messaging
probably shouldn't lean on "risk-assessed" language that implies more certainty than an LLM
self-check can honestly provide.

### 3.2 External evidence: caution about AI autonomy is the market default, not an outlier position
- **G2's own aggregate research** across the AI-sales-assistant category found, per its analysis of
  **3,896 verified reviews**: *"74% of users report positive sentiment toward AI sales assistants"*
  but *"nearly 1 in 3 critical reviews cite generic or inaccurate AI output, revealing that execution
  quality, not capability, is the category's biggest constraint."* (Source: [learn.g2.com/what-g2-reviews-reveal-about-ai-sales-assistants](https://learn.g2.com/what-g2-reviews-reveal-about-ai-sales-assistants), via
  WebSearch, checked 2026-09-05 — this is G2's own published analysis of its review corpus, a
  meaningfully stronger source than a single vendor's marketing page.) This is a solid, credible data
  point: even among people who chose to buy an AI sales tool, roughly a third of complaints are about
  the AI's own output quality — the exact failure mode "approval-first by default" is designed to
  catch before a customer ever sees it.
- **A concrete cautionary instance**: Artisan AI (an "autonomous AI SDR" — the closest analog in
  spirit to FollowUp's Autonomous tier, at industry scale) carries the **lowest G2 rating among
  reviewed AI SDR platforms (3.8/5)**, with reviews citing *"generic, templated messages that
  prospects recognize as automated, reducing response rates,"* and one documented instance of
  **"over 20,000 messages generating zero meetings."** (Sources: [amplemarket.com/blog/best-ai-sales-agents](https://www.amplemarket.com/blog/best-ai-sales-agents), [marketbetter.ai/blog/artisan-ai-review-2026](https://marketbetter.ai/blog/artisan-ai-review-2026/), via WebSearch,
  checked 2026-09-05 — the 20,000-message figure traces to a single documented account in this
  synthesis, not an audited industry figure; treat as one real but anecdotal data point, not a base
  rate.) Even AI SDR tools that *are* built around autonomy report needing heavy human oversight in
  practice: AiSDR reviewers describe *"a lot of oversight is still needed, especially at the
  beginning, with three people actively working daily"* on monitoring and reviewing outbound.
  (Source: [g2.com/products/aisdr-inc-aisdr/reviews](https://www.g2.com/products/aisdr-inc-aisdr/reviews), via WebSearch, checked 2026-09-05.)
- **Small-business AI adoption research points the same direction, independent of the sales-tool
  category**: general reporting on small-business AI hesitancy — *"around one in three of Britain's
  small businesses are hesitant to deploy AI"* (Source: [techradar.com/pro/many-small-businesses-say-they-re-too-scared-to-use-ai](https://www.techradar.com/pro/many-small-businesses-say-they-re-too-scared-to-use-ai), checked
  2026-09-05, UK-specific — geographic caveat, not necessarily representative of FollowUp's likely
  US-heavy customer base) — and small-business-advisor content converges on a specific,
  directly-relevant prescription: *"start with drafts, summaries, inbox triage, FAQs, and reporting
  before allowing AI to touch money, legal decisions, hiring, or customer commitments, and a simple
  review rule beats a complicated AI policy nobody follows."* (Source: [mattdarm.com/blog/is-ai-getting-your-business-wrong](https://mattdarm.com/blog/is-ai-getting-your-business-wrong), checked 2026-09-05.)
  **This is close to a direct, independent validation of FollowUp's actual OFF → Assisted →
  Autonomous ladder** — the advice small-business owners are already being given by advisors matches
  the shape of the safeguard the product already built, which is a genuinely reassuring finding for
  the product's current design, not just for its marketing.
- **Consumers hold the business, not the AI vendor, responsible when an AI representing a business
  gets something wrong**: YouGov polling found *"a majority (54%) of respondents placed the
  responsibility primarily with 'the company using the chatbot,' only 26% felt the developer bore
  most responsibility"* when an AI chatbot errs. (Source: [yougov.com/articles/49729-consumers-hold-companies-responsible-for-ai-chatbot-errors](https://yougov.com/articles/49729-consumers-hold-companies-responsible-for-ai-chatbot-errors), checked 2026-09-05.) The
  practical read for FollowUp's small-business customer: *they*, not FollowUp, will be the one whose
  reputation is on the line if an Autonomous-tier message goes out wrong — which is the exact stake
  the approval-first default is protecting them from, and arguably an argument for making that stake
  more explicit in-product ("this will go out under your name, with no review") rather than less.
- A widely-cited real example of what "AI representing a business gets it confidently wrong" looks
  like at the extreme: New York City's own "MyCity" small-business chatbot reportedly told shop
  owners *"they could go cashless despite a 2020 law requiring NYC stores to accept cash"* and gave
  incorrect information about anti-discrimination law. (Source: reporting summarized via
  [edgetier.com/chatbots-the-new-risk-in-ai-customer-service](https://www.edgetier.com/chatbots-the-new-risk-in-ai-customer-service/), checked 2026-09-05 — this is a different product category
  (a government advice bot, not a sales-follow-up drafting tool) so it's illustrative of the failure
  mode's severity and public visibility, not a direct FollowUp comparable; I'd flag this one for
  independent confirmation before citing it in anything customer-facing, since I found it only via
  secondary summary, not the original coverage.)

### 3.3 Read on whether FollowUp's existing safeguard addresses the objection
On balance: **yes, directionally** — the OFF-default / risk-gated-Assisted / opt-in-per-lead-Autonomous
structure matches what small-business AI advisors are independently telling their clients to look
for, and is more conservative than what several real AI-SDR products ship as their default. The
external research did **not** surface evidence that this safeguard needs to be *more* restrictive
by default — if anything, it's already ahead of the category norm described above. What the research
does suggest needs more attention is **visibility and explanation, not restriction**: G2's own
finding that a third of AI-sales-assistant complaints are about output quality (not the presence of
automation itself) suggests the trust risk is less "customers object to AI drafting" and more
"customers need to see the reasoning and trust the guardrail is real" — which is consistent with
`backend-agent.md`'s "never a black-box number" scoring philosophy already extending to automation
tier, and worth extending explicitly to *why* a given message was held for approval or was judged
safe to auto-send, not just that it was.

**Confidence on this section:** medium-low on the specific percentages and the Artisan/AiSDR
anecdotes (single-instance or single-source figures); medium-high on the directional conclusion
(human-in-the-loop-by-default is the market's converged-on answer, not a conservative outlier)
since that theme recurred independently across sales-tool reviews, small-business AI advice content,
and general AI-trust polling.

---

## 4. Pricing-sensitivity signal for the flat $29/mo model

Reporting what was found, per the brief — not a recommendation to change the price.

- **Competitor pricing, assembled from this pass**: HubSpot's seat-based ladder and Enterprise
  upsell pressure (Section 2); Follow Up Boss at **$69/user/month** base (one source; a second source
  said $49 — flag for direct verification) scaling to **$499-$1,000/mo** for 10-30 users, plus
  calling/texting as **purchased credits on top**; Podium's **$300-500+/mo** all-in cost once AI
  reply suite (**+$99/mo**), phone seats (**$25-30/user/month**), and a **$500 network optimization
  fee per location** are added to the base (corroborates growth-agent's existing figure, with more
  add-on granularity); Close CRM's cheapest headline entry at **$9/seat/month** but reviewer
  complaints about *"inflexible pricing"* and *"unexpected price hikes"* once a business needs
  automation or integrations gated behind higher tiers.
- **$29/mo is a recognized, comfortable price anchor in adjacent flat-rate small-business SaaS**, not
  an unusually low or alarming number: Connecteam's Basic tier is *"one $29 flat fee for your first
  30 users,"* and Agiled's Starter tier is *"$29/mo for solo client operations."* (Source:
  [nimble.com/blog/average-crm-cost-for-small-business](https://www.nimble.com/blog/average-crm-cost-for-small-business/), [agiled.app/blog/all-in-one-software-for-small-business](https://agiled.app/blog/all-in-one-software-for-small-business), checked 2026-09-05.) This suggests $29
  lands where this buyer already expects an all-in-one tool to price, rather than reading as
  suspiciously cheap for what it claims to do.
- **Per-seat pricing is a named, recurring objection precisely from the solo/small-team segment
  FollowUp targets** — see Section 1.3's Follow Up Boss finding: *"if you are a team of 8+, the
  'expensive' plan is usually the cheap one."* Flat pricing is structurally the sharpest wedge against
  exactly this complaint, and this research surfaced no counter-signal (e.g., a small-business buyer
  specifically preferring per-seat because it can start cheaper with 1 user) — though this pass also
  did not go looking hard for that counter-signal, so treat its absence as "not found," not "ruled
  out."
- **General subscription fatigue is a real, named objection worth weighing against "one more $29/mo
  tool," not against this tool's price specifically**: *"Business owners are getting tired of the
  'Perpetual Tax' of SaaS and asking 'When did I stop owning my tools?'"* with one small-business
  owner's account of *"$847 per month in recurring software charges — more than half their mortgage
  payment."* (Source: [angelasanturbano.substack.com/p/death-by-a-thousand-subscriptions](https://angelasanturbano.substack.com/p/death-by-a-thousand-subscriptions), a personal Substack essay, checked
  2026-09-05 — treat as one real, named account and a real phenomenon, not a market-sized statistic.)
  The objection this implies isn't "$29 is too much" so much as "prove this replaces three tools I'm
  already paying for, not adds a fourth" — an argument for positioning FollowUp as a consolidation
  (replaces a missed-call-text-back tool + a shared-inbox tool + manual CRM entry), which the flat,
  everything-included price structurally supports.
- **A real risk to the "everything included" claim, adjacent to pricing but closer to
  integrations-research-agent's territory**: Podium reviewers specifically call out **10DLC
  compliance fees** as a surprise add-on charge, and 10DLC (the carrier registration regime for
  business SMS) carries real, non-trivial cost and compliance risk industry-wide — *"since February
  1, 2025, carriers block 100% of unregistered A2P 10DLC traffic"* and *"in 2024 alone, businesses
  paid over $50 million in carrier fines for 10DLC violations."* (Source: [messageiq.io/blogs/10dlc-registration-sms-compliance](https://messageiq.io/blogs/10dlc-registration-sms-compliance/), checked
  2026-09-05.) I did not research whether FollowUp's Twilio integration already handles 10DLC
  registration/pass-through cost, or whether that cost is meant to be absorbed inside the flat $29 —
  that's a real open question for whoever owns Twilio production-readiness, flagged here only
  because if it **isn't** absorbed, FollowUp risks the identical "surprise SMS compliance fee"
  complaint pattern found in Podium's own reviews, undercutting the flat-price pitch this research
  otherwise supports strongly.

**Confidence on this section:** medium. Competitor price points came from 2+ sources each with minor
disagreement on exact figures (flagged inline); the "flat pricing suits this ICP" conclusion is
well-triangulated; the subscription-fatigue and 10DLC points are real but adjacent findings rather
than direct answers to "is $29 the right number," which this research cannot actually settle without
real pricing-sensitivity conversations with prospects.

---

## Should re-verify before treating as settled

- **Spot-check every quoted phrase in Section 2 against the live G2/Capterra/Trustpilot page** once
  real browser/fetch access exists — see the Methodology note. Priority order: anything that would
  go in front of a customer (landing page, sales deck) before anything purely internal.
- **Confirm Follow Up Boss's actual entry price** ($49 vs. $69/user/month — two sources disagreed)
  directly from `followupboss.com` pricing before using either figure in a competitive battlecard.
- **Find real primary-source forum discussion** (an actual Reddit thread, a real named small-business
  owner's account) rather than search-engine-mediated summaries of marketing blogs — this pass tried
  several query variants and could not force `reddit.com` results through this tool's domain filter;
  someone with direct Reddit/community access should take another pass specifically there.
- **This entire report is a first pass built from search-engine-accessible public sources — not
  primary interviews.** The single highest-value next step, if the budget exists, is 5-10 real
  conversations with prospects in the three segments named in Section 1 (home-services contractor,
  solo/small-team real estate agent, appointment-based local service business) — nothing in this
  report should be treated as a substitute for that.
- **Check whether FollowUp's Twilio integration absorbs 10DLC registration/carrier-fee cost inside
  the flat $29/mo** (Section 4) — flagging for backend-agent / whoever owns Twilio, since this
  research surfaced a real pattern (Podium customers specifically complaining about surprise SMS
  compliance fees) that a truly "everything included" claim needs to not repeat.
- **Consider whether the Autonomous-tier risk check (an LLM judging an LLM, Section 3.1) warrants
  more visible in-product explanation** of *why* a message was held or cleared, not a change to the
  mechanism itself — flagging for backend-agent/growth-agent rather than resolving here, since it's
  a product-design question this research can motivate but not answer.

---

## Sources (all checked 2026-09-05 via WebSearch; WebFetch was blocked for every domain tried in this sandbox)

- [theleadnurturer.substack.com/p/the-follow-up-crisis-why-so-many](https://theleadnurturer.substack.com/p/the-follow-up-crisis-why-so-many)
- [g2.com/products/hubspot-sales-hub/reviews](https://www.g2.com/products/hubspot-sales-hub/reviews)
- [g2.com/products/hubspot-sales-hub/reviews?qs=pros-and-cons](https://www.g2.com/products/hubspot-sales-hub/reviews?qs=pros-and-cons)
- [trustpilot.com/review/hubspot.com](https://www.trustpilot.com/review/hubspot.com)
- [g2.com/products/follow-up-boss/reviews](https://www.g2.com/products/follow-up-boss/reviews)
- [capterra.com/p/130020/Follow-Up-Boss/reviews](https://www.capterra.com/p/130020/Follow-Up-Boss/reviews/)
- [capterra.com/p/130020/Follow-Up-Boss/pricing](https://www.capterra.com/p/130020/Follow-Up-Boss/pricing/)
- [inboundrem.com/follow-up-boss-pros-and-cons](https://inboundrem.com/follow-up-boss-pros-and-cons/)
- [tomba.io/blog/follow-up-boss-pricing-reviews-pros-and-cons](https://tomba.io/blog/follow-up-boss-pricing-reviews-pros-and-cons)
- [g2.com/products/podium/reviews?qs=pros-and-cons](https://www.g2.com/products/podium/reviews?qs=pros-and-cons)
- [capterra.com/p/164285/Podium/reviews](https://www.capterra.com/p/164285/Podium/reviews/)
- [trustpilot.com/review/podium.com](https://www.trustpilot.com/review/podium.com)
- [contractortoolstack.com/software/podium](https://contractortoolstack.com/software/podium/)
- [g2.com/products/close/reviews](https://www.g2.com/products/close/reviews)
- [learn.g2.com/what-g2-reviews-reveal-about-ai-sales-assistants](https://learn.g2.com/what-g2-reviews-reveal-about-ai-sales-assistants)
- [learn.g2.com/2026-predictions-agentic-ai](https://learn.g2.com/2026-predictions-agentic-ai)
- [amplemarket.com/blog/best-ai-sales-agents](https://www.amplemarket.com/blog/best-ai-sales-agents)
- [marketbetter.ai/blog/artisan-ai-review-2026](https://marketbetter.ai/blog/artisan-ai-review-2026/)
- [salesforge.ai/blog/artisan-ai-review](https://www.salesforge.ai/blog/artisan-ai-review)
- [g2.com/products/aisdr-inc-aisdr/reviews](https://www.g2.com/products/aisdr-inc-aisdr/reviews)
- [zoho.com/teaminbox/articles/omnichannel-inboxes-for-small-businesses](https://www.zoho.com/teaminbox/articles/omnichannel-inboxes-for-small-businesses.html)
- [timetoscale.co.uk/features/inbox](https://timetoscale.co.uk/features/inbox)
- [snackclubmarketing.com/blog/why-we-built-our-own-unified-inbox](https://snackclubmarketing.com/blog/why-we-built-our-own-unified-inbox/)
- [capterra.com/p/167015/Text-Request/reviews](https://www.capterra.com/p/167015/Text-Request/reviews/)
- [creatorflow.so/blog/instagram-dm-follow-up-coaches](https://creatorflow.so/blog/instagram-dm-follow-up-coaches/)
- [dialraven.com/blog/missed-call-text-back-for-small-business](https://dialraven.com/blog/missed-call-text-back-for-small-business/)
- [thevalleymarketinggroup.com/blog/missed-call-text-back-service-business-roi](https://thevalleymarketinggroup.com/blog/missed-call-text-back-service-business-roi/)
- [mattdarm.com/blog/is-ai-getting-your-business-wrong](https://mattdarm.com/blog/is-ai-getting-your-business-wrong)
- [techradar.com/pro/many-small-businesses-say-they-re-too-scared-to-use-ai](https://www.techradar.com/pro/many-small-businesses-say-they-re-too-scared-to-use-ai)
- [yougov.com/articles/49729-consumers-hold-companies-responsible-for-ai-chatbot-errors](https://yougov.com/articles/49729-consumers-hold-companies-responsible-for-ai-chatbot-errors)
- [edgetier.com/chatbots-the-new-risk-in-ai-customer-service](https://www.edgetier.com/chatbots-the-new-risk-in-ai-customer-service/)
- [nimble.com/blog/average-crm-cost-for-small-business](https://www.nimble.com/blog/average-crm-cost-for-small-business/)
- [agiled.app/blog/all-in-one-software-for-small-business](https://agiled.app/blog/all-in-one-software-for-small-business)
- [angelasanturbano.substack.com/p/death-by-a-thousand-subscriptions](https://angelasanturbano.substack.com/p/death-by-a-thousand-subscriptions)
- [messageiq.io/blogs/10dlc-registration-sms-compliance](https://messageiq.io/blogs/10dlc-registration-sms-compliance/)

## Internal code read directly for Section 3.1 (not external research)

- `/home/user/Follow-up-app/followup/prisma/schema.prisma` — `AutomationTier` enum and its inline comment
- `/home/user/Follow-up-app/followup/src/lib/integrations/openai.ts` — `assessSendRisk()`
- `/home/user/Follow-up-app/followup/.claude/agents/backend-agent.md`, `/home/user/Follow-up-app/followup/.claude/agents/growth-agent.md` — product scope, channel list, and thesis grounding read in full before starting, per this agent's own instructions
