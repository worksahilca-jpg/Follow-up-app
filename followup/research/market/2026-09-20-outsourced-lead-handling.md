# Outsourced lead handling: the humans a business hires instead of buying software

**Date:** 2026-09-20
**Scope:** Every prior competitive pass in this folder looked at *software* — CRMs, missed-call
text-back tools, AI-nurture platforms. None looked at the **people and agencies a small business
pays to do this job instead**: answering services / virtual receptionists, real-estate inside sales
agents (ISAs), outbound calling and appointment-setting shops, and offshore VA/BPO arrangements.
This pass covers that category: what it costs, what it actually does and doesn't do, where it
fails, and whether FollowUp replaces it, complements it, or neither.

**Builds on, does not repeat:** `2026-09-06-realtor-tool-landscape.md` (one figure from it is
corrected below), `2026-09-08-pricing-validation-home-services-icp.md` (Smith.ai's and Ruby's
prices appear there as one line each — extended substantially here),
`2026-09-08-broader-competitive-landscape.md`, `2026-09-10-pricing-and-packaging.md`,
`2026-09-11-tier-pricing-recommendation.md`,
`research/customers/2026-09-05-icp-pain-and-trust-objections.md` (the ICP). The missed-call
statistics that keep resurfacing in these searches (62%, $126k/yr, $1,200/call) are **already
fact-checked on file** in `2026-09-08-62pct-missed-calls-stat-verification.md` and
`2026-09-08-missed-calls-126k-stat-verification.md` — they are deliberately not re-asserted here,
and the caveats those documents raise (the 62% figure is a 2016, 85-business study; the $126k
figure has no traceable methodology) still apply everywhere they appear below.

---

## Sourcing caveat — read this before quoting any number below

WebFetch is blocked network-wide in this sandbox, unchanged from every prior pass. Everything below
is a **WebSearch result snippet**, not a page fetched and read directly.

**This pass has one sourcing hazard worse than any previous one, and it needs stating loudly:
the majority of pages that rank for "[answering service] pricing 2026" are published by AI
answering-service startups selling the replacement.** serviceagent.ai, oncrew.ai, vida.io,
getnextphone.com, fitmycall.com, loman.ai, cloudtalk.io, readyto.talk, avoca.ai, squawkvoice.ai,
voksha.com and similar all appear in these results, and every one of them has a direct commercial
interest in the human service looking expensive and the overage bills looking terrifying. That is
**exactly the bias FollowUp would be accused of** if it repeated their numbers on its own landing
page. So: where a figure comes only from that cluster it is graded **C or D and flagged**, and I
went looking for the vendor's own page or a neutral review site (Capterra, G2, Trustpilot,
ConsumerAffairs, BBB, Lawyerist) before treating anything as usable.

**Grades** (house convention): **A** = vendor's own published price page named in the snippet;
**B** = vendor-published and corroborated by two or more independent snippets; **C** = third-party
aggregator, estimate, or a competitor-published "pricing guide"; **D** = single weak/anecdotal
source, use for colour only, never as a claim.

**FollowUp's own current prices, code-verified this session, not assumed:**
`followup/src/lib/pricing.ts` — Free **$0**, Plus **$39/mo**, Pro **$79/mo**, Voice add-on
**+$39/mo** (200 min, then $0.20/min). Two flags that matter for every comparison in this
document: `VOICE_ADDON_AVAILABLE = false` and `CARRIER_CHANNELS_AVAILABLE = false` — **phone, SMS
and voicemail are not sold to a new customer today.** Several agent-facing briefs still describe
FollowUp as "flat $29/mo, one plan" — that is stale; the code is the source of truth and the
$29 figure survives only as a legacy subscription mapped onto Plus
(`src/app/api/billing/webhook/route.ts`).

---

## 0. One correction to a figure already on file

`2026-09-06-realtor-tool-landscape.md` line 102 carries a loose "**$500–$1,500/mo AI vs $4–6K/mo
human ISA**" framing and flags it as unverified. Verdict: **the human half is roughly right for an
in-house ISA and materially incomplete as a description of the market.**

