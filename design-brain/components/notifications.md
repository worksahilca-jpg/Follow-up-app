# Notifications & feedback

**Principle: tell the user what happened, where they are looking, at a weight matching
the consequence.** Over-notifying is how a calm product becomes an anxious one — and users
who learn to ignore notifications will ignore the one that mattered.

## The four levels

| Level | Form | Use for | Persistence |
|---|---|---|---|
| **Inline** | Text next to the element | Validation, the result of a local action | Until resolved |
| **Toast** | Transient, corner | Confirming an action the user just took | 3–5s, auto-dismiss |
| **Banner** | In-page, top of a section | A condition affecting this screen (channel disconnected, sync failing) | Until resolved |
| **Notification centre** | The bell (`NotificationBell.tsx`) | Events that happened while away | Until read/archived |

## Choosing the level

**The test: what happens if the user misses it?**

- Nothing → toast, or nothing at all
- They're mildly confused later → inline or banner
- They lose a lead / money / trust → **it must persist.** A toast is not acceptable for
  anything consequential; toasts are missed constantly.

**Success toasts are usually unnecessary.** If the UI visibly changed, the change is the
confirmation. A toast saying "Saved" after the state already shows saved is noise. The
app's existing transient inline checkmark is a better pattern.

## Rules

1. **Never a toast for an error the user must act on.** It'll be missed. Inline or banner.
2. **Every error states the fix.** "Couldn't send — your Gmail connection expired.
   Reconnect" with a button, not "Error sending message."
3. **No stacked toasts.** More than two at once means the design is wrong.
4. **Toasts never contain the only copy of something.** No "message failed — [text]" in a
   disappearing toast.
5. **Dismissible means dismissible.** Don't resurrect a dismissed banner on every route.
6. **Count badges are for things needing action, not things that exist.** A badge showing
   unread-anything trains people to ignore it; a badge showing "3 need your approval"
   means something.
7. **Never use notifications for marketing.** No feature announcements in the place where
   "a lead is waiting" appears. This is how the channel dies.

## FollowUp-specific: the escalation notification

The most important notification in the product is *"this lead needs a human — you."*

It must:
- Be unmissable but not alarming (**calm over urgent** still applies — this is the hardest
  balance in the product)
- Say **who**, **why**, and **how urgently**, in one line
- Link directly to the thing needing action, not to a list
- Persist until acted on — never a toast
- Be distinguishable at a glance from lower-stakes notifications

`[TO DECIDE]` — the design. Deserves the full workflow; it's the moment the product either
proves its value or fails silently.

## Copy

- Plain, specific, no exclamation marks.
- Name the lead, don't say "a lead".
- Relative time ("2 hours ago"), with the absolute time on hover.
- Never anthropomorphize: "Drafted a reply", not "I've written a reply for you".

## Accessibility

- Toasts and dynamic messages need `aria-live` — `polite` for confirmations, `assertive`
  only for genuine errors.
- Auto-dismiss must be pausable on hover/focus, and generous enough to read.
- Never color alone. An error is red **and** says "Error" **and** ideally carries an icon.

## Open decisions

- `[TO DECIDE]` Toast position, duration, stacking, and whether toasts exist at all.
- `[TO DECIDE]` Notification centre grouping and read/unread model.
- `[TO DECIDE]` Escalation notification design.
- `[TO DECIDE]` Email/push notification policy — out-of-app notification is a design
  surface too, and for a mobile-first owner persona possibly the most important one.
