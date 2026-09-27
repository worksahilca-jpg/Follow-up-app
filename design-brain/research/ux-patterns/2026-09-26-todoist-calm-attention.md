# Todoist: calm prioritization, clearing work, knowing what needs you now

**Date:** 2026-09-26 · **Asked by:** Sahil · **Status:** STUDIED, proposals pending approval

**Question:** How does Todoist make a list of work feel calm and finishable, and make it obvious what needs
attention *now*? Where should FollowUp's Today do the same?

Sources are Todoist's own help and inspiration pages plus third-party write-ups (listed at the end). These are
principles only. We don't copy screens, the mascot, or the Karma system.

---

## What Todoist does

- **Today is finite.** "Only tasks with a date appear in Today." It's a short, closed list, not everything you own.
  Undated work lives elsewhere.
- **Overdue gets its own small section at the top, with one fix:** a single "Reschedule" button next to it. The
  backlog doesn't spill across the day.
- **You can push work to later without deleting it.** Postpone to tomorrow, or rebalance everything with
  "Reschedule". It comes back on its own.
- **Order does the prioritising.** The highest priority sits at the top, "so you'll know exactly what to work on
  first". The list is sorted; you don't have to scan it.
- **Upcoming** is a separate, calm view of what's scheduled next, day by day. It's not mixed into Today.
- **An empty list is a finish line.** "No tasks. You're all done!" (#TodoistZero) is a moment, not a dead end.
- **What we don't take:**
  - Karma: points, streaks, and points *lost* for overdue tasks. Users call streaks "addictive". That's
    pressure, not calm, and FollowUp has already ruled out streaks (A-031, A-038).
  - The dancing mascot.
  - Red priority flags.

### The principles underneath

- **P1: Today is a short list with an end.** Only what needs the owner today, and a visible finish.
- **P2: Order is the priority.** The first card is the one to do first. No flags to read.
- **P3: Waiting is a fact about the customer, not a judgement about the owner.** "Priya has waited 5 hours", never
  "overdue" or "you forgot" (see also the 2026-09-25 benchmark's warning about Gmail nudges).
- **P4: Later is allowed, and it comes back by itself.** Deferring must never mean forgetting.
- **P5: What's coming next lives next to Today, not inside it** (the "Coming up" view, already queued).
- **P6: Finishing is quiet and real.** A calm "you're done for today" plus what FollowUp keeps watching. No confetti,
  points or streaks.

---

## Where FollowUp's Today stands (checked in main, 2026-09-26)

**Already right:**
- "Needs your OK" is the work list. A card leaves when it's handled.
- Drafts needing judgement sort above routine ones (`compareApprovals`).
- There are no streaks or points anywhere.

**Gaps:**
1. **No wait time on the cards,** and within each group the order is "newest held first". So the customer who has
   waited *longest* sinks to the bottom. That's the opposite of P2 and P3. (Also flagged in the 2026-09-25
   benchmark P2.)
2. **The line above the queue shows a bare score:** "Start with Priya — Instagram, scored 72". A number nobody can
   act on (brand principle 6).
3. **Today has no visible end.**
   - "1 of 5 handled today · When the list is empty, you're done for today" was **approved (A-031) but never built**.
   - The empty state is just "Nothing needs your OK right now."
4. **The same person can appear twice.** "About to be lost" doesn't leave out people already in "Needs your OK".
5. **No "later".** A card can be sent, edited, marked "We talked", or dropped with "Don't send". An owner who can't
   deal with it this minute has no way to say "later today" except leaving it to nag. (A snooze API exists, but
   nothing on Today uses it.)
6. **No "what's next" view.** That's "Coming up", already proposed and queued.

---

## Proposals (ranked)

1. **Longest-waiting first, with the wait on the card (P2, P3).**
   - Inside "Needs your OK", sort by how long the *customer* has waited. Drafts needing judgement still come first.
   - Each card says "Waiting 5 h" (or "since yesterday") as a plain fact.
   - The line above becomes "Start with Priya. She's waited 5 hours and asked about price." It's built from the
     hold reason and the wait. No score.
2. **Today has an end (P1, P6).**
   - Build A-031's line on desktop.
   - When the list is empty: "You're done for today. FollowUp keeps watching and will tell you when someone writes."
   - One real fact follows, for example "3 check-ins go out tomorrow" (from Coming up).
   - No confetti, points or streaks.
3. **Each person appears once on Today (P1).** Anyone already in "Needs your OK" is left out of "About to be lost",
   so the second list is only people who need something else.
4. **"Coming up" as its own quiet section (P5).** The queued design: who FollowUp will write to next, grouped by day
   ("Tomorrow · Thursday"). On desktop it's beside or below Today's list. On the phone it's one line that opens the
   list (R-015).
5. **"Later today" / "Tomorrow" on a card (P4). This is a product-behaviour change, so it's Sahil's call.**
   - The card leaves Today and comes back at 2pm or tomorrow morning by itself.
   - If the customer writes again, it comes back at once.
   - The draft is kept.

**Guardrails:**
- No Karma-style points, streaks or penalties, and no "overdue" or "you forgot" wording (P3).
- No red priority flags. The order carries priority, and desktop keeps its muted state dots (A-029).
- The phone stays minimal: one decision per screen (R-015).
- Not subtraction-only (R-001). Proposal 2 adds a designed finish, and 4 adds a view.

**Rejected-list check:** clean. It doesn't repeat R-001: each proposal adds something, and the ordering and wait-time
facts are among the moves R-001 said "may survive inside a richer design". It doesn't repeat R-015, since the phone
gets one line for Coming up, not a list.

---

## Sources

- Todoist help:
  - [Plan your day with the Today view](https://www.todoist.com/help/articles/plan-your-day-with-the-todoist-today-view-UVUXaiSs)
  - [Plan your week with the Upcoming view](https://www.todoist.com/help/todoist/get-started/plan-your-week-with-the-upcoming-view-OKOg1mR8)
  - [Introduction to priorities](https://www.todoist.com/help/articles/introduction-to-priorities-Wy82Jp)
  - [Introduction to Karma](https://www.todoist.com/help/todoist/features/introduction-to-karma-OgWkWy)
  - [Productivity view](https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9)
  - [2026 changelog (#TodoistZero)](https://www.todoist.com/help/todoist/product-updates/2026-changelog-HD3jJAtLd)
- Todoist inspiration:
  - [Upcoming view](https://www.todoist.com/inspiration/todoist-upcoming-view)
  - [How to use Todoist effectively](https://www.todoist.com/inspiration/how-to-use-todoist-effectively)
  - [Eisenhower matrix](https://www.todoist.com/productivity-methods/eisenhower-matrix)
- Others:
  - [Doist: inbox zero with Todoist](https://medium.com/ten-timezones/the-two-step-process-for-getting-to-inbox-zero-with-todoist-ef044837d13f)
  - [Eleken: empty state UX](https://www.eleken.co/blog-posts/empty-state-ux)
  - [Dandy With Lens: Todoist Karma](https://www.dandywithlens.com/todoist-karma/)
