# Buttons

**Principle: one primary action per screen.** If everything is primary, nothing is. The
hierarchy of buttons on a screen is a statement about what the user should do.

## Variants

| Variant | Appearance | Use for | Per screen |
|---|---|---|---|
| **Primary (in-app)** | `--ink` fill, `--paper` label | The single most important action on any authenticated-app screen | 0 or 1 |
| **Primary (lead-facing / no-chrome)** | Accent (`--rust`) fill, `--on-accent` label | The single most important action on the public booking page, the embeddable widget, or the global error page | 0 or 1 |
| **Secondary** | Surface fill, `--line` border, `--ink` label | Alternative actions | Several |
| **Tertiary / ghost** | No fill, no border, `--ink` or `--ink-soft` label | Low-weight actions, toolbars, table rows | Many |
| **Destructive** | `[TO DECIDE]` — `--coral` text on a subtle surface, or `--coral` fill | Delete, disconnect, cancel a plan | Rare |
| **Link** | Accent text, underline on hover | Inline navigation within text | As needed |

**Why two primary rows, not one:** the operator's own tool (dashboard, leads, pipeline,
settings — everything a business owner uses to run FollowUp) stays calm and near-monochrome;
`--ink` is the default primary fill there, including the highest-trust click in the product,
`ApprovalQueue`'s "Approve & send." `--rust` (the one accent) is reserved for genuine
accent-only roles — active nav, focus rings, toggles, selected states, inline links — plus
primary-button fill on the few surfaces a business's own *customer* sees directly rather
than the operator's internal tool. A bright accent-fill button on every "Add," "Save," and
"Send" would be the generic SaaS-template default (standing rejection
`[[rejected#^S-15|S-15]]`) and would dilute the accent's meaning everywhere else it appears.
**Approved 2026-09-13** — see `[[approved#^A-003|A-003]]` and
`[[design-decisions#^D-014|D-014]]` for the full evidence and reasoning.

**Destructive is deliberately open.** A full red fill is loud and pulls attention on a
screen where destruction shouldn't be prominent; red text on a neutral surface is calmer
but easier to miss. Resolve on a real screen. Whichever wins, a destructive action must
never be the visually dominant element on a page.

## Anatomy

- Label, optionally with a leading icon. Trailing icons only for direction (`→` on a
  next-step, chevron on a menu).
- Padding from the spacing scale. `[TO DECIDE]` — settle on default/small/large sizes.
- Radius per `brand/surfaces.md`.
- Minimum touch target 44×44px including padding.

## Copy

- **Sentence case. A verb.** "Send follow-up", not "SUBMIT" or "Follow-up".
- **Name the outcome, not the mechanism.** "Approve and send" beats "Confirm".
- Never "Click here", never "OK" where a real verb exists.
- Destructive buttons say what will be destroyed: "Delete lead", not "Delete".

## States — all seven, always

| State | Behavior |
|---|---|
| Default | As specified |
| Hover | The global `filter: brightness(0.96)` currently applies app-wide. `[TO DECIDE]` — a blunt instrument; a per-variant hover is more controllable. |
| Focus-visible | Accent ring (`0 0 0 3px --rust-soft, 0 0 0 1px --rust`) — already global, keep it |
| Active/pressed | Immediate, subtle. `[TO DECIDE]` |
| Loading | **Label stays, spinner replaces or joins the icon, width does not change.** A button that resizes mid-action is jarring. Disabled while loading. |
| Disabled | Reduced contrast, `cursor: not-allowed`, and **never without an explanation nearby** of what would enable it |
| Success (transient) | Optional. The app's existing pattern — a brief checkmark in `--sage` — is good; return to default after ~2s |

**The most-skipped state is loading.** Every button that triggers a network request needs
one, or users double-submit. Double-submission in a product that sends messages to real
customers is a serious failure, not a cosmetic one.

## Rules

1. Never two primary buttons in one view.
2. Primary sits where the eye ends — right of a button group, end of a form.
3. Destructive actions are separated by space from the action next to them.
4. Icon-only buttons require `aria-label` and a tooltip.
5. A button that navigates should be a link (`<a>`); a button that acts should be a
   `<button>`. This matters for keyboard, middle-click, and screen readers.
6. **Never disable a form's submit button to indicate invalid input** without showing what
   is wrong. A dead button with no explanation is a dead end.

## Open decisions

- `[TO DECIDE]` Size scale (sm/md/lg) and their exact padding.
- `[TO DECIDE]` Destructive treatment.
- `[TO DECIDE]` Whether the global brightness hover is replaced by per-variant hovers.
- `[TO DECIDE]` Whether a shared `<Button>` component should exist at all — the app
  currently styles buttons inline per usage, which is why hover/focus had to be patched
  globally in CSS. A single component would make states consistent by construction.
  **Recommended, and worth doing before much more UI is built.**
