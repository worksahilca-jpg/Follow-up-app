# References — Design systems

Token systems, component libraries, and the way teams document design.

## What to look for here

- **Token naming and layering.** Primitive (`gray-100`) → semantic (`--surface`) →
  component (`--card-bg`). Where a system draws those lines determines how well it scales.
- **How components document their states** — not just the happy path, but empty, loading,
  error, disabled, overflowing, and translated.
- **What the system refuses to include.** The best systems are notable for their
  constraints, not their breadth.
- **How exceptions are handled** — every system needs an escape hatch; the good ones make
  it explicit and traceable.
- **Documentation that people actually read** — short, opinionated, with rules rather
  than encyclopedic API tables.

## The FollowUp-specific question

FollowUp's system is small on purpose: one accent, one typeface, four status colors, a 4px
scale. The relevant lesson from large systems is **their discipline, not their scope.**
Do not import a 60-component library's structure into a product with ~38 components.

Specifically useful: how mature systems handle the semantic-color problem we have (a
status color that must never be used decoratively), and how they name tokens so a name
never lies — which ours currently does (`--rust` has held a blue, a violet, and now an
amber; see `brand/color-system.md`).

## Anti-patterns to notice and name

Token systems with 200 colors; components with 15 props; documentation that describes
without prescribing; design systems that ship every variant a designer once asked for.
