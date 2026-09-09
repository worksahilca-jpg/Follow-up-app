# Follow-up cadence best practices — what should replace "5 days, then one message"

Checked: 2026-09-09. Grounded against the current implementation: `src/lib/automation.ts` (silence
+ unanswered-reply triggers, per-lead `automationTier`), `src/lib/sequences.ts` (manual multi-step
workflows), `src/lib/acknowledge.ts` (instant acknowledgement), and
`src/app/api/automation/settings/route.ts` (the two configurable knobs: `triggerDays` 1–30,
`unansweredReply.hours` 1–168). Commissioned because the current default timing — one flat 5-day
silence trigger, one flat 24-hour unanswered-reply trigger, no distinction between a lead quiet for
a few days and one that's been dead for months — reads as under-built next to
`PRODUCT_DIRECTION.md`'s explicit goal #2, "rescuing cold, dead, or never-reached leads."

**A methodology note up front, because it shapes how much weight to put on every number below:**
`WebFetch` was unreachable for every domain attempted in this environment (network egress block,
confirmed against `hbr.org`, `onecavo.com`, `marketingsherpa.com`, `insidesales.com`,
`revenue.io`, `cirrusinsight.com`, even `wikipedia.org`) — so nothing here comes from a directly
fetched primary PDF or the HBR article itself. Everything is drawn from `WebSearch`, cross-checking
independent secondary sources against each other rather than against the primary study text. Where
many independently-run blogs converge on the same number while citing the same named study, that's
real evidence the number is genuine (a widely-repeated fabrication is rare); where sources
disagree, or where a stat is vendor-published data with no link back to methodology, that's called
out explicitly below rather than stated as settled fact.

## Recommendation, up front

**FollowUp's current model gets the first minute right and the following weeks wrong.** Instant
acknowledgement (`acknowledge.ts`) already beats every response-time benchmark in the research —
no product change needed there. But past that first message, FollowUp treats a lead silent for 6
days exactly the same as a lead silent for 6 months: one flat `triggerDays` gate, one generic
AI-drafted follow-up, repeated at the same fixed interval forever, on whatever channel
`detectAutomatedReplyChannel` picks. Every piece of research below — the touch-count studies, the
real-estate reactivation vendors, and the competitors (Follow Up Boss, kvCORE, BoomTown) — agrees
this is the wrong shape. The market has converged on **tiered, escalating cadences that change
message content and channel as a lead ages**, not a single repeating trigger.

The highest-leverage fix is **not** a new trigger type bolted onto `automation.ts` — it's using the
`Sequence`/`SequenceStep` machinery FollowUp already built for manual workflows and auto-enrolling
silence-triggered leads into a default multi-step cadence instead of running the flat
`runAutomationForBusiness` loop indefinitely. A second, clearly distinct "dead lead reactivation"
campaign for leads silent 45+ days is the second-highest-leverage piece and the one most directly
tied to the CEO's own stated mission (`PRODUCT_DIRECTION.md`, goal #2) — it does not exist today in
any form. Both are detailed in the prioritized list at the end.

---

## 1. Response-time impact on conversion — FollowUp is already ahead here

The foundational number, repeated across every source found (`leadangel.com`,
`ainora.lt/blog/lead-response-time-5-minutes-study-2026`, `insidesales.com/response-time-matters`,
`greetnow.com/blog/lead-response-time-statistics`, `help.cincpro.com`,
`www.kixie.com/sales-blog/heres-the-best-schedule-for-lead-follow-up`): the **2007 MIT/InsideSales.com
"Lead Response Management" study**, led by Dr. James Oldroyd — a Kellogg-affiliated survey of 495
companies plus a behavioral analysis of 15,000+ leads and 100,000+ call attempts across 6
companies over 3 years — found that **contacting a lead within 5 minutes vs. 30 minutes makes
contact ~100x more likely and qualification ~21x more likely.** I could not fetch the original PDF
(`onecavo.com` and `marketingsherpa.com`, both hosting copies, were both egress-blocked), but the
495/15,000/100,000 sample-size figures and the 100x/21x numbers appear identically across many
independently-authored blogs, which is itself decent evidence they trace to one real study rather
than being invented — but note it *is* one underlying study being repeated, not independently
replicated by a second study with its own dataset.

