# The first-run journey, traced through the code

**Date:** 2026-09-15
**Author:** product-ux
**Scope:** what actually happens to a business owner between "Continue with Google" and their first
useful outcome — read from the code, not from memory or from any prior write-up.
**Branch / commit:** `claude/followup-demo-to-production-4k39hr`, HEAD `642f9e4`, working tree dirty
(four other agents were editing `src/**` while this was written — `src/lib/reactivationSend.ts`,
`src/lib/sending.ts`, `src/lib/sender.ts`, `src/lib/twilio.ts` and others all had uncommitted
changes). Line numbers below are from the working tree at the time of reading; where a line may
move, the symbol name is given too. **No file under `src/**`, `prisma/**` or `design-brain/**` was
modified by this audit.**

**What this is not:** not a design review, not a visual critique, and not a list of things I think
would be nicer. Every behavioural claim cites a file and a line. Every claim about how an owner
would *feel* is marked **[inference]** and is mine, not research.

**What I could not determine, stated up front:**
- Whether `MICROSOFT_CLIENT_ID` is configured in the live deployment. Several findings below change
  shape depending on it; each says so.
- Whether `OPENAI_API_KEY` is set in production (assumed yes — most of the product is inert without
  it).
- Real timings for OpenAI/Gmail calls. Every duration below is derived from a configured constant or
  a cron schedule, never estimated.
- Whether any real owner has been through this flow. No user research was conducted for this
  document and none is cited.

---

## 0. The journey, as the code runs it

| When | What happens | Where |
|---|---|---|
| T+0 | Google sign-in. A brand-new email gets a new `Business` **and three enabled automations, created in the same transaction**: `auto_send` at 5 days, `instant_ack` at 0 days, `unanswered_reply` at 24h. | `src/lib/auth.ts:105-126`, specifically `:117-122` |
| T+0 | `Business.tier` defaults to `"free"`; `subscriptionStatus` is null. | `prisma/schema.prisma:96`, `:85` |
| T+0:30 | Onboarding step 1: business name, industry, team size. | `src/components/OnboardingForm.tsx:186-248` |
| T+1:00 | Onboarding step 2: "Connect Gmail", with a four-bullet disclosure box. | `OnboardingForm.tsx:294-383` |
| T+1:30 | OAuth round trip → `/api/integrations/gmail/callback` → back to `/onboarding?gmail=connected`. | `src/app/api/integrations/gmail/callback/route.ts` |
| T+1:31 | A `useEffect` fires `POST /api/integrations/{provider}/sync` automatically. Deep pass: Gmail's last **90 days**, up to 100 threads listed, **≤25 classified**, **≤15 scored** per run. | `OnboardingForm.tsx:78-102`; `src/lib/integrations/gmail.ts:849-853`; `src/lib/gmailSync.ts:28-29` |
| T+1:31 … T+6:00 | **During that sync, messages go out.** Every newly-created lead whose newest inbound message is under 60 minutes old and has no outbound reply gets an AI-written acknowledgement sent from the owner's own Gmail. | `gmail.ts:760-773` → `src/lib/acknowledge.ts:259-363`; staleness bound `acknowledge.ts:66` |
| T+~3:00 | Onboarding shows `Found 18 leads already, 15 scored.` (or nothing at all — see §2.1). | `OnboardingForm.tsx:89-97` |
| T+3:05 | "Continue to dashboard" → `onboarded = true` → `/dashboard`. | `OnboardingForm.tsx:143-160`; `src/app/api/onboarding/route.ts:41-43` |
| Next `:00`, if it is 08:00–17:59 **America/New_York** | The hourly automation cron runs. This is the first bulk autonomous act. | `vercel.json` `"0 * * * *"`; `src/lib/automation.ts:239-574`; window at `src/lib/sendWindow.ts:20` |
| Every 10 min | Gmail/Outlook sync crons. | `vercel.json` |
| Every 6h | Reactivation classification — **only for businesses with a paid subscription**. | `src/app/api/cron/reactivation/route.ts:86` |
| Mondays 13:00 UTC | Weekly digest — **also paid-only**. | `src/app/api/cron/weekly-digest/route.ts:36` |

---

## 1. What the owner is told vs. what the code does

Ranked by how much damage the gap does to a new owner's trust. Damage is stated concretely.

---

### 1.1 — WORST — The consent decision made for cold leads is bypassed for the most sensitive leads of all

**What the code was deliberately changed to promise.** On 2026-09-15 the founder made an explicit
call, recorded in the code itself:

