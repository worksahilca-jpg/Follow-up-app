# Backend backlog — structural findings from audit passes

Findings too large or too judgement-heavy to fix inside an audit PR. Each one is a
verified defect with a concrete failure path, not a hunch. Hand to `backend-ai-agent`.

Opened 2026-09-15 by the second-pass bug hunt (`b0c823c`). Newest first.

---

## B-001 — A transient API error permanently strands a lead for 20 hours

**Found:** 2026-09-15. **Area:** `src/lib/automation.ts`.

`runAutomationForBusiness()` claims each lead atomically before doing any work
(`src/lib/automation.ts:304-311`), writing `lastAutomationCheckedAt = now`. The claim is
what stops two overlapping cron ticks from both sending — it is correct and should stay.

The problem is what happens **after** the claim when the work fails. The per-lead
`catch` (`src/lib/automation.ts:460-462`) turns any throw into a `skipped` note:

```ts
} catch (err) {
  return { kind: "skipped", note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
}
```

It never releases the claim. Compare the deliberate send-window path
(`src/lib/automation.ts:319-322`), which *does* release it precisely so the next hourly
tick reconsiders the lead:

```ts
if (!isWithinSendWindow(new Date(), timezone)) {
  await prisma.lead.updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } });
  return { kind: "deferred" };
}
```

`recheckCutoff` is 20 hours (`src/lib/automation.ts:224`), and it is the only thing that
makes a claimed lead eligible again.

**Someone does X, and Y breaks.** A lead writes in and nobody answers. The hourly cron
picks them up, claims them, and then the OpenAI drafting call returns a 429 (or Gmail's
token is briefly stale). The error is swallowed into a `skipped` string that goes into
the cron route's JSON response — which is returned to Vercel Cron and read by nobody. The
lead is now ineligible for **20 hours**. Meanwhile `computeAutomationStatus` still reports
`due_soon`, so the owner's leads list says "Following up soon — next automation check will
pick this up" for the whole 20 hours while nothing whatsoever is scheduled to happen.

