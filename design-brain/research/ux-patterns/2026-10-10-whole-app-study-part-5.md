# Whole-app study, part 5: the plan, for the founder's yes (2026-10-10)

**Asked:** *"start part 5"*. Earlier, about part 2's questions: *"I don't know what these are, but keep doing"*, so
this page uses the recommended answers from part 4 and lets him say yes or no to each.

Page (private): https://claude.ai/artifact/6m6pkjSZK25r9ZkW5umnLt. Each decision has **Yes / No / Not sure** and an
optional note. Answers save on the page (the page's own database, collection `answers`, one document per decision
`d01`–`d16`) and are read back from there. **Status: proposed. Nothing below is approved until he answers.** When he
does, record each yes in `decisions/approved.md`, each no in `decisions/rejected.md`, and date it in
`decisions/design-decisions.md`.

Built from parts 1–4 (same folder). Numbers are production, last 30 days, read-only aggregates.

## The plan in one sentence

FollowUp does the work and comes to you when it needs a decision. The app is where you check, not where you work.

## The 16 decisions

Each one is labelled: **looks** (presentation only), **does** (changes what FollowUp does: product behaviour, the
founder's call), or **costs** (spends money).

**Reach you when a customer needs you** (problem 1: 306 replies waited, owners sent 13; one phone ever had alerts)
1. *Does.* Setup asks how to reach you: phone alerts, a text to your phone, or email. It sends a test, and you see it
   arrive. On iPhone it walks you through Add to Home Screen first (WebKit: web push needs a Home Screen web app).
2. *Does.* One alert per decision, on the way you chose; tapping it opens that one reply with Send. The bell becomes a
   list of recent alerts.
3. *Costs.* "A text to your phone" is one of the ways (a few cents per text).

**Ask you less** (11 of 13 owner-sent replies went out unchanged; matches "only decisions go to the owner")
4. *Does.* New accounts start on Automatic. Prices, dates, tense moments and anything unsure still wait. "Ask me first"
   stays one tap away.
5. *Does.* Existing accounts get the offer once, on Today, with their own number. Nothing changes unless they say yes.

**One customer, one card** (problem 2)
6. *Looks.* One customer card everywhere (Today, beside Customers, their page), same facts in the same order.
7. *Looks.* Today shows one decision at a time, then Next. When nobody needs you, it says so and shows what FollowUp
   did. (Confirms A-209 inside the bigger plan.)

**One home for each decision** (problem 3)
8. *Looks.* "Who sends without asking" is one choice in one place; Team's "Only admins send" sits next to it.
9. *Looks.* Facts are taught at the blank in a reply and reviewed in one list; Teach FollowUp folds into that list.
10. *Looks.* The follow-up plan lives in one place; each customer shows only the next step ("Next check-in Tue").

**A small Settings** (problem 4: 54% of the app's words; about 15 changes in a month)
11. *Looks.* First Settings screen: where customers write, how it sends, how we reach you, your business. Team, plan,
    data and advanced go under More.
12. *Looks.* Filtered-email sorting ("This was a lead") moves to Customers as "Not customers".

**Show the good things** (problem 5)
13. *Looks.* "What FollowUp did" opens from Results and shows as a short timeline on each customer.
14. *Looks.* A "Ready for you" group at the top of Customers for hot leads: what they want, when, budget.

**Remove and measure**
15. *Looks.* Remove the Waiting page, the second feedback box and the State column; Pipeline becomes a filter on
    Customers.
16. *Costs.* Turn on page analytics after a price check (today only app opens are known).

## Proposed build order (after his yes)

1. Fix the Help window bug (live since step 1: the feedback window opens under the page) and make phone alerts work
   (1–3).
2. How it sends (4, 5).
3. One customer card, Today one at a time (6, 7).
4. Small Settings, one home per decision (8–12).
5. Customers: Ready for you, the log on each customer, the clean-up (13–15).
6. Page analytics (16).

Each step: drawn on the real app first, shown to him, built, merged only on "merge".

## Weak spots, said plainly

- Decisions 1–5 change product behaviour. The page labels them, but a yes on a page is lighter than a conversation;
  check 4 again before building it.
- The number behind 4 and 5 (11 of 13) is small. It points one way; it doesn't prove it.
- Decision 3 has no price on the page beyond "a few cents". Check the real Twilio rate before building.
- PR #471 (step 2 Today) overlaps with 6 and 7. If he says yes to both, it gets redone on the shared card rather than
  merged as it is.
