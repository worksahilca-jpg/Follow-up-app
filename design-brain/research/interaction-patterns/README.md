# Research — Interaction patterns

**How a specific interaction should behave**, in full, including the parts that are
usually forgotten.

One file per interaction: `YYYY-MM-DD-<interaction>.md`.

## Purpose

Most design work specifies the happy path and discovers the rest in production. This
folder is where an interaction is thought through *completely* before it's built —
including error, empty, slow, offline, interrupted, and concurrent cases.

## The completeness checklist for any interaction

Every pattern file must answer all of these. The last four are where products break.

1. **Trigger** — what starts it, and how the user knows they can
2. **Feedback** — how they know it registered, immediately
3. **Success** — what changes, and how they know it worked
4. **Failure** — what they see, what they can do, what was lost
5. **Undo** — can it be reversed? For how long? How is that communicated?
6. **Slow** — behavior at 3 seconds, and at 30
7. **Empty** — behavior with no data
8. **Interrupted** — the user navigates away or closes the tab mid-flight
9. **Concurrent** — two people, or two tabs, doing it at once
10. **Keyboard** — completable without a mouse
11. **Touch** — completable with a thumb
12. **Screen reader** — what is announced, and when

## FollowUp interactions that need this treatment

None specified yet. The ones that will matter most, in rough priority order:

- **Approving a drafted follow-up** — the core trust moment of the product
- **Pausing or stopping automation on a lead** — must be instant, obvious, and certain
- **A message failing to send** — silent failure here is an existential product failure
- **Connecting a channel (OAuth)** — including denial, revocation, and expiry
- **A lead replying while an automated sequence is running** — the "stops the instant a
  lead replies" guarantee, made visible
- **Bulk actions on leads** — powerful, and dangerous by nature
- **Moving a lead between pipeline stages** — especially on touch

## Rules

1. **Specify the failure before the success.** It's the case most often built badly and
   most damaging to trust.
2. **Every destructive action needs undo or confirmation — preferably undo.** A
   confirmation dialog trains people to click through; undo respects them.
3. **Optimistic updates need a revert path.** The app already does this correctly in
   `LeadAutomationToggle.tsx` — follow that pattern.

*No interaction pattern specs have been written yet.*
