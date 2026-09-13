# Usability and engagement: why this ICP opens FollowUp, trusts it at a glance, and keeps coming back

**Date:** 2026-09-13
**Author:** product-narrative-agent
**Scope:** What makes a tool like FollowUp effortless for a solo agent / small-team owner
(realtor, contractor, local-service business — phone-first, busy, often between jobs or
on-site) to start using and, separately, to *keep* using — first-five-minutes onboarding and
ongoing daily/weekly habit. This is a research pass, not a design or code change: nothing
under `src/` was modified, no screen was redesigned.

## What already exists — read first, not duplicated here

- `followup/research/product/2026-09-10-ux-simplification.md` — the closest prior work, and
  large (62KB). It already did the code-inventory pass (41 concepts, 12 settings sections, 7
  nav items, no approval queue) and already proposed a concrete first-onboarding fix (a
  three-step flow ending in a real "here's what FollowUp already did for you" proof screen,
  §3) with real sourcing on progressive disclosure, plain language, empty states, and
  time-to-first-value (its §9, Grades A-D). **I do not re-derive any of that here** — where
  this file needs it, it's cited by reference, not repeated. What that file does *not* cover
  in depth is the second half of this brief: **ongoing habit** — why someone opens the
  product on day 20, not day 2, and what specifically causes a week-2 or week-4 abandonment.
  That gap is this file's actual contribution.
- `design-brain/research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`
  — six design-facing findings from the ICP/trust research, several directly relevant here
  (Finding 3: mobile-first, phone-first; Finding 4: push-not-pull, calm all-clear as a
  first-class state; Finding 5: complexity is the category's failure mode). Extended, not
  repeated, in the abandonment section below.
- `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md` — the 65.5%
  "AI makes my business feel less authentic" and 77% "want human approval" figures. Treated
  here as already-established at the same medium confidence the design brain already caps
  them at; not re-searched.
- `design-brain/brand/brand-principles.md` and `design-brain/decisions/rejected.md` — read in
  full before writing a single recommendation below. Principle 2 (calm over urgent) and
  principle 3 (AI is invisible capability, never personality) rule out an entire category of
  conventional "engagement" tactics before external research even starts — see the
  "inadmissible by design" section, which exists precisely because those tactics are the
  first thing a generic growth-hacking search returns.

## Sourcing caveat — carry this wherever these findings go

**WebFetch is blocked network-wide in this sandbox**, confirmed again this session: a direct
fetch of `pmc.ncbi.nlm.nih.gov` (one of the stronger sources below) returned `EGRESS_BLOCKED`.
**WebSearch worked** and is the source of everything below. Every citation is therefore a
search-result synopsis, not a page I fetched and read in full — the same limitation every
prior research pass in this repo has hit and flagged. Confidence is graded per finding using
the letter scale `2026-09-10-ux-simplification.md` §9 already established for this exact
folder (Grade A/B/C/D), so this file is consistent with its neighbor rather than inventing a
new scale. **No figure below may be quoted on a landing page, in a sales deck, or as a
verified statistic without a direct fetch first** — several of them are contradicted by other
sources in the same search results, which is disclosed inline where it happened.

---

## Part 1 — First-time ease (first five minutes)

This is deliberately short: `2026-09-10-ux-simplification.md` §3 already did the real work
(three-step onboarding ending in a proof screen, a seeded "send a test lead to myself" action,
an honest non-empty empty state). Two things worth adding to that existing plan, not replacing
it:

**Finding 1.1 — Missing the first real value moment in the first week has a large,
consistently-reported effect on later retention, even though the specific numbers disagree
with each other.** Multiple onboarding-industry sources (userintuition.ai, saasfactor.co, a
Medium SaaS-positioning piece) converge on the same shape: users who engage with a product's
core feature in the first 7 days retain at roughly 3x the rate at day 30 of those who don't,
and missing that first-value milestone inside 7 days is associated with a large (~40%+)
increase in 90-day churn. **[Grade D — every number came from content-marketing/SEO-roundup
sources with no primary study named, and the specific multipliers (3.2x, 43%) are not
independently verifiable from these snippets; do not cite the numbers anywhere customer-facing.
The *direction* — early real value predicts retention, this isn't a graph that recovers later —
is consistent with the higher-confidence Lenny's Newsletter activation-milestone framing already
cited at Grade B in the sister file, so treat this as corroborating, not new, evidence for the
direction only.]** **Implication:** this is one more reason the sister file's proof-screen fix
(§3) should be treated as the single highest-priority open item in the product, ahead of any
habit/retention work in Part 2 below — a user who never sees the first real save has no habit to
form regardless of what Part 2 recommends.

**Finding 1.2 — The best-documented "high-touch onboarding drives activation" case study is
structurally inapplicable to FollowUp's pricing, which is itself informative.** Superhuman's
onboarding is extensively documented (Gainsight, Reforge/Growthmates, Iterators, Brian Balfour)
as a 1-on-1, ~28-minute concierge call for every new signup, run personally by early team
members, used both to teach the product and to gather PMF-survey data. **[Grade B for the fact
pattern itself — the practice and its mechanics are described consistently across several
independent, named sources, not a single vendor blog.]** FollowUp is a flat $29/mo,
no-seats product; a concierge onboarding call is not a lever available at that price point (the
economics that make FollowUp's flat pricing a real differentiator against Follow Up
Boss/HubSpot's seat ladders — see `research/customers/2026-09-05-icp-pain-and-trust-objections.md`
§4 — are the same economics that rule this out). **Implication, not a contradiction of the
sister file's plan but a reason to hold the line on it:** the proof screen and seeded test-lead
action already proposed are the *self-serve substitute* for a concierge call — they exist to do,
automatically, in the product, what Superhuman's call does with a human. That's the right target
to hold the design to: does the proof screen make the owner feel what a 28-minute personal
walkthrough would have made them feel? If not, it's under-built, not just "good enough for
self-serve."

---

## Part 2 — Ongoing habit: why open this today, and what causes week-2 abandonment

This is the actual gap in existing research and the bulk of this file's contribution.

### 2.1 What makes someone keep opening a tool like this — the honest version of the loop

The standard framework here is Nir Eyal's **Hook Model** (*Hooked: How to Build Habit-Forming
Products*, 2014): Trigger → Action → Variable Reward → Investment, where each cycle makes the
next one more likely. **[Grade B for the model's existence and description — independently and
consistently described across Dovetail, Amplitude, ProductPlan, Mindtools, and Growth Method,
which is more independent corroboration than most findings in this file get; I have not read the
book itself, only secondary descriptions of it.]**

