# Surfaces — radius, borders, shadows, elevation

*Not in the original design-brain outline; added because §11 of the brief requires border
radius, shadows, and elevation documented somewhere, and they are one connected system.*

---

## Border radius

**Current state (provisional):**
- Cards: `rounded-xl` (12px)
- Small icon containers: `rounded-lg` (8px)
- Empty-state icon badge: `rounded-2xl` (16px)
- Pills/badges: `rounded-full`
- Focus ring: 4px

**Rules:**
1. **Three radii maximum**, plus `full` for pills. Proposed set:
   - `sm` — 6px: inputs, small buttons, tight controls
   - `md` — 10–12px: cards, panels, menus, modals `[TO DECIDE — reconcile with the
     shipped 12px]`
   - `lg` — 16px: large feature surfaces, rare
   - `full` — pills, avatars, toggles only
2. **Nested radius is smaller than its parent**, by roughly the padding between them.
   Equal radii on nested boxes look broken.
3. **Radius is not personality.** Heavy rounding reads friendly-consumer; sharp reads
   technical. FollowUp sits in between and should stay there. Do not increase radius to
   make something "feel nicer."

## Borders

- Default border: 1px `--line`. This is the primary separation device.
- The app sets `* { border-color: var(--line) }` globally, so borders default correctly.
- **Prefer a border + a lighter surface over a shadow** for separating a card from the
  page. That's the current, correct approach.
- Dividers inside a card use the same `--line` — no second, darker divider color.

## Shadows & elevation

**Current state: the app uses essentially no shadows.** Cards are border + background
only. This is a good default and should be preserved.

**Elevation levels (proposed):**

| Level | Used for | Treatment |
|---|---|---|
| 0 | Page background | No shadow, `--paper` |
| 1 | Cards, panels, list rows | `--card` + 1px `--line`, **no shadow** |
| 2 | Dropdowns, popovers, menus, tooltips | Subtle shadow + border `[TO DECIDE]` |
| 3 | Modals, dialogs, command palette | Stronger shadow + scrim over page `[TO DECIDE]` |
| 4 | Toasts / transient notifications | Similar to 3, bottom or top corner `[TO DECIDE]` |

**Rules:**
1. **Elevation means "floats above and can be dismissed."** It is a statement about
   interaction layers, not about importance. An important card does not get a shadow.
2. **Shadows are soft, large-radius, low-opacity, and near-neutral** — never a hard
   offset drop shadow, never colored, never a glow.
3. **One shadow per element.** Layered shadow stacks for "realism" are ornament.
4. **Nothing on the page competes with the modal.** When level 3 is open, everything below
   it is scrimmed and inert.

`[TO DECIDE]` — exact shadow values. Deliberately open: they should be chosen by looking
at a real dropdown on a real screen, not picked from a scale in the abstract.

## Open decisions

- `[TO DECIDE]` The three-value radius set, reconciled with what ships (12px cards).
- `[TO DECIDE]` Shadow values for levels 2–4.
- `[TO DECIDE]` Whether cards ever get hover elevation. Current `HoverLift` component
  exists — audit whether it's used inside the app or only on marketing surfaces, and
  whether lift-on-hover survives the "calm over urgent" principle.
