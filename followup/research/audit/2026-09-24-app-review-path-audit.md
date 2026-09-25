# App Review path audit: Instagram connect, inbound, approve and send (2026-09-24)

> **Summary (the top three findings, and whether any blocks recording tonight)**
> 1. **F1.** FollowUp stores the app-scoped `/me` `id` (2869…) as `instagramUserId`, but webhooks, and almost certainly message participants too, identify the account by its professional id (1784…). A real webhook can therefore never route to a business, and the poller's "is this our own message?" test compares against the wrong number.
> 2. **F2.** The poller re-reads every Instagram message FollowUp sends within about 3 minutes and does not recognise it as FollowUp's own. It turns into one of two things: a phantom lead that is the business itself, with an AI draft in "Needs your OK", or a duplicate row labelled "Sent directly on Instagram — not through FollowUp".
> 3. **F3.** A new DM gets into "Needs your OK" only through the instant-ack hold. That happens 2–5 minutes after the DM, and never at all (with no error) if the reviewer business is on Free, has instant-ack turned off, or has an Instagram source rule.
> 4. **Does any of this block recording?** No code change is needed before *recording*, provided the §Pre-flight queries pass and the Video B take cuts to the phone right after the send. F1 and F2 must be fixed before *submission*, because the reviewer's own test send reproduces F2 within minutes.
> 5. **F4.** This blocks Video A only if OAuth connect still fails. A 2-minute test (in F4) tells you whether it does.

**Scope:** the three screencast paths plus PRs #316–#322, read in code at `ec179f5`. **Nothing was run against production.** No `.env` was opened and no database was queried. Every live question is written up as a read-only query in §Pre-flight.
**Grades:** **CONFIRMED** means I traced it in code. **PLAUSIBLE** means it needs a live check.
Meta's own documentation is egress-blocked from this sandbox (`developers.facebook.com` returned EGRESS_BLOCKED on 2026-09-25), so any claim about Meta behaviour is labelled *documented*, *inferred* or *third-party*.

---

## F1 — HIGH — The stored Instagram id is the app-scoped id, and both webhook routing and the poller's own-message test key on it

**Grade:** CONFIRMED in code. The id semantics are *inferred*, corroborated by the live console and by three third-party reports.

### Where

- **Resolve:** `src/lib/instagram.ts:129` requests `/me?fields=id,username`, and `:145` stores `data.id`.
- **Written by:**
  - `src/app/api/instagram/config/route.ts:101` (paste a token)
  - `src/app/api/instagram/oauth/callback/route.ts:65` (OAuth)
- **Read by:**
  - `src/lib/inbound/meta.ts:248-252` (webhook routing, `where: { instagramUserId: entry.id }`)
  - `src/lib/instagramPoll.ts:124` (`isEcho = fromId === igUserId`)
  - the three Graph paths covered in (b) below

### Evidence

**Fact** (from the coordinator, read off the live Meta console, 2026-09-24/25):
- @followupbase is listed as `17841427527466039`.
- A token for @followupbase resolves through `/me` to `28693476873589439`, which is the founder's stored value.
- So `/me` `id` is not the account id Meta shows.

