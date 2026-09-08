# What FollowUp should do next — a synthesis, not a data dump

**Date:** 2026-09-08. Written for direct reading, not just filing. Synthesizes
everything on file in `research/market/` and `research/customers/` against the six
rules in `PRODUCT_DIRECTION.md`, plus the new ground covered in
`2026-09-08-broader-competitive-landscape.md`.

## The five highest-leverage moves, up front

### 1. Turn "watching the human, not the lead" into a shipped, named, marketed capability — before a funded horizontal competitor builds it too.

Every competitor researched across all three passes — Follow Up Boss, HighLevel,
Lofty, Sierra (real estate); ServiceTitan, Housecall Pro, Podium, CallRail
(home services); and now Beside, Bravi, Leaping AI, Verse.ai, Numa, Goodcall
(horizontal) — automates *the lead*: answer it, text it, log it. None found in any
pass has a shipped feature that detects a lead who **was** answered once and then
went quiet, scores it by neglect × intent × recoverability, and acts. This is
`2026-09-07-lead-rescue-gap-and-strategy.md`'s moat candidate (a), and per
PRODUCT_DIRECTION it is already built in FollowUp's code. **Rule 6 (moat vs.
table stakes):** this is FollowUp's clearest moat-labeled asset today, and it should
be the headline of every landing page, demo, and sales conversation — not "AI
follow-up," which every competitor above also claims, but "we catch what already
went quiet, not just what just came in." **Rule 1 (depth on the job):** this is
literally the job, more precisely defined than "follow-up" — go deeper on
proving it works than any competitor bothers to. **Why now, not later:** Beside just
raised $32M and has 20,000+ paying small-business customers on a *reactive*
answering product with no evidence of this feature; capitalized, fast-moving
competitors close feature gaps quickly once the target is visible. The window to be
first to market the neglect-score-plus-recovered-revenue-report combo as a category
concept is closing, not open-ended.

### 2. Fast-track the per-lead consent/audit record (Phase D) as a marketed trust feature, not backend compliance plumbing.

**Rule 3 (trust ships like a feature):** "every automation capability needs an
explicit, user-visible guarantee... plus a test proving it" — this rule is already
FollowUp's strongest in practice (stops-on-reply, approval-first default, TCPA/A2P
notices), but the consent/permission record itself — source, channel, consent basis,
stop, all first-class data per lead — is still Phase D, not built. `research/market/
2026-09-07-lead-rescue-gap-and-strategy.md` names "permission + audit trail" as
moat candidate (b), alongside neglect detection. **New evidence changing the
urgency:** none of the newly-funded horizontal competitors found in this pass
(Beside, Bravi, Leaping AI) lead their marketing with compliance/consent
transparency — they compete on speed and coverage. A well-capitalized, fast-shipping
competitor is far more likely to out-execute FollowUp on raw feature velocity than
on a trust guarantee that takes real engineering discipline (an actual audit trail,
an actual test) rather than a marketing claim. Shipping this now, while it's still
uncontested positioning, is cheap relative to its payoff, and it directly serves
Rule 6: a compliance-grade audit trail is measurably harder for a growth-stage
competitor to bolt on credibly in six months than it is for FollowUp to finish now.

### 3. Turn the recovered-revenue report into an active pricing experiment ($49-79/mo), not a dashboard nobody prices against.