That is exactly the failure `src/lib/automationStatus.ts`'s own header says it exists to
prevent ("a lead qualified for an automated reply for *hours* with nothing visibly
happening"), reintroduced by any transient upstream hiccup.

**The same mechanism fires on timeout.** `/api/cron/automation` has `maxDuration = 300`
and runs `runAutomationForAllBusinesses()` and `runSequencesForAllBusinesses()` together
(`src/app/api/cron/automation/route.ts:12,33-36`). When the invocation is killed at 300s,
every lead already claimed but not yet sent is left claimed, with the same 20-hour result.

**Why this isn't an audit-PR fix.** "Release the claim on error" is a one-liner but the
wrong fix on its own: a *permanent* failure (revoked Gmail grant, a lead whose content
always trips a model error) would then be retried every hour forever, burning an OpenAI
call per tick per lead. This needs a real decision — distinguish transient from permanent,
or add an attempt counter with backoff, plus somewhere durable for the failure to surface
(`Integration.lastSyncError` is the existing precedent, see `src/lib/gmailSync.ts:177-185`).
Touches the claim model, the status badge, and probably the schema.

---

## B-002 — Two Checkout sessions can create two live subscriptions, and the business is billed twice

**Found:** 2026-09-15. **Area:** `src/app/api/billing/checkout/route.ts`,
`src/app/api/billing/webhook/route.ts`.

`POST /api/billing/checkout` unconditionally creates a **new** subscription with a fresh
14-day trial. It reuses an existing Stripe *customer*
(`src/app/api/billing/checkout/route.ts:52-60`) but never checks
`Business.stripeSubscriptionId` for an existing *subscription*, and nothing cancels or
supersedes one.

**Someone does X, and Y breaks.** An owner opens Settings in two browser tabs while still
on Free. Both tabs render the tier picker (it shows whenever
`!(billingActive || billingStatus)`, `src/app/(app)/settings/page.tsx:1084`). They start
Plus in tab A and complete it. Tab B is now stale but still shows the picker; they click
Pro there and complete that too. There are now two live subscriptions on one Stripe
customer, both billing.

`syncSubscription()` (`src/app/api/billing/webhook/route.ts`) writes
`stripeSubscriptionId`, `tier` and `currentPeriodEnd` from whichever event landed last,
with no check that the event concerns the subscription the business is actually on. So
FollowUp shows exactly one plan, "Manage billing" opens the portal on the customer (where
both appear), and the business is charged twice every month. Subsequent
`customer.subscription.updated` events from the two subscriptions overwrite each other, so
the displayed tier flaps between plus and pro depending on delivery order.

No direct API access is needed — two tabs is enough. Hitting the route directly also
yields unlimited fresh 14-day trials, since every call sets `trial_period_days` again.

**Why this isn't an audit-PR fix.** The right behaviour is a product decision, not a
guard: does a second checkout upgrade in place (Stripe proration on the existing
subscription), get refused with "you already have a plan — use Manage billing", or replace
and cancel the old one? The repo already flags the in-app tier-switch flow as unbuilt
(`src/app/(app)/settings/page.tsx:1085-1089`), and this is the same piece of work. It also
wants `syncSubscription` to ignore events for a subscription that isn't the business's
current one.

---

## B-003 — A booking can be created and then reported to the lead as failed

**Found:** 2026-09-15. **Area:** `src/lib/booking.ts`.

`createBooking()` wraps three statements in one `try`, and the `catch` assumes a single
cause (`src/lib/booking.ts:145-171`):

```ts
} catch {
  // Unique constraint on (businessId, scheduledAt) — someone else just took this slot.
  return { success: false, message: "That time was just booked by someone else — pick another." };
}
```

`prisma.booking.create` is only the first of the three. If
`prisma.lead.update({ ... nextFollowUp ... })` on the next line throws for any reason, the
`Booking` row already exists and is committed.

**Someone does X, and Y breaks.** A rescued lead opens their booking link and picks 2pm.
The booking row is written; the `lead.update` fails on a connection blip. The lead is told
"that time was just booked by someone else — pick another", so they pick 3pm, which
succeeds. The business now has two confirmed bookings for one lead. The 2pm one is real
enough to occupy the slot for every other lead (`bookedTimes`, `src/lib/booking.ts:89`)
and to count in the weekly digest's `booked` figure (`src/lib/rescued.ts`), but it never
reached Google Calendar (`createCalendarEvent` is after the failure point) and the lead
does not believe it exists, so nobody shows up.

The message is also simply false in every non-P2002 case — it names a cause the code has
not checked.

**Why this isn't an audit-PR fix.** Doing it properly means narrowing the catch to the
real unique-constraint code and deciding what the other failures should do — the booking
is already committed at that point, so it needs either a transaction around the two
writes or a compensating delete, plus a distinct honest message. That's a reshape of the
function's error contract, and the booking page's copy depends on it.

---

## B-004 — Free-tier businesses silently never receive the weekly digest

**Found:** 2026-09-15. **Area:** `src/app/api/cron/weekly-digest/route.ts`.

```ts
if (!hasActiveAccess(b.subscriptionStatus) || b.users.length === 0) {
```
— `src/app/api/cron/weekly-digest/route.ts:36`

`hasActiveAccess` is called **without** the tier argument. Per its own contract
(`src/lib/billing.ts:23-54`), omitting the tier means a Free business — which by design
has no Stripe subscription — evaluates to no access. `tier` isn't even in the query's
`select` (`:25-31`), so it can't be passed without a change to the query.

This is the same tier-blind call-site class as finding 5 of
`2026-09-15-real-user-audit.md` (`src/lib/setupStatus.ts:40`), at a site that audit did
not cover.

**Someone does X, and Y breaks.** A Free business connects Gmail and uses the product for
a month. Every Monday the digest job selects them (the query only requires a connected
Gmail), then skips them. They never receive "what FollowUp saved you" — the single
artefact that demonstrates the product's value and the most natural prompt to upgrade.
Nothing anywhere tells them, or the founder, that it's being withheld.

**Why this isn't an audit-PR fix.** It may be deliberate — the digest could be intended as
a paid feature. But the route's own doc comment says "every admin of every **active**
business" and explains the *only* exclusion as "businesses without a connected Gmail are
skipped", and `research/market/2026-09-11-tier-pricing-recommendation.md` should be the
source of truth here. Needs a product call before a code change; if the digest is meant to
be Free-inclusive, pass `b.tier` and add it to the select, and add a regression test
alongside `src/lib/__tests__/hasActiveAccess.test.ts`.

**Related, benign today, worth not regressing:** `src/app/api/billing/status/route.ts:33`
is tier-blind the same way, so a Free business gets `active: false`. The Settings UI
happens to branch on `(billingActive || billingStatus)` and reaches the correct tier
picker anyway, so there is no visible defect right now — but any new consumer of that
`active` flag would inherit the bug.

---

## B-005 — Voice-agent transcript turns can be stored out of order (needs verification against the live API)

**Found:** 2026-09-15. **Area:** `voice-agent/api/stream.js`,
`src/app/api/twilio/voice-agent-callback/[secret]/route.ts`.

The bridge appends turns in the order OpenAI's Realtime events arrive
(`voice-agent/api/stream.js:280-285`), and the callback persists that array order as
truth, spacing `sentAt` by one millisecond per index specifically to preserve it:

```ts
sentAt: new Date(Date.now() + i),
```
— `src/app/api/twilio/voice-agent-callback/[secret]/route.ts:84`

The caller's side comes from
`conversation.item.input_audio_transcription.completed` (whisper-1) and the agent's from
`response.audio_transcript.done` (`voice-agent/api/stream.js:414-421`). These are produced
by two independent pipelines: input transcription runs asynchronously after the VAD commits
the input buffer, while response generation proceeds in parallel. If an agent transcript
completes before the caller transcript that prompted it, the stored conversation shows the
business answering a question the lead hadn't asked yet.

That transcript is then fed to `scoreAndDraftForLead()` (`:92`), which reads messages
ordered by `sentAt`, so a mis-ordered call can also mis-score and mis-draft.

**Confidence: unverified.** The interleaving is plausible from the event semantics and the
code makes no attempt to guard against it, but it has **not** been reproduced against the
live Realtime API — no call was placed in this pass. Before building anything, confirm
with an actual recorded call whether the two event types can arrive inverted. If they can,
the fix is to order by an event-carried timestamp or `item_id` sequence rather than arrival
order, which changes the bridge's payload shape and the callback's contract.

**Also worth deciding while in here:** `postTranscript()`
(`voice-agent/api/stream.js:437-456`) is fire-and-forget with no retry and no alert — a
non-2xx from the callback logs to the bridge's console and the entire call transcript is
lost, with no lead and no trace in FollowUp. The doc comment acknowledges this
("Best-effort: a failure here loses the transcript"), but "a real phone call vanishes
silently" deserves at least a retry and somewhere durable to surface the loss.
