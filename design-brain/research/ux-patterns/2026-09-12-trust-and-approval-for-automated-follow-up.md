# Trust and approval when software acts on a business's behalf

**Date:** 2026-09-12
**Method:** Design-lens reading of existing repo research — primarily
`followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md`, plus
`market/2026-09-09-business-model-case.md` and `market/2026-09-06-realtor-tool-landscape.md`.
No new external research was conducted.
**Confidence:** Medium. See the caveat below — this is a design reading of someone else's
sourcing, and that sourcing is explicitly self-flagged as unverified.

---

## Sourcing caveat — carry this wherever these numbers go

The customer-research pass states plainly that **WebFetch was blocked in its sandbox**, so
every figure below is a **search-snippet citation, not a fetched-and-read source**. The
original author flagged one set of forum quotes as possibly vendor-influenced, and marked
several percentages as aggregated by third-party blogs rather than traced to a primary
study.

**What this means for design:** these findings are strong enough to *shape a design
direction* and far too weak to *put on a screen*. No number here goes into product copy or
a landing page without a direct fetch first. Treated as design input, the direction they
all point in is consistent enough to act on.

---

## Finding 1 — Approval-first is validated, and the approval moment is the product's most important screen

**Evidence:** A study of 1,050 consumers found **77% want human approval before an agent
acts, with only 1 in 10 comfortable with full independence** — even for low-stakes
decisions. The same study frames trust as resting on: permissions, approval for high-stakes
actions, spending limits, review of activity, and the ability to escalate to a human.

Against this sits a weaker, more optimistic figure: 62% of SMB leaders say they're
confident handing high-stakes tasks to AI. The original author flagged this one as poorly
sourced and not the one to lean on.

**The honest read:** people are bullish about AI in the abstract and want a human in the
loop when asked about un-reviewed autonomous action specifically. Those aren't contradictory
— they're the same person answering two different questions.

### Design implications

1. **The approve-a-draft screen is the highest-stakes surface in the product.** It is where
   trust is either earned or lost, and it deserves more design attention than the dashboard.
   It has not been designed against the design brain yet.
2. **That five-item trust checklist is a design checklist**, almost verbatim: what is it
   allowed to do; what needs my say-so; what are the limits; what has it done; how do I
   take over. A user who can answer all five without contacting support is a user who trusts
   the product. Test any automation surface against those five questions.
3. **Autonomy must stay visibly per-lead and reversible.** The existing per-lead
   Assisted/Autonomous model matches what the research says people want. The design job is
   making the current setting legible *at a glance, per lead* — not buried in a settings
   page.
4. **"Escalate to a human" must be a visible affordance, not an implied one.**

---

## Finding 2 — The fear is not "AI is wrong", it's "my business will feel fake"

**Evidence:** **65.5% of business owners worry** that leaning on AI makes their business
feel less personal or authentic to customers. Separately, **79% of customers say they'd
prefer a human over a chatbot**, and roughly half describe past AI-assistance experiences
as negative. (Two different underlying studies, aggregated by third parties — approximate.)

**This is the sharpest design finding in the whole pass**, because it names a *specific*
fear rather than generic AI-skepticism, and it is a fear about **the customer's
experience**, not the owner's convenience.

### Design implications

1. **Direct, independent support for brand principle 3** (*AI is invisible capability,
   never personality*). Every sparkle icon, bot avatar, and "✨ AI-powered" label actively
   feeds the documented fear. This finding upgrades that principle from a taste position to
   an evidence-backed one.
2. **The owner must be able to see what their customer will see**, in the customer's
   format, before anything sends. A draft shown in a product-chrome-heavy editor is not the
   same reassurance as a draft shown as the message it will become.
3. **Editing a draft must be frictionless and must feel expected**, not like overriding the
   system. If editing feels like fighting the product, owners will either stop reading
   drafts or stop using automation.
4. **Never surface the AI as a persona.** No name, no avatar, no first person. It drafted,
   sent, scored, flagged.
5. **Voice-matching quality is a trust feature, not a nicety.** A regression there hits a
   documented, specific fear.

---

## Finding 3 — Speed is the product, and the user is not at a desk

**Evidence:** A ServiceTitan study of 50,000+ contractor phone lines found a **62%
missed-call rate** in home services, and **86% of callers who reach voicemail hang up
without leaving a message**. Calling a web lead **within 1 minute makes it 391% more likely
to convert**. The research describes the ICP as someone "literally on another call or up a
ladder", with no admin staff to triage.

