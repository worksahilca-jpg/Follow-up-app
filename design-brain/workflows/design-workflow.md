# Design workflow

The process for every **substantial** new screen. Not for a copy fix or a spacing
correction — for anything a user will form an impression of.

**The point of a process is to stop you writing code before you've thought.** Claude's
strongest failure mode is producing plausible UI immediately. This workflow exists to
interrupt that.

```
DISCOVER → UNDERSTAND USER → RESEARCH → REFERENCE → UX STRUCTURE →
VISUAL DIRECTION → INTERACTION DESIGN → PROTOTYPE → REVIEW →
IMPLEMENT → TEST → REFINE → DOCUMENT
```

---

## 1. DISCOVER
What is actually being asked for, and why now? What problem prompted it? What does success
look like — behaviorally, not visually? What's in and out of scope? **Ask before
assuming.** One clarifying question is cheaper than a wrong screen.

## 2. UNDERSTAND USER
Who is on this screen, what are they trying to do, in what context, and what does it cost
them if the design fails? See `research-workflow.md` step 1. For FollowUp, default to: a
business owner, interrupted, often on a phone, not a software person, who does not want to
learn anything to use this.

## 3. RESEARCH
Run `research-workflow.md`. Skip only if you can state why the answer is already known.

## 4. REFERENCE
Review `references/<category>/`. Extract principles. **Never copy an interface.** Note
explicitly what not to take.

## 5. UX STRUCTURE
**Before any visual thinking.** Structure only:
- What information exists on this screen, ranked by importance
- What actions exist, ranked by frequency and consequence
- What the user sees first, second, third
- What's deferred, hidden, or moved elsewhere
- The flow in and the flow out
- What happens when there's nothing, too much, or an error

Do this as an outline or a sketch in words. If the hierarchy isn't clear here, no visual
treatment will save it.

## 6. VISUAL DIRECTION
Apply the design system — existing tokens, existing components, existing patterns first.
Introducing a new pattern requires a reason. Check against `brand/visual-direction.md` and
the standing rejections in `decisions/rejected.md`.

## 7. INTERACTION DESIGN
Every state and every interaction, including the ones that are easy to forget. Use the
checklist in `research/interaction-patterns/README.md` and the definition of done in
`components/states.md`. **Specify the failure case before the success case.**

## 8. PROTOTYPE
Make it visible before making it real. A static HTML mockup, a described wireframe, or a
throwaway component — cheap enough to throw away, real enough to judge. **This is where
concepts get compared.** Don't skip to implementation because the answer feels obvious.

## 9. REVIEW
Run the full `design-review.md` checklist and the self-critique. **Honestly.** A review
that passes everything on the first attempt was not a review.

## 10. IMPLEMENT
Now write code. See `design-to-code.md`. Match the existing codebase's patterns
(`followup/.claude/agents/frontend-3d-agent.md` has the technical rules — tokens, Suspense
boundaries, client/server boundaries, the build checklist).

## 11. TEST
- Does it build and typecheck? (`npx tsc --noEmit`, `npx eslint`, `npm run build`)
- **Does it actually render?** Look at it. A design you haven't seen is a guess.
- Every state, with real, ugly data — long names, empty lists, failed sends
- 375px wide
- Keyboard only
- Reduced motion

## 12. REFINE
Fix what the review and testing found. **Then run the review again** — refinement
introduces new problems. The last 10% of polish is most of the perceived quality.

## 13. DOCUMENT
- Decision → `decisions/design-decisions.md`
- Founder's verdict → `decisions/approved.md` or `rejected.md`
- New or changed component → `components/<name>.md`
- Resolved `[TO DECIDE]` → update the `brand/` file *and* log why
- New principle learned → `brand/brand-principles.md` or `research/ux-patterns/`

**Undocumented work is work the next session will redo.**

---

## Multiple concepts: what "different" actually means

When the founder asks for several designs, **five color variations is a non-answer.**
Concepts must differ in at least three of these:

| Dimension | What varying it means |
|---|---|
| **Information architecture** | What's grouped with what; what's a page vs. a section vs. a panel |
| **Layout** | Single column vs. split vs. master-detail vs. board |
| **Navigation** | How the user moves between items and levels |
| **Density** | Scannable-and-dense vs. spacious-and-focused |
| **Interaction** | Inline editing vs. detail view; hover-reveal vs. always-visible; drag vs. select |
| **Visual hierarchy** | What's biggest, first, loudest — and what that says the screen is for |
| **Motion** | Where transitions carry meaning |
| **Content presentation** | A number vs. a sentence; a chart vs. a list; a score vs. a band |

**A good concept set has a real argument inside it** — each concept believes something
different about what the user needs. If all your concepts could be merged into one, you
generated variations, not concepts.

For each: what it optimizes for, what it sacrifices, who it's best for. Then recommend one
and say why, including what would change your mind.

---

## Shortcuts that are allowed

Not every change needs thirteen steps. **Say which you're skipping and why.**

| Change | Minimum |
|---|---|
| Copy fix | Just do it |
| Spacing/alignment correction | Do it, check the review checklist's consistency section |
| New instance of an existing pattern | Steps 5, 7, 9, 11 |
| Change to an existing screen | Steps 1, 5, 7, 9, 11, 12, 13 |
| New screen | All of it |
| Anything touching trust, permission, or sending | **All of it, no exceptions** |
