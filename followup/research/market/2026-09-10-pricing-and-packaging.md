# Pricing & packaging: what to charge, how to package it, and how to ship it

**Date:** 2026-09-10
**Task:** competitor price survey → pricing-model fit → concrete tier recommendation → implementation notes.

## Sourcing caveat (read this before quoting any number below)

WebFetch is egress-blocked in this sandbox, as in every prior research pass. **Every external price
in this document is a WebSearch result-snippet, not a page I fetched and read.** Most snippets come
from third-party "pricing guide" / SEO-aggregator sites, several of which exist to sell a competing
product or an "alternatives" list. Grades follow the house convention used in
`2026-09-08-pentest-vendor-options.md`:

- **Grade B** — the vendor publishes the number itself and multiple independent snippets converge on
  it unchanged (OpenAI, Twilio, Follow Up Boss, Sierra Interactive, Jobber, Housecall Pro, Intercom Fin).
- **Grade C** — third-party aggregator only, or the vendor is sales-gated and the figure is an
  estimate (ServiceTitan, Lofty, Podium, Birdeye, Conversica, Structurely, Beside, Verse.ai).
- **Grade D / not found** — named explicitly where a price could not be established at all.

No price in this document was invented. Where I could not find one, it says so.

**Internal baseline this builds on (not repeated here):**
`2026-09-09-business-model-case.md` §7–§8 (unit economics, competitor table, the CEO's standing
"hold off on pricing" instruction), `2026-09-08-pricing-validation-home-services-icp.md` (the first
comparable-price pass), `2026-09-07-lead-rescue-gap-and-strategy.md` (the value story this pricing
has to express). This document adds: a 2026-refreshed and broadened price survey, a pricing-*model*
analysis that the prior passes did not do, and a specific tier proposal with margin math.

**Current state, verified in code today (not assumed):**
- `src/app/page.tsx:384-385` — landing page shows **`$29/mo`**, single card, currency unlabelled,
  headline "One plan. Everything included. Cancel any time."
