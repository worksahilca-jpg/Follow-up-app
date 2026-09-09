# FollowUp — the business model case

**Date:** 2026-09-09. **Purpose:** a single, rigorous, honestly-sourced document to lock direction
against. This is a synthesis of everything already researched this session (`docs/PRD.md`,
`docs/TRD.md`, `docs/BACKEND_SCHEMA.md`, every file in `research/market/`, `research/customers/`,
`research/integrations/`, `PRODUCT_DIRECTION.md`) plus new WebSearch research run specifically for
this document (marked inline) for pricing benchmarks, unit-cost rates, churn/CAC/LTV benchmarks,
and TAM inputs that weren't already on file. Nothing below re-derives a number that's already been
verified this session — it cites the existing file and, where useful, adds one more layer of
analysis on top.

**Sourcing convention, carried from every other file in this corpus:** **A** = primary source or
large sample; **B** = credible secondary citing a named primary; **C** = vendor-published,
aggregator, or single-source — plausible but self-interested or unverified; **estimated** = this
document's own reasoned calculation from graded inputs, not a number anyone published directly;
**no source found** = stated as a gap, not papered over with a guess presented as fact. WebFetch is
blocked in this sandbox (consistent with every prior pass) — every new web-sourced figure below is
a WebSearch result-snippet, not a fetched/read page, and is graded accordingly.

---

## 1. Problem

**The exact problem, in the CEO's own words (canonical, `PRODUCT_DIRECTION.md`):** "The problem: business
owners are not able to follow up. That is the main thing. FollowUp exists because the owner can't,
won't, or forgets to do the following up." Every CRM on the market solves lead *generation* and lead
*sorting*; none of them solve the failure mode that actually loses the money — a lead that already
made contact (emailed, DMed, called, filled out a form) and then got no reply, or one reply and
silence after that (`docs/PRD.md` §1).

**Who has it:** small-to-mid business owners who get more inbound contact — phone, email, SMS, social
DM — than they or their small team can personally answer, and who have no dedicated follow-up
person (`docs/PRD.md` §3). This is not a single vertical; it recurs across every persona this
session's research touched: home-services contractors, realtors, med-spas/salons/small law-firm
intake, and small sales teams generally
(`research/customers/2026-09-05-icp-pain-and-trust-objections.md`).

**How often, and what it costs — measured, not assumed:**

| Finding | Figure | Grade | Source |
|---|---|---|---|
| B2B teams that never responded to a test inbound lead (1,000 companies) | 63.5% | B | `research/market/2026-09-07-why-followup-evidence-for-and-against.md` |
| Average B2B lead response time | 29–47 hours | B | same |
| Companies responding within 5 minutes | 23% | B | same |
| Close rate, contacted <5 min vs. >24h | 32% vs. 12% (2.6×) | B | same |
| Calls to small businesses that go unanswered (411 Locals, 85 businesses, 58 industries) | 62% (37.8% voicemail + 24.3% no response) | **B, but see caution below** | `research/market/2026-09-08-62pct-missed-calls-stat-verification.md` |
| Home services: 391% conversion lift from calling a web lead within 1 minute | 391% | C (vendor chain) | `research/customers/2026-09-05-icp-pain-and-trust-objections.md` |
| Home-services missed-call rate (ServiceTitan-attributed, 50,000+ lines) | 62% (industry-worst) | C | same |
| Estimated annual revenue lost to missed calls per small business | ~$126,000 | **C — do not quote as precise** | `research/market/2026-09-08-missed-calls-126k-stat-verification.md` |

**Two corrections this session's own fact-checking already made, carried forward honestly rather
than re-asserting the cleaner-sounding original numbers:** (1) the 62%-missed-call stat is a real,
findable primary source (411 Locals), but it's a single, methodology-undisclosed **2016** study of
85 businesses routinely mis-dated as 2023/2024 across the industry — the arithmetic checks out, the
recency and generalizability don't; treat it as "small businesses miss a large share of calls,
direction confirmed, exact percentage decade-old and thin." (2) the $126,000/year figure traces to
"Invoca and BIA/Kelsey" in every secondary source found, but no source located actually names, dates,
or links the underlying report — real order of magnitude (small businesses can plausibly lose
"over $100K/year" in aggregate to missed calls), not a number to cite to the dollar.

**Why current solutions fail — the gap, not just the pain:** every competitor found across three
full competitive passes (real estate, home services, and horizontal AI-receptionist categories —
see §4) automates *the lead*: answer it, text it, log it. None found has a shipped feature that
detects a lead who **was answered once and then went quiet**, scores it by neglect × intent ×
recoverability, and acts (`research/market/2026-09-07-lead-rescue-gap-and-strategy.md`). Follow Up
Boss reassigns a neglected lead only after the business configures a recipe; HighLevel escalates
only inside a workflow the business builds; Lofty tells you when asked; Sierra does it, but only
inside its own real-estate-only bundle. Nobody combines human neglect, lead intent, and
recoverability into one automatic number with an automatic rescue behind it. That is the specific,
verified gap FollowUp is built to fill — not "better AI," a claim every competitor also makes.

---

## 2. Target Customer

**#1 ideal customer (`docs/PRD.md` §3):** a small-to-mid business owner — home services, local
services, or a small sales team — who already has more inbound contact than they can personally
answer across at least two or three channels at once (email, SMS, social DM, phone), and has no
dedicated follow-up person. Explicitly **not** an enterprise sales org buying outbound-prospecting
seats (that's the AI SDR category — 11x, Artisan, Regie.ai — different buyer, motion, and price
tier; confirmed non-threat, not pursued, `research/market/2026-09-08-broader-competitive-landscape.md`).

**Sharpened by customer research, not just asserted:** home-services contractors (plumbers, HVAC,
electricians, remodelers) carry the single strongest, most concrete quantified pain signal found in
this entire corpus and deserve to be read as a peer-priority persona alongside the realtor already
on the landing page, not a lesser example
(`research/customers/2026-09-05-icp-pain-and-trust-objections.md` Finding 1). Med-spas, salons, and
small law-firm intake are a second concrete multi-channel cluster (Instagram DM + phone + web chat +
walk-in simultaneously) where industry CRM vendors are already selling FollowUp's exact thesis as
their pitch — evidence the underlying pain generalizes past home services, not proof FollowUp should
narrow to it (Rule 1 in `PRODUCT_DIRECTION.md` explicitly declined a single vertical).

**Market size estimate:** see §9 for the full TAM/SAM/SOM math with sources. Headline: an estimated
**~500,000–700,000 US home-services-and-adjacent local-service businesses** form the realistic
serviceable core, inside a much larger ~6.4 million US employer small-business population overall
(estimated, math shown in §9 — this range is this document's own derived estimate, not a single
published figure).

**Average revenue/deal value:** not independently measured this session for FollowUp's ICP
specifically. Proxy evidence: home-services jobs are typically several hundred to several thousand
dollars per job (implied by the 391%-conversion-lift framing and industry pricing context, not a
directly cited per-job average); real estate transactions average tens of thousands in commission.
**Honest gap:** no source found giving a direct average-deal-value figure for FollowUp's blended ICP
— this is a concrete item for the first real customer interviews (§11), not something to estimate
further here.

**Lead volume:** not measured directly for FollowUp's actual customer base (no paying customers yet
— see §11). For modeling purposes in §8, this document assumes 100–150 new leads/month for a
"realistic average usage" customer — a mid-point between a very small solo operator (perhaps 20–40
leads/month) and a busier 3–5 person shop or agency (300+ leads/month) — **stated explicitly as a
modeling assumption, not a measured average.**

**Buying decision-maker:** the owner-operator themself, in almost every case found in this research
— a solo plumber/electrician, a solo-to-small-team realtor, a 3–5 person agency principal. This is
not a committee sale or a procurement-gated purchase; it is a single person deciding whether a
$29/mo charge is worth it, which is why the flat, no-seats, no-contract pricing shape (§7) fits the
buyer's own stated resentment of "enterprise-shaped pricing for a single-focus need"
(`research/customers/2026-09-05-icp-pain-and-trust-objections.md` Finding 4).

---

## 3. Current Solution

**How the target customer handles follow-up today, per the evidence gathered this session:**

- **Nothing, most of the time.** The baseline "current solution" for a majority of this segment is
  no solution at all — 50% of businesses with fewer than 10 employees use no CRM whatsoever
  (`research/market/2026-09-07-why-followup-evidence-for-and-against.md` §2, graded B), and the
  411-Locals-sourced 62% missed-call figure describes exactly what happens absent any system: the
  call rings out, the caller hangs up, nobody follows up. For this half of the segment, "current
  solution" is a phone that sometimes gets answered and an inbox nobody triages.
