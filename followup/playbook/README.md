# FollowUp's playbook

One page per kind of business, in plain words: **whom** FollowUp answers, **how it judges** them, **what** it
writes, **when**, **when it stops**, **what waits for the owner**, and **how it learns**.

- [Real estate](real-estate.md) (written 2026-10-22; the pilot's kind of business)
- Other kinds: not written yet. They have reply plans (A-296) but no checklist of their own.

## How the app remembers all of this

Three places, each with one job:

1. **The code holds the fixed rules:** when messages go, when FollowUp stops, what always waits for the owner, the
   checklist and the call. These only change through a reviewed change (a pull request), never by accident.
2. **The database holds what is learned:** facts about each business, each customer's checklist, the owner's plans,
   and the founder's trained rules and examples for each kind of business. Every reply reads them, every time.
3. **This playbook is the written copy for people:** what the app does, in words. It is updated in the same change as
   the code it describes.

**Accuracy tests** (Admin → Accuracy tests) check that the app still does what this playbook says: a fixed set of
messages with known right answers, run against the real model. A rule that matters gets a test.

## How to change a rule

1. Say what's wrong, in your own words (to Claude, or on Admin → Train → "Tell FollowUp what's wrong").
2. The change is made in the app (code or trained rule).
3. This page is updated with it, dated.
4. An accuracy-test case is added, so it can't quietly break later.

## For whoever changes the code

Where each section lives today, so a change to one updates the other:

| Section | Code |
|---|---|
| 1. Whom | `src/lib/integrations/openai.ts` (`classifyAsProspect`, `classifyWithSecondLook`), `src/lib/inbound/dmContactGate.ts`, `src/lib/senderVerdicts.ts` |
| 2. Judge | `src/lib/qualification.ts` (`REALTOR`, `tierOf`, `mergeQualification`), `src/lib/followUpCall.ts` |
| 3. What | `src/lib/integrations/openai.ts` (`TRUST_NOTICE`, `FOLLOW_UP_STEP_NOTICE`, `WARM_OPENING_NOTICE`), `src/lib/tradePlaybooks.ts`, `src/lib/replyTone.ts` |
| 4. When | `src/lib/followUpPlans.ts`, `src/lib/automation.ts`, `src/lib/sendWindow.ts`, `src/lib/metaWindow.ts`, `src/lib/theirMoment.ts`, `src/lib/stayInTouch.ts` |
| 5. Stop | `src/lib/automation.ts`, `src/lib/automationStatus.ts`, `src/lib/optOutKeywords.ts` |
| 6. Waits | `src/lib/holdReasons.ts`, `src/lib/grounding.ts`, `src/lib/replyTone.ts` |
| 7. Learns | `src/lib/businessFacts.ts`, `src/lib/trainingRules.ts`, `src/lib/training.ts`, `src/lib/ghlNotes.ts` |
| Tests | `src/lib/classifierEval.ts`, `src/lib/dmJudgeEval.ts`, `src/lib/qualificationEval.ts`, `src/lib/replyEval.ts` |