**Rule 6 (moat vs. table stakes), applied to pricing itself:** the report already
exists (PRODUCT_DIRECTION, Point 2: "the report 'What FollowUp saved you this week'
counts only replies to messages FollowUp sent on its own"). `2026-09-08-pricing-
validation-home-services-icp.md` found FollowUp's flat $29/mo reads as **underpriced**
against nearly every comparable tool a home-services buyer already uses — CallRail +
Voice Assist ($145-195/mo), Smith.ai ($97.50/mo, call-capped), Podium/Birdeye
($300-600/mo) — all 3-20x FollowUp's price for narrower or weaker versions of the
same promise, and the one true price-peer found (QuoteIQ Essentials, $29.99/mo)
proves $29 isn't "too cheap to be credible," just that there's real headroom.
**The evidence gap that report closes:** willingness-to-pay is unproven precisely
because owners can't yet see the return in dollars; the recovered-revenue report *is*
the proof mechanism the pricing doc says is missing. This is not a call to raise
price unilaterally — Rule 6 also cautions against extraction dressed as strategy —
but running one actual pricing-page test (existing users see $29; a cohort sees
$49-79 justified by their own "leads saved" number) turns two open questions
(pricing, WTP) into one experiment with a real answer, instead of two more research
passes.

### 4. Pull the non-English end-to-end test and Outlook capture forward — this is now a competitive-timing issue, not only a mission checkbox.

**Directly serves the mission's own wording** ("in every language, from every
platform" is item 3 of 4, not a nice-to-have) and **Rule 1** (the job, done deeper,
includes doing it in the languages competitors won't bother verifying). Per
PRODUCT_DIRECTION, this is the most-repeated "not done" item in the CEO's own
end-of-day accounting: "No real non-English lead has been tested end to end yet."
**What's new:** Bravi already operates across Europe and the US (implying real
multi-language handling in production, not just an instruction-tuned prompt);
Structurely already ships bilingual English/Spanish nurture; Verse.ai has run
multi-channel follow-up for over a decade. FollowUp's multilingual claim is currently
unverified in its own code path while several competitors — vertical and now
horizontal — already have it running against real customers. This is the one item on
this list that is pure downside risk if left undone: it's a claim already made
(mission statement, and the first outside tester specifically asked for it) that
hasn't been checked, while the field around it is catching up.

### 5. Explicitly decline to chase the AI SDR category — confirm it as a non-threat so it doesn't become a distraction.

**Rule 1 (depth over breadth) and Rule 4 (don't build free/cheap-platform parity),
applied in the negative:** `2026-09-08-broader-competitive-landscape.md` confirms
11x/Artisan/Regie.ai operate at $60,000-100,000/year, sell to sales orgs doing
outbound prospecting, and the category's own commentary is skeptical that full
autonomy even works yet for that job. Building any outbound-prospecting feature to
compete there would be exactly the "a bit of everything for everyone" trap Rule 1
warns against — a different buyer, a different motion, a different price tier, no
relation to FollowUp's actual job (inbound leads a business already has, that nobody
followed up on). The one thing worth doing here is *nothing*: name this explicitly
as checked and dismissed so a future session doesn't re-litigate it, and re-check
only if AiSDR-style downmarket pricing drift produces a real sub-$100/mo,
inbound-capable competitor — none exists today.

---

## Does anything in Part 1 change the calculus on what's currently believed?

**Yes, one real update: the biggest threat to FollowUp is no longer "a vertical
AI-native competitor" (Structurely, Ylopo) — it's a horizontal, well-funded,
general-purpose AI receptionist.** The Rule 1 decision (stay horizontal, decline the
real-estate vertical) was made partly *because* real estate turned out to be crowded
with vertical AI-native players. That reasoning still holds for real estate
specifically. But it means the actual comparison set for "is FollowUp's horizontal
bet safe" was never those vertical players — it's companies like Beside, which this
pass found for the first time: $32M raised, EQT/Index-backed, 20,000+ small-business
customers, horizontal, not vertical-locked. Beside is closer to FollowUp's actual
shape (small-business buyer, self-serve-leaning, multi-channel-adjacent) than
Structurely or Ylopo ever were, and it's better-funded than FollowUp. The good news,
also from this pass: nothing found in Beside's public feature set does the
proactive, cross-channel, gone-quiet-after-first-contact rescue job — it is
reactive, in-the-moment call/text answering. That's the actual moat today. It is not
guaranteed to stay open. **The AI SDR category does not change the calculus** —
confirmed as a different market, not a downmarket threat yet.

## One honest update to section 6 of `2026-09-07-why-followup-evidence-for-and-against.md`

**6f. A well-funded, horizontal AI-receptionist competitor now exists, and more like
it are likely coming.** Beside ($32M raised, 20,000+ small-business customers, backed
by EQT Ventures, Index Ventures, and Slack founder Stewart Butterfield as an angel)
is not vertical-locked the way Structurely and Ylopo are — it's aimed at the same
kind of small business FollowUp is, with real capital and real customer scale behind
it, less than 18 months after starting. Section 6 of the why-FollowUp doc already
names Meta and Google as platform risks and consumer AI-skepticism as a design
constraint; it did not yet name **a funded horizontal startup competitor** as a risk
category at all — every competitor discussed there and in the market-research corpus
before this pass was either a legacy CRM incumbent or a vertical-locked AI-native
player. That gap is now closed. **What doesn't change:** nothing found evidences
Beside (or Bravi, Leaping AI, Verse.ai) doing the specific job — proactive,
cross-channel neglect detection and revival of a lead that already got a first reply
— that `2026-09-07-lead-rescue-gap-and-strategy.md` identifies as the real gap. The
honest risk is not "someone already built this," it's "a well-capitalized company
with 20,000 existing customers and full-stack call/text infrastructure is one
product decision away from building it, and would be starting from a live customer
base FollowUp doesn't have yet." That is the argument for recommendation #1 above
being first, not fifth.

## Confidence and sourcing caveats

- WebFetch is blocked in this sandbox for this pass as for all prior passes; every
  finding in `2026-09-08-broader-competitive-landscape.md` is WebSearch-snippet-
  sourced. Beside's funding amount and investor names are corroborated across three
  independent outlets (Fortune, Yahoo Finance/AOL, and the underlying press cycle) —
  graded B. Its ARR and customer-count figures are the company's own claim — graded
  C, not independently verified.
- Bravi's YC-batch membership and self-description are confirmed via YC's own launch
  page — graded C (single-source, though YC's launch pages are a reasonably reliable
  primary listing for batch membership specifically).
- The claim that no competitor found does proactive cross-channel neglect detection
  is an **absence-of-evidence finding**, not a proof of absence — it means this
  specific WebSearch-based pass, across the named companies' own marketing, help
  centers, and review sites, did not surface such a feature. A company could have an
  unmarketed or newly-shipped capability this pass would not catch without a direct
  product trial or a fetched page.
- The AI SDR category verdict (non-threat) rests on pricing and positioning
  claims from industry-comparison blogs (11x's own guide, Layer3Labs, Fundraise
  Insider) rather than the vendors' own pricing pages, all graded C.