> ```
> // So these become a batch the owner is offered rather than a batch
> // that happens to them: FollowUp finds the cold leads, writes each
> // draft, and puts them in the approval queue with the reason
> // attached. [...] Founder's call, 2026-09-15, after a trust audit found a new
> // business could message six months of contacts within an hour of
> // signing up without ever being told it would.
> ```
> — `src/lib/automation.ts:468-478`

And `src/lib/reactivationSend.ts:122-126` states the matching rule for the batch path:

> ```
> // The single bucket that may ever be messaged. COLD_UNANSWERED is
> // deliberately absent: those leads wrote to us and got nothing back,
> // and a "still interested?" to them makes it worse, not better.
> ```

**What the code does.** `runAutomationForBusiness` merges three candidate sets and resolves overlaps
in this order:

```ts
// automation.ts:322-328
const unansweredIds = new Set(unanswered.map((l) => l.id));
const deadIds = new Set(deadLeads.filter((l) => !unansweredIds.has(l.id)).map((l) => l.id));
```

A lead that is *both* 45+ days cold *and* last-wrote-to-us is classified `unanswered`, **not**
`isDeadLead`. The mandatory hold is gated on `isDeadLead`:

```ts
// automation.ts:479
if (risk.riskLevel !== "low" || isDeadLead) {
```

So a 70-day-old thread where the lead asked a question and nobody ever answered skips the
mandatory hold entirely and is auto-sent if the risk classifier returns `low`. That is precisely
the `COLD_UNANSWERED` population that `reactivation.ts:414-421` says is owed *"an apology and an
actual answer"*, because *"'Just checking in — still interested?' to someone whose question you
ignored for two months is not a follow-up, it's an insult"* — and that `reactivationSend.ts`
refuses to bulk-send to by design.

**Two subsystems, opposite rules, same person.** The batch path cannot message them at all. The
automation path can message them unreviewed, within the hour, on the first tick after signup.

**Damage:** the one safeguard the founder personally added is absent from the exact case it was
added for. A 90-day Gmail import reliably contains these threads — that is what a neglected inbox
*is*. **[inference]** The owner discovers this by getting a reply from someone they ghosted in
July, on a message they never saw.

---

### 1.2 — Nothing bounds how many automated messages the first tick sends, and nothing paces them

**What the owner is told** (onboarding, before the OAuth screen):

> "It can then **send follow-ups from your address**, including to people who went quiet a while ago."
> — `OnboardingForm.tsx:339-341`

True, and honest about direction. It says nothing about volume or timing.

**What the code does.** The eligibility queries in `automation.ts:282-315` have **no `take`**. The
send loop is:

```ts
// automation.ts:333
const outcomes = await mapWithConcurrency(eligible, 3, async (lead): Promise<LeadOutcome> => {
```

`mapWithConcurrency` (`src/lib/concurrency.ts`) has no delay of any kind — three workers pull off a
cursor until the list is empty. For a business on Plus/Pro, every imported lead whose last contact
is 5–45 days old, plus every imported thread where the lead wrote last more than 3 hours ago, is in
that list on the first tick.

**The contradiction is with FollowUp's own code.** `reactivationSend.ts:50-69` argues at length
that this is dangerous:

> ```
> * Sends are sequential, not concurrent, and that is deliberate. Blasting
> * 43 emails through one mailbox in two seconds is exactly the pattern spam
> * filters are built to catch, and getting a small business's own Gmail
> * flagged would be a far worse outcome than a batch that takes a few
> * minutes.
> ```

`SEND_SPACING_MS = 6000` (`reactivationSend.ts:70`) — six seconds between sends, in a code path
**that has no caller** (§3.1). The path that actually runs on day one has zero spacing and no cap.

**Damage:** the spam-filter risk the codebase identifies in writing is carried by the path that
ships, not the path that doesn't. Getting the owner's own mailbox flagged is unrecoverable for
them and for FollowUp.

---

### 1.3 — The price the owner was quoted does not exist inside the product

**Landing page** (`src/app/page.tsx:396-431`):

> "One plan. Everything included. 14-day free trial, no credit card required. Cancel any time."
> **$29/mo** — "Unlimited leads and conversations"

**Settings → Billing**, the first billing screen the same person sees after signing up
(`src/app/(app)/settings/page.tsx:1145-1181`):

> Free — **$0/mo** — "Email + web widget, **20 leads/mo**, assisted only. No card needed — **this is
> where you are now**."
> Plus — **$39/mo** · Pro — **$79/mo**
> "Resets on the 1st. Leads still come in past the cap, they just stop getting scored/drafted."

