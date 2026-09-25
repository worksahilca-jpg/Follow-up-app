# Daily-path bug hunt: Gmail, crons, approvals, disconnected accounts (2026-09-25)

> **Summary**
> 1. **F1 (HIGH).** "Send all routine" writes no per-lead audit event, so every lead it sends stays in the approval queue. The next press re-sends the same drafts. "Press again to send the next batch" re-sends the top 250 and never reaches the rest. A lead the owner answered from the Gmail app also stays in the queue, so the pile can send them an AI reply as well.
> 2. **F2 (HIGH).** When a lead writes again, `scoring.ts` writes a new draft but keeps the old draft's risk verdict. An unchecked draft can then sit in the "routine" pile. On any account with sending on, the hourly automation reuses that verdict and auto-sends the draft without the risk check or the invented-price check.
> 3. **F3 + F4 (HIGH).** Every email sent through Approve & send (and every automated follow-up) starts a new Gmail thread with an AI-written subject. Separately, the Gmail sync decides which messages are "mine" by the owner's login email, not the connected inbox. If those differ, the owner's replies are stored as the lead's messages, and threads the owner started become a lead that is the business itself.
> 4. **Disconnected accounts (F5).** The daily `ai.hold` rows after the 09-07 disconnect are the case in `sendChannels.ts`'s header. They stopped at #274 (2026-09-19) only because that business has nothing else connected. The check is still per business, not per lead. So once Gmail dies, any business that still has Instagram connected keeps drafting and holding email leads every 20 hours. A workflow's email step on a sending-enabled account is re-drafted and re-notified every hour. Nothing can actually send.
> 5. **Token death (F6).** Within 10 minutes the connection is parked as `needs_reconnect`. The owner is told by one line on Today, below everything else, and nowhere else: no notification, and Settings shows the "never connected" copy. The booking page silently stops excluding their calendar. Toronto is unaffected by the New York default (F10).

**Branch/commit read:** `claude/followup-demo-to-production-4k39hr` at `7a58066`. The working tree is identical to HEAD except `next-env.d.ts` and an untracked `src/app/preview-bughunt/` from another session. **Report only.** No source was changed, nothing was run against production, no `.env` was opened.
**Grades:** **CONFIRMED** means I traced it end to end in the code. **PLAUSIBLE** means the mechanism is in the code but whether it fires depends on timing or live state. Each finding has a read-only query in §Verification.
**Not repeated:**
- Everything in `2026-09-24-app-review-path-audit.md` (Instagram id, poller echo, App Review pre-flight).
- `2026-09-16-bug-hunt-automation-and-send-engine.md` F9 (the automation claim's `WHERE` doesn't re-check tier/sequence) and F10 (sequence exits leave the lead OFF). Both are still open at `automation.ts:550-556` and `sequences.ts:549`.
- Backlog B-002 and B-006.

---

## Ranking

| # | Finding | Severity | Grade |
|---|---|---|---|
| F1 | Bulk "Send routine" never takes a lead out of the queue, so presses repeat sends. Owner replies from Gmail don't clear holds either | HIGH | CONFIRMED |
| F2 | A new draft inherits the old draft's risk verdict, so unchecked drafts ship as "routine" or are auto-sent | HIGH | CONFIRMED |
| F3 | Approve & send (and every automated follow-up) email starts a new thread with an AI subject | HIGH | CONFIRMED |
| F4 | Gmail "self" is the login email, not the connected inbox: owner replies read as the lead's, and the business becomes a lead | HIGH when triggered | CONFIRMED (trigger PLAUSIBLE) |
| F5 | Why disconnected accounts were drafted, and what still leaks after #274 | MEDIUM | CONFIRMED |
| F6 | Token-death day: one low-priority line on Today, nothing else. Non-auth sync failures are fully silent. Calendar busy-time protection vanishes | MEDIUM | CONFIRMED |
| F7 | Today's Approve & send and the lead page's Send now: same server guarantees, different undo. Neither refuses a draft the lead has since answered | MEDIUM | CONFIRMED |
| F8 | The same inbox can be connected to two businesses, and the second one's mail is written into the first one's lead | LOW-MEDIUM | CONFIRMED |
| F9 | A push sync and a cron sync racing on a new thread can lose the lead's first reply or its hold | LOW | PLAUSIBLE |
| F10 | Time zones: Toronto is fine; the activity page's "Today"/"Yesterday" use server UTC; owners west of Eastern are shifted | LOW | CONFIRMED |
| F11 | The weekly digest has no idempotency guard, and Vercel can deliver a cron twice | LOW | CONFIRMED (delivery behaviour per Vercel docs) |
| F12 | Gmail status and `hasAnySendChannel` decrypt real tokens just to answer yes/no questions | LOW | CONFIRMED |

---

## F1 — HIGH — The routine pile never empties, so each press re-sends what it already sent

