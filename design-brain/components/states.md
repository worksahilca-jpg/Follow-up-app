# States — empty, loading, error, success

**Principle: the happy path is the easy 20% of design work.** A product feels cheap or
solid almost entirely based on what it does when things are empty, slow, or broken.

**Every screen and component must specify all four states before it's considered
designed.** This is a completion requirement, not a nice-to-have.

---

## Empty states

There are **four different empty states** and they are not interchangeable. Conflating
them is one of the most common design failures in this product category.

| Type | Situation | What it must do |
|---|---|---|
| **First-run** | New account, nothing exists yet | Explain what will appear here and give the one action that starts it |
| **No results** | A filter or search matched nothing | Say what was filtered, offer to clear it. **Never** the first-run message |
| **Genuinely clear** | Everything handled — inbox zero | **Celebrate calmly.** This is a success state, not an absence |
| **Not available** | Permission, plan, or disconnected channel | Explain why and how to change it |

**The third one matters unusually much for FollowUp.** "No leads need your attention" is
the product working perfectly. It must never look like a failure, an error, or an
apology — and it must not manufacture a reason to nag.

Confirmed by research (2026-09-12): the lead view **opens on what's about to be lost**, so
an empty one is the product's core promise being kept. Design it as a calm success state,
never as an empty container. See `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`.

Use the shared `EmptyState` component (icon badge, title, description, optional action) —
don't build bespoke ones. Its restraint (no accent color, no decorative animation) is
correct; keep it.

**Rules:**
1. Never a dead end. Always name the next action, or explain why there isn't one.
2. Never blame ("You haven't added any leads" → "Leads will appear here as they come in").
3. Never a wall of onboarding text in an empty state.
4. Never an illustration that takes more space than the explanation.

---

## Loading states

| Duration | Treatment |
|---|---|
| < 300ms | **Nothing.** A flashing spinner is worse than a brief wait |
| 300ms – 2s | Skeleton matching the real content's shape, or an inline spinner on the triggering control |
| 2s – 10s | Skeleton + a note on what's happening ("Loading your leads…") |
| > 10s | Progress if measurable, an honest explanation if not, and a way to leave |

**Rules:**
1. **Skeletons match real content dimensions.** A skeleton that doesn't match causes a
   layout jump on load — worse than a spinner.
2. **Never collapse the layout while loading.** Reserve the space.
3. **Load progressively.** Show what's ready rather than blocking on the slowest piece.
4. **Buttons show loading in place** (`buttons.md`) — and are disabled, so nothing is
   double-submitted.
5. **Optimistic updates where the action almost always succeeds** — with a revert path.
   The pattern in `LeadAutomationToggle.tsx` is the reference.
6. **No shimmer as personality.** Especially not as an "AI is thinking" signal (S-13).

---

## Error states

The hardest and most neglected. **In a product that sends messages on a business's behalf,
a silent failure is an existential failure, not a cosmetic one** — a message that didn't
send and didn't say so is exactly the lost lead FollowUp exists to prevent.

**Every error message must answer:**
1. **What happened** — in plain language, no codes as the primary message
2. **What it means for me** — what was lost, what wasn't
3. **What I can do** — a specific action, ideally a button
4. **How to get help** — if there's nothing the user can do

| Type | Treatment |
|---|---|
| Field validation | Inline, at the field, on blur |
| Form submission | At the form, near the submit, preserving all input |
| Page-level | Replace content with an explanation + retry |
| Section-level | Contained to the section — never take down the page for one failed widget |
| Background failure | **Persistent** notification. Never a toast |
| Network/offline | State it, say what's queued, retry automatically when back |

**Rules:**
1. **Never lose user input.** Ever.
2. **Never "Something went wrong."** It tells the user nothing and reads as evasion.
3. **Never expose a stack trace or raw API error** as the primary message. A reference
   code, secondary, is fine and helps support.
4. **Retry is available** where retrying could work.
5. **Never blame the user.**
6. **Failure to send a message is a first-class state**, visible in the conversation and
   in whatever surface the user checks, persisting until acknowledged.

---

## Success states

**Rule: if the UI visibly changed, that's the confirmation.** Don't add a toast to
announce something the user can already see.

Success needs explicit confirmation when: the result isn't visible (a background job
started), it's consequential (a message was sent to a customer), or it completes a
multi-step flow.

- Quiet and brief. A transient checkmark in `--sage` beats a toast.
- **Never celebrate volume.** Messages sent is not an achievement (principle 7); replies
  and deals are.
- No confetti, no animation with personality.

---

## The other states people forget

| State | Requirement |
|---|---|
| **Partial failure** | 8 of 10 sent, 2 failed — say exactly which and what to do. Never round to "done" |
| **Stale data** | Say when it was last updated and offer refresh |
| **Permission denied** | Explain who can grant it |
| **Rate limited / quota** | Honest, with when it resets |
| **Overflowing content** | A 60-character name, a 4,000-word message — every layout must survive real data |
| **Disconnected channel** | Persistent and prominent. A disconnected inbox means leads are silently going unanswered — arguably the single most important error state in the product |

---

## Definition of done

A screen or component is not designed until all of these are specified:

- [ ] Default / populated
- [ ] First-run empty
- [ ] No-results empty (if filterable)
- [ ] All-clear empty (if it can be legitimately empty)
- [ ] Loading (including >2s)
- [ ] Error, with recovery
- [ ] Partial failure (if it acts on multiple things)
- [ ] Success / confirmation
- [ ] Disabled / no permission
- [ ] Overflow with real, ugly data
- [ ] Mobile at 375px
- [ ] Keyboard-only
- [ ] Reduced motion
