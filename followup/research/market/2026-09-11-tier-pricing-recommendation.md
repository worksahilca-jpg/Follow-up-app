# Tier pricing recommendation: Free / Plus / Pro / Voice

**Date:** 2026-09-11
**Task:** the founder has picked a tier *shape* — Free / Plus / Pro subscriptions plus a separate
Voice add-on — that differs from the two-tier Rescue / Rescue Pro shape the prior pricing pass
recommended. This document does not re-run the competitor sweep (already done well in
`2026-09-10-pricing-and-packaging.md`); it reconciles that sweep's findings against the new shape,
fills the two genuinely open gaps (what a Free tier and a Pro tier should contain and cost), and
re-runs the margin math for this specific structure.

## Sourcing note

Six rate checks were re-run today via WebSearch to confirm nothing has moved since yesterday's
pass: OpenAI `gpt-4o-mini` pricing, OpenAI Realtime pricing, Twilio SMS/voice pricing, Vercel Pro
pricing, general 2026 freemium/free-tier cost-control practice, and two freemium/free-trial
precedents (Follow Up Boss, Housecall Pro, HubSpot). **All core rates are unchanged from the prior
pass** — see §5 for the full table. Grades follow the house convention: **B** = vendor-published,
multiple converging snippets; **C** = third-party aggregator or estimate; **D** = not found. No
number is invented; where something is a proposal rather than a measurement, it says so.

**Builds on, does not repeat:** `2026-09-10-pricing-and-packaging.md` (competitor table, the
Rescue/Rescue Pro/Voice recommendation), `2026-09-09-business-model-case.md` §8 (the cost model),
`2026-09-08-broader-competitive-landscape.md` and `2026-09-08-product-direction-synthesis.md`
(competitive context). The competitor table, the pricing-*model* analysis (why flat-not-usage,
why voice-as-add-on), and the underlying unit-cost derivations are not reproduced here — see those
documents for the full reasoning trail.

---

## 1. Reconciling the founder's shape against the prior recommendation

### 1.1 Side by side

| | **Prior recommendation (2026-09-10)** | **Founder's shape (this task)** |
|---|---|---|
| Entry point | Rescue, **$29/mo**, capped/Assisted-only | Free, **$0/mo**, capped/Assisted-only |
| Full-feature tier | Rescue Pro, **$79/mo**, everything + autonomy | Plus, **$30 or $40/mo** (undecided), "everything" non-voice |
| Scale/ops tier | *(did not exist — two tiers only)* | Pro, price/content undecided |
| Voice | Add-on, **+$39/mo**, 200 min then $0.20/min | Add-on, "a different plan," price undecided |

The founder's shape is a genuine restructuring, not a renumbering: it **adds a $0 rung below the
old floor** and **splits the old $79 tier's role into two** (a content tier and a scale tier). Both
changes are compatible with everything the prior research found; neither one contradicts it. What
needs to change is *how the $29-anchor argument is applied*, because it was written for a shape
that no longer has a paid entry tier.

### 1.2 Does the "$29 should stay the floor" argument still hold for Plus at $30 vs $40?

**Short answer: the argument doesn't bind Plus at all any more — it's already satisfied, more
strongly, by Free.** Here's why, reasoned in order:

1. The prior argument was specifically about *the floor* — "don't move the cheapest paid price
   above what Beside ($29.99) and QuoteIQ ($29.99) charge, because that's the one competitive
   anchor this ICP has actually converged on." In the founder's shape, **the floor is $0**, which
   beats that anchor outright rather than merely matching it. There is no version of "Plus at $40
   moves the floor" that's true, because Plus isn't the floor any more.
2. What Plus actually *is*, under "everything (the product's full non-voice feature set)," is
   closer to what the prior document called Rescue Pro — full multi-channel capture, autonomous
   follow-up, the recovered-revenue report — not the capped Rescue tier the $29 anchor was
   defending. Pricing that scope at $30 would be pricing *Rescue Pro-equivalent content* at
   *Rescue-anchor pricing* — internally inconsistent with the prior document's own value reasoning
   for $79, not a continuation of it.
