# FollowUp's sales engine: what exists today, and the plan

**Date:** 2026-10-22. **Asked for by:** the founder's "AI sales assistant engine" brief (phases 1–10).
**What this is:** phase 1 only: an audit of the code as it stands on `main` at `4e50c5c`, one message traced end
to end, the gaps, and the exact order of work. **No code was changed for this document.** Every status below was
checked in the code on the date above; where something could not be checked, it says "not verified".

---

## For the founder, in short

**What already works.** FollowUp already does most of the job for a realtor: it tells customers from everyone else,
fills in a checklist from the customer's own words, makes the Ready / Warm / Later / Has an agent call, writes the
reply, holds anything risky for the owner, follows up on a plan, stops when it should, and never sends the same
message twice. All of it is covered by about 4,500 automatic checks and 4 accuracy tests.

**What's missing.**
1. FollowUp shows its next step but doesn't **remember** what it recommended or whether it worked.
2. It doesn't keep a **history** of each customer's call (Warm on Monday, Ready on Thursday).
3. It doesn't remember **objections** ("we already have an agent", "too expensive") or questions it hasn't answered.
4. The 4 accuracy tests use **invented** messages, keep **no history** of past runs, and nothing stops a change
   that makes them worse.
5. **Booking** works only through the booking link: no times offered in the chat, no way to move or cancel a call,
   and the owner isn't told the moment someone books.

**What's risky, and should be fixed first.** When you teach FollowUp on Admin → Train, your rule or example reaches
**every realtor's next reply immediately**, with no test first and no way to see which version was live when. That is
the one place where one wrong sentence could change hundreds of replies at once.

**One correction.** The "720 conversations" in the brief are **720 checklist answers inside 58 invented
conversations**, not 720 real conversations. The training saved in the live app today is small: 1 practice
conversation, 2 examples and 1 rule for real estate, and 3 owner examples (read-only count, 2026-10-22).

**Recommendation:** start with step 1 below (training goes through a test and your OK before it reaches every
realtor). It is small, it protects everything after it, and it changes nothing a customer sees.

**Decisions only you can make** are listed in section 7 (7 of them, each with a recommendation).

---

## 1. One message, end to end (as the code does it today)

A buyer emails a realtor: *"Hi, is 42 Elm St still available? We're pre-approved and need to move before March."*

| # | What happens | Where in the code |
|---|---|---|
| 1 | Every 2 minutes the Gmail job reads new mail (Outlook, Instagram, Messenger, GoHighLevel and the web form arrive by their own jobs or webhooks). | `app/api/cron/gmail-sync`, `lib/integrations/gmail.ts` (`fetchSalesConversations`) |
| 2 | **Is it a customer?** The model reads it; if it isn't sure, it reads it a second time. Set-aside mail is kept in "Filtered out", never deleted. | `lib/integrations/openai.ts` (`classifyWithSecondLook`), `FilteredEmail` table |
| 3 | A customer is created once per conversation (the conversation's id is unique, so a re-read can't make a second one). | `Lead`, `Conversation.externalId` unique |
| 4 | **Can AI run?** Plan, switches, and caps: 30 AI runs per customer and 500 per business a day. | `lib/billing.ts` (`checkAiEligibility`), `lib/scoring.ts` caps |
| 5 | **Score:** a 0–100 score with a reason and factors, and three flags: said no, asked "are you a bot?", only said thanks. | `lib/integrations/openai.ts` (`scoreLead`) |
| 6 | **Checklist:** every item quoted from the customer's words (area, when, money, viewing, agent…), merged with what was already known so nothing is forgotten. | `extractQualificationFacts`, `lib/qualification.ts` (`mergeQualification`) |
| 7 | **The call:** fixed rules turn the checklist into Ready / Warm / Later / Has an agent. Here: pre-approved + moving within 3 months → **Ready** (if the agent question was answered or asked). | `lib/qualification.ts` (`tierOf`) |
| 8 | **The reply:** written with the business's approved facts, the owner's examples and way of writing, the founder's trained rules and examples for real estate, and the trade's question order. | `generateFollowUpMessage`, `lib/businessFacts.ts` (`draftingContext`), `lib/trainingRules.ts`, `lib/training.ts`, `lib/voice.ts` |
| 9 | **Checks on the reply:** "is 42 Elm St available?" can only be answered by the owner, so this reply **waits** (reason: availability). Other hold reasons: a number, price, time, day or fee nobody wrote; "booked"; "already sent"; a policy; "are you a real person?". A pushy reply is rewritten once, then held. | `lib/grounding.ts`, `lib/holdReasons.ts`, `lib/replyTone.ts` |
| 10 | Saved on the customer; the owner's CRM (GoHighLevel) moves them to the stage the owner picked for Ready, and gets a note. | `lib/crm/stages.ts` (`moveLeadForTier`), `lib/ghlNotes.ts` |
| 11 | **The owner is told:** a phone buzz and an email, once per customer, that someone is Ready. | `lib/ownerAlerts.ts` (`findReadyCustomers`), `app/api/cron/owner-alerts` |
| 12 | **Today** shows the held reply with one line saying why. The owner adds the answer, then Send. | `lib/pendingApprovals.ts`, `ApprovalQueue.tsx` |
| 13 | **Send:** one claim per customer per message text, so a double tap or a retried job can't send it twice. Logged. | `lib/sending.ts` (`sendFollowUpToLead`), `SendClaim` unique, `AuditEvent` (`ai.send`, `lead.send`) |
| 14 | **If they go quiet:** the hourly job follows the plan (Fast: day 1, 3, 7, 14, 30), 8am–8pm only, at most 1 a day and 3 a week, stopping 6 months after their last message, or at a booking, a reply, a no, STOP, or an agent. | `lib/automation.ts`, `lib/followUpPlans.ts`, `lib/sendWindow.ts` |
| 15 | **Booking:** the customer picks a time on the owner's link; the slot is held by a database rule so two people can't take it; a Google Calendar event is created if Google is connected; follow-ups stop. | `app/book/[leadId]`, `lib/booking.ts` (`createBooking`), `Booking` unique (business, time) |
| 16 | **After the call:** the owner taps how it went. Results counts what happened. | `Booking.outcome`, `lib/callResultsData.ts`, `lib/pilotNumbersData.ts` |

