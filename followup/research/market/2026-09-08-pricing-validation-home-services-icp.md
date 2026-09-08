# Pricing validation: is FollowUp's flat $29/mo right for the home-services ICP?

**Date:** 2026-09-08
**Scope:** `research/customers/2026-09-05-icp-pain-and-trust-objections.md` found home-services
contractors (plumbers, HVAC, electricians, remodelers) have the single strongest quantified pain
signal in the corpus (62% industry missed-call rate, 391% conversion lift from a 1-minute
callback). This pass asks: what do comparable tools targeting that segment actually charge, and
does that make FollowUp's flat $29/mo too low, right, or too high?

**Current price, confirmed in code, not assumed:** `src/lib/billing.ts` line 27 — `"Subscribe to
unlock this — see Billing in Settings ($29/mo)."` Still $29/mo flat, no seats, no tiers, matching
every prior research doc's description.

## Sourcing caveat

WebFetch is blocked network-wide in this sandbox (consistent with every prior pass). Everything
below is a WebSearch result-snippet, not a page fetched and read directly. Most of the pricing
sources are third-party "pricing guide" / SEO-aggregator sites (Astucia, Projul, CostBench,
NextPhone, etc.), not vendor pricing pages themselves — even where a number looks precise, treat
it as **graded C** (one step removed from primary, several of these sites plainly exist to sell
their own competing product or an "alternatives" list) unless noted otherwise. Where two
independently-worded searches converged on the same number, I note that as a mild upgrade in
confidence but still short of a fetch-verified primary source.

---

## 1. What comparable tools charge, by category

### A. Full field-service-management suites (scheduling, dispatch, invoicing — text-back is a bundled feature, not the product)
- **ServiceTitan** — $245–500 per technician/month across three tiers (Starter/Essentials/The
  Works), plus $5,000–50,000+ one-time implementation and a mandatory 12-month contract; a
  10-technician shop lands around $3,000–4,000/mo. ServiceTitan does not publish prices — all
  figures are third-party estimates. *Graded C — vendor doesn't publish, multiple aggregator
  sites converge on the same range (projul.com, getonecrew.com, myquoteiq.com), via WebSearch
  2026-09-08.*
- **Housecall Pro** — Basic $59–79/user/mo, Essentials $149–189/mo, MAX $299–329/mo (monthly
  billing runs higher than annual); missed-call text-back is bundled starting at Essentials
  (~$149–189/mo), not the Basic tier. *Graded C, via costbench.com, schedulingkit.com,
  projul.com, WebSearch 2026-09-08.*
