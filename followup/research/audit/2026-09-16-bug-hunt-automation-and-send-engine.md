# Bug hunt — automation and send engine (2026-09-16)

**Branch:** `claude/followup-demo-to-production-4k39hr`. **Report only; no code changed.**
**Scope:** everything that decides whether, when and how an automated message goes out —
`src/lib/automation.ts`, `automationStatus.ts`, `sequences.ts` (read for logic; the half-done
`delayHours` plumbing is deliberately not reported), `sending.ts`, `sendQueue.ts`, `acknowledge.ts`,
`sendWindow.ts`, `sendCaps.ts`, `reactivation.ts`, `reactivationSend.ts`, `metaWindow.ts`,
`suppression.ts`, `optOutKeywords.ts`, `inbound/meta.ts`, `inbound/twilioMessage.ts`, the four send-related
cron routes, `vercel.json`, and every test under `src/lib/__tests__/` that covers them.
**Method:** every finding below was traced end to end in the code as it is on disk today; line numbers are
from this working tree (note `sequences.ts` line numbers are from the current in-progress copy). Nothing
was executed against a live Meta/Twilio account — where a finding depends on provider behaviour that
the repo has never verified, it says so.

Prior passes already on file and **not** re-reported here: B-001 (a throw after the claim strands a lead
20h — `research/audit/backend-backlog.md`), the WhatsApp async-63016 false-positive send
(`research/integrations/2026-09-16-meta-channels-production-audit.md` §1b), and the absence of any
Meta-window handling in the two send wrappers (same doc, §3a).

---

## Ranking (by user harm)

| # | Finding | Harm class | Severity | Hypothesis |
|---|---|---|---|---|
| F1 | A workflow step whose send was **parked for retry is sent again** by the next hourly tick once the retry delivers | duplicate message | **Critical** | (new) |
| F2 | The instant ack makes the lead's **last message outbound**, so the 3h first-reply rescue — and the 20h Meta rescue — never fire for a lead who wrote once | missed message, badge lies "sent" | **High** | 6 (adjacent), 1 |
| F3 | Polite-hours deferral pushes a Meta DM rescue past the 24h window for every DM that arrives ~21:00–08:00 local | missed message, then a guaranteed provider refusal | **High** | **3 — Confirmed** |
| F4 | Enrolling an inbound-first lead (every DM/SMS/email lead) **self-cancels at step 0** with a "replied mid-sequence" notification; a source-rule enrollment also **kills the instant ack** and leaves the lead OFF | missed message + misleading notification | **High** | **4 — Confirmed** |
| F5 | `acknowledgedAt` is claimed, then a throw (localize/compose/sender lookup) loses the ack **forever** — the claim is never released on that path | missed message | Medium | **5 — duplicate Killed; loss Confirmed** |
| F6 | FollowUp's own DM sends come back as `is_echo` events and are recorded as **owner replies** (no `externalId` stored to dedupe) | misclassification → wrong rescue window, duplicate thread rows | Medium (provider behaviour not verified live) | **6 — Could not determine live** |
| F7 | The 20h recheck stamp, taken at a 3h (or business-configured <20h) consideration that ends in hold/skip, freezes a DM lead until after the cliff | missed message | Medium | **1 — Confirmed (variant)** |
| F8 | The retry ladder never re-checks the Meta window; with 5-min cron slippage the last attempt can cross 24h. Refusal is classified **permanent** (not retried forever) | wasted attempts, owner told "couldn't deliver" when nobody can | Low-Medium | **2 — "forever" Killed; crossing Confirmed** |
| F9 | The automation claim's `WHERE` doesn't re-check `automationTier`/`sequenceId`, so an enrollment landing mid-tick lets both schedulers message the lead | duplicate message (rare) | Medium (low probability) | 4 |
| F10 | Every sequence exit (complete, stop-on-reply, hold, no channel, manual unenroll) leaves `automationTier = OFF` | lead silently out of every automation | Medium | 4 |
| F11 | A sequence step whose send was queued is **re-drafted and re-refused hourly** (OpenAI spend + an owner notification per tick) until the retry resolves | noise + cost | Low | (new) |
| F12 | Meta inbound `sentAt` / ack `inboundAt` use processing time, not `event.timestamp`; the echo path uses the real timestamp | late-delivered/replayed DMs mis-timed against both windows | Low | (new) |
| F13 | "No thanks" quick reply does **not** opt out; a button titled `Cancel`/`Stop`/`End`/`Quit` would, and any tap gets an AI "reply" | consent + oddity | Low | **7 — Killed as stated; caveat** |
| F14 | No decision-changing double `Date.now()` found; two cosmetic siblings | log line | Info | **8 — Killed** |
| F15 | Five tests model the shape that hides F1/F2/F4/F5 | — | — | — |

---

## F1 — Critical — A queued workflow step is delivered by the retry queue and then sent again by the next tick

