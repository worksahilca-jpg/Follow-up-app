# FollowUp UI/UX Reference Strategy (founder's document) and where we stand

**Date:** 2026-09-26 · **From:** Sahil ("FollowUp_UI_UX_Reference_Strategy.pdf", 4 pages) · **Status:** CANONICAL for
*which references to study, for what*. This file transcribes it, then checks it against what is built and studied.

---

## The document, in full

**Core strategy:** Pain → Recognition → Understanding → Proof → Trust → Value → Action.
- **Product principle:** don't organize the experience around everything FollowUp can do. Reveal information
  according to what the customer needs to understand next.
- **Desired feeling:** calm, clear, useful, trustworthy, straightforward. It should feel like relief from remembering
  every lead, not like another complicated CRM.

**Reference map**

| FollowUp area | Reference | What to study |
|---|---|---|
| Overall visual direction | Linear | Whitespace, typography, hierarchy, restraint, progressive disclosure |
| CRM / product UI | Attio | Records, tables, side panels, navigation, subtle borders, clean density |
| Follow-up / sales workflow | Close | Lead-response language, reminders, communication, follow-up and sales workflow |
| Hero conversion | Intercom | Headline → explanation → primary CTA → secondary CTA → risk reversal → proof |
| Complexity → simplicity | Stripe | Introduce a very deep product without exposing all complexity at once |
| Use-case storytelling | Notion | Jobs and outcomes instead of technical capabilities |
| Trust + control | Mercury | Permissions, approvals, security, calm presentation, user control |
| Outcome-oriented sections | Ramp | Features as short business outcomes |
| AI inside workflows | Intercom | AI doing useful work instead of the product screaming "AI" |
| Automation UX | Zapier | Trigger-condition-action, simplified for non-technical owners |
| Progress psychology | Duolingo | Progress, completion, milestones, positive feedback — not gamified visuals |
| Attention / task UX | Todoist | Calm prioritization, clearing work, knowing what needs attention now |
| Activation research | Amplitude | The first real value moment; activation and drop-off |
| Purposeful motion | Framer | Transitions that explain state changes, not decoration |
| Pricing / free entry | HubSpot / Intercom | Low-risk trial, clear CTA, no-credit-card reassurance where true |

**Section guidance (landing page, then app)**
1. **Hero (Linear + Intercom):** one problem, one explanation, one primary action, one lower-commitment action, one
   trust signal. No feature dumping.
2. **Problem recognition (Close):** a customer messages, the owner gets busy, plans to reply later, the conversation
   is forgotten.
3. **How it works (Notion + Stripe):** Connect → Find → Follow up. Scoring, routing, sequences and analytics come later.
4. **Product demonstration (Attio):** real-looking software, not a marketing card. Sarah asked about pricing → waiting
   2 days → needs attention → suggested reply → review.
5. **AI experience (Intercom):** show the intelligence (why a lead needs attention, the next action, the user in
   control). No generic "AI-powered".
6. **Trust (Mercury + Intercom):** "Can I safely let this product near my customers?" Permissions, approvals,
   transparency, pause.
7. **Benefits (Ramp):** "Lead scoring" → Know who needs attention first. "Sequences" → Follow up consistently.
   "Analytics" → Know what is being handled.