**What the trace shows is missing:** no record of *why* step 7 decided Ready (the checklist is kept, but not the
call's history); the next step on screen (`lib/followUpCall.ts`) is worked out each time the page opens and never
saved; step 15 writes no audit entry and sends the owner nothing at the moment of booking (only a buzz 30 minutes
before the call).

---

## 2. The picture

```
 Gmail · Outlook · Instagram · Messenger · WhatsApp · Lead Ads · web form · GoHighLevel
                               │  (jobs every 1–2 min, webhooks)
                               ▼
                   ┌───────────────────────┐   no  ──►  Filtered out (one tap brings it back)
                   │ Is it a customer?     │
                   └───────────┬───────────┘
                               │ yes
                               ▼
     ┌──────────────── one AI run per new message (capped) ────────────────┐
     │  score + reason ─► checklist (quoted) ─► the call (fixed rules)     │
     │                                       │                             │
     │  facts (owner-approved) ─┐            ▼                             │
     │  owner examples, voice ──┼──►  draft the reply                      │
     │  trained rules/examples ─┘            │                             │
     │                                       ▼                             │
     │                       checks: grounding · tone · hold reasons       │
     └───────────────────────────────────────┬─────────────────────────────┘
                                             │
               ┌─────────────────────────────┼──────────────────────────────┐
               ▼                             ▼                              ▼
     allowed to go alone?          held → Today (one line why)     CRM: stage + note
     instant "got it" / reply      owner edits · sends · skips     owner alerts: Ready
               │                             │
               └──────────────► send (once only, logged) ◄──────────────────┘
                                             │
                                             ▼
                      quiet? → follow-up plan (window, caps, stops)
                                             │
                                             ▼
                        booking link → Booking → calendar → call → outcome
                                             │
                                             ▼
                               Results · admin pilot numbers

 Not in the picture yet: a saved decision log, call history, objection memory,
 stored test runs, release gates, per-conversation AI cost.
```

---

## 3. Feature by feature

**Works** = built, live, and covered by checks. **Incomplete** = built in part. **Missing** = not in the code.
**Risky / not verified** = built, but either unsafe as it stands or never proven on a live account.

| Area | Feature | Status | Evidence |
|---|---|---|---|
| Intake | Gmail, Outlook, web form, Lead Ads | Works | cron `gmail-sync`, `outlook-sync`; Lead Ads tested end to end (PR #464) |
| Intake | Instagram, Messenger | Works | cron `instagram-poll`; Meta's access verification still "in review" |
| Intake | WhatsApp | Not verified | built; no live test message seen yet |
| Intake | GoHighLevel conversations, notes, DND | Works in tests; not verified on a realtor's real account | `lib/crm/*`, A-301, A-303 |
| Customer check | Email: customer or not, second look | Works | accuracy test: 121 of 122 (Oct 14) |
| Customer check | Instagram/Messenger gate | Works | accuracy test: 36 of 37 (Oct 14; the miss kept on purpose) |
| Qualification | Realtor checklist, quoted, merged | Works | `lib/qualification.ts`; test: 718 of 720 answers, none made up (Oct 17) |
| Qualification | The call (Ready/Warm/Later/Has an agent) | Works, realtors | `tierOf`; other trades use the score (`tierFromScore`) |
| Qualification | Other kinds of business | Incomplete | one 0–100 score, no checklist, **no accuracy test** |
| Qualification | Score history | **Missing** | `Lead` keeps only the latest score and checklist |
| Qualification | Owner override | Incomplete | owner can change the plan, mark won/lost, "keep following up anyway"; no "this call is wrong" (R-137: owners never grade) |
| Next step | What FollowUp would do next | Incomplete | `lib/followUpCall.ts`: shown on Today and the customer page; **not saved, no outcome recorded** |
| Memory | Facts about the business | Works | `BusinessFact`, waits for the owner's OK (A-308) |
| Memory | Their moment ("try me in March") | Works | `Lead.momentAt`, `lib/theirMoment.ts` |
| Memory | Objections, unanswered questions | **Missing** | nothing stores them; the reply writer re-reads the thread each time |
| Replies | Draft in the owner's voice, the customer's language | Works | test: 17 of 20 (Oct 17), none invented |
| Replies | Never invent price, time, availability, fee, policy | Works | `lib/grounding.ts`, `lib/holdReasons.ts` |
| Replies | Pushy or bragging → rewrite once, then hold | Works | `lib/replyTone.ts` |
| Approval | Today queue with one reason line | Works | `lib/pendingApprovals.ts` |
| Sending | Goes alone only when the owner allowed it | Works | per business and per customer switches |
| Sending | Never twice | Works | `SendClaim @@unique([leadId, bodyHash])` |
| Follow-ups | Plans, window, caps, 6-month stop | Works | `lib/automation.ts`, `lib/followUpPlans.ts` |
| Stops | STOP, said no, has an agent, booked, won/lost, CRM DND | Works | `lib/optOutKeywords.ts`, `Suppression`, `saidNoAt` |
| Booking | Customer picks a time on the link | Works | `lib/booking.ts`: advisory lock + unique slot |
| Booking | Times offered inside the chat | **Missing** | A-242 stage 2, approved, not built |
| Booking | Move or cancel a call | **Missing** | `Booking.status` allows "canceled" but **nothing in the code sets it** |
| Booking | Owner told the moment someone books | **Missing** | `createBooking` alerts no one; a buzz comes 30 min before the call |
| Booking | Calendar event | Works, best effort | `createCalendarEvent` swallows its own errors (on purpose) |
| Booking | Attendance | Incomplete | only the owner's one-tap answer (`Booking.outcome`) |
| Learning | Owner examples, voice from edits | Works, **automatic** | apply to that owner's next draft immediately |
| Learning | Founder's trained rules (per trade) | **Risky** | `TrainingRule` has no status, version or test; the newest 20 reach every business of that trade at once |
| Learning | Founder's trained examples (per trade) | **Risky** | `TrainingExample`: same, up to 3 per draft; no consent field for pasted real conversations |
| Learning | Changes to training logged | **Missing** | no `AuditEvent` for adding or removing a rule or example |
| Evaluation | 4 accuracy tests on the real model | Works | `lib/classifierEval.ts`, `dmJudgeEval.ts`, `qualificationEval.ts`, `replyEval.ts` |
| Evaluation | Test messages from real customers or realtors | **Missing** | all four sets are invented; the realtor judging sheet (30 messages) has no answers yet |
| Evaluation | Run history, held-out set, release gate | **Missing** | results are shown once, not stored; nothing blocks a worse change |
| Evaluation | Ready precision and recall | **Missing** | the test counts right answers per item, not "of those called Ready, how many were" |
| Analytics | Results, FollowUp's calls, pilot numbers | Incomplete | counts exist; minutes saved are an **estimate**; no funnel from first message to booked |
| Safety | Each business's data kept apart | Works | Postgres row-level security + tests |
| Safety | Team roles | Works | ADMIN / SALES |
| Safety | Audit log | Incomplete | holds, sends, opt-out, not-a-customer are logged; the call, training and bookings are not |
| Safety | Feature switches to turn a new part off | **Missing** | only the owner's own switches; no flag for "new engine: off / watching / on" |
| Cost | AI caps | Works | 30 a customer, 500 a business a day |
| Cost | AI cost per conversation | **Missing** | runs are counted; tokens and price are not stored |
| Unused | `AIInsight`, `Task` tables | Unused | defined, not read by any screen |

---

## 4. Gaps, against each phase of the brief

| Phase | What exists | Gap |
|---|---|---|
| 2. Decision pipeline with strict schemas | Each AI step already uses a strict JSON schema; code checks run after it | The steps aren't recorded as one decision with inputs, versions and output; nothing to replay or compare |
| 3. Qualification engine | Realtor checklist + fixed-rule call; quotes required | No score history, no explanation per change, no checklist for other trades, no test against a realtor's own labels |
| 4. Next best action | `followUpCall.ts` picks the next step for display | Not saved, not measured, no preconditions written down, no "did it happen" |
| 5. GTA / Ontario playbooks | `followup/playbook/real-estate.md` (PR #582), trade question order | No area-specific knowledge (neighbourhoods, condo vs freehold, pre-construction, rentals by city); objection answers are generic |
| 6. Booking reliability | Safe slot holding, no double booking | Offer times in the chat, confirm, move, cancel, remind the customer, mark no-shows, tell the owner at once |
| 7. Follow-ups | Plans, caps, window, stops, their moment | Objection-aware follow-ups; a record of which follow-up brought someone back |
| 8. Approval and feedback | Today queue, owner edits teach drafts | Founder training goes live with no test; no versions; no rollback; no consent record |
| 9. Evaluation | 4 invented test sets on the real model | Real labelled data, held-out split, stored runs, Ready precision/recall, a gate before release |
| 10. Outcome dashboard | Results, pilot numbers | Funnel by source and by call (Ready → booked → met), speed to first reply, measured not estimated |

---

## 5. Proposed data and API changes

All **additive**: new tables or new nullable columns, nothing renamed or dropped, row-level security on every new
table, no change to what customers see. Each new part ships behind a switch with three positions: **off**,
**watching** (runs and records, changes nothing), **on**.

**Training safeguards (step 1)**
- `TrainingRule`, `TrainingExample`: add `status` (`draft` · `testing` · `active` · `retired`), `version`,
  `approvedById`, `approvedAt`, `evalRunId`. Only `active` ones reach replies. Existing rows become `active`, so
  nothing changes on deploy.
- `TrainingConversation`: add `source` (`practice` · `pasted`) and `consentConfirmedAt`. A pasted real conversation
  can't be used until the box is ticked.
- Log every add, approve, retire and undo as an `AuditEvent` (`training.*`).
- API: `POST /api/admin/train/rules/:id/{test,approve,retire}` (founder only); the same for examples.

**Decision log (step 2)**
- New `Decision` table: business, customer, `kind` (`call` · `next_step` · `hold` · `send`), the output, the reason,
  the quotes it rests on, `promptVersion`, `rulesVersion`, `model`, `mode` (`watching` · `live`), time; then
  `outcome` and `outcomeAt` filled in later (replied, booked, went quiet, said no).
- API: `GET /api/leads/:id/decisions` for "why did FollowUp do this?".

**Memory (step 3)**
- New `CallChange` table (score history): customer, from → to, checklist snapshot, reason, `source` (`ai` · `owner`
  · `crm`), time.
- `Lead`: add `objections` (type, their words, when, answered or not) and `openQuestions` (their words, when,
  answered when).

**Evaluation (step 4)**
- New `EvalRun` (suite, `split` `dev` · `heldout`, prompt and rules versions, model, totals, Ready precision and
  recall, who ran it) and `EvalResult` (per case, expected, got, pass).
- A release gate: a change that touches prompts, rules or training is blocked if the held-out score drops.

**Booking (step 5)**
- `Booking`: add `source` (`link` · `chat` · `owner` · `crm`), `canceledAt`, `cancelReason`, `movedFromId`,
  `idempotencyKey` (unique), `customerConfirmedAt`, `noShow`.
- Never marked booked from AI text: only a real `Booking` row, written by the booking code, counts.

**Cost**
- New `AiCall` row per model call (purpose, model, tokens in/out, customer, business), so cost per conversation
  is measured, not estimated.

---

## 6. The plan, in the order the brief set

Each step: **what**, **how we'll know it worked**, **how to undo it**. Nothing here turns on new automatic
sending. Anything with a new screen is drawn first and waits for the founder's yes.

**Step 1. Training goes through a test and the founder's OK** (about 2–3 days)
- What: the status and version fields above. A new rule or example starts as a draft, runs against the reply test,
  and goes live only when the founder approves it. Pasted real conversations need the consent box. Every change logged.
- Proof: a test that a draft rule never reaches a reply; the reply test score shown next to each rule before approval.
- Undo: retire the rule (one tap); switching the feature off makes every existing rule behave as today.
- Screen: Admin → Train gets a status per rule and an Approve button. **Draw first.**

**Step 2. The next-step engine, watching only** (about 4–5 days)
- What: wrap today's `followUpCall.ts` and hold logic into one engine that writes a `Decision` for every customer
  event, with the brief's action list (answer the question, ask the next question, offer a viewing, hold for owner,
  follow up later, hand to the owner, stop). In **watching** mode it records what it would do; today's code still
  decides.
- Proof: two weeks of decisions side by side with what actually happened; disagreements listed for the founder.
- Undo: switch off; nothing a customer sees depends on it.

**Step 3. Call history and memory** (about 3–4 days)
- What: `CallChange` written whenever the call moves; objections and unanswered questions captured with the
  customer's words; the reply writer reads them so it answers an open question before asking a new one.
- Proof: tests for each objection type; the qualifying test extended with objection cases.
- Undo: switch off; the writer goes back to reading the thread only.

**Step 4. The evaluation harness** (about 3–4 days, part in parallel with step 3)
- What: stored runs, a held-out set nobody tunes against, Ready precision and recall, and a gate. The realtor's
  judging sheet answers become the first real labelled set (when one comes back).
- Proof: the gate blocks a deliberately worse prompt in a test.
- Undo: none needed; it changes no reply.

**Step 5. Booking reliability** (about 5–7 days)
- What: the owner is told the moment someone books; cancel and move through the link; the customer gets a
  confirmation and a reminder; no-shows recorded. Offering times in the chat (A-242 stage 2) comes last and always
  waits for the owner's OK until the founder decides otherwise.
- Proof: tests for every step (offer, pick, confirm, double tap, cancel, move, no-show); one real booking on the demo
  account.
- Undo: each part has its own switch.
- Screens: **draw first.**

**Step 6. Objections and follow-ups** (about 3–4 days)
- What: the GTA/Ontario real-estate playbook (phase 5) as reply guidance for the common objections ("just
  browsing", "have an agent", "not for 6 months", "what's your commission", "is it still available"); follow-ups
  that use the customer's open question or objection instead of a generic nudge.
- Proof: new reply-test cases for each objection; the held-out set must not drop.
- Undo: retire the guidance (it is training, so it goes through step 1).

**Step 7. Outcome analytics** (about 3 days)
- What: a funnel by source and by call (first message → replied → Ready → booked → met), time to first reply,
  and which follow-up brought someone back, measured from `Decision` outcomes and bookings.
- Proof: numbers cross-checked against the raw rows on the local database.
- Screens: **draw first.**

**Days are working days of building and checking, not calendar promises.** Each step is its own pull request and
merges only on the founder's word.

---

## 7. Decisions only the founder can make

1. **Owners correcting the call.** The brief asks for overrides; R-137 says owners are never asked to grade.
   *Recommendation:* keep R-137. Learn from what owners already do (change a plan, mark won/lost, keep following
   up) and from a realtor's judging sheet, not from a new grading button.
2. **Founder training goes live only after a test and an OK** (step 1). *Recommendation:* yes.
3. **Pasted real conversations** for training need the realtor's permission. *Recommendation:* a consent box stored
   with the date; names already removed as today.
4. **Who the reply comes from.** Drafts go out in the owner's name; "are you a real person?" always waits for the
   owner. *Recommendation:* keep as is.
5. **New automatic sending.** *Recommendation:* none in this plan. The next-step engine starts watching only;
   anything that would send more on its own comes back to the founder first.
6. **Booking in the chat** (A-242 stage 2). *Recommendation:* build it in step 5, holding every offer for the
   owner's OK at first.
7. **Canada's anti-spam rules.** The 6-month stop and the opt-out handling are product rules the founder set, not a legal
   opinion. *Recommendation:* a lawyer's read before charging, as already planned.

---

## 8. Not verified, and said so

- WhatsApp end to end on the live app; GoHighLevel on a realtor's real account; HubSpot; Meta's access verification.
- The four accuracy tests since the fixes made after the Oct 17 run. Latest scores on record: emails 121 of 122 and
  Instagram 36 of 37 (Oct 14); replies 17 of 20 and qualifying 718 of 720 (Oct 17). None has been run since.
- Any real conversion rate: there isn't enough live pilot data yet to measure one honestly.