**Third-party, Grade C.** Three independent reports agree: the webhook `entry.id` carries the 1784… professional-account id, and `GET /me?fields=user_id` returns it while `id` is app-scoped. The id shapes match ours exactly.
- [kevinrivm/vocero-crm#60](https://github.com/kevinrivm/vocero-crm/issues/60) (2026-09-11):
  - `/me?fields=id` returns `28978671838402975`.
  - `/me?fields=user_id` returns `17841477965412210`, "lo que llega en `entry.id` de los webhooks".
  - Storing `id` made the webhook fail as an unknown account.
- [tarunvalluri3/ai-sales#66](https://github.com/tarunvalluri3/ai-sales/pull/66): stored `28747265801525964` against webhook `entry.id` `17841480477232867`.
- [saketh-valueskins/Valueskins#131](https://github.com/saketh-valueskins/Valueskins/pull/131): "/me returns app-scoped id + real professional user_id; callback now persists user_id (matching … webhook node id)".

### Failure A: a webhook is silently dropped

1. Meta posts a DM for @followupbase with `entry.id = "17841427527466039"`.
2. The envelope is stored (`webhook/route.ts:98`).
3. The lookup finds no business, so the loop hits `continue` (`meta.ts:252`).
4. The row is marked `processed` (`inboundEvents.ts:130`). No lead is created and there is no error anywhere.

Today this is masked twice over:
- The poller picks the DM up within about 3 minutes.
- Per the production evidence, Meta is not delivering real DM webhooks at all. Zero real envelopes have ever been stored, and a lookup miss would still have left a row.

**So fixing the id will not, by itself, make webhooks appear.** There is a separate cause on the delivery side. See "After the fix" below.

### Failure B: the poller files the business's own messages as a lead (the version that shows)

1. `toMessagingEvent` treats a message as the business's own only if `from.id === igUserId` (`instagramPoll.ts:124`).
2. If the Conversations API reports the business by its professional id (1784…, the same inference as above), then everything the account sends fails that test. That includes FollowUp's approved replies and the owner's own replies from the phone. Each one is rebuilt as an **inbound** DM from `17841427527466039` (`:137-142`).
3. `processMetaEnvelope` then creates a lead "@followupbase" with phone `ig:17841427527466039` (`meta.ts:285` → `instagram.ts:354-364`).
4. The ack is deferred. At the next instant-ack tick, holdAll writes `ai.hold` and a notification.
5. "Needs your OK" now shows a card for the business's own account, carrying a draft that replies to its own message.

On the reviewer account this appears 3–5 minutes after "Approve & send" in Video B. Two further effects:
- The owner's native replies no longer count as replies on the real lead.
- If a business has sending turned on, the ack is attempted to its own account. Meta will most likely refuse it (unverified).

**Grade:** PLAUSIBLE. Q1 settles it with one query.

### (b) Is the send path affected?

**Not broken today** (*inferred from production*). Three Graph paths use the app-scoped id and all of them work:
- **Send:** the 2026-09-19 19:12 acknowledgement to the first real lead went out through `/${instagramUserId}/messages` using the app-scoped id. That send is recorded in commit `3c533ce`; the path has been used since `594534d` on 2026-09-17.
- **Poller:** `/{id}/conversations` works.
- **Subscription:** the `subscribed_apps` POST (`instagram.ts:199`) succeeded. The console shows followupbase with "Webhook Subscription: On", and `instagramWebhookSubscribedAt` is set.

So Graph accepts the app-scoped id as an alias for the token's own account on those paths. Meta documents `/<IG_ID>/messages`. Relying on the alias is undocumented, not broken.

### (c) Smallest fix (no migration)

1. **Change the resolve call.**
   - `instagram.ts:129`: request `fields=user_id,username`, return `id: String(data.user_id ?? data.id)`, and also return `appScopedId: data.id`.
   - Deploy one line first: add `user_id` to the diagnostic fields at `instagram.ts:174`. Then `GET /api/instagram/diagnose` on the founder's account should show `id: 2869…` and `user_id: 17841427527466039`. That confirms the whole finding live before anything else changes.
2. **Backfill in the same deploy. This is not optional.**
   - For every Business that holds a token, call `GET /me?fields=user_id` and write the result to `instagramUserId`.
   - Why it has to ship with step 1: the `@unique` constraint only compares values in the same id space. Without the backfill, the same Instagram account could be connected to a second business (old row 2869…, new row 1784…). Both pollers would then ingest the same stranger's DMs, which is a **cross-tenant leak**.
   - Belt-and-braces: in both connect paths, refuse the save if *another* business holds either `user_id` or the app-scoped `id`.
3. **Echo test.** After steps 1 and 2, `instagramPoll.ts:124` compares like with like. Add `|| (username && from.username === business.instagramUsername)` as a cheap second signal.
4. **Clean up.** Delete any phantom lead that Q1 finds.

Optional stronger version: add a new `instagramAppScopedId @unique` column and make the lookup match either id.

### After the fix, verify

1. **Delivery.** Send one DM from @sahildoes to @followupbase and run Q3.
   - If no row with `entry_id = 17841427527466039` appears, delivery is still off on Meta's side.
   - Check "3. Configure webhooks" in the Instagram use case: the `messages` *field* must be subscribed. That is separate from the per-account toggle.
   - Check the access level: under Standard Access, events are delivered only for role-holders (`research/integrations/2026-09-10-meta-google-verification-playbook.md` §1.9, Grade B/C).
2. **Dedupe assumption.** Once both webhook and poller deliver, confirm that the webhook `mid` equals the Conversations API message `id`. The poller's dedupe assumes it (`instagramPoll.ts:20-22`) and nothing has verified it. If they differ, every DM is processed twice.

### Copy correction

App Review pack §3 says "we receive the message via webhook". Today every DM arrives by reading the account's conversations. Suggested wording: "via Meta's webhook and by reading the account's conversations".

---

## F2 — HIGH — FollowUp's own Instagram sends come back through the poller and are not recognised as its own

**Grade:** CONFIRMED for the mechanism. Which of the two artifacts appears is PLAUSIBLE.

This is `2026-09-16-bug-hunt-automation-and-send-engine.md` **F6**, which is still unfixed. The poller, added on 09-19, makes it deterministic. It no longer depends on Meta ever sending echo webhooks.

### Where

- `sendInstagramMessage` returns `{ success: true }` and throws away the Send API's `message_id` (`instagram.ts:319`).
- The Instagram branch sets no `externalId` (`sending.ts:611-613`), so the outbound Message is written without one (`:813-821`).
- The poller reads every message in any thread updated since the cursor, including FollowUp's own (`instagramPoll.ts:176-187`).

### Scenario

The reviewer presses Approve & send at T and the send succeeds. The next poll, at most 3 minutes later, re-reads that message. Two outcomes are possible:
- **If F1's inference holds:** the phantom self-lead and new card from F1.
- **If `from.id` does equal the stored id:**
  1. The message is treated as an echo.
  2. `captureDirectReply` upserts on `externalId = mid` (`instagram.ts:418-423`) and finds nothing, because FollowUp's row has no mid.
  3. A second outbound row is created with `source: "instagram_direct"`.
  4. The thread shows the reply twice. The second copy reads "Sent directly on Instagram — not through FollowUp (likely Meta's own AI or a teammate replying from the native app)" (`ConversationThread.tsx:92-96`).
  5. F6's downstream effects on reply-counting apply as well.

Either way, the reviewer sees FollowUp misdescribe the message they just approved.

### Smallest fix (F6's patch, unchanged)

1. Read `message_id` from the 200 body in `sendInstagramMessage`, and do the same in `sendMessengerMessage` (`facebook.ts:51`).
2. Return it and set `externalId` from it in `sending.ts:612-616`. The poller's echo then upserts onto FollowUp's row and does nothing.

**Unverified assumption:** that the Send API's `message_id` equals the Conversations API message `id`. Check it with one send, running Q1's second query afterwards. If they differ, add a fallback in `captureDirectReply`: stamp the mid onto an existing outbound row in that conversation with the same body, `source` null, `externalId` null, and `sentAt` within ±10 minutes, instead of creating a new row.

**Test:** "our own send, re-read by the poller, creates no Message and no Lead" (extend `instagramPoll.test.ts` and `captureDirectReply.test.ts`). That test exists as a mocked pair today, and its `from: { id: IG }` fixture is the assumption F1 questions.

### If this isn't fixed tonight

End Video B on the phone once "Sending to … in 10s" completes, and don't return to the dashboard or the lead in that take. This must be fixed before submission.

---

## F3 — HIGH (pre-flight) — A new DM reaches "Needs your OK" only through the instant-ack hold: 2–5 minutes later, and never in three configurations

**Grade:** CONFIRMED in code. The reviewer business's state is PLAUSIBLE until checked (see Q2).

### Mechanism

- **What the queue requires.** `getPendingApprovals` lists a lead only if its newest AuditEvent is `ai.hold` *and* it has a draft (`pendingApprovals.ts:109, 142`).
- **The only writer.** For a new DM, the only code that writes that `ai.hold` is `acknowledgeNewLead`'s holdAll branch (`acknowledge.ts:529-540`). Scoring writes none.
- **Timing.**
  1. On DM channels the ack is first parked for 2 minutes, measured from the DM's own timestamp (`acknowledge.ts:119, 431`).
  2. The hold is then written by `/api/cron/instant-ack`, which runs every minute.
  3. The DM itself arrives by the `*/3` poll (`vercel.json`).
  4. Expect **2–5 minutes**, not "seconds". The App Review pack's §3b says seconds because it assumes webhook delivery, which isn't happening.

### Scenarios that leave the queue empty with no error

- **Reviewer business on Free.**
  - Instagram isn't a Free source (`billing.ts:218, 378`), so there is no draft.
  - The hold *is* still written, because holdAll is checked before eligibility. But the card is skipped (`pendingApprovals.ts:142`).
  - This is exactly the 2026-09-19 failure (`3c533ce`).
  - Beta Pro is granted only to emails on the /admin tester list (`auth.ts:193, 282` → `grantBetaPlan`).
  - The pack's pre-flight checked `holdAllForApproval` and `autonomousAllowed` but not tier. `holdAllForApproval` is true by default anyway, so it doesn't prove beta.
- **Instant-ack switched off** for that business. The ack returns "switched off" (`acknowledge.ts:457`) before the hold is written, so nothing appears until the hourly automation reaches the lead.
- **An Instagram SourceRule** with a workflow or tier `OFF`. Either one sets the lead to `OFF`, and the ack returns early at `acknowledge.ts:418` without writing a hold.

### Fix

- **Tonight (no code):** run Q2. If it fails, add `followupbase.review@gmail.com` on /admin, which runs `grantBetaPlan`, or remove the rule.
- **Later:** have the held-draft path write its own `ai.hold`, so the queue stops depending on the ack subsystem. That is a behaviour change and belongs to `backend-ai-agent`.

---

## F4 — HIGH if OAuth still fails — The env contract doesn't explain the long-lived exchange refusal; the demo account's tester status is the prime suspect

**Grade:** PLAUSIBLE.

### What the code expects

| Variable | Should be | Where it is used |
|---|---|---|
| `INSTAGRAM_APP_ID` | The **Instagram** app ID (console: `1070892255325237`, "FollowUp-IG") | `client_id` in the authorize URL (`instagram.ts:486-495`) and in the short-lived exchange (`:532-541`) |
| `INSTAGRAM_APP_SECRET` | The **Instagram** app secret | `client_secret` in both exchanges (`:537, :615`) and one of the two webhook HMAC keys (`:90`) |

Neither is the Facebook app's pair (`2713853435677364`). `docs/meta-oauth-setup.md` §1 (lines 20-27 and 41-43) says the same.

### Why a wrong credential is unlikely to be the cause

`api.instagram.com` validates both `client_id` and `client_secret` in the short-lived exchange, and that step keeps succeeding (`instagram.ts:576-580`). The 09-19 wrong-secret incident failed at exactly that step (`docs/meta-oauth-setup.md:47-48`). A wrong pair would fail there first.

### Two documentation traps (fix both)

- `instagram.ts:26-27` names "App ID 2713853435677364", which is the **Facebook** app id.
- `docs/meta-oauth-setup.md:8-9` sends the reader to that comment "for the App ID".

### Hypothesis (inference)

The "brand-new demo account" from 09-23 isn't an accepted Instagram Tester. The console's account list shows only sahildoes and followupbase. Under Standard Access, `graph.instagram.com` may refuse the token outright, and that would read as "Unsupported request - method type: get/post" whichever HTTP method is used. The same string has been reported when `graph.instagram.com` didn't accept a token at all ([in2code-de/instagram#41](https://github.com/in2code-de/instagram/issues/41), Dec 2024). That is an analogy only.

### Two-minute test

1. Read the `client_id=` value in the address bar of the `instagram.com/oauth/authorize` page. It's a public value and must be `1070892255325237`.
2. From the **founder's** business, run Connect with Instagram as @followupbase.
   - If it completes, the exchange works for a listed tester, and the demo account's role is the cause. Add the demo account under App roles → Instagram Testers, accept the invite from that account, and retry.
   - The reconnect rewrites the founder's token and re-subscribes, which is harmless.
   - Don't run this test from the reviewer business: @followupbase is bound to the founder's business, so it would end in the "already connected" refusal.

If OAuth can't be made to work tonight, Video A (the consent screen) can't be recorded.

---

## F5 — MEDIUM — Meta-side preconditions for Videos B and C that code can't satisfy

**Grade:** PLAUSIBLE. The supporting research is Grade B/C.

- **Video B, "second phone".**
  - Under Standard Access, only accounts holding an app role can message the app and be messaged through it (`2026-09-10-meta-google-verification-playbook.md:306-324`).
  - A stranger's account may produce no data, and its Approve & send may be refused.
  - Use an accepted Instagram Tester and do one full dry run. The pack's "not a test user" advice is fine as long as the account holds a Tester role.
- **Video C, Human Agent.**
  - The send adds `messaging_type: MESSAGE_TAG` and `tag: HUMAN_AGENT` (`instagram.ts:299-302`), and that envelope shape is itself unverified (`:293-297`).
  - Without the Human Agent feature granted, the best available evidence is a refusal: "Unsupported message tag" or code 10 (`2026-09-16-meta-human-agent-and-quick-replies-api-facts.md` §B3, Grade C/D).
  - Dry-run one send to @sahildoes first. If it's refused, show the owner-facing refusal (`metaGraph.ts:56-64`) and narrate that this is what the requested feature unlocks.

---

## F6 — MEDIUM-LOW — Reconnecting an account reuses the old poll cursor

**Grade:** CONFIRMED.

Only the poller writes `instagramSyncedAt` (`instagramPoll.ts:218`). None of these clear it:
- the paste connect (`config/route.ts:97-109`)
- the OAuth connect (`callback/route.ts:58-68`)
- disconnect (`config/route.ts:170-173`)

**Scenario:**
1. The reviewer business connects account A (Video A, take 1). The poller runs, then A is disconnected.
2. Hours later, someone connects account B.
3. The cursor is the old sync time minus 2 minutes, floored at 24 hours (`:206-207`), which bypasses the 15-minute first-run lookback.
4. Up to 24 hours of B's DMs are imported as new leads. Each is scored and drafted (OpenAI spend) and held. With holdAll on, nothing sends, but the queue floods.

**Fix:** set `instagramSyncedAt: null` in all three writes.

---

## F7 — LOW — Settings shows any `?message=` as a FollowUp error

**Grade:** CONFIRMED.

- `InstagramConfig.tsx:53-54` renders `searchParams.get("message")` whenever `instagram=error`.
- The OAuth callback reflects `error_description` into that parameter *before* its state check (`callback/route.ts:24, 43` vs `45`).
- So a link such as `followupbase.io/settings?instagram=error&message=…` shows attacker-chosen text in FollowUp's error style. React escapes it, so this is content spoofing, not XSS.

**Fix:** redirect with an error code taken from a fixed set, or show the text only when a short-lived cookie set by the callback matches.

---

## Checked, clean

- **Hold before any automatic send.**
  - The holdAll check (`acknowledge.ts:529`) runs before the claim and before the send.
  - `processMetaEnvelope`, scoring and engagement never call a sender.
  - With holdAll true, the reviewer's DM cannot be answered automatically.
- **Human-agent tag.**
  - It is attached only when `humanSend` is present and the send isn't automated (`sending.ts:375, 390-399`).
  - Only `POST /api/leads/[id]/send` passes it (`route.ts:44`). `bulkApprove.ts:102-109` doesn't, and nothing else calls the Meta senders.
- **Undoable send (#317).**
  - Exactly one of timer, Undo, `pagehide` and unmount wins the gate (`useUndoableSend.ts:99-172`).
  - The card and the batch act on disjoint piles.
  - The 60-second send-claim (`sending.ts:493`) absorbs a double fire.
- **Tenancy and auth on the routes touched in #316–#322.**
  - `instagram/config` GET, POST and DELETE: session required, admin required on writes, `ctx.businessId` only.
  - `oauth/start` and `oauth/callback`: admin at both ends, plus the state cookie.
  - `source-rules` POST: admin, billing, the AUTONOMOUS gate, and a sequence-ownership check.
  - `leads/[id]/send`: ownership is checked before the send.
  - `approvals/send-safe`: admin, rate limit, and a list re-derived on the server.
  - `dismiss-hold`: scoped to the business.
  - `diagnose` and `subscribe`: admin.
  - `queuePaging.ts` is pure.
- **Secrets.**
  - Tokens are encrypted before Prisma sees them (`db.ts:20, 60-66`), so even a Prisma error that prints its arguments carries ciphertext.
  - The paste route's 500 returns only the error name and Prisma code (`config/route.ts:121-129`). Verified.
  - The long-lived exchange logs and returns `attempt.label`, never `attempt.url`. This matters because the GET URL carries `client_secret` and the short-lived token (`instagram.ts:622, 642-652`).
  - The poller logs only the part of the path before `?` (`instagramPoll.ts:87`).
  - The token-check error is host, status and Meta's sentence (`instagram.ts:139-141`).
  - `DATABASE_URL` is never referenced in `src/`.

---

## Pre-flight (read-only; run before recording)

```sql
-- Q1: which F1/F2 variant is live on the founder's business
SELECT id, name, "createdAt" FROM "Lead"
WHERE "businessId" = 'cmtibjn400000iq84yxpzsw45' AND phone = 'ig:17841427527466039';

SELECT m."sentAt", m.source, m.trigger, m."externalId" IS NOT NULL AS has_mid, md5(m.body) AS body_hash
FROM "Message" m
JOIN "Conversation" c ON c.id = m."conversationId"
JOIN "Lead" l ON l.id = c."leadId"
WHERE l."businessId" = 'cmtibjn400000iq84yxpzsw45' AND c.channel = 'instagram' AND m.direction = 'outbound'
ORDER BY m."sentAt";

-- Q2: the reviewer business will actually show a draft (F3)
SELECT tier, "subscriptionStatus", "holdAllForApproval", "autonomousAllowed",
       "instagramUserId", "instagramUsername", "instagramSyncedAt"
FROM "Business" WHERE id = 'cmuecs58p0000i604fguefft3';
SELECT enabled FROM "Automation" WHERE "businessId" = 'cmuecs58p0000i604fguefft3' AND action = 'instant_ack';
SELECT "sequenceId", "automationTierDefault", "routeToPool" FROM "SourceRule"
WHERE "businessId" = 'cmuecs58p0000i604fguefft3' AND source = 'Instagram';

-- Q3: is Meta delivering real DM webhooks at all (F1, after the console check)
SELECT "receivedAt", status, payload->>'object' AS object, payload->'entry'->0->>'id' AS entry_id
FROM "InboundWebhookEvent" WHERE provider = 'meta' ORDER BY "receivedAt" DESC LIMIT 10;
```

**Reading the results:**

- **Q1**
  - A row in the first query means the phantom-lead variant is live.
  - In the second query, look for pairs with the same `body_hash`, one with `source` NULL and one with `instagram_direct`, a few minutes apart. That means the duplicate variant is live.
- **Q2 passes when all of the following hold:**
  - `tier` is pro or plus, and `subscriptionStatus` is beta, active or trialing.
  - `holdAllForApproval` is true.
  - The `instant_ack` row is absent or has `enabled = true`.
  - There is no Instagram SourceRule, or the one there has `sequenceId` NULL and a tier other than `OFF`.
  - `instagramSyncedAt` is NULL before the first connect.

---

**Sources:** all web sources were checked on 2026-09-25. They are the four GitHub links cited inline above, plus `developers.facebook.com` (tried, returned EGRESS_BLOCKED). Internal: the research files and commits cited inline.
