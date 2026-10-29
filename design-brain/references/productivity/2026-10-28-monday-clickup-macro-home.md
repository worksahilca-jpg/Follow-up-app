# How monday.com, ClickUp and Macro make their "today" screen (2026-10-28)

**Why:** the founder, after rejecting the calmer Today (R-144) and saying the app "doesn't feel like working":
*"can you check monday clickup and macro how they do it ??"*. **Evidence, honestly:** grade B. Every site (support.monday.com,
help.clickup.com, docs.macro.com, macro.com) is outside this computer's allowed network, and Mobbin needs a paid plan, so
**no screen was seen**; everything comes from search-engine summaries of the companies' own help pages, marked **Doc**,
or of forum posts, marked **Forum**. Principles only; nothing is reproduced (brand rule 6).

| Product | Its "today" | What's on top | How it feels alive | Source |
|---|---|---|---|---|
| **monday.com — My Work** | A list of everything assigned to you, across every board, grouped by date: **Overdue, Today, This week, Next week, Later, Without a date** (everything beyond 14 days is "Later"). Mobile: the same, as cards or a list. | Overdue. | It doesn't, by itself: it is a to-do list. Users complain items vanish past a 1,000-item cap and that changes take time to show. | [monday support: My work](https://support.monday.com/hc/en-us/articles/360019300579) (Doc), [new layout](https://support.monday.com/hc/en-us/articles/9516773224466-My-work-new-layout) (Doc), [forum: the groups](https://community.monday.com/t/add-groups-to-my-work-section-e-g-split-later-into-this-month-next-month-this-year-next-year-etc/84030) (Forum) |
| **ClickUp — My Tasks (was "Home")** | A canvas of cards you add, reorder and remove: your tasks by day, an agenda, reminders, a short pinned list ("LineUp"), recents, assigned comments, and an **AI StandUp card that writes a short summary of your work from the last 24 hours to 7 days**, which you can regenerate or copy. Private tasks are left out. | Whatever card you put first; the AI StandUp is listed first in the help page. | The StandUp: a written "here's what happened" at the top, from the data, re-made on demand. | [ClickUp help: My Tasks](https://help.clickup.com/hc/articles/6308921446935-Home) (Doc), [AI StandUp card](https://help.clickup.com/hc/en-us/articles/21021454281239-Use-the-AI-StandUp-card-in-My-Tasks) (Doc) |
| **Macro — Inbox** | One inbox for email, chat messages, mentions, task assignments and the AI agents' answers, split into **Signal** ("what needs your attention") and **Noise** (everything else; newsletters, receipts, promotions filed away). An item sits in Signal while it has an open notification and was active in about the last two weeks; "Done" clears it. Email has a stricter bar: important, and not merely shared with you. Calls never appear. AI drafts replies from the workspace's context. | Signal. | Items arrive and leave as the world moves; AI answers land in the same list as people's messages, so the assistant's work is visible beside everyone else's. | [Macro docs: Inbox](https://docs.macro.com/product/inbox) (Doc), [getting started](https://docs.macro.com/getting-started) (Doc), [macro.com/email](https://macro.com/email) (Vendor) |

## What they have in common

1. **All three open on a list of things, not on numbers.** None opens on a dashboard.
2. **"Needs you" is apart from everything else, and first.** Overdue (monday), Signal (Macro), the first card (ClickUp).
3. **The two that feel alive are the two where something other than the user writes into the list:** Macro's agents answer
   into the same inbox as people; ClickUp's StandUp writes a summary of what happened. monday's My Work only moves when
   you move it, and it is the one people call a chore in the forum.
4. **Grouping by day is the norm for a to-do list** (Overdue, Today, This week). FollowUp's queue is not a to-do list, so
   this is not borrowed.

## For FollowUp's Today (the "FollowUp working" drawing, 2026-10-28)

- **Take:** ClickUp's StandUp idea, but as facts, not a generated paragraph: "Since you last looked, FollowUp answered 4
  people, booked 1 call…" then the rows with names, times and the words sent. (Brand rule: AI is invisible capability;
  a written summary can drift from the truth, rows can't.)
- **Take:** Macro's "the assistant's work lands in the same list as people's messages": FollowUp's replies sit beside
  the customers' words, in one place, with "FollowUp wrote" / "you wrote" always said (A-089).
- **Take:** Signal first: "Needs you" stays near the top and small; "Noise" is already A-088's one line.
- **Don't take:** monday's six date buckets (a to-do taxonomy), ClickUp's build-your-own canvas of cards (the owner
  shouldn't assemble their own page; R-115, "fewest, simplest words"), Macro's keyboard-first speed (R-002).
