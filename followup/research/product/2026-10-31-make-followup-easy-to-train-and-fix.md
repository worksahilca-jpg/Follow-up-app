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
