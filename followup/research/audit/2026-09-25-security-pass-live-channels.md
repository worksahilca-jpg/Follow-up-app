# Security pass: WhatsApp and Instagram, now that webhooks are live (2026-09-25)

## In plain words

1. The webhook doors are locked. Nothing is stored or acted on without Meta's signature, and a repeated delivery does nothing new.
2. One business cannot see, receive or restore another business's messages or set-aside chats.
3. On Instagram, a lead made from a DM **you** sent first can never be messaged by FollowUp. Meta's rule is enforced in code.
4. **Fix first.** On WhatsApp, a person you messaged first can become a lead. FollowUp would then follow up by **SMS**, not WhatsApp. This happens automatically if approvals are off and a WhatsApp rule is set. It can't happen on your test number tonight.
5. **Fix second.** Anyone with a business's WhatsApp number can make FollowUp pay for up to 2 AI calls per message they send. There is no limit, even on Free or unpaid accounts.
6. Tokens are encrypted, never shown and never logged. Your test-number token expires within 24 hours, so WhatsApp sending stops tomorrow until you paste a permanent one.

---

**Scope**
- Reviewed: `main` at 1acaedb (#322–#325) and the webhook routes that went live tonight.
- Tests: I ran 7 existing test files (96 tests, all pass). I also ran a 2-test scratch probe, kept outside the repo, that confirms F1's channel choice.
- Not done: nothing was run against production, no `.env` was opened, and no app source was changed.
- Prior review: P1–P7 from `2026-09-25-pr324-review.md` were re-checked, not re-derived (see "Prior review status").

**Grading**
- **CONFIRMED:** I traced the path in code, and for F1 also ran it.
- **PLAUSIBLE:** the code allows it, but it depends on something I can't see from here (Meta's behaviour, prod config, timing).

---

## Answers to the five questions

**Q1. Webhooks.**
- **Signature before any DB write:** yes, on both routes.
  - `whatsapp/webhook/route.ts:43-46` and `instagram/webhook/route.ts:62-65` check the signature before `recordInboundWebhookEvent`.
  - It fails closed when no secret is set (`instagram.ts:107-110`) and uses a constant-time compare (`:113-117`).
  - An unsigned POST costs one throttled Sentry event (`monitoring.ts:65-80`). It writes no DB row, creates no lead and makes no AI call.
- **Cross-tenant routing:** only through Meta-signed ids, looked up in unique columns (`inbound/whatsappCloud.ts:148-151`, `inbound/meta.ts:257-259`).
  - To bind an id to a business, you need a token that can read that account (`whatsapp/config/route.ts:106`, `whatsapp/connect/route.ts:45`, `instagram/config/route.ts:66`).
  - The residual is P4 (still open, below).
- **Replay:** every write is idempotent on the unique `Message.externalId` (wamid/mid). See "Checked, clean".
- **Payload size / count:** F2 covers the one real cost vector. Everything else in an envelope is Meta-authored.

**Q2. #325 judge and restore.**
- **Prompt injection:** a stranger can only steer the verdict on their **own** chat.
  - "Admit" is exactly what happened before #325 (every sender became a lead).
  - "Set aside" only hides their own message.
  - Beyond an untidy pipeline, the two real effects are F2 (spend) and F7 (a steerable reason sentence shown to the owner).
- **`threadPayload` across tenants:** no leak.
  - Every read and write keys on `(businessId, threadId)` or `(id, businessId)`.
  - The restore route is tenant-scoped (`filtered/[id]/restore/route.ts:28, 44, 49, 74-77`).
  - The list route never returns `threadPayload` (`filtered/route.ts:12-17`).

**Q3. Echo leads.**
- **Instagram/Messenger:** no send is possible, by any path (F-clean below).
- **WhatsApp:** yes. This is F1.
- **"Send all routine":** can't reach an echo lead. Its hold reason is "already in your inbox" (`automation.ts:140-142, 1106-1107`), which is not a routine hold (`approvalGroups.ts:81-87`).