- **A generalist CRM they don't fully use.** The other half mostly own something (a CRM 71–74% of
  small businesses report using, per Freshworks/Capterra 2025, graded B) but it's built for lead
  *generation and sorting*, not the specific job of noticing a contacted lead went quiet — the gap
  named in §1.
- **A human doing the job manually, at real cost.** Where a business has scaled past "the owner
  personally," the alternative is a person: a real-estate inside sales agent (~$5,800/mo fully
  loaded), a virtual assistant (~$1,300–3,200/mo), or a category of point-tools that bundle a
  narrower version of this job into a bigger, pricier suite — see §4 and the table in
  `research/market/2026-09-07-why-followup-evidence-for-and-against.md` §3.

**What they dislike about it, in their own words / independently-sourced complaints:**

- **Price shape, not just price level.** Follow Up Boss reviewers call $69/user/mo for a solo agent
  closing four deals a year "a hard sell"; Podium's Trustpilot score (1.5/5) is driven almost
  entirely by billing disputes and contract-cancellation friction (one cited case: charged for a
  full extra billing period after cancelling 31 days before renewal); HubSpot's own reviewers flag
  pricing that "quietly jumps from affordable to expensive" as a team scales
  (`research/customers/2026-09-05-icp-pain-and-trust-objections.md` Finding 2). The pattern across
  every quoted complaint is **resentment of seats, tiers, contracts, and add-on fees for a
  single-focus need**, not "software is too expensive in the abstract."
- **Manual approaches don't survive volume.** "The manual approach works until volume makes it
  unmanageable — and by the time most agents realise that, they've already lost more deals than they
  can count" (paraphrased BiggerPockets thread, flagged in the original research as possibly
  vendor-influenced but directionally consistent with independently-sourced Realtor.com language
  making the identical point — `research/customers/2026-09-05-icp-pain-and-trust-objections.md`
  Finding 2).
- **Bloat.** A small-CRM vendor's own positioning captures the sentiment precisely even though it's
  marketing copy, not a raw quote: "tired of bloated, overpriced software... a CRM should be a
  simple tool that empowers you, not a complex system that requires a full-time administrator to
  manage" (same source, Finding 2).

