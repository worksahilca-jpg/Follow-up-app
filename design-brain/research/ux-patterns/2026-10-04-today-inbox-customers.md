# Today, Inbox, Customers: three lists of the same people? — 2026-10-04

**The question:** does FollowUp need Today *and* Inbox *and* Customers, and if not, which one goes and what
does the one that stays become?

**Why this exists:** the founder, the morning after the three A-080 screens went live: *"today and inbox is same
no?"*, then *"we need to do a proper research right"*. Not a taste question: it is about what the owner opens
and why, so it runs through `workflows/research-workflow.md`.

## 1. The user problem

A one-person business owner opens FollowUp on the phone between two appointments, or at the desk first thing.
Two jobs, and only two: **(a)** answer whoever is waiting on me, **(b)** find one person I'm thinking of. Job (a)
is daily and interrupted; job (b) is occasional. If the app fails at (a) a customer goes cold; if it fails at
(b) the owner searches their own inbox instead and FollowUp looks like extra work.

## 2. What the brain already says

- **A-027** (2026-09-26): three places on the phone (Today · Inbox · Settings), four on the desk (Today · Inbox ·
  Customers · Settings), with a guard: *re-check the usage counts at 30 accounts before deleting any page's
  code.* We are at 11 accounts, 5 with any customer; this note is the first re-check, with that caveat.
- **A-046 / A-080**: Today is a short list with an end: only the people who need the owner now, one open.
- **Todoist study** (2026-09-26, P1 and P5): Today is finite; what is not for today lives *next to* it, not in it.
- **Laws of UX** (2026-10-03): say each fact once; Jakob's law (a screen should match the mental model of the
  category); Hick's law (fewer choices at the top level).
- **R-015, R-018**: the phone Inbox lost its filter chips and group labels; nothing rejects Inbox itself.

## 3. What the screens actually are today (read in code, 2026-10-04)

| Screen | Who is on it | Order | Opens |
|---|---|---|---|
| Today (`/dashboard`) | people whose reply is held for the owner's OK | longest waiting first | the reply card, Send |
| Inbox (`/inbox`) | everyone with at least one message | held first, then newest message first | the conversation, with the reply if one is held |
| Customers (`/leads`) | everyone, with places All · Needs you · Going quiet · Waiting | by place, then newest | the person panel: facts, conversation, reply if held |

Inbox and Customers are the same list with different sorting and a different side panel. Today is the "Needs
you" place of Customers with the reply in front. The phone shows Today and Inbox only; Customers is reached
from Settings (A-027). So on the phone, Inbox *is* the everyone list; on the desk there are two of them.

## 4. Production, read-only, 2026-10-04 (counts only)

| Businesses | Customers | Held for the owner right now |
|---|---|---|
| account A | 22 | 19 |
| account B | 16 | 16 |
| account C | 3 | 3 |
| account D | 1 | 1 |
| account E | 1 | 0 |
| six more | 0 | 0 |

Every account runs Assisted (A-070: every reply waits for the owner), and with few customers nearly every
customer has a held reply. So right now, for every real user, **Today, Inbox and Customers show the same
names**. That is the founder's observation, confirmed. It is a property of the first weeks of an account, not of
the design: at 100 customers with 3 waiting, the three screens would differ a lot. The question is which
shape is right for *both* moments.

## 5. Outside evidence (search snippets; grade B unless noted)

- **Gmail Priority Inbox** (Google research paper, Aberdeen & Pacovsky, 2010; TechCrunch 2010-12-06): about
  2,000 users spent 6% less time reading mail overall and 13% less time on unimportant mail once the important
  ones were split out, and were more willing to archive the rest. Grade A for the paper's own numbers. Lesson:
  splitting "needs me" from "everything" is worth it, and it was done as *two groups on one screen*, not two
  screens.
- **Superhuman "Important · Other"** (help centre and blog): one inbox split into two streams, Important
  (humans) and Other (automated), because reading everything in one list forces constant switching. Same lesson:
  one screen, two sections. They do not add a third list.
