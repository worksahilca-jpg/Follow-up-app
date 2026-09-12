# Cards

**Principle: a card groups things that belong together. It is not a decoration and not a
default container.** If you can't say what makes the contents a unit, don't use a card.

## Current state

`rounded-xl border border-line bg-card p-5`, no shadow. Used for stat cards, settings
sections, follow-up cards, and most panels. Consistent and appropriate — keep it.

## When to use a card

- A set of related information with a clear boundary (a lead summary, a settings group)
- A repeated unit in a collection where each is independently actionable
- A panel with its own heading and its own actions

## When not to

- **To create visual interest.** (Principle 8.)
- **Around a single element.** A lone stat in a card is a stat with a border.
- **Inside another card.** Card-in-card means the hierarchy isn't resolved — use a
  subheading and space. (Standing rejection S-09.)
- **When space would do the job.** Try space first; it usually wins.

## Anatomy

```
┌─────────────────────────────────┐
│ Header: title, optional action  │  ← optional
├─────────────────────────────────┤  ← divider only if the split is real
│ Body                            │
│                                 │
├─────────────────────────────────┤
│ Footer: actions or metadata     │  ← optional
└─────────────────────────────────┘
```

- Padding: consistent on all sides, from the scale (`p-5` current, `[TO DECIDE]` vs `p-6`).
- Header: section-title type. Not larger than the page title.
- Dividers: `--line`, only when the sections are genuinely distinct.

## Interactive cards

A card that is itself a link or button:

- The **whole card** is the target, not just the title.
- Hover state must be visible but quiet. `[TO DECIDE]` — background shift is calmer than
  lift; lift is a marketing gesture. Given "calm over urgent", background shift is likely
  right.
- Focus-visible ring around the whole card.
- **One action per card.** A card that's a link and also contains three buttons produces
  accidental clicks and a nested-interactive accessibility problem.
- Semantics: a single `<a>` or `<button>` wrapping the content, not a `div` with
  `onClick`.

## The lead card — the most important card in the product

Not yet designed against these principles. When it is, it must answer, in scan order:

1. **Who** — name, and enough context to recognize them
2. **What state** — needs you / handled / waiting / cold, with a label, never color alone
3. **Why** — the reason for that state, in plain language (principle 6)
4. **When** — last contact / next follow-up, relative ("3 days ago") not absolute
5. **What to do** — one clear action

Research (2026-09-12) sharpens this: the card carries a **rescue score with its reason
visible**, and the reason line *is* the differentiator, not a detail — a score with no
reasoning is either obeyed blindly or ignored. See `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`.

`[TO DECIDE]` — the actual design. This deserves the full design workflow, multiple real
concepts, and founder review. It's the unit the whole product is made of.

**Note on priority:** research puts the **approve-a-draft screen** ahead of even this one.
It is where the trust the product depends on is earned or lost, and it has never been
designed against the design brain.

## Open decisions

- `[TO DECIDE]` Padding standard (20 vs 24px).
- `[TO DECIDE]` Interactive card hover treatment.
- `[TO DECIDE]` Whether a shared `<Card>` component should exist.
- `[TO DECIDE]` The lead card design.
