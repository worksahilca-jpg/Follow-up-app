# The FollowUp Design Brain

This folder is FollowUp's design memory. It exists so that design quality **accumulates**
instead of resetting every time a new session starts.

Without it, every Claude session begins with amnesia: it re-invents the color system,
re-proposes the layout you rejected last week, and produces a product that looks like
twelve different products. With it, each session starts where the last one ended.

## What lives here

| Folder | What it holds | When you read it |
|---|---|---|
| `brand/` | The design system: principles, visual direction, color, type, spacing, surfaces, icons, motion | Before any visual work |
| `references/` | The reference library — things worth learning from, analyzed | Before designing a screen in that category |
| `decisions/` | What was approved, what was rejected, and why | **Before proposing anything** |
| `research/` | Competitor analysis, UX patterns, interaction patterns, research log | When a question needs a real answer |
| `components/` | Specs for each component: anatomy, variants, states, rules | When building or changing a component |
| `workflows/` | The processes: research, design, review, references, design-to-code | Every substantial screen |

## The map — what to read for what you're doing

**Designing a new screen** → `workflows/design-workflow.md`, `brand/brand-principles.md`,
`decisions/rejected.md`, `references/<category>/`, then the `components/` specs you'll use.

**Changing an existing screen** → `decisions/approved.md` (is the current shape locked?),
the relevant `components/` spec, `workflows/design-review.md`.

**Building a component** → `components/<name>.md`, `brand/color-system.md`,
`brand/spacing.md`, `brand/surfaces.md`, `components/states.md`.

**Picking or changing a color/font/spacing value** → `brand/` — and note that most final
values are deliberately `[TO DECIDE]`. Propose; don't unilaterally finalize.

**Adding a reference** → `workflows/reference-workflow.md`, `references/reference-index.md`.

**Doing research** → `workflows/research-workflow.md`, log it in `research/research-log.md`.

**Reviewing before shipping** → `workflows/design-review.md`.

**Turning an approved design into code** → `workflows/design-to-code.md`.

## How this stays alive

Three habits keep this from rotting into stale documentation:

1. **Every design decision gets recorded** — in `decisions/`, dated, with reasoning.
2. **Every rejection gets recorded with its principle** — so the same bad idea is not
   proposed three times in three different colors.
3. **Every `[TO DECIDE]` is a real open question** — not a placeholder to quietly fill in.
   When one is resolved, it moves to a decided value *and* gets a `decisions/` entry
   explaining why.

If you read a file here and it's wrong, out of date, or contradicted by what actually
ships — fix it and say so. A design brain that lies is worse than none.

## Status of this brain

**Established:** 2026-09-12. This is the foundation pass — structure, principles,
processes, and an honest record of the system currently shipping.

**Deliberately not done yet:** final color values, final type scale, the reference
library (empty — references come from the founder), competitor research (not yet run),
and any new UI. Empty is honest. Empty is not a gap to fill with invention.

**Important context:** FollowUp is not a greenfield project. A real Next.js application
already ships in `followup/` with a working token system in `followup/src/app/globals.css`
and ~38 components. The `brand/` files document that system **as it actually is**, marked
`Current (provisional)`, alongside the open questions marked `[TO DECIDE]`. Design work
starts from what exists, not from a blank page — but nothing currently shipping is
treated as final merely because it shipped.
