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

**DECIDED 2026-09-20** (founder: "approved, apply both ladders"). Three values, and
nothing else exists:

| Value | Where |
|---|---|
| **12px** (`--radius-box`, the `.box` class) | Boxes, cards, panels, menus, modals — any surface that sits *on* the page |
| **8px** (`rounded-lg`) | Anything *inside* a box: buttons, inputs, list items, icon tiles |
| **`full`** | Pills, badges, avatars, toggles |

There is no fourth value. `rounded-xl`, `rounded-2xl` and `rounded-md` were in use across
thirteen files with nothing distinguishing them; they are gone and must not come back. A
surface that seems to want a different radius is a surface that wants a different
*treatment* — solve it with elevation, ground or spacing.

This supersedes the earlier proposed `sm`/`md`/`lg` set, which never shipped and which
would have introduced a 6px and a 16px the app had no use for.

**Rules:**
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

- ~~`[TO DECIDE]` The three-value radius set~~ — **decided 2026-09-20**, see "Border
  radius" above. 12 / 8 / full.
- `[TO DECIDE]` Shadow values for levels 2–4.
- `[TO DECIDE]` Whether cards ever get hover elevation. Current `HoverLift` component
  exists — audit whether it's used inside the app or only on marketing surfaces, and
  whether lift-on-hover survives the "calm over urgent" principle.
