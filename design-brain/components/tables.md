# Tables

**Principle: a table is for comparing rows on the same attributes.** If the user isn't
comparing, a list is better. If they're scanning for one thing, a well-designed list beats
a table every time.

## Table or list?

| Use a table when | Use a list when |
|---|---|
| Users compare values across rows | Each row is read on its own |
| Sorting by a column is a real task | One ordering is obviously correct |
| Every row has the same attributes | Rows vary in what matters about them |
| Density matters more than richness | The row needs a sentence, not a value |

**RESOLVED (2026-09-12) — the FollowUp lead view is a prioritized list, not a table.**
A table says "compare your leads." A prioritized list says "here's who needs you, in
order." The second is the product's whole proposition: FollowUp does the prioritizing so
the owner doesn't. Competitive research names a rival's AI as *"pull, not push — the owner
has to ask"* which leads went cold; FollowUp's stated differentiator is the inverse, a
view that **opens on what's about to be lost**, each lead ranked with a visible reason.
A table would hand that work back to the user. See `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`.

A table is still right for genuinely comparative surfaces (analytics breakdowns, team
performance). It is not right for the lead queue.

## Rules

1. **Only columns people use.** Every column costs scanability for all rows. Ten columns
   means nobody reads any of them.
2. **Column alignment:** text left, numbers right, dates left (or right if compared).
   Numbers right-aligned with tabular figures so digits line up.
3. **Row height comfortable, not cramped.** `[TO DECIDE]` — likely 48–56px for a
   touch-capable list.
4. **Sticky header** on any table that scrolls. A column you can't name is useless.
5. **Row actions revealed on hover on desktop, always visible on touch.** Hover-only
   actions are invisible on a phone — a real failure, not a nuance.
6. **The primary action is the row itself** (open the record). Secondary actions are an
   overflow menu, not five icons per row.
7. **Selection** — checkbox column, header select-all, a clear count, and bulk actions in
   a bar that appears on selection. The bar must say *how many* will be affected.
8. **Sorting** must be visible (which column, which direction) and persist across
   navigation.
9. **Never horizontally scroll on mobile.** Transform to cards, or choose fewer columns.
   A horizontally scrolling table on a phone is an abandoned feature.
10. **Pagination or virtualization** past a few hundred rows — decide before the data
    arrives, not after a customer's list breaks the page.

## States

| State | Requirement |
|---|---|
| Loading | Skeleton rows matching real row height — never a spinner replacing the table, which collapses the layout |
| Empty (no data yet) | `EmptyState` with the first action. See `states.md` |
| Empty (no results from a filter) | **Different from above** — say what was filtered and offer to clear it |
| Error | Message + retry, table structure preserved |
| Partial/stale | If some data failed to load, say which — never show a partial table as complete |

## Accessibility

- Real `<table>` semantics — `<th>`, `scope`, a caption or `aria-label`.
- Sortable headers are buttons with `aria-sort`.
- Never convey a row's status by background color alone.
- Keyboard: tab to the row action, arrow-key row navigation if the table is the primary
  interface.

## Open decisions

- `[TO DECIDE]` Row height and density.
- `[TO DECIDE]` Mobile transformation.
- `[TO DECIDE]` Pagination vs. infinite scroll vs. virtualization.