8. **Social proof (Attio / Close):** the structure of proof, not scale. Real beta customers, specific outcomes ("found
   inquiries we had forgotten"). Never invent scale.
9. **Advanced depth (Stripe + Linear):** only after understanding and trust: pipeline, automation, routing,
   analytics, booking. Simple outside, powerful underneath.
10. **Pricing (HubSpot + Intercom):** simple plans, clear action, free/trial entry, no-credit-card only when true.
11. **Product psychology (Todoist + Duolingo):** an attention queue, "5 people need you → 3 → 1 → You're caught up".
12. **Activation (Amplitude):** hypothesis: *the user discovers a genuine conversation that needs follow-up and takes
    action on it.* Optimize landing and onboarding toward that event.

**Psychological principles, used ethically**
- **Curiosity:** invite discovery ("Find who needs a follow-up") rather than generic clicking.
- **Truthful loss framing:** real waiting or quiet leads. Never fabricated urgency or revenue loss.
- **Open loops:** clearly separate Waiting for you / Waiting for customer / Handled.
- **Visible progress:** the queue moves toward a satisfying caught-up state.
- **Recognition over recall:** the system remembers who needs attention; the human decides.
- **Progressive disclosure:** advanced functions only when useful.
- **Trust before delegation:** detect → suggest → approve → earn trust → offer automation.
- **Immediate feedback:** every important action visibly confirms the new state.

**The five to study deepest:**
- **Linear:** how should it feel?
- **Attio:** how should it show the product?
- **Intercom:** how should it convert and establish trust?
- **Close:** how should it talk about leads and follow-up?
- **Stripe:** how should it keep a deep product simple?

**Working formula:** Linear's restraint + Attio's product clarity + Intercom's conversion/trust + Close's sales
understanding + Stripe's progressive complexity. Then Todoist/Duolingo-style progress psychology inside the product,
without copying their visual identities.

**Landing page journey (what the visitor should think):**
- Hero: that's my problem.
- Problem: this happens to me.
- How it works: that's simple.
- Demo: now I understand it.
- Trust: I'm still in control.
- Compatibility: it works with what I use.
- Proof: I believe it.
- Benefits: this would make my life easier.
- Product depth: there is serious power underneath.
- Pricing/FAQ: the risk and objections are manageable.
- Final CTA: I'll try it.

**Key rule:** for every element ask, does this help the visitor understand, trust, or want FollowUp? If removing it
doesn't make understanding worse, strongly consider removing it.

---

## Checked against what exists (2026-09-26)

### References: studied or not
- **Studied:**
  - Stripe, Notion, Mercury, Ramp, Zapier, Duolingo, Todoist, Amplitude and Framer, each with a research file and
    built work.
  - Intercom, but only the *AI inside workflows* half.
  - Linear and Attio each have one reference note (`references/design-systems/…linear…`,
    `references/crm/…attio…`).
- **Not studied:**
  - **Close.** One of the five deepest, and never studied. It's only mentioned in the 09-25 in-app benchmark.
  - **Intercom for hero conversion and trust.** Not studied as its own question.
  - **HubSpot / Intercom pricing and free entry.** Not studied.
- **Studied, but not "deepest":** Linear and Attio have one note each. The document asks for them to be among the
  five studied deepest.

### Landing page journey vs the live page (`src/app/page.tsx` on main)

| Journey step | Live page | Verdict |
|---|---|---|
| Hero | "Never lose a lead because you forgot to follow up." + "Start free" + "Free while in beta. No card…" | Problem, CTA and trust signal are there. **The explanation line is a qualifier** ("Only for owners who…"), not what it does. **No lower-commitment action.** |
| Problem | "Which customer am I about to lose…" and "You don't have a lead problem. You have a reply problem." | There, twice. |
| How it works | "Two minutes to connect. Then this changes." with three outcome cards | Outcomes, **not the Connect → Find → Follow up steps** the document names. |
| Demo | "See who needs you, and why." Product cards with Sarah Johnson ("Asked about price. No reply for 5 days. Needs you") | Close. **The suggested reply → review step isn't shown as one sequence.** The copy uses "She" (fine for a made-up person, but inconsistent with the app's no-pronoun rule). |
| Trust | "What it will and won't do." + /security | There. |
| Compatibility | "Works with what you already use." | There, in the document's order. |
| Proof | None | **Missing, correctly for now:** A-023 says no fake proof. It waits on real tester quotes. |
| Benefits | "Less chasing. More booking." | There (Ramp). |
| Product depth | "See what changed, the moment it does." | Partly. **No section that clearly says "simple outside, powerful underneath".** |
| Pricing / FAQ | Both there, "Free while in beta. No card." (true) | There. |
| Final CTA | "Start free." | There. |

### Psychological principles vs the product
- **Truthful loss framing:** "Waiting 5 h" and "Quiet 6 days" are facts (A-046).
- **Visible progress:** the handled line and "You're done for today." (A-046). The document says "You're caught up."
- **Recognition over recall:** yes. Today, Coming up, and reasons on every card.
- **Immediate feedback:** yes (A-048, just built).
- **Progressive disclosure:** mostly (Stripe study, "Every step", "See an example").
- **Open loops, partial.** Waiting for you (Needs your OK) and Handled are named. **Waiting for customer isn't named
  as a state on Today.** Coming up is the nearest thing.
- **Trust before delegation, missing its last step.** Detect → suggest → approve is built, and everything is held by
  default. **Nothing ever offers automation once trust is earned** (for example, after N replies sent as written).
  This is product behaviour, so it's the founder's call.
- **Curiosity:** every CTA says "Start free". The document's example is "Find who needs a follow-up".

### Conflicts with approved decisions (need the founder, not a guess)
1. **Hero secondary action.** RESOLVED 2026-09-26: A-049, option B. The document asks for "one lower-commitment action". A-023 says "One goal, 'Start
   free', in the top bar, the hero, after How it works, after Pricing and at the end."
2. **The activation moment.** RESOLVED 2026-09-26: keep A-047 as the count; the document's wording is the onboarding target. The document says *discovers a genuine conversation that needs follow-up and takes
   action on it*. A-047 (approved today) says *a customer got a reply that FollowUp wrote*. They're close, but the
   document's is earlier and wider: any action counts, not only a send.

### Key rule
Already in `workflows/design-review.md` ("Removing any element would lose information (if not, remove it)"). The
document's sharper wording, "does this help the visitor understand, trust, or want FollowUp?", is added there.