A separate, later data point — commonly attributed to **Harvard Business Review's 2011 audit of
2,241 companies** (Oldroyd et al., "The Short Life of Online Sales Leads") — is the businesses'
side: **average response time to a new web lead is ~42–47 hours, and 23% of leads never get a
response at all.** A third figure, from a more recent RevenueHero study of 1,000 B2B companies, put
average response at 29 hours — a different study, same order of magnitude, both far outside the
5-minute window that actually moves conversion. (The code comment in `acknowledge.ts` already cites
"29–47 hours," matching this spread.)

**Cross-check status:** the 5-minute/100x/21x figures are consistent across 6+ independent
secondary sources all citing the same named 2007 study — treat as reliable *as a real, oft-cited
study*, with the caveat that it is 19 years old, pre-dates SMS/DM-based lead capture, and I
could not verify it against the primary text. The 42-47 hour "how slow businesses actually are"
figures are corroborated by at least two independently-sourced studies (HBR/Oldroyd's 2,241-company
audit, and RevenueHero's 1,000-company study) landing in the same 29-47 hour range, which is
stronger corroboration than the response-time-to-qualification numbers get.

**Product implication:** none needed for the acknowledgement itself — `acknowledge.ts`'s
1-hour `STALE_AFTER_MS` window and immediate, webhook-triggered send is already tighter than every
benchmark above. The actual gap is *after* the acknowledgement: the substantive AI-drafted reply
still sits in an approval queue with no urgency signal distinguishing "just came in" from "sat for
hours." Concretely: `findUnansweredLeads` in `automation.ts` uses one flat `unansweredHours`
(default 24, same knob for every lead) regardless of whether this is a lead's *first* real message
after the canned acknowledgement or the fifth message in an established conversation. Given how
steeply qualification odds drop by the hour on a first inbound, a lead's first substantive reply
deserves a materially shorter default window (see prioritized list, #3) — not the same 24-hour
grace period as a lead that's already been in dialogue for weeks.

## 2. Optimal follow-up cadence and touch count — flat single-trigger is not supported

Two different "6" numbers recur, and they matter for different populations — this distinction is
the single most important thing for FollowUp's context:

- **Cold/enterprise B2B outbound persistence:** the oft-cited Velocify/InsideSales analysis (same
  lineage as the response-time study, ~2,241 companies, ~100,000 leads) found an optimal cadence of
  roughly **6 call attempts interleaved with 5 emails**, contact rates up ~16% over less-structured
  cadences, and combined phone+email producing up to a **128% conversion gain** over either channel
  alone. **93% of leads that eventually convert are reached by the 6th call attempt**; leads needing
  7+ attempts are ~45% less likely to convert at all — a practical persistence ceiling.
- **Cold outbound / prospecting (unsolicited, not an inbound lead):** a different cluster of sources
  (`mailreach.co/blog/how-many-follow-ups-should-you-send-to-maximize-responses`,
  `saleshive.com/blog/batch-and-blast-the-frequency-of-email-cadence`) puts the ceiling much lower —
  **3 total touches** before spam complaints rise and engagement drops, because that context is cold
  strangers with no prior relationship.

**FollowUp's leads are inbound** (the lead contacted the business first, or was captured from a form
call, DM) — the closer analog is the first cluster (5-6+ touches, high persistence pays off), not
the second (cold-outreach 3-touch ceiling). This matters directly: FollowUp's own market/customer
research (not re-verified here, per instructions to ground in the actual codebase) treats FollowUp's
leads as warm inbound, so the product should lean toward the higher, escalating touch-count research,
not the conservative cold-outreach cap.

Separately and independently, **National Sales Executive Association data, cited consistently
across many sources (`ircsalessolutions.com`, `pipeline.zoominfo.com`, `martal.ca`,
`outsales.ai/blog/sales-follow-up-statistics`) but without a link back to a publicly-verifiable
primary methodology**, holds that **80% of sales require 5+ follow-up contacts**, yet **44% of
reps quit after one attempt, and 92% have disengaged by the 4th "no."** I flag this stat's
provenance as weaker than the Oldroyd/MIT numbers above — it is repeated everywhere but I could not
trace it to a citable original publication, only to other blogs citing "NSEA" with no link. Treat
directionally (more touches convert more, most humans under-persist) rather than as a precise 80%.

**Recommended shape, converging across sources:** an **escalating-gap cadence**, front-loaded then
widening — the recurring pattern across email-sequence guidance (`instantly.ai`,
`lifesciencemarketing.bitesizebio.com/email-sequence-template`, `30mpc.com`) is **Day 0/1, Day 3,
Day 7, Day 14, Day 21–30**, each touch changing the message angle (not "just checking in" repeated).
This is qualitatively the exact shape the research brief hypothesized and FollowUp does not
implement — FollowUp's current `triggerDays` is a single flat number that, after a send, simply
resets the same-length wait and repeats indefinitely, with no escalation, no touch-count ceiling,
and no change in message framing between the 1st and 10th automated follow-up to the same lead.

**Product implication:** `automation.ts`'s `runAutomationForBusiness` should stop being a single
repeating trigger and become the entry point into a **default multi-step cadence** — concretely,
reuse `sequences.ts`'s existing `Sequence`/`SequenceStep` engine (it already does exactly
"escalating delayDays, distinct action per step, auto-executed by the hourly cron") rather than
building parallel escalation logic inside `automation.ts`. See prioritized list, #1.

