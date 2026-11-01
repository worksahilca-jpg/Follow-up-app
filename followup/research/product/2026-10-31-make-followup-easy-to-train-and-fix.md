# Making FollowUp easy to train and fix (2026-10-31)

Founder, 2026-10-30/31: *"we need to develop our structure as well"* and *"Find all the ways that are weak we can improve
right so that in future too we dont have to worry we can train anything or fix anything keep it organised."*

This is the list of weak spots in **how FollowUp is measured, fixed and taught**, not in any one reply. Each item says
what is weak, what the fix is, and how we know (checked in the code or the database on 2026-10-30/31). The order at
the end is the recommendation.

---

## A. Seeing how good it is

**A1. Test results vanish.** The accuracy tests (`/admin/tests`) show a result on the page and save nothing: the
routes return the result and keep no record (`src/app/api/admin/conversation-eval/route.ts`). So there is no history,
no "better or worse than last time", and a refresh loses it. **Fix:** save every run (scores, each failure, cost, which
version of FollowUp) and show the change since the last run.

**A2. Only made-up chats, only realtors.** Every test case is invented (`CHAT_CASES`, `REPLY_CASES`,
`QUAL_EVAL_CASES`), and the whole-conversation test covers realtors only. The other kinds of business have playbooks
but no conversation test. **Fix:** a test set built from real realtor chats (the realtor's OK, names and numbers
removed), then a small set per kind of business.

**A3. The same test can pass, then fail.** On Oct 30 several conversation cases passed in one run and failed in the
next with almost the same message (run 3: 41/45, run 4: 37/45). Some of that is the AI varying, some is the checker.
**Fix:** when a case fails, run it twice more on its own; count it as failed only if it fails 2 of 3, and mark the case
"flaky" so it gets looked at.

**A4. Every run is all or nothing.** A row runs all its cases ($2–5 each; a full round of every row about $12–14, and
$41 went on tests on Oct 30). **Fix:** "Run only what failed" and "Run this one" buttons, and the price shown on the
button before it runs.

**A5. The checkers make mistakes too.** Several Oct 30 failures were the checker being wrong (a blank counted as not
answered, "if it's still on your list" counted as asking again). The Train page already checks its own checker
(A-321); the reply and conversation checkers don't. **Fix:** a small set of known-good and known-bad messages each
checker must mark right before its results count.

**A6. Real-life quality isn't watched in one place.** The data exists: every send records whether the owner changed
the draft (`FollowUp.draftEdited`, shown as "Drafts sent as written"), how much (0–1), and for businesses that turned
on "Help improve FollowUp" the before/after text, de-identified (`draftText`, `src/lib/admin-data.ts`). Nothing sums it
up by situation. **Fix:** one weekly summary: sent as written, edited, not sent, per situation (first reply, day-1/3/7
follow-ups, objections), with the edited examples from opted-in businesses.

## B. Fixing it

**B1. The rulebook is scattered and grows patch by patch.** FollowUp's instructions live in long text inside four code
files (the biggest, `src/lib/integrations/openai.ts`, is about 200 KB), and 19 dated patches went in on Oct 30 alone.
Rules started to clash ("the agent will…" in one place, "write as the agent" in another). **Fix:** one organised
rulebook: each rule with a name, why it exists, one example, and the test that proves it; then a pass to remove clashes
and repeats.

**B2. Every fix needs a developer and a deploy.** A wording fix is a code change, a PR, "merge" and a Vercel build. The
Train page can already hold rules per kind of business that are tested before they go live (A-319, A-320), but the
whole-conversation test doesn't run them. **Fix:** use Train rules for quick fixes, and make every test run with them,
so a fix can be made, tested and undone from `/admin/train` without a deploy.

**B3. No link between a rule and its tests.** When a rule changes we rerun everything. **Fix:** tag each test with the
rule it protects, so a change reruns only those (cents, not $14).

## C. Learning from real use

**C1. Almost no real use.** 35 AI calls for real customers in the 7 days to Oct 30 (one business sorting messages, a
few drafts). Without real chats every fix is a guess. **Fix:** testers using it daily, and the realtors' old chats as
tests (A2). This is the founder's part and the biggest one.