**What they pay now:** see the willingness-to-pay table in §7 — the honest range for a *comparable*
capability (AI-handled missed calls, not FollowUp's full scope) runs **$97–600/mo** across CallRail
+Voice Assist, Smith.ai, GoHighLevel, Signpost/Emitrr, Podium/Birdeye
(`research/market/2026-09-08-pricing-validation-home-services-icp.md`), with the human/suite
alternative running $1,300–5,800/mo. Only one genuinely comparable budget competitor was found at
FollowUp's exact price point (QuoteIQ Essentials, $29.99/mo — see §4).

**Why they'd switch:** three converging reasons, each independently evidenced. (1) **Price shape**
— flat, no seats, no contract undercuts every named competitor except one, by 3–20×, while the
segment is specifically shape-resentful of the alternative (§3, above). (2) **The specific gap** —
nobody else watches the human, not the lead, by default (§1, §4). (3) **Trust design matching a
real, measured preference** — 77% of consumers want human approval before an agent acts, with only
1 in 10 comfortable with full independence even for lower-stakes decisions (Blackbox Research's "The
Delegation Contract," 1,050-respondent survey — graded B,
`research/customers/2026-09-05-icp-pain-and-trust-objections.md` Finding 3) — which is exactly what
FollowUp's approval-first-by-default, per-lead Assisted/Autonomous design already offers and most
competitors don't design around explicitly.

---

## 4. Competitors

Every major competitor named across this session's three full competitive passes
(`research/market/2026-09-05-competitor-feature-gaps.md`, `2026-09-06-realtor-tool-landscape.md`,
`2026-09-08-realtor-competitor-refresh.md`, `2026-09-08-broader-competitive-landscape.md`), plus the
one genuine budget price-peer found in the pricing-validation pass. All pricing/feature claims below
are graded C unless noted (WebFetch blocked throughout the corpus; everything is a WebSearch-snippet
cross-check, per each source doc's own caveat).

| Competitor | Price | Target customer | Key features | Strengths | Weaknesses | The gap FollowUp fills |
|---|---|---|---|---|---|---|
| **Follow Up Boss** | Grow $69/user/mo, Pro $499/mo (10 users), Platform $1,000/mo (30+ users) | Real-estate teams/brokerages | CRM, "Ponds" shared lead pool, Action Plans, deal/commission tracking; 25M+ leads/yr, Zillow-owned | Category Schelling point — 41 of top 50 US teams, Zillow-scale distribution, strong organic praise (12%→31% conversion anecdote) | Seat-based (expensive per person), reassigns a neglected lead only after a recipe is manually configured — reroutes to another human, doesn't act itself | Automatic (not configured) neglect detection + rescue score; flat pricing regardless of team size; horizontal, not real-estate-locked |
| **HighLevel (GoHighLevel)** | ~$97/mo Starter tier | Agencies and small businesses wanting an all-in-one marketing+CRM platform | CRM+funnels+website, "AI Employee" add-on, "User Replied" trigger with SLA timeouts | All-in-one, white-labelable for agencies, broad feature surface | Requires the business to *build* the escalation workflow themselves — no out-of-the-box neglect detection; complex/overwhelming for a solo operator not running an agency | Works out of the box, no workflow-building; single-purpose product, not a generalist marketing suite the ICP has to learn |
| **Lofty** (formerly Chime) | $449–1,500/mo + $299 setup | Real-estate agents/teams/brokerages | IDX website + CRM + paid lead-gen + bundled "AI follow-up tooling"; AI Assistant answers "which leads haven't been contacted" on request | All-in-one bundle, 70K+ professionals claimed (vendor-stated) | **Pull, not push** — the owner has to ask; real-estate-only; 15–50× FollowUp's price | Proactive push (dashboard opens on "About to be lost") instead of query-on-request; flat $29 vs. $449+ |
| **Sierra Interactive** | $299–599/mo + Lead Engage AI $199/mo | Real-estate teams | Lead Engage works new/dormant leads via 2-way text up to 12 months; reports response/conversion by agent/source | Closest existing real-estate analog to "watching the human"; real CRM+website bundle | Real-estate-only; no combined neglect × intent × recoverability score; no recovered-revenue report; 10–25× FollowUp's price | Horizontal applicability; the actual scored rescue mechanism; revenue-attributed reporting; price |
| **ServiceTitan** | $245–500/technician/mo + $5K–50K+ implementation, 12-month contract | Multi-technician field-service companies (HVAC/plumbing/electrical dispatch) | Full field-service-management suite: scheduling, dispatch, invoicing; some missed-call/text-back bundled | Category leader for larger crews; deep vertical operational feature set | Enterprise pricing/contract; overkill for a solo operator; follow-up/lead-rescue is not its center of gravity — it's operations software | 10–50× cheaper; laser-focused on the lead-conversion job a solo operator lacks staff for; no contract or implementation fee |
| **Housecall Pro** | Basic $59–79/user/mo, Essentials $149–189/mo (text-back gated here), MAX $299–329/mo | Solo-to-small field-service crews | FSM (scheduling, invoicing, dispatch) + missed-call text-back at Essentials tier and above | Accessible entry price relative to ServiceTitan; popular with solo operators | Text-back is gated behind a tier 2–3× FollowUp's whole price; no cross-channel neglect/rescue scoring; no AI drafting/approval workflow | Rescue mechanism at $29 flat vs. paying more just to unlock text-back |
| **Podium** | Core $399/mo, Pro $599/mo, Enterprise $999+/mo + $99/mo AI-receptionist add-on; annual contract; real cost $450–800/mo | Local businesses wanting a messaging + reviews suite | Missed-call text-back, "AI Employee" conversational answering, review-request automation, omnichannel inbox | Broad feature set (reputation management + messaging), 24/7 AI conversation | 15–20× FollowUp's price; 1.5/5 Trustpilot driven by billing/contract disputes; reactive-only (answers now), no evidence of reviving a lead that went quiet days later | Dramatically cheaper, no contract; does the specific "already answered once, now silent" job Podium's public feature set shows no evidence of |
| **CallRail** | Base $50–195/mo + Voice Assist add-on $95/mo (first 50 calls, then $1/call) | Marketers/businesses wanting call tracking + AI answering | Call tracking/attribution; Voice Assist AI receptionist for missed/overflow calls | Strong niche in call-attribution/analytics | $145–195/mo realistic minimum for AI-handled missed calls; call-capped with per-call overage; no CRM/follow-up sequencing; no cold-lead rescue | Bundles capture+scoring+drafting+rescue for under half CallRail+Voice Assist's price, no call cap |
| **Beside** | Not disclosed in research found | Small businesses wanting a horizontal AI receptionist | Answers missed calls, two-way texts callers who don't get through, books appointments, transfers calls by rule, flags spam, call summaries | **The single most important competitive risk found this session**: $32M raised (EQT/Index Ventures, Slack founder Stewart Butterfield as an angel), $4M ARR / 20,000+ customers claimed (vendor-stated, C), horizontal not vertical-locked | Everything found describes it as **reactive and in-the-moment** — answer/text/book *now*; no feature found for proactive re-engagement of a lead that went quiet days after first contact, no cross-channel neglect score | The entire core loop (score, draft, rescue, recovered-revenue report) is the exact gap Beside's public feature set shows no evidence of — the moat to defend fastest, since Beside is well-funded and could build it |
| **Bravi** (YC F25) | Not disclosed (no Series A found) | Home-services installers/manufacturers (fenestration: shutters, windows, garage doors), Europe + US | AI voice+chat assistants replacing "the front office"; explicit "never miss a lead" positioning | Closest single-sentence match to FollowUp's own mission statement found anywhere; home-services-specific | Narrow vertical (fenestration); small, early-stage (YC batch only); European-founded | Horizontal, not fenestration-locked; more mature product (scoring + rescue + audit trail already shipped) vs. a YC-stage competitor |
| **Leaping AI** | Not disclosed ($4.7M seed) | Enterprise/BPO call-center replacement (retail, telecom, travel) at 10,000+ calls/day | Voice agents for scheduling, billing, lead qualification/re-engagement at volume | Real voice-AI scale | Wrong buyer entirely — mid-market/enterprise call-center replacement, not a $29/mo self-serve SMB tool | Not really a direct competitor — confirmed non-threat, different buyer/motion/price tier |
| **Verse.ai** | Sales-gated, annual contract + setup fee (no flat/self-serve price) | Real estate/mortgage teams primarily; markets to "business owners" generally | Conversational AI across SMS/email/voicemail/webchat/voice; follows up for up to 6 months; <15s response | 12+ years operating — the closest existing horizontal analog to "AI that follows up on a cold lead for months," proof this space is real | Sales-gated, annual contract, setup fee — not self-serve or flat; hasn't broken out to household-name scale in over a decade despite doing something similar | Self-serve, flat, transparent pricing, no contract; the specific neglect-score + audit-trail + recovered-revenue mechanism |
| **Numa** | Not researched in depth (vertical-locked) | Automotive dealerships specifically | SMS-first missed-call follow-up | Narrow but effective in its one vertical | Single-vertical (automotive), not applicable to FollowUp's ICP | Not a direct competitor — noted for completeness only |
| **Goodcall** | Not disclosed | General small businesses | AI phone agent: FAQs, appointment booking, basic lead capture via CRM integrations | Broad applicability, phone-first, closer to Beside's shape | Smaller/less funded than Beside; no evidence of cross-channel dormant-lead revival or a neglect score | Same core gap as Beside, smaller-scale threat |
| **QuoteIQ Essentials** | $29.99/mo (or $299.99/yr ≈ $25/mo effective) | Solo contractor | Full solo-contractor CRM (estimates, invoicing, scheduling, Stripe payments/BNPL) + "AI Autopilot"/"Virtual Call Team" handling missed calls | **The one genuinely comparable budget competitor** — same price point, same solo-contractor ICP, an AI-missed-call pitch bundled into a broader CRM | CRM-first with AI-calling as a bundled feature — the inverse of FollowUp's shape; no evidence of a cross-channel neglect score, rescue mechanism, or audit trail | FollowUp's inverse positioning (deep on the follow-up job, not a broad CRM with AI calling bolted on) plus the specific rescue mechanism |

**Read across the whole table:** every traditional/vertical incumbent is priced 3–50× FollowUp's
flat rate; every well-funded horizontal AI-receptionist competitor (Beside, Bravi, Goodcall) is
reactive-only with no evidence of the proactive rescue mechanism; the AI SDR category (11x, Artisan,
Regie.ai — $60–100K/yr) is confirmed a different market entirely and not re-litigated here. **The
biggest competitive risk is Beside, not a vertical AI-native player** — well-funded, horizontal, same
buyer shape, and "one product decision away" from building the rescue mechanism FollowUp already has
(`docs/PRD.md` §5). The window to be first to market that combination as a category concept is
closing, not open-ended (`research/market/2026-09-08-product-direction-synthesis.md`).

---

## 5. Our Solution

**What FollowUp actually does, per what's shipped in production (`docs/PRD.md` §6, not aspirational
copy):** FollowUp captures every inbound lead across 13 channels (Gmail, Outlook, Twilio SMS/voice,
live AI voice agent, WhatsApp, Instagram DM, Facebook Messenger, Facebook Lead Ads, website widget,
generic webhook, CSV, manual entry, CRM sync), classifies whether it's actually a lead, scores its
urgency with a visible, human-readable reason, drafts a follow-up in the lead's own language that is
instructed to never invent a fact, and routes the draft through a per-lead automation tier
(OFF/Assisted/Autonomous) that decides whether a human approves it or it sends on its own — subject
to a risk gate that blocks anything mentioning pricing, terms, deadlines, or an invented detail.
Distinctly, and this is the differentiator (§4): a lead who was answered once and then went quiet
triggers a **human-neglect rescue** — drafted, sent if low-risk or held for approval — and every open
lead is ranked by a **rescue score** (neglect × intent × recoverability) that the dashboard opens on.
A **recovered-revenue report** ("What FollowUp saved you this week") counts only replies to messages
FollowUp itself sent, unprompted — the mechanism behind both the trust story and the pricing thesis.

**The one core value proposition:** *"You paid for the lead. We make sure it doesn't die because
nobody followed up — including the one that already got a reply and then went silent."*
(`research/market/2026-09-07-lead-rescue-gap-and-strategy.md`)

**What makes it different (the moat, Rule 6 applied — `docs/PRD.md` §5):** not "AI," not
"automated follow-up," not CRM integrations — those are table stakes any funded competitor can
build in six months (`research/market/2026-09-07-lead-rescue-gap-and-strategy.md`'s "not moats"
list). The actual moat is three compounding things: (a) **neglect detection** — watching the human's
inaction, not just the lead's inactivity, by default and without the business building a workflow;
(b) **permission + audit trail** — consent, source, channel, stop, and unsubscribe as first-class,
user-visible data (Rule 3), which is measurably harder for a fast-shipping competitor to bolt on
credibly than to finish now (`research/market/2026-09-08-product-direction-synthesis.md` rec #2); and
(c), long-term and compounding rather than an MVP feature, **outcome intelligence** — which messages
get replies, which signals actually predict intent, tuned on FollowUp's own data because Rule 2 (own
the data) means years of scoring reasoning, drafts, and outcomes live in FollowUp's own DB, not
recomputed live from a third party.

**Minimum product needed:** already built, per the moat-ranking above — multi-channel capture,
visible-reason scoring, approval-first drafting with per-lead autonomy, the human-neglect trigger,
the rescue score, and the recovered-revenue report are all shipped (`docs/PRD.md` §6.2). What is
**not** the minimum, and would be scope creep against Rule 1: a full CRM (pipeline/sequences/Smart
Views/Ponds exist as workflow conveniences, §6, but are explicitly table-stakes, not the core bet);
lead generation of any kind (explicitly out of scope, `docs/PRD.md` §7); a vertical-specific feature
set (Rule 1, resolved — horizontal by decision).

---

## 6. Product/MVP

### Already built (per `docs/PRD.md` §6, verified against the codebase this session, not aspirational)

**Capture** — 13 inbound channels become a real `Lead` row, every one running through AI prospect
classification first (rejecting non-leads to `FilteredEmail` with a one-click override, never
silent discard): Gmail (push + 10-min poll + daily deep pass), Outlook, Twilio SMS, Twilio voice
(voicemail transcription + opt-in live AI voice agent), WhatsApp (via Twilio), Instagram DM,
Facebook Messenger, Facebook Lead Ads, website widget, generic webhook (Zapier/Make), CSV import,
manual entry, and inbound CRM sync (Follow Up Boss, HubSpot).

**Core loop** — AI scoring (0–100, visible reason, per-factor weights); AI drafting (never invents a
fact, replies in the lead's language, tested); approval-first by default; instant fixed-template
acknowledgement within the minute on the channel used; human-neglect rescue trigger (default 24h);
rescue score (neglect × intent × recoverability); recovered-revenue report + weekly digest.

**Workflow tools** — Pipeline (kanban), Sequences (multi-step cadences, stop-on-reply guaranteed and
tested), Smart Views (saved filters), Ponds (shared claimable lead pool), per-source routing, team
roles (Admin/Sales), a public self-serve booking link per lead.

**Trust & autonomy** — per-lead automation tier (OFF/Assisted/Autonomous); risk gate before any
autonomous send; sequences stop the instant a lead replies (tested); a per-lead Consent & AI audit
trail panel (consent basis, opt-out status, chronological log of every automated decision); TCPA/A2P
compliance notices in Twilio setup; STOP/START honored on every send path (see §12 for detail).

**Security & billing** — Google OAuth sign-in; per-business tenant isolation; credential encryption
at rest; rate limiting on shared-cost actions; Zod validation on every API body; error monitoring
with PII scrubbing; per-business data export and full deletion; a de-identification pipeline gating
any future model-training use (opt-in, off by default); Stripe billing at a single flat plan,
currently $29/mo (`docs/PRD.md` §6.6, and see §7 below).

**158 automated tests** (as of `docs/PRD.md`) pin the trust guarantees and core logic and run on
every pull request.

### Genuinely still needed (named plainly, not assumed solved — `docs/PRD.md` §7–9, §11)

- **Non-English end-to-end verification.** Drafting, acknowledgement, transcription, and the voice
  agent all carry a language-matching instruction and unit-test coverage of that instruction, but
  **no real non-English lead has been run through the live product end to end.** This is a verified
  testing gap, not a code gap — flagged as urgent given Bravi already operates multilingually across
  Europe/US and Structurely ships bilingual EN/ES nurture (task #63).
- **Channel unblocking** (external, not a build): Google OAuth verification (6–12 weeks, CASA Tier 2
  security assessment required for `gmail.readonly`), Twilio A2P 10DLC registration (per-business,
  2–6 weeks), Meta App Review for Instagram/Messenger/Lead Ads (4–8+ weeks, app-wide, one-time) —
  see full detail and timelines in `research/integrations/2026-09-08-channel-unblocking-requirements.md`
  and §12 below. WhatsApp template approval is the one fast, automated exception (15–30 min).
- **CRM sync pagination bug** — Follow Up Boss/HubSpot sync doesn't persist its cursor, permanently
  stalling a backfill past ~500 contacts (`docs/TRD.md` §8, open).
- **OAuth CSRF `state` validation** missing on the Gmail and Outlook callback flows specifically
  (Instagram/Facebook already do this correctly) — open finding, medium severity.
- **Per-state voice-recording-consent nuance** — one spoken disclosure everywhere today, not
  tailored to two-party-consent states; no live human handoff mid-call.
- **The autonomous-by-default step** (Phase D's remainder) — architecture is ready (per-lead tier is
  already a column, not a global flag), but is explicitly a product decision to make "after real
  customers have watched Assisted work," not a build.
- **The pricing experiment** ($49–79/mo cohort test) — recommended by research, **explicitly
  deferred by the CEO** ("hold off on pricing"). See §7.

---

## 7. Revenue Model

### What comparable products charge, and how (researched this session via WebSearch)

**SaaS pricing-model landscape, 2026:** hybrid pricing (a base subscription plus usage billing) is
now the most common shape at 37% adoption; pure usage-based pricing has grown from 27% to 38% of
SaaS companies since 2023; pure per-seat pricing is shrinking (21%→15% of SaaS in twelve months) even
though 67% of SaaS companies still use *some* tiered structure with a seat component. IDC forecasts
70% of vendors will refactor away from pure per-seat pricing by 2028. Usage-based pricing correlates
with materially better retention (usage-based net-dollar-retention runs roughly 20 points above
seat-based in the cited comparison) and ~8-point-faster revenue growth on average. *(Grade C —
vendor/consultancy blog aggregation, e.g. Moesif, Fungies, NxCode, Bridges, Rethink Lab, via
WebSearch 2026-09-09; consistent across multiple independent sources on direction, not to the
decimal point.)*

**AI-receptionist-specific benchmark, closest comparable category to FollowUp:** most small
businesses in 2026 pay **$25–$160/mo** for an AI receptionist, with the observed sweet spot for
full-featured coverage (24/7, appointment booking, CRM integration) at **$199–$299/mo**; budget-tier
AI-only options start at **$25–$65/mo**; call-volume-tiered plans commonly run **$24.95/mo for ~30
calls** up to **$159.95/mo for ~300 calls**. *(Grade C — Aira, Plura, NextPhone, AgentZap,
Voksha pricing-guide content, via WebSearch 2026-09-09, several independently converging on the same
$25–65 budget-tier floor.)*

**Read against FollowUp's own $29/mo:** FollowUp sits at the very bottom of even the *budget* AI-
receptionist tier, while offering materially more than a call-answering tool (multi-channel capture,
scoring, drafting, rescue, an audit trail) — consistent with, and reinforcing, this session's own
prior pricing-validation finding.

### FollowUp's actual current pricing — verified in code, not assumed

**$29/mo flat, single plan, no seats, no tiers, no trial.** Confirmed directly in
`src/lib/billing.ts` (`BILLING_LOCKED_MESSAGE`: *"Subscribe to unlock this — see Billing in Settings
($29/mo)."*) and `prisma/schema.prisma`'s billing comment block ("single flat plan, no trial: a
business has full access only while its mirrored Stripe subscription status is `active`... anything
else falls back to read-only"). Billed via Stripe checkout/portal/webhook
(`docs/PRD.md` §6.6).

### Is $29/mo validated by the existing research, or does it need adjustment?

**Two things are true at once, and neither cancels the other** (synthesizing
`research/market/2026-09-08-pricing-validation-home-services-icp.md`):

1. **Against the broader comparison set, $29/mo reads as clearly underpriced for the value
   delivered.** Every tool offering something recognizably similar to "AI catches the missed call
   and texts back" — CallRail+Voice Assist ($145–195/mo), Smith.ai (~$97.50/mo, call-capped),
   GoHighLevel (~$97/mo), Podium/Birdeye (~$300–600/mo) — charges **3–20×** FollowUp's price for
   narrower or weaker versions of the same promise. Given the 391%-conversion-lift figure (§1), a
   contractor who converts even one extra job a month from a faster callback likely clears $29 many
   times over — the classic signal of underpricing relative to value, not merely "cheap."
2. **Against the one true price-peer, $29/mo is not an outlier at all.** QuoteIQ Essentials
   ($29.99/mo, same solo-contractor ICP, an AI-missed-call feature bundled into a lightweight CRM) is
   a real, currently-shipping competitor at essentially the same price — proof $29/mo isn't "too
   cheap to be credible," just that there's real headroom above it.
3. **No evidence exists, in either direction, of FollowUp's own willingness-to-pay ceiling.** This is
   an honest gap, not a finding to paper over — no customer interview or pricing-page test has been
   run (see §11). The recovered-revenue report is the proof mechanism that would let an owner see the
   dollar return before being asked to pay more for it, and running one real pricing-page test
   (existing users at $29; a cohort at $49–79 justified by their own "leads saved" number) would turn
   two open questions (pricing, willingness-to-pay) into one experiment with a real answer.

**Recommendation, stated as evidence not a decision (the CEO has explicitly deferred this — "hold
off on pricing," `docs/PRD.md` §9):** the research supports there being real room above $29/mo, but
raising price is a Rule 6 judgment call (is it moat-building or extraction) that shouldn't be made
without the recovered-revenue-report-driven test the research recommends. **This document's own
recommendation for §8 and §9 below is to model at the current, real $29/mo price** — using an
unvalidated higher number would understate the honesty this document is supposed to have.

---

## 8. Unit Economics

### The headline structural fact, verified from the codebase and integrations research, not assumed

**FollowUp's own cost of goods sold does *not* include Twilio SMS/voice/WhatsApp usage or Gmail/
Outlook email sending.** FollowUp is architected as multi-tenant with **each customer business
bringing its own Twilio account** (Account SID + Auth Token, pasted into `TwilioConfig.tsx`) and its
own Gmail/Outlook OAuth connection — confirmed explicitly across two integrations research passes:
*"FollowUp is multi-tenant (each business owns its own Twilio number, not FollowUp acting as a
shared/reseller sender)... each connected business needs its own Brand + Campaign"*
(`research/integrations/2026-09-06-twilio-sms-compliance.md`), and the WhatsApp integration
recommendation explicitly reuses *"the same self-sign-up / BYO-credentials pattern `TwilioConfig.tsx`
already uses for SMS — not FollowUp's own Meta Tech Provider... Each business pastes an Account SID,
Auth Token"* (`research/integrations/2026-09-06-whatsapp-business-production-readiness.md`). This
means **the per-message/per-minute telephony cost is borne by the customer's own Twilio bill, not
FollowUp's** — a real, structural gross-margin advantage over a competitor like CallRail or Podium
that resells telephony bundled into its own price. The trade-off, already documented, is customer-
side onboarding friction (A2P 10DLC registration, Meta Business Verification) — a real cost, just not
a *FollowUp* cash cost (see §12).

What **is** FollowUp's own cost: the shared OpenAI API key (`OPENAI_API_KEY`, one for the whole
platform, `src/lib/integrations/openai.ts`), the separate voice-agent bridge's own OpenAI Realtime
API usage (opt-in, off by default), and Vercel + Supabase hosting.

### OpenAI cost per lead — estimated from the actual prompts in `src/lib/integrations/openai.ts`

Base rate (verified, `research/integrations/2026-09-06-openai-pricing-data-retention.md`, graded B):
`gpt-4o-mini` — **$0.15/1M input tokens, $0.60/1M output tokens**. Token counts below are this
document's own estimate from reading the actual system/user prompt text in `openai.ts` (word counts
converted at ~1.33 tokens/word plus the conversation transcript each call includes) — labeled
**estimated**, not a measured production average, since FollowUp has no real customer volume yet.

| Call | When it runs | Est. input tokens | Est. output tokens | Est. cost/call |
|---|---|---|---|---|
| `classifyAsProspect` | Per new email thread (Gmail/Outlook only) | ~1,500 (long system prompt + 3 de-quoted messages) | ~50 | ~$0.00026 |
| `scoreLead` | Each time a lead's score is (re)computed | ~420 (system + transcript) | ~120 | ~$0.00014 |
| `generateFollowUpMessage` | Each draft generated | ~660 (system + transcript) | ~150 | ~$0.00019 |
| `assessSendRisk` | Immediately before an unattended send | ~520 (system + transcript + draft) | ~40 | ~$0.0001 |
| `localizeFixedText` | Once per new lead (instant ack translation) | ~300 | ~50 | ~$0.00008 |
| `transcribeAudio` (voicemail) | Per missed call reaching voicemail | n/a (audio) | n/a | ~$0.003/min (separate model, `gpt-4o-mini-transcribe`, ~$0.003/min per WebSearch 2026-09-09, grade C) |

**Blended estimate per lead**, assuming a mix of channels and an average of ~2 scoring calls, ~1.5
drafts, and ~1 risk assessment across a lead's lifecycle: **roughly $0.001–0.002 per lead** — this
matches, and is consistent with, the existing integrations research's own conclusion that AI cost
"stays well under $1-2k/month even at thousands of leads/day"
(`research/integrations/2026-09-06-openai-pricing-data-retention.md`). At this document's modeling
assumption of 100–150 leads/month per customer (§2), that's **roughly $0.10–$0.30/month in AI text
cost per customer** — a rounding error against $29/mo revenue.

### The optional voice-agent cost (opt-in, off by default — not baked into the baseline above)

OpenAI's Realtime API (used by the separate `voice-agent/` bridge for live AI phone calls) is billed
per audio token: as of July 2026 rates, a typical agent call runs **~$0.06–0.11/min on the full
`gpt-realtime-2.1` model** or **~$0.02–0.05/min on the mini model** with prompt caching. *(Grade C —
HackerNoon "4,000 measured sessions" analysis and Layer3Labs' derived per-minute math, via WebSearch
2026-09-09, internally consistent with OpenAI's own published per-token rates.)* For a business that
opts in and gets, say, 20 live-agent calls/month at 3 minutes average: **$3.60–$6.60/month** on the
full model, **$1.20–$3.00/month** on the mini model — a real but modest incremental cost, confined to
the subset of customers who opt in (Phase 1, shipped off by default per `PRODUCT_DIRECTION.md`).

### Twilio/Meta pass-through costs — real, but the customer's bill, not FollowUp's (context for TCO and in-product disclosure)

Researched this session for completeness and for the in-product disclosure the integrations research
recommends (`research/integrations/2026-09-06-twilio-sms-compliance.md` explicitly flags that
customers aren't currently told these costs exist):

- **SMS**: $0.0083/segment outbound (Twilio's own published US rate, grade B) + ~$0.003/segment A2P
  carrier surcharge once registered ≈ **$0.011/segment effective**. *(WebSearch 2026-09-09, cross-
  checked against the existing compliance research's own $0.003 surcharge figure.)*
- **Voice**: $0.0085/min inbound, $0.014/min outbound (Twilio's own published US rates, grade B).
  *(WebSearch 2026-09-09.)*
- **WhatsApp**: post-October-2026, both business-initiated (template) and free-form service replies
  are metered; a small-business customer at 200–500 messages/month lands at "low single-digit
  dollars/month" in Meta fees plus Twilio's flat $0.005/message markup
  (`research/integrations/2026-09-06-whatsapp-business-production-readiness.md`, grade C).
- **A realistic estimate**: a moderately active customer (150 SMS/month, 20 missed-call minutes/
  month) pays roughly **$1.65 (SMS) + $0.17 (voice) ≈ $2/month to Twilio directly**, plus a few
  dollars a month more if WhatsApp is active — none of which appears on FollowUp's own income
  statement.

### Hosting — realistic tier cost, researched this session

- **Vercel Pro**: $20/seat/month (includes $20 of usage credit; 1TB data transfer and 10M edge
  requests are free and don't consume it). *(WebSearch 2026-09-09, grade B — Vercel's own pricing
  structure, corroborated across two independent breakdowns.)*
- **Supabase Pro**: $25/month base, including a $10/month compute credit covering one Micro
  instance — most early-stage apps stay at exactly $25/month; a growing app on a Small compute tier
  with meaningful storage/egress lands around $36/month; the Team tier starts at $599/month.
  *(WebSearch 2026-09-09, grade B.)*
- **Baseline combined infra**: **~$45/month** at very low customer counts (1 Vercel seat + Supabase
  Pro base), rising with usage — this document estimates ~$150–250/month at ~100 customers (larger
  Supabase compute tier, some Vercel usage overage) and ~$400–700/month at ~500 customers (still
  likely Supabase Pro-plus-compute rather than the $599 Team tier, unless team-collaboration features
  are needed for a larger internal team) — **estimated**, not independently benchmarked against a
  real FollowUp production bill, since customer volume hasn't reached these tiers yet.

### Support cost assumption

Stated explicitly as an assumption, per the task's request, since there is no real support-ticket
volume yet: **founder-only support at the current, near-zero customer count** (effectively $0 cash
cost, real opportunity cost not quantified here); this document assumes a nominal **$0–5/customer/
month** blended support cost once volume justifies any paid help (e.g., a part-time support hire at
$2,500–3,000/month, amortized across 500+ customers ≈ $5–6/customer).

### Gross profit per customer, at $29/mo, across three scale checkpoints (all estimated)

| | 10 customers | 100 customers | 500 customers |
|---|---|---|---|
| Revenue | $290/mo | $2,900/mo | $14,500/mo |
| AI text cost (~$0.15–0.30/customer) | ~$2–3 | ~$20–30 | ~$100–150 |
| Voice-agent opt-in cost (est. ~15% adoption, blended) | ~$1 | ~$10 | ~$50 |
| Hosting (amortized) | ~$45 | ~$150–250 | ~$400–700 |
| Stripe fees (2.9% + $0.30/txn × $29) | ~$11.40 | ~$114 | ~$570 |
| Support (assumed) | ~$0 | ~$0–200 | ~$500–3,000 |
| **Total cost** | **~$60–70** | **~$300–600** | **~$1,600–4,500** |
| **Gross profit** | **~$220–230** | **~$2,300–2,600** | **~$10,000–13,000** |
| **Gross margin** | **~76–79%** | **~79–89%** | **~69–89%**, depending on support staffing assumption |

**Read:** even under conservative assumptions, FollowUp's gross margin sits in the range typical of
healthy SaaS (75–85%+), and structurally *better* than a telephony-reselling competitor like CallRail
or Podium precisely because Twilio/Meta usage is the customer's own cost, not FollowUp's. The single
biggest swing factor in the model above is the support-staffing assumption at scale, not any AI or
infra cost — worth flagging honestly rather than hiding behind a single confident number.

### CAC, LTV, and breakeven

**CAC benchmarks (researched this session):** median B2B SaaS CAC is **$702 self-serve** vs.
**$11,400 sales-led**; **self-serve/PLG companies should target ~$420**; **low-price SMB self-serve
products commonly see a CAC ceiling of $100–$500**. *(WebSearch 2026-09-09, grade C — aggregated
benchmark-report content, consistent across multiple sources on the self-serve-vs-sales-led gap.)*
**FollowUp's own CAC is not yet measured** (no paying customers — see §11); this document's own
estimate for the founder-led first-customers phase (§10) is **~$50–150** (mostly founder time, near-
zero paid spend), rising toward the **$150–400** range once a paid channel is added for the
first-1,000 phase — **estimated**, staying inside the cited self-serve ceiling throughout.

**Churn benchmarks (researched this session):** healthy monthly logo churn for SMB/prosumer
products runs **2–4%/month** (≈24–40%/year); **vertical SaaS specifically runs 7–12% gross annual
churn**, materially lower, reflecting the stickiness of an industry-specific tool. *(WebSearch
2026-09-09, grade C — multiple SaaS-benchmark blogs, e.g. Koji, MRRSaver, GrowthSpree, Optifai,
converging on the same bands.)* **FollowUp sits in between these two bands, honestly** — it is
horizontal by decision (Rule 1), so it doesn't automatically inherit vertical-SaaS stickiness, but
Rule 2 ("own the data") means a real switching cost (years of scoring history, tuned drafts) accrues
the longer a customer stays, which should pull churn down over time as the customer base matures.
**This document models both a bear and a bull case rather than picking one number to look
confident:**

- **Bear case** (early-stage, no proven data lock-in yet): 3%/month churn ≈ 28%/year → average
  customer lifetime ≈ 33 months.
- **Bull case** (data lock-in matures, vertical-SaaS-like stickiness): 1%/month churn ≈ 12%/year →
  average lifetime capped conservatively at 60 months for this model (rather than the unbounded
  ~100-month geometric-series result, to avoid overstating LTV on an unproven assumption).

**LTV (gross-profit basis, at ~85% blended margin from the table above):**

- Bear case: $29 × 33 months × 0.85 ≈ **$813**
- Bull case: $29 × 60 months × 0.85 ≈ **$1,479**

**LTV:CAC:**

- Founder-led phase (CAC ~$100): bear case **8.1:1**, bull case **14.8:1** — both far above the
  commonly-cited 3:1 healthy threshold.
- Paid-channel phase (CAC ~$300–400): bear case **2.0–2.7:1** — **below** the 3:1 threshold, a real
  flag. This is the direct, quantified argument for either (a) validating the higher price point
  §7 already found headroom for before scaling paid acquisition, or (b) proving churn comes down
  toward the bull case (via the data-lock-in moat, §5) before leaning hard on paid channels.

**Breakeven customer count, three fixed-cost scenarios (founder-only through small-team, as
requested):**

| Scenario | Assumed fixed costs/month | Contribution margin/customer (~$26, after COGS+Stripe) | Breakeven customers |
|---|---|---|---|
| Founder draws no salary, minimal infra | ~$150 (hosting only) | ~$26 | **~6** |
| Founder draws a modest salary ($3,000/mo) + infra + basic tools (Sentry, monitoring) | ~$3,350 | ~$26 | **~129** |
| Small team (founder + 1 hire, ~$8,000/mo combined) + infra + tools | ~$8,500 | ~$26 | **~327** |

**Read:** because FollowUp's own variable cost per customer is genuinely tiny (the Twilio/Meta
structural point above), breakeven is driven almost entirely by the fixed-cost scenario chosen — a
real, founder-relevant number to plan against, not a vague "we'll be profitable eventually" claim.

---

## 9. Market (TAM/SAM/SOM)

**Method, stated up front:** this section builds bottom-up from named, sourced business counts
rather than asserting a round headline number. Every count below is graded, and where two sources
disagree materially, both are shown rather than picking the more flattering one.

### Inputs (researched this session via WebSearch)

- **Total US small businesses**: **36.2 million** (SBA Office of Advocacy, 2026) — of which **29.8
  million (82.3%) are nonemployer** (no paid staff) and **6.4 million (17.7%) have employees**.
  *Grade A — SBA primary source.*
- **Home-services trade counts** — two materially different figures found, both cited honestly:
  - Aggregator-compiled figures (64 sources): **~117,000 HVAC companies, ~132,000 plumbing
    companies, ~252,000 electrical companies** ≈ **~500,000 combined across just these three
    trades**. *Grade C.*
  - US Census Bureau (more authoritative, narrower definition — establishments with payroll only):
    NAICS 238220 (HVAC + plumbing combined) had **109,601 establishments** in 2022. *Grade A for the
    Census figure itself, but it excludes nonemployer sole proprietors — exactly the "solo operator"
    segment that is FollowUp's core ICP — so it likely understates the true count of businesses
    (rather than "establishments with payroll") in this space.*
  - **This document's own reasoned reconciliation** (estimated, not a published figure): the true
    business count including solo/nonemployer operators is almost certainly closer to the
    aggregator's ~500,000 figure than the Census establishment count, since 82% of all US small
    businesses nationally are nonemployer — a category the Census "establishments" figure structurally
    excludes. **This document adopts ~500,000 as the named-trades (HVAC/plumbing/electrical) estimate**,
    labeled C-grade/estimated, with the Census 109,601 figure noted as a conservative floor for the
    payroll-employer subset alone.
  - Adjacent home-service trades not separately counted here (roofing, landscaping, remodeling, pest
    control, cleaning, garage doors, etc.) plausibly add a comparable number again based on the
    "6.1 million home-services professionals" workforce figure (**estimated**, growing to 7.2 million
    by 2028, grade C) implying, at a rough 8–12 workers/firm average, **~500,000–750,000 firms
    industry-wide** — this document uses **~700,000** as its working "all home-services trades"
    estimate, explicitly flagged as this document's own derived range, not a single cited source.
- **US real estate agents**: NAR membership is **1,438,569** as of June 2026 (projected to fall to
  ~1.2 million by year-end). *Grade A — NAR's own reported membership count.* Not all are
  independent buyers of a $29/mo tool — a meaningful share are on brokerage-mandated CRM contracts
  (kvCORE/BoldTrail, Lofty) they can't unilaterally swap (`research/market/2026-09-06-realtor-tool-landscape.md`)
  — this document estimates **~30–40% (roughly 430,000–575,000)** as solo/small-team agents not
  locked into a brokerage-level contract, **estimated**, no direct source found for this specific
  split.

### TAM (broadest defensible bound)

**~6.4 million US employer small businesses** (SBA) is the outer edge of "any small business that
could plausibly run a lead-follow-up tool." Narrowed by the fact that roughly half of small
businesses with fewer than 10 employees use no CRM at all — a rough proxy for "still underserved by
existing follow-up tooling" — this document estimates a **TAM of ~3.2 million businesses**
(50% of the 6.4 million employer-SMB population), **estimated, not independently sourced as a single
figure**.

- **TAM in dollars** (at $29/mo × 12 = $348/year, 100% hypothetical penetration): **~3.2M × $348 ≈
  $1.1 billion/year.** This is the loosest, least meaningful of the three figures — shown for
  completeness, explicitly labeled as a ceiling with no realistic path to full penetration, per the
  task's instruction not to present a top-down "1% of TAM" hand-wave as if it were a plan.

### SAM (the realistically GTM-reachable core — home services + a fraction of real estate)

**~700,000 home-services businesses + ~500,000 reachable (non-brokerage-locked) realtors ≈
1.2 million businesses.**

- **SAM in dollars**: 1.2M × $348/year ≈ **~$418 million/year** — this is the honest ceiling of "if
  FollowUp fully saturated its two clearest-fit segments at the current $29/mo price," not a
  near-term target.

### SOM (bottom-up, GTM-grounded, 3-year horizon — see §10 for the channel math this rests on)

Rather than asserting a percentage of SAM, this is built from the GTM plan in §10: a founder-led
first-10-to-100 phase, a repeatable-channel phase to 100–1,000, and a scaled-channel phase beyond
that. A realistic, conservative 3-year SOM target: **2,000–5,000 paying customers**.

- **SOM in dollars**: 2,000–5,000 × $348/year ≈ **~$700,000–$1.74 million ARR** at the 3-year
  horizon — consistent with a realistic early-stage trajectory for a $29/mo self-serve horizontal
  product with no proven product-market fit yet (§11), not an inflated "hockey stick" projection.
  This is **0.17–0.4% of the estimated 1.2M SAM** — a genuinely modest, defensible share, not a
  "just get 1%" assumption dressed up as math.

**Honesty check on this whole section:** every business-count input above required either a Census
figure that structurally undercounts sole proprietors, or an aggregator estimate that is plausible
but unverified (grade C). The TAM/SAM/SOM figures here should be read as **directionally sound,
order-of-magnitude correct** — "the reachable market is in the hundreds of thousands of businesses,
worth several hundred million dollars a year at current pricing" — not as precise figures to put in
front of an investor without re-deriving them from a primary industry report first.

---

## 10. Go-To-Market

**Grounding principle, evidenced this session:** the target buyer (a solo or small-team home-services
owner, or a solo-to-small-team realtor) does not spend attention the way a SaaS-buyer persona from a
generic GTM playbook does. The customer research already on file shows this buyer's actual channels
are trade associations, local Facebook groups, and peer referral ("someone who calls because a
neighbor, a real estate agent, or a hardware store owner they trust recommended you arrives with a
different mindset and is already halfway to trusting you before you pick up the phone" — WebSearch
2026-09-09, grade C, consistent with the general small-business-networking literature). This should
shape every phase below, not just the first one.

### First 10 customers — founder-led, one narrow vertical community

**Cold outreach research, general SaaS pattern (WebSearch 2026-09-09, grade C but consistent across
multiple independent sources):** "your first customers should come from your network, not cold
outreach... founders should drive the first 20 or so customers"; "stay in the sales seat until you've
closed 20 to 30 deals and can write down exactly why customers buy"; personalized outreach that
references something specific about the prospect's business meaningfully outperforms generic
templates. Applied to FollowUp specifically:

- **Pick one narrow vertical community, not a broad cold-email blast** — per the strongest
  quantified-pain segment found (home-services contractors, §1–2), the founder should personally join
  and participate in 2–3 local or trade-specific Facebook groups / a regional trade association
  (plumbers, HVAC, electricians) rather than mass-emailing.
- **Offer white-glove, hands-on setup** to the first 10 — the founder personally walks each one
  through Twilio/Gmail connection (real onboarding friction, §12) in exchange for direct feedback,
  not a self-serve signup flow yet.
- **This is also the validation step §11 is missing** — these 10 conversations should double as the
  first real customer interviews, not just sales calls.

### First 100 — what has to change: a repeatable channel, not more founder hours

- **Self-serve onboarding must work without the founder in the room** — the channel-unblocking
  friction (A2P 10DLC, Google OAuth verification, Meta App Review — §12) needs a guided in-app flow
  or clear instructions, not founder hand-holding, to scale past personal outreach.
- **Referral loop from the first 10** — the peer-referral research above ("already halfway to
  trusting you") suggests the single highest-leverage move at this stage is making the recovered-
  revenue report shareable/screenshottable, so a happy first customer has something concrete to show
  a peer in the same trade-association Facebook group.
- **Narrow-niche content/SEO** targeting long-tail terms specific to the ICP's actual search
  behavior ("missed call text back for plumbers," "AI follow-up for realtors who don't use a
  brokerage CRM") rather than broad "AI CRM" terms already owned by funded competitors.
- **Vendor/community partnerships** — a listing in the Zapier app directory (FollowUp already
  supports generic webhook ingestion, `docs/PRD.md` §6.1) or positioning as complementary to (not
  competing with) tools like QuoteIQ or CallRail that the ICP may already use for other jobs.

### First 1,000 — what channel actually scales at this ICP and price point

- **A real, if modest, paid-acquisition channel becomes viable once the LTV:CAC math (§8) supports
  it** — the CAC ceiling research ($100–500 for self-serve SMB) leaves room for targeted Facebook/
  Google ads aimed at home-service owners specifically, once churn/retention data confirms the LTV
  side of that math isn't the bear case.
- **Continued trade-association presence, scaled** — sponsoring or exhibiting at a regional (not yet
  national) trade-association event, once the first-100-customer referral loop has produced enough
  proof points (case studies, the recovered-revenue numbers) to make that spend justified.
- **What competitors are actually doing, for comparison** (`research/market/2026-09-08-broader-
  competitive-landscape.md`): Beside ($32M raised) and Bravi (YC-backed) are both funded well beyond
  what a bootstrapped founder-led motion can match dollar-for-dollar in paid acquisition — this is an
  **honest structural disadvantage to name plainly**, not paper over. FollowUp's realistic path to
  1,000 customers is community/referral/SEO-driven, compounding slowly, not an ad-spend race against
  a $32M-funded horizontal competitor. This is consistent with, not a contradiction of, the moat
  argument in §4–5: FollowUp's edge has to be the specific mechanism (rescue score, audit trail,
  recovered-revenue report) and word-of-mouth in a tight-knit trade community, not outspending a
  better-capitalized rival on customer acquisition.

---

## 11. Validation

**Stated plainly, per the task's own instruction not to fabricate what didn't happen:** as of this
writing, **FollowUp has done extensive product and market research this session — competitive
analysis across three full passes, ICP/pain-point research, pricing validation, integrations/
compliance scoping, and four rounds of code security audits — but has run zero formal customer
interviews and has zero paying beta customers.** The only outside human feedback on file anywhere in
this corpus is a single informal reaction from "the first outside tester (a realtor)" quoted in
`PRODUCT_DIRECTION.md` ("amazing if it will be taking follow up from each and every one... in any
language from every platform") — one anecdotal reaction, not a structured interview, and not a
paying customer. Every dollar figure, churn rate, CAC estimate, and TAM/SAM/SOM number in this
document is either a third-party benchmark (graded accordingly) or this document's own explicitly-
labeled estimate — **none of it is FollowUp's own measured customer data**, because that data doesn't
exist yet.

**Concrete next validation steps, matching the founder's own stated framework** (the CEO's own
question list in `research/market/2026-09-07-lead-rescue-gap-and-strategy.md`: *"Can we acquire the
first 100 customers? ... What makes an owner use FollowUp alongside their existing tools? ... Path to
$10M/$100M?"*):

1. **15–20 structured customer interviews**, drawn from the home-services and small-team-realtor
   segments specifically (not a broad, unfocused sample) — the §10 "first 10" founder-led outreach
   should be designed to double as these interviews, not treated as a separate step. Each interview
   should specifically probe the two biggest open gaps this document had to flag as "no source
   found": average deal value for this ICP (§2) and actual willingness-to-pay above $29/mo (§7).
2. **A real pricing-page test**, per the research's own recommendation (§7) — existing/new users see
   $29/mo, a cohort sees $49–79/mo justified by their own recovered-revenue numbers — run only after
   the interviews above, and only with the CEO's sign-off given the explicit "hold off on pricing"
   decision on file.
3. **A prototype-to-beta path**: convert the first 10 founder-led relationships (§10) into unpaid or
   discounted beta customers explicitly in exchange for feedback and (with permission) a case study,
   before any paid-acquisition spend — this sequencing matches the standard founder-led-sales pattern
   researched this session ("stay in the sales seat until you've closed 20 to 30 deals and can write
   down exactly why customers buy") and avoids spending on a channel (§10's "first 1,000") before the
   product-market fit signal from real usage exists.
4. **Non-English end-to-end test** (already flagged as an open item in §6/§8 of `docs/PRD.md`) should
   happen inside this same validation phase, not after — a real or paid native-speaker test lead is
   cheap relative to the risk of the mission's own "every language" claim going unverified while
   competitors (Bravi, Structurely) already operate multilingually.

---

## 12. Legal & Technical

**Privacy (PIPEDA/GDPR):** per-business data export and full deletion are shipped, audit-logged, and
tested — `GET /api/business/export` returns every lead, conversation, message, deal, task, booking,
sequence, team member, and audit-log entry via an explicit field **allowlist** (never an omit-list,
so a new secret column has to be added on purpose to ever leak into an export); `POST /api/business/
delete` is admin-only, gated behind re-typing the business's name, cancels any active Stripe
subscription, and removes every dependent row across 19 tables in one FK-safe transaction, finishing
with one permanent `AuditEvent` documenting the deletion itself (`docs/security-roadmap.md` Level 2;
9 tests cover the deletion order and the credential-never-in-export guarantee). A de-identification
pipeline (`buildDeidentifiedTrainingSet()`, `src/lib/deidentify.ts`) gates any future model-training
use of customer data behind a per-business opt-in that defaults to **false**, checked before a single
row is queried — not built as an afterthought once training was already happening.

**CASL/TCPA SMS compliance:** `Lead.optedOutAt` is checked by every send path (`sendFollowUpToLead`
hard-refuses an opted-out lead regardless of caller); `src/lib/twilio.ts` matches the standard CTIA/
Twilio STOP-keyword set (`stop, stopall, unsubscribe, cancel, end, quit`) as a whole-message match
(so "please stop texting me" doesn't false-negative, but "STOP" reliably fires) and the START
keywords (`start, unstop`) to re-subscribe. **What's still a real, named gap, not resolved by this
mechanism alone** (`research/integrations/2026-09-06-twilio-sms-compliance.md`): the consent
*standard* differs by message type (marketing needs prior express *written* consent; FollowUp's
follow-up texts are a legal gray area, sales-oriented but responding to an inbound inquiry — a legal
categorization question, not an engineering one) and quiet-hours enforcement (8am–9pm recipient local
time) isn't built. TCPA statutory damages ($500–$1,500/violation) and A2P 10DLC's carrier-level
blocking of unregistered traffic (binary, not a throttle, since Feb 2025) are both real, currently-
active exposure — A2P registration is a per-business, ~2–6-week process the current UI doesn't yet
guide a business through (§6).

**Data security:** `docs/security.md` and `docs/security-roadmap.md` describe a levelled program, not
a one-time pass. Level 1 (session auth on every route, tenant-scoped per-id queries, signature-
verified webhooks, AES-256-GCM credential encryption at rest, security headers, no secrets in git)
is done. Level 2 (audit trail, admin-only settings, rate limiting, CI with secret scanning, error
monitoring with PII scrubbing, per-business export/delete, Zod validation, session hardening with a
step-up re-auth gate on irreversible actions) is mostly done — the one open item is automated tests
proving the trust guarantees hold (task #59), and the least-privilege Postgres role
(`followup_app` — full CRUD, no DDL, no superuser, `BYPASSRLS` since the app enforces tenant
isolation in application code rather than DB-level RLS policies) is created and verified but its
production `DATABASE_URL` cutover is still a pending manual step
(`docs/least-privilege-db-role.md`). **Four code-audit passes this session** found and mostly fixed a
real progression of issues: the voice-agent bridge's WebSocket had no authentication at all
(critical — fixed); Instagram/Messenger/Lead-Ads webhooks had no idempotency guard against Meta's
redelivery (medium-high — fixed); a stale migration had silently left the live `CrmConnection` table
missing from production despite `_prisma_migrations` recording it as applied (found and fixed while
verifying the least-privilege role's grants). **Genuinely still open, not fixed yet**: an SSRF gap on
the outbound webhook feature (a business can point it at an internal/metadata address with no
IP-range check); a check-then-act race in the rate limiter that a concurrent flood can defeat
entirely (both from the fourth-pass audit, `research/audit/2026-09-09-fourth-pass-audit.md`); the CRM
sync pagination cursor bug (§6); and Gmail/Outlook OAuth callbacks missing CSRF `state` validation
(Instagram/Facebook already do this correctly). Level 3 (external penetration test, tested backup
restore, incident-response plan, DPAs, SOC 2) is correctly **not yet started** — this session's own
SOC 2 timing research concluded it would be premature (no enterprise deal is blocked on it, and the
engineering-time cost is the real constraint, not the ~$45–70K audit fee —
`research/market/2026-09-08-soc2-timing-scoping.md`) — with a pentest vendor shortlist already
scoped for when it is warranted ($4,000–8,000, 5–7 testing days is the realistic band for FollowUp's
current stage, `research/market/2026-09-08-pentest-vendor-options.md`).

**API/CRM integrations:** the full shipped list is in §6 above (13 capture channels, inbound sync
from Follow Up Boss and HubSpot). No integration gap blocks the current product from working; the
open items are the channel-unblocking timelines (external, per-business or one-time app-wide waits,
not code) and the CRM sync pagination bug.

**AI costs:** see §8 in full — the headline finding (Twilio/Meta usage is the customer's own cost,
not FollowUp's) is a legal/technical architecture fact as much as a financial one, since it flows
directly from the BYO-credentials integration pattern described in this section and in
`research/integrations/2026-09-06-twilio-sms-compliance.md` and
`2026-09-06-whatsapp-business-production-readiness.md`.

**Infrastructure:** three independently-deployed services sharing one Postgres database
(`docs/TRD.md` §1) — the main Next.js 16 app (Vercel), a separate always-on Node/Express voice-agent
bridge (its own Vercel project, needed because a live phone call requires a persistent WebSocket a
normal Next.js route can't hold), and Supabase Postgres (pooled `DATABASE_URL` for the app, direct
`DIRECT_URL` for migrations only). Realistic hosting cost at current and near-term scale is modeled
in §8 (~$45/month baseline, rising with usage).

---

## 13. Final Business Case

**The chain, completed link by link:**

- **Problem** → business owners lose money because they don't follow up, follow up late, or follow
  up wrong — a measured, not assumed, failure mode that every generalist CRM leaves unsolved because
  it solves lead generation and sorting instead (§1).
- **Customer** → a small home-services or local-service business owner (plumbers, HVAC/electrical
  contractors, realtors not locked into a brokerage CRM, small sales teams) who gets more inbound
  contact across multiple channels than they can personally answer, and has no dedicated follow-up
  staff — the sole decision-maker on a $29/mo purchase, not a committee (§2).
- **Solution** → capture every channel, score urgency with a visible reason, draft in the lead's own
  language with a hard no-invention rule, route through a per-lead trust tier, and — the
  differentiator — catch the lead that already got a reply and then went silent, ranked by a rescue
  score, with a recovered-revenue report as the proof (§5).
- **Differentiator (the moat)** → neglect detection by default (not a workflow the business has to
  build), a real permission/audit trail as a trust feature rather than backend plumbing, and
  compounding outcome intelligence FollowUp owns because the data lives in its own DB — none of
  which any competitor found in three full research passes, including the best-funded horizontal
  threat (Beside, $32M raised), has shipped evidence of doing (§4–§5).
- **Market** → an estimated ~1.2 million realistically-reachable US home-services and independent-
  realtor businesses (SAM), inside a much larger, less-reachable ~3.2 million-business outer bound
  (TAM), worth roughly $300–450 million/year in SAM-dollar terms at current pricing, with a
  conservative, GTM-grounded 3-year SOM of 2,000–5,000 customers (~$0.7–1.7M ARR) (§9).
- **Pricing** → $29/mo flat, no seats, no contract — underpriced against the broader comparison set
  (which runs $97–600/mo for narrower capability) but matched almost exactly by the one real budget
  competitor (QuoteIQ Essentials, $29.99/mo), with real headroom identified but deliberately not yet
  tested per the CEO's own "hold off on pricing" call (§7).
- **Costs** → structurally excellent gross margins (an estimated 75–89% depending on scale and
  support-staffing assumptions) because the metered telephony/messaging cost sits on each customer's
  own Twilio/Meta bill, not FollowUp's — FollowUp's own variable cost is close to just the AI text
  calls (rounding-error-level) plus amortized hosting (§8).
- **Acquisition** → founder-led, one narrow trade community at a time for the first 10 (doubling as
  the customer interviews the product still needs), a referral-and-content-driven repeatable channel
  for the first 100, and a modest paid channel plus continued community presence for the first 1,000
  — honestly unable to outspend a $32M-funded competitor on acquisition, and not attempting to (§10).
- **Profit** → an estimated breakeven at as few as ~6 customers on a bare-infra, no-founder-salary
  basis, rising to ~129–327 customers as real salary and team costs are added — a genuinely low bar
  because of the cost structure above, not a hand-waved "we'll be profitable eventually" (§8).
- **MVP** → already built and shipped in production: the full capture-score-draft-rescue loop, the
  trust/autonomy tier system, and the recovered-revenue report — what's left (non-English end-to-end
  verification, channel-unblocking, a few open security findings) is real but bounded, not an
  unbuilt core (§6).

**Validation status, stated once more plainly because it matters for how much weight to put on the
above:** every number in this chain is either a graded third-party benchmark or this document's own
explicitly-labeled estimate. **Zero formal customer interviews and zero paying beta customers exist
as of this writing** (§11) — the recommended next step is not more research, it's the 10 real
conversations §10 and §11 both point to.

**The one-line business model, filled in from the actual ICP research, not the bare template:**

> **FollowUp is a SaaS platform for small home-services and local-service business owners —
> plumbers, HVAC and electrical contractors, independent real-estate agents, and small sales teams —
> who get more inbound leads across phone, email, and social media than they can personally follow
> up with, that prevents valuable leads from being lost through missed or delayed follow-ups,
> charging customers a recurring monthly subscription.**