- **Things 3** (Cultured Code support, "An in-depth look at Today, Upcoming, Anytime, and Someday"): Today is a
  *filter* over everything, finite, for what you will do today; Anytime is everything actionable, and Today is a
  subset of it. Two lists that coexist because each has a distinct job: Today is the plan, Anytime is the pool.
  There is no third "all items with history" list; Anytime is it.
- **NN/g, "The same link twice on the same page"** and "Reduce redundancy": designers know two things are
  duplicates, users do not; each extra place to look is scanned and compared before the user can discount it,
  and users revisit the same thing by mistake. Lesson: two screens that show the same people cost attention
  every single day, not once.
- **Category peers** (from the 2026-09-26 navigation research): Podium centres on one Inbox for every channel;
  Follow Up Boss's phone app centres on People and Inbox. Two lists, not three: a place to answer and a place
  to find.

## 6. The usability traps for this screen type

Three lists of the same people means: the owner picks the wrong one and finds the person twice (NN/g); a
count on Today disagrees with what Inbox shows (already fixed once in A-045's lineage); a new user cannot
explain the difference, so they build the wrong mental model (Jakob); and every nav item is a choice (Hick).

## 7. Three concepts

**C1 — Keep all three, as now.** Today to answer, Inbox to read, Customers to find. *Optimises for:* nothing
changes, A-027 stands. *Sacrifices:* the duplication the founder saw, every day, for every small account; three
places that look alike at the top level.

**C2 — Two places: Today and Customers.** Inbox goes. Customers becomes the everyone list: held people on top
(the Needs-you place, as it already has), then everyone else newest-message first (Inbox's order), search on
top, and it opens the person panel (facts, conversation, reply). Phone tabs become Today · Customers · Settings;
desk sidebar Today · Customers. *Optimises for:* one place to answer, one place to find (Things 3's Today and
Anytime; Follow Up Boss's two); each fact once. *Sacrifices:* Inbox's conversation-first pane (the person panel
already shows the conversation and the reply, so little is lost); A-027's "Inbox" word, which some owners expect
(Jakob; Podium calls its everything list Inbox). The word can stay as the name if the founder prefers "Inbox"
to "Customers" for the everyone list; the point is two places, not the label.

**C3 — One place: Inbox with Today as its top group.** Gmail's and Superhuman's shape: one list, the held
people as the first group with the reply open on the desk, everyone else below. Today disappears as a tab.
*Optimises for:* one screen, zero duplication. *Sacrifices:* Today's end (Todoist P1, A-046): the list never
finishes because everyone else is always underneath; the calm "you're done" moment that peak-end keeps
(Laws of UX rule 7) is gone; and the phone loses the one-decision screen R-015 approved.

## 8. Recommendation

**C2.** Two places: **Today** (who needs you, one open, with an end) and **Customers** (everyone, the waiting on
top, newest next, with search). Inbox goes from the nav and its route redirects to Customers so old links and
the realtor's habit still land. Gmail's evidence says splitting "needs me" out is worth real time; Things 3 and
the category say two lists is the shape; NN/g says a third costs attention daily. It gives up only the name
"Inbox" and a second conversation pane that the person panel already covers.

**What it needs from the founder:** a yes, and the name of the everyone list ("Customers", as the desk already
says, or "Inbox"). **Guard kept:** A-027's rule stands in spirit; the Inbox code is kept behind a redirect until 30
accounts, not deleted.

## 9. What I'm unsure about

- With 11 accounts and 5 real ones, this is directional. The realtor (Monday 2026-10-06) is the first chance to
  watch someone choose between the two.
- Whether an owner coming from Podium or Follow Up Boss looks for the word "Inbox" and is lost without it. Cheap
  test: keep "Inbox" as the name of the everyone list for a week and ask.
- The held-first order on Customers must not become a second Today: on Customers the held people are plain
  rows, no reply card. The reply lives on Today and inside a person.