### Design implications

1. **Mobile is the primary platform for the core loop**, not the responsive afterthought.
   See-what-needs-me → read context → approve or reply must be completable one-handed, on a
   phone, in well under two minutes. This settles the open question in
   `brand/spacing.md` for these specific surfaces.
2. **The shortest path on the screen must be the path to responding.** Every tap between
   opening a notification and a reply going out is measurable lost conversion.
3. **Deep links must land on the exact lead**, never on a list the user then searches.
4. **Latency is a design problem, not just an engineering one.** Optimistic updates on
   approve/send are worth real effort here.

---

## Finding 4 — Push, not pull: the interface should open on what's being lost

**Evidence:** The competitive analysis characterizes Lofty's AI as **"pull, not push — the
owner has to ask"** which leads haven't been contacted. FollowUp's stated differentiator is
the inverse: a dashboard that **opens on "about to be lost"**, with each lead ranked by a
rescue score (neglect × intent × recoverability) carrying **a visible reason**.

### Design implications

1. **This is an information-architecture decision, already made by strategy.** The
   dashboard's first screen is not a metrics summary — it is the queue of leads about to be
   lost. Anything that pushes that queue below the fold is wrong.
2. **It resolves the open question in `components/tables.md`** (table vs. prioritized
   list) in favor of **a prioritized list**. A table says "compare your leads"; the product's
   whole proposition is that it does the prioritizing so the owner doesn't.
3. **A score without its reason fails the proposition.** Directly reinforces brand
   principle 6. The reason line is not an optional detail — it *is* the differentiator.
4. **A calm all-clear state is a first-class success state**, not an absence. If nothing is
   about to be lost, the product is working.

---

## Finding 5 — Complexity is the category's failure mode

**Evidence:** Competitor sentiment repeatedly names setup burden: one workflow-first
competitor scores 4.3 on Capterra but 3.6 on G2, with the recurring theme *"great for teams
willing to invest in setup, a steep, demanding learning curve for solo agents and
less-technical users."* Another is "dinged for a dated interface." A small-CRM vendor's
positioning mirrors the complaint directly: *"a CRM should be a simple tool that empowers
you, not a complex system that requires a full-time administrator."* Business-model research
adds that **self-serve onboarding must work without the founder in the room.**

### Design implications

1. **Configurability is where competitors lose this ICP.** FollowUp's Workflows surface is
   the one most at risk of repeating that mistake. Defaults must be correct and complete
   enough that most users never open it.
2. **Direct support for brand principle 4.** Anything that needs explaining has failed.
3. **Onboarding must complete unaided**, including the hard parts (Gmail OAuth, Twilio,
   Meta verification) that carry real external friction.

---

## Finding 6 — SMS consent is a design surface, not just a legal one

**Evidence:** TCPA requires prior express written consent before a promotional text.
Statutory damages are cited as **$500 per violation, $1,500 if willful**, with class actions
against small businesses described as increasingly common. Carriers additionally throttle or
block numbers flagged as non-compliant. **The liability sits with the business, not with
FollowUp** — and it exists regardless of whether a human approved the message.
(Compliance-vendor sources, not FCC rule text.)

### Design implications

1. **Consent state must be visible where sending happens** — not only in settings. An owner
   about to approve an SMS should be able to see whether that lead consented.
2. **Connecting SMS is the right moment for a plain-language consent explanation.** The
   original research flagged this as a decision for the CEO rather than a silent pickup —
   it stays flagged. It is noted here because it is a **design** requirement once decided,
   not only a legal one.
3. **This directly serves brand principle 7** (*never design the spam tool*). Visible
   permission state is the clearest possible signal that FollowUp is not one.

---

## What this changes in the design brain

| Where | Change |
|---|---|
| `brand/brand-principles.md` | Principles 3, 4, 6 and 7 now have external evidence behind them, not just conviction |
| `brand/spacing.md` | Mobile-first is settled for the core loop (Finding 3) |
| `components/tables.md` | Prioritized list beats table for leads (Finding 4) |
| `components/cards.md` | The lead card must carry the rescue score **and its reason** |
| `components/states.md` | "Nothing about to be lost" is a first-class success state |
| Next design work | The **approve-a-draft screen** outranks the dashboard in importance |

## What this does not answer

- Nothing here is from a FollowUp user. Every finding is category-level.
- No figure is fetch-verified. None may appear in product copy.
- Nothing measures how owners actually *read* a score they didn't calculate — still the
  open question in `research/ux-patterns/README.md`.