**This model needs to be used carefully here, not adopted wholesale — and saying so explicitly
matters, because a generic "how do we make users habitual" search converges on this framework
immediately, and its most common implementations are exactly what FollowUp's own brand
principles already rule out.** Two of its four stages are where that risk lives:

- **"Variable reward"** is the stage most often implemented as manufactured unpredictability —
  streaks, near-miss mechanics, unpredictable point payouts, anything that manufactures
  anticipation rather than delivering real information. That is a direct hit against brand
  principle 2 (*calm over urgent*) and principle 7 (*never design the spam tool*) before any
  external evidence is even needed. See 2.3 below for direct evidence that this specific
  category backfires for exactly FollowUp's audience (professional, B2B, not consumer).
- **"Investment"** is often implemented as artificial sunk cost (streak length, cosmetic
  customization, social graph lock-in) rather than real value accumulated. FollowUp already has
  a legitimate, non-manufactured version of this available and mostly unused as a *retention*
  lever — see 2.4.

**Used honestly, the four stages map onto FollowUp's real mechanics like this, and this mapping
is the useful part of the model for this product — not the mechanics of implementing it as a
consumer app would:**

| Stage | Manufactured version (rejected) | FollowUp's honest equivalent |
|---|---|---|
| Trigger | Push notification pinging for its own sake; a badge that exists to be cleared | A real lead going silent, replying, or needing an OK — an event that would matter to the owner even if FollowUp didn't exist to tell them about it |
| Action | Whatever's shortest, regardless of whether it's the right one | One tap: approve, or read the one thing that needs a human judgment |
| Variable reward | Points, streak counters, unpredictable praise | A real business outcome stated plainly: a lead replied, a deal moved, a lead that looked dead came back |
| Investment | Cosmetic customization, streak length, social lock-in | Real lead history, tuned automation rules, and (per 2.4) a demonstrated accuracy track record specific to this business — genuine switching cost, not psychological manipulation |