- `src/lib/billing.ts:11` — **`TRIAL_PERIOD_DAYS = 14`**. A trial now exists (the business-model
  doc's "no trial" line is stale).
- `src/app/api/billing/checkout/route.ts:59-60` — `trial_period_days: 14` +
  `payment_method_collection: "if_required"` → **no card collected during trial**.
- `src/lib/stripe.ts:21` — **one** price: `PLAN_PRICE_ID = process.env.STRIPE_PRICE_ID`.
- `prisma/schema.prisma:68-74` — `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`
  only. **There is no plan/tier field anywhere in the data model.**
- **The pricing section never mentions the 14-day trial.** The only trial copy in the product is
  `src/components/Sidebar.tsx:158` — i.e. it is shown *after* someone has already signed up.

---

## 1. What comparable tools charge in 2026, and how they package it

### 1.1 The table

| Tool | List price (2026) | Unit | What's gated behind tiers | Trial | Annual discount | Grade |
|---|---|---|---|---|---|---|
| **HighLevel (GoHighLevel)** | Starter **$97/mo**, Unlimited **$297/mo**, SaaS Pro **$497/mo** | Flat per account (sub-accounts, not seats) | Starter caps you at <3 client accounts; white-label, API and agency resale gated to Unlimited/SaaS Pro. **Email, SMS, phone and metered AI usage all billed on top of every plan.** | 14 days standard, card required; 30 days via partner links | Annual ≈ **$80 / $247 / $414** effective (~17%) | C |
| **Follow Up Boss** | Grow **$69/user/mo**, Pro **$499/mo** (≤10 users), Platform **$1,000/mo** (≤30 users) | **Per seat** at entry, flat-with-cap above | Calling/dialer included at Pro+; on Grow the dialer is **+$39/user/mo** | Not established this pass | Grow ≈ **$58/user/mo** annual (~16%) | B |
| **Structurely** | Team **$499/mo** + **$2,000** one-time onboarding; Company **$999/mo** + $2,500 onboarding; Enterprise & White Label custom | Flat platform fee **+ per-activity "action credits"** | Custom agent configs and a cheaper credit rate gated to Company+ | **No free trial, no free tier** | Listed prices *are* the annual price; **month-to-month is +20%** | C |
| **Conversica** | From **~$2,999/mo**, custom above | Flat, scaled by conversation volume + features. No per-seat. | Everything negotiated; no published tiers | A trial is referenced, terms not published | Annual commitments typical, often multi-year | C |
| **AiSDR** | Solo **$250/mo**, Explore **$900/mo**, Scale **$2,500/mo** | **Credit-based**: Explore = 1,200 AI messages + 1,200 lead-search credits/mo (≈350–400 leads) | Volume of message + search credits *is* the tier | Not established | **Billed quarterly minimum**; ~20% off annual | C |
| **Lofty (Chime)** | **$449–$1,500/mo** + **$299 setup** | Flat per account, band set by package and team size | Not publicly listed — request-based pricing across Agent/Team/Broker/Enterprise | Not established | Not established | C |
| **Sierra Interactive** | Starter **$299.95/mo** (1 user), Essential **$399.95/mo** (3), Growth **$599.95/mo** (5) — annual billing. **Lead Engage AI add-on $199/mo** (unlimited leads) | Flat with a **seat cap**, plus per-add-on | **Lead Engage is not available on Starter.** Auto-dialer, extra users, premium designs, ad management all separate line items | Not established | Monthly billing is $359.95/$474.95/$724.95 **plus a $500 setup fee that annual waives** — annual saves ~17–20% *and* $500 | B |
| **Podium** | Core **~$399/mo**, Pro **~$599/mo** per location, Signature custom. **AI Employee add-on ~$99/mo** (reported range $99–$399) | **Per location**, + per-user overage $25/mo, + $50/mo per extra location | AI Employee is an **add-on to every tier**, not bundled. $5/mo/location 10DLC fee mandatory | Not established for 2026 | 12-month auto-renewing contracts are the default shape | C |
| **Birdeye** | Starter **$299**, Growth **$349**, Dominate **$449** — **per location, per month, billed annually** | **Per location** | Tier = feature breadth of the reputation suite | Not established for 2026 | **Monthly billing is +30%.** Plus an **8% "Innovation Fee" at renewal** and $5–15K implementation for multi-location | C |
| **SimpleTexting** | **$39/mo** for 500 credits → $59 (1,000) → $89 (2,000) → $119 (3,000) → $239 (7,500), up to ~$899 (50,000). **+$20/mo per additional user**, +$10/mo for a local number | **Per message credit**, with per-seat surcharge on top | Volume of credits is the tier | Free trial offered (length not confirmed this pass) | **20% off annual** (Starter → ~$23.20/mo effective) | C |
| **Textline** | Essentials **$149/mo** — 3 agents, 600 credits. Extra credits ~$0.03; **500-credit/$15 monthly minimum**; **+$15/mo 10DLC industry fee** | **Per seat + per credit** (hybrid) | Seats and history retention (3 years at Essentials) | Free trial offered (length not confirmed) | Not established | C |
| **Jobber** | Core **$49/mo** (1 user), Connect **$129–139/mo** (≤5), Grow **$199–249/mo** (≤15). Extra users **$19–29/mo** | **Flat with a seat cap** | Automation/quoting depth rises with tier | 14-day trial standard for this category (not re-verified) | Core **$39/mo monthly → $28/mo annual** (~28%) | B |
| **Housecall Pro** | Basic **$59/mo** annual / $79 monthly (1 user); Essentials **$149** annual / $189 monthly (≤5 users); MAX **$299** annual / $329 monthly (+$35/extra user) | **Flat with a seat cap** | **Missed-call text-back is gated at Essentials** (~$149–189/mo) — i.e. behind a tier 5× FollowUp's whole price | Trial offered (length not confirmed) | ~21–25% (Basic $79→$59, Essentials $189→$149) | B |
| **Intercom Fin** (the outcome-pricing model to study) | **$0.99 per resolution**, on top of a **$49/mo** base that includes 50 resolutions. Qualifications billed at **$9.99 each** | **Per outcome** (resolution / procedure handoff / disqualification) | Minimum 50 outcomes/mo; **no volume discount** | Yes (Intercom trials) | n/a — usage doesn't discount annually | B |
| **Beside** (closest horizontal SMB competitor, $32M raised) | Standard **$29.99/mo**, Pro **$49.99/mo** | Flat, **per user**, unlimited calls, **no per-call fees** | Pro adds calendar integrations, custom greetings, priority support | Not established | Not established | C |
| **QuoteIQ Essentials** (carried from prior pass) | **$29.99/mo** / $299.99/yr | Flat, 1 user, 500 AI credits | — | — | ~17% | C |

### 1.2 What the table actually says

**Five structural patterns, each of which is a decision FollowUp has to make on purpose:**

1. **Nobody serious in the SMB tier charges per seat any more, and the ones who do get complained
   about.** Follow Up Boss's $69/user is the only pure-seat entry price in the set, and the prior
   ICP research already logged reviewers' resentment of exactly that shape. Everything else is flat
   with a seat *cap* (Jobber, Housecall Pro, Sierra), flat per location (Podium, Birdeye), or flat
   per account (HighLevel, Beside). **FollowUp's existing flat, seatless shape is already the
   market-correct one** — this is a thing to defend loudly, not a thing to fix.
2. **The AI capability is almost always an add-on, not a bundled feature.** Podium's AI Employee
   (+$99), Sierra's Lead Engage (+$199), CallRail's Voice Assist (+$95, prior pass), HighLevel's
   metered AI usage. Only Beside and QuoteIQ bundle AI into the base price at an SMB price point.
   **This is a real packaging precedent for making FollowUp's voice agent an add-on rather than a
   tier feature** — buyers in this market already recognise "the AI thing costs extra."
3. **Message/minute usage is billed on top by nearly everyone.** HighLevel ("email, SMS, phone and
   metered AI billed separately"), Textline (credit minimums + a $15/mo 10DLC fee), SimpleTexting
   (credits), Podium ($5/mo/location 10DLC), Structurely and AiSDR (action/message credits).
   FollowUp's bring-your-own-Twilio architecture means the customer already pays telephony directly
   at cost with **no markup** — that is a genuinely differentiated, honestly-marketable position
   that the current landing page does not say anywhere.
4. **Annual discount converges hard on 15–20%.** HighLevel ~17%, Follow Up Boss ~16%, Housecall Pro
   ~21–25%, SimpleTexting 20%, AiSDR ~20%, Structurely +20% for the privilege of paying monthly,
   Birdeye +30% for monthly. Independent benchmark research puts the B2B SaaS median at
   **15–20%, with "two months free" (16.7%) the standard framing** and >25% flagged as
   value-destroying. *(Grade C — growthspreeofficial.com, medium.com/@lesiapolivod, via WebSearch
   2026-09-10; converges with six observed vendor discounts above, which is the stronger signal.)*
5. **Trials are the norm at the low end and absent at the high end.** Structurely explicitly has
   none; Conversica and Lofty are sales-gated. HighLevel runs 14 days **with a card**. Benchmark
   data: 14 days is the most common length (**62% of products**); median conversion for
   **opt-in (no card) trials is ~8.9%**, while **card-required trials convert ~30%** — roughly 5×
   better per signup, at the cost of far fewer signups. SMB-focused products with $1K–$10K ACV
   convert 18–30%. *(Grade C — shno.co, chartmogul.com, userpilot.com, via WebSearch 2026-09-10.)*
   FollowUp's 14-day no-card trial sits on the high-volume/low-conversion side of that trade —
   a deliberate, defensible choice, but one worth A/B testing rather than assuming.

**The price gap, restated with 2026 numbers:** the *narrower* comparables (Podium+AI $498–698,
Sierra+Lead Engage $499–799, Structurely $499 + $2,000 onboarding, Birdeye $299–449/location,
Housecall Pro's text-back tier $149–189) run **5–25× FollowUp's $29**. The *shape*-comparable
competitors — Beside ($29.99/$49.99) and QuoteIQ ($29.99) — sit at exactly FollowUp's price.
**Beside is the single most important new datum in this pass:** a $32M-funded horizontal SMB AI
competitor has independently landed on a **two-tier $29.99 / $49.99** structure. That is
convergent evidence that (a) ~$30 is the right entry price for this buyer, and (b) roughly $50 is
what this buyer will pay for "the better version" without a sales call.

---

## 2. Which pricing model fits "leads rescued / revenue recovered"

The core constraint, stated once because it disqualifies half the options: **FollowUp's value
proposition is that the AI does work the human didn't. Any model that charges more when the AI
works harder is a model that bills the customer for their own neglect and taxes the exact behaviour
the product exists to produce.** A customer who goes on vacation and misses 40 leads is the
customer FollowUp saves the most — and is the customer a per-message model would hit with the
biggest invoice, in the month they had the least revenue coming in. That is not a hypothetical
objection; it is the "bill shock" failure mode the SMB pricing research documents directly.

| Model | Pros | Cons | Verdict for FollowUp |
|---|---|---|---|
| **Flat per business** | Perfectly predictable; matches the ICP's documented resentment of seats/tiers/contracts; zero billing surface to explain; sales-free self-serve; already implemented | Leaves money on the table from heavy users; no expansion revenue, so net revenue retention ≈ 100% minus churn; can read as "too cheap to be real" at the top of the market | **Yes — the base.** Structurally right and already the customer-facing promise. |
| **Per channel add-on** | Natural upsell ladder; each channel has a real marginal onboarding cost (10DLC, Meta Business Verification); mirrors Podium/Sierra add-on norms buyers already accept | Directly contradicts the mission line "every language, every channel" from the strategy doc; a business that gets leads on Instagram is punished relative to one on email; creates 5+ SKUs to explain and gate | **No as a paywall, yes as a tier boundary.** Don't sell channels à la carte; group them (email+web in entry, SMS/WhatsApp/IG/Messenger/CRM in the upper tier). |
| **Per active lead** | Scales with the customer's own business volume, so it feels fair; the unit is one the buyer already understands (they pay per lead to Zillow/Angi/Meta today) | Punishes the *good* month; makes cost unforecastable exactly when lead flow spikes; creates an incentive to *not* import old leads — which kills the lost-lead-recovery half of the product; needs metering infrastructure that doesn't exist | **No as the primary meter.** Usable only as a very high fair-use ceiling. |
| **Per conversation / per message** | Aligns cost to FollowUp's own OpenAI cost; industry-normal (Structurely credits, AiSDR credits, SimpleTexting credits, Textline credits) | **The worst fit of the five.** Charges most in the rescue-heavy months; the customer's rational response is to turn automation *down*; FollowUp's actual AI cost is ~$0.001–0.002/lead, so metering it is billing theatre with real support cost | **No.** |
| **Outcome-based (per recovered lead)** | The most compelling *story* the product could possibly tell, and it's the exact metric the strategy doc names as "the metric that matters." Research: outcome-linked components correlate with **31% higher retention and 21% higher satisfaction** | Attribution is the killer — "your AI didn't recover that, my callback did" is an unwinnable argument with a plumber; needs a recovered-lead definition the customer will accept *before* they're billed by it; vendor absorbs all cost variance; **only 18% of AI deployments use purely outcome-based models vs 64% with some performance-linked component** — the market itself has already reverted to hybrid | **Not as the meter — as the *proof*.** Report recovered leads and recovered revenue prominently; do not bill on them. See below. |

*(Outcome-pricing pros/cons and the 31%/21%/64%/18% figures: Grade C — getmonetizely.com,
zuora.com, zendesk.com, revinci.ai, via WebSearch 2026-09-10. The 64%/18% split is attributed in
the snippet to a 2023 survey, so treat it as directional and dated, not current-year.)*

### What SMBs actually tolerate

- **Hybrid (stable base + bounded usage) is the consensus tolerable shape**, and pure usage is
  actively backfiring on this buyer: documented 2026 cases of a single session producing a $7,225
  charge and a routine campaign producing $4,800. SMBs have "limited cash flow and no dedicated
  finance teams"; unpredictable spikes cause **forced underuse of features**, which is churn with
  extra steps. The recommended pattern is a base subscription plus **controlled allowances,
  proactive alerts and spending caps**. *(Grade C — doolly.com, fungies.io, valueships.com, via
  WebSearch 2026-09-10.)*
- Market-wide, **42% of products now offer a usage-based option (up from 27% in 2023)** and pure
  per-seat is shrinking — but the same sources note the shift is **slower and weaker at the SMB
  end**, where simplicity and self-serve are the competitive axis. *(Grade C — same sources,
  consistent with the 37%-hybrid / 38%-usage figures already recorded in
  `2026-09-09-business-model-case.md` §7.)*
- **Three-tier good-better-best is the dominant packaging convention and the middle tier should
  capture 50–60%** of customers via the decoy effect. *(Grade C — saasdash.ai, dealhub.io,
  fungies.io, via WebSearch 2026-09-10.)* **I am recommending against a third tier anyway** — see
  §3.4 — because the ICP research's specific finding (this buyer resents tier ladders more than
  they resent the number) outranks a generic packaging heuristic, and because a third tier with
  nothing real to gate is a decoy the customer can see through.

### The synthesis

**A flat base with generous fair-use limits, one capability add-on that has a genuinely variable
cost (voice minutes), and outcome reporting used as the renewal argument rather than the meter.**
This is the only combination that (a) never bills more when the AI does more of the follow-up work,
(b) still lets FollowUp capture the value of a heavier customer, (c) keeps FollowUp's own worst-case
COGS bounded, and (d) tells the "revenue recovered" story without having to defend an attribution
claim on an invoice.

---

## 3. The recommendation

**Standing constraint, stated up front:** `2026-09-09-business-model-case.md` §7 records the CEO's
explicit "hold off on pricing." **This is a proposal to be approved or rejected, not a change to
make.** It is also designed so that no existing customer's price ever goes up.

### 3.1 The tiers

FX for all conversions: **1 USD = 1.3817 CAD** (2026-09-10). *(Grade C — tradingeconomics.com via
WebSearch 2026-09-10; spot rate, will drift. CAD prices below are rounded to a locally sensible
number, not mechanically converted — this is standard practice and the small rounding error is
noise against FX drift.)*

| | **Rescue** (entry) | **Rescue Pro** (target tier) | **Voice Agent** (add-on to either) |
|---|---|---|---|
| **USD / mo** | **$29** | **$79** | **+$39** |
| **CAD / mo** | **$39** | **$109** | **+$54** |
| **USD / yr (2 months free)** | **$290** ($24.17/mo eff.) | **$790** ($65.83/mo eff.) | **$390** |
| **CAD / yr** | **$390** | **$1,090** | **$540** |
| Channels | Email (Gmail/Outlook), website widget, manual + CSV | **+ SMS, WhatsApp, Instagram DM, Facebook Messenger, Lead Ads, Follow Up Boss / HubSpot import, webhook** | — |
| Instant in-language acknowledgement | Yes | Yes | Yes |
| Lead scoring with visible reasons | Yes | Yes | — |
| AI-drafted follow-ups | Yes, **approval-first (Assisted)** | Yes | — |
| Autonomy | Assisted only + missed-call text-back | **Autonomous tier unlockable per lead**, rules engine, Ponds & Smart Views | — |
| Lead rescue / at-risk view | Yes | Yes **+ recovered-lead & recovered-revenue report** | — |
| Fair-use ceiling | 500 leads/mo | 3,000 leads/mo | 200 AI-talk minutes/mo, then **$0.20/min** |
| Seats | Unlimited | Unlimited | — |
| Trial | 14 days, no card | 14 days, no card | Included in trial |

**Why $29 stays as the floor rather than moving to $39–49.** Three independent reasons, in order of
weight: (1) it holds the price-anchor line against Beside's $29.99 and QuoteIQ's $29.99, the only
two same-shape competitors found across three research passes; (2) it means the change ships as a
pure *addition*, so there is no grandfathering problem, no repricing email, and no reason for a
current customer to re-evaluate; (3) it makes the upgrade a value decision rather than a price
increase, which is the version the CEO's "hold off" instruction can most easily say yes to.
**The headroom the prior research identified is captured at $79, not by moving the floor.**

**Why $79 rather than Beside's $49.99 for the upper tier.** Beside's $49.99 buys a better
*receptionist* — calendar integration, custom greetings, priority support. FollowUp Pro buys six
additional lead channels, cross-channel neglect detection, autonomous follow-up, and a recovered-
revenue report, against a comparison set (Sierra+Lead Engage $499–799, Podium+AI $498–698,
Structurely $499+$2,000) that charges 6–10× more for less. $79 undercuts every one of those by an
order of magnitude while roughly matching the value density Beside's own $20 step-up implies at
half the feature delta. **$79 is a proposal, not a derived number** — no customer willingness-to-pay
evidence exists above $29 (the open gap flagged in both prior pricing docs is still open).

**Why the voice agent is an add-on, not a tier feature.** It is the only component with a genuinely
variable, unbounded per-customer cost (see §3.3), and the market has already trained this buyer to
expect the AI-voice piece to cost extra (Podium +$99, Sierra +$199, CallRail +$95). Bundling it into
$79 would put a $33 worst-case COGS item inside a fixed price.

### 3.2 Estimated variable cost per active business per month

All figures are my estimates, built from the token-level model in `2026-09-09-business-model-case.md`
§8 with the underlying rates re-verified today.

| Rate | Value | Grade |
|---|---|---|
| `gpt-4o-mini` | $0.15/1M input, $0.60/1M output — unchanged since launch, re-confirmed 2026 | **B** (vendor-published, multiple converging snippets) |
| `gpt-4o-mini-transcribe` | ~$0.003/min | C |
| OpenAI Realtime `gpt-realtime-2.1` | $32/1M audio-in, $64/1M audio-out ≈ **$0.06–0.11/min** with caching | B/C (token rates B, per-minute conversion C) |
| OpenAI Realtime `gpt-realtime-2.1-mini` | $10/1M audio-in, $20/1M audio-out ≈ **$0.02–0.05/min** with caching | B/C |
| Twilio US SMS | $0.0079–0.0083/segment + ~$0.003 A2P carrier ≈ **$0.011/segment** | B |
| Twilio US voice | $0.0085/min inbound, $0.014/min outbound; $1.15/mo per number; $4/mo brand + $10/mo campaign 10DLC | B |
| Vercel Pro / Supabase Pro | $20/seat/mo (incl. $20 usage credit) / $25/mo base | B (carried from §8, not re-verified today) |
| Stripe | 2.9% + $0.30 per transaction | B |

**Twilio and Meta fees are billed to the customer's own account, not FollowUp's** — the structural
margin advantage over Podium/Birdeye/CallRail already documented in §8. They appear here only as
customer TCO, and they are **$0.00 in every FollowUp margin line below**.

**Per-lead AI text cost:** ~1 classification + ~2 scorings + ~2 drafts + ~1 risk assessment +
1 translation ≈ **$0.001–0.002/lead**.

| Cost line | **Rescue** (assume 120 leads/mo) | **Rescue Pro** (assume 400 leads/mo, all channels) | **Voice add-on** (200 min ceiling) |
|---|---|---|---|
| OpenAI text (scoring/drafting/translation/risk) | $0.12–0.24 → **$0.20** | $0.40–0.80 → **$0.60** | — |
| Voicemail transcription (~20 × 1 min) | **$0.06** | **$0.12** | — |
| Realtime voice, **mini**, typical 40% utilisation (80 min) | — | — | **$1.60–4.00** |
| Realtime voice, **mini**, 100% of allowance (200 min) | — | — | **$4.00–10.00** |
| Realtime voice, **full model**, 100% of allowance | — | — | **$12.00–22.00** (worst case) |
| Vercel + Supabase, amortised at ~100 customers | **$2.00** | **$3.00** | — |
| Stripe (2.9% + $0.30) | **$1.14** | **$2.59** | **$1.13** |
| Support (blended assumption, $0 today / $3 post-hire) | **$0–3.00** | **$0–3.00** | — |
| **Total variable cost** | **$3.40** (no support) / **$6.40** (with) | **$6.31** (no support) / **$9.31** (with) | **$5.13** typical / **$23.13** worst case |
| **Gross profit** | **$25.60 / $22.60** | **$72.69 / $69.69** | **$33.87 / $15.87** |
| **Gross margin** | **88% / 78%** | **92% / 88%** | **87% / 41%** |

**Blended margin at a plausible mix** (60% Rescue, 40% Rescue Pro, 20% voice attach, post-support-hire):
ARPU = (0.6 × $29) + (0.4 × $79) + (0.2 × $39) = **$56.80**.
Blended cost = (0.6 × $6.40) + (0.4 × $9.31) + (0.2 × $5.13) = **$8.59**.
**Blended gross margin ≈ 85%** — comfortably in the healthy-SaaS band and consistent with the
75–89% range §8 already modelled at $29 flat, but on nearly **2× the ARPU**.

**The one real cost risk, named plainly:** the voice add-on run on the *full* Realtime model at
*full* allowance drops to **41% margin**, and a customer who talks past the allowance without an
overage charge would go negative. Two mitigations, both required for this add-on to be safe:
(1) **default to `gpt-realtime-2.1-mini`**, offering the full model only as an opt-in that consumes
allowance minutes at 3× the rate; (2) **hard-stop at the 200-minute ceiling** unless the customer has
explicitly opted into $0.20/min overage. $0.20/min is 4–10× the mini cost and ~2× the full-model
cost — safe under every rate scenario found.

### 3.3 The founder-friendly pilot offer

**"Founding 50."** The first 50 businesses that complete onboarding and connect at least one live
channel get:

- **Rescue Pro features at the Rescue price ($29 USD / $39 CAD), price-locked for 24 months.**
- **A 30-day trial instead of 14** (a `trial_period_days` value, already a per-session parameter —
  no structural change).
- The Voice Agent add-on **free for the first 3 months**, then normal price.
- Named on the site as a founding customer, if they want it.

In exchange, and stated as an explicit condition rather than a hope: a **20-minute interview**,
**permission to publish their recovered-lead numbers** as a case study, and **a monthly reply on
draft quality**. That last one is the actual point — it is the only mechanism currently proposed
that generates the willingness-to-pay and average-deal-value evidence *both* prior pricing docs
flag as the outstanding gap.

**Deliberately not offered: a discount below $29.** Discounting the floor damages the anchor
permanently and, per the discount research, acquisition discounts should stay at 5–10% while
15–20% is reserved for annual commitment. **Give away capability and time, never the floor price.**
Margin cost of the pilot at 50 customers: 50 × ($72.69 − $25.60) ≈ **$2,354/month of forgone gross
profit at full uptake**, which is the honest price of the evidence.

### 3.4 Why two tiers and not three

The good-better-best research says three, with the middle capturing 50–60%. I'm recommending two
anyway, for three specific reasons: (1) the ICP research's own finding is that this buyer resents
the tier *ladder* more than the number, and the quoted complaints across Follow Up Boss, Podium and
Birdeye are all about tier/seat/add-on structure rather than headline price; (2) there is no third
bundle of capability that is real — a third tier today would have to gate something arbitrary, and
this buyer notices; (3) Beside, the best-funded direct-shape competitor, independently chose two.
**Revisit at ~200 customers**, when a genuine multi-user / multi-location need has actually shown
up in the data — that is when a third tier gates something the customer agrees exists.

---

## 4. What to change — landing page and Stripe (described, not coded)

### 4.1 Landing page (`src/app/page.tsx`, pricing section at line ~369)

1. **Replace the single card with two cards plus an add-on row.** Mark **Rescue Pro** "Most popular."
   Keep the current visual language; the section is already well-designed, this is a content change.
2. **Surface the free trial in the pricing section.** This is the highest-value single fix in this
   document and it is independent of whether the tier proposal is approved. The 14-day no-card trial
   exists in code (`billing.ts:11`, `checkout/route.ts:59-60`) and the pricing section says nothing
   about it — the only in-product trial copy is `Sidebar.tsx:158`, shown *after* signup. Every
   comparable that has a trial leads with it. Add "**14 days free. No credit card.**" directly under
   each price and change the CTA from "Get started" to "Start free trial."
3. **Label the currency.** "$29/mo" is unlabelled on a product with a Canadian founder and a
   `.io` domain. Show "USD" explicitly, and ideally a CAD/USD toggle.
4. **Add a monthly/annual toggle** with "2 months free" as the annual label — that framing, not
   "17% off," is what the discount research says lands.
5. **Add a line the competitors cannot copy:** "*No per-message or per-minute fees. You connect your
   own Twilio account and pay carrier cost directly — we don't mark it up.*" HighLevel, Textline,
   SimpleTexting, Podium and Structurely all bill usage on top. This is a real, verifiable, currently
   unstated differentiator.
6. **Change the section subhead.** "One plan. Everything included." becomes false the moment there
   are two tiers — and "Everything included" is already doing risky work given the voice agent.
7. **Do not put a price on the outcome.** Show recovered leads / recovered revenue as the *proof*
   beside the pricing table, never as a billing unit (§2).
8. **Add three FAQ entries** to the existing `LandingFaq` block: what happens when the trial ends
   (nothing is charged without a card — say so), what the fair-use lead ceilings mean in practice,
   and whether prices are USD.

### 4.2 Stripe and the data model

The current implementation supports exactly one price and stores no plan. Four changes, roughly in
dependency order:

1. **Replace the single `STRIPE_PRICE_ID` env var with a plan catalogue.** `src/lib/stripe.ts:21`
   exports one `PLAN_PRICE_ID`. It needs to become a typed map: tier × interval (monthly/annual) ×
   currency (USD/CAD) → Stripe price ID, plus the add-on's own price IDs. Keep the legacy $29
   price ID in the catalogue permanently as a **grandfathered** entry — existing subscribers must
   never be migrated.
2. **Add plan state to the schema.** `prisma/schema.prisma:68-74` has no plan field. Add a `plan`
   enum (`RESCUE` / `RESCUE_PRO` / `LEGACY_FLAT`) and a `voiceAddOn` boolean on `Business`,
   populated **from the webhook**, never from the client. Nullable + defaulted so the migration is
   safe against existing rows.
3. **Teach the webhook to read every subscription item.**
   `src/app/api/billing/webhook/route.ts:60` reads only `subscription.items.data[0]` (for
   `current_period_end`). With an add-on there are two items. It must iterate all items, map each
   price ID back through the catalogue, and set `plan` + `voiceAddOn` accordingly — plus handle the
   case where a price ID isn't recognised (log loudly, fail closed to the lower tier, never crash
   the webhook).
4. **Make the gate plan-aware.** `hasActiveAccess()` (`src/lib/billing.ts:19`) is boolean. Without a
   companion `planAllows(business, feature)` helper — consulted by the SMS/WhatsApp/Instagram/
   Messenger/CRM-import entry points, the autonomous-tier setter, and the voice-agent route —
   **the tiers are cosmetic and every customer gets everything.** This is the change that makes the
   packaging real, and it is the one most likely to be under-scoped.
5. **Checkout must accept a tier.** `checkout/route.ts` hard-codes
   `line_items: [{ price: PLAN_PRICE_ID, quantity: 1 }]`. It needs to take a requested tier +
   interval + add-on flag from the caller, **validate against the server-side catalogue** (never
   trust a price ID from the client), and build the line items. `trial_period_days` is already a
   parameter, so the Founding-50 30-day trial is a value, not a rewrite.

**Stripe-dashboard-side, described not decided:**

- **Multi-currency Prices on one Product** is the cleaner way to sell in CAD and USD than duplicate
  Products — but it changes how the webhook identifies a plan, so decide before creating the objects.
- **Enable plan switching in the Customer Portal config** so upgrade/downgrade needs no new code —
  the portal route (`api/billing/portal`) already exists.
- **Tax.** A Canadian entity selling to Canadian SMBs has a real GST/HST obligation past the
  small-supplier threshold. Stripe Tax / `automatic_tax` is the mechanism. **Flagging, not
  advising — this needs an accountant, not a research agent.**
- **Voice overage metering is the one genuinely new billing surface.** A metered Price plus a
  usage-reporting job is real work and a real source of bill-shock complaints. **Recommended for
  v1: hard-cap at 200 minutes with an in-app warning at 80%, and no overage billing at all.** Ship
  metered overage only once someone actually hits the cap and asks for more.
- **Card-on-trial is worth an A/B test, not a change.** `payment_method_collection: "if_required"`
  currently collects no card. The benchmark data (≈8.9% opt-in vs ≈30% card-required conversion,
  at much lower signup volume) says this is a genuine trade-off with a real answer available from
  a test, and the answer is not obvious at FollowUp's current volume.

---

## Open questions this document does not resolve

1. **Willingness to pay above $29 is still unevidenced.** Three research passes have now flagged
   it; $79 is reasoned from comparables, not measured. The Founding-50 interviews are the proposed
   mechanism.
2. **Beside's actual feature depth and trial terms** — the single most important competitor, and
   its pricing page could not be fetched. The $29.99/$49.99 figures are aggregator-sourced (Grade C)
   and should be re-checked from an unblocked network before anything is priced against them.
3. **Lofty, Conversica, Verse.ai and Podium Signature are sales-gated** — no published price exists
   to verify. Every figure for them is a third-party estimate.
4. **No trial terms found** for Podium, Birdeye, Follow Up Boss, Lofty or Beside. Recorded as
   "not established," not as "no trial."
5. **Vercel/Supabase per-customer amortisation is modelled, not measured** — FollowUp has never run
   at 100 or 500 customers, so the $2–3/customer infra line is the least certain input in §3.2.

---

## Sources checked (all via WebSearch, 2026-09-10; no page was fetched)

- https://www.ghlexperts.com/gohighlevel-plans-pricing
- https://automatethejourney.com/blog/gohighlevel-pricing-plans-2026
- https://netpartners.marketing/gohighlevel-pricing-plans-explained-features-value-cost-comparison-2026/
- https://automatethejourney.com/blog/gohighlevel-free-trial-2026
- https://ghlfocus.com/how-to-get-gohighlevel-for-free/
- https://www.luxurypresence.com/blogs/follow-up-boss-pricing/
- https://www.cloudtalk.io/blog/follow-up-boss-pricing/
- https://www.capterra.com/p/130020/Follow-Up-Boss/pricing/
- https://www.structurely.com/pricing
- https://www.g2.com/products/structurely/pricing
- https://www.capterra.com/p/236097/Structurely/
- https://marketbetter.ai/blog/conversica-pricing/
- https://www.11x.ai/guides/conversica-pricing
- https://www.capterra.com/p/156614/AI-Automated-Sales-Assistant/pricing/
- https://www.landbase.com/blog/aisdr-pricing
- https://www.marketbetter.ai/blog/aisdr-pricing-breakdown-2026/
- https://www.g2.com/products/aisdr-inc-aisdr/pricing
- https://www.luxurypresence.com/blogs/lofty-pricing/
- https://www.realsavvy.com/lofty-pricing
- https://lofty.com/price-packages
- https://www.sierrainteractive.com/pricing/
- https://www.luxurypresence.com/blogs/sierra-interactive-pricing/
- https://www.robinflow.com/blog/sierra-interactive-300-base-price-costs-teams-1500
- https://www.pinova.in/blog/sierra-interactive-pricing-2026
- https://astucia.io/blog/podium-pricing-2026-what-smbs-actually-pay
- https://wiserreview.com/blog/podium-pricing/
- https://checkthat.ai/brands/podium/pricing
- https://wiserreview.com/blog/birdeye-pricing/
- https://checkthat.ai/brands/birdeye/pricing
- https://www.replifast.com/blog/birdeye-pricing-2026
- https://ddiy.co/simpletexting-pricing/
- https://costbench.com/software/sms-marketing/simpletexting/
- https://www.textline.com/pricing
- https://hackceleration.com/labs/textline-pricing
- https://emitrr.com/blog/textline-pricing/
- https://www.scanmanifold.com/blog-posts/jobber-pricing-2026-what-every-plan-costs
- https://costbench.com/software/field-service-management/jobber/
- https://www.capterra.com/p/127994/Jobber/pricing/
- https://schedulingkit.com/pricing-guides/housecall-pro-pricing
- https://projul.com/blog/housecall-pro-pricing-analysis-2026/
- https://fin.ai/help/en/articles/13975800-fin-pricing-outcomes
- https://www.gleap.io/blog/intercom-fin-ai-pricing-2026
- https://www.getmacha.com/blog/intercom-fin-pricing
- https://www.beside.com/pricing
- https://www.getnextphone.com/blog/beside-ai-receptionist-alternative
- https://aiscalelabs.com/beside-ai-receptionist/
- https://www.fortune.com/2025/11/11/beside-ai-voice-startup-raises-32-million-ai-receptionist-for-small-business/
- https://www.growthspreeofficial.com/blogs/b2b-saas-annual-contract-length-multi-year-discount-benchmarks-2026-impact-on-retention-payback
- https://medium.com/@lesiapolivod/saas-discount-strategy-2026-when-discounts-work-and-when-they-dont-e33dac0014fb
- https://www.doolly.com/blog/usage-based-ai-saas-pricing-bankrupting-smbs-in-2026
- https://fungies.io/usage-based-pricing-saas-2026/
- https://www.valueships.com/post/ai-pricing-in-2026
- https://research.stripo.email/saas-pricing-trends-2026
- https://www.getmonetizely.com/articles/why-outcome-based-ai-pricing-models-are-gaining-traction-and-their-hidden-pitfalls
- https://www.zuora.com/guides/ai-pricing-models-comparison/
- https://www.zendesk.com/blog/ai/agentic-ai/outcome-based-pricing/
- https://www.revinci.ai/blogs/ai-agent-pricing-models-compared/
- https://saasdash.ai/blog/saas-packaging-design-good-better-best
- https://dealhub.io/glossary/decoy-pricing/
- https://www.getmonetizely.com/blogs/killing-me-softly-bad-practices-with-good-better-best-pricing
- https://www.shno.co/marketing-statistics/free-trial-conversion-statistics
- https://chartmogul.com/reports/saas-conversion-report/
- https://userpilot.com/blog/saas-average-conversion-rate/
- https://pricepertoken.com/pricing-page/model/openai-gpt-4o-mini
- https://devtk.ai/en/models/gpt-4o-mini/
- https://www.layer3labs.io/guides/openai-realtime-api-pricing
- https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions
- https://explainx.ai/blog/openai-gpt-realtime-2-1-mini-reasoning-tool-use-api-2026
- https://www.twilio.com/en-us/sms/pricing/us
- https://automationatlas.io/answers/twilio-pricing-explained-2026/
- https://www.telphiconsulting.com/blog/twilio-cost-2026
- https://tradingeconomics.com/canada/currency

**Internal files read:** `research/market/2026-09-09-business-model-case.md`,
`research/market/2026-09-07-lead-rescue-gap-and-strategy.md`,
`research/market/2026-09-08-pricing-validation-home-services-icp.md`,
`research/market/2026-09-08-pentest-vendor-options.md` (house style),
`src/lib/stripe.ts`, `src/lib/billing.ts`, `src/app/api/billing/{checkout,status,webhook}/route.ts`,
`src/app/page.tsx`, `src/components/Sidebar.tsx`, `prisma/schema.prisma`.