**Q4. Tokens.**
- Both are encrypted at rest (`db.ts:20`).
- Neither GET selects or returns a token (`whatsapp/config/route.ts:27-47`, `instagram/config/route.ts:25-32`).
- No log line carries a token. Details and two caveats are under "Checked, clean".

**Q5.** F3–F8 below.

---

## F1 — MEDIUM — A WhatsApp lead who never wrote in gets follow-ups by SMS, and automatically in some setups

**Grade:** CONFIRMED (code, plus a scratch probe: for such a lead, `detectAutomatedReplyChannel` and `detectNonEmailChannel` both return `"text"`).

**Where**
- The echo gate creates the lead: `inbound/whatsappCloud.ts:424-437` → `findOrCreateLeadByPhone`.
- `findOrCreateLeadByPhone` then runs `applySourceRouting("WhatsApp")` (`twilio.ts:205`).
- Channel choice when the lead has no inbound message: `sending.ts:52-58` falls back to `"text"`.
  - It is reached from `sending.ts:132` (automation), `:172` (sequences) and `:313` (manual and bulk sends, which pass no channel).

**Scenario**
1. A business is on WhatsApp Coexistence and also has Twilio SMS connected.
2. The owner messages a new number from their phone: "Hi Sam, the deck is $4,200, I can start Monday."
3. Stage 2 is told to treat an owner's quote as customer business (`whatsappHistoryFilter.ts:150-154`). The echo is admitted, and a lead `+1…` is created with only that outbound message.
4. **Workflow rule:** if a "WhatsApp" source rule enrols new leads in a workflow and "hold everything for approval" is off:
   - The step has no email, so it picks `"text"` (`sequences.ts:615`).
   - Risk comes back low, so it sends (`sequences.ts:748`).
   - Sam gets an **SMS** from the business's Twilio number. He has never contacted the business, and never on SMS.
5. **Auto rule:** the same happens on the silence rule if the rule sets new WhatsApp leads to Auto. An AUTONOMOUS lead skips the whole hold block, including the "already in your inbox" hold (`automation.ts:923`), and sends via `"text"` (`automation.ts:731, 1186`).
6. **Default setup** (approvals on): the draft waits for the owner. Pressing Send on it still goes out by SMS, because `/api/leads/[id]/send` passes no channel (`leads/[id]/send/route.ts:44`). `MessageComposer.tsx` never names the channel.

**Also affected**
- WhatsApp history threads where only the owner wrote.
- Restored threads with no inbound message.

**Not affected**
- Tonight's founder setup. This is my inference: echoes (`smb_message_echoes`) are the owner's messages sent from the WhatsApp Business app, and Meta's test number isn't on one. See `research/integrations/2026-09-19-whatsapp-coexistence.md:39`.
- Businesses without Twilio: the send fails with "Text messages aren't switched on" (`twilio.ts:510-520`). That is safe, but confusing on what the owner thinks is a WhatsApp lead.

**Why it matters**
- It is an automated text to someone who never opted in to SMS. This is the consent question the code itself names for untouched leads (`automation.ts:668-670`).
- The consent standard is in `research/integrations/2026-09-06-twilio-sms-compliance.md` §TCPA (lines 62-68).
- Instagram and Messenger already refuse this exact case (`sending.ts:376-381`). WhatsApp and SMS have no equivalent.

**Minimal fix (backend-ai-agent)**
- In `sendFollowUpToLead`, for `text`/`whatsapp` and `options.automated`, refuse when the lead has **no inbound message on any channel**. Mirror `sending.ts:376-381`.
- In `detectPhoneChannel`, when there is no inbound but the lead's only conversation is `whatsapp`, return `"whatsapp"` rather than `"text"`. The owner's manual send then goes where they expect, and Meta's template rules apply.
- Add a trust-guarantee test: a WhatsApp lead with only outbound messages is never sent an SMS.

## F2 — MEDIUM — WhatsApp messages from non-leads trigger OpenAI calls with no cap, no billing check and no rate limit

**Grade:** the missing gate is CONFIRMED. The size of the cost is PLAUSIBLE.