Three contradictions in one screen pair: the price ($29 vs $39/$79), the structure ("one plan"
vs three tiers), and the cap ("unlimited leads" vs 20/month). And the trial the landing page
promises is not what a new signup gets: `Business.tier` defaults to `"free"`
(`prisma/schema.prisma:96`), `hasActiveAccess` treats `tier === "free"` as access
(`src/lib/billing.ts:52-54`), so the trial is never started and the dashboard's trial prompt never
appears (`src/lib/setupStatus.ts:49-57`). The owner has to find Settings → Billing → "Start free
trial" on their own.

**Damage:** the first number in the product contradicts the number that made them sign up. **[inference]**
This reads as a bait-and-switch even though it is almost certainly just tier pricing landing
before the landing page was updated — and "almost certainly just a bug" is not a defence available
to a product whose entire pitch is being trusted to act unsupervised.

---

### 1.4 — The Settings sentence describing the automation is wrong about its own threshold

**What Settings says** (`settings/page.tsx:274-283`, built from the live flags so it "never drifts
out of sync with reality"):

> "Right now FollowUp sends an instant acknowledgement to every new lead, nudges a quiet lead after
> 5 days of silence, **steps in if you haven't answered within 24 hours**, and switches to a
> reactivation message after 45 days of silence on both sides."

**What the code does.** `findUnansweredLeads` applies the business's configured window only to
leads that already have a "substantive outbound":

```ts
// automation.ts:215-218
const hasDirectEchoReply = all.some((m) => m.direction === "outbound" && m.source);
const hasSubstantiveFollowUp = lead.followUps.some((f) => f.trigger !== "instant_ack");
const hasSubstantiveOutbound = hasDirectEchoReply || hasSubstantiveFollowUp;
const effectiveCutoff = hasSubstantiveOutbound ? cutoff : firstReplyCutoff;
```

`UNANSWERED_FIRST_REPLY_HOURS = 3` (`automation.ts:56`). Neither test can ever be true for an
imported email thread: `Message.source` is only set for Instagram/Messenger echoes
(`prisma/schema.prisma:511-513`), and the Gmail importer creates messages with
`{ conversationId, direction, body, sentAt, externalId }` and no `source`
(`gmail.ts:735-747`); a `FollowUp` row exists only for messages this app itself sent
(`src/lib/sending.ts:260-270`).

So for **every Gmail and Outlook lead**, however long the real human back-and-forth in the thread,
the threshold is 3 hours, not the 24 the owner set and Settings reports. The number in the Settings
input has no effect on email leads until FollowUp has sent one message of its own.

**Damage:** the one control an owner is given over how aggressive the product is silently does not
apply to the channel almost all their leads are on. The doc comment at `automation.ts:47-56`
describes intent ("applies only when nothing substantive has gone out yet") that the implementation
does not achieve.

---

### 1.5 — The onboarding headline still describes a read-only product, on the screen where send access is granted

**The copy** (`OnboardingForm.tsx:318-321`):

> "This is the whole point — FollowUp **reads** your sales conversations and **tells you** who needs
> a follow-up today. Without it, the dashboard stays empty."

**The code comment directly above it** (`OnboardingForm.tsx:303-317`) already names this as the
problem:

> ```
> // This said FollowUp "reads your sales conversations and tells
> // you who needs a follow-up today" — which describes a
> // READ-ONLY product, at the exact moment the owner grants send
> // access.
> ```

The comment is written in the past tense, as though the sentence had been replaced. It has not
been — the disclosure box at `:323-349` was added *underneath* it and the original sentence is
still the largest, first-read line on the screen.

**Damage:** the sentence in the reading position claims one product; the small print underneath
describes a different one. That is the exact shape of a disclosure nobody reads.

---

### 1.6 — A lapsed or failed-payment customer is told to start a trial they already had

`src/lib/billing.ts:84-99` documents this bug and its fix, in the strongest terms in the file:

> ```
> * So a paying customer whose card was declined — `past_due` — was told to "start your free 14-day
> * trial" [...] Losing a customer to a silently-expired card is bad; losing them because the
> * product couldn't tell them their card had expired is worse.
> ```

`billingLockedMessage()` was written to fix it. **The dashboard does not use it.**
`setupStatus.ts:49-57` hardcodes one string for every non-active state:

```ts
if (!hasActiveAccess(business?.subscriptionStatus, business?.tier)) {
  steps.push({
    id: "billing",
    title: "Start your free trial",
    description: "14 days, no card required — needed to sync, add leads, and send follow-ups.",
```

A `past_due`, `canceled`, `unpaid`, `paused` or `incomplete` business keeps `tier: "plus"` forever
(`billing.ts:44-51`), so `hasActiveAccess` is false and this is the step they see — on the
dashboard, the screen they actually open. The fix shipped in the API layer and not in the UI layer.

**Relevant to Q4 (trial expiring with automations mid-flight):** when access lapses,
`runAutomationForBusiness` returns `EMPTY_RESULT` at `automation.ts:255-257` with no notification,
no audit event, and no in-app sentence. Automation stops dead; the owner's only signal is a
dashboard card telling them to start a trial they have already paid for.

---

### 1.7 — Smaller, still dishonest

| Told | Done | Cite |
|---|---|---|
| Onboarding heading reads **"Gmail connected"** for an Outlook user, with their Outlook address under it. | Heading is hardcoded; only `inboxEmail` is dynamic. | `OnboardingForm.tsx:260-263` |
| Settings: "FollowUp **switches to** a different kind of message" once a lead is 45 days quiet. | It drafts one and **holds it for approval**; nothing goes out until the owner clicks. The copy describes the pre-2026-09-15 behaviour. | `settings/page.tsx:1010-1016` vs `automation.ts:479-513` |
| `gmailSync.ts:14` — "the same **180-day**, 100-thread pull as the manual Sync now". | The query is `newer_than:90d`. Narrowed on 2026-09-15; the comment wasn't. | `gmailSync.ts:14` vs `gmail.ts:851` |
| Reactivation spec §S4 and §7.4 reason about `SEND_SPACING_MS = 1200`. | The constant is now `6000`. The spec's copy rule ("no copy states a send rate") survives the change; its §7.4 risk analysis is stale. | `research/product/2026-09-15-reactivation-consent-spec.md:225,467` vs `reactivationSend.ts:70` |

---

## 2. Where a new user ends up stuck

### 2.1 A failed first sync shows the owner nothing at all

```ts
// OnboardingForm.tsx:88-101
.then(({ ok, data }) => {
  if (ok && data.success) { setAutoSyncSummary(...); }
})
.catch(() => {
  // Silent — see comment above.
})
.finally(() => setAutoSyncState("done"));
```

There is no `else`. A non-OK response (402 billing, 429 rate limit, 500 sync failure) sets no
summary, and the conditional at `:272` then renders nothing. The owner watches "Pulling in your
first leads…" spin, watches it disappear, and is left with "Gmail connected" and no result, no
error, and no way to tell whether anything was imported. The screen's own comment justifies the
silence for the billing case — but the `catch` swallows every other case with it.

**Not a dead end** (Continue still works) **but a dead signal.** The owner's next screen is a
dashboard whose content they cannot predict.

### 2.2 A denied OAuth consent shows a raw protocol error

`callback/route.ts:34` passes Google's `error` param through verbatim; `OnboardingForm.tsx:108-113`
renders it as the user-facing message. An owner who clicks "Cancel" on Google's consent screen
returns to onboarding and reads:

> **access_denied**

in coral, with no explanation and no suggestion of what to do. The fallback strings
("Couldn't connect Gmail.") only apply when Google sends no message at all.

### 2.3 The dashboard is silently empty all evening for an evening signup

The approval queue — the pinned top section of the dashboard and, per
`research/product/2026-09-10-ux-simplification.md` §0.6, "the single biggest structural gap"
it was built to fill — is derived purely from `ai.hold` audit events
(`src/lib/pendingApprovals.ts:69`). Only `runAutomationForBusiness` writes those
(`automation.ts:503-511`).

And the send-window check runs **before** drafting, releasing the claim and returning `deferred`:

```ts
// automation.ts:359-362
if (!isWithinSendWindow(new Date(), timezone)) {
  await prisma.lead.updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } });
  return { kind: "deferred" };
}
```

So outside 08:00–17:59 no drafts are held either. **A hold is not a send, but it is gated as if it
were.** An owner who finishes onboarding at 18:05 sees an empty approval queue until 08:00 the next
morning — roughly **14 hours** — with no line anywhere saying why or for how long. The dashboard
headline in that state reads "Nothing needs your OK right now." (`dashboard/page.tsx:132`), which is
true and, **[inference]**, indistinguishable from "this product does nothing".

### 2.4 The one action that demonstrates the product disappears as soon as any lead exists

`TestLeadButton` is the only self-serve way to see the core promise work
(`src/components/TestLeadButton.tsx:8-13`). It renders only inside the `leads.length === 0` branch
(`dashboard/page.tsx:158-235`). An owner whose import produced 40 stale leads and no live ones —
the exact owner this product is for — never sees it. Nor does any post-import screen repeat the
"FollowUp is watching your inbox" confirmation; that sentence also lives only in the empty state
(`dashboard/page.tsx:181-184`).

### 2.5 Environment-dependent: a Microsoft-365 business on a deployment without Microsoft OAuth

`outlookAvailable` gates the Outlook button entirely (`OnboardingForm.tsx:376`), driven by
`outlookOAuthAvailable()` → `credentials() !== null` → three env vars
(`src/lib/integrations/outlook.ts:59-70`). If they are unset, such a business has no way to connect
its mailbox, and `getIncompleteSetupSteps` will show "Connect your inbox" on the dashboard
permanently, with a remaining-step count it can never clear — the same failure mode
`setupStatus.ts:59-67` describes as already fixed for the other direction. **I could not verify
whether these vars are set in production.**

### 2.6 Latent, probably unreachable: a non-admin stuck in onboarding

`POST /api/onboarding` requires admin (`onboarding/route.ts:33-35`), and `(app)/layout.tsx:14`
redirects any non-onboarded business to `/onboarding`. A MEMBER-role user in a business that has
never completed onboarding would loop: forced to the onboarding form, refused by the API with
"Only an admin can do this." I could not construct a path that reaches this state today (invites
are sent from Settings, which is behind `onboarded`), so I am recording it as a latent trap, not a
live bug.

---

## 3. Time to first value, honestly

**"Leads on screen": immediate — under five minutes, inside onboarding.** The auto-sync
(`OnboardingForm.tsx:78-102`) is the single best thing in this flow. It runs the same deep pass as
the manual button (`route.ts` `maxDuration = 300`), so worst case is bounded by the serverless
limit, and the owner is told what it found.

**Caveat on "found":** the first pass classifies at most 25 threads and scores at most 15
(`gmailSync.ts:28-29`) out of up to 100 listed. A busy inbox reports a number well below the truth,
with no indication more is coming.

**"Something the owner would call useful" — i.e. the approval queue, the thing the dashboard is
built around: one hourly cron tick, inside 08:00–17:59 America/New_York.**

- Best case: signup at 09:50 → first holds at 10:00. **~10 minutes.**
- Worst case: signup at 18:05 → **~14 hours** (§2.3).
- Worst case for a business not in US Eastern: §4.4. A Vancouver business signing up at 15:10 local
  waits until 05:00 local the next day.

**Crons that must fire, in order:** `/api/cron/automation` (hourly) is the only one required. The
10-minute sync crons only matter for *new* mail. `/api/cron/reactivation` (6-hourly) and
`/api/cron/weekly-digest` (Mondays) **never fire for a default new signup at all** — both gate on
`hasActiveAccess(subscriptionStatus)` without passing `tier` (`cron/reactivation/route.ts:86`,
`cron/weekly-digest/route.ts:36`), and a new business has a null `subscriptionStatus`. So two of the
product's three "here is what we did for you" surfaces are structurally unavailable on the tier every
new user lands on.

---

## 4. Unhappy paths

### 4.1 Mailbox with zero leads
Handled, and handled well. `OnboardingForm.tsx:92-93` says *"No sales conversations found yet —
that's normal for a quiet inbox."*, and the dashboard empty state
(`dashboard/page.tsx:179-190`) names the connected address and offers the test lead. This is the
best-written state in the flow.

### 4.2 OAuth denied
§2.2 — the owner reads `access_denied`.

### 4.3 Token revoked mid-use — fixed for Gmail, **broken for Outlook**
`gmailSync.ts:181-215` detects `invalid_grant`, parks the integration at `needs_reconnect`, clears
the dead tokens, and explains exactly why this matters:

> ```
> // Left as "connected" [...] the connection kept reporting healthy while capturing nothing:
> // Settings said Connected, the dashboard said "watching your inbox", and the cron quietly
> // re-failed every ten minutes indefinitely. That is the worst shape a failure can take in this
> // product — the owner believes leads are being caught while they are being missed.
> ```

`outlookSync.ts:115-125` writes `lastSyncError` and **nothing else**. There is no
`needs_reconnect` status for Outlook anywhere in the file, `getOutlookStatus`
(`outlook.ts:86-90`) returns only `{ connected, email }` with no `needsReconnect` field, and
`setupStatus.ts:79-87` only ever raises the reconnect step for Gmail. So the failure shape the
Gmail code calls "the worst shape a failure can take in this product" is the *current, shipped
behaviour* for every Outlook business: dashboard says "FollowUp is watching your inbox", Settings
says connected, nothing is captured, forever.

### 4.4 Wrong timezone for everyone outside US Eastern
`Business.timezone` defaults to `"America/New_York"` and its own schema comment says
*"Not yet exposed in Settings"* (`prisma/schema.prisma:51-55`). I grepped `src/app` and
`src/components` for `timezone`: the only hits are in the public booking page, reading the
*viewer's* timezone. **No UI or API anywhere sets `Business.timezone`.** Onboarding does not ask.

`isWithinSendWindow` (`sendWindow.ts:20`) therefore enforces 08:00–18:00 New York for every business
on the platform. A Vancouver business's automated follow-ups start landing at 05:00 local. A London
business's start at 13:00 and run to 23:00 — the module's own stated purpose is to prevent
*"an automated text or email landing at 3am local to the business"* (`sendWindow.ts:4-7`), and for a
non-Eastern business it does the opposite.

Note also that the instant acknowledgement has **no** send-window gate at all — `acknowledge.ts`
calls `sendFollowUpToLead` directly (`:336`), and `sendFollowUpToLead` never checks the window
(`src/lib/sending.ts:157-300`). Replying immediately to someone who just wrote at 2am is defensible;
it is nowhere written down as a decision.

### 4.5 Free tier hitting its cap — during the very first sync
`isWithinFreeTierLeadCap` ranks a lead by its position among that calendar month's leads
(`billing.ts:177-190`), and `FREE_TIER_LEAD_CAP = 20` (`src/lib/pricing.ts:31`). Every lead imported
during onboarding is created *now*, so a 90-day import of 60 threads puts 40 of them permanently over
the cap. Those 40:

- are never scored or drafted — `scoreAndDraftForLead` returns false at `src/lib/scoring.ts:44-46`;
- are skipped by automation with the note *"Free plan — AI processing paused"*
  (`automation.ts:381`), which is written into a cron response body nobody reads;
- appear in the leads list with no score and no reason.

The only place this is explained is a progress bar inside the Settings billing tab
(`settings/page.tsx:1156-1180`). The dashboard never mentions it. **[inference]** The owner's
reading is "the AI looked at some of my leads and ignored the rest", which is worse than a stated
limit.

Secondary: `scoreUnscoredLeads` (`gmailSync.ts:41-57`) re-selects `scoreReason: null` leads oldest-first
every sync, so those 40 are retried every 10 minutes forever. It is cheap (the tier check returns
before any OpenAI call) but it is an unbounded permanent no-op.

### 4.6 Trial expiring with automations mid-flight
§1.6. Silent stop, wrong recovery copy.

### 4.7 A send that throws keeps the lead out of the running for 20 hours
`automation.ts:531-554` releases the claim only for `isTransientError` classes. Everything
else — a revoked token, a malformed address, an unsupported channel — leaves the lead claimed until
`recheckCutoff` (20 hours, `:264`). The comment argues this trade-off well. What is missing is any
surfacing: `skipped` notes are returned to the cron response and discarded
(`cron/automation/route.ts:36-38`). Nothing reaches the owner.

---

## 5. Where trust is asked for before it is earned

**The first autonomous act is roughly 90 seconds after the OAuth consent screen, before the owner
has seen a single screen of the actual product.**

Sequence, all cited above: onboarding auto-sync fires on render (`OnboardingForm.tsx:78-102`) → the
importer calls `acknowledgeNewLead` for each new lead (`gmail.ts:760-773`) → any thread with an
inbound under 60 minutes old (`acknowledge.ts:66`) and no outbound gets an AI-generated reply sent
from the owner's address (`acknowledge.ts:336-355`).

**Would a reasonable owner have expected it? Partly.** The disclosure box
(`OnboardingForm.tsx:332-348`) is genuinely good and is shown *before* the OAuth button, which is
the right place. It says sending can happen. What it does not say, and what the code does:

| Not disclosed | Reality |
|---|---|
| That the first message can go out **during onboarding**, before the dashboard is ever seen | `gmail.ts:760-773` |
| Any volume | Unbounded; no `take` on the eligibility queries (`automation.ts:282-315`) |
| Any timing | First bulk tick within the hour, or at 08:00 ET |
| That "waits for your OK" means *the model rated it medium or high* | `automation.ts:438-514`; `assessSendRisk` at `src/lib/integrations/openai.ts:554-592` |

That last row is the subtlest and, **[inference]**, the one that will actually break trust. The
owner reads *"Anything it isn't sure about waits for your OK first"* (`OnboardingForm.tsx:343`) as a
promise about a category of message. The code implements it as a per-message model judgement with a
`low`/`medium`/`high` output. The system prompt is properly conservative
(`openai.ts:566-576`) — but conservative is not the same as the categorical guarantee the sentence
makes.

One guarantee in that sentence **is** categorical and is worth protecting: *"It stops the moment
someone replies."* That one is real — a reply moves `lastContacted`, and every eligibility query
reads it.

**The silence-triggered send notifies nobody.** `notifyNeglect` fires only for `unanswered` leads
(`automation.ts:497`, `:527`). `sendFollowUpToLead` writes an `ai.send` audit event but creates no
`Notification` (`sending.ts:291-297`). So the ordinary 5-day auto-send — the most common automated
message this product makes — happens with no in-app signal whatsoever. The owner's first knowledge
of it is a reply in their inbox, or the weekly digest they are not eligible for (§3).

---

## 6. Collisions between subsystems

**1. `COLD_UNANSWERED`: batch refuses, automation sends.** §1.1. The most damaging of these.

**2. The classifier's verdict is invisible to the automation that can send.**
`reactivation.ts` exists to decide *"what a human is allowed to be offered"* (`:29-30`), writing
`quietOutcome` = `COLD` / `COLD_UNANSWERED` / `CLOSED` / `OFF_PLATFORM` / `UNCLEAR`. Its own
opening argument (`:12-17`) is that *"asking 'still interested?' of someone who bought six weeks
ago [...] is worse than sending nothing"*.

`automation.ts`'s dead-lead query (`:300-309`) filters on `businessId`, `automationTier`, `stage`,
`lastContacted` and `lastAutomationCheckedAt`. **It never reads `quietOutcome`.** A lead the
classifier judged `CLOSED` — a customer who bought — is excluded from every reactivation bucket and
still lands in the approval queue with the reason *"{Name} went quiet 62 days ago — reaching back
out is your call"* (`automation.ts:492-495`). If that lead is on `AUTONOMOUS`, it sends. The
platform paid OpenAI to work out that this person is a customer and then routed them to a path that
cannot see the answer.

**3. Two different definitions of "opted out".** `reactivation.ts` excludes `optedOutAt != null`
entirely, from classification (`:192`) and from every bucket (`:468`) — its stated reason at `:171`
is that someone who sent STOP *"is never a reactivation candidate, whatever the thread says."* `sendFollowUpToLead` blocks
only `text`/`whatsapp` (`sending.ts:201-203`), with a deliberate and correctly-argued rationale
(STOP is an SMS mechanism). The result is still that a person who texted STOP is excluded from the
reactivation batch but can be emailed by the automation path. Both positions are defensible in
isolation; shipping both means the product's answer to "did this person opt out" depends on which
subsystem you ask.

**4. Instant ack + the 3-hour unanswered rule = two automated messages, no human, same lead.**
`acknowledge.ts` deliberately excludes its own template from counting as a real reply
(`automation.ts:206-216`). So a new lead is acknowledged at minute one and, three hours later, sent
a substantive AI-written reply by the unanswered path. This is arguably working as intended and the
second send *does* notify (`notifyNeglect`) — but nothing in onboarding or Settings describes a
product that carries a conversation two messages deep without a human.

**5. A held dead-lead draft and the reactivation batch can target the same lead simultaneously.**
A hold does not move `lastContacted`, so the lead stays inside `sendableWhere`'s cutoff
(`reactivationSend.ts:121-137`) while also sitting in the approval queue. Double-sending is
prevented only incidentally: whichever fires first writes an `ai.send` audit event, which is a newer
event than the `ai.hold` and therefore drops the lead out of `getPendingApprovals`
(`pendingApprovals.ts:53-70`). That is a real mechanism, but it is a side effect of the queue's
derivation rule, not a stated guarantee — and `reactivationSend.ts:26-30` states the
"at most one message, ever" guarantee as though it were enforced by the `reactivationSentAt` claim
alone, which `automation.ts` never reads or writes.

---

## 7. Also worth knowing: the reactivation feature is three-quarters built

Not a contradiction, but it shapes every answer above. `startReactivationRun`,
`runReactivationSend`, `stopReactivationRun` and `previewReactivationDrafts` have **no callers
anywhere in `src/app` or `src/components`** — verified by grepping the whole tree; the only
non-test references are inside `reactivationSend.ts` itself. There is no `/api/reactivation/send`
route and no `/catch-up` page. `getReactivationBatch` is exposed at `GET /api/reactivation/batch`
and **nothing fetches it.**

So today: the 6-hourly cron pays OpenAI to classify the back catalogue of paying businesses
(`cron/reactivation/route.ts:108`), the verdicts are written, and no owner can see them. The "Send
all" and "Stop" flow the spec (`2026-09-15-reactivation-consent-spec.md` §3) and
`reactivationSend.ts`'s header both describe in the present tense cannot be reached by any user.

The consequence for this audit: **the careful, consented, paced, stoppable path is the one that
doesn't run. The unbounded, unpaced, partly-unconsented path is the one that runs on day one.**

---

## 8. Ranked by damage to a new owner's trust

| # | Finding | Damage if it happens | § |
|---|---|---|---|
| 1 | `COLD_UNANSWERED` leads auto-sent by automation while the batch path refuses them | An unreviewed message, in the owner's name, to someone the business ignored for months. Irreversible. Directly contradicts a founder decision recorded in the code. | 1.1 |
| 2 | No cap and no pacing on the first automation tick | The owner's own Gmail gets flagged. Unrecoverable for them; fatal for FollowUp's referral story. | 1.2 |
| 3 | Revoked Outlook token reports "watching your inbox" forever | Leads silently missed while the product claims the opposite — the codebase's own definition of its worst failure shape. | 4.3 |
| 4 | $29 one-plan landing page vs $0/$39/$79 in-app, "unlimited" vs 20/month | Reads as a bait-and-switch on the first billing screen. | 1.3 |
| 5 | Settings' 24-hour control silently means 3 hours for every email lead | The owner's one aggression dial does nothing on their main channel. | 1.4 |
| 6 | `past_due` customer told to "start your free trial" | A paying customer is told they never paid, while their automation is silently off. | 1.6 |
| 7 | `quietOutcome` invisible to automation — a classified customer still gets a "reaching back out is your call" draft | The AI's own expensive verdict is ignored by the path that acts. | 6.2 |
| 8 | Send window fixed to America/New_York with no way to change it | 05:00 sends for a West Coast business; the module's stated purpose inverted. | 4.4 |
| 9 | Free-tier cap hit during the first import, explained only in a Settings tab | "It scored 20 of my 60 leads and ignored the rest." | 4.5 |
| 10 | Empty approval queue for up to 14 hours with no explanation | Looks like a product that does nothing, on day one. | 2.3 |
| 11 | Silent failed first sync; raw `access_denied` on a denied consent | Confusion at the highest-stakes moment of the flow. | 2.1, 2.2 |
| 12 | Read-only headline above the send disclosure; "Gmail connected" for Outlook users | Small, but both are the product being careless about its own words. | 1.5, 1.7 |

---

## 9. The single worst gap between what it says and what it does

The onboarding screen says, immediately before the OAuth button:

> "Anything it isn't sure about waits for your OK first."
> — `src/components/OnboardingForm.tsx:343`

and the code records, in `src/lib/automation.ts:468-478`, that cold leads specifically were made
"a batch the owner is offered rather than a batch that happens to them" — the founder's call, after
a trust audit, on this exact date.

Both statements are false for the population that matters most: a lead who wrote to the business,
got no answer, and has been waiting 45+ days. `automation.ts:322-328` classifies them as
`unanswered` rather than `isDeadLead`, `automation.ts:479` therefore does not hold them, and on the
first hourly tick after signup they are sent an unreviewed AI-written message in the owner's name —
the same people `reactivationSend.ts:122-126` refuses to bulk-send to on the grounds that messaging
them wrongly *"makes it worse, not better."*

---

## 10. Sources

Every file below was read first-hand for this document, at HEAD `642f9e4` with a dirty working tree:

`src/app/signin/page.tsx` · `src/lib/auth.ts` · `src/app/onboarding/page.tsx` ·
`src/components/OnboardingForm.tsx` · `src/app/api/onboarding/route.ts` · `src/lib/setupStatus.ts` ·
`src/app/(app)/layout.tsx` · `src/app/(app)/dashboard/page.tsx` · `src/components/TestLeadButton.tsx` ·
`src/app/api/leads/test-lead/route.ts` · `src/lib/pendingApprovals.ts` · `src/lib/rescue.ts` ·
`src/lib/integrations/gmail.ts` · `src/lib/integrations/outlook.ts` · `src/lib/gmailSync.ts` ·
`src/lib/outlookSync.ts` · `src/app/api/integrations/gmail/callback/route.ts` ·
`src/app/api/integrations/gmail/sync/route.ts` · `src/lib/automation.ts` · `src/lib/acknowledge.ts` ·
`src/lib/sending.ts` · `src/lib/scoring.ts` · `src/lib/billing.ts` · `src/lib/pricing.ts` ·
`src/lib/sendWindow.ts` · `src/lib/concurrency.ts` · `src/lib/reactivation.ts` ·
`src/lib/reactivationSend.ts` · `src/app/api/cron/{automation,gmail-sync,reactivation,weekly-digest,office}/route.ts` ·
`src/app/api/reactivation/{batch,classify}/route.ts` · `src/app/(app)/settings/page.tsx` ·
`src/app/page.tsx` · `src/lib/integrations/openai.ts` (`assessSendRisk` only) · `prisma/schema.prisma` ·
`vercel.json` · `research/product/2026-09-15-reactivation-consent-spec.md`.

**External sources: none.** No statistic, quote, user reaction or timing in this document comes from
outside the repository. Everything marked **[inference]** is my own reasoning and is labelled as
such.
