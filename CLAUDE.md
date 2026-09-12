# FollowUp — repository-level instructions

This file governs **every** Claude session in this repository. The app code has its own
rules in `followup/AGENTS.md` (stack, build commands, file layout); this file governs
**design and UX**, and it applies on top of them.

## What FollowUp is

FollowUp is a SaaS platform that makes sure a business never loses a lead because nobody
followed up — in time, at all, or correctly. It captures leads from many channels,
centralizes the conversation, scores intent, drafts and sends permitted follow-ups, and
escalates to a human the moment judgment is required.

The canonical product statement is `followup/PRODUCT_DIRECTION.md`. It wins over anything
here on *what to build*. This file wins on *how it should look, feel, and behave*.

## The Design Brain

`design-brain/` is FollowUp's permanent design memory. It is a **living system**, not
documentation that was written once. It holds the brand's principles, the design system,
the reference library, every design decision that was approved or rejected, research
findings, component specs, and the workflows that produce new screens.

**Treat it as authoritative. Treat it as mutable. Never treat it as optional.**

---

## Mandatory loop for any design or UI work

"Design or UI work" means: a new screen, a meaningful change to an existing screen, a new
component, a visual/token change, a copy change that carries UX weight (empty states,
errors, onboarding, permissions), motion, or layout. A typo fix is not design work.

### Before you design or write a single line of UI code

1. **Read the design brain.** Always `design-brain/README.md` +
   `design-brain/brand/brand-principles.md`. Then the files relevant to the task
   (the README's map tells you which). Do not design from memory of a previous session.
2. **Check `design-brain/decisions/approved.md`.** If a decision already covers this,
   follow it. Consistency with an approved decision beats your own better idea —
   if you genuinely think the approved decision is wrong, *say so and ask*, don't
   silently deviate.
3. **Check `design-brain/decisions/rejected.md` before proposing anything.** This is the
   single most important step. If an approach is on that list, it is dead. Do not
   re-propose it in new clothing. Re-proposing a rejected idea is a failure, not a
   fresh perspective.
4. **Review relevant references** in `design-brain/references/**` for the category
   you're working in.
5. **Research when the answer isn't already known** — follow
   `design-brain/workflows/research-workflow.md`. Research with a question, not to
   collect screenshots.

### While you design

6. **Never copy a reference.** Extract the *principle* — the hierarchy, the interaction,
   the usability lesson — and build something original for FollowUp. If the output
   would be recognizable as another company's screen, it's wrong.
7. **Create original designs** that are consistent with the FollowUp system. Reuse
   existing tokens and components before inventing new ones.
8. **Think like a senior product designer before thinking like a programmer.** Follow
   `design-brain/workflows/design-workflow.md`. Understand the user's actual problem,
   structure the information, *then* write code.

### Before you call it done

9. **Review your own implementation** against
   `design-brain/workflows/design-review.md` — the full checklist, honestly. Self-critique
   is required, not decorative. Name what's weak.
10. **Verify it renders.** A design you haven't looked at is a guess. See
    `design-brain/workflows/design-to-code.md`.

### After the work

11. **Record the decision.** Anything that future sessions would need to know goes in
    `design-brain/decisions/design-decisions.md`. Approvals go in `approved.md`,
    rejections in `rejected.md`.
12. **Learn from feedback — permanently.** See below.

---

## Capturing feedback (this is how the brain learns)

When the user reacts to a design, **write it down in the same session**. Memory that
lives only in a conversation is lost when the conversation ends.

| The user says | You do |
|---|---|
| "I like this" / "yes" / "ship it" | Append to `decisions/approved.md`. Record **what specifically** was liked — not "the dashboard", but "the single-column priority queue with the reason line under each lead". |
| "I don't like this" / "no" / "change it" | Append to `decisions/rejected.md`. Record what was rejected, the reason if given, and **your best inference of the underlying principle** if not. Mark inferred reasons as inferred. |
| Approves a design | Log in `approved.md` + a dated entry in `design-decisions.md`. |
| Rejects a design | Log in `rejected.md` + a dated entry in `design-decisions.md`. |
| Reveals a UX principle ("business owners won't read that") | Log in `brand/brand-principles.md` or the relevant `research/ux-patterns/` file. |

**Ask when the reason is unclear.** "You don't like it" with no reason is a fact you can
record but not a principle you can generalize. One short clarifying question ("is it the
density, or the color?") is worth more than a guess that misleads every future session.

**When feedback contradicts an existing entry**, don't delete the old one — supersede it.
Mark the old entry `SUPERSEDED (YYYY-MM-DD)` with a pointer to the new one. The history
of what was believed when is part of the value.

---

## Standing design rules (these do not need to be re-derived every session)

**FollowUp must feel:** trustworthy, premium, minimal, modern, professional, calm,
intelligent, human, simple, extremely polished.

**Never:** scammy visual styles, cheap gradients, excessive glassmorphism, neon,
over-colored dashboards, clutter, gratuitous 3D, random animation, decorative rounded-card
soup, poor typography, tiny unreadable text, ornament that doesn't improve usability, AI
gimmicks, fake complexity, or startup-template aesthetics.

**Motion and 3D** are allowed only when they improve comprehension or continuity.
Simplicity wins every tie.

**AI is an invisible capability, never a personality.** Never a sparkle icon standing in
for an explanation. Every automated action must let the user answer, without asking
support: *What happened? Why? What can I do? What does FollowUp recommend? What needs me?*

**Trust outranks sophistication.** If a design is more impressive but less trustworthy,
it loses. FollowUp is never designed as a spam tool, a scam, or an aggressive sales
platform — not in its visuals, not in its copy, not in its defaults.

**References are principles, not templates.** Apple, Linear, Stripe, Notion, Meta and
peers are studied for discipline and restraint. Their interfaces are never reproduced.

---

## Things that require asking first

- Finalizing a `[TO DECIDE]` token (color, type scale, radius, shadow) — these are
  deliberately open. Propose, don't decide alone.
- Deviating from an entry in `decisions/approved.md`.
- Adding a UI dependency, component library, icon set, or font.
- Anything that changes the product's *behavior* rather than its presentation — that's
  `followup/PRODUCT_DIRECTION.md` territory.

## Things you should just do

- Follow the design brain.
- Update the design brain when you learn something.
- Reuse an existing token or component instead of adding a near-duplicate.
- Say when a design you produced is weak, and where.