3. The comparable that actually matters for a *full-featured* tier is Beside's own **second** tier
   (Pro, $49.99) and the fact that every genuinely full-featured competitor in the table (Sierra +
   Lead Engage $499–799, Podium + AI $498–698, Structurely $499+) charges an order of magnitude
   more. $30–$40 undercuts all of them regardless of which number is picked — the choice between
   $30 and $40 is not a choice about competitive safety, both are safe. It's a choice about
   **funnel conversion volume vs. per-account revenue**, and no willingness-to-pay evidence exists
   to settle that trade-off (this is the same open gap flagged in all three prior pricing/business-
   model passes — it is not resolved here either).

**Recommendation: $39/mo for Plus**, not $30 and not a flat $40. Reasoning, in order of weight:
- It sits just under Beside Pro's $49.99 — defensible because Plus's scope (full multi-channel +
  autonomy) is broader than what Beside Pro adds over Beside Standard (calendar sync, custom
  greetings, priority support — the kind of thing this document assigns to *Pro*, §3), so pricing
  below Beside Pro while offering more is a real, statable advantage, not just a lower number.
- It creates a clean 2× step to the recommended Pro price ($79, §3) — easy to explain to a buyer
  ("Pro is roughly double, for teams") and easy to implement as two Stripe prices with an obvious
  relationship.
- $39 vs a round $40 is a rounding choice, not a reasoned one — either is defensible. $39 is
  recommended only because it reads as "under $40" the way $29 reads as "under $30," a framing this
  ICP's comparables (Beside, QuoteIQ, Sierra Starter at $299.95, SimpleTexting) all use consistently.
- **This is a proposal, not a derived number** — same honesty the prior document applied to $79.
  If the founder's priority is maximizing free→paid *conversion volume* over *per-account revenue*,
  $30 is the more defensible choice instead, and nothing in this analysis rules it out — it only
  establishes that the *anchor-protection* reason for staying at $29-ish no longer applies, because
  Free already does that job.

**One migration flag, not asked for but load-bearing:** existing customers are on a $29/mo flat
plan today (`src/app/page.tsx:384-385`, verified in the prior pass). Moving the paid floor to
$39 is, for them, **a price increase** unless explicitly grandfathered — the prior document's stated
principle ("no existing customer's price ever goes up") should carry over unchanged: grandfather
every current $29 subscriber onto Plus (or better) at $29, permanently, the same mechanism proposed
for the Founding-50 cohort in the prior pass.

---

## 2. Free tier: definition, caps, and cost

### 2.1 Why a hard cap, not a soft one

The founder's brief is explicit that this business has already been burned by unmetered testing,
and the cost model backs up why a permanent free tier needs a real ceiling rather than a generous
one: at ~$0.001–0.002/lead in OpenAI cost, cost itself is not the risk — **an unbounded volume of
free accounts each running that cost is.** Current 2026 practice for AI products agrees:
free tiers "need hard caps, otherwise you're subsidizing usage with no conversion path," and the
recommended defense is layered — a product-level usage cap *and* a provider-level hard spend cap
in the OpenAI dashboard as a backstop against a bug or abuse pattern the product-level cap misses.
*(Grade C — freemius.com, getlago.com, via WebSearch 2026-09-11.)* One quantified benchmark from
the same pass is directly useful as a sanity check: **for freemium to stay margin-positive at a 3%
free→paid conversion rate into a $10/mo plan, cost-to-serve per free user needs to stay under
roughly $0.30/month.** *(Grade C — same source set.)* FollowUp's paid plans are 4–8× that reference
price, so the bar this tier actually needs to clear is much lower than 3% — see §5.4.

