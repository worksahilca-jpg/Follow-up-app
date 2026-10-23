# How FollowUp gets better by itself, safely

**Date:** 2026-10-23. **Asked for by:** the founder's *"find out how we can let the app develop itself: its judgment,
accuracy, what to say, what next step it should take"* and *"yes start step 1 and find all the solutions too"*.
**What this is:** the short version, for the repo, of a longer research report kept outside it (about 11,000 words, 13
build steps, sources marked by strength). The honest test (part of step 3 below) is live as [A-319](../../../design-brain/decisions/approved.md), and
the decision log (step 1) is live and the outcome records (step 2) are built; nothing else here is built or approved yet. Every law or platform point needs a lawyer's read before it drives a
decision.

---

## The answer in five lines

1. **At 50–300 conversations a month, FollowUp can't experiment on customers.** Proving that new wording lifts replies
   from 20% to 25% takes about 2,200 conversations: 7 to 44 months of all of FollowUp's traffic. A/B tests and
   "bandits" are out.
2. **The fast signals are the owners' own actions** (sent as is, edited, rewritten, not sent) and the founder's labels on
   a fixed, growing set of test conversations. Replies and bookings are slow guardrails and monthly checks, never
   targets: optimising for approval is how a well-known model update turned sycophantic.
3. **"Self-improving" means self-proposing.** The system proposes at most a few changes a week, each with real examples;
   each change is tested, tried small, then switched on for everyone with a one-tap undo. The founder approves. Nothing
   switches itself on.
4. **The biggest missing piece is a decision log**: per AI call, what the model saw, which rules and examples and which
   model it used, what it chose, what it cost, and what happened next. Without it no change can be measured or undone
   precisely, and every week without it is evidence lost for good.
5. **Two cheap gaps:** the model name is an undated alias the provider can change underneath FollowUp (pin a dated
   one), and the 20-message reply test can only see swings of about 20 points (so it's built to catch breaks, not to
   prove small wins).

## What the test can and can't tell (why A-319 is built the way it is)

- 20 messages at an 80% pass rate is about ±18 points of chance; 50 messages ±11, 100 ±8. A narrow rule touches two or
  three messages, so it can never "win" on the total.
- The same prompt doesn't give the same reply twice, even at temperature 0. So each message is answered **3 times** per
  side and passes only if **all 3** pass; better and worse are judged message by message, not on the total.
- The founder sees **only the messages that changed** (and those that fail either way), with both replies side by side
  and the reason in words. A message that got worse blocks "Put them to work" unless the founder says "anyway".
- A test counts only for exactly what it covered: add, change or drop a lesson and it needs a new test.
- One test run is about 120 drafts and 120 checks, roughly $0.60 at small-model prices. Cost isn't the limit; the
  founder's attention is.
- Still to add (step 3 below): one "A/A" run (the same lessons against themselves) to learn how many messages flip on
  chance alone, and 2–5 messages written for each new rule.

## Already enforced in code (checked 2026-10-23)

- Meta's 24-hour messaging window: automatic replies stop at 24 hours; the human-agent tag is used only when a person
  taps send (`src/lib/automation.ts`, `src/lib/integrations/instagram.ts`).
- CASL's 6-month stop for an inquiry with no reply (`src/lib/followUpPlans.ts`).

## The build plan, in order

1. **Decision log + pinned model.** Record each AI decision and its inputs; pin a dated model in `OPENAI_MODEL` and check
   the provider's retirement page monthly. Everything below depends on this.
   *Live 2026-10-23 (`AiDecision`, src/lib/aiDecisionLog.ts, PR #590): ids, models, time, tokens, cost and choices,
   never the words. Still to do: read which dated model answers, and the founder pins it.*
2. **Outcome events and edit records.** Reply, booking, "no", complaint and "went quiet" as timed events with windows;
   each draft's edit size and the owner's action.
   *Built 2026-10-23 (`src/lib/decisionOutcome.ts`, `src/lib/decisionOutcomeData.ts`): each sent or turned-down draft
   is linked to its AI call, with the owner's action, the edit size and the customer's outcome (3 days to reply, 14 to
   book). No screen until the weekly review (step 7).*
3. **Finish the honest test.** A/A run, targeted messages per rule, code checks that block.
4. **Check the checker.** The founder labels about 60 drafts; the AI grader's catch and false-alarm rates are recorded;
   checks that disagree with the founder stay advisory.
5. **Next-step answer key + a "no" safety layer** (any of several tries says no → stop or hand over). Changes behaviour:
   the founder's yes first.
6. **Lesson-set versions and a rollout ladder:** replay, silent run, one business, then everyone, with kill switches.
7. **Weekly review with at most three proposal cards.** UI, so it goes through the design-brain loop.
8. **Grow the test set from real life** (through Train's consent path), including email and French.
9. **Learn better from edits** (readable per-business preferences the owner can see and veto).
10. **Monitoring:** daily checks, cost alerts, a weekly re-run to catch provider drift, a monthly outcome table.
11. **Privacy notice, terms and retention**, after a lawyer's read.
12. **Only then:** logged 50/50 choices between two already-approved strategies.
13. **After about 100 bookings:** check that "Ready" really books more often.

**Not to build:** fine-tuning (closing to new users), bandits, a model per business, anything that switches itself on,
rating buttons for owners ([R-137](../../../design-brain/decisions/rejected.md)), and any target based on reply rate.

## Open questions

**For the founder:** ~~reply and booking windows~~ (decided 2026-10-23: 3 days to reply, 14 days to book); drafts-only during a one-business
trial; "any try says no → stop"; a second OK before one business becomes everyone (changes A-319); a different model as
the grader; may de-identified Train conversations be examples for other businesses or only tests; 30 minutes a week for
the review.
**For a lawyer:** whether a later message restarts CASL's 6 months; whether automated DM follow-ups are commercial
messages; Law 25 and automated decisions; consent for use across businesses; Bill C-34; Meta's terms on DM content;
human-rights codes and lead triage; how long a decision log may be kept.