- **Read:** this category is not FollowUp's direct comparison — it's dispatch/invoicing software
  that happens to include text-back, priced per-technician for multi-person crews. A true solo
  operator (FollowUp's likely first buyer) sits at the bottom of these ranges ($59–79/mo), still
  2–3x FollowUp's price for a much broader (and for a one-person shop, partly unused) toolset.

### B. Reputation/omnichannel-inbox platforms (missed-call text-back is one feature inside a bigger suite)
- **Podium** — Core $399/mo, Pro $599/mo, Enterprise $999+/mo, annual contract required; real
  effective cost for a single-location small business is **$450–600/mo** once 10DLC fees and
  extra numbers are added. This corroborates the $450+/mo figure already on file in the ICP doc's
  Finding 2 rather than adding a new number. *Graded C (aggregator sites), cross-checked against
  two independently-worded searches converging on the same $450-600 range, via WebSearch
  2026-09-08.*
- **Birdeye** — Starter $299/mo, Growth $349/mo, Dominate $449/mo, all **per location**, annual
  contract, plus $500–1,500 setup and an 8% "innovation fee" at renewal — real first-year cost
  for a small business runs $4,000–6,000. Missed-call text-back is one line item inside a
  review-management/reputation platform, not the product. *Graded C, via wiserreview.com,
  replifast.com, itqlick.com, WebSearch 2026-09-08.*
- **Read:** Podium and Birdeye are 10–20x FollowUp's price, but they are not really the same
  product — the price buys a full reputation-management/review-request/omnichannel-inbox suite
  that FollowUp doesn't attempt to be. Comparing FollowUp's $29/mo directly against these isn't
  apples-to-apples on features, only on "handles a missed call."

### C. Call-tracking + AI add-on (closer to a feature-level comparison)
- **CallRail** — base plans $50–195/mo (Lead Tracking through Lead Conversion Complete), with
  **Voice Assist** (its AI receptionist for missed/overflow calls) sold as a **separate $95/mo
  add-on** covering the first 50 AI-handled calls, then $1/call. A CallRail customer wanting
  AI-handled missed calls realistically pays **$145–195/mo** minimum (base + Voice Assist).
  *Graded C, via nimbata.com, layer3labs.io, getnextphone.com, WebSearch 2026-09-08.*
- **Read:** this is a more direct feature comparison than Podium/Birdeye — "AI handles a call
  FollowUp/CallRail otherwise missed" is close to FollowUp's own missed-call text-back pitch —
  and it still lands at 5–7x FollowUp's price.

### D. AI-receptionist-specific tools (answering, not full CRM)
- **Smith.ai** — AI-only receptionist tier ~$97.50/mo, capped at 30 calls; human-assisted tiers
  $300+/mo. **Ruby Receptionist** — human-only, $245–350/mo for 50–200 minutes, positioned as
  premium/brand-sensitive. *Graded C, via cloudtalk.io, getnextphone.com, WebSearch 2026-09-08.*
- **Read:** even a narrowly-scoped "answer the phone with AI" product, with no CRM, no follow-up
  sequencing, and a hard call cap, charges roughly 3x FollowUp's flat price.

### E. Other named missed-call-text-back tools surfaced in this pass (rounding out the range)
- Signpost ~$149–299/mo; GoHighLevel Starter $97/mo; Emitrr $149/mo all-in-one (or
  $20–30/user for VoIP-only). General category range cited across multiple aggregator pieces:
  **standalone missed-call text-back tools typically run $30–300/mo** depending on volume and
  whether AI qualification/CRM sync is included. *Graded C, via salescaptain.com,
  servicebusinessacademy.org, WebSearch 2026-09-08.*

### F. The one genuinely comparable budget competitor found
- **QuoteIQ Essentials** — **$29.99/mo** (or $299.99/yr, ~$25/mo effective), 1 user, 500 AI
  credits, bundling a full solo-contractor CRM (estimates, invoicing, scheduling, Stripe
  payments/BNPL) **plus** an "AI Autopilot" / "Virtual Call Team" that explicitly handles missed
  calls — i.e., a direct, currently-marketed competitor sitting at effectively the same price
  point as FollowUp, aimed at the identical solo-contractor buyer. *Graded C (myquoteiq.com is
  the vendor's own site plus g2.com/capterra listings; not independently audited), via WebSearch
  2026-09-08.*
- **Read:** this is the single most decision-relevant find in this pass. FollowUp is not
  underpriced relative to the *cheapest* tier of the market — a real, currently-shipping
  competitor already occupies almost exactly FollowUp's price point, targeting the same ICP, with
  a comparable AI-missed-call pitch bundled into a broader CRM.

---

## 2. Synthesis — is $29/mo too low, right, or too high?

**Read together, the honest answer is "priced low relative to the mid-market comparison set, but
not low relative to the one directly comparable budget competitor found."** Two things are true
at once, and neither cancels the other:

- Every tool in this pass that offers something recognizably similar to "AI catches the missed
  call and texts back" — CallRail+Voice Assist ($145–195/mo), Smith.ai AI tier (~$97.50/mo,
  call-capped), GoHighLevel ($97/mo), Signpost/Emitrr (~$149/mo), Housecall Pro's text-back tier
  (~$149–189/mo), Podium/Birdeye (~$300–600/mo) — charges **3x to 20x** FollowUp's $29/mo, and
  several of those are narrower in scope than FollowUp (Smith.ai's 30-call cap; CallRail's
  per-call overage past 50 calls) or bundle in unrelated categories the ICP may not need (Podium's
  review-management, Birdeye's reputation suite). Against that whole comparison set, **$29/mo
  reads as underpriced for the value this specific ICP would get**, especially given the ICP
  research's own 391%-conversion-lift figure — a contractor who converts even one extra job a
  month from a faster callback likely clears $29 many times over, which is the classic signal a
  product is priced well below the value delivered, not merely "affordable."
- Against **QuoteIQ Essentials specifically** — the one tool found that is genuinely the same
  shape (flat, solo-operator, ~$30/mo, AI-handled missed calls bundled into a lightweight CRM) —
  FollowUp's price is not an outlier at all; it's normal for that specific micro-tier. This
  matters because it means $29/mo isn't "obviously too cheap to be credible" (no evidence of that
  objection was found here or in the prior ICP pass) — a real competitor already proved the price
  point is viable to operate at.

**No new evidence found, in either direction, on FollowUp's actual willingness-to-pay ceiling** —
this pass adds comparative anchors (what adjacent/competing tools charge), not a customer survey
or A/B test result, so it doesn't resolve the open gap the ICP doc already flagged ("no evidence
this segment would pay meaningfully more than $29"). What it does add: a concrete, cited range
($97–600/mo) that FollowUp would still undercut heavily even at 2–3x its current price, which is
new information the ICP doc didn't have.

**Flag for CEO/manager-agent, reported as evidence not a recommendation, per charter:** the gap
between $29/mo and the $97–600/mo range the rest of this market charges for weaker or narrower
versions of the same missed-call-handling promise suggests there may be real room to test a higher
price — even a $49–79/mo price would still undercut every named competitor except QuoteIQ by a
wide margin, while potentially better matching the value the 391%-conversion-lift stat implies.
This is not a call to raise price unilaterally — Rule 6 territory (is a price increase "moat" or
just extraction) and the flat-vs-seat-based structural advantage the ICP doc already documented
(Finding 4: this segment resents seat/tier pricing shapes more than the specific number) should
both weigh into that decision, and a real pricing-page test would be a stronger signal than more
secondary research. Reporting the comparative data, not the decision.

## What I did not check (worth naming)

- No AI-missed-call-text-back tool marketed as narrowly and specifically as FollowUp's pitch
  (multi-channel capture + AI scoring + approval-first drafting + rescue, not just "text back a
  missed call") turned up as a single named competitor at FollowUp's exact price — QuoteIQ is the
  closest but is CRM-first with AI-calling as a bundled feature, not FollowUp's inverse (AI
  follow-up first, lightweight elsewhere).
- Did not find current-year (2026) survey data on home-services contractors' specific
  willingness-to-pay for an AI-follow-up tool (as opposed to general small-business CRM
  willingness-to-pay already covered in the ICP doc) — a targeted search on this alone, or a
  direct customer interview, would sharpen this further.
- Did not verify any of these prices by fetching a vendor pricing page directly (WebFetch
  blocked) — every number here should be treated as directionally right, not to-the-dollar
  confirmed, before it goes into a pricing-strategy memo or board deck.