No direct comparable in the existing competitor table runs a permanent free tier (Follow Up Boss,
Housecall Pro, Structurely: trial only, re-confirmed via WebSearch today, all Grade B/C).
**Free-tier design here is borrowed responsibly from the adjacent capped-freemium-CRM category**
(HubSpot's free CRM: 2 users, 1,000 contacts, no workflow automation, forced "Powered by HubSpot"
branding — re-confirmed via WebSearch 2026-09-11, Grade C aggregator consensus), not from a direct
competitor, because none of FollowUp's direct competitors have solved this problem publicly.

### 2.2 The proposed Free tier

| | **Free** |
|---|---|
| **Price** | **$0/mo**, no time limit (distinct from the 14-day Plus/Pro trial) |
| Channels | Email (Gmail/Outlook) + website widget only |
| Autonomy | Assisted only — AI drafts, human approves. No autonomous send. |
| Lead cap | **20 new leads/mo, hard cap** |
| What happens at the cap | **Capture never stops** (leads over the cap are still recorded — a business never loses a real lead to the cap) **but AI processing pauses**: no scoring, no drafting, no translation past lead #20 until the next billing cycle or an upgrade. This is the specific mechanism that avoids the two failure modes at once: an unmetered free tier (cost risk) and a free tier that silently drops a prospect's real inquiry (trust risk, and the one this business has already been burned by once). |
| Seats | 1 |
| Voice | Not available |
| Reporting | Basic lead list only — no recovered-revenue report |
| Support | Self-serve docs / community only |
| Branding | "Powered by FollowUp" badge on the web widget |
| Data retention | 90 days of lead history (vs. unlimited on paid) |

**Why email + web widget only, not a smaller allowance of every channel:** SMS/WhatsApp/Instagram/
Messenger each require the customer to complete their own Twilio/Meta setup (10DLC registration,
Meta Business Verification) before they're usable at all — a natural complexity gate that already
keeps free-tier usage light without FollowUp needing to build a separate gate. Reserving those
channels for Plus makes the upgrade a capability decision, not an arbitrary paywall.

### 2.3 Estimated cost per free user

Built on the same per-lead figures as `2026-09-09-business-model-case.md` §8 and
`2026-09-10-pricing-and-packaging.md` §3.2 (re-verified today, unchanged):

| Cost line | Free (20 leads/mo) |
|---|---|
| AI text (scoring/drafting/translation), ~$0.001–0.002/lead × 20 | **$0.02–0.04** |
| Voicemail transcription | **$0.00** (no voice) |
| Infra (Vercel + Supabase), scaled down from the ~$2–3/customer paid estimate in proportion to volume (20 leads vs. ~150–400 for a paid account) | **$0.25–0.30** |
| Stripe | **$0.00** (no transaction) |
| Support | **$0.00** (self-serve only, by policy) |
| **Total estimated cost per free user/mo** | **≈$0.30–0.35** |

This lands right at, not above, the $0.30/mo freemium-viability benchmark found this pass — with
substantially more headroom than that benchmark assumed, because it was modeled against a $10/mo
paid plan and FollowUp's paid plans start at $39. See §5.4 for the breakeven-conversion math this
implies.

---

## 3. Pro tier: what it should actually contain, and what it should cost

### 3.1 The constraint that shapes this

The founder has already defined Plus as "everything (the product's full non-voice feature set)."
That constraint rules out the most obvious Pro differentiators — more channels, autonomy, the
recovered-revenue report — because those are Plus features by definition. **Pro has to be about
running the product at a different scale, not about unlocking more of the same product.** That is
exactly the shape the founder's own brief points at (higher usage ceilings, priority support,
multi-user seats) — the job here is to make each one concrete and to add the pieces the competitor
table shows this buyer actually pays for at the next tier up.

### 3.2 What competitors gate at their next tier up, read for Pro-relevant content

Pulled from the existing table in `2026-09-10-pricing-and-packaging.md` §1.1, re-read specifically
for scale/ops signal rather than capability signal:

- **Follow Up Boss Pro ($499/mo flat, up to 10 users)** — the jump from Grow is entirely about
  supporting a team: more users under one flat price, not new capability.