**C2. What FollowUp learned isn't reviewed.** It learns facts and style from what owners send, and lessons are tested
before use, but nobody sees a weekly list of what changed. **Fix:** add it to the weekly summary (A6).

## D. The steps themselves

**D1. Follow-ups pick their message by the day, not by what happened.** The plan gives day 1 "answer what's open",
day 3 "something new", day 7 "one small step", and so on (`stepHint`, `src/lib/followUpPlans.ts`). When there is
nothing new on day 14, the AI has to invent an angle, which is where most conversation-test failures were. **Fix:**
choose the message from the conversation: an open question, a home they asked to see, a budget worry, nothing at all
(then a short, kind check that asks one new thing).

**D2. To check: what happens to waiting drafts after an AI outage.** When credits ran out, messages still came in (the
sorting lets them in when it can't decide), but drafts couldn't be written. Not yet checked: whether those drafts are
written by themselves once credits are back.

**D3. Booking can't be changed or cancelled yet.** Planned for November (Stage 2).

## E. Safety nets and cost

**E1. Credits ran out twice, unseen.** Built: an email, a buzz and Slack on the first refused call, at most every 6
hours (PR #623, waiting for "merge").

**E2. Tests cost too much to run often.** A4 and B3 bring most runs under $2.

**E3. OpenAI can change the model under us.** The decision log records which model version answered every call.
**Fix:** an alert when that version changes, and the core tests run then.

## F. Keeping it organised

**F1. Knowledge is spread out.** BRAIN.md, design-brain, research notes and PR descriptions each hold part of why
FollowUp talks the way it does. **Fix:** the organised rulebook (B1) becomes the one place; BRAIN.md points to it.

---

## Recommended order

1. **E1** credits alert: built, waiting for "merge".
2. **A1 + A4** save every test run, "run only what failed", price on the button. Makes every later step cheaper.
3. **A3** flaky cases detected automatically.
4. **B1 + B3** one organised rulebook, each rule linked to its tests.
5. **A2** real-chat test set (needs the realtors' chats).
6. **D1** follow-ups chosen from the conversation, not the day.
7. **A6 + C2** weekly quality summary from real use.
8. **B2, A5, E3, D2** quick fixes from Train, checker check, model-change alert, outage retry check.

---

## Re-check after the night's work (2026-11-01, early morning)

The founder, 2026-10-31: *"please fix all 6 of them all together and then recheck what are the weaknesses"*. All on
branch `claude/followup-demo-to-production-4k39hr`, one PR, not merged. Every test passes (5,298), types, lint and the
production build are clean. Nothing below has been run against the real AI yet: that is one paid run, the founder's.

| Weak spot | Now | Where |
|---|---|---|
| A1 results vanish | **Fixed.** Every run is saved (`TestRun`): score, each failure, cost, version. The row shows the last run after a refresh and "since <date>: N now pass, M now fail". | `src/lib/testRuns.ts`, `/admin/tests` |
| A4 all or nothing | **Fixed.** The price is on every Run button before it runs; "Run only the N that failed (about $X)". | same |
| A3 pass, then fail | **Fixed.** "Check them twice more": a case fails only if it fails 2 of 3; a case that passed and failed on the same version is marked flaky. | same |
| B1 rulebook scattered | **Fixed, first version.** 42 rules in 6 areas, each with why, right/wrong example, the file and exact words it lives in (a test fails if those words disappear), and its tests. The "the agent" clash in the realtor playbook is removed. | `src/lib/rulebook.ts`, `/admin/rulebook` |
| B3 rule ↔ tests | **Fixed.** Each rule has "Run its N tests · about $X". | same |
| B2 fix without a deploy | **Was already there:** every test run uses the Train rules and examples in use for that kind of business. | `tradeLessons` |
| A2 only made-up realtor chats | **Half fixed.** 11 chats for 6 other kinds of business (own row). Real chats: paste one, see it cleaned (names → stand-ins; emails, phones, postal codes, links, @handles removed), keep it with who said OK. **Still needs the realtors' chats.** | `src/lib/conversationEval.ts`, `src/lib/realChats.ts` |
| D1 follow-ups by the day | **Fixed in the writer.** Open, new and step follow-ups first look for what the chat still needs (an unanswered question, a showing asked about, a worry), and only then use the day's angle. Unproven until the paid run. | `src/lib/followUpPlans.ts` |
| A6 + C2 real-life quality | **Fixed, numbers only.** Admin → Usage opens with the week: drafts sent as written / changed / typed / not sent by situation, what FollowUp learned, AI cost for customers vs tests; emailed on Monday mornings. Edited examples are not shown (H1: no message words on admin). | `src/lib/qualityWeek.ts` |
| E3 model changes under us | **Fixed.** The same summary flags a model version that answered this week and not in the 6 weeks before, and the email subject says so. | same |
| D2 drafts after an outage | **Partly answered.** OpenAI's "out of credits" is an HTTP 429, which `isTransientError` treats as "try again soon": the lead's claim is released and a later run writes the draft once credits are back. Not yet proven on a local run. | `src/lib/automation.ts` |
| A5 checkers make mistakes | **Not started.** | |
| C1 almost no real use | **Founder's part.** Unchanged. | |

### Found while checking (fixed tonight)

- A rule's run on the Rulebook saved other kinds' chats in the realtors' history. Each kind is now its own test.
- The weekly summary read every AI call of the week into memory; it now asks the database for totals.

### Weak spots that remain, or are new

1. **No real chats yet.** The box is built; it is empty until a realtor says OK.
2. **The night's changes haven't met the real AI.** D1 and the voice fix are only proven by the next paid run
   (realtor conversations about $3, other kinds about $0.80).
3. **Checkers are still trusted blindly (A5).** The next build: a small set of known-good and known-bad messages each
   checker must mark right.
4. **Real chats:** a street address or a workplace is not taken out automatically; the preview asks for it by hand.
5. **Prices are first guesses** until each test has one saved full run; then they come from the real cost.
6. **Package warnings:** 5 moderate warnings, all in Sentry's build tool (`glob`/`minimatch`, run only while building,
   on our own files). The only fix offered is a downgrade; wait for Sentry's update.
7. **The weekly summary is numbers only,** so it says *how many* drafts were changed, not *what* changed. Seeing the
   changes needs the opted-in examples, which admin can't show under H1.

---

## The accuracy loop: how to train and fix, cheaply (2026-11-01)

Founder, Nov 1: *"we got to make our process so strong and optimised, and keep it organised so that we can train the
accuracy."* With about $20 of AI credit, every step below is the cheapest one that still proves something.

1. **Find the miss.** It comes from one of three places: a draft an owner changed or didn't send (Admin → Usage →
   "This week with real customers"), a real chat a realtor shares (Admin → Accuracy tests → Real chats), or a test
   that failed.
2. **Turn it into a test case first.** A real chat goes in through "Add a real chat" (cleaned, with the owner's OK).
   An invented one goes into the test file next to the cases like it. No fix without a case that fails.
3. **Fix the smallest thing.** A rule for one kind of business goes on Train (tested before it's used, no deploy).
   A rule for everyone goes in the code, and into the Rulebook (`src/lib/rulebook.ts`) with its exact words, its
   reason and the tests that prove it.
4. **Run only what proves it.** "Run its N tests" on the Rulebook, or "Run only the N that failed" on Accuracy
   tests: cents, not dollars. A full run of a whole row is for after a model change or a big rule change.
5. **Check before trusting.** A case that fails once gets "Check them twice more": it counts only if it fails 2 times
   of 3. A flaky case gets a look, not a fix.
6. **Ship it.** One PR, the usual checks, the founder's "merge". The next week's summary shows whether owners change
   fewer drafts.

**What the money is spent on (Nov 1):**
- Writing replies, the "no" check and scoring run on the best model.
- Sorting emails, reading the checklist and the language read run on the usual model. Those two jobs were most of
  the bill, and both scored perfectly on it.
- Tests may spend at most $5 a day (`TEST_DAILY_BUDGET_USD`). Real customers' calls are never counted or stopped.