**Where:** `src/lib/sequences.ts:668-688` (send + failure branch), `:691-713` (advance only on success);
`src/lib/sending.ts:483-511` (transient → `queueSendForRetry`, returns `{ success: false, queuedRetryAt }`);
`src/lib/sending.ts:369-376` (`hasSendInFlight` guard, only while a row is `queued`/`sending`);
`src/lib/sendQueue.ts:112,223-228` (`markSendDelivered` → `sent`, which is no longer "in flight").

**Scenario (times local):** 09:00 tick — lead on step 0 (EMAIL, escalated to text). Draft, risk low,
`sendFollowUpToLead` → Twilio 503 → row `q1` queued for 09:02, function returns `{ success: false,
failure: "transient", queuedRetryAt }`. `sequences.ts:674-688` treats any `!result.success` as "leave
enrolled on the same step, notify, skip". 09:05 retry cron claims `q1`, Twilio accepts, `markSendDelivered`
→ `q1.status = "sent"`, Message + FollowUp written, `lastContacted` bumped. 10:00 tick — lead is still on
step 0 (`sequenceStepDueAt` lock expired at 09:05), stop-on-reply sees the last message is **outbound**
(our delivered retry) so it continues, drafts a fresh step-0 message, `hasSendInFlight` finds nothing
unresolved, and **sends step 0 a second time**. The lead gets two different follow-ups an hour apart,
in the owner's name. `sendQueue.ts:23-28` documents the in-flight guard as the defence against exactly
this race, but the guard only lives as long as the queue row is unresolved (≤ ~3h) and the hourly
redraft outlives a two-minute retry.

The same shape does **not** bite `automation.ts` (after delivery the last message is outbound and
`lastContacted` moved, so neither the unanswered nor the silence query re-selects it), `reactivationSend.ts`
(`reactivationSentAt` is claimed before drafting) or `acknowledge.ts` (`queuedRetryAt` keeps the
`acknowledgedAt` claim, `:527-529`). Sequences are the one caller that re-drives itself from its own step index.

**Patch:** in `sequences.ts` treat `result.queuedRetryAt` as "sent for bookkeeping" — advance the step
exactly as the success path does (the queue guarantees bounded delivery or a terminal `failed` with an owner
notification, `sending.ts:806-817`), and only stay enrolled on a `failure: "permanent"`/`"refused"` result.
If the step must not advance until delivery, store the `OutboundSend.id` on the lead and advance when
`markSendDelivered` runs — larger change, backend agent.