**Where**
- Every live message with words from a number that isn't a lead calls `judgeHistoryThread` (`inbound/whatsappCloud.ts:231-237`, reached from `:322-330`). So does every owner message to such a number (`:425-433`).
- That is up to two `classifyAsProspect` calls on `gpt-4o-mini` (`whatsappHistoryFilter.ts:127, 159`; `openaiClient.ts:15`).
  - Stage 1 reads the first 3 messages.
  - Stage 2 reads the last 20, up to 1,200 characters each (`openai.ts:431-433`).
- `checkAiEligibility` (`billing.ts:375`) is never called on this path. The file's own comment says it is "the single gate every AI entry point funnels through".
- So the judge still runs:
  - on Free accounts, whose plan excludes WhatsApp (`billing.ts:237-245`);
  - on lapsed accounts;
  - outside the monthly AI cap.

**Scenario**
1. Someone with the business's public WhatsApp number sends 5,000 short messages.
2. The first may be set aside. Every later one with words is judged again (`:231-237`), at 2 calls each and about 10,000 calls in total.
3. Stage 1 is pure waste on a re-judge: it re-reads an opening that has not changed.
4. Sustained, it can use up the platform's shared OpenAI rate limit, so other tenants' scoring and drafting fail.
5. A judge that errors fails open (`whatsappHistoryFilter.ts:163-169`). The sender then becomes a lead.
6. From then on, every message runs `scoreAndDraftForLead` (`inbound/whatsappCloud.ts:373`). That is capped per lead per month, **not per message** (`billing.ts:409`), so it is also unbounded for one lead.
   - That last part already existed on SMS. It is newly live on WhatsApp and Instagram tonight.

**The owner's own chats**
- The same path charges for every message the owner sends to family on a Coexistence number: two calls per message, uncounted.

**History sync**
- It runs the same two calls per thread, one after another, inside the webhook request (`inbound/whatsappCloud.ts:518-523`).
- Neither webhook route sets a `maxDuration`, so a large sync can time out. It is then redelivered and paid for again. PLAUSIBLE.

