# Amplitude: define the first value moment, then measure activation and drop-off

**Date:** 2026-09-26 · **Asked by:** Sahil · **Status:** STUDIED, proposals pending approval

**Question:** How does Amplitude define and measure activation (the "aha" or first-value moment, the funnel, time to
value, drop-off)? What is FollowUp's first value moment, and how should we measure who reaches it and where people
stop?

This builds on `2026-09-25-site-to-first-value-benchmark.md`, which covers the *path* to first value (sign-in,
consent, the first screens). This study is about *defining* the moment and *measuring* it. Sources are Amplitude's own
pages (listed at the end). These are principles only.

---

## What Amplitude teaches

- **The aha moment is a behaviour, not a feeling.** It's "the minimal set of actions that reliably indicate value",
  written down as a trigger event, a core metric, supporting signals, and a **time window**.
- **Activation rate** is the share of new users who reach that moment inside the window. Amplitude calls early
  activation "the only reliable predictor of long-term retention".
- **A funnel with timestamps.** Each step is an event. The chart names the **largest drop-off step** and the **slowest
  step** (the longest median time to the next one).
- **Time to value** is measured as a **median**, not an average, because a few slow users drag an average around.
- **Critical events:** pick 5–10 that matter and track them the same way every time. Don't measure everything.
- **The 7% day-7 rule:** a cohort where 7% come back on day 7 is top-quartile for activation. The number matters less
  than the idea: **check who comes back a week later**, because that's what predicts who stays.

### The principles underneath

- **P1:** Write the first value moment as one sentence and one event. Everyone uses the same one.
- **P2:** Measure the steps to it with dates. Find the step where people stop, and the step where they wait.
- **P3:** Medians, small numbers, and names. At ten testers, "Priya's business is stuck at connect, 3 days" beats any
  chart.
- **P4:** Week-2 return is the real test. Value that doesn't bring someone back wasn't value.
- **P5:** Track a few critical events from data you already have. No new tracking for its own sake.

---

## Where FollowUp stands (checked in main, 2026-09-26)

**What /admin shows today:** a tester funnel of Added → Signed in → Inbox connected → First lead
(`src/lib/admin-data.ts`).

**What's missing:**
1. **The funnel stops at capture.** "First lead" means FollowUp *saw* a customer. It doesn't mean the owner got value.
   Nothing measures the moment that matters: **a customer got a reply FollowUp wrote.**
2. **"Connected" means Gmail or Outlook only.** A tester who connected only Instagram or WhatsApp looks stuck when
   they aren't.
3. **No dates, so no time to value.** We can't see how long anyone took, which step is slowest, or who has been stuck
   for days.
4. **No week-2 return.** There's no way to tell a tester who tried it once from one who keeps using it.
5. **The owner never sees their own first value moment named.** The first reply they send through FollowUp goes by
   like any other.

**Every event we need already exists in the database** (no new tracking):

| Step | Where it's recorded |
|---|---|
| Invited | `AccessRequest` approved |
| Signed in | `SignIn` rows (#338) |
| Source connected | `integration.*.connect` audit events |
| First customer captured | `Lead.createdAt` |
| First reply ready | the first `ai.hold`, or an automated `FollowUp` |
| **First reply sent (first value)** | the first sent `FollowUp` with a rule trigger, or a manual send of a held draft |
| Customer answered | an inbound message after that send |
| Back in week 2 | any sign-in or send 7–14 days after first value |

---

## Proposals (ranked)

1. **Name the first value moment (P1). This is a product definition, so it's Sahil's call.** Proposed:
   - **First value:** "A customer got a reply that FollowUp wrote." That's the first message a rule wrote which went
     out, whether the owner approved it or it sent by itself.
   - **Activated:** reached first value within **7 days** of first sign-in.
   - **Proof:** that customer wrote back.

   Once agreed, record it in `PRODUCT_DIRECTION.md` so every screen and study uses the same words.
2. **The /admin funnel runs to value, with dates (P2, P3).**
   - Steps: Invited → Signed in → Connected a source (any channel, not only Gmail) → First customer → First reply
     ready → **First reply sent** → Customer answered → Back in week 2.
   - Each step shows the count, and the **median time** from the previous step.
   - One plain sentence names the biggest drop and the slowest step, for example: "Most testers stop at
     *Connected a source* (3 of 7). The slowest step is *First reply sent* (median 2 days)."
3. **"Who's stuck" list on /admin (P3).** One row per tester: where they are, and for how many days. The longest-stuck
   are first, so Sahil can personally help (matches the 09-25 study's "a person at the first session"). Nothing is
   emailed to testers automatically.
4. **Week-2 return (P4).** For each activated tester, did they come back 7–14 days later? This is shown on /admin as
   "4 of 6 came back in week 2". It's our version of Amplitude's day-7 check.
5. **The owner's first value, said once (P1). This is UI, so it needs design.** The first time a reply FollowUp wrote
   goes out, Today says it once, calmly: "Your first reply went out through FollowUp. From here it keeps watching, and
   tells you when they write back." No confetti, points or streaks.

**Guardrails:**
- **No third-party analytics SDK or tracking pixel.** Everything is counted from our own tables, founder-only, at
  /admin. Adding a tool like Amplitude itself would be a new dependency and a privacy question, and needs Sahil's OK.
- No new personal data is collected.
- No automated nag emails to stuck testers. A person helps instead.
- Counts are real or not shown (A-023).

**Rejected-list check:** clean. Nothing public-facing (R-012). The phone is unaffected (R-015). No streaks (A-031,
A-038).

---

## Sources

- Amplitude:
  - [The aha moment](https://amplitude.com/blog/aha-moment)
  - [Driving activation and engagement](https://amplitude.com/driving-activation-engagement)
  - [Mastering Engagement playbook](https://amplitude.com/books/user-engagement)
  - [Understand new user activation](https://amplitude.com/blog/understand-new-user-activation)
  - [Time to value](https://amplitude.com/explore/analytics/time-to-value)
  - [Funnel analysis guide](https://amplitude.com/guides/funnel-analysis)
  - [Interpret your funnel](https://amplitude.com/docs/analytics/charts/funnel-analysis/funnel-analysis-interpret)
  - [The 7% retention rule](https://amplitude.com/blog/7-percent-retention-rule)
  - [Cohort retention analysis](https://amplitude.com/explore/analytics/cohort-retention-analysis)
  - [Product analytics guide](https://amplitude.com/explore/analytics/product-analytics-guide)
- Thoughtlytics: [Defining your SaaS activation metric](https://www.thoughtlytics.com/blog/saas-activation-metric)