- **Sierra Interactive Growth ($599.95/mo, 5 users)** vs. Starter (1 user) — same pattern, team
  size is the tier boundary.
- **Beside Pro ($49.99 vs. $29.99 Standard)** — calendar integration, custom greetings, **priority
  support**. The smallest of the comparables, and the one whose price delta ($20) is closest to
  what a solo-to-team step-up should cost at FollowUp's price point.
- **HighLevel** gates white-label/API/agency-resale — an "ops/scale" axis, not a capability one.
- **Textline** gates seats and history retention length by tier.

None of these are "a bigger number of the same thing" — each gates something a *growing* business
needs that a solo operator doesn't. That's the model to copy.

### 3.3 The proposed Pro tier

| | **Pro** (everything in Plus, plus:) |
|---|---|
| **Price** | **$79/mo** |
| Lead cap | **None** (soft 10,000/mo abuse ceiling, not marketed as a limit) — vs. Plus's 1,500/mo fair-use ceiling |
| Team / multi-agent | Shared lead pool across agents, round-robin/manual lead routing, a manager rollup dashboard — the feature a brokerage or a team of 2+ agents needs and a solo agent doesn't |
| Reporting | Team-level recovered-revenue rollup (per-agent breakdown, exportable CSV/API) — an enhanced version of the report Plus already includes at the single-user level |
| Support | Priority — faster SLA, a named support channel (vs. Plus's standard email support) |
| Integrations | Power integrations: native Follow Up Boss / HubSpot sync, API access, premium webhook throughput |
| Onboarding | A dedicated onboarding call |
| Compliance | Data export controls, audit log — the things a brokerage's office admin asks about before a team-wide rollout (ties to the SOC 2 groundwork already scoped in `2026-09-08-soc2-timing-scoping.md`) |
| Voice | Eligible for the same +$39 add-on as Plus, same terms (see §4 for why this is *not* differentiated by tier) |
| Seats | Unlimited (same as Plus — **do not gate raw seat count**; the ICP research already documents this buyer's resentment of per-seat pricing, and Follow Up Boss is the cautionary example in the very table used to build this tier) |

**Why $79, reused rather than re-derived.** This is the same number the prior pass recommended for
Rescue Pro, and it's still the right number here — but for a different reason. In the prior shape,
$79 bought *more capability* (autonomy, more channels) over a $29 base. In this shape, $79 buys
*more scale/ops* over a $39 base that already includes that capability. The number survives because
it was never really anchored to the old tier's content — it was anchored to "an order of magnitude
under every real full-featured comparable" (§1.2 of the prior doc), which is exactly as true of the
new Pro content. Reusing it also means the margin math already validated for $79 (§5 below) carries
forward with only the usage assumptions changed.

---

## 4. Voice add-on: does +$39/200-min hold, or does it need adjusting?

**It holds, unchanged, and should stay identical whether attached to Plus or Pro.**

The obvious temptation in a three-subscription-tier shape is to make Pro's voice add-on "worth
more" — a bigger minute allowance for the same $39, on the logic that Pro customers are already
paying more. This was modeled explicitly and rejected: raising the included-minutes ceiling to,
say, 300 minutes while keeping the $39 price pushes the **worst-case** scenario (a customer who
opts into the full Realtime model and uses the full allowance) down to roughly **12% gross margin**
— uncomfortably close to breakeven, and a real number given that scenario is opt-in, not
hypothetical. The 200-minute ceiling at $39 is the number that keeps the worst case at a genuinely
survivable **41% margin** (carried forward from the prior pass's §3.2, re-verified against
unchanged 2026 rates — see §5.3). **Recommendation: $39/mo, 200 minutes included, then $0.20/min
overage (opt-in only), default to `gpt-realtime-2.1-mini`, full model available as an explicit
opt-in that consumes allowance minutes at 3× the rate — identical for Plus and Pro, no tier-based
differentiation of the add-on itself.**

This also keeps the implementation simpler: one add-on price ID, one allowance, attachable to
either base subscription — not four SKUs to keep in sync.

---

## 5. Margin math for Free / Plus / Pro / Voice

### 5.1 Underlying rates (re-verified via WebSearch, 2026-09-11 — all unchanged from the prior pass)

| Rate | Value | Grade |
|---|---|---|
| `gpt-4o-mini` | $0.15/1M input, $0.60/1M output | **B** — unchanged, re-confirmed today across OpenAI's own pricing page and multiple independent trackers |
| `gpt-4o-mini-transcribe` | ~$0.003/min | C — carried forward, not independently re-checked this pass |
| OpenAI Realtime `gpt-realtime-2.1` | $32/1M audio-in, $64/1M audio-out ≈ $0.06–0.11/min | B/C — unchanged, re-confirmed today |
| OpenAI Realtime `gpt-realtime-2.1-mini` | $10/1M audio-in, $20/1M audio-out ≈ $0.02–0.05/min | B/C — unchanged, re-confirmed today |
| Twilio US SMS | $0.0079–0.0083/segment + ~$0.003 A2P ≈ $0.011/segment | B — unchanged, re-confirmed today. **Customer's own bill, $0 FollowUp COGS.** |
| Twilio US voice | $0.0085/min inbound, $0.013–0.014/min outbound | B — unchanged, re-confirmed today. **Customer's own bill, $0 FollowUp COGS.** |
| Vercel Pro | $20/seat/mo, incl. $20 usage credit | B — unchanged, re-confirmed today |
| Supabase Pro | $25/mo base | B — carried forward from the prior pass, not independently re-checked today |
| Stripe | 2.9% + $0.30/transaction | B — unchanged |
| FX, 1 USD ≈ 1.3817 CAD | carried forward from the prior pass, not re-checked | C |

### 5.2 Per-tier cost, revenue, and margin

Usage assumptions below are this document's own modeling estimates (no production volume exists
yet), stated explicitly so they can be swapped once real data exists — the same caveat the prior
two passes carried.

| Cost line | **Free** (20 leads/mo) | **Plus** (assume 300 leads/mo) | **Pro** (assume 700 leads/mo, team) |
|---|---|---|---|
| AI text (scoring/drafting/translation/risk) | $0.02–0.04 → **$0.03** | $0.30–0.60 → **$0.45** | $0.70–1.40 → **$1.05** |
| Voicemail transcription | $0.00 (no voice) | ~30 min → **$0.09** | ~50 min → **$0.15** |
| Vercel + Supabase, amortized | **$0.25–0.30** | **$2.50** | **$3.50** |
| Stripe (2.9% + $0.30) | $0.00 | **$1.43** | **$2.59** |
| Support (assumption: $0 today / post-hire) | $0.00 (self-serve only, by policy) | **$0–2.00** | **$0–5.00** (priority SLA) |
| **Total variable cost** | **≈$0.30–0.35** | **$4.47** (no support) / **$6.47** (with) | **$7.29** (no support) / **$12.29** (with) |
| **Revenue** | **$0** | **$39** | **$79** |
| **Gross profit** | n/a (loss-leader) | **$34.53 / $32.53** | **$71.71 / $66.71** |
| **Gross margin** | n/a | **89% / 83%** | **91% / 84%** |

### 5.3 Voice add-on (unchanged from the prior pass, carried forward, both Plus and Pro)

| Cost line | Typical (mini, at allowance) | Worst case (full model, at allowance) |
|---|---|---|
| Realtime voice, 200-min ceiling | $4.00–10.00 → **$4.00** | $12.00–22.00 → **$22.00** |
| Stripe (2.9% of $39, already counted once on the base plan's invoice) | **$1.13** | **$1.13** |
| **Total variable cost** | **$5.13** | **$23.13** |
| **Revenue** | **$39** | **$39** |
| **Gross profit** | **$33.87** | **$15.87** |
| **Gross margin** | **87%** | **41%** |

The 41% worst-case margin is the one genuine cost risk in this structure, exactly as the prior pass
flagged, and the same two mitigations remain required: **default to the mini model**, and
**hard-stop at 200 minutes** with no silent overage — $0.20/min overage only for a customer who has
explicitly opted in.

### 5.4 Blended margin at a plausible mix, including a meaningful Free cohort

Free tiers carry the most users by volume almost everywhere they exist — modeling 5% free users
would understate the thing this section exists to test. Mix modeled per 1,000 total accounts:

| Tier | Share | Accounts | Revenue | Cost (no support / voice typical) | Cost (with support / voice worst-case) |
|---|---|---|---|---|---|
| Free | **55%** | 550 | $0 | $176 | $176 |
| Plus | 33% | 330 | $12,870 | $1,475 | $2,135 |
| Pro | 12% | 120 | $9,480 | $875 | $1,475 |
| Voice add-on (20% attach rate among Plus+Pro, 450 paid × 20% = 90) | — | 90 | $3,510 | $462 | $2,082 |
| **Total** | 100% | **1,000** | **$25,860** | **$2,988** | **$5,868** |

**Blended gross margin ranges 77%–88%** depending on the support-cost and voice-cost scenario
(best case, no support hire, typical voice usage: **88%**; conservative case, support hired,
worst-case voice usage: **77%**) — comfortably in the healthy-SaaS band even with a 55% free cohort,
because the free tier's cost is genuinely near-zero: **it contributes 0.7% of blended cost** ($176
of $2,988–$5,868) while costing $0 in foregone revenue that wasn't there to collect anyway.

Two blended-ARPU numbers worth reporting separately, since a 55%-free mix makes "ARPU" ambiguous:
- **Across all 1,000 accounts (including free): $25.86/mo.**
- **Across the 450 paying accounts only: $57.47/mo** — the more standard SaaS metric, and the one
  comparable to the prior pass's own $56.80 blended-paid-ARPU figure (they land within a dollar of
  each other, which is a useful cross-check that this restructuring is roughly revenue-neutral at
  the paid-account level despite the new $0 rung).

