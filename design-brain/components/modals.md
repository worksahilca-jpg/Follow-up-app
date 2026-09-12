# Modals, dialogs & overlays

**Principle: a modal interrupts.** It's justified when the interruption serves the user
(confirming something irreversible, focusing a short task) and unjustified when it serves
the product (announcements, upsells, tours).

## Types

| Type | Use | Dismissal |
|---|---|---|
| **Dialog** | A short, focused task or a decision | Escape, backdrop click, explicit cancel |
| **Confirmation** | Irreversible or high-consequence actions | Escape, cancel; never backdrop-only |
| **Drawer / side panel** | Detail or editing alongside retained context | Escape, backdrop, close |
| **Popover** | Small contextual controls (a filter, a date picker) | Escape, click outside |
| **Sheet (mobile)** | The mobile form of dialog/drawer | Swipe down, escape, close |

## Rules

1. **Prefer not to.** In order: inline > popover > drawer > modal. A modal is the last
   resort, not the default container for anything new.
2. **One at a time.** A modal opening a modal means the flow is wrong.
3. **Focus trap + focus return.** Focus moves in on open, cannot leave while open, and
   returns to the trigger on close. Non-negotiable for keyboard and screen-reader users.
4. **Escape always closes** — except when closing would lose unsaved work, in which case
   confirm.
5. **Backdrop click closes for low-stakes dialogs; not for confirmations or forms with
   input.** Losing a typed message to a stray click is a serious failure.
6. **Scroll lock on the page behind**, and the modal itself scrolls internally if tall.
7. **Never full-screen on desktop.** That's a page.
8. **On mobile, it's a sheet.** A desktop-proportioned modal on a phone is unusable.
9. **Title states what this is. The primary button states what will happen.** "Delete
   lead?" / "Delete lead" — never "Are you sure?" / "OK".
10. **Never trap the user.** There is always a visible way out.

## Confirmation dialogs

**Most confirmations should be undo instead.** A confirmation dialog trains people to
click through it, which means it stops protecting anyone. Undo respects the user, is
faster for the common case, and actually prevents the harm.

Confirm only when: the action genuinely can't be undone, it affects someone outside the
product (**sending a message to a real customer**), or it's expensive/destructive at scale.

When you do confirm:
- Name exactly what happens and to what ("Delete Sarah Chen and 14 messages")
- The destructive button is labeled with the verb, not "Confirm"
- Cancel is the safe default, and Escape is safe
- No dark patterns — never style Cancel as the prominent choice for a destructive action

## FollowUp-specific

**Sending a message to a real customer deserves a confirmation, not an undo** — you
cannot unsend. A short delayed-send window with a visible "Undo" is a better pattern
still, and worth considering when that flow is designed.

## Open decisions

- `[TO DECIDE]` Whether the product uses drawers, modals, or both — pick a default.
- `[TO DECIDE]` Elevation and shadow values (`brand/surfaces.md`).
- `[TO DECIDE]` Entry/exit motion.
- `[TO DECIDE]` Delayed-send-with-undo for outgoing messages.
