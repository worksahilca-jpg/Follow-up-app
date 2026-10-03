# Design research: "all of it, too much stuff" — a density audit of the app (2026-10-03)

**The question:** on each screen, what is the least a busy owner needs in front of them to do that screen's one
job, and what on the screen today is there for any other reason?

**Trigger:** founder, 2026-10-03, after a day of watching the product through a reviewer's eyes (two demo
recordings) and a realtor's account: *"our product looks way too complicated"*. Asked which screen and whether
density or words: *"all of it, too much stuff"*. Recorded as [[rejected#^R-026|R-026]].

---

**The problem:** the owner is a realtor (or contractor, salon owner) at a desk between calls, opening FollowUp
to find out who is waiting and press Send. They are not a software person and will not learn the screen. The
cost of failure is specific: they glance, see a wall, close the tab, and the held replies stay held, which is
the exact outcome FollowUp exists to prevent. The founder's reaction *is* that glance.

**What the design brain already says:**
- Principle 4 (busy, not a software person), 8 (polish by subtraction, "what can be removed? remove it"),
  9 (fewer things beats a clearer explanation of many). Principle 2: urgency stated once.
- [[rejected#^R-015|R-015]]: the phone gets one decision per screen. [[rejected#^R-001|R-001]]: subtraction
  *alone* reads as unfinished; the structure has to come from the owner's job, then subtract to it.
- Locked shapes: [[approved#^A-025|A-025]] (desktop direction), [[approved#^A-031|A-031]] (handled line),
  [[approved#^A-045|A-045]] (numbers as one line), [[approved#^A-046|A-046]] (calm Today), [[approved#^A-067|A-067]]
  (Today built to its drawing), [[approved#^A-069|A-069]] (Settings as one list, the customer's side column).
  Several of the items this audit names were approved one at a time. Each was reasonable alone; together they
  restate the same fact several times. Changing them needs the founder's yes, which is what this note asks for.

**References consulted:** the three simplicity studies already in the brain. Todoist
(`2026-09-26-todoist-calm-attention.md`): Today is a short list with an end; the order *is* the priority, so no
flags to read. Calendly (`2026-09-26-calendly-one-job-simplicity.md`): one object you can hold, defaults do
the work, most people never open settings. Stripe (`2026-09-26-stripe-complexity-to-simplicity.md`): the
first layer is complete on its own; depth is there when sought. None of them puts a second summary above a
list of one.

**Research conducted:** none new outside the brain, because the question is answerable by counting. Method:
the app rendered locally on 2026-10-02 (a one-customer account, which is the *least* each screen ever shows)
and every element counted and sorted by the job it serves. The Monday 2026-10-06 realtor meeting is the first
observation; the one thing to watch is where his eyes stop before he presses Send.

**Confidence:** high on the counts (they are the screen), medium on which items to drop (that is the
founder's call and the realtor's behaviour), low on anything about new users (we have one active tester).

---

## The counts, screen by screen (one customer, desktop)

A screen's job, then what is on it. "Restates" means it says again something already on screen.

### Today — job: see who is waiting, press Review/Send

| # | Element | Serves the job? |
|---|---|---|
| 1 | Date, headline "1 customer is waiting on you." | yes, the one fact |
| 2 | "Start with Priya, who has waited 28 minutes." | restates 1 and the card (A-046) |
| 3 | Progress bar + "0 of 1 handled today · When the list is empty…" | restates 1 (A-031) |
| 4 | "Needs you 1 · Waiting on customers 0 · Handled today 0" | restates 1 and 3 (A-045) |
| 5 | Section label "NEEDS YOU · 1" + "Longest waiting first" | restates 1 and 4 |
| 6 | The customer card: name, channel, their words, wait, Later, Review | **the job** |
| 7 | Coming up card: "Nothing planned for the next seven days." + Booked calls | half: a booked call is useful; "nothing planned" is a label for nothing |
| 8 | Setup banner when nothing can send | yes, once, only when true |

The fact "one customer, Priya, waiting" appears **five times** before the card. That is the wall.

### Customer page — job: read what they wrote, read the reply, press Send

Left column: the thread and the reply card. Right for the job. Right column, top to bottom:

| # | Element | Serves the job? |
|---|---|---|
| 1 | State pill "Needs you" | restates the page header pill |
| 2 | "Why it's here: Your account holds every automated message…" | yes once; this is the hold reason (principle 6) |
| 3 | Waiting 8 min | yes, small |
| 4 | Language: Not read yet | no, almost never |
| 5 | Came from: Gmail | restates the header line "Email · first message 28 min ago" |
| 6 | Stage: New ▾ | rarely; folded from Pipeline (A-027) |
| 7 | Assigned to: Local Owner ▾ | no, on a one-person business |
| 8 | We talked · Copy booking link · Email | yes, these are actions |
| 9 | "Replies can't go out yet…" warning | yes, only when true |
| 10 | "How it handles Priya": three-way switch + two explanatory lines | a setting, not the job; and it duplicates Settings |
| 11 | Why it may write to Priya ▾ | depth, rarely opened |
| 12 | What FollowUp did ▾ | depth (principle 6 says keep it reachable) |
| 13 | Follow-up plan ▾ | depth |
| 14 | About Priya ▾ | depth |
| 15 | Not a customer · Delete this customer | rarely |

Fifteen items beside a reply that needs one press. Four of them (4, 5, 7, 10's explanation) carry nothing on a
one-person realtor's account. The four expanders are *already* collapsed and still read as four more things.

### Settings — job: connect an inbox, change how replies are held, find one thing

Left: the follow-up plan card (4 rows), the Pause card, and "Everything else", eight links to pages A-027 folded.
Right: a status card, then **17 rows in 6 groups** plus a "For advanced setups" group of three. About 30
targets on one screen. Half are "Not set up".

### Inbox and Customers — job: find a conversation / find a person

Inbox: three panes, one label, one dot. Fine. Customers: four tabs with counts, Filter, More, Add customer,
a five-column table, a footer line that restates the count. The footer line and "More" are the only
surplus.

### The sidebar (every screen)

Business name, bell, search, Today with a count, Inbox, Customers with a count, Settings, "Something broke?",
Sign out. Nine things, two counts. Fine; the counts restate Today's headline but they are the navigation's
job.

---

## Usability traps for this screen type

- **The dashboard that proves it is working.** Counts, progress, "0 of 1": each was added so the owner trusts
  the product is on top of things. Together they ask the owner to read four numbers to learn one.
- **Depth shown as surface.** A collapsed accordion still occupies a row and a label. Four of them are a list.
- **The settings page that is also a sitemap.** Thirty targets so that nothing is unreachable; the result is
  that nothing is findable.
- **Facts for the team on a one-person account.** Assigned to, Language, Stage: true, present, useless to the
  ICP today.

## Our opportunity

FollowUp knows which one person needs the owner and why. The screen can therefore be *that person*, and
nothing else, until the owner asks for more. No competitor in the brain's benchmark does this; they all show
the list and the metrics and let the owner prioritise. That is the structural idea R-001 asked for: not
"less", but **one person, then the rest on request**.

---

## Concepts

### C1 — Say it once (same structure, each fact stated one time)
Today keeps its shape and drops the restatements: headline, the card(s), Coming up only when something is
coming. The start line, progress bar, counts line and section label go; the week line at the foot stays as
the one number. The customer page keeps the two-column layout; the side column becomes three facts (why it's
here, waiting, came from), the three action buttons, and **one** "More" row that opens the rest. Settings
loses the "Everything else" link grid and the status card merges into the Email row.
*Optimises for:* consistency with every approval; nothing new to draw. *Sacrifices:* it is still a dashboard;
R-001 may apply if it reads as "only subtraction".

### C2 — One person (Today opens on the person, like the phone)
Desktop Today becomes the phone's A-067 shape: the first customer open on the right with the reply and Send;
the list of who else is waiting on the left, names and waits only. No counts anywhere but the sidebar. The
customer page *is* this view, so the side column disappears into a "Details" sheet that slides over when
asked. Settings as C1.
*Optimises for:* one decision per screen on every device; the structure R-001 wants. *Sacrifices:* Coming
up and Booked calls lose their card (they become one line under the list); A-046's "start with" line and
A-031's end line both go, which needs the founder to un-approve them.

### C3 — Progressive desk (density by account size)
Everything stays, but each extra (counts, progress, Assigned to, Stage, the expanders) appears only once the
account has earned it: a team of two gets "Assigned to", ten customers get the counts line, a connected
calendar gets Booked calls. A one-customer screen is as bare as C2.
*Optimises for:* nothing is deleted, so nothing is argued over. *Sacrifices:* two products to test and keep
consistent; the founder's own account would still look "too much" the day it crosses each threshold, so it
treats the symptom.

---

## Recommendation

**C2, with C1's Settings.** The founder's words were about all of it, and the phone rule already
approved for the small screen ("one screen = one decision") is the right rule for the desk too; the desk only
has more room for the *same* one decision. C2 is a structure, not a trim, which answers R-001. What it
costs: three approved lines (A-031, A-045, A-046's start line) leave Today, and A-069's side column becomes a
sheet. What would change my mind: the realtor on Monday reading the counts line and acting on it. If he
never looks at it, it goes.

**Order of work, if approved:** draw it first (A-067 rule: a screen is compared with its board), one board
per screen, founder picks, then build Today → customer page → Settings, one PR each.

## What I'm unsure about

- Whether "too much" includes the reply card's wash (A-025 as amended by R-018). I read "stuff" as count,
  not colour, so the card stays.
- Whether the founder wants the counts gone or merely quieter. C2 removes them; C1 keeps one at the foot.
- Whether Coming up is loved (it was in the drawing he approved) or tolerated. C2 demotes it to a line.
- One active tester is thin evidence. Monday is the first real observation and may overturn any row above.