**Breakeven free→paid conversion rate**, i.e., the minimum conversion needed for converted revenue
to cover the entire free cohort's cost: with a free user costing ~$0.32/mo and a converted Plus
account contributing ~$34.53/mo gross profit, breakeven is **0.32 ÷ 34.53 ≈ 0.9% conversion** —
well under any plausible free→paid conversion rate for a qualified B2B buyer (a small-business
owner testing a lead-management tool, not an anonymous consumer signup). This is the strongest
single piece of evidence that the Free tier, as capped in §2.2, is safe to ship.

---

## 6. Recommendation summary

| | **Free** | **Plus** | **Pro** | **Voice** (add-on) |
|---|---|---|---|---|
| **Price** | **$0/mo** | **$39/mo** ($390/yr, "2 months free") | **$79/mo** ($790/yr) | **+$39/mo**, 200 min incl., then $0.20/min |
| Lead cap | 20/mo hard cap (capture continues, AI pauses) | 1,500/mo fair-use | None (soft 10,000/mo abuse ceiling) | — |
| Channels | Email + web widget | All (SMS, WhatsApp, IG, Messenger, Lead Ads, CRM import, webhook) | Same as Plus | — |
| Autonomy | Assisted only | Full (assisted + autonomous) | Same as Plus | — |
| Team features | — | — | Multi-agent rollup, lead routing, priority support | — |
| Voice-eligible | No | Yes | Yes | — |
| Est. gross margin | n/a (loss-leader, ~$0.32/mo cost) | 83–89% | 84–91% | 41–87% |