## 3. Reviving COLD/DEAD leads specifically — the biggest gap versus the stated mission

This is the area with the most real-estate-specific data, though nearly all of it is
**vendor-published** (companies selling reactivation services or AI reactivation tools:
`kyzo.ai`, `prestyj.com`, `agilux.net`, `dealmachineos.com`), so treat magnitudes as directional,
not precise — but multiple independent vendors converge on the same *range*, which is worth
something even though none of them publish raw methodology:

- **Reactivation rate on a dormant/dead database: consistently cited in the 5–15% range** across
  `kyzo.ai/blogs/reactivate-old-real-estate-leads-ai`, `prestyj.com/blog/lead-reactivation-statistics`,
  and `agilux.net/us/articles/performance-based-lead-reactivation-real-estate` — three independent
  vendors landing in the same band is meaningfully more trustworthy than any one of them alone.
- **A reactivated/dormant contact converts at 3–4x the rate of a freshly-purchased lead, and costs
  5–10x less** to reactivate than to acquire new (same three sources, consistent).
- **Effective reactivation campaigns run 7–12 touches over 30–60 days**, not one message — mixing
  channels (text, phone, market-update email) and content types (comps/market data, not "checking
  in"). `prestyj.com`'s mortgage-specific writeup independently corroborates the multi-touch,
  30-60-day framing for a different but adjacent vertical.
- **SMS specifically gets 15–30% response within 48 hours** on cold-database reactivation sends
  (same source cluster) — the single fastest-responding channel cited anywhere in this research.
- On messaging content: **"just checking in" / "circling back" is called out explicitly, by name,
  across real-estate-specific sources (`asksayso.com/blog/how-to-revive-dead-leads`,
  `asksayso.com/blog/what-to-say-to-old-leads`, `blog.getklosed.com/blog/what-to-text-a-cold-real-estate-lead`,
  `nurturebeast.com/blog/follow-up-texts-cold-leads`) as the thing NOT to send** — it signals
  nothing new to offer. What these sources converge on instead: **name a specific, real elapsed-time
  anchor** ("it's been about a year since we talked about X") rather than a vague "it's been a
  while," and **lead with a concrete, local, useful data point** (a market-value change, a comp, an
  inventory shift) rather than a sales pitch, with the acknowledgment of the silence kept to one
  sentence at most.
- A specific, more surprising data point worth flagging (single source, `prestyj.com`, not
  independently corroborated — hold with appropriate skepticism): **62% of contacts in a "dead"
  real-estate database reportedly hold 40%+ home equity**, i.e. a "dead" lead is very often still a
  qualified prospect, just one who went quiet — not someone who was never viable.