**Where**
- `src/lib/pendingApprovals.ts:102-109`: queue membership is "the lead's newest lead-targeted AuditEvent is `ai.hold`". Nothing else takes a lead out.
- `src/lib/bulkApprove.ts:101-109`: `sendFollowUpToLead(..., { trigger: "manual" })` is called with no `automated` flag. So `sending.ts:873` writes no `ai.send`, and bulk writes no `lead.send`.
- `src/app/api/approvals/send-safe/route.ts:60-67`: the only audit row is `approvals.send_safe`, with no `targetType` or `targetId`.
- `src/components/SafePileAction.tsx:76-79` says "the sent ones have dropped out of it" and calls `router.refresh()`. They haven't dropped out.
- `src/lib/sendClaim.ts:66`: the only duplicate guard is `SEND_CLAIM_WINDOW_MS = 60_000` on an identical body.

**Scenario A (repeat press).** A holding account (the default) has 12 routine Gmail drafts.
1. The owner presses "Send all 12". Twelve emails go out and the card shows "Sent 12."
2. After `router.refresh()`, the server re-derives the queue. All 12 leads still have `ai.hold` as their newest lead-targeted event, the same `suggestedMessage` and a `"low"` verdict, so the "12 routine drafts" row is still there.
3. The owner reloads Today later and sees "Send all 12" again. Pressing it sends all 12 again, identical bodies, more than 60 seconds later.
4. After 24 hours, `staleApprovals.ts` also starts telling the owner these leads are "still waiting for your approval".

**Scenario B ("send the next batch").** With more than 250 safe drafts (`DAILY_AUTOMATED_SEND_CAP`, `sendCaps.ts:93`):
- Press one sends the top 250 by score and reports "N still to go — press again".
- Press two re-derives the same list, sorts by score again and re-sends the same top 250. The remaining N are never reached.
- The route's rate limit (5 presses per 10 minutes) is the only bound, and manual sends don't count toward the daily cap.

**Scenario C (the owner already answered).** Jane is in the routine pile. The owner replies to Jane from the Gmail app on their phone.
1. `gmail.ts:735-746` stores that reply as an outbound Message, but no audit event is written, so Jane stays queued.
2. The card still shows "Jane said: …" (the newest *inbound* message, `pendingApprovals.ts:130,145-149`), which suggests she's unanswered.
3. The next "Send all routine" sends Jane FollowUp's draft on top of the owner's personal reply. If scoring re-drafted after syncing the owner's reply, the draft is a nudge written minutes after the owner spoke.

The same gap exists on the single-card path, more narrowly. Its only exit is `void recordAudit(ctx, "lead.send")` (`leads/[id]/send/route.ts:46`). That is fire-and-forget after the response is built, and a lost write leaves the lead queued. This part is PLAUSIBLE; see §Verification.

**Why the tests pass.** `bulkApprove.test.ts` mocks `getPendingApprovals` and only asserts what gets sent. No test asserts that a sent lead leaves the queue. `pendingApprovals.test.ts` covers `lead.send` / `ai.send` / `ai.hold_dismissed`, the three events the bulk path never writes.

**Smallest fix (one file):** in `getPendingApprovals`, drop a held lead when any outbound Message on it has `sentAt > heldAt`. That one read covers bulk sends, native replies from Gmail/Outlook/the Instagram app, and a lost `lead.send` write. Also, in `bulkApprove.ts`, `await recordAudit(..., "lead.send", { targetType: "lead", targetId })` per sent lead, so the trail names each recipient.

**Test:** a lead with `ai.hold` at T and an outbound Message at T+1 is not returned. Then `sendSafeApprovals` twice in a row sends each lead once. Use a stateful prisma mock, as `instantAckGracePeriod.test.ts:52-72` does.

---

## F2 — HIGH — A new draft keeps the old draft's risk verdict, so unchecked text is sent as routine or unreviewed

**Where**
- `src/lib/scoring.ts:173-209`: runs on every synced inbound. It writes `suggestedMessage`, `suggestedSubject` and `suggestedDraftedFor`, and leaves `suggestedRiskLevel` / `suggestedRiskReason` as they were.
- The same omission exists in `src/app/api/leads/[id]/regenerate/route.ts:107-119` and `src/lib/sequences.ts:715-724`.
- `src/lib/automation.ts:712-715` (`draftIsCurrent`), `:760` (no rebuild when current), `:787` (`ungroundedSpecifics` only runs on a rebuild), and `:968-977`, which reuses the stored verdict whenever the draft wasn't rebuilt.
- `src/lib/approvalGroups.ts:81-87`: "safe" means held-only-by-setting *and* `draftRiskLevel === "low"`.
- The code's own contract, `automation.ts:1061-1064`: "A verdict stored against a different draft would be worse than none."