**Test (sequences.test.ts):** `send.mockResolvedValueOnce({ success: false, failure: "transient",
queuedRetryAt: new Date(Date.now() + 120_000) })` on an EMAIL step → expect `p.lead.update` called with
`sequenceStepIndex: 1` and `r.skipped` empty; a second run with `send` succeeding must not call `send` for
step 0 again. Today's "send-failure notification" test (`sequences.test.ts:207-226`) mocks `{ success: false,
message }` with no `queuedRetryAt`, so the queued shape — the one `sendFollowUpToLead` actually returns for a
Twilio blip — is never exercised.

---

## F2 — High — The instant ack turns the lead's last message outbound, so "Reply for me when I haven't" never fires for a lead who wrote once

**Where:** `src/lib/automation.ts:234-235` (`last` = newest message of any direction;
`if (last.direction !== "inbound") return false;`), `:246-248,256` (the `hasSubstantiveOutbound` /
`UNANSWERED_FIRST_REPLY_HOURS` logic that is meant to *ignore* the instant ack), `src/lib/sending.ts:559-566`
(the ack is an ordinary outbound `Message` with `sentAt = now()`), `src/lib/automationStatus.ts:115-116,166`
(same `lastIsInbound` test; falls through to `{ kind: "sent" }`).

**Scenario:** Instagram lead DMs "How much for a two-bed?" at 10:00. 10:02 the deferred ack goes out
("Got it — I'll get you the exact price…"). Nobody replies. 13:00 tick: `findUnansweredLeads` loads the
thread, the newest message is the ack (outbound) → `return false`. Every subsequent tick: same. The 3h
first-reply safety net (`:57`) and the 20h Meta ceiling (`metaWindow.ts:51`) both only apply to a lead whose
newest message is inbound, i.e. **only if the lead writes a second time after the ack**. For the
single-message lead — the case the ack was written to open, and the case the code comment at `:236-239` says
the 3h rule exists for — no substantive automated reply is ever attempted inside Meta's window. The next
automation that can touch this lead is the 5-day silence rule, which on Instagram/Messenger is always refused
(`research/integrations/2026-09-16-meta-channels-production-audit.md` §3a). The lead's badge reads "sent"
(`automationStatus.ts:166`), i.e. "we already replied and nothing is due".

**Why the tests pass:** `automation.test.ts:283-304` (`firstReplyLead`) places the `instant_ack` outbound
at `hoursAgo + 1` and the inbound at `hoursAgo` — the ack *before* the message it acknowledges. That is the
inverse of what `sendFollowUpToLead` produces. `automationStatus.test.ts:79-83` does the same
(`msg("outbound", 5), msg("inbound", 4)`).

**Patch:** when `hasSubstantiveOutbound` is false, every outbound on the lead is an instant ack, so judge
neglect on the **newest inbound** instead of the newest message: `const judged = hasSubstantiveOutbound ?
last : newestInbound; if (judged.direction !== "inbound") return false; … judged.sentAt <= …`. Mirror it in
`computeAutomationStatus`. Both are contained; the shared shape belongs in `effectiveUnansweredHours`'s
neighbour so the badge and the engine cannot diverge again.

**Test:** inbound at T-4h, `instant_ack` FollowUp + outbound Message at T-3h58m (after the inbound) →
`r.unanswered === 1`; same fixture in `automationStatus.test.ts` → `due_soon/unanswered`, not `sent`.

---

## F3 — High — Hypothesis 3 Confirmed: the polite-hours window and Meta's 24h window collide for roughly half the clock

**Where:** `src/lib/automation.ts:397-400` (deferral releases the claim; next look is the next hourly tick),
`src/lib/sendWindow.ts:20` (08:00–17:59 local), `src/lib/metaWindow.ts:50-51` (20h ceiling, 4h headroom),
`vercel.json` (`0 * * * *`). Same gate in `src/lib/sequences.ts:530-532`, evaluated *before* channel
detection, so an EMAIL step escalated to Instagram/Messenger is deferred identically.

**Trace (established DM conversation, 24h configured → 20h effective, business in `America/New_York`):**

| Lead's DM at (local) | Eligible at | First in-window tick | Sent at | Meta window |
|---|---|---|---|---|
| 21:00 | 17:00 next day | 17:00 | T0+20h | inside |
| 21:30 | 17:30 | 18:00 tick is outside → 08:00 day+2 | **T0+34.5h** | **closed** |
| 22:00 | 18:00 | 08:00 day+2 | **T0+34h** | **closed** |
| 02:00 | 22:00 | 08:00 | **T0+30h** | **closed** |
| 08:00 | 04:00 | 08:00 | T0+24h | **cliff** |
| 09:00 | 05:00 | 08:00 | T0+23h | inside (barely) |
| 12:00 | 08:00 | 08:00 | T0+20h | inside |

Every DM arriving in roughly (21:00, 08:00] local — eleven of twenty-four hours, and the evening is when
consumers DM — gets its rescue at 08:00 the following morning, 24–35h after the message. At that tick the
lead is still eligible (last message inbound, ≥20h old), the claim succeeds, OpenAI drafts, the risk gate
passes, `sendInstagramMessage` gets code 10 / subcode 2018278 back (HTTP 4xx → `isTransientError` false →
`"permanent"`, `sending.ts:196-206`), the outcome is `skipped`, the lead stays claimed for 20h, and
**`notifyNeglect` is not called** (`:669` only fires on success) — the owner is never told this lead exists
and was never answered. The 3h first-reply path is *not* affected (T0+3h deferred to 08:00 is at most
T0+17h). Note F2 means this path is only reachable today when the lead wrote twice; fixing F2 makes F3 the
dominant failure.

`metaWindow.ts:29-31` says the 4h headroom exists because "a send can be held for approval and re-attempted"
— it does not account for a 14-hour overnight deferral.

**Patch (product call, two options):** (a) for `META_DM_CHANNELS`, skip the polite-hours gate when the
next window-open instant would fall at or after `newestInbound.sentAt + META_DM_WINDOW_HOURS` — a DM reply
in the evening is native to the medium; or (b) hold for approval with reason "Instagram closes this
conversation at HH:MM" so a human can send inside the window. Either way `sequences.ts:530` needs the same
branch after the channel is known, not before.

**Test (automation.test.ts):** `sendWindow.mockReturnValue(false)` + `dmLead(21, "instagram")` → expect
`send` called (option a) or `r.held === 1` with a window reason (option b); `dmLead(21, "email")` must still
defer.

---

## F4 — High — Hypothesis 4 Confirmed: a sequence enrolled on an inbound-first lead cancels itself at step 0; a source-rule enrollment also silences the instant ack

**Where:** `src/lib/sequences.ts:492-518` (stop-on-reply looks at the newest message across the whole
thread, with no "since enrollment" cut), `:269-280` (`enrollLead` sets `automationTier: "OFF"`),
`src/lib/sourceRouting.ts:48-51` (rule → `enrollLead` at creation), `src/lib/instagram.ts:169` /
`facebook.ts:93` / `twilio.ts:194` (routing runs *before* the inbound Message is written),
`src/lib/acknowledge.ts:383` (`lead is OFF` refusal), `src/app/api/leads/[id]/automation/route.ts:42-47`
(tier cannot be turned back on while enrolled).

**Scenario A (manual enroll, any channel):** a lead wrote yesterday, nobody answered — precisely the lead an
owner would put on a cadence. Owner enrolls them. Next tick: claim succeeds, `lastMessage.direction ===
"inbound"` (their message from yesterday), the lead is **unenrolled**, the owner is told "X replied
mid-sequence — workflow stopped so you can take it from here", and `automationTier` is left OFF (F10). Step 0
never runs. The only way a step ever runs is if the owner replies first, which inverts the feature's purpose.
`sequences.test.ts:67-86` (`enrolled()`) always seeds a business-first outbound two days earlier, so no test
has an inbound-first lead.

**Scenario B (source rule "Instagram → workflow"):** DM arrives → lead created → `applySourceRouting` →
`enrollLead` → OFF → `acknowledgeNewLead` returns `"lead is OFF"` (no two-minute grace, no ack) → inbound
Message written. Next tick: Scenario A. Net: no ack, no step, a misleading notification, and a lead that
no automation will ever touch again (OFF, unenrolled, and F2 would not rescue it anyway).

**Patch:** stop-on-reply must only consider inbound messages newer than the enrollment / the previous
step's send. Cheapest without schema: compare against `Math.max(enrolledAt, lastStepSentAt)` — both need a
column (`Lead.sequenceEnrolledAt`), so this is a backend-agent change. Separately, `enrollLead` should not
set OFF for a lead that has not been acknowledged yet, or `acknowledgeNewLead` should treat "OFF because
enrolled" (`sequenceId != null`) as eligible.

**Test (sequences.test.ts):** enrolled lead whose only message is inbound and older than enrollment →
step 0 runs, `pausedForReply === 0`; inbound *after* enrollment → paused. `acknowledge.test.ts`: lead with
`automationTier: "OFF", sequenceId: "seq1"` → ack still sent (or explicitly documented as refused).

---

## F5 — Medium — Hypothesis 5: duplicate Killed; but a post-claim throw loses the ack permanently

**Where:** `src/lib/acknowledge.ts:457-461` (claim), `:463` `prisma.business.findUnique`, `:465`
`getSenderFirstName`, `:489/:492/:494` `localizeFixedText` and `:490` `composeFollowUpEmail` — none wrapped;
`:534-538` catch returns `{ sent: false, reason: "error" }` **without** releasing `acknowledgedAt`
(the release at `:527-529` only runs on a returned `!result.success`); `:782-785` the worker treats
`"error"` as "leave the lease, retry next tick"; `:382` the retry then reads `acknowledgedAt` set →
`"already acknowledged"` → `clearDeferredAck` → the ack is gone.

**Duplicate check (the hypothesis as asked):** send succeeds → `clearDeferredAck` fails or the process dies →
lease expires → next tick re-claims → `acknowledgeNewLead` sees `acknowledgedAt` set → skipped. No second
send on any path; `acknowledgedAt` is claimed before the provider call and only released for a
non-queued send failure. **Killed.** The unconditional release at `:528` can also clear a claim a
concurrent channel's ack won moments earlier (it is `where: { id }`, not `where: { id, acknowledgedAt: <mine> }`)
— harmless today because the loser never retries, but it should be conditional.

**Scenario:** DM lead, worker tick, claim taken, `localizeFixedText` (an OpenAI call) times out → catch →
`"error"` → `retrying`. Five minutes later: `"already acknowledged"`, cleared. The lead never gets the
ack and, per F2, nothing else follows inside the window. On SMS/email (inline path) there is no retry at
all — one 429 on the localization call and the first touch is lost.

**Why the test passes:** `instantAckGracePeriod.test.ts:392-418` injects the throw via
`p.business.findUnique.mockRejectedValueOnce`, whose first call is the `checkAiEligibility` lookup at
`:444` — *before* the claim. A throw at `:463` or later is not covered.

**Patch:** wrap `:463-516` so that any throw after the claim releases it (`updateMany({ where: { id,
acknowledgedAt: claimedAt }, data: { acknowledgedAt: null } })`) before returning `"error"`, and make the
existing release at `:528` conditional on the same stamp.

**Test:** `localize.mockRejectedValueOnce(new Error("timeout"))` → tick → `retrying: 1` and
`lead.acknowledgedAt === null`; tick again after the lease → `sent: 1`.

---

## F6 — Medium — Hypothesis 6: consistent readers, but FollowUp's own DM sends are echoed back as owner replies

**Consistency (Confirmed):** `automation.ts:246`, `automationStatus.ts:136` (`direction === "outbound" && source`),
`acknowledge.ts:399-403` (any outbound), `engagement.ts:41` all treat a `captureDirectReply` row as a real
reply; `sequences.ts:496` deliberately does not stop on an outbound echo (an owner reply is not a lead reply).
No reader disagrees with another.

**The gap:** Meta's `message_echoes` subscription fires for messages sent *by the Page*, including
those sent through the Send API by a connected app, carrying `app_id`
(`research/integrations/2026-09-08-meta-business-agent-webhook-behavior.md:80-92`, Grade C; not verified
live — the code's own warning at `instagram.ts:194-209` says the same). `src/lib/inbound/meta.ts:164-171` /
`:232-239` route every echo to `captureDirectReply`, which upserts on `externalId = mid`
(`instagram.ts:220-225`). `sendInstagramMessage` / `sendMessengerMessage` discard the Send API's
`message_id`, and `sending.ts:442-447` stores no `externalId` for those channels — so the echo of our own
send finds nothing to collide with and creates a **second outbound Message with `source:
"instagram_direct"`**, then bumps `lastContacted`.

**Scenario:** deferred ack goes out at 10:02 (FollowUp row `instant_ack`, Message with no `externalId`).
10:02:03 the echo arrives → second outbound row, `source` set. `hasDirectEchoReply` is now true →
`hasSubstantiveOutbound` true → the 3h first-reply rule is replaced by the configured window for every DM
lead; the thread shows the ack twice; the badge counts the owner as having replied. Under F2 the
consequence is masked (the ack already blocks the rescue); once F2 is fixed this re-breaks it on Meta channels.

**Patch:** return `message_id` from both wrappers, pass it as `externalId` in `sending.ts:457,564` so the
echo upsert no-ops; belt-and-braces, in `meta.ts` skip echoes whose `app_id` equals `INSTAGRAM_APP_ID` /
`FACEBOOK_APP_ID`. **Verify first** with a real account that API-sent DMs do echo (one webhook dump).

**Test:** `dmOptOut.test.ts`-style route test: an `is_echo` event whose `mid` matches an existing outbound
`externalId` → no new Message; and a `sendInstagramMessage` unit test asserting `message_id` is surfaced.

---

## F7 — Medium — Hypothesis 1 Confirmed as a variant: the 20h stamp outlives the Meta window whenever a DM lead is *considered* before hour 20

**Where:** `src/lib/automation.ts:302` (`recheckCutoff = now - 20h`), `:382-389` (the claim stamps
`lastAutomationCheckedAt` on *consideration*, not on send), `:419-422` (AI-ineligible → `skipped`, claim
kept), `:595-655` (hold → claim kept), `:670-672` (permanent send failure → `skipped`, claim kept),
`src/app/api/automation/settings/route.ts:92` (`triggerHours` accepted 1–168).

**The literal sequence asked about** — "a DM lead checked at hour 19.x" — cannot happen under defaults:
nothing considers a DM lead between hour 3 and hour 20 (unanswered needs ≥ threshold; silent/dead need
`lastContacted` ≥ 5/45 days old, and every inbound bumps `lastContacted` — `instagram.ts:155`). It **does**
happen in two real configurations:

1. **First-reply path (default):** lead's second DM at T0 (the first got the ack; see F2 for why a second
   message is required today). 3h later the tick claims, drafts, and the risk gate says medium → **held**,
   stamped at T0+3.x h. Excluded until T0+23.x h; the tick at 23:xx–24:xx re-considers on the cliff. Or:
   AI-ineligible / `hasSendInFlight` refused / Instagram token expired → `skipped`, stamped, and the next
   automated look is at T0+23.x h with no notification in between.
2. **Business configured 6–19h** (allowed by Settings): considered at T0+12.x h, held/skipped, next look at
   T0+32.x h — outside the window, refused with code 10, `skipped`, stamped again.

The hold case is the human path and mostly fine (the owner is notified). The **skip** cases are silent: no
`notifyNeglect`, the badge says `due_soon`, and the 20h stamp guarantees the retry lands after the cliff.

**Patch:** the stamp conflates "a human owns this now" (hold) with "try later" (skip). For
`META_DM_CHANNELS`, on a `skipped` outcome release the claim the way the deferral does (`:398`) when the
window has ≥2h left, and when it has less, hold with a window reason instead of skipping. A cleaner shape is
an explicit `Lead.automationRecheckAt` written per outcome (hold: +20h; DM skip: `min(+20h, windowClosesAt −
2h)`), which is schema work for the backend agent.

**Test:** `dmLead(4, "instagram", { followUps: [{ trigger: "instant_ack" }] })` with
`aiEligible → { ok: false }` → expect the claim released (`lastAutomationCheckedAt: null`), matching the
deferral assertion at `automation.test.ts:536`.

---

## F8 — Low-Medium — Hypothesis 2: retried forever Killed; window never re-checked and crossable Confirmed

**Where:** `src/lib/sendQueue.ts:67` (`[2, 10, 30, 120]` minutes), `vercel.json` (`*/5` retry cron → each
step lands up to 5 min late), `src/lib/sending.ts:705-840` (retry re-enters the funnel: opt-out, suppression,
cap, billing — **no** window check; nothing in the codebase knows a DM's `windowClosesAt`), `:196-206`
(Meta's refusal arrives with `status` 4xx → `"permanent"`), `:806-817` (retired `failed`, owner notified,
`ai.send_failed` audited).

**Trace:** first attempt at the 21:00 tick for a 00:30 inbound (T0+20.5h; a 100-lead business adds minutes).
Meta 5xx → queued. Retries at ≤ +7, ≤ +22, ≤ +57, ≤ +182 min of slippage-inclusive backoff → the last attempt
can land at T0+23h35m–T0+24h. If it crosses, Meta returns code 10 (HTTP 4xx, `research/integrations/
2026-09-16-meta-channels-production-audit.md:264-265`; the HTTP status itself is per Graph API error semantics,
not verified live) → `"permanent"` → `failed` → owner notified "couldn't be delivered on Instagram after 5
tries — worth reaching out yourself", which they also cannot do (no template path on IG/Messenger). Not a
loop: the classifier is an allowlist (`transientError.ts:33`) and a 4xx never re-queues. If Meta ever
surfaced the window refusal as a 5xx it *would* be retried five times; worth a guard regardless.

**Patch:** add `expiresAt` to the `OutboundSend` envelope (DM channels: `newestInbound.sentAt + 24h`);
`rescheduleSend` returns null when `nextAttemptAt >= expiresAt`; `runOutboundRetries` retires expired rows as
`canceled` with a window-specific message before calling the provider. Schema + queue change → backend agent.

**Test (sendRetry.test.ts):** row with `channel: "instagram"`, `expiresAt` 1 min out, attempt 2 fails 503 →
`retireSend(..., "canceled", /window/)`, no `requeued`.

---

## F9 — Medium (rare) — The automation claim does not re-check the two things that make the lead eligible

**Where:** `src/lib/automation.ts:382-389` — the claim `WHERE` is `{ id, OR: [lastAutomationCheckedAt…] }`;
`automationTier: { not: "OFF" }` and the implicit "not enrolled" live only in the SELECT at `:215,:324,:341`.
`sequences.ts:447-450` re-checks `sequenceStepIndex` and `sequenceStepDueAt`, so an unenroll mid-tick is safe
in that direction (the claim matches zero rows once `sequenceStepDueAt` is null).

**Scenario:** 09:00:00 the tick loads an ASSISTED lead; 09:00:04 the owner enrolls it (`enrollLead` sets OFF
and a step due now); 09:00:06 the automation claim succeeds (nothing in its WHERE changed), drafts, sends.
10:00 the sequence runner sends step 0 (last message is now outbound — ours — so stop-on-reply doesn't fire).
Two messages an hour apart. Window is seconds, but the fix is one line.

**Patch:** add `automationTier: { not: "OFF" }, sequenceId: null` to the claim `WHERE`. Update the shape
assertion at `automation.test.ts:402-410`.

---

## F10 — Medium — Every way out of a sequence leaves the lead OFF

**Where:** `src/lib/sequences.ts:274-282` (`unenrollLead`), `:474-478`, `:500-504`, `:578-582`, `:646-655`,
`:700-711` — all clear `sequenceId/StepIndex/DueAt` and none touch `automationTier`; `deleteSequence:221-227`
too. `automation/route.ts:42-47` blocks turning it back on *while* enrolled, and nothing turns it back on after.

**Scenario:** a lead finishes a 3-step cadence (`sequenceCompletedAt` set) and replies a week later. The
unanswered rule (`automationTier: { not: "OFF" }`) never sees them; the instant ack is already spent; the
badge reads "off" as if the owner chose it. The stop-on-reply exit is worse (see F4): the lead is handed to
the owner "to take it from here" and every automated safety net is removed at the same moment.

**Patch:** on every exit restore the pre-enrollment tier. Without a column, restore `ASSISTED` (the product
default, `schema.prisma:379`) unless the owner explicitly set OFF — which needs `Lead.tierBeforeSequence`.
Backend agent.

---

## F11 — Low — A queued sequence send is re-drafted and re-refused every hour until the retry resolves

**Where:** `src/lib/sequences.ts:608-616` (draft before the send), `:668-688`; `src/lib/sending.ts:369-376`
(`hasSendInFlight` → `refused`). While `q1` is unresolved (up to ~3h), each hourly tick pays a draft + a risk
check, gets "An earlier message to this lead is still waiting to go out…", and writes an owner notification
(`notifySequenceIssue`) — up to three per queued step. Fixing F1 (advance on `queuedRetryAt`) removes this;
otherwise check `hasSendInFlight` *before* drafting.

---

## F12 — Low — Meta inbound timestamps are processing time; the echo path uses the event's

**Where:** `src/lib/inbound/meta.ts:176,:243` (`createInboundMessageIfNew(..., new Date(), mid)`),
`:198,:252` (`inboundAt: new Date()`), versus `:168,:236` (echo: `new Date(event.timestamp)`). Meta measures
the 24h window from the message's real time. A delayed delivery (Meta retries for hours on non-2xx; a replay
via `inboundEvents.ts:192` of a row that failed before the message was stored) records the inbound later than
it happened, so the 20h ceiling and the ack's `STALE_AFTER_MS` are both measured from the wrong instant — the
replayed DM gets a cheerful "just got your message" hours late, and the rescue is scheduled past the cliff.
**Patch:** use `event.timestamp` (fall back to `new Date()`) in all four places. Test in
`metaInboundAttachment.test.ts` style: an event with `timestamp` two hours old → `acknowledgeNewLead` receives
that `inboundAt`.

---

## F13 — Low — Hypothesis 7 Killed as stated, with a caveat on button titles

**Where:** `src/lib/optOutKeywords.ts:39-44` — whole-body match against `stop, stopall, unsubscribe,
cancel, end, quit`; `src/lib/inbound/meta.ts:41-60` (`messageContent` reads `message.text`), `:182,:247`.
A quick-reply tap is delivered as a `messages` event with `message.text` = the button **title** and a
`message.quick_reply.payload` (`research/integrations/2026-09-16-meta-human-agent-and-quick-replies-api-facts.md:76-87`,
Grade B). The planned titles are "Not now" / "Not right now" / "Not for me" / "Just looking" / "Leave it" /
"Sorted elsewhere" / "Yes" / "Morning" etc. (`research/product/2026-09-16-instagram-getting-a-reply-buttons-and-questions.md:264-266,300-367`).

- "No thanks", "Not now", every planned title → `isOptOutMessage()` is false. **Killed.**
- A button titled `Cancel` (or `Stop`, `End`, `Quit`) → `suppress(businessId, senderId, "keyword", channel)`
  — a silent, keyword-grade opt-out from a chip FollowUp itself put on screen. None is planned; worth a
  guard so a future title can't do it.
- Already reported in the API-facts file (`:364-370`): the payload is dropped and the title is handed to
  `acknowledgeNewLead` and scoring as the lead's words. **Traced here, not stated there:** an unhandled tap
  is stored as an ordinary inbound Message (`meta.ts:176`), so the lead's newest message is inbound → after
  3h/20h `findUnansweredLeads` selects it and the automation drafts a follow-up *to the "Not now"*. The
  honest exit chip triggers exactly the follow-up it declined, and in a sequence it trips stop-on-reply
  (F4). The buttons file names "a 'Not now' tap that stops nothing" as its first forbidden pattern (`:263`);
  the current inbound path does the opposite of stopping. A `postback` (button template) has no `message`
  → `messageContent` returns null → dropped without a Lead or Message.

**Patch:** in `messageContent`, when `message.quick_reply` is present, return `ownWords: ""` and expose the
payload; route consent and "stop the sequence / mark answered" by payload, never by title, and make a
decline tap count as *answered* (e.g. write it with a marker the unanswered rule excludes) so no rescue
fires on it. Test in `dmOptOut.test.ts`: `{ text: "Cancel", quick_reply: { payload: "QR_LATER" } }` →
`suppress` not called; `automation.test.ts`: a lead whose newest inbound is a `QR_LATER` tap → `unanswered === 0`.

---

## F14 — Info — Hypothesis 8 Killed: no sibling that changes a decision

Checked every `Date.now()` / `new Date()` in the scoped files (grep at the top of this pass). Siblings
found, none decision-changing:
- `automation.ts:531` vs `:629` — `daysSinceContact` computed twice with separate reads; the prompt hint and
  the hold reason can disagree by one day across midnight. Cosmetic.
- `automation.ts:297,302,318` — three cutoffs from three reads microseconds apart; the claim WHERE reuses the
  run-start `recheckCutoff`, the stamp uses claim-time `now`. Directionally safe.
- `sequences.ts:415,448,449` — query, claim WHERE, and lock from three reads; a lead becoming due between
  them is claimed anyway.
- `reactivation.ts:81-84` — `unclaimedOr()` evaluated at select and again at claim; the later `stale` is
  more permissive, never less.
- `acknowledge.ts:711/728/736` — the loop's `now` is fixed at start while the lease uses live time; a lead
  becoming due mid-loop waits one tick. Intended.
- `hoursAgo()` (`automation.ts:261-263`) reads its own clock for a notification string only.

---

## F15 — Tests that model the shape that hides the bug

| Test | What it mocks/orders | What it therefore cannot see |
|---|---|---|
| `automation.test.ts:283-304`, `automationStatus.test.ts:79-83` | instant-ack outbound placed *before* the inbound | F2 |
| `instantAckGracePeriod.test.ts:392-418` | the only throw injected is before the claim | F5 |
| `sequences.test.ts:67-86` | every enrolled lead has a business-first outbound | F4 |
| `sequences.test.ts:207-226` | send failure without `queuedRetryAt` | F1, F11 |
| `dmOptOut.test.ts:49`, `sendingAudit.test.ts:38-39` | `captureDirectReply` / IG send fully mocked, no `message_id` | F6 |
| `sendRetry.test.ts` | no DM row, no notion of a window | F8 |
| `automation.test.ts:877-967` (Meta ceiling block) | `updateMany → { count: 1 }` and a manual FollowUp on every fixture | F7 (skip-kept-claim) |

`instantAckGracePeriod.test.ts`'s stateful `updateMany` (`:52-61,:68-72`) is the right pattern and is what
let H5's duplicate hypothesis be killed with confidence; `automation.test.ts` and `sequences.test.ts` would
both benefit from the same shape for their claims.

---

## Hypothesis verdicts

| # | Verdict | One line |
|---|---|---|
| 1 | **Confirmed (variant)** — F7 | Not "checked at 19.x" under defaults; a hold/skip at 3.x h (or a configured 6–19h window) stamps 20h and the next look lands on or past the cliff. Skips are silent. |
| 2 | **"Retried forever" Killed; crossing Confirmed** — F8 | Code 10 arrives 4xx → permanent → `failed` + owner notified. The ladder plus 5-min cron slippage can put the last attempt past 24h; nothing re-checks the window. |
| 3 | **Confirmed** — F3 | DMs arriving ~21:00–08:00 local are rescued at 08:00 the following morning, 24–35h later; same gate in `sequences.ts`. |
| 4 | **Confirmed** — F4, F9, F10 | Inbound-first leads self-cancel at step 0; source-rule enrollment kills the ack; claim doesn't re-check tier; every exit leaves OFF. |
| 5 | **Duplicate Killed; loss Confirmed** — F5 | `acknowledgedAt` is the once-ever guard on every path; a throw after the claim never releases it, so the ack is lost, not doubled. |
| 6 | **Readers consistent; live behaviour Could not determine** — F6 | All four readers agree; the unverified risk is our own sends echoing back as owner replies. |
| 7 | **Killed as stated** — F13 | "No thanks" does not opt out; `Cancel`-titled buttons would. |
| 8 | **Killed** — F14 | Only cosmetic siblings. |

Cross-cutting: **F2 is the reason the Meta-ceiling work shipped this week (`7abc135`) does not yet change
what a single-message DM lead experiences** — the ceiling only applies to leads whose newest message is
inbound, and after the ack it never is.

---

## Handover (backend-ai-agent)

1. **F1 first.** In `sequences.ts:674-688` advance the step on `result.queuedRetryAt`; add the
   `queuedRetryAt` fixture to `sequences.test.ts`. This is the only duplicate-send path found.
2. **F2:** judge neglect on the newest *inbound* when `hasSubstantiveOutbound` is false, in both
   `findUnansweredLeads` and `computeAutomationStatus`; fix the two test fixtures' message order.
3. **F4:** add `Lead.sequenceEnrolledAt`; stop-on-reply only on inbound newer than
   `max(enrolledAt, lastStepSentAt)`; decide whether an enrolled-at-creation lead still gets the instant ack.
4. **F3 + F7:** product call (send anyway vs. hold with a window reason) for Meta DMs when polite hours or
   the 20h stamp would cross `newestInbound + 24h`; apply in `automation.ts:397` and `sequences.ts:530`,
   and release the claim on DM `skipped` outcomes.
5. **F5:** release `acknowledgedAt` (conditionally, on the stamp this call wrote) in the
   `acknowledge.ts:534` catch; add the post-claim-throw test.
6. **F6:** surface `message_id` from `sendInstagramMessage`/`sendMessengerMessage`, store it as
   `Message.externalId`, and dump one real echo payload to confirm API-sent DMs echo with `app_id`.
7. **F9 + F10:** one-line claim tightening in `automation.ts:382`; restore a tier on every sequence exit
   (needs `tierBeforeSequence` or a documented default of ASSISTED).
8. **F8:** `OutboundSend.expiresAt` for DM channels; retire as `canceled` past it, no provider call.
9. **F12 + F13:** `event.timestamp` for inbound `sentAt`/`inboundAt`; treat `message.quick_reply` taps as
   payload, not words.
10. Re-run the trust-guarantee suites after each of 1–5 (`automation`, `sequences`, `acknowledge`,
    `instantAckGracePeriod`, `sendRetry`, `automationStatus`) — every one of those files currently passes
    *because* of the fixture shapes listed in F15, so expect the fixed fixtures to go red before the code does.