**Minimal fix**
- Before judging, check billing and tier the same way `checkAiEligibility` does (`hasActiveAccess` and `isChannelAvailableOnFreeTier("WhatsApp")`). When refused, skip the judge and admit (the pre-#325 behaviour; scoring then pauses itself).
- Skip stage 1 on a re-judge.
- Add a per-contact cooldown on re-judging a set-aside chat, for example at most once every 10 minutes.

## F3 — LOW — Set-aside private chats are kept forever, in plain text

**Grade:** CONFIRMED.

**Where**
- The whole thread is written to `threadPayload`, which is plain JSON and not in `ENCRYPTED_FIELDS` (`inbound/whatsappCloud.ts:241-260, 528-547`).
- `FilteredEmail` is only deleted on restore, on promotion, on a mailbox re-import or on business erasure (`businessData.ts:223`). There is no age-based prune.

**Scenario**
- The owner's family messages and bank alerts are kept indefinitely: up to 50 messages per contact, from people who never dealt with the business.
- Bank alerts often carry one-time codes; this is my inference about what a bank sends, not something seen in the data.
- Each new message re-sends up to 20 of them to OpenAI (F2).
- Raw webhook bodies already have a policy: 14 days (`inboundEvents.ts:252`). This copy has none.

**Minimal fix:** in the hourly cron, next to `pruneInboundWebhookEvents` (`api/cron/automation/route.ts:94`):
- clear `threadPayload` on WhatsApp rows whose `lastMessageAt` is older than 30 days, or delete those rows;
- keep the row itself if Restore should still show "we saw this".

## F4 — LOW — Two quick messages from a new number can lose one of them

**Grade:** PLAUSIBLE.

**Where:** `inbound/whatsappCloud.ts:213-260`. It reads the row, appends, then upserts, with no lock.

**Scenario**
1. "Hi" and "are you free Saturday?" arrive as two webhooks in parallel. Both read "no row".
2. Either the last write wins, and the kept thread holds only one message, or one upsert throws P2002.
3. `processInboundEvent` marks that event failed and still answers 200 (`inboundEvents.ts:128-136`).
4. Nothing replays failed events automatically (`:196-203`). The message then exists only in `InboundWebhookEvent`.
5. A related variant: one request admits and the other sets aside. You get a lead plus a stale set-aside row holding a message the lead's thread doesn't have.

**Minimal fix:** do the read-append-write in a `$transaction` with a row lock, or catch P2002 and retry `judgeUnknownContact` once.

## F5 — LOW — Disconnecting WhatsApp on one business can silence another

**Grade:** PLAUSIBLE.

**Where:** `whatsapp/config/route.ts:149` → `unsubscribeAppFromWaba` (`whatsappCloud.ts:213-218`). This unsubscribes FollowUp from the **whole WhatsApp Business Account**.

**Scenario**
1. An agency or franchise has two numbers in one WhatsApp Business Account, connected to two FollowUp businesses.
2. One disconnects.
3. Meta stops sending webhooks for both numbers. The other business sees nothing wrong.

**Minimal fix:** only unsubscribe when no other business has the same `whatsappWabaId`.

## F6 — LOW — The audit trail says "WhatsApp connected" when the connect was refused

**Grade:** CONFIRMED.

**Where:** `whatsapp/config/route.ts:122` records `integration.whatsapp.connect` before the save at `:127-134`. A 409 (number already on another account) still leaves a "connected" event.

**Minimal fix:** move the `recordAudit` call after a successful `update`, as `whatsapp/connect/route.ts:72` already does.

## F7 — LOW — A stranger can shape the "why it was set aside" sentence the owner reads

**Grade:** PLAUSIBLE.

**Where:**
- The classifier's `reason` is stored verbatim and without a length limit (`inbound/whatsappCloud.ts:245, 256`; `whatsappHistoryFilter.ts:162`).
- It is shown in the filtered list as FollowUp's explanation.
- It renders as React text, so it is not XSS (the only `dangerouslySetInnerHTML` is `layout.tsx:70`).

**Scenario:** a message engineered so the reason reads like a FollowUp system notice, for example "Your account needs re-verification at …".

**Minimal fix:** clamp the reason to about 160 characters and strip URLs and phone numbers before storing it.

## F8 — LOW — An Instagram echo lead in a workflow is drafted and refused every hour, forever

**Grade:** CONFIRMED in code. It only happens when "hold everything" is off and an "Instagram" source rule enrols leads in a workflow.

**Where**
- The echo lead runs source routing (`instagram.ts:466`).
- Each hourly step drafts and risk-checks with OpenAI (`sequences.ts:661-698`). The send is then refused because the person never wrote (`sending.ts:376-381`).
- The lead stays enrolled and the owner is notified each time (`sequences.ts:762-774`).
- So each hour costs two AI calls and one notification.

**Minimal fix:** in the workflow step, skip drafting on `instagram`/`messenger` when `metaWindowFor` is null or past 24 hours. The silence rule already does this at `automation.ts:738-745`.

---

## Prior review status (2026-09-25-pr324-review.md)

- **P4, cross-column uniqueness: still open**, unchanged.
  - `instagram/config/route.ts:98-115` and `oauth/callback/route.ts:68` still rely on the two separate `@unique` constraints.
- **P5, a reconnect can blank `instagramAccountId`: still open**, unchanged.
  - `resolved.accountId ?? null` at `instagram/config/route.ts:107` and `oauth/callback/route.ts:68`.
- **P2, the three Meta ids might differ: now live, no longer latent.**
  - Webhooks now route. If the webhook's `mid` differs from the poller's id for the same DM, every inbound Instagram DM is stored, scored and drafted twice.
  - Run P2's check query on the first real DM that arrives by webhook.
- **P1, phantom self-lead: not what happened tonight.** The lead created for an account the owner DM'd is the intended echo capture (`inbound/meta.ts:290-295`), not a phantom self-lead.

## Checked, clean

**Instagram/Messenger echo leads can't be messaged**
- `sending.ts:376-381` refuses every path when there is no inbound message on that channel: manual, automated, bulk and retry.
- The silence rule skips before drafting (`automation.ts:738-745`).
- CONFIRMED.

**Replay and idempotency**
- Inbound: create, or P2002 means "already seen" (`instagram.ts:559-567`).
- Echoes: upsert on `externalId` (`instagram.ts:519-524`).
- Promotion and history: upsert (`inbound/whatsappCloud.ts:272-283, 559-570`).
- Set-aside redelivery is deduped by wamid (`:222`).
- Delivery statuses are scoped to the business (`:385-388`).
- Meta's signature has no timestamp. But the header is never stored (only `payload`, `inboundEvents.ts:64-71`), and every write is idempotent, so a replay does nothing new.
- Minor: a late or replayed status can overwrite a newer one (for example "read" → "delivered").

**Tokens**
- WhatsApp and Instagram tokens are in `ENCRYPTED_FIELDS` (`db.ts:20`), and the extension encrypts before the query runs (`db.ts:64-66`). A rethrown Prisma error therefore carries ciphertext, not the token.
- Logs carry Meta's message and codes only (`metaGraph.ts:88-89`), or the error name and code only (`instagram/config/route.ts:130-132`).
- Two caveats I can't close from code:
  - With `TOKEN_ENCRYPTION_KEY` unset, tokens are stored in plain text with only a console warning (`crypto.ts:47-50`). Production config can't be checked from here.
  - The Instagram `/me` call puts the token in the URL (`instagram.ts:179`). FollowUp doesn't log that URL, but a proxy that logs URLs would.

**Tenant isolation of #325**
- Covered in Q2 above.
- One more path: `Message.externalId` is globally unique. If the same wamid ever existed under another business, the upsert's `update: {}` skips it silently. Nothing leaks; that message would just be missing. It is only possible if Meta reuses a wamid across two FollowUp numbers messaging each other, which is unverified.

**Prompt-injection framing**
- The judge gets the untrusted-input notice, the note that the Sender line is attacker-written, temperature 0 and a JSON schema (`openai.ts:492-499, 515-516`).
- The instant reply holds no business data that could leak (`openai.ts:1412-1457`).
- Replies are held by default (`acknowledge.ts:529`) and shape-checked against the sender's own words.

**#322 / #323**
- Both paste paths answer P2002 with a 409 (`instagram/config/route.ts:116-126`, `whatsapp/config/route.ts:127-134`).
- The approval queue now drops a held lead once any outbound message follows the hold, echoes included (`pendingApprovals.ts:156-180`).

**Verify token**
- It is a constant (`instagram.ts:73`) and is returned to any signed-in member. Knowing it only lets someone point their **own** Meta app at our URL.
- That app's POSTs are signed with its own secret and get a 403.

## Not security, noticed on the way

**Hand-typed phone numbers dodge the "already a lead" rule**
- The "already a lead" check is an exact string match (`inbound/whatsappCloud.ts:298-300`). Leads added by hand keep the phone number as typed (`api/leads/route.ts:23, 70`).
- So an existing customer entered as "(416) 555-0100" is judged as a stranger when they write on WhatsApp. They can be set aside, or become a second lead.

**Tonight's test-number token expires within 24 hours**
- After that, FollowUp's WhatsApp sends fail.
- Inbound webhooks will likely keep arriving, because the subscription is app-level, so leads and drafts keep being created with nothing able to send. That is my inference.
- Use a system-user token.

## Sources

- Code and tests as cited, at 1acaedb, checked 2026-09-25.
- "Temporary access token expires in less than 24 hours" and the system-user permanent token: a web search on 2026-09-25 surfaced it as the summary of [Meta for Developers — Using Authorization Tokens for the WhatsApp Business Platform](https://developers.facebook.com/blog/post/2022/12/05/auth-tokens/). The page itself was egress-blocked from this sandbox, so this is not verified first-hand.
- SMS consent standard: `research/integrations/2026-09-06-twilio-sms-compliance.md` §TCPA.