**Scenario (sending on, e.g. the account lifted the hold; ASSISTED lead).**
1. Monday 10:00: Jane emails. Scoring writes draft D1.
2. 13:00: the automation's 3-hour check buys a verdict on D1 (`"low"`), stores it and sends D1.
3. Tuesday 09:00: Jane writes "Can you do it for $2,000 and start Monday?". The sync calls `scoreAndDraftForLead`, which writes D2 answering the price and date. `suggestedRiskLevel` is still `"low"` from D1.
4. Wednesday 09:00: the unanswered rule fires (24 hours after her message). `draftIsCurrent` is true because D2's stamp equals her message, so D2 isn't rebuilt. That means no `ungroundedSpecifics` check, and `:968` reuses `"low"`.
5. D2 is auto-sent. It has never been risk-checked and never grounding-checked, which is exactly the "El costo será de $100" class (`automation.ts:784-786`).

**Scenario (holding account).**
1. An earlier pass held D1 with verdict `"low"` and reason `HOLD_ALL_AUTOMATION_REASON`.
2. Jane writes again, so scoring writes D2. The `ai.hold` event is unchanged, so the card sits in "routine".
3. "Send all routine" sends D2 unread.
4. The Regenerate button does the same: the owner regenerates on the lead page, and the new draft shows up in the routine pile under the old verdict.

**Why the tests pass.** `automation.test.ts:1473-1487` ("never re-buys a verdict for a draft that has not changed") seeds a draft and verdict that belong together. No fixture replaces the draft after the verdict was stored.

**Smallest fix:** every writer of `suggestedMessage` also writes `suggestedRiskLevel: null, suggestedRiskReason: null`. That is `scoring.ts:173`, `regenerate/route.ts:107` and `sequences.ts:715`. The next automation pass then buys a verdict for the new text, and null is already "not safe" for the pile. `ungroundedSpecifics` should run on the scoring draft too, or run in `:968`'s reuse branch when the verdict is null.

**Test:** a lead with `suggestedRiskLevel: "low"` that goes through `scoreAndDraftForLead` ends with `suggestedRiskLevel` null. Then `runAutomationForBusiness` on that lead calls `assessSendRisk`.

---

## F3 — HIGH — Every Approve & send email (and every automated follow-up) starts a new Gmail thread

**Where**
- `src/app/api/leads/[id]/send/route.ts:44` passes only `{ trigger, subject, humanSend }`.
- `src/lib/sending.ts:601-607` passes `threadId: options.emailThreadId, inReplyTo: options.emailInReplyTo`, both undefined for this route. The subject falls back to the AI draft's subject (`ApprovalQueue.tsx:85-87`) or to `Following up on your inquiry, <First>` (`:603`).
- The same holds for `automation.ts:1186`, `sequences.ts:745` and `bulkApprove.ts:102`.
- Only the instant ack threads (`acknowledge.ts:585-608`), and on a holding account the instant ack is exactly what gets held (`acknowledge.ts:529`) and then sent through the route above.
- The stored `Message.externalId` is Gmail's API id (`gmail.ts:744`), not the RFC `Message-ID`, so the funnel couldn't build `In-Reply-To` even if it tried.

**Why it breaks.** Gmail puts a sent message in an existing thread only when three things hold: the `threadId` is given, `In-Reply-To`/`References` follow RFC 2822, and the Subject matches (Google, "Manage threads", search snippet, checked 2026-09-25). None of the three is met.

**Scenario.**
1. Jane emails "Kitchen reno quote?". On the default holding account, her first reply is held.
2. The owner taps Approve & send.
3. Jane receives a separate email titled, for example, "Quick question about your kitchen project", with no quoted history and not threaded under her message.
4. The owner's Gmail shows it as a separate conversation. FollowUp's own thread view files it under her original conversation (`conversations.ts:36-40`), which hides the break from the owner.
5. When Jane replies to the new thread, the sync creates a second Conversation.

Of the 16 real messages sent so far, every one that went through Approvals or the automation took this path. You can check this in the founder's Gmail Sent folder; the database cannot show it.

**Smallest fix (in `sending.ts`, Gmail branch).** When `emailThreadId` isn't given:
1. Take the lead's newest `email` Conversation with a thread id (`Conversation.externalId`) and its newest inbound `Message.externalId`.
2. Call `gmail.users.messages.get({ format: "metadata", metadataHeaders: ["Message-ID", "Subject"] })`. This needs a small helper in `gmail.ts`.
3. Send with that `threadId`, `In-Reply-To`/`References` set to the Message-ID, and `Subject: Re: <original>`.

The composer and card should then default to that subject instead of the AI one. An owner who deliberately types a new subject breaks threading under Gmail's own rule, which is a product call. Outlook has the same gap (`replyToMessageId` unset) and the same fix shape.

**Test:** `sendFollowUpToLead(lead, body, { trigger: "manual" })` on a lead with a Gmail conversation calls `sendEmail` with `threadId` = the conversation's `externalId` and a non-empty `inReplyTo`.