**Product implication — this is the one genuinely missing piece against `PRODUCT_DIRECTION.md`'s
explicit "rescuing cold, dead, or never-reached leads" goal:** today, a lead silent 6 days and a
lead silent 400 days hit the exact same `silent` query in `automation.ts` (`lastContacted: { lte:
cutoff }`), get the exact same `generateFollowUpMessage` call with no framing distinction, and (if
`stage` isn't manually moved to `LOST`) repeat that same generic follow-up forever at the same
interval. There is no "dead lead" concept anywhere in the schema (`PipelineStage` has no COLD/DEAD
value; the closest is the *business owner manually setting* `LOST`) and no distinct messaging
prompt for a lead that's been silent for months versus days. Given how much the research diverges
on *what to say* and *how often* between a few-days-silent lead and a months-silent one, this needs
to be a genuinely separate campaign type, not a longer `triggerDays` value on the same trigger — see
prioritized list, #2.

## 4. Multi-channel sequencing — real, if noisy, evidence it beats single-channel persistence

Every source found agrees on direction; they disagree sharply on magnitude, so treat the specific
percentages as "meaningfully better," not as precise lift numbers:

- `saleshive.com`, `mailshake.com`, and `instantly.ai/blog/multi-channel-outreach` each independently
  claim multi-channel (3+ channels) sequences outperform single-channel by roughly **2-3x reply
  rate**, with specific figures ranging from **128% higher** (phone+email combined vs. either alone)
  to **250-287% higher** (email+LinkedIn+phone vs. single-channel) depending on the source — a wide
  spread that suggests vendor-specific measurement, not one settled number.
- **SMS open rates (~98%) vs. email open rates (~20-22%)** is the most consistently-cited,
  best-corroborated individual fact in this whole research pass — it shows up identically across
  the multi-channel sources above and independently in the real-estate reactivation sources in §3.
- `revenue.io/blog/sales-cadence-12-metrics-every-outbound-team-should-track` gives a more grounded
  2026 benchmark: well-constructed multi-channel sequences land **12-18% reply rate**, vs. ~4% for
  email alone — a smaller, more credible-sounding gap than the 250%+ headline claims elsewhere, and
  probably the more trustworthy number of the group since it's framed as an absolute rate rather
  than a "%lift" that's easy to cherry-pick a favorable baseline for.

**Product implication:** FollowUp's automated sends are channel-locked in two places — 
`automation.ts`'s silence/unanswered path picks exactly one channel via `detectAutomatedReplyChannel`
and never varies it across repeated follow-ups to the same lead, and `sequences.ts`'s `EMAIL` step
action is hard-locked to email (`if (!lead.email) return { kind: "skipped" ... }` — it doesn't even
fall back to SMS for a lead with a phone but no email). Given SMS's much higher open rate and its
being the single fastest-responding channel in the reactivation data (§3), a sequence step (or the
dead-lead campaign in #2 below) that has tried email 1-2 times without a reply should be able to
switch to SMS on a later step when a phone number is on file, rather than silently repeating the
same channel or skipping entirely. See prioritized list, #4.

## 5. Timing patterns — real, but from one study lineage, and lower-priority to act on

The day-of-week/time-of-day findings all trace back to the same 2007 MIT/InsideSales behavioral
analysis referenced in §1 (`kixie.com`, `help.cincpro.com`, `thesherpagroup.com`,
`leadsatscale.com/insights/best-times-to-follow-up-with-b2b-leads`) — **not independently
replicated by a separate study**, so this is one dataset's finding repeated by many blogs, not
convergent evidence from multiple studies. With that caveat: **Wednesday and Thursday outperform
the worst days by ~49.7% on contact rate and ~24.9% on qualification rate; the 4-6pm window
outperforms the worst time block by ~114% on contact, with a reported ~109% qualification lift for
4-5pm specifically vs. 11am-noon.** A secondary, separately-cited finding from the same study
lineage: **the odds of making contact on a call drop >10x, and odds of qualifying drop >6x, within
just the first hour** of lead age — this is really a restatement of the response-time finding in
§1, not a new timing pattern.

**Product implication, deliberately ranked lowest of the five research areas:** this is call-center
data from 2007 (phone contact rates specifically), it is one study, and it's the least directly
applicable to FollowUp's actual channels (email/SMS/DM sends, not live dials). The one thing worth
building is cheap and low-risk regardless of how much weight the specific percentages deserve:
`runAutomationForBusiness` runs on an hourly cron with no time-of-day awareness, so an automated
follow-up drafted eligible at 3am local business time fires at 3am. A simple send-window gate
(defer automated sends generated outside roughly 8am-6pm business-local time to the next eligible
hour) is nearly free to build and avoids the obviously-bad case (a lead getting an automated text at
3am) regardless of whether the Wednesday/Thursday-specific lift replicates. See prioritized list, #5.

## 6. What established players already do — the market has already converged on tiered cadences

- **Follow Up Boss**: "Action Plans" — automated multi-step sequences assigned on lead creation,
  typically running **~21 days**, with named **cadence tiers keyed to lead temperature — "hot
  weekly, warm biweekly, cold monthly"** (`keetechnology.com/blog/follow-up-boss-vs-kvcore`,
  `followupace.com/blog/mastering-follow-up-boss-action-plans-automation-secrets-for-busy-agents`).
  "Smart Lists" segment the database by recency/behavior so a business can see and act on its cold
  tier specifically (`followupboss.com/features/smart-list`).
- **kvCORE**: drip campaigns whose "AI... analyzes lead behavioral data — property views, search
  frequency, price range adjustments, **days since last activity** — and adjusts campaign messaging
  and cadence accordingly" (`ustechautomations.com/resources/blog/follow-up-boss-vs-kvcore-2026`) —
  i.e., cadence and message content are explicitly a function of lead staleness, not a flat rule.
- **BoomTown**: same category of behavior-driven drip automation; third-party integrations
  (`help.callaction.co`) exist specifically to layer *additional* drip cadences on top of BoomTown's
  own, which is itself evidence the market treats a single flat cadence as insufficient.
- Buyer-sequence guidance across these tools converges on **running the sequence for the length of
  the buyer's stated search timeline (30-90 days) with reduced frequency after the first month** —
  the same escalating-then-widening shape as §2's research, not a flat repeating interval.

**Product implication:** none of the three named competitors run a single flat trigger the way
FollowUp's `automation.ts` does today — all three key cadence *and* message content off of lead
recency/temperature. FollowUp's actual differentiators per `PRODUCT_DIRECTION.md` (instant
acknowledgement, the trust-tiered `automationTier`/risk-check model, true full-autonomy) are real
advantages this research didn't find matched elsewhere — but cadence sophistication is exactly the
dimension where FollowUp is currently behind the category baseline, not ahead of it. This confirms
the commissioning complaint ("not quite impressive") was specifically about cadence, not about the
product's automation model as a whole.