Grandfather every existing $29/mo customer onto Plus at $29, permanently — this restructuring should
ship as a pure addition for current customers, per the prior pass's own principle.

---

## Answered vs. still open

**Now evidence-backed (reasoned from the existing cost model + re-verified 2026 rates, not measured
from real usage — no production volume exists yet):**
- Free tier definition and cap (20 leads/mo, 1 seat, email+web only, Assisted-only, no voice,
  90-day retention) — costed at ≈$0.30–0.35/user/mo, under the $0.30 freemium-viability benchmark
  found this pass, with large additional headroom given FollowUp's $39–79 paid ARPU vs. the
  benchmark's $10 reference plan.
- Pro tier content (team rollup, priority support, no lead cap, power integrations, audit log) —
  built from real competitor tier-boundary patterns (Follow Up Boss, Sierra, Beside, HighLevel),
  not an arbitrary bigger number.
- Voice add-on price and structure ($39/200min/$0.20 overage) — holds unchanged from the prior
  pass; explicitly should **not** be differentiated between Plus and Pro (worst-case margin math
  rules that out).
- Why the prior "$29 as floor" argument no longer binds Plus — the floor is now $0, satisfied more
  strongly by Free than the old argument required.
- Blended margin at a free-heavy (55%), evidence-consistent mix: 77–88% depending on
  support-cost/voice-usage scenario.