---

## F4 — HIGH when triggered — The Gmail sync identifies "me" by the owner's login email, not the connected inbox

**Where**
- `src/lib/integrations/gmail.ts:827` (`selfEmail = integration.user.email`). The same is true at `:878` (import) and `:912` (spam scan).
- `:547` (`direction = from.email === selfEmail ? "outbound" : "inbound"`) and `:557-559` (counterpart = first sender who isn't `selfEmail`).
- `:973` (`From: ${integration.user.email}`).
- The connect flow lets the owner pick any Google account: `startGmailOAuth` sends no `login_hint` (`:157-166`), and `exchangeCodeForTokens` stores the real inbox as `accountEmail` (`:204`). Outlook already does this right: `outlook.ts:596,649` use `accountEmail ?? user.email`.

**Scenario.** Sam signs in to FollowUp with `sam.smith@gmail.com` and connects the shop inbox `info@samsplumbing.ca`, a normal setup for a trade business with a Workspace inbox.
- Jane writes to info@, and Sam replies from info@ on his phone. The sync stores Sam's reply as **inbound**. The unanswered rule then treats Jane as ignored (`automation.ts:333-334`). It drafts a reply to Sam's own words and tells him "Jane wrote … and never got an answer". The instant ack's `hasHumanReply` is false, so she is acknowledged even though Sam already answered.
- Every thread Sam *started* from info@ (to suppliers, or quotes sent first) has info@ as its first non-"self" sender. That creates or feeds a lead whose email is the business's own address, which is then scored, drafted and queued.

**Grade.** CONFIRMED in code. How often the login and inbox differ in production is unknown; see Q4. The send side is probably harmless: Gmail typically replaces a `From` that isn't a verified alias with the authenticated address (not verified live).

**Smallest fix:** `const selfEmail = (integration.accountEmail ?? integration.user.email).toLowerCase()` at the three read sites, and use the same value in `sendEmail`'s `From`. Clean up any self-lead that Q4 finds.

**Test:** an integration with `user.email = a@x`, `accountEmail = b@y`, and a thread from `b@y` then `lead@z`. Expect the lead to be `lead@z` and `b@y`'s message to be `outbound`.

---

## F5 — MEDIUM — Why disconnected accounts kept drafting, and what still does

**The production case (business `cmtqfyyhv0000ld046twam6g4`, Gmail disconnected 2026-09-07 21:57).** This is the account described in `src/lib/sendChannels.ts:6-11`: 12 days and 97 holds. It is the same account, because 09-07 plus 12 days is 09-19.
- Before `2644398` (#274, 2026-09-19 11:55 −04:00), `runAutomationForBusiness` checked only the `Automation` row and billing.
- A held lead never moves `lastContacted`, so it becomes eligible again at every pass after `recheckCutoff` (20 hours, `automation.ts:412`). It is then re-drafted or re-held, and gets a fresh `ai.hold` (`:1172`) plus a hold notification.
- That 20–24 hour cycle is the "daily" `ai.hold` pattern.
- Nothing could have *sent*. `sendEmail` finds no `connected` integration (`gmail.ts:113-118,962`), so every attempt fails with "No Gmail account is connected".
- The weekly digest (`weekly-digest/route.ts:25`) and reactivation classifier (`reactivation/route.ts:67-77`) both require a connected inbox.
- `runReactivationSend` has no caller anywhere in `src/`.

**What #274 left open (CONFIRMED).** `hasAnySendChannel` (`sendChannels.ts:24-53`) asks "is *anything* connected", and only checks that a credential is non-null (an expired Instagram token counts). So:

1. **Gmail dead, Instagram (or Messenger, WhatsApp, Twilio creds) still stored.** This will be every App Review or beta tester on day 7; see F6.
   - The automation keeps treating email leads as eligible: `detectAutomatedReplyChannel` → `email`, then held on a holding account.
   - Result: an `ai.hold` and a "written and waiting" notification every ~20 hours per email lead. The approval card then fails with "No Gmail account is connected for this business."
   - With sending on, the send fails as `permanent` and the lead is marked `skipped` silently, for 20 hours at a time, indefinitely.
2. **Workflows are worse on sending-enabled accounts.** A failed email step stays on the same step (`sequences.ts:759-772`). The 5-minute claim lock expires, so **every hourly tick in the send window** re-drafts (`generateFollowUpMessage` and `assessSendRisk` are not cached here) and writes a "couldn't send" notification. That is up to 10 draft-plus-risk rounds (at least two OpenAI calls each) and 10 notifications per enrolled lead per day.
3. **A form lead on a business with no inbox** still gets a first-reply hold (`acknowledge.ts:529-539`) for an email that can't go out. This is small.

Also note: an old queue entry on a now-disconnected account stays in Today until the 500-event scan window drops it (`pendingApprovals.ts:24`).

**Smallest fix:** a per-lead channel check before drafting.
- In `automation.ts`, right after `sendChannel` is resolved (`:731`): if it is `email` and neither Gmail nor Outlook is `connected`, skip with an owner-facing `aiPausedReason` such as "Reconnect your inbox to answer this lead" and keep the claim. Do the same for `instagram`/`messenger` against their tokens.
- In `sequences.ts:620`, the same check should pause the enrollment rather than retry hourly.
- One helper, `canSendOn(businessId, channel)`, next to `hasAnySendChannel`.

---

## F6 — MEDIUM — The day a Gmail token dies: one line on Today, nothing else

**Context.** In Testing mode, Google expires refresh tokens after 7 days for External apps (Google, "Using OAuth 2.0…", search snippet, checked 2026-09-25). `gmail.readonly` is Restricted, so Testing is the state for the foreseeable future (`research/integrations/2026-09-06-gmail-oauth-verification.md`).

**What happens (CONFIRMED)**
1. The next `gmail-sync` tick (≤10 minutes) runs `scoreUnscoredLeads` first (`gmailSync.ts:73`; OpenAI spend on a dead account, once). Then `threads.list` throws `invalid_grant`. The catch parks the integration as `needs_reconnect`, clears the tokens and the watch (`gmailSync.ts:195-215`), and push lookups stop matching (`gmail.ts:330`). This part is right.
2. **Where the owner is told.**
   - Accounts with **no leads**: the empty-state box (`dashboard/page.tsx:191,235`).
   - Accounts **with leads** (everyone past day 1): only `SetupStrip` (`dashboard/page.tsx:377`). It renders under the stat tiles and the "About to be lost" list, and shows only `steps[0]` (`SetupStrip.tsx:22`). The reconnect step comes after "Start your free trial" and "Tell FollowUp about your business" (`setupStatus.ts:98-161`), so on those accounts it appears only as "· 1 more setup step after this".
   - There is no Notification row (the bell) and no email. The dead Gmail is the only mailer, and the digest query requires `connected`.
   - **Settings** reads only `connected/email/pushActive` (`settings/page.tsx:248-252`) and shows "Required — FollowUp reads sales conversations…", the never-connected copy.
3. **Meanwhile:**
   - Every email draft in Approvals fails with "No Gmail account is connected for this business." (`gmail.ts:962`), which is wrong about the cause and gives no fix.
   - "Sync now", in the ≤10 minutes before parking, returns a raw "invalid_grant".
   - **Bookings.** `createCalendarEvent` and `getGoogleCalendarBusyTimes` return nothing once the integration isn't `connected` (`gmail.ts:349-350,398-399`). For a business on `bookingCalendarSource: "google"`, the booking page (`booking.ts:104-105`) silently falls back to the fixed grid. Leads can then book over the owner's real meetings, and confirmed bookings no longer reach their calendar. Nobody is told.
4. **Failures that aren't `invalid_grant` are fully silent.**
   - With granular consent, a user can untick scopes on the consent screen, and Google says apps must check what was granted (Google, "How to handle granular permissions", search snippet, 2026-09-25).
   - `exchangeCodeForTokens` never inspects `tokens.scope` (`gmail.ts:175-218`). An owner who unticks "Read" is stored as `connected`, and every sync then 403s.
   - `lastSyncError` is written (`gmailSync.ts:200`) but read by no UI (grep: only CRM surfaces its own).
   - On an account with leads, nothing shows sync health at all: Settings keeps saying "Connected as … — new emails are picked up within 10 minutes".

**Smallest fix**
1. In the `revoked` branch at `gmailSync.ts:195`, write one Notification per admin: "FollowUp lost access to <inbox> — reconnect to keep catching leads" (Google's 7-day beta limit named).
2. When `gmail.needsReconnect`, promote the reconnect step above `business` in `getIncompleteSetupSteps`.
3. Handle `needsReconnect` in Settings' Gmail row.
4. In `exchangeCodeForTokens`, refuse (or mark `needs_reconnect`) when `tokens.scope` lacks `gmail.readonly` or `gmail.send`.
5. Have `sendEmail`'s no-integration message name the reconnect.

---

## F7 — MEDIUM — Today and the lead page send identically, except for the undo; neither refuses a draft the lead has since answered

**Confirmed from the UX report (`research/product/2026-09-24-simplify-the-app.md`).**
- Today's card wraps the POST in `useUndoableSend` (`ApprovalQueue.tsx:83-97`, 10 s, `undoWindow.ts:33`).
- The lead page's `MessageComposer.send()` POSTs immediately (`MessageComposer.tsx:55-78`), with nothing between the tap and the send.

**Same guarantees (checked).** Both hit `POST /api/leads/[id]/send`. That route checks the session, rate limit, billing and ownership (`route.ts:24-33`). Both then go through the single funnel in `sendFollowUpToLead`: opt-out, DM suppression, Meta window with `humanSend`, and the 60-second identical-body claim. Neither checks a hold, which is right for a human send. On business scoping, both paths are clean.

**The guarantee neither path has: stop on reply.** The card posts `item.draftMessage`, captured when the page rendered (`pendingApprovals.ts:162`). Neither the route nor the funnel compares it against the conversation now. Example:
1. The owner opens Today at 09:00.
2. At 09:20 Jane writes "Never mind, we went with someone else." The sync stores it, and scoring re-drafts on the server.
3. At 09:40 the owner taps Approve & send on the still-open card, which sends the 09:00 draft ("Happy to get you that quote…").

The lead page has the same gap. The thread is under the composer there, but it is equally stale until reload. The bulk path (F1) re-derives the draft on the server, but it sends the re-draft unread (F2).

**Smallest fix**
- Wrap `MessageComposer.send` in `useUndoableSend`. It already supports a url/body pair.
- Have the card post `draftedFor` (`Lead.suggestedDraftedFor`). The route returns 409 "Jane wrote again at 09:20 — read it first" when an inbound Message on the lead is newer.

---

## F8 — LOW-MEDIUM — One inbox connected to two businesses: the second business's mail goes into the first business's lead

**Where.**
- Nothing stops the same Google inbox being connected under two businesses: `exchangeCodeForTokens` keys only on `(userId, provider)` (`gmail.ts:188-215`). Instagram has the equivalent guard (#322).
- `Conversation.externalId` (the Gmail thread id) is globally `@unique` (`schema.prisma:858`), and the sync looks it up with no tenant scope (`gmail.ts:567-570,726-733`).
- `Message.externalId` upserts are `update: {}` (`:736-746`).

**Scenario.** The founder's business and a test or review business both connect the same inbox. Business B's sync then:
- finds A's Conversation for every thread A already imported;
- marks those threads as already known, so it skips the classifier;
- creates or updates B's own Lead but attaches no conversation to it;
- writes any **new** messages into **A's** conversation, under A's lead.

B's leads have no messages, so they are drafted as "untouched" from the name alone. The push route picks one business at random (`findFirst`, `gmail.ts:327-335`). There is no confidentiality breach, because both tenants hold the inbox. This is an integrity and correctness failure.

**Smallest fix:** in `exchangeCodeForTokens`, refuse when another business has a `connected` Gmail integration with the same `accountEmail`, with the same wording as #322.

---

## F9 — LOW (PLAUSIBLE) — A push sync and a cron sync can race on a brand-new thread and lose its first reply

**Where.** The push lock (`gmailSync.ts:237-246`) only excludes other push syncs; the cron path takes no lock. `gmail.ts:726-733` looks up the conversation and then creates it, with no P2002 handling (compare `conversations.ts:42-52`).

**Scenario.** A new lead's email arrives just as the 10-minute tick runs.
1. Both syncs classify the thread.
2. Sync A wins `lead.create` (`isNewLead = true`). Sync B hits P2002 and continues as an existing lead.
3. Both find no conversation and both create one. A's create throws.
4. `processThreadRefs` swallows the error per thread (`:514-521`), so A never reaches `acknowledgeNewLead` (`:760-772`). B has `isNewLead = false` and doesn't call it either.
5. The lead gets no instant reply. On a holding account it also gets no first-reply `ai.hold`, so it isn't in Approvals until the 3-hour unanswered pass.

The window is the gap between one read and one insert, so this is rare.

**Fix:** catch P2002 on `conversation.create` and re-read, as `findOrCreateConversation` does.

---

## F10 — LOW — Time zones

- **Toronto: nothing breaks.** `Business.timezone` defaults to `America/New_York` (`schema.prisma:55`) and nothing ever writes it (no route or onboarding step sets it). `America/Toronto` and `America/New_York` use identical offsets and DST rules, so the send window (`sendWindow.ts:20`), the greeting and the booking hours are all correct for the GTA ICP.
- **What a Toronto owner does see.** The activity page is a server component, and its `dayKey` uses the server's local time, which is UTC (`activity/page.tsx:59-66`). From 20:00 to 23:59 EDT (19:00–23:59 EST), events are filed under the wrong day. At 22:00, a 19:00 event reads "Yesterday", and the next morning a 21:00 event reads "Today". The date labels are UTC dates too. The analytics and admin week buckets (`analytics-data.ts:92`, `admin-data.ts:134`) start on Sunday 00:00 UTC, which is Saturday 20:00 EDT.
- **West of Eastern (Vancouver, Calgary):** polite hours become 05:00–14:59 local, and booking slots are offered three hours early. This is out of the ICP today, but there is no way to fix it without a timezone field.

**Fix:** pass `timeZone: business.timezone` into `dayKey`/`toLocaleDateString`. Later, capture the timezone at onboarding from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`).

---

## F11 — LOW — The weekly digest has no idempotency guard

`weekly-digest/route.ts:37-73` sends every Monday with no "already sent this week" record. Vercel's cron documentation says delivery can occasionally invoke the same scheduled run more than once, and asks for idempotent jobs (search snippet; `vercel.com` is egress-blocked, checked 2026-09-25). A duplicate run means every admin gets two digests. Every other cron that sends is claim-protected: automation (`lastAutomationCheckedAt`), sequences (`sequenceStepDueAt`), instant-ack (`ackDueAt` lease) and outbound-retry (`claimNextDueSend`).

**Fix:** an atomic claim column `Business.digestSentFor = <ISO week>` via `updateMany where digestSentFor != thisWeek`.

---

## F12 — LOW — Real credentials are decrypted just to answer yes/no questions

- `getGmailIntegration` (`gmail.ts:113-118`) loads the whole Integration row, so `db.ts` decrypts the refresh and access tokens. It is used by `getGmailStatus`, which runs on every dashboard load (`dashboard/page.tsx:103`), `setupStatus.ts:80`, every email send (`sending.ts:82`) and `booking-source`.
- `hasAnySendChannel` (`sendChannels.ts:28-39`) selects four encrypted Business tokens to test for non-null. It runs twice per business per hour (automation and sequences) and on lead pages via `automationStatus.ts:78`.

`facebook/config` and `whatsapp/config` already answer the same question from the id columns.

**Fix:**
- For status reads, use `select: { accountEmail: true, watchExpiration: true, lastSyncedAt: true, user: { select: { email: true } } }`.
- In `hasAnySendChannel`, test `instagramUserId` / `facebookPageId` / `whatsappPhoneNumberId` / `twilioAccountSid`, which are written and cleared together with their tokens.

---

## Checked, clean

- **Cron auth:** every `/api/cron/*` route calls `requireCronSecret` except `office` (known L-1). The Gmail push secret compare is timing-safe (`push/route.ts:13-17`).
- **Per-business isolation:** each business runs in its own `try/catch` in the automation, sequences, gmail-sync, reactivation, weekly-digest and stale-approval crons. The automation route fails each path independently (`cron/automation/route.ts:63-66`).
- **No overlapping runs of the same cron:** every `maxDuration` is shorter than its interval.
- **Claims:** automation, sequences, instant-ack, outbound-retry and the send claim are atomic `updateMany`/unique-index claims.
- **Fixed since 09-16:**
  - 09-16 F1 (queued sequence step re-sent) is fixed (`sequences.ts:759`).
  - 09-16 F2 (the ack hid the lead from the 3-hour rescue) is fixed (`automation.ts:330-334`).
- **`invalid_grant` handling:** it is classified correctly (`gmail.ts:80-88`, tested). Tokens are nulled on revoke, and reconnect resumes: `lastSyncedAt` is kept and a deep pass is due because `deepSyncedAt` is stale.
- **Nothing can send for a disconnected inbox:** every email path goes through `sendEmail`, which requires `status: "connected"`.
- **Tenancy on routes changed since the 09-16 audit and not covered on 09-24:** all scoped to `ctx.businessId`, with admin gates where they write.
  - Routes: `access-request` (both; `notFound()` throws), `automation/send-preview`, `business/privacy`, `business/setup-step`, `leads/bulk-automation`, `leads/[id]/automation`, `leads/[id]/regenerate`, `facebook/config|oauth/select-page|subscribe`, `whatsapp/config|connect`, `team`.
  - `unsubscribe` is token-scoped. `regenerate` checks ownership after `findUnique`, before any write or spend.
  - The `GET`s don't select tokens.

---

## Verification (read-only; no message bodies or addresses printed)

```sql
-- Q1 (F1): leads still queued after something went out to them
WITH latest AS (
  SELECT DISTINCT ON ("targetId") "targetId", action, "createdAt"
  FROM "AuditEvent" WHERE "targetType" = 'lead' AND "targetId" IS NOT NULL
  ORDER BY "targetId", "createdAt" DESC)
SELECT l."businessId", count(*) AS queued_but_answered
FROM latest a JOIN "Lead" l ON l.id = a."targetId"
WHERE a.action = 'ai.hold' AND EXISTS (
  SELECT 1 FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId"
  WHERE c."leadId" = l.id AND m.direction = 'outbound' AND m."sentAt" > a."createdAt")
GROUP BY 1;

-- Q1b (F1): has the bulk pile been used, and has any lead received the same body twice?
SELECT count(*), sum((meta->>'sent')::int) FROM "AuditEvent" WHERE action = 'approvals.send_safe';
SELECT c."leadId", md5(m.body), count(*) FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId"
WHERE m.direction = 'outbound' GROUP BY 1, 2 HAVING count(*) > 1;

-- Q2 (F2): routine-looking drafts written after the hold that judged an earlier draft
WITH latest AS (
  SELECT DISTINCT ON ("targetId") "targetId", action, "createdAt"
  FROM "AuditEvent" WHERE "targetType" = 'lead' AND "targetId" IS NOT NULL
  ORDER BY "targetId", "createdAt" DESC)
SELECT count(*) FROM latest a JOIN "Lead" l ON l.id = a."targetId"
WHERE a.action = 'ai.hold' AND l."suggestedRiskLevel" = 'low' AND l."suggestedDraftedFor" > a."createdAt";

-- Q4 (F4): connected inboxes that differ from the owner's login (booleans only)
SELECT u."businessId", lower(coalesce(i."accountEmail", u.email)) <> lower(u.email) AS inbox_differs_from_login
FROM "Integration" i JOIN "User" u ON u.id = i."userId"
WHERE i.provider = 'gmail' AND i.status = 'connected';

-- Q5 (F5): did the tester's holds stop at #274, and what does hasAnySendChannel see?
SELECT date_trunc('day', "createdAt") AS day, meta->>'trigger' AS trigger, count(*)
FROM "AuditEvent" WHERE "businessId" = 'cmtqfyyhv0000ld046twam6g4' AND action = 'ai.hold'
GROUP BY 1, 2 ORDER BY 1;
SELECT "instagramUserId" IS NOT NULL AS ig, "facebookPageId" IS NOT NULL AS fb,
       "whatsappPhoneNumberId" IS NOT NULL AS wa,
       ("twilioAccountSid" IS NOT NULL AND ("twilioPhoneNumber" IS NOT NULL OR "whatsappPhoneNumber" IS NOT NULL)) AS twilio
FROM "Business" WHERE id = 'cmtqfyyhv0000ld046twam6g4';
SELECT i.provider, i.status FROM "Integration" i JOIN "User" u ON u.id = i."userId"
WHERE u."businessId" = 'cmtqfyyhv0000ld046twam6g4';

-- Q6 (F6/F8): parked or failing inboxes, and inboxes connected to more than one business
SELECT status, ("lastSyncError" IS NOT NULL) AS has_error, count(*) FROM "Integration" WHERE provider = 'gmail' GROUP BY 1, 2;
SELECT md5(lower(i."accountEmail")) AS inbox, count(DISTINCT u."businessId")
FROM "Integration" i JOIN "User" u ON u.id = i."userId"
WHERE i.provider = 'gmail' AND i.status = 'connected' AND i."accountEmail" IS NOT NULL
GROUP BY 1 HAVING count(DISTINCT u."businessId") > 1;
```

**Reading Q5.** Rows after 2026-09-19 16:00 UTC mean something is still connected (F5 point 1). No rows after that confirm #274 closed this business's case.

**F3 has no query.** It can't be seen in the database, because `findOrCreateConversation` files the sent message under the lead's original conversation. Open any Approve & send email in the founder's Gmail Sent folder and check whether it is in the lead's thread.

---

## Handover (backend-ai-agent), in order

1. **F1:** in `getPendingApprovals`, drop a lead that has an outbound message after `heldAt`; `lead.send` per recipient in `bulkApprove.ts`. Add a stateful test that pressing twice sends once.
2. **F2:** null `suggestedRiskLevel`/`suggestedRiskReason` in the three draft writers. Add a test that the verdict is re-bought after a re-score.
3. **F4:** use `accountEmail ?? user.email` at `gmail.ts:827,878,912,973`. Clean up per Q4.
4. **F3:** add reply headers and `threadId` in the Gmail branch of `sendFollowUpToLead`, with a metadata `messages.get` helper.
5. **F6 + F5:** reconnect notification, setup-step order, Settings state, scope check at connect; a per-lead `canSendOn` before drafting in `automation.ts:731` and `sequences.ts:620`.
6. **F7:** undo on `MessageComposer`, and a 409 on a stale draft in the send route.
7. **F8–F12:** small, independent.

Each of steps 1–2 touches trust-guarantee logic: re-run `pendingApprovals`, `bulkApprove`, `automation`, `sequences`, `acknowledge` and `approvalGroups` after each.

---

**Sources** (web sources checked 2026-09-25, all search-snippet sourced: `developers.google.com` and `vercel.com` are egress-blocked from this sandbox, per `research/README.md` and confirmed by a direct fetch of vercel.com returning EGRESS_BLOCKED):
- Gmail threading requirements: [Manage threads, Gmail API](https://developers.google.com/workspace/gmail/api/guides/threads)
- 7-day refresh-token expiry in Testing: [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2), corroborated by [DEV: Google's OAuth "Testing" mode expires refresh tokens in 7 days](https://dev.to/ko-hi/googles-oauth-testing-mode-expires-refresh-tokens-in-7-days-publish-the-consent-screen-before-24hm)
- Granular consent: [How to handle granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions)
- Duplicate cron delivery: [Managing Cron Jobs, Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- Internal: the files and commits cited inline, notably `2644398` (#274) and `9d49c8e` (#313).