---

## Prioritized product changes

Ranked by expected impact (against `PRODUCT_DIRECTION.md`'s goals) vs. build effort. Each is
specific enough to hand to a backend agent without re-deriving the reasoning above.

### 1. Replace the flat silence trigger with a default escalating cadence — HIGH impact, MEDIUM effort
Stop running `runAutomationForBusiness`'s `silent` branch as a single repeating `triggerDays` gate.
Instead, auto-enroll a lead into a **default `Sequence`** (reusing `sequences.ts`'s existing
`Sequence`/`SequenceStep`/`runSequencesForBusiness` engine, which already supports exactly what §2's
research calls for: ordered steps, per-step `delayDays`, auto-execution on the hourly cron, stop-on-reply)
the first time it goes silent past a short initial threshold (e.g. day 3), rather than requiring a
human to manually enroll it via `/workflows`. Seed every business with a default cadence on
signup — something like **Day 3 (light nudge), Day 7, Day 14, Day 30** — each `SequenceStep.messageHint`
distinct so the AI draft doesn't repeat the same angle four times. Businesses keep the ability to
edit/replace this default sequence the same way they edit any other. This also naturally retires the
single `triggerDays` Settings field (1-30 days) into "when does the default cadence start," rather
than "the one and only follow-up timing," and removes the current oddity where the same message
repeats verbatim, at the same interval, indefinitely.

### 2. Add a distinct "dead lead reactivation" campaign type — HIGH impact, MEDIUM effort
New trigger, cleanly separate from #1's cadence: a lead silent past a long threshold (default
**45-60 days**, configurable like `triggerDays` is today, 30-180 range) exits the normal cadence and
enters a dedicated reactivation campaign — 3-5 touches over ~30 days, per §3. Two concrete,
buildable pieces: (a) a distinct AI prompt/messageHint style enforced at the call site — explicit
elapsed-time anchor ("it's been about two months since we last talked about..."), a market-data or
new-listing hook instead of a status question, one sentence max acknowledging the gap, never "just
checking in" — literally pass a different system-prompt-shaping hint into `generateFollowUpMessage`
for this trigger than the one silence/unanswered sends use today; (b) track it as its own `trigger`
value (alongside the existing `"silence"` / `"unanswered"` / `"sequence"` values already threaded
through `sendFollowUpToLead`'s options and the audit log) so analytics can report a **reactivation
win rate** distinct from ordinary follow-up — directly gives the business owner the "leads rescued
from cold/dead" number `PRODUCT_DIRECTION.md` names as the actual mission, which nothing in the
product currently surfaces.

### 3. Shorten the unanswered-reply default specifically for a lead's first substantive reply — MEDIUM impact, LOW effort
`findUnansweredLeads` currently uses one `unansweredHours` value (default 24) for every lead
regardless of conversation history. Per §1, the qualification-odds falloff is steepest in the first
hours after a lead's *first* real message — not equivalent to hour 24 of an established back-and-forth
going quiet. Add a second, shorter default (e.g. **2-4 hours**) that applies specifically when the
lead has no prior outbound *substantive* message (i.e. only the instant-ack template has gone out, or
nothing has), falling back to the existing 24h default once a real conversation is underway. This is
a query-level branch inside `findUnansweredLeads`, not a new subsystem — cheap relative to its impact
on exactly the highest-value, most time-sensitive leads (brand new, engaged, first message still
unanswered).

### 4. Channel-switching within sequences — MEDIUM impact, MEDIUM effort
Add an optional per-`SequenceStep` channel (or an "auto" mode: try the lead's most-recently-used
channel first, fall back to SMS on a later step if a phone number exists and earlier email steps got
no reply) instead of `sequences.ts`'s current hard-coded `EMAIL`-only action that skips leads with no
email address outright. Given §4's consistent (if noisy) finding that channel-mixing outperforms
single-channel persistence, and SMS's much higher open rate specifically, this is most valuable
wired into the new dead-lead reactivation campaign (#2) first — a lead that's gone cold on email is
exactly the case where trying SMS on touch 2 or 3 (per §3's 15-30%-response-within-48-hours SMS
reactivation data) has the most obvious upside.

### 5. Send-window gating for automated sends — LOW impact, LOW effort
Add a business-hours check to the point where `runAutomationForBusiness`/`runSequencesForBusiness`
actually call `sendFollowUpToLead` — defer an automated send that becomes eligible outside roughly
8am-6pm business-local time to the next in-window cron tick, rather than firing the instant the
hourly cron finds it eligible. Ranked lowest because the specific day/time lift numbers in §5 trace
to one 2007 phone-contact study not directly analogous to FollowUp's channels — but the fix itself
is cheap (a time-of-day guard, not new logic) and avoids the clearly-bad case of an automated text or
email going out at 3am regardless of how much the specific Wednesday/Thursday numbers hold up.

---

## Sources checked

Response-time / qualification-odds research (§1, §5):
- https://www.leadangel.com/blog/operations/lead-response-time/
- https://www.insidesales.com/response-time-matters/
- https://ainora.lt/blog/lead-response-time-5-minutes-study-2026
- https://ainora.lt/blog/lead-response-time-statistics-every-study-2026
- https://greetnow.com/blog/lead-response-time-statistics
- https://caseyresponse.com/blog/lead-response-time-statistics
- https://www.onecavo.com/wp-content/uploads/2015/11/MIT-InsideSales.com_Lead-Response-Management.pdf (identified via search; egress-blocked, not directly fetched)
- https://content.marketingsherpa.com/heap/DG07SFSlides/LeadResponseManagementReport.pdf (identified via search; egress-blocked, not directly fetched)
- https://www.leadresponsemanagement.org/lrm_study/
- https://help.cincpro.com/s/article/Best-Practices-for-Lead-Response-Management-MIT-Study
- https://www.kixie.com/sales-blog/heres-the-best-schedule-for-lead-follow-up/
- https://leadsatscale.com/insights/best-times-to-follow-up-with-b2b-leads
- https://www.thesherpagroup.com/blog/the-optimum-time-to-follow-up-leads
- https://www.workato.com/the-connector/lead-response-time-study/ (RevenueHero 29-hour figure)
- https://blog.salescaptain.com/average-lead-response-time-statistics-for-small-business-2026/
- https://outsales.ai/blog/lead-response-time-statistics

Cadence / touch-count research (§2):
- https://www.cirrusinsight.com/blog/sales-follow-up-statistics
- https://pipeline.zoominfo.com/sales/sales-follow-up-statistics
- https://qwilr.com/blog/sales-follow-up-statistics/
- https://ircsalessolutions.com/insights/sales-follow-up-statistics/
- https://martal.ca/sales-follow-up-statistics-lb/
- https://outsales.ai/blog/sales-follow-up-statistics
- https://leadsatscale.com/insights/why-follow-up-frequency-matters-in-sales
- https://leadsatscale.com/insights/how-often-to-follow-up-on-b2b-leads/
- https://growthlist.co/sales-follow-up-statistics/
- https://www.mailreach.co/blog/how-many-follow-ups-should-you-send-to-maximize-responses
- https://saleshive.com/blog/batch-and-blast-the-frequency-of-email-cadence/
- https://www.mailreach.co/blog/email-frequency-best-practices
- https://customer.io/learn/personalization/message-frequency-caps
- https://instantly.ai/blog/how-to-follow-up-on-a-business-proposal-email-sequence-strategy-and-timing/
- https://lifesciencemarketing.bitesizebio.com/email-sequence-template/
- https://www.30mpc.com/newsletter/the-perfect-outbound-sequence-template

Cold/dead lead reactivation research (§3), real-estate-specific:
- https://kyzo.ai/blogs/reactivate-old-real-estate-leads-ai
- https://prestyj.com/blog/lead-reactivation-statistics
- https://prestyj.com/blog/database-reactivation-campaign-roi-mortgage-companies-2026
- https://agilux.net/us/articles/performance-based-lead-reactivation-real-estate/
- https://www.dealmachineos.com/real-estate-lead-generation-statistics-2026
- https://www.jamilacademy.com/blog/real-estate-lead-conversion-rate-benchmarks
- https://www.ylopo.com/lead-reactivation-crm
- https://happygrasshopper.com/real-estate-database-reactivation/
- https://blog.getklosed.com/blog/what-to-text-a-cold-real-estate-lead/
- https://theclose.com/real-estate-text-message-scripts/
- https://www.asksayso.com/blog/how-to-revive-dead-leads/
- https://www.asksayso.com/blog/what-to-say-to-old-leads/
- https://nurturebeast.com/blog/follow-up-texts-cold-leads/
- https://brokercanvas.com/blog/stale-lead-reactivation-ai-real-estate
- https://www.realgeeks.com/blog/how-much-do-real-estate-leads-convert
- https://suresend.ai/l/real-estate-lead-conversion-rate
- https://www.pinova.in/blog/why-70-percent-real-estate-leads-lost
- https://callaction.co/blog/3-critical-takeaways-new-nar-study-digital-real-estate-search/
- https://agentzap.ai/blog/real-estate-lead-statistics
- https://conversionrealtor.com/real-estate-conversion-statistics-2026

Multi-channel sequencing research (§4):
- https://www.revenue.io/blog/sales-cadence-12-metrics-every-outbound-team-should-track
- https://instantly.ai/blog/how-to-combine-email-text-sales/
- https://mailshake.com/blog/multi-channel-sales-sequences-the-essential-guide/
- https://belkins.io/blog/sales-follow-up-statistics
- https://instantly.ai/blog/multi-channel-outreach/
- https://saleshive.com/blog/outreach-channels-effective-sales-prospecting
- https://profitoutreach.app/blog/sales-follow-up-statistics/

Competitive comparison research (§6):
- https://help.callaction.co/en/articles/1232588-automate-your-boomtown-real-estate-lead-follow-up-with-callaction-drip-campaigns
- https://www.followupboss.com/blog/follow-up-sequences-for-each-lead-type
- https://www.followupboss.com/blog/real-estate-action-plan
- https://www.followupboss.com/features/smart-list
- https://keetechnology.com/blog/follow-up-boss-vs-kvcore
- https://www.kdsdevelopment.net/articles/follow-up-boss-vs-kvcore-agent-crm-showdown
- https://softabase.com/compare/follow-up-boss-vs-kvcore
- https://ustechautomations.com/resources/blog/follow-up-boss-vs-kvcore-2026
- https://ustechautomations.com/resources/blog/automate-buyer-follow-up-real-estate-2026
- https://ustechautomations.com/resources/blog/follow-up-boss-vs-kvcore-real-estate-2026
- https://ustechautomations.com/resources/blog/kvcore-vs-boomtown-for-real-estate-agents-2026
- https://followupace.com/blog/mastering-follow-up-boss-action-plans-automation-secrets-for-busy-agents
- https://followupace.com/blog/from-lead-to-listing-a-5-step-ace-ai-action-plan-recipe-that-doubles-speed-to-contact

Codebase files read to ground this research (not web sources): `src/lib/automation.ts`,
`src/lib/sequences.ts`, `src/lib/acknowledge.ts`, `src/app/api/automation/settings/route.ts`,
`prisma/schema.prisma` (Lead/Sequence/SequenceStep/PipelineStage/AutomationTier), `PRODUCT_DIRECTION.md`.