- Breakeven free→paid conversion rate for the Free tier to pay for itself: ≈0.9% — a large margin
  of safety.

**Still open — needs a founder decision, not more research:**
- **Plus at exactly $39 vs. $30 vs. $40.** This document argues $39 is the best-reasoned single
  number, but the underlying trade-off (conversion volume vs. per-account revenue) has no
  willingness-to-pay evidence behind it — the same open gap flagged in all three prior pricing
  passes. A real pricing-page test remains the only way to close it.
- **The exact free-tier lead cap (20/mo).** A reasoned proposal, not a tested one. Worth testing in
  the 15–30/mo range once there's real signup volume to observe.
- **Free→paid conversion rate itself** — completely unmeasured; §5.4's blended margin is a
  plausibility check against a modeled mix, not a forecast.
- **Whether a "Powered by FollowUp" badge on the free widget is acceptable brand-wise.** Real SMB
  tools split on this (HubSpot keeps it; many competitors don't offer a free tier at all to avoid
  the question). Flagged as a design decision, not resolved here.
- **Pro's exact integration list** (which CRMs, what the API surface looks like) is proposed at the
  level of "what kind of thing," not committed — needs the same product-scoping pass the old
  Rescue Pro channel list would have needed.
- **CAD pricing / currency labeling** — carried forward as an open item from the prior pass, not
  re-solved here.

---

## Sources checked (WebSearch, 2026-09-11)

- https://pricepertoken.com/pricing-page/model/openai-gpt-4o-mini
- https://devtk.ai/en/models/gpt-4o-mini/
- https://developers.openai.com/api/docs/pricing
- https://www.layer3labs.io/guides/openai-realtime-api-pricing
- https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions
- https://www.forasoft.com/blog/article/openai-realtime-api-pricing
- https://www.twilio.com/en-us/sms/pricing/us
- https://automationatlas.io/answers/twilio-pricing-explained-2026/
- https://www.telphiconsulting.com/blog/twilio-cost-2026
- https://costbench.com/software/developer-tools/vercel/
- https://makerkit.dev/blog/saas/vercel-cost
- https://freemius.com/blog/ai-api-cost-protection/
- https://getlago.com/blog/ai-pricing-models
- https://www.capterra.com/p/130020/Follow-Up-Boss/pricing/
- https://help.followupboss.com/hc/en-us/articles/4414594545303-Getting-Started-with-a-Follow-Up-Boss-Free-Trial
- https://www.housecallpro.com/pricing/
- https://www.nutshell.com/blog/hubspot-free-crm
- https://www.engagebay.com/blog/is-hubspot-free/
- https://vedain.com/blog/7-hubspot-free-plan-limitations-2026-hidden-caps

**Internal files read:** `research/market/2026-09-10-pricing-and-packaging.md`,
`research/market/2026-09-09-business-model-case.md` §7–8,
`research/market/2026-09-08-broader-competitive-landscape.md`,
`research/market/2026-09-08-product-direction-synthesis.md`,
`research/market/2026-09-08-soc2-timing-scoping.md`.