- **In-house ISA:** ZipRecruiter's US average for a Real Estate Inside Sales Agent is **$69,398/yr
  ≈ $5,783/mo** (as of 2 Jan 2026). A staffing-side write-up puts fully-loaded cost at
  **$55,000–65,000/yr ongoing ($4,583–5,417/mo), $75,000–85,000 in year one** including hiring and
  ramp. So "$4–6K/mo" is defensible for this one option. *Grade B — ZipRecruiter is a real primary
  salary dataset named in the snippet; the loaded-cost band is from nurtureos.io, a lead-nurture
  vendor, so it carries the same seller bias as the cluster above.*
- **What the figure misses:** an **outsourced/virtual ISA runs $720/mo (part-time, ~2 h/day) to
  $1,988/mo (full-time)**, and an outsourced concierge ISA service like **Verse.ai (formerly
  Agentology/Verse.io) is reported around $1,800+/mo** with a one-year commitment and a setup fee,
  pricing not published. *Grade C — hooquest.com and unifyrealestate.com, both real-estate
  ISA-comparison sites, no vendor page found.*

**Read:** the honest spread for "a human doing this job" is **~$720/mo to ~$5,800/mo**, not
"$4–6K". Anyone repeating "$4–6K/mo human ISA" as *the* alternative cost is quoting the most
expensive option in the category. Do not put that number in customer-facing copy.

---

## 1. What a small business actually pays to outsource this

### 1a. Live answering services / virtual receptionists — the category a plumber actually buys

The pricing model is almost universally **a monthly block of included minutes (or calls), plus
overage**, not a flat fee. Unused minutes generally expire.

| Service | Entry price | What that buys | Overage | Grade |
|---|---|---|---|---|
| **PATLive** | **$99/mo** (50 min); pay-as-you-go **$49/mo** with 0 min | Screening, transfer, message-taking, lead collection, appointment scheduling, order processing, FAQ, emergency dispatch — all tiers | **$2.00–2.99/min**; Starter $235/mo (75 min) at $2.25/min; Pro $1,050/mo (600 min) at $1.85/min; top plan $1,499/mo (1,000 min) | B |
| **AnswerConnect** | **$179/mo** (100 min) → **$399/mo** (300 min) | 24/7, bilingual Spanish at every tier | **$1.75–2.50/min**; **$49.99 one-time setup**; **$250–300 port-out fee** to keep your number | B |
| **Nexa** | **~$239/mo** quoted for contractors, price not published | Voice tiers of 100/300/500 min | Undisclosed base rate; third parties report **$0.65–1.19/call** with 30/60-second rounding | C |
| **Abby Connect** | **$329/mo** (100 min) live; AI tier **$99–690/mo** | Live receptionist team | **$2.99/additional min**; live tiers to ~$1,199 | C |
| **Ruby** | **$250/mo** (50 min) → $395 (100) → $720 (200) → up to **$7,875/mo** (2,500 min) | Human receptionists, US-based, strong brand; web chat sold separately (**Chat Ruby $143/mo for 10 conversations**) | Effective **$3.09–5.40/min**; overage reported **$4.75–5.90/min**; **unused minutes expire**; **downgrades take three full billing cycles** | B on plan prices, C on overage |
| **Smith.ai** (hybrid) | **$292.50/mo** for 30 calls (human), **$95/mo** for ~60 calls (AI tier) | **Per-call**, not per-minute — a 2-minute and a 20-minute call cost the same | **$1.60–1.90/call in tier, $2.40 overage** on the AI tier; **$9–11.50/call** overage reported on human tiers; mid tiers $700–800/mo, high tiers $1,000–2,000+/mo | B |
| **Nextiva "XBert" AI answering** | **$99/mo** (100 interactions) | AI answering bolted to a VoIP plan ($15–75/user/mo) | **$0.99/interaction** | C |