### 2.2 The five most-cited abandonment modes for this category, evidence-graded

Synthesized from this session's searches plus what the repo already has on file. These are the
concrete answer to "what makes someone abandon a tool like this after week 2":

**Mode A — "I never saw it actually do anything for me."** Already covered as Finding 1.1/the
sister file's core argument. The single most consequential failure mode, and it happens before
week 2, not during it — everything after this point assumes it didn't happen.

**Mode B — "It became one more inbox, and checking it depended on me remembering to."** A
recurring theme across generic CRM-adoption content: *"information sits one login away from the
person who needs it... checking it depends on someone remembering to check it"* (nbh.co, a CRM
problems piece) and *"sales teams stop logging... the single source of truth fragments"*
(digitalnexa.com). **[Grade D — content-marketing sources, no primary study, but the mechanism
described is specific and plausible rather than a vague "CRMs are hard" complaint, and it
directly reinforces the design brain's own already-established Finding 4 (push, not pull) at
medium confidence — treat this as corroborating that finding, not adding new confidence to it.]**
**This is precisely the failure mode FollowUp's push-model dashboard already exists to avoid in
principle** — but see Mode F below for why the *channel* the push arrives on matters as much as
the fact that it's a push at all.

**Mode C — "The alerts trained me to stop looking."** Two convergent bodies of evidence:
1. Badge/notification research: overuse of unread-count badges creates measurable avoidance —
   users learn to dismiss or ignore rather than act, and notification fatigue leads to disabling
   notifications outright or building "negative associations with the brand." **[Grade C — a
   real peer-reviewed-adjacent paper surfaced (ResearchGate, "Driven by notifications — exploring
   the effects of badge notifications on user experience"), corroborated by several independent
   secondary write-ups (Braze, a UX-focused Medium piece, a coaching blog citing the Zeigarnik
   effect); I have not read the underlying paper directly.]**
2. A structurally different but well-documented analogous phenomenon from a different domain:
   **alert fatigue** in security operations, where a high volume of low-precision alerts causes
   analysts to systematically miss, delay, or ignore genuine ones — with real, cited consequences
   (Vectra AI's figure that 63% of security alerts go unaddressed; the 2013 Target breach is
   commonly cited as a case where real warnings were ignored amid alert volume). **[Grade B for
   the phenomenon within its own domain — this is a well-established, widely-documented
   cybersecurity finding, not a marketing claim. Grade D as applied to FollowUp by analogy — a
   different domain, cited here as a structurally similar mechanism (volume + low precision
   causes disengagement), not as direct evidence about SMB SaaS behavior.]**

**Combined implication:** this cuts directly against a natural instinct to make the "needs your
OK" queue *more* visible by making it *louder*. The lesson from both bodies of evidence is the
same: what preserves attention is a small, high-precision signal, not a bigger or brighter one. A
badge or queue that includes items the owner doesn't actually need to act on trains exactly the
ignoring behavior the product is trying to prevent. This is also a second, independent argument
(beyond the IA argument already in the sister file) for why the missing approval queue
(`2026-09-10-ux-simplification.md` §0.6) needs to launch narrow and correct before it launches
complete — a queue padded with "FYI" items to feel more full is actively counterproductive here.

**Mode D — "It got something wrong once, unsupervised, and I stopped trusting it."** Not new
research — already established in this repo at medium confidence (the 65.5%/79%
authenticity-fear figures, `2026-09-05-icp-pain-and-trust-objections.md`) — but worth restating
in this file's frame specifically: for *this* fear, a single bad autonomous action is a
plausible week-2-or-later abandonment trigger on its own, disproportionate to how rarely it
happens, because the fear it confirms ("this makes my business look fake/wrong to a real
customer") is specific and already-primed, not generic skepticism that erodes slowly. This
argues for treating any real send-quality regression as a trust event requiring visible,
honest disclosure to the affected owner — not a silently-patched bug — because a business owner
who later discovers a bad message went out *and wasn't told* has a stronger reason to leave than
one who was told and saw it caught.

**Mode E — "It never got easier or better — approving drafts forever felt like the job never
actually left my hands."** This is the newest finding in this pass and ties directly to
`PRODUCT_DIRECTION.md` Rule 5 (design for rising autonomy, not fixed human-in-the-loop).
Human-automation trust research (a real academic field — hits included a PMC article on
calibrating workers' trust in automated systems, a Frontiers in Robotics and AI paper on
adaptive trust calibration, and an arXiv paper on transparency and reliance) converges on:
reliance on automation increases measurably as the automation demonstrates reliability, and
**transparency about confidence/reasoning is what lets that increase in reliance be
appropriately calibrated rather than either under- or over-trusting.** One search snippet cited
a specific effect size (reliance increasing roughly 13-15 percentage points as reliability was
demonstrated over repeated trials). **[Grade C — real academic sources (PMC, Frontiers, arXiv)
rather than marketing content, which is stronger sourcing than most of this file, but I have
only search-snippet access, not the papers themselves, and the specific effect size is from one
study's specific task, not a general SaaS-trust number — do not generalize the percentage.]**
**Implication:** the honest "investment" stage of the loop (2.1's table) is under-used today.
FollowUp already tracks the evidence this would need (`LeadTrustPanel`'s AI activity log, per
the sister file's inventory) but doesn't appear to surface it back to the owner as a *reason to
extend more autonomy*. A product that stays at "review every draft forever" past the point where
its accuracy has been demonstrated is asking the owner to keep doing manual work the product has
already earned the right to skip — which is a plausible, distinct reason someone concludes
"this isn't actually saving me time" and drifts back to checking their inbox manually. This is
squarely a Rule 5 opportunity, not a Rule 4 (table-stakes) one — no generalist CRM has a reason
to build a trust-earned-over-time autonomy ladder tied to a visible track record, because their
business model depends on there being a human seat to keep selling to (the same point
`PRODUCT_DIRECTION.md` already makes about Rule 1).

**Mode F — "The alert came where I wasn't looking."** Widely repeated marketing claims (SMS
platforms' own sites: "read within 3 minutes 90% of the time," "98% open rate") are not
trustworthy as numbers — vendor-published, no primary study, mutually reinforcing rather than
independent. **[Grade D on every number in this specific finding — do not cite any of them.]**
But the *direction* — that a busy, mobile, between-jobs operator is more reliably reached by SMS
than by an email digest or an in-app badge they have to remember to open — is not new to this
file; it's the same ICP behavior the repo already has higher-confidence, repo-internal evidence
for (the ServiceTitan missed-call/voicemail data already cited at stronger sourcing in
`2026-09-05-icp-pain-and-trust-objections.md` Finding 1, and Finding 3 of the design-brain
ux-patterns file). Read together with the fact that FollowUp's current owner-facing signals
appear to be a weekly email digest (`src/app/api/cron/weekly-digest/route.ts`) and in-app
`Notification` rows, this is worth a direct question rather than an assumption: **is the
highest-leverage daily/re-open trigger for this ICP actually arriving on a channel they check
during a workday, or only on a channel (email) they check at a desk?** I did not audit every
notification path in this pass (out of scope — research only), so this is flagged as an open
question for whoever owns that code, not a verified gap.

### 2.3 Inadmissible by design — ruled out before proposing, not after

Stating this explicitly so a future session doesn't re-propose it in different clothing, per
`design-brain/decisions/rejected.md`'s own stated purpose (nothing below is yet a formal
rejected-decisions entry — that file is empty of founder-rejected items as of this pass — but
these are ruled out by the *standing* brand principles already in force, S-01 through S-16, plus
principles 2, 3, and 7):

- **Streaks, daily-login rewards, points, badges-as-achievement, leaderboards.** Beyond the
  standing brand-principle conflict, there's now direct external evidence this specific category
  backfires for exactly this audience: *"if a product is genuinely needed twice a week, a streak
  punishes correct usage and generates guilt for behavior that was never a problem"* and
  *"loud arcade-style mechanics for a professional B2B audience is a common error"* (The Decision
  Lab's "Streak Creep," Trophy's B2B gamification pieces). **[Grade B-C — thedecisionlab.com is a
  behavioral-science-adjacent publication, not a marketing blog; the vendor sources (Trophy,
  Kompassify) converge with it independently.]** A business owner whose actual job is closing
  real deals does not need FollowUp manufacturing guilt about a broken streak — this would read
  as exactly the "startup template" / "AI gimmick" aesthetic already banned by S-13 and S-15.
- **Manufactured urgency of any kind** ("3 hot leads waiting!", flashing counts, artificial
  scarcity language). Already banned by brand principle 2 directly; the badge-avoidance research
  in Mode C adds an evidence-based reason it would also just fail on its own terms, not only
  violate the brand.
- **A visible "AI" persona, name, or avatar celebrating a win** ("Congrats, you and FollowUp AI
  closed 3 deals this week! 🎉"). Banned by principle 3 and S-13; also in direct tension with the
  65.5%-authenticity-fear finding already on file — a chipper AI-personality congratulating the
  owner is the opposite of what a business owner worried about "feeling less authentic" wants to
  see.

### 2.4 What "opens it today" should actually mean for FollowUp, restated as the target

Not a redesign — a statement of what the habit loop should be optimizing for, for the next
design pass to hold itself to:

The owner should open FollowUp because **a specific, true thing changed that they'd want to know
about even without the product** (a lead they'd forgotten replied; something needs their
judgment; a lead that looked gone came back) — arriving on a channel they actually check
mid-workday — and every time they open it for that reason, they should leave either having taken
one clear action or having received an honest, stated "checked, nothing needs you right now."
Over weeks, the product should be able to show them, truthfully, that it has gotten more of the
"needs your OK" calls right than it used to, and use that as the actual, non-manufactured reason
to invite more autonomy — not a bigger dashboard, not more stats, not a friendlier mascot.

---

## Prioritized recommendations

Framed as problem + principle, per the brief — not mockups or copy. Ordered by estimated impact
on the ongoing-habit question specifically (first-time-ease fixes are already prioritized in the
sister file and not re-ranked here).

1. **Ship the sister file's proof-screen onboarding fix before anything in this file.** Nothing
   below matters if the owner never sees a real first value moment (Mode A / Finding 1.1). Serves
   the mission statement directly (`PRODUCT_DIRECTION.md`'s point 1) and Rule 6 is moot until this
   ships — it's the precondition for everything else being worth building.

2. **Verify, and if needed fix, which channel the "needs your OK now" signal actually arrives
   on for this ICP.** If it's email/in-app only today, that's a plausible reason daily engagement
   underperforms regardless of how good the product is once opened (Mode F). This serves brand
   principle 4 (the user is busy, not at a desk) and is a concrete, checkable question, not a
   guess — flagged as needing a code check by whoever owns notification delivery, since this
   pass didn't audit every path.

3. **Keep the approval queue small and high-precision by construction, not by later tuning.**
   Every item in it should be something that genuinely needs a human judgment call, never
   padded with FYI-only items to look more complete (Mode C, both the badge-avoidance and the
   alert-fatigue evidence). Serves brand principle 2 (calm over urgent) and directly protects the
   approval-first design (Rule 3) from training the exact rubber-stamping/ignoring behavior it
   exists to prevent.

4. **Make "checked, nothing needs you" a stated, timestamped message every time it's true — never
   an empty screen.** This sharpens the design brain's existing "calm all-clear is a first-class
   state" finding with a reason drawn from this pass: total silence and notification overload
   produce correlated anxiety in the badge research (Mode C) — the fix for both is a truthful,
   present-tense statement of status, not the absence of one. Serves brand principle 2 and
   directly addresses "is this thing even working," a documented top reason SMB software gets
   abandoned during the trial period, not at renewal.

5. **Build a visible, honest "track record" signal tied to real per-business accuracy, and use
   it to invite specific leads/sources into Autonomous — don't leave the autonomy ceiling static.**
   This is Mode E and is the one recommendation in this file that is genuinely new relative to
   both the sister onboarding file and the existing design-brain research, and it maps directly
   to `PRODUCT_DIRECTION.md` Rule 5 (moat, not table stakes — a generalist CRM has no reason to
   build this). Concretely: the data already exists (`LeadTrustPanel`'s AI activity log per the
   sister file's inventory); what's missing is turning it into a periodic, honest prompt rather
   than a log nobody opens.

6. **Rule out gamification mechanics explicitly, in writing, before any future engagement-focused
   design pass proposes them.** Not because they were proposed and rejected here (they weren't
   proposed by anyone this session) — because a generic "how do we drive habitual use" research
   pass reliably surfaces them first, and this file exists partly so the next session doesn't
   have to re-run this same research to rule them back out. Serves brand principles 2, 3, and 7
   directly; §2.3 above is written to be citable as the reasoning if this needs a fuller
   rejected.md entry once a founder is asked to confirm it as a standing rule rather than an
   inferred one.

7. **Treat any real automated-send quality miss as a disclosed trust event to the affected owner,
   not a silent fix.** Mode D. Serves brand principle 1 (trust is the product) directly — the
   research suggests the cost of being caught having hidden a mistake is higher than the cost of
   the mistake itself, for this specific, primed fear.

---

## What this does not answer

- **Nothing here comes from an actual FollowUp user's behavior** — no product analytics on
  actual open rates, actual week-2 retention, or actual notification-channel performance were
  available to this pass (the sister file already flagged the same absence for `/workflows` and
  `/analytics` usage). Every finding above is category-level or drawn from adjacent/analogous
  domains (cybersecurity alert fatigue, human-automation trust literature). This file argues for
  *directions*, not for specific numeric targets.
- **The notification-channel question in recommendation 2 is a question, not a verified
  finding** — this pass did not audit `src/lib` notification-delivery code exhaustively (out of
  scope for a research-only pass); it's flagged for whoever owns that code to check.
- **No FollowUp-specific or even ICP-specific (realtor/contractor) forum quote about abandoning
  a lead-management tool specifically for habit/engagement reasons (as opposed to price or setup
  burden, both already covered elsewhere) turned up in this pass.** The 2026-09-05 customer
  research found strong pricing- and setup-complaint quotes; this pass looked specifically for
  "I stopped opening it" language and did not find a citable one. Worth a direct interview with
  an actual early customer if one exists, rather than more secondary search.
- **The Hook Model itself was not read from source** — only secondary descriptions of Eyal's book
  were consulted. Treat the four-stage structure as reliably described, not as independently
  verified against the primary text.

## Sources checked 2026-09-13 (WebSearch only; WebFetch confirmed blocked)

- Onboarding/churn direction: stripe.com, onboard.io, cloudshare.com, brightscout.com,
  saasceo.com
- Activation-window figures (Grade D): userintuition.ai, saasfactor.co, a Medium SaaS-positioning
  post, mixpanel.com, june.so
- Hook Model (Grade B for description): dovetail.com, amplitude.com, productplan.com,
  mindtools.com, growthmethod.com
- Superhuman onboarding (Grade B): gainsight.com, howtheygrow.co, growthmates.news,
  iteratorshq.com, brianbalfour.com
- Notification fatigue (Grade C-D): courier.com, magicbell.com, clutch.co
- Badge/red-dot psychology (Grade C): a ResearchGate paper abstract ("Driven by notifications"),
  braze.com, tonypiper.coach, several independent Medium pieces
- Alert fatigue in security operations (Grade B in-domain, D by analogy): vectra.ai, wiz.io,
  paloaltonetworks.com, splunk.com
- Gamification backfire in B2B (Grade B-C): thedecisionlab.com, trophy.so, kompassify.com
- Trust calibration in human-automation research (Grade C): search results citing a PMC article,
  a Frontiers in Robotics and AI article, and an arXiv paper — none fetched, snippet only
- SMS vs. app-notification preference (Grade D): mobile-text-alerts.com and other SMS-vendor
  sites
- CRM adoption/checking-depends-on-remembering (Grade D): nbh.co, digitalnexa.com

Internal, read in full:
- `followup/PRODUCT_DIRECTION.md`
- `followup/research/product/2026-09-10-ux-simplification.md`
- `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md`
- `followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`
- `design-brain/README.md`, `design-brain/brand/brand-principles.md`,
  `design-brain/decisions/rejected.md`,
  `design-brain/research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`,
  `design-brain/research/research-log.md`
