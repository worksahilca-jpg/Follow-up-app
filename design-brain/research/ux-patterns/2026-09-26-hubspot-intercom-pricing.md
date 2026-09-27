# HubSpot and Intercom: pricing and free entry

**Date:** 2026-09-26 · **Asked by:** Sahil ("cover each and every single thing one by one"). This is the last
reference in the strategy document that hadn't been studied. · **Status:** STUDIED and drawn (canvas), pending
approval. Sketch only (A-052).

**Question (reference strategy, Pricing / free entry):** How do HubSpot and Intercom make starting feel low-risk,
with a clear action, and "no credit card" only where it's true?

hubspot.com and intercom.com couldn't be fetched from here. The sources are search summaries of their own pricing
pages (B) and third-party guides (C).

## What they do

- **HubSpot: free is a place you can stay (B).**
  - The free tools are "$0/month, no credit card required", for up to 2 users.
  - Paid tiers (Starter, Professional, Enterprise) sit next to them, and the free tools are named for what they do.
- **Intercom: the trial is one line, repeated (B/C).**
  - "14-day free trial", any plan, no credit card.
  - The price has two layers: per seat, plus $0.99 per resolved outcome.
  - Guides call the per-outcome layer the confusing part ("the bill scales with both team size and AI usage"). The
    page spends a lot of words explaining when you are *not* charged.
- **Pricing pages that convert (C, several 2026 guides):**
  - Three tiers.
  - One recommended plan marked quietly, with every card the same size.
  - The few questions people ask about money sit right under the plans.
  - On a phone, the plans stack. No sideways comparison table.

### The principles underneath

- **P1:** Say exactly what free means: how long, how much, and what happens after.
- **P2:** "No card" only where it's literally true, next to the button.
- **P3:** One recommended plan, marked quietly. Same card sizes.
- **P4:** Simple beats clever. Every extra pricing layer needs a paragraph of "you're not charged when…" (Intercom's
  lesson). FollowUp's "no seats, no per-message fees, no AI add-on" is a strength.
- **P5:** The three money questions sit under the plans: what happens after the beta, what counts, can I leave.

## Where the sketched canvas stands (Main, Pricing)

- ✓ "Free while in beta", $0 / $39 / $79, and "No seats, no per-message fees, no AI add-on" (P4).
- ✓ "No credit card required" under each button (P2). It's true: beta accounts have no Stripe customer, so nothing
  can be charged.
- ◐ P1: nothing says what happens when the beta ends. The truth: nothing is charged unless the owner picks a plan.
  Beta testers are on Pro for free, and if the beta ends for them they're back on Free.
- ◐ P3: there's no recommended plan.
- ◐ P5: there are no money answers under the plans. The FAQ is generic and further down.
- **✗ Two lines are no longer true (hold-by-default and Autonomous is refused):**
  - Plus: "Simple replies send themselves, if you want".
  - FAQ: "You can let it send the simple ones by itself".
- Free's "Up to 20 customers a month" is true (`FREE_TIER_LEAD_CAP = 20`, counted as new customers a month).

## Proposal (drawn as PricingClear, desktop and phone)

1. A one-line beta promise above the plans: "In the beta you get everything in Pro, free. No card, so nothing can
   be charged."
2. Plus is marked "Recommended for one owner". The mark is a thin ink border and a small label. All cards are the
   same size.
3. Plus's untrue line becomes "Every reply waits for your OK, on every channel."
4. Three money answers sit under the plans:
   - after the beta;
   - what counts as a customer;
   - leaving (delete everything any time).
5. On the phone, the cards stack with the recommended one first.

It also fixes the FAQ answer on Main: "No. Every reply waits for your OK, and anything about price always does."

## Sources

- [HubSpot, Free Tools pricing](https://www.hubspot.com/pricing/crm) (B)
- [HubSpot, Sales Software pricing](https://www.hubspot.com/pricing/sales) (B)
- [Intercom, pricing guide](https://www.intercom.com/learning-center/intercom-pricing) (B)
- [Voiceflow, Intercom pricing 2026](https://www.voiceflow.com/blog/intercom-pricing) (C)
- [Drag, Intercom pricing 2026](https://www.dragapp.com/blog/intercom-pricing/) (C)
- [Fungies, SaaS pricing page best practices 2026](https://fungies.io/saas-pricing-page-best-practices-2026/) (C)
- [PipelineRoad, what actually converts](https://pipelineroad.com/agency/blog/saas-pricing-page-best-practices) (C)
- [Figma, pricing page best practices](https://www.figma.com/resource-library/pricing-page-best-practices/) (C)