Category-level bands, for sanity-checking any single row: **$50–300/mo for AI answering, $100–1,000+/mo
for live answering** (Nextiva's guide, *grade C — a VoIP vendor, adjacent seller*), and specifically
for contractors **$200–450/mo for 50–100 live minutes with $1.50–2.50/min overage** (*grade C —
oncallclerk.com, an AI answering vendor; directionally consistent with the PATLive/AnswerConnect/Nexa
rows above, which is the only reason it's here*).

**Read:** the realistic number for FollowUp's ICP — a plumber or HVAC shop buying live 24/7 call
coverage — is **$180–450/mo before overage**, with a credible path to double that in a busy month.
Setup fees are small ($49.99 at AnswerConnect) or absent; the punitive fee is on the way *out*
(Ruby's three-billing-cycle downgrade lag, AnswerConnect's $250–300 port-out). No evidence was found
either way on standard minimum contract terms across this category — **I could not verify the
"12-month lock-in" claim that circulates about answering services and am not asserting it.**

### 1b. Outbound / lead-chasing services — priced completely differently, and this is the tell

| Service | Price | Minimum | Grade |
|---|---|---|---|
| **Smith.ai Outreach Campaigns** | **$12/contact**, includes up to **5 call attempts** plus email and SMS follow-up, CRM integration and booking | **200-contact minimum + $750/campaign setup** (one source says 50-lead minimum — conflicting, treat 200 as the safer figure) | B |
| **Upcall** | **$3.50–7.50/lead**, up to 5 attempts | **1,000-lead minimum → $3,500–7,500/campaign**; retainer alternative **$2,000–5,000+/mo** | C |
| **B2B appointment-setting agencies** | **$3,000–12,000/mo** retainer, or **$150–600 per qualified appointment** | Retainer | C |
| **Nearshore/offshore SDR labour** | **$12–18/h fully loaded** (LatAm/Caribbean) ≈ **$2,400–3,800/mo** full-time | Full-time seat | C |
| **Philippines VA** | **$3–12/h** direct; **$6.50–25/h** via a managed agency; **$480–1,600/mo** full-time, **$350–1,300/mo** part-time | Usually a monthly commitment | C |

**Read:** the cheapest credible way to have a *human* chase your quiet leads is an offshore VA at
roughly **$480–1,600/mo** — and that's a person you have to recruit, train on your business,
supervise, and replace. Every packaged outbound service starts at a **campaign minimum in the
thousands**: Smith.ai's own outbound floor is $750 setup + 200 × $12 = **$3,150**, Upcall's is
**$3,500**. There is no $200/mo product in this category that chases leads for you.

---

## 2. What they actually do — and the thing they structurally do not do

This is the section that matters most for FollowUp's thesis, so I went looking for evidence that
would *disprove* it rather than confirm it.

**They are inbound-first by construction.** The core deliverable at PATLive, AnswerConnect, Nexa,
Abby and Ruby is: answer the call, follow a script, capture details, transfer or take a message,
and — at the better ones — book an appointment on your calendar. Channel coverage is broader than
"phone" at several vendors (AnswerConnect and AnswerForce market a single inbox spanning web chat,
SMS, WhatsApp, Instagram, Messenger and email; Ruby sells web chat as a separate paid bundle), so
"they only do phone" is **not** a fair claim. *Grade B — vendor service pages.*

**Outbound exists, in three shapes, and none of them is "chase a lead that went quiet five days
ago":**

1. **Immediate speed-to-lead callback.** AnswerConnect's own description: a form is submitted, the
   receptionist is alerted, and they call the lead back "minutes after they have made an inquiry."
   That is *first contact*, faster — the same job the inbound service already does, triggered by a
   form instead of a ring. *Grade B — answerconnect.com's own outbound page.*
2. **Light-touch "call assist," billed against your minutes.** Ruby will make outbound calls to
   confirm or reschedule appointments or relay information, requested one at a time from the portal
   (or in batches by email), **Monday–Friday 8am–6pm**, with the time counted against your
   receptionist minutes. Ruby's own help centre describes it as explicitly **"not a full sales or
   telemarketing service."** *Grade A — ruby.com and Ruby's own help centre, quoted in the snippet.*
   Note what this shape does to incentives: **every follow-up attempt eats the same minute pool you
   bought for answering calls**, so a persistent 6-touch chase is directly, visibly expensive.
3. **A separately-priced campaign with its own minimum.** Smith.ai Outreach ($12/contact, 200-contact
   minimum, $750 setup, up to 5 attempts + email/SMS), Upcall (1,000-lead minimum). This *is* real
   multi-touch lead chasing by humans — sold as a project, at a floor of roughly $3,000, to a
   business that has a list. It is not something a plumber's $239/mo answering plan turns on.

**The one genuine exception found:** **Verse.ai** (the ex-Agentology real-estate ISA concierge)
markets AI that **nurtures a lead for up to six months** across text, email and voicemail drop,
with a human concierge team reviewing conversations and taking over when the AI can't answer. That
is FollowUp's thesis, staffed, for real-estate teams — at a reported **~$1,800+/mo, annual
commitment, plus setup, price not published**. *Grade C on price (hooquest/unifyrealestate), B on
the description (verse.ai's own pages).* This is the same finding the realtor pass already reached
about Structurely and Ylopo, arriving from the services side: **in real estate specifically, the
long-nurture job is already staffed and sold. Outside real estate, no equivalent was found.**

**Read — the honest answer to the question this task was set to answer:** the outsourced-services
category covers **first contact** extremely well and **persistence after silence** almost not at
all, and the reason is structural rather than an oversight. A service that bills per minute or per
call **makes money when a call arrives and loses money when its staff spend unbilled time chasing
someone who isn't picking up**. Persistence has to be repackaged as a separate, minimum-bound
campaign product precisely because it doesn't fit the metering. **FollowUp's thesis survives contact
with this category — but the accurate statement is "they answer, they don't chase," not "they do
nothing about your leads."** They do plenty about your leads; they do it once.

---

## 3. Where they fail

Four complaint patterns, in descending order of how well-sourced they are.

**1. Billing surprise is the number-one complaint, everywhere, and it's the same root cause each
time: metered pricing meeting unpredictable call volume.**
- Ruby: ConsumerAffairs reviews repeatedly cite frequent price increases; one quoted customer:
  *"They told me I'd receive alerts when approaching my minute limit. There was no alert. My bill
  went from $660 to $5,100 with no explanation."* Spam calls, hold time and post-call wrap-up all
  count as billable minutes. *Grade C — the quote reached me via a competitor's review round-up
  citing ConsumerAffairs; I could not read the ConsumerAffairs page directly. **Do not quote this
  verbatim in customer-facing copy without a direct fetch.***
- Smith.ai: a **BBB complaint** alleges a change to what counts as a billable call left a customer
  paying for waves of silent spam calls previously filtered free. Smith.ai's own stated policy is
  that it removes up to 10% of monthly calls from billing on dispute; **beyond 10%, calls are billed
  regardless of caller intent.** Reviewers describe billing as the #1 issue across Trustpilot, G2,
  Clutch and BBB, alongside charges continuing after cancellation. Its G2 scores are nonetheless
  strong (4.6/5 receptionist, 4.7/5 AI) — **this is a billing-model complaint, not a bad product.**
  *Grade B — BBB is a real neutral complaint registry named in the snippet.*
- Answering Service Care and AnswerFirst (Trustpilot): overage charges "in the thousands of
  dollars" without warning and refused refunds; time spent by agents on solicitors driving those
  overages; one AnswerFirst customer reporting bills at $8–9k/mo. *Grade C — Trustpilot is neutral,
  but these are individual unverified reviews summarised by a search engine.*

**2. "They took a message" when a booking was the whole point.** Contractor-facing buyer guides
frame the key upgrade as *coverage that books the job rather than hands back a callback to chase*,
and one complaint record (Answering Specialists, via Revdex) describes callers who phoned to
schedule being held, then having a message taken instead. *Grade C/D — the buyer guides are AI
answering vendors; the Revdex complaint is a single unverified record.* **This is the highest-value
failure mode for FollowUp's narrative and the weakest-sourced one — it deserves a real customer
interview before it becomes copy** (`research/customers/2026-09-15-owner-interview-guide.md`
question 10 already asks what the owner pays for an answering service; adding "and what happens
after they take the message?" would settle this).

**3. Messages lost, misrouted, or never relayed.** Trustpilot reviews describe procedures changing
so calls went to the wrong person, after-hours messages not recorded despite repeated assurances
they were, and in one case a customer attributing **the loss of four customers** to messages that
never arrived. *Grade C — neutral platform, individual unverified reviews.*

**4. Script rigidity, accents, and audio quality on offshore desks.** This is the complaint everyone
*expects* to find and the one I could source worst. What exists: a LiveVoice (a US answering
service — a directly interested party) article on offshore outsourcing problems, a Quora thread, and
a car-forum thread, describing heavy accents, low-quality VoIP, background noise, repeated
information, and callers hanging up. **Grade D. Directionally plausible, evidentially thin, and the
one source with any authority is selling the onshore alternative. I am not treating this as a
finding, and it should not appear in FollowUp copy.**

**5. Human ISAs specifically: turnover.** One real-estate sales-training source states ISAs have
**80% annual turnover**; multiple ISA-coaching blogs describe hiring failure as structural (needs
2+ years phone-sales experience, 6+ months before results, rushed hiring). *Grade C/D — every source
is an ISA-training or AI-ISA vendor with an interest in the number being high; no BLS or independent
survey found. **The 80% figure is not safe to quote.*** What *is* safe: hiring for this seat is
widely described as hard and slow, by the people who train for it.

**Read:** the category's real, well-sourced weakness is **cost unpredictability**, not
incompetence. These are mostly functioning services staffed by capable people. The complaint that
recurs is "I could not predict what I would be billed, and a busy month cost me multiples of the
plan price." That is a **pricing-shape** failure — which is precisely the axis
`research/customers/2026-09-05-icp-pain-and-trust-objections.md` already found this ICP to be most
sensitive on (they resent the *shape* — seats, tiers, meters — more than the number).

---

## 4. Is FollowUp a replacement, a complement, or neither?

**Today, for a plumber paying $300/mo for an answering service: a complement, and telling him
otherwise would be a lie he'd catch in week one.** Three reasons, in order of how load-bearing they
are:

1. **FollowUp does not answer a phone for a new customer right now.**
   `CARRIER_CHANNELS_AVAILABLE = false` and `VOICE_ADDON_AVAILABLE = false` in
   `src/lib/pricing.ts` — SMS, voicemail and the live voice agent are all withdrawn from sale
   pending A2P 10DLC and an end-to-end verification of the voice path. The answering service's
   entire job is the one channel FollowUp currently doesn't sell. Any "replace your answering
   service" pitch is false on its face until that flips back on.
2. **Even with voice on, the jobs differ.** A receptionist handles a live human in real time,
   in a conversation with unpredictable branches, and can put a truck on a schedule today. That is
   a different promise from "no lead dies of silence."
3. **The gap is on the other side of the handoff, and it's real.** The service answers, captures,
   and hands back a message or a booked job. From that moment — a quoted job with no answer, a
   lead who said "let me talk to my wife," a form that came in at 9pm — **nobody in the outsourced
   stack is assigned to the follow-up**, unless the owner buys a campaign with a $3,000 floor or
   spends receptionist minutes one manual call-assist request at a time. That is the FollowUp job,
   it sits *downstream* of the service rather than in place of it, and at $39–79/mo it costs roughly
   **10–15% of the answering-service bill it sits next to.**

**Where it *is* a replacement, honestly scoped:** a business paying for an answering service
**purely to catch web-form, email and DM leads** (not live phone calls) is overpaying dramatically
and FollowUp replaces that outright. So is a real-estate team paying $720–1,988/mo for a part-time
virtual ISA whose actual job is texting old leads — that's a straight swap, and the realtor pass's
warning applies (Structurely, Ylopo and Verse.ai are already selling against that budget). But
**neither is the home-services ICP the customer research points at**, and neither should be the
headline.

---

## 5. Does this change the sales pitch?

**Yes — one comparison becomes available that wasn't before, and one tempting version of it is not
honest.**

**Fair, and strong:**
> "Your answering service picks up. Then what? FollowUp is what happens on day two — for about a
> tenth of what the answering service costs."

Every clause survives scrutiny: the $180–450/mo answering-service band is sourced; $39–79 really is
~10–20% of it; "day two" is exactly the gap Ruby's own help centre concedes ("not a full sales or
telemarketing service") and that Smith.ai prices as a separate $3,000-floor campaign. It positions
FollowUp **next to** a spend the owner already made rather than against it, which also sidesteps the
"cheap tool replacing my trusted receptionist" objection entirely.

**Not fair, do not ship:**
> "Cheaper than the answering service you already pay for."

Three problems. (a) It implies substitution, and FollowUp cannot answer a phone for a new customer
today — the first prospect who asks "so I can cancel Ruby?" ends the conversation. (b) It compares
$39 to $300 across two different jobs, which is the exact apples-to-oranges move
`2026-09-08-pricing-validation-home-services-icp.md` already flagged when comparing FollowUp to
Podium and Birdeye. (c) The scary overage numbers that make the comparison look best (the $5,100
bill, the $8–9k months) are individual unverified reviews reaching us through competitors'
marketing pages. **Using an AI answering vendor's hit piece on Ruby as FollowUp's evidence would
make FollowUp's claim exactly as trustworthy as theirs.**

**One reusable framing that doesn't depend on any contested number:** every service in this
category bills by the **minute or the call** — so *persistence is the most expensive thing you can
ask them for*, and every extra follow-up attempt shows up on the bill. FollowUp's flat monthly price
means the sixth follow-up costs the same as the first. That's a structural argument from published
pricing models, not from complaint anecdotes, and it's the cleanest true thing this whole pass
produced.

---

## Recommendation to the founder — does this change pricing, positioning, or ICP?

**Pricing: no change.** Nothing here supports raising or lowering $39/$79. If anything it removes
pressure: FollowUp is not competing on price with a $200–450/mo service doing a different job, and
the earlier "maybe $29 is too cheap" question (`2026-09-08-pricing-validation-home-services-icp.md`)
is already settled by the current tiers. The *shape* — flat, unmetered — is now differentiated
against a whole second category, not just against per-seat SaaS, and that's worth more than the
digit.

**ICP: no change, with one sharpening.** Home-services contractors remain the right target. The new
detail is that the best-qualified prospect in that segment is **the one already paying for an
answering service** — he has proved he'll spend on lead handling, he has a phone problem already
solved, and he has the exact unstaffed gap FollowUp fills. "Already pays someone to answer the
phone" is a better qualifying question than "misses calls."

**Positioning: one real change, small and safe.** Adopt the *downstream-of-the-receptionist* framing
("your answering service picks up — FollowUp is what happens on day two"), drop the
substitution framing entirely, and keep the metered-vs-flat argument as the durable one. Against
`PRODUCT_DIRECTION.md`: this serves **Rule 1** (depth on the job — this category demonstrates that
the follow-up-after-silence job is not just underserved by CRMs but *structurally unprofitable* for
the humans-for-hire market to do, which is the strongest evidence yet for the "depth on the job, not
an industry" resolution) and touches **Rule 4** (no platform gives this away free; it's labour, and
labour doesn't get cheaper). It does **not** reopen Rule 1's vertical question — Verse.ai's
six-month nurture concierge is one more entry on the "real estate is already staffed and served"
pile, consistent with the 2026-09-06 decision, not against it.

**The one thing I'd do before any of this becomes copy:** the single most important claim in this
document — that a lead handed back as a message frequently never gets followed up — is sourced from
vendor buyer-guides and one unverified complaint record. It is the claim a skeptical founder should
be least willing to ship. Add one question to the owner interview guide ("after your answering
service takes a message, what actually happens to it — who calls back, and when?") and the whole
pitch above rests on a customer's own words instead of a competitor's blog.

---

## What I could not verify (named, not glossed)

- **Standard contract terms for answering services** — no reliable source on minimum terms, auto-renewal,
  or cancellation notice periods as a category norm. Known specifics only: Ruby's three-billing-cycle
  downgrade lag, AnswerConnect's $49.99 setup and $250–300 port-out, Verse.ai's one-year commitment.
- **Any price for Nexa or Verse.ai from the vendor's own page** — both are quote-only; every figure
  here is third-party.
- **Whether AnswerConnect/PATLive/Abby will do multi-day chase sequences on request** — their pages
  describe outbound as immediate callback and confirmations. Absence of a published sequence offering
  is not proof they'd refuse a custom one. A 20-minute sales call to two of these vendors, asking
  "will you call a quiet lead again on day 3, 7 and 14, and what does that cost?", would settle the
  central claim of this document better than any further searching.
- **The offshore accent/script complaint** — could not source it above grade D. Treated as unproven.
- **The 80% ISA turnover figure** — every source is commercially interested. Not usable.
- **Whether any of this category's customers overlap FollowUp's actual users** — zero first-party
  data; this is desk research end to end.
