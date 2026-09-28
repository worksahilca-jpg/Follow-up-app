# Reply truth audit: can FollowUp tell a customer something the business never said?

Checked 2026-09-28 against commit `7e68500` (PR #376, branch `claude/followup-demo-to-production-4k39hr`). All line numbers are at that commit. The working tree now also has another session's uncommitted edits: `automation.ts` is shifted +6 lines from line 1025 onward, and HEAD has moved to `e762c0b`, which changes UI only. No live OpenAI calls were made. The risk judge's behaviour is inferred from its prompt.

## Summary

1. **Yes, on every automated path.** PR #376's availability check has three holes:
   - A comma defeats it. "Yes, the 2 bedroom condo is still available, would you like to see it?" is one sentence ending in "?", so it is skipped.
   - FollowUp's own earlier automated "let me check if it's available" counts as the business having said it.
   - Synonyms pass: "sold", "rented", "on the market", "in stock", "libre".
2. **The most-used send path skips the grounding check.** The 5-minute and unanswered reply in Automatic mode reuses the draft scoring wrote. That draft never gets the digits/price/day check (email), and scoring throws away the DM's shape-check failure. The 2026-09-20 "El costo será de $100" draft still goes out: in Automatic mode after a "low" from the judge, and on AUTONOMOUS with no check at all. Reproduced in a test.
3. **Workflow steps and the reactivation batch have no deterministic check.** The batch sends every draft after the three the owner previewed with no check of any kind, model or rule.
4. **Whole classes of invented fact are uncovered:** bookings ("you're booked for Saturday"), callback times with no digits ("tomorrow", "in an hour"), claimed actions ("I've sent you the details"), policies ("estimates are free"), hours, service area, prices in words ("fifty dollars"), button titles, and staff or place names. At HEAD, 0 of 33 realistic invented drafts were caught by any deterministic guard.
5. **Fixed in PR #376 (2026-09-28).** Applied as below, plus two changes from review: "the email I sent last week" is grounded once a real message has gone out, and "hope to see you" / "looking forward to seeing you" are wishes, not bookings. Original note: **I built a fix in the scratch worktree.** It adds a sentence-level claim check for 6 kinds in English, Spanish, French and Portuguese, adds today/tomorrow via `Intl.RelativeTimeFormat`, and runs the checks on every draft about to be used on every path. It catches 31 of 33, with 0 false positives on 18 neutral drafts in the probe and 14 more pinned as tests. The full suite passes: 236 files, 2667 tests. Hand to `backend-ai-agent`.

## Paths × guards (at 7e68500)

"Unreviewed" means it can reach a customer with no human reading that specific message. "Automatic" is `holdAllForApproval=false`; the default is `true` (`prisma/schema.prisma:310`).

| Path | Where | Text source | Deterministic guards | Model judge | Reaches customer with no human? |
|---|---|---|---|---|---|
| Instant ack (generated) | `acknowledge.ts:297-333, 596-635` | `generateInstantReply` | `checkAckShape`: digits, currency, contact, time, calendar (**English only**: no locale passed, `:320`), greeting/sign-off, owner in third person, leak, echo. **No availability or claim rule.** | `assessAckRisk` (lists availability, hours, policy, service). **Skipped for AUTONOMOUS** (`:323`) | Yes in Automatic. AUTONOMOUS (a source rule with `autonomousAllowed`) gets shape only. |
| Instant ack fallback | `acknowledge.ts:250-264` | fixed line, then `localizeFixedText` | translation guard (digits, currency, link) | none | Yes in Automatic. Fixed text, safe. |
| 30-min holding message | `holdingMessage.ts:72-75, 206-249` | fixed line, then translation | translation guard | none | Yes, Automatic only |
| 5-min fresh reply / unanswered reply / quiet reminders 1–4 / dead-lead welcome-back (email) | `automation.ts:1303, 1327-1330, 1359, 1480, 1841`; draft from `scoring.ts:151` | scoring draft **reused** when current, else regenerated | regenerated: `ungroundedSpecifics` + availability. **Reused: availability only** (`:1359`) | `assessSendRisk`, **skipped for AUTONOMOUS on a paid tier** (`:1480`); a stored verdict is reused (`:1525`) | Yes: Automatic + ASSISTED when the judge says low; AUTONOMOUS with no judge. |
| Same, Instagram/Messenger DM | `dmDrafting.ts:34-61`, `scoring.ts:143-149` | `draftDm` | regenerated: `checkDmDraftShape` (length, one question last, closers, contact, digits, calendar, availability). **Button titles not grounded** (`dmDrafts.ts:291-303` check `body` only). **Reused: availability only.** Scoring drops `shapeFailed` (`scoring.ts:149`). | same | same |
| Day 2–7 DM handoff | `automation.ts:1945-2051` | `draftDm(…, "handoff")`, no locale | shape check runs, but a failure is ignored and not shown to the owner | none | No: the owner taps send on the lead page |
| Workflow / sequence step (incl. ready plans; a source rule can auto-enroll every new lead, `sourceRouting.ts:50`) | `sequences.ts:775-819, 870` | `generateFollowUpMessage`, email-shaped **even on DM/SMS** | **none** (only the price-slot refusal at send) | `assessSendRisk` in Automatic | Yes in Automatic on a "low" |
| Reactivation "Send all" | `reactivationSend.ts:92-112, 359-368` | `generateFollowUpMessage` + dead-lead hint | **none** | **none** | Yes: the owner reads 3 previews; the rest go unread |
| Routine pile "Send it" / onboarding one-tap | `bulkApprove.ts:90-147`, `approvalGroups.ts:82-88` | stored drafts | whatever ran at draft time (see rows above) | stored verdict must be `low` | One tap, drafts unread |
| Single Approve / lead-page Send | `api/leads/[id]/send` | stored or typed | price slot | – | No |
| Rewrite (shorter/warmer/formal/**language**) | `openai.ts:1834-1867` | `rewriteReply` | **length only** | – | Owner sees it, but often cannot read the "language" output |
| Quick-reply chips | `dmDrafts.ts:305-319`, `quickReplies.ts` | model | count, length, duplicate, exit. **Not grounded.** | via the body's judge | With the DM |
| WhatsApp outside 24h | `whatsappCloud.ts:145-173`, `twilio.ts:570` | the owner's approved template | – | – | Yes; owner-authored text |
| Booking page | `booking.ts:15-18, 84-126` | fixed Mon–Fri 9–5 grid | – | – | Customer sees it as "open times"; the owner shares the link by hand |
| Missed-call text-back, voice agent | `api/twilio/voice/[secret]/route.ts:133-137`, `voice-agent/api/stream.js:383-397` | fixed line / live model | voice: prompt only | – | Yes, but carrier channels are off (`pricing.ts:79`) |

## Gaps, ranked

Severity: **High** = can reach a customer unreviewed. **Medium** = lands in the owner's one-tap pile, or reaches the customer but is mild. **Low** = neither.

### H1. A reused scoring draft skips the grounding checks. This is the common path.
`automation.ts:1303` reuses scoring's draft whenever it is current and `draftKind` is null. That covers every 5-minute fresh reply and every unanswered reply, except a belated reply to someone silent 45+ days, which is redrafted. For email, the only check on a reused draft is availability (`:1359`); `ungroundedSpecifics` runs only in the regenerate branch (`:1327-1330`). For DM, `scoring.ts:149` keeps a draft that failed `checkDmDraftShape` twice and loses the failure reason, and automation then reuses it as clean. AUTONOMOUS on a paid tier skips the judge too (`:1480`).
- Example (reproduced): the lead asks "¿Cuál sería el costo de una consulta?"; scoring drafts "El costo será de $100." At HEAD, `sendFollowUpToLead` is called on AUTONOMOUS, and also on ASSISTED when the judge says low. A DM "Will this be for a weekday or weekend?" is likewise sent.
- Fix (prototyped): run every deterministic rule on whatever draft is about to be used. For DMs that is the full `checkDmDraftShape` including stored buttons. For email it is `inventedSpecific(subject + emailBodyOf(message))`, which strips the greeting/sign-off frame so the owner's name can't trip the digits rule.

### H2. PR #376's availability rule can be bypassed three ways
- **Comma** (`grounding.ts:159`): a sentence ending in "?" is skipped whole. "Yes, the 2 bedroom condo is still available, would you like to see it?" returns `false` at HEAD. This is the same incident with a comma instead of a full stop, and the DM prompt asks for one or two sentences with the question last, which produces exactly this shape. Fix (prototyped): in a question, check every comma clause except the last.
- **Self-grounding** (`grounding.ts:150`, `dmDrafts.ts:334-339`): any business outbound containing "availab" disables the rule for the thread. `businessText` includes FollowUp's own automated sends and voice-agent speech. The `availability_unanswered` hint tells the drafter to "say you're checking", so the first auto-reply ("Let me check if the condo is still available") grounds every later "the condo is available". Reproduced. Fix (prototyped):
  - `businessText` counts only a person's sends (trigger null or `manual`, and not voice-agent).
  - Grounding requires an owner sentence that *states* the fact unhedged.
  - Availability and hours are polar: "no longer available" doesn't ground "still available".
- **Synonyms** (`grounding.ts:167`): the regex only knows "available", "disponible" and "openings". These pass: "still on the market", "hasn't been rented", "in stock", "we can fit you in", "only a few left", "todavía está libre", "it sold". Fix (prototyped): extended stems in EN/ES/FR/PT.

### H3. Workflow steps have no deterministic check
`sequences.ts:775-819`: in Automatic mode, `assessSendRisk` is the only gate before `sendFollowUpToLead` (`:870`). Source rules auto-enroll new leads (`sourceRouting.ts:50`). The ready-plan hint "Answer the question a customer usually has at this point about a quote like this one" (`readyPlans.ts:20`) invites an invented answer, and the file's own comment "The drafting rules hold a draft that tries" (`readyPlans.ts:8`) is untrue for this path.
- Example: "Good news, estimates are free with no obligation. Want to book one?" is sent on a low verdict.
- Fix (prototyped): `inventedSpecific` on the step draft. The owner's step note grounds figures and days, but not claims, because the ready plans' own hints say "no discount". A failure holds the draft with a specific reason, so it goes to "needs you" even on a holding account.

### H4. The reactivation batch sends drafts nobody read, with no check at all
`reactivationSend.ts:359-368` drafts and sends each lead after the three previews. There is no judge and no rule. The dead-lead hint asks the drafter to "bring them something they did not have last time".
- Example: "…we're still able to fit you in before the holidays, and the design visit is free."
- Fix (prototyped): `inventedSpecific` on each draft. On failure the draft is stored, an `ai.hold` is recorded with the reason, and the lead is counted as skipped. The claim is kept, so the lead is never batch-messaged. Not done: marking the previews that would be held.

### H5. No rule for bookings, claimed actions, policies, hours or service area (all paths; the only net for an AUTONOMOUS ack)
`checkAckShape` (`acknowledge.ts:154-225`) deliberately has no claim rule, and AUTONOMOUS skips `assessAckRisk` (`:323`). No path had a rule for these classes. Examples, all with no digit or a day the lead named first:
- "Perfect, you're booked for Saturday. See you then!"
- "Listo, te esperamos el sábado."
- "I've sent you the details by email."
- "Ya te envié la información."
- "As we discussed…"
- "Estimates are free, no obligation."
- "It's fully refundable if you cancel."
- "Yes, we're open now until late."
- "Yes, we cover Brampton."

Fix (prototyped): `unconfirmedClaim(draft, ownerText)` for six kinds (availability, booking, done, policy, hours, service). It works per sentence: questions are skipped (except their leading clauses), "finding out" hedges are allowed ("I'll check…", "I'll get you the warranty details"), and a claim is grounded only by an owner statement of the same kind. It is wired into:
- `checkAckShape`, with empty owner text, and it now receives the lead's locale;
- `checkDmDraftShape`, over body plus buttons;
- every email, sequence and reactivation path via `inventedSpecific`;
- `rewriteReply`;
- the routine pile.

### H6. Times and prices with no digits
`UNDERIVABLE` (`grounding.ts:229-239`) has no today/tomorrow/tonight/"in an hour". `CURRENCY_RE` (`:81`) has no currency words.
- Examples: "I'll give you a call tomorrow morning", "Our tech can be there tonight", "I'll call you in an hour", "Te llamo mañana", "It's fifty dollars for the visit".
- Fix (prototyped):
  - `Intl.RelativeTimeFormat(locale).format(0|1, "day")` gives today/tomorrow in every locale ("mañana", "demain", "amanhã", "ਭਲਕੇ", "આવતીકાલે").
  - A short list of digit-free timeframes: tonight, this afternoon, an hour, esta noche, ce soir, uma hora…
  - Currency words: dollars, bucks, euros, rupees, pesos, dólares, reais…
  - "Soon" and "shortly" stay allowed. I deliberately left out weeks ("this week or later?" is a legitimate question the DM sets ask).

### M1. The routine pile can contain drafts that need a human
`isSafeToSendInBulk` (`approvalGroups.ts:82-88`) trusts the stored verdict. A verdict judged before any of the new rules stays "low", and the judge passes yes/no answers to the lead's own question (see M2). That is how "Yes, it is available" got in on 2026-09-27. Availability also goes stale: true on Monday isn't a fact on Friday.
- Fix (prototyped): a draft that states any claim kind, or contains a currency marker, is never routine, grounded or not. `bulkApprove` re-applies this per draft, and the UI uses the same function.

### M2. The risk judge's reasoning (`openai.ts:839-879, 905-931`)
- Its test is "does not appear in the conversation". A lead's question contains the answer's words, so "Yes, it is available" looks grounded. Only *commitments* get the rule that "an inbound-only claim is not verified" (`:916-918`).
- The "not low" list is "pricing, discounts, contract terms, deadlines, any commitment". Availability, bookings, hours, policies, service area and claimed actions are not named. The ack judge does list them (`:1771-1776`); this one doesn't.
- "A short, plainly-worded, blunt or informal draft is not a risk… brevity and casual phrasing are the intended output" (`:919-922`) pushes 8–30-word DMs toward low.
- `formatTranscript` (`:83-96`) shows FollowUp's own automated sends as plain `[outbound]`, so the judge treats them as the business confirming. Only `voice-agent` is flagged.
- It says "follow-up email" even for DMs.
- Proposed prompt text (not prototyped; deterministic rules first):
  - Add to the system prompt: *"A lead's question is not a source. If they asked 'is it still available?', a draft that answers yes or no states a new fact even though the words appear in the conversation. Messages marked 'automated' were written by FollowUp, not the business, and confirm nothing."*
  - Add to the `riskLevel` description: *"never low if the draft states or implies that something is or isn't available, in stock, sold or bookable; that a time is booked or confirmed; opening hours; what is free, included, refundable, guaranteed or covered; what the business offers, serves or accepts; or that the business already sent, called, booked or arranged something — unless a business-authored, non-automated message already says it."*
  - Mark automated outbound in `formatTranscript` as `[outbound · automated · …]`.

### M3. DM chips and situation hints
- Button titles are customer-facing and were never grounded (`dmDrafts.ts:291-303`). A body of "Which of these suits you?" with chips "Sat 10am" / "Not now" passes. Fixed in the prototype: body and titles are checked together.
- The `after_tap` hint says "confirm it in their own word and say what happens next" (`dmDrafts.ts:113-122`). After a tap on "Saturday" that produces "Saturday it is, see you then!". The booking rule now holds this; also change the hint to "acknowledge their answer and say the owner will confirm".
- The `availability_unanswered` hint still suggests "such as weekday or weekend" (`dmDrafts.ts:211-219`), the exact invented dimension the calendar rule bans. That costs a redraft every time; remove it from the hint.

### M4. `rewriteReply("language")` has only a length guard (`openai.ts:1865`)
An owner who asks for Gujarati usually can't read the result, so in practice it is an unreviewed send.
- Example: owner's text "Thanks, I'll check and get back to you." comes back as "¡Claro! Está disponible y la visita es gratis."
- Fix (prototyped): reject any new digit, currency or link not in the reply or thread, and any claim kind the owner's own reply didn't make. The owner keeps their text.

### M5. The 30-minute holding message promises a time (reaches customers unreviewed, fixed text)
The risk topic `date` includes availability questions (`openai.ts:869-870`). So "Is the condo still available?" gets "Let me check the calendar and I'll confirm a time with you soon." (`holdingMessage.ts:74`), which promises a viewing time the owner never offered.
- Fix: change the date line to "Thanks! Let me check and I'll get back to you on that soon." Founder-approved copy, so ask before changing it.

### M6. Invented staff, place and product names (not caught; not prototyped)
- Examples: "Mike, our senior inspector, will handle it personally." / "We're right across from Square One." These are the 2 misses left in the probe.
- Fix: in the automated paths, flag capitalised tokens mid-sentence that appear in neither the thread nor the lead's name, with a small allow-list of platform names. Known holes: a name at the start of a sentence, and scripts without upper/lower case. Worth doing after collecting a week of held drafts to measure false positives.

### L1. Day 2–7 handoff drafts hide their check failure (`automation.ts:1999-2011`)
`draftDm(…, "handoff")` runs without a locale, and `shapeFailed` is discarded. The owner reviews every handoff anyway, but the hold reason never says "this states availability". Fix: when `dm.shapeFailed` is in `UNGROUNDED_DRAFT_REASONS`, append that reason to the handoff hold reason.

### L2. The booking page invents open hours (`booking.ts:15-18`)
A fixed Mon–Fri 9–5 grid is shown as "open times", and "You're booked." confirms whatever the lead picks. Google Calendar only removes busy slots. Fix: before the booking link can be copied, require the owner to set their hours (or connect a calendar).

### L3. WhatsApp outside 24h sends the one approved template for any automated follow-up (`whatsappCloud.ts:164-173`)
The text is the owner's, but it can state something that doesn't fit this lead ("your appointment is confirmed"). Fix: show the template text in Settings next to "this goes to everyone past 24h".

### L4. The calendar rule reads "may", "sat", "sun" and "march" as dates (`grounding.ts:174-196`)
"You may want to bring photos" failed as an invented day at HEAD. Fixed in the prototype: these words count only when capitalised ("in May").

### L5. Hindi, Punjabi and Gujarati in their own scripts
The claim lists are EN/ES/FR/PT; romanized Hinglish "available hai" is caught. Native-script words (उपलब्ध, ਉਪਲਬਧ, ઉપલબ્ધ) should be added by a speaker, per `grounding.ts`'s own rule. "आज"/"कल" are dropped by the `length > 2` filter (`grounding.ts:195`).

### L6. The live voice agent is guarded only by its prompt (`voice-agent/api/stream.js:389-396`)
It is dormant while `CARRIER_CHANNELS_AVAILABLE = false`. Its speech no longer grounds drafts in the prototype. Before re-enabling it: run `unconfirmedClaim` and `ungroundedSpecifics` over the transcript at the callback and notify the owner of any hit.

## The prototype

**Location:** `/tmp/claude-0/-home-user-Follow-up-app/3d916d81-53e7-51a4-bb6d-b93bad3e4d33/scratchpad/qa-worktree`. It is a `git archive` export of 7e68500 with its own git repo; `node_modules` is symlinked; no `.env` was copied. Nothing in `/home/user/Follow-up-app` was edited.

**Patch:** `qa-worktree/reply-truth.patch`, 13 files, +1018/−36 including tests. `git apply --check` passes against the current `/home/user/Follow-up-app` working tree; the `automation.ts` hunks apply with a 6-line offset because of the other session's uncommitted claim edit.

**Source files changed:**
- `grounding.ts`: `unconfirmedClaim`, polarity, the comma-clause fix, relative days, timeframes, currency words, the "may" fix.
- `dmDrafts.ts`: buttons grounded, `businessText` counts only a person's sends, `inventedSpecific`, `emailBodyOf`.
- `automation.ts`: every rule on the draft about to be used; the DM hold note now names the rule.
- `sequences.ts`, `reactivationSend.ts`: the check wired in.
- `acknowledge.ts`: claim rule and lead locale.
- `approvalGroups.ts`: routine-pile exclusion.
- `holdReasons.ts`: five new owner-facing reasons, in the existing lowercase-clause grammar.
- `openai.ts`: `rewriteReply` guard.

**New tests (all pass on the prototype):**
- `src/lib/__tests__/replyTruthAutomation.test.ts`, 6 tests. **5 of them fail at 7e68500 with `sendFollowUpToLead` called once:**
  - cached "$100" email on AUTONOMOUS;
  - the same on ASSISTED with a "low" verdict;
  - cached "weekday or weekend" DM;
  - cached "you're booked for Saturday" DM;
  - "available" grounded only by FollowUp's own earlier automated send.

  The 6th pins the sign-off false positive.
- `replyTruthGrounding.test.ts`, 47 tests: each claim kind in EN/ES, 14 neutral drafts that must pass, polarity, laundering, comma questions, today/tomorrow incl. Gujarati, currency words, "may", chips, ack, routine pile, rewrite.
- `replyTruthSequences.test.ts`, 3 tests. `replyTruthReactivation.test.ts`, 2 tests.

At 7e68500 I also confirmed directly:
- `unconfirmedAvailability` returns false for the comma case, the laundered case and the polarity case;
- `ungroundedCalendarWords` flags "may" and misses "tomorrow";
- `ungroundedSpecifics("It's fifty dollars…")` returns null.

**Checks run in the scratch worktree:**
- `npx vitest run` (mocks only): 236 files / 2667 tests pass. Baseline was 232 / 2609; the 237th file is the audit-only probe below.
- `npx eslint` on all changed files: clean.
- `npx tsc --noEmit`: one error, `src/app/layout.tsx(49,50) LayoutProps`. It is environmental (no `.next/types` in the export); the untouched baseline gives the identical error.
- `npm run build`: **not run.** `node_modules` is symlinked to the real repo and a build writes caches there. `backend-ai-agent` should run the build on the real branch.

**Probe:** `src/lib/__tests__/zz-probe-invented-facts.test.ts` is audit-only; don't merge it. It has 33 invented drafts and 18 neutral ones.

| | Invented drafts caught | Neutral false positives |
|---|---|---|
| HEAD | 0/33 | 1 ("You may want…") |
| Prototype | 31/33 | 0 |

The 2 misses are M6 (names and places).

**Known limits of the prototype:**
- It uses lists, so it is only as multilingual as EN/ES/FR/PT.
- A negation inside a clause can hide a claim.
- A step note from the owner saying "offer free estimates" will now hold that step's drafts. That is a false positive, but it is the cheap direction.
- The model prompts are unchanged.
- Spanish "Mañana" as a "morning" chip will be flagged as "tomorrow".

Source diff, excluding tests (full patch with tests: `qa-worktree/reply-truth.patch`):

```diff
diff --git a/followup/src/lib/acknowledge.ts b/followup/src/lib/acknowledge.ts
index af24870..bdc5d13 100644
--- a/followup/src/lib/acknowledge.ts
+++ b/followup/src/lib/acknowledge.ts
@@ -1,5 +1,5 @@
 import { prisma } from "@/lib/db";
-import { ungroundedCalendarWords } from "@/lib/grounding";
+import { ungroundedCalendarWords, unconfirmedClaim } from "@/lib/grounding";
 import { generateInstantReply, assessAckRisk, localizeFixedText } from "@/lib/integrations/openai";
 import { composeFollowUpEmail, getSenderFirstName } from "@/lib/sender";
 import { sendFollowUpToLead } from "@/lib/sending";
@@ -203,6 +203,17 @@ export function checkAckShape(
   // Intl rather than a list of English day names.
   if (ungroundedCalendarWords(trimmed, inboundText, locale).length > 0) return fail("calendar");
 
+  // "Yes, it's still available", "you're booked for Saturday", "estimates
+  // are free", "we're open now": a first reply knows nothing about the
+  // business, so any of these is invented (audit 2026-09-28). Sentence-
+  // level, so naming the topic ("I'll check availability") is still fine —
+  // the concern the header raises about word lists is a concern about
+  // matching WORDS, and this matches statements. An AUTONOMOUS lead skips
+  // assessAckRisk, so without this nothing stopped them at all. Nothing
+  // from the business exists yet, hence the empty grounding text.
+  const claim = unconfirmedClaim(trimmed, "");
+  if (claim) return fail(claim);
+
   if (/^\s*(hi|hello|hey|dear|hola|buenos|buenas|namaste|namaskar|bonjour|olá|ola|ciao|hallo|salut)\b/i.test(trimmed)) {
     return fail("greeting");
   }
@@ -301,6 +312,7 @@ async function buildAckLine(input: {
   automationTier: string;
   inboundText: string;
   channel: AckChannel;
+  locale?: string | null;
 }): Promise<AckLine> {
   const fallback = genericAckLine(input.businessName);
   if (!input.inboundText.trim()) return { line: fallback, source: "fallback", reason: "no inbound text" }; // nothing specific to respond to
@@ -317,7 +329,9 @@ async function buildAckLine(input: {
     return { line: fallback, source: "fallback", reason: "generation failed" };
   }
 
-  const shape = checkAckShape(reply, input.inboundText, input.ownerFirstName);
+  // The lead's language when it is already known, so "sábado" or "mañana"
+  // is checked in Spanish, not only against English day names.
+  const shape = checkAckShape(reply, input.inboundText, input.ownerFirstName, input.locale);
   if (!shape.ok) return { line: fallback, source: "fallback", reason: `shape: ${shape.rule}` };
 
   if (input.automationTier === "AUTONOMOUS") return { line: reply, source: "generated", reason: "autonomous, shape ok" }; // same skip every other autonomous send path takes
@@ -411,6 +425,8 @@ export async function acknowledgeNewLead(
         // Who to tell when the reply is held rather than sent: the
         // assignee, or every admin when nobody is assigned (notifyAckHeld).
         assignedToId: true,
+        // For the calendar rule in checkAckShape, when already detected.
+        language: true,
       },
     });
     if (!lead) return { sent: false, reason: "no lead" };
@@ -580,6 +596,7 @@ export async function acknowledgeNewLead(
       automationTier: lead.automationTier,
       inboundText: input.inboundText ?? "",
       channel: input.channel,
+      locale: lead.language,
     });
 
     // The lead's own message decides the language of everything that
diff --git a/followup/src/lib/approvalGroups.ts b/followup/src/lib/approvalGroups.ts
index bae13ae..58fc124 100644
--- a/followup/src/lib/approvalGroups.ts
+++ b/followup/src/lib/approvalGroups.ts
@@ -40,6 +40,7 @@
 import { isHeldOnlyByApprovalSetting, BACKLOG_BEFORE_PERMISSION_REASON } from "@/lib/holdReasons";
 import type { PendingApproval } from "@/lib/pendingApprovals";
 import { byLongestWaiting } from "@/lib/calmToday";
+import { unconfirmedClaim } from "@/lib/grounding";
 
 /**
  * What a group is called when the lead carries no source at all — a lead
@@ -79,9 +80,20 @@ export type ApprovalGroup = {
  * the pile, and the send endpoint must re-check it per draft rather than
  * trusting a list of ids posted by a browser.
  */
-export function isSafeToSendInBulk(approval: Pick<PendingApproval, "reason" | "draftRiskLevel">): boolean {
+export function isSafeToSendInBulk(
+  approval: Pick<PendingApproval, "reason" | "draftRiskLevel"> & { draftMessage?: string }
+): boolean {
   // Held for a reason of its own → needs a human, whatever the verdict.
   if (!isHeldOnlyByApprovalSetting(approval.reason)) return false;
+  // A draft that tells the customer something only the owner knows — it
+  // is available, they're booked, it's free, we're open, a price — is
+  // never routine, grounded or not (audit 2026-09-28). The risk judge
+  // passed "Yes, it is available" as low on 2026-09-27, and a stored
+  // verdict can predate every deterministic rule added since, so the pile
+  // re-reads the words themselves. Availability also goes stale: true on
+  // Monday is not a fact on Friday.
+  const draft = approval.draftMessage ?? "";
+  if (unconfirmedClaim(draft, "") !== null || /[$€£₹¥]/u.test(draft)) return false;
   // Judged, and judged low. `null` is unjudged and fails here, which is
   // the whole point — see the header.
   return approval.draftRiskLevel === "low";
diff --git a/followup/src/lib/automation.ts b/followup/src/lib/automation.ts
index 1dac443..bdacace 100644
--- a/followup/src/lib/automation.ts
+++ b/followup/src/lib/automation.ts
@@ -36,8 +36,7 @@ import { settledByTalk, lastInboundTime } from "@/lib/talked";
 import { generateFollowUpMessage, assessSendRisk, type RiskTopic } from "@/lib/integrations/openai";
 import { hasPriceSlot, PRICE_SLOT_REASON } from "@/lib/priceSlot";
 import { draftDm, readStoredQuickReplies } from "@/lib/dmDrafting";
-import { businessText, conversationText } from "@/lib/dmDrafts";
-import { unconfirmedAvailability, ungroundedSpecifics } from "@/lib/grounding";
+import { businessText, checkDmDraftShape, conversationText, emailBodyOf, inventedSpecific } from "@/lib/dmDrafts";
 import { isExitPayload, toQuickReplies, type StoredQuickReplies } from "@/lib/quickReplies";
 import { Prisma } from "@prisma/client";
 import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
@@ -1324,10 +1323,7 @@ export async function runAutomationForBusiness(
           // On 2026-09-20 a lead asked what a consultation costs and this
           // path answered "El costo será de $100" in the owner's name.
           // Nobody had said $100.
-          emailShapeFailed =
-            ungroundedSpecifics(`${draft.subject ?? ""}\n${draft.body}`, conversationText(conversation), leadLanguageOf(lead)?.language) ??
-            // Availability is only the owner's to state (src/lib/grounding.ts).
-            (unconfirmedAvailability(`${draft.subject ?? ""}\n${draft.body}`, businessText(conversation)) ? "availability" : null);
+          emailShapeFailed = inventedSpecific(`${draft.subject ?? ""}\n${draft.body}`, conversation, leadLanguageOf(lead)?.language);
           message = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body, {
             languageSample: latestInboundText(conversation),
             leadLanguage: leadLanguageOf(lead),
@@ -1356,9 +1352,26 @@ export async function runAutomationForBusiness(
       // let the risk judge call it low, and offer it in "Send it" with the
       // routine drafts: "Yes, it is available" went into the one-tap group
       // on 2026-09-27 though nobody at the business had said so.
-      if (!dmShapeFailed && !emailShapeFailed && message && unconfirmedAvailability(`${subject ?? ""}\n${message}`, businessText(conversation))) {
-        if (isDm) dmShapeFailed = "availability";
-        else emailShapeFailed = "availability";
+      //
+      // Not just availability: EVERY deterministic rule runs on the draft
+      // about to be used (audit 2026-09-28). A reused draft is the common
+      // case — the five-minute reply and the unanswered rule both reuse
+      // scoring's draft, which never ran the email grounding check, and
+      // scoring keeps a DM that failed its shape check twice with only the
+      // buttons stripped. So "El costo será de $100" (2026-09-20) could
+      // still go out on the reuse path, on AUTONOMOUS with no check at all.
+      if (!dmShapeFailed && !emailShapeFailed && message) {
+        if (isDm) {
+          const shape = checkDmDraftShape(
+            { body: message, buttons: quickReplies?.buttons ?? [] },
+            conversationText(conversation),
+            leadLanguageOf(lead)?.language,
+            businessText(conversation)
+          );
+          if (!shape.ok) dmShapeFailed = shape.rule;
+        } else {
+          emailShapeFailed = inventedSpecific(`${subject ?? ""}\n${emailBodyOf(message)}`, conversation, leadLanguageOf(lead)?.language);
+        }
       }
 
       if (dmShapeFailed) {
@@ -1368,7 +1381,11 @@ export async function runAutomationForBusiness(
             data: { suggestedMessage: message, suggestedSubject: null, suggestedQuickReplies: { question: "shape_failed", buttons: [] }, suggestedDraftedFor: newestMessageAt, suggestedDraftKind: draftKind, suggestedRiskLevel: null, suggestedRiskReason: null, suggestedRiskTopic: null },
           });
         }
-        const reason = `FollowUp couldn't write a short enough DM for ${lead.name.split(" ")[0]} (${dmShapeFailed}) — this one needs your eye before it goes`;
+        // A grounding failure says which part to distrust; only a real shape
+        // failure (two questions, too long) is "couldn't write a short DM".
+        const reason =
+          UNGROUNDED_DRAFT_REASONS[dmShapeFailed] ??
+          `FollowUp couldn't write a short enough DM for ${lead.name.split(" ")[0]} (${dmShapeFailed}) — this one needs your eye before it goes`;
         if (!(await recordHold(lead, { riskLevel: "shape", reason: UNGROUNDED_DRAFT_REASONS[dmShapeFailed] ?? dmShapeFailed, trigger: unansweredIds.has(lead.id) ? "unanswered" : isDeadLead ? DEAD_LEAD_ACTION : "silence" }))) {
           return { kind: "skipped", note: `${lead.name}: ${HOLD_NOT_RECORDED}` };
         }
diff --git a/followup/src/lib/dmDrafts.ts b/followup/src/lib/dmDrafts.ts
index 4e854fd..6dbf8c5 100644
--- a/followup/src/lib/dmDrafts.ts
+++ b/followup/src/lib/dmDrafts.ts
@@ -19,7 +19,7 @@
 
 import { isNotAnAnswer } from "@/lib/notAnAnswer";
 import type { Message } from "@/lib/types";
-import { ungroundedCalendarWords, unconfirmedAvailability } from "@/lib/grounding";
+import { ungroundedCalendarWords, ungroundedSpecifics, unconfirmedClaim } from "@/lib/grounding";
 import { DM_MAX_BUTTONS, QUICK_REPLY_TITLE_MAX_CHARS, type DmButton } from "@/lib/quickReplies";
 
 export const DM_CHANNELS: ReadonlySet<string> = new Set(["instagram", "messenger"]);
@@ -288,8 +288,12 @@ export function checkDmDraftShape(
   if (BANNED_CLOSER_RE.test(body)) return fail("banned_closer");
   if (/https?:\/\//i.test(body) || /www\./i.test(body) || /\S+@\S+\.\S+/.test(body)) return fail("contact");
 
+  // The chips are customer-facing words too: "Sat 10am" under a question
+  // is an offered slot, however plain the body is (audit 2026-09-28). The
+  // grounding rules below read the body and every button title together.
+  const spoken = [body, ...draft.buttons.map((b) => b.title)].join("\n");
   const known = new Set(conversationText.match(NUMBER_RE) ?? []);
-  if ((body.match(NUMBER_RE) ?? []).some((n) => !known.has(n))) return fail("digits");
+  if ((spoken.match(NUMBER_RE) ?? []).some((n) => !known.has(n))) return fail("digits");
 
   // The same invariant as the digits rule above, for a specific with no
   // digits in it. "Will this be for a weekday or weekend?" went out to a
@@ -299,8 +303,13 @@ export function checkDmDraftShape(
   //
   // draftDm regenerates once on any shape failure before giving up, so
   // this usually costs one extra call rather than a lost draft.
-  if (ungroundedCalendarWords(body, conversationText, locale).length > 0) return fail("calendar");
-  if (businessText !== undefined && unconfirmedAvailability(body, businessText)) return fail("availability");
+  if (ungroundedCalendarWords(spoken, conversationText, locale).length > 0) return fail("calendar");
+  if (businessText !== undefined) {
+    // Availability, a booking, a past action, a policy, opening hours: only
+    // the owner states these (src/lib/grounding.ts).
+    const claim = unconfirmedClaim(spoken, businessText);
+    if (claim) return fail(claim);
+  }
 
   if (draft.buttons.length > DM_MAX_BUTTONS) return fail("too_many_buttons");
   const seen = new Set<string>();
@@ -327,13 +336,48 @@ export function conversationText(conversation: Message[]): string {
 }
 
 /**
- * What the business itself has said in the thread: every outbound except
- * the instant acknowledgement, which is FollowUp's fixed template and states
- * nothing about the business.
+ * Every grounding rule, for any draft about to leave on an automated path
+ * that is not a DM (a DM gets checkDmDraftShape, which includes these):
+ * a number, price, day or time nobody wrote (ungroundedSpecifics), or a
+ * claim only the owner can make (unconfirmedClaim). Returns the rule that
+ * failed, keyed like UNGROUNDED_DRAFT_REASONS, or null.
+ *
+ * `ownerHint` is text the owner typed to steer this draft — a workflow
+ * step's note — and grounds a figure or a day the way the thread does. It
+ * does not ground a claim: the ready plans' own hints say things like "no
+ * discount", which must not make "10% discount" look grounded.
+ */
+export function inventedSpecific(text: string, conversation: Message[], locale?: string | null, ownerHint?: string | null): string | null {
+  const source = ownerHint ? `${conversationText(conversation)}\n${ownerHint}` : conversationText(conversation);
+  return ungroundedSpecifics(text, source, locale) ?? unconfirmedClaim(text, businessText(conversation));
+}
+
+/**
+ * The model's own words out of a composed email: composeFollowUpEmail
+ * wraps them as "<greeting>\n\n<body>\n\n<sign-off>", and the frame is
+ * FollowUp's text (the owner's name, which may carry digits when it falls
+ * back to an email local part) with nothing to ground against.
+ */
+export function emailBodyOf(composed: string): string {
+  const parts = composed.split("\n\n");
+  return parts.length >= 3 ? parts.slice(1, -1).join("\n\n") : composed;
+}
+
+/**
+ * What a PERSON at the business has said in the thread: a manual send, a
+ * reply synced from the owner's own inbox, a Meta echo of one typed in the
+ * native app (no trigger, or "manual" — the same test as ownerHasReplied).
+ *
+ * Not FollowUp's own automated sends, and not the live phone assistant's
+ * speech: both are model output nobody reviewed, and counting them let one
+ * invented claim that got out ground every later draft that repeated it
+ * (audit 2026-09-28). The instant acknowledgement and the holding message
+ * were already excluded as fixed templates.
  */
 export function businessText(conversation: Message[]): string {
   return conversation
-    .filter((m) => m.direction === "outbound" && !isAck(m))
+    // "voice-agent" is a stored channel the UI Message type doesn't name.
+    .filter((m) => m.direction === "outbound" && (m.trigger ?? "manual") === "manual" && (m.channel as string) !== "voice-agent")
     .map((m) => m.body)
     .join("\n");
 }
diff --git a/followup/src/lib/grounding.ts b/followup/src/lib/grounding.ts
index ad9926c..3e154ba 100644
--- a/followup/src/lib/grounding.ts
+++ b/followup/src/lib/grounding.ts
@@ -77,8 +77,12 @@ const NUMBER_RE = /\p{Nd}(?:[\p{Nd},.]*\p{Nd})?/gu;
  * first and a `time` branch would be unreachable code pretending to be a
  * safeguard. checkAckShape (src/lib/acknowledge.ts) carries one for the
  * same historical reason; it is equally unreachable there.
+ *
+ * Currency WORDS too (audit 2026-09-28): "It's fifty dollars for the
+ * visit" and "Son cien pesos" have no digit and no symbol, and passed.
  */
-const CURRENCY_RE = /[$€£₹¥]|%|\b(USD|EUR|GBP|INR|CAD|MXN|AUD|Rs\.?)\b/gi;
+const CURRENCY_RE =
+  /[$€£₹¥]|%|\b(USD|EUR|GBP|INR|CAD|MXN|AUD|Rs\.?|dollars?|bucks|euros?|pounds|quid|rupees?|rupaye|rupay|pesos?|dólares|dolares|reais|francs?|dirhams?|centavos)\b/gi;
 
 /**
  * Every specific in `draft` that `source` never contained — the whole
@@ -147,29 +151,150 @@ export function ungroundedSpecifics(draft: string, source: string, locale?: stri
  * false negative is the thing to avoid.
  */
 export function unconfirmedAvailability(draft: string, businessText: string): boolean {
-  if (AVAILABILITY_WORD_RE.test(businessText)) return false;
-  return draft
+  return unconfirmedClaimOf(CLAIMS[0], draft, businessText);
+}
+
+/**
+ * The same rule as unconfirmedAvailability, for every other kind of fact
+ * only the business can state (audit 2026-09-28, "reply truth"). Each one
+ * was a real or reproduced draft that passed every deterministic guard:
+ *
+ *   booking       "Perfect, you're booked for Saturday. See you then!"
+ *   done          "I've sent you the details by email."
+ *   policy        "Estimates are free, no obligation."
+ *   hours         "Yes, we're open now until late."
+ *
+ * None contains a digit, and the day in the first one is the LEAD's own
+ * word (they tapped "Saturday"), so the calendar rule grounds it. What is
+ * invented is the assertion, and an assertion of these kinds is the
+ * owner's to make. Same shape as availability: a sentence that is a
+ * question, or that says it is being found out, states nothing; a
+ * statement of the kind needs the business to have made one first.
+ *
+ * `businessText` must be what a PERSON at the business sent (businessText
+ * in src/lib/dmDrafts.ts), never FollowUp's own automated sends — or one
+ * invented claim that got out grounds every later one.
+ *
+ * Lists, like the availability words: English, Spanish, French and
+ * Portuguese, and only as multilingual as that. A false positive costs one
+ * redraft and then a draft that waits for the owner.
+ */
+export type ClaimKind = "availability" | "booking" | "done" | "policy" | "hours" | "service";
+
+export function unconfirmedClaim(draft: string, businessText: string): ClaimKind | null {
+  for (const claim of CLAIMS) {
+    if (unconfirmedClaimOf(claim, draft, businessText)) return claim.kind;
+  }
+  return null;
+}
+
+/** `polar`: yes and no are different facts ("still available" vs "no longer available"). */
+type Claim = { kind: ClaimKind; statement: RegExp; hedge: RegExp; polar?: boolean };
+
+function unconfirmedClaimOf(claim: Claim, draft: string, businessText: string): boolean {
+  // Grounded only by a business sentence that STATES it, unhedged. The
+  // bare word was enough before, so "Let me check if it's still
+  // available" in an earlier send grounded "It's available" forever after.
+  // For a polar kind the business must have said it the same way round:
+  // "Sorry, it's no longer available" does not ground "It's available".
+  const said = claimStatements(claim, businessText);
+  return claimStatements(claim, draft).some((s) =>
+    claim.polar ? !said.some((b) => NEGATED_RE.test(b) === NEGATED_RE.test(s)) : said.length === 0
+  );
+}
+
+function claimStatements(claim: Claim, text: string): string[] {
+  return text
     // Sentences, and also clauses joined by a dash or semicolon: "We do
     // have availability — shall I send the details?" ends in a question
     // mark but still states availability in its first half.
     .split(/(?<=[.!?¡¿？。\n;])|\s[—–]\s/u)
     .map((s) => s.trim())
     .filter(Boolean)
-    .some((sentence) => {
-      if (/[?？؟]\s*$/u.test(sentence)) return false;
-      if (!AVAILABILITY_WORD_RE.test(sentence)) return false;
-      return !AVAILABILITY_HEDGE_RE.test(sentence);
+    // A question states nothing — except in the clauses before it: "Yes,
+    // it's still available, want to book a viewing?" is one sentence that
+    // ends in a question mark, and the DM shape (one sentence, one
+    // question, last) invites exactly that. Only the final clause of a
+    // question is the question.
+    .flatMap((sentence) => (/[?？؟]\s*$/u.test(sentence) ? sentence.split(/,\s+/u).slice(0, -1) : [sentence]))
+    .filter((sentence) => {
+      if (!claim.statement.test(sentence)) return false;
+      return !claim.hedge.test(sentence);
     });
 }
 
-// "available", "availability", "disponible(s)", "disponibilidad",
-// "disponibilité", "disponível", plus "opening(s)" in the booking sense.
-const AVAILABILITY_WORD_RE = /availab|disponib|dispon[ií]vel|\bopenings?\b/iu;
+const NEGATED_RE =
+  /\b(no longer|not|isn'?t|aren'?t|wasn'?t|don'?t|doesn'?t|never|sold|rented|leased|taken|closed|out of stock|ya no|no (est|hay|tenemos|queda)|agotad|vendid|cerrad|plus|pas|não|fechad|esgotad)\b/iu;
 
 // Words that turn a sentence into "I'm finding out" rather than "it is".
 const AVAILABILITY_HEDGE_RE =
   /\b(check|checking|confirm|confirming|see if|see whether|find out|look into|looking into|let (me|you) know|get back|whether|if (it|the|this|that|there|we|they)|verif|revis|comprob|confirmar|averigu|ver si|si (est|sigue|hay|tenemos)|vérifi|vou verificar|se (est|ainda))/iu;
 
+// The same idea for the other kinds, plus "details"/"info": "I'll send you
+// the warranty details" promises information, it does not state a policy.
+// "if" only in the finding-out sense ("if it's included"): "it's fully
+// refundable if you cancel" is a policy with a condition, not a hedge.
+const FIND_OUT_HEDGE_RE =
+  /\b(check|checking|see if|see whether|find out|look into|looking into|let (me|you) know|get back|whether|if (it|the|this|that|there|we|they|our)|details|info|information|options)\b|confirm(ing)? (if|whether|with)|(i'?ll|i will|we'?ll|we will|to|let me|going to) confirm|verif|revis|comprob|averigu|ver si|\bsi\b|detalles|informaci[oó]n|confirmar|vérifi|détails|confirmer|informations|detalhes|informações/iu;
+
+// Booking has its own hedge because "confirmed" IS the claim: only a
+// future or conditional confirm ("I'll confirm", "once it's booked") hedges.
+const BOOKING_HEDGE_RE =
+  /\b(i'?ll|i will|we'?ll|we will|to|let me|going to|can|could|would|once|before|as soon as)\s+(\w+\s+){0,2}?(confirm|book|schedule|reserve|check)|\bif\b|\bwhether\b|\bcheck|\bsee if\b|\bfind out\b|voy a (confirmar|reservar|agendar|revisar)|vamos a|para (confirmar|reservar|agendar)|je vais|pour (confirmer|réserver)|vou (verificar|confirmar|marcar|agendar)|\bsi\b/iu;
+
+// A past action the business supposedly took. "Not yet"/"haven't" is the
+// honest version and is allowed.
+const DONE_HEDGE_RE = /\b(if|whether|not yet|haven'?t|hasn'?t|didn'?t)\b|aún no|todavía no|no (he|hemos) |pas encore|ainda não/iu;
+
+const CLAIMS: Claim[] = [
+  {
+    kind: "availability",
+    // "available", "availability", "disponible(s)", "disponibilidad",
+    // "disponibilité", "disponível", "opening(s)" in the booking sense, and
+    // the words people actually use for it on a listing or a job: in
+    // stock, sold, rented, still on the market, we can fit you in, libre.
+    statement:
+      /availab|disponib|dispon[ií]vel|\bopenings?\b|\bin stock\b|\bout of stock\b|\bsold( out)?\b|\b(been|already|is|was|got) (rented|leased|taken|booked up)\b|\bhasn'?t been (rented|leased|taken|sold)\b|\bon the market\b|\bstill (for (sale|rent|lease)|up|listed|free|there|going|open)\b|\bfit you in\b|\b(have|got) (space|room|a spot|spots|a slot|slots|an opening|capacity)\b|\bvacan|agotad|\bvendid[oa]s?\b|alquilad|rentad|\b(sigue|está|esta|todavía|todavia|aún|aun) (libre|en venta|en renta)\b|\ben stock\b|épuis|\bvendu|\blou[ée]\b|encore libre|esgotad|alugad|\b(ainda|está) (livre|à venda)|\b(only|just) (a few|one|two|a couple|a handful) (left|remaining)\b|\blast one\b|\bquedan? (pocos|pocas|unos|unas|solo)|\bsolo queda\b|\bil en reste\b|\brestam (poucos|poucas)\b/iu,
+    hedge: AVAILABILITY_HEDGE_RE,
+    polar: true,
+  },
+  {
+    kind: "booking",
+    statement:
+      /\b(you'?re|you are|we'?re|we are|that'?s|it'?s|all) (all )?(booked|confirmed|scheduled|reserved|set|locked in|pencil+ed in)\b|\bbooked (you|it) in\b|\b(i'?ve|we'?ve|i have|we have) (booked|scheduled|reserved|confirmed)\b|\bput you (down|in)\b|\bsee you (then|there|on|at|tomorrow|today|soon|next|this|mon|tue|wed|thu|fri|sat|sun)|\bconfirmed for\b|\b(appointment|booking|visit|viewing|call) is (confirmed|set|booked|scheduled)|te esperamos|nos vemos|\b(queda|quedó|está|esta|ya est[aá]) (agendad|reservad|confirmad|apartad)|cita (confirmada|agendada)|c['’]est (noté|réservé|confirmé)|\bà (samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain)\b|rendez-vous (est )?(confirmé|réservé|noté)|\b(está|fica|ficou) (agendad|marcad|confirmad|reservad)|\baté (amanhã|sábado|domingo|segunda|terça|quarta|quinta|sexta)/iu,
+    hedge: BOOKING_HEDGE_RE,
+  },
+  {
+    kind: "done",
+    statement:
+      /\b(i'?ve|i have|we'?ve|we have|i|we) (just |already )?(sent|emailed|e-mailed|texted|messaged|attached|forwarded|shared|booked|scheduled|reserved|called|phoned|rang|spoke|talked|arranged|mailed|passed (this|it|your)|left you)\b|\b(i'?ve|we'?ve) (spoken|talked|been in touch)\b|\b(attached|enclosed) (is|are|you'?ll find)\b|\bplease find (attached|enclosed)\b|\bas (we )?(discussed|agreed|promised)\b|\bfollowing (our|your) (call|conversation|chat|visit)\b|\bya te (\p{L}+ )?(envi|mand|pas|compart|reserv|agend|llam)|\bte (envié|mandé|compartí|llamé|reservé|agendé|escribí)\b|\bhe (enviado|mandado|reservado|agendado|confirmado|llamado|hablado|compartido)\b|\bte adjunto\b|\bcomo (lo )?(hablamos|acordamos|conversamos|prometí)\b|\bje (vous |t['’])?\s?ai (envoy|transmis|réserv|confirm|appel|partag)|\bj['’]ai (envoy|transmis|réserv|confirm|appel|partag|parlé)|\bnous avons (envoy|réserv|confirm|appel)|\bci-joint\b|\bcomme (convenu|promis|discuté)\b|\b(te |lhe )?(enviei|mandei|reservei|agendei|confirmei|liguei|compartilhei)\b|\bem anexo\b|\bcomo (combinado|conversamos|prometido)\b/iu,
+    hedge: DONE_HEDGE_RE,
+  },
+  {
+    kind: "policy",
+    statement:
+      /(?<!(feel|you'?re|you are|are you|i'?m|we'?re|if you'?re) )\bfree\b|\bno (charge|cost|obligation|fee)|\bat no (extra )?cost\b|\bcomplimentary\b|\bincluded\b|\bincludes\b|\brefund|\bmoney[- ]back\b|\breturn policy\b|\bwarrant|\bguarantee|\bdeposit\b|\bcancel+ation\b|\binsured\b|\blicensed\b|\bcertified\b|\bfinancing\b|\bdiscount|\bgratis\b|\bsin (costo|cargo|compromiso)|incluid|\bincluye|reembols|devoluci|garant|\bdep[oó]sito\b|\banticipo\b|descuento|gratuit|\bsans frais\b|\binclus\b|rembours|\bacompte\b|\bremise\b|grátis|\bsem (custo|compromisso)\b|\binclu[ií]d|devolução|desconto/iu,
+    hedge: FIND_OUT_HEDGE_RE,
+  },
+  {
+    kind: "hours",
+    statement:
+      /\b(we'?re|we are|i'?m|i am|shop is|office is|store is|still) (open|closed)\b(?!\s+to\b)|\bopen (now|today|tonight|until|till|til|late|24|all day|every day|daily|on (week|mon|tue|wed|thu|fri|sat|sun))|\bclosed (on|today|tomorrow|for)\b|\b24\/7\b|\bround the clock\b|\b(estamos|está|esta|seguimos) (abiert|cerrad)|\babiert[oa]s? (hoy|ahora|hasta|los|todos)|\b(nous sommes|on est|c['’]est) (ouvert|fermé)|\bouverts? (aujourd|jusqu|le |tous)|\b(estamos|está) (abert|fechad)|\baberto (hoje|até|aos|todos)/iu,
+    hedge: FIND_OUT_HEDGE_RE,
+    polar: true,
+  },
+  {
+    // What the business does, covers or accepts: "yes, we cover Brampton",
+    // "we offer financing", "we take e-transfer". The first-reply judge
+    // lists this ("that the business does or doesn't offer, cover, or
+    // serve something"); the follow-up judge never did.
+    kind: "service",
+    statement:
+      /\bwe (do |also |definitely )?(cover|serve|service|come out to|travel to|deliver|ship|work in|offer|provide|accept|take (cash|cards?|credit|debit|e-?transfers?|payments?))\b|\b(cubrimos|atendemos|llegamos a|enviamos a|ofrecemos|aceptamos|trabajamos en)\b|\bnous (couvrons|desservons|livrons|offrons|proposons|acceptons|intervenons)\b|\b(atendemos|cobrimos|entregamos|oferecemos|aceitamos)\b/iu,
+    hedge: FIND_OUT_HEDGE_RE,
+  },
+];
+
 /** Weekday and month names for a locale, lowercased. */
 function calendarWords(locale: string): string[] {
   const out: string[] = [];
@@ -187,6 +312,14 @@ function calendarWords(locale: string): string[] {
       const d = new Date(Date.UTC(2024, m, 15));
       out.push(month.format(d), monthShort.format(d));
     }
+    // "today" and "tomorrow" — the words a callback promise is made of
+    // ("I'll call you tomorrow"), and Intl knows them in every locale:
+    // "mañana", "demain", "amanhã", "ਭਲਕੇ", "આવતીકાલે" (audit 2026-09-28).
+    // Not weeks: "this week or later?" is the ordinary how-soon question the
+    // DM sets ask for. (Hindi "आज"/"कल" are two characters and fall to the
+    // length filter below — a known gap.)
+    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
+    out.push(relative.format(0, "day"), relative.format(1, "day"));
   } catch {
     // An unknown or malformed locale tag. Nothing to add; the English
     // pass below still runs, and a check that throws would block a send.
@@ -236,6 +369,15 @@ const UNDERIVABLE = [
   "week-end", "week-ends", "jour ouvrable", "jours ouvrables", "quinzaine",
   // Portuguese
   "fim de semana", "fins de semana", "dia útil", "dias úteis", "quinzena",
+  // A time of day or a turnaround with no digits in it — "I'll call you in
+  // an hour", "our tech can be there tonight" (audit 2026-09-28). "Soon"
+  // and "shortly" are deliberately absent: they are the one timeframe the
+  // drafters are allowed to give.
+  "tonight", "this morning", "this afternoon", "this evening", "an hour", "half an hour", "within the hour",
+  "end of day", "end of the day", "first thing",
+  "esta noche", "esta tarde", "una hora", "media hora", "hoy mismo",
+  "ce soir", "cet après-midi", "une heure", "une demi-heure", "dans la journée",
+  "esta noite", "hoje à noite", "uma hora", "meia hora",
 ];
 
 /**
@@ -260,12 +402,18 @@ export function ungroundedCalendarWords(draft: string, source: string, locale?:
 
   for (const word of vocabulary) {
     if (!hasWord(draft.toLowerCase(), word)) continue;
+    // "You may want to bring photos" is not the month (audit 2026-09-28:
+    // every draft with "may", "sat" or "march" in it failed as an invented
+    // day). These count only written as a name, capitalised: "in May".
+    if (ENGLISH_WORDS_THAT_ARE_ALSO_DATES.has(word) && !hasWord(draft, word[0].toUpperCase() + word.slice(1))) continue;
     if (hasWord(lowerSource, word)) continue;
     found.add(word);
   }
   return [...found];
 }
 
+const ENGLISH_WORDS_THAT_ARE_ALSO_DATES = new Set(["may", "sun", "sat", "march", "mar", "wed"]);
+
 /**
  * Whole-word containment that does not assume spaces.
  *
diff --git a/followup/src/lib/holdReasons.ts b/followup/src/lib/holdReasons.ts
index af6f9fd..546c1c6 100644
--- a/followup/src/lib/holdReasons.ts
+++ b/followup/src/lib/holdReasons.ts
@@ -113,6 +113,11 @@ export const UNGROUNDED_DRAFT_REASONS: Record<string, string> = {
   time: "the draft names a time nobody in this conversation gave — check it before it goes",
   calendar: "the draft names a day nobody in this conversation mentioned — check it before it goes",
   availability: "the draft says whether it's available, and only you know that — check it before it goes",
+  booking: "the draft tells them a time is booked or confirmed, and only you can confirm that — check it before it goes",
+  done: "the draft says you already sent, called or arranged something this conversation doesn't show — check it before it goes",
+  policy: "the draft states what's free, included, refundable or guaranteed, and you haven't said that here — check it before it goes",
+  hours: "the draft says when you're open, and only you know that — check it before it goes",
+  service: "the draft says what you cover, offer or accept, and you haven't said that here — check it before it goes",
 };
 
 /** Exactly what ApprovalQueue.tsx builds, so tests can check the seam. */
diff --git a/followup/src/lib/integrations/openai.ts b/followup/src/lib/integrations/openai.ts
index 4c502d0..7dfe2fe 100644
--- a/followup/src/lib/integrations/openai.ts
+++ b/followup/src/lib/integrations/openai.ts
@@ -12,7 +12,7 @@ import { DM_SHAPE_RULES, type DmSituation } from "@/lib/dmDrafts";
 import { DM_MAX_BUTTONS, type DmButton } from "@/lib/quickReplies";
 import { registerInstruction, type LeadLanguage } from "@/lib/leadLanguage";
 import { hasPriceSlot, PRICE_SLOT, PRICE_SLOT_REASON } from "@/lib/priceSlot";
-import { ungroundedSpecifics } from "@/lib/grounding";
+import { ungroundedSpecifics, unconfirmedClaim } from "@/lib/grounding";
 // The client and model name live in their own leaf module so this file
 // and leadLanguage.ts don't import each other — see openaiClient.ts.
 import { MODEL, TRANSCRIBE_MODEL, getClient } from "@/lib/integrations/openaiClient";
@@ -1863,6 +1863,16 @@ export async function rewriteReply(
   // A rewrite that comes back empty or balloons is refused rather than
   // shown: the owner keeps what they had.
   if (!out || out.length > Math.max(400, text.length * 3)) return text;
+  // The prompt says "never add a fact"; this is the check (audit
+  // 2026-09-28). It matters most for "language": an owner who asked for
+  // Gujarati usually cannot read what came back, so for them this IS an
+  // unreviewed send. A figure, price or link neither the reply nor the
+  // thread contains, or a claim only the owner makes that their own reply
+  // did not, and the owner keeps what they had. Days are not checked: a
+  // translated weekday is a different word by design.
+  const source = `${text}\n${conversation.map((m) => m.body).join("\n")}`;
+  const invented = ungroundedSpecifics(out, source);
+  if (invented === "digits" || invented === "currency" || newLinkOrAddress(out, source) || unconfirmedClaim(out, text)) return text;
   return out;
 }
 
diff --git a/followup/src/lib/reactivationSend.ts b/followup/src/lib/reactivationSend.ts
index d8f39e7..28b80a7 100644
--- a/followup/src/lib/reactivationSend.ts
+++ b/followup/src/lib/reactivationSend.ts
@@ -44,7 +44,9 @@ import { recordAudit } from "@/lib/audit";
 import { getVoiceSamples } from "@/lib/voice";
 import { DEAD_LEAD_DEFAULT_DAYS, DEAD_LEAD_ACTION, deadLeadMessageHint } from "@/lib/automation";
 import type { Message } from "@/lib/types";
-import type { PipelineStage } from "@prisma/client";
+import { Prisma, type PipelineStage } from "@prisma/client";
+import { emailBodyOf, inventedSpecific } from "@/lib/dmDrafts";
+import { UNGROUNDED_DRAFT_REASONS } from "@/lib/holdReasons";
 
 const OWNER_CONCLUDED_STAGES: PipelineStage[] = ["WON", "LOST"];
 
@@ -351,6 +353,7 @@ export async function runReactivationSend(
           body: m.body,
           date: m.sentAt.toISOString(),
           opened: m.opened,
+          trigger: m.trigger ?? undefined,
         }))
       )
       .sort((a, b) => a.date.localeCompare(b.date));
@@ -358,6 +361,36 @@ export async function runReactivationSend(
     try {
       const draft = await draftReactivation(lead, conversation, voiceSamples);
 
+      // The owner approved this batch having read three drafts, not this
+      // one. A draft that invents a figure, a day, or a claim only the owner
+      // can make ("it's still available", "estimates are free") is held for
+      // them instead of sent (audit 2026-09-28). The claim above is kept:
+      // the lead is not batch-messaged later, and the draft waits in
+      // Approvals with the reason.
+      const invented = inventedSpecific(`${draft.subject}\n${emailBodyOf(draft.body)}`, conversation, undefined);
+      if (invented) {
+        await prisma.lead.update({
+          where: { id: lead.id },
+          data: {
+            suggestedMessage: draft.body,
+            suggestedSubject: draft.subject,
+            suggestedQuickReplies: Prisma.JsonNull,
+            suggestedDraftKind: "reactivation",
+            suggestedRiskLevel: null,
+            suggestedRiskReason: null,
+            suggestedRiskTopic: null,
+          },
+        });
+        await recordAudit({ businessId, userId: null }, "ai.hold", {
+          targetType: "lead",
+          targetId: lead.id,
+          meta: { riskLevel: "shape", reason: UNGROUNDED_DRAFT_REASONS[invented] ?? UNGROUNDED_DRAFT_REASONS.digits, trigger: "dead_lead_reactivation", reactivationRunId: runId },
+        });
+        skipped += 1;
+        await prisma.reactivationRun.update({ where: { id: runId }, data: { sent, failed, skipped } });
+        continue;
+      }
+
       const result = await sendFollowUpToLead(lead.id, draft.body, {
         automated: true,
         subject: draft.subject,
diff --git a/followup/src/lib/sequences.ts b/followup/src/lib/sequences.ts
index 79be94b..fae5c31 100644
--- a/followup/src/lib/sequences.ts
+++ b/followup/src/lib/sequences.ts
@@ -42,7 +42,8 @@ import { recordAudit } from "@/lib/audit";
 import { isWithinSendWindow } from "@/lib/sendWindow";
 import type { Prisma, SequenceAction, PipelineStage } from "@prisma/client";
 import type { Message } from "@/lib/types";
-import { HOLD_ALL_SEQUENCE_REASON, RISK_CHECK_FAILED_REASON } from "@/lib/holdReasons";
+import { HOLD_ALL_SEQUENCE_REASON, RISK_CHECK_FAILED_REASON, UNGROUNDED_DRAFT_REASONS } from "@/lib/holdReasons";
+import { inventedSpecific } from "@/lib/dmDrafts";
 
 export interface SequenceStepInput {
   /** Hours after the previous step (or enrollment). Preferred. */
@@ -684,6 +685,9 @@ export async function runSequencesForBusiness(businessId: string): Promise<Seque
             body: m.body,
             date: m.sentAt.toISOString(),
             opened: m.opened,
+            // Who wrote each outbound: the grounding check below counts only
+            // what a person at the business said (businessText, dmDrafts.ts).
+            trigger: m.trigger ?? undefined,
           }))
         );
         // Never an automatic text or WhatsApp to someone who has not
@@ -796,7 +800,15 @@ export async function runSequencesForBusiness(businessId: string): Promise<Seque
         // failed check: sending something that shouldn't have gone out is
         // worse than an unnecessary manual review.
         let risk: { riskLevel: "low" | "medium" | "high"; reason: string };
-        if (holdAll) {
+        // The deterministic net every other drafting path has, which this
+        // one never did (audit 2026-09-28): a figure, a day or a claim only
+        // the owner can make, that neither the thread nor the owner's own
+        // step note contains. Checked before the hold-everything branch so
+        // the owner is told WHICH part to distrust.
+        const invented = inventedSpecific(`${draft.subject ?? ""}\n${draft.body}`, conversation, leadLanguageOf(lead)?.language, step.messageHint);
+        if (invented) {
+          risk = { riskLevel: "high", reason: UNGROUNDED_DRAFT_REASONS[invented] ?? UNGROUNDED_DRAFT_REASONS.digits };
+        } else if (holdAll) {
           // The classifier decides whether something is safe to send
           // WITHOUT review. On an account where nothing sends without
           // review, it has nothing to decide, so its cost is not worth
@@ -860,7 +872,7 @@ export async function runSequencesForBusiness(businessId: string): Promise<Seque
             leadId: lead.id,
             businessId,
             assignedToId: lead.assignedToId,
-            message: holdAll
+            message: holdAll && !invented
               ? `"${sequence.name}" drafted a reply for ${lead.name}. Your account holds every follow-up for approval, so it's waiting for you — the workflow stopped here.`
               : `"${sequence.name}" drafted a reply for ${lead.name} that needs your OK before it goes out — the workflow stopped here so you can review it.`,
           });
```
