# Code audit — second pass — 2026-09-08

Scope per this pass's brief: WhatsApp Business (capture + reply), Meta Business Agent as a
lead source, CRM (Follow Up Boss + HubSpot) import/poll + note push-back, one-click Instagram/
Facebook OAuth Connect, Ponds (shared claimable lead pool), Smart Views, Phase D autonomous
send risk-scoring, the consent/AI-audit-trail panel, per-business export + full deletion, and a
zod-validation spot check across a handful of API routes.

This is explicitly a *second* pass: `research/audit/2026-09-08-newer-surface-audit.md` (same day,
earlier in this work) already covered almost this exact surface area in depth. Before writing
anything up here, every finding in that file was re-verified against the current code:

- **#1 (voice-agent bridge unauthenticated WebSocket)** — out of scope for this pass per the task
  brief (already fixed/tested per instructions); not re-checked.
- **#2 (CRM sync pagination cursor never persisted)** — **confirmed fixed.** `CrmConnection.syncCursor`
  now exists (`prisma/schema.prisma:740`, migration `20260908220000_crm_sync_cursor`) and
  `syncCrmForBusiness()` (`src/lib/crmSync.ts:53,79`) resumes from it correctly. Not re-reported.
- **#3 (Instagram/Messenger/Lead-Ads inbound message idempotency)** — **confirmed fixed**, still using
  `createInboundMessageIfNew`'s `externalId`-unique create-and-catch-P2002 pattern
  (`src/lib/instagram.ts:221-231`, `src/app/api/instagram/webhook/route.ts:115,166,190`). Not
  re-reported.
- **#4 (Outlook/Gmail OAuth CSRF `state` not validated)** — re-read both callback routes
  (`src/app/api/integrations/outlook/callback/route.ts`, `src/app/api/integrations/gmail/callback/
  route.ts`): the gap as described is **still present in the code** (state is just the literal string
  `"onboarding"`/`undefined`, never compared against a value issued for the session, unlike the
  Instagram/Facebook flows' random-state-plus-httpOnly-cookie pattern). Per this task's explicit
  instructions this area is already-audited/out-of-scope, so it is **not** re-reported as a new
  finding here even though direct inspection shows it unresolved — flagging the discrepancy only so
  it isn't mistaken for something this pass verified as fixed.

New findings from this pass follow. Two are reported, both traced through the actual code paths on
both sides of the interaction (both the manual-trigger route and the scheduled cron route in finding
1; both the write path and the read/render path in finding 2) rather than inferred from a smell.

---

## 1. No atomic per-lead claim on the automated-send schedulers — a manual "run now" click racing the hourly cron (or two overlapping cron ticks) double-sends the same autonomous message — backend/trust, high severity, confirmed

**Where:** `src/lib/automation.ts` `runAutomationForBusiness()` (lines 150–152) and
`src/lib/sequences.ts` `runSequencesForBusiness()` (its per-lead loop, ~line 291 onward) — the exact
same missing-guard shape in both files.

Every other place in this codebase that can be invoked twice for the same target under real
concurrency uses an atomic conditional `updateMany` — check-and-claim as one statement — specifically
*because* a plain read-then-write here is a known race in this codebase:

- `claimLead()` (`src/lib/assignment.ts:98-101`): `updateMany({ where: { id, assignedToId: null }, ... })`
- `acknowledgeNewLead()` (`src/lib/acknowledge.ts:88-91`): `updateMany({ where: { id, acknowledgedAt: null }, ... })`
- `checkRapidEngagement()` (`src/lib/engagement.ts:57-63`): `updateMany({ where: { id, OR: [...] }, ... })`,
  whose own comment states the reasoning explicitly: *"a single conditional UPDATE, not a separate
  findFirst-then-create... the second's WHERE clause is re-evaluated against the now-updated row and
  matches zero rows."*

`runAutomationForBusiness()` does not follow this pattern. It fetches the eligible-lead list with a
plain `SELECT` (`prisma.lead.findMany(...)`, lines 126-141), then inside the per-lead loop does a
**plain, unconditional** update as its only "claim":

```ts
await prisma.lead.update({ where: { id: lead.id }, data: { lastAutomationCheckedAt: new Date() } });
```

This always succeeds regardless of what else is happening to that row — it is not a
`updateMany({ where: { id, lastAutomationCheckedAt: null_or_stale } })` with a `.count` check the way
every other "only one caller should win" spot in this codebase is written. Two concurrent invocations
of `runAutomationForBusiness(businessId)` both run their `SELECT` before either writes, both see the
same lead as eligible, and both proceed to draft and — for an `AUTONOMOUS`-tier lead — **send**,
because the risk gate is skipped entirely for that tier (`automation.ts:179`, by design: *"the one
place in the app that sends without any review"*). `runSequencesForBusiness()` has the identical
shape: its `sequenceStepDueAt: { lte: new Date() }` query (line 278) is read up front, and the only
per-lead write before the real `sendFollowUpToLead()` call is the stage-change/step-index update that
happens **after**, not a claim before.

`mapWithConcurrency` (`src/lib/concurrency.ts`) runs up to 3 leads in flight within one call, but that
in-process worker pool does nothing to prevent two *separate* invocations of the enclosing function
from running concurrently — there is no DB advisory lock, no "automation already running for this
business" flag, nothing (`grep`ed the whole `src/` tree for any lock primitive around these calls;
none exists).

**Concrete failure scenario:** Both routes that call these functions are reachable by a real user in
ways that overlap with the always-on cron:

- `POST /api/automation/run` (`src/app/api/automation/run/route.ts`) — the Settings page's "Run
  automation check now" button, whose own copy in `src/app/(app)/settings/page.tsx:672-675` literally
  tells the user *"This also runs automatically every hour... this button is just for checking sooner"*
  — i.e., the product's own UI documents that a manual run and the hourly cron (`vercel.json`:
  `"schedule": "0 * * * *"`) are expected to coexist, and invites exactly the click-while-cron-is-due
  timing that triggers the race. The button is disabled client-side only while its own `fetch` is
  in flight (`settings/page.tsx:238,253` `runningNow` state) — that guards against a double-click in
  the same tab, but not against the same business owner with Settings open in two tabs, or against the
  hourly `/api/cron/automation` tick landing in the same window.
- `POST /api/sequences/run` has the same relationship to `/api/cron/automation`'s
  `runSequencesForAllBusinesses()` call.
- At real tenant counts the code's own comments (`src/app/api/cron/automation/route.ts:6-11`) flag
  that one cron invocation "comfortably past a default serverless timeout" is an anticipated scaling
  concern — i.e., a single hourly run taking longer than an hour, and the *next* hour's cron firing
  while the previous one is still going, for the *same* set of businesses, is a scenario this codebase
  already expects to eventually happen, not a contrived edge case.

When the race lands on an `AUTONOMOUS`-tier lead, the outcome is two independent, real, customer-
facing sends of a near-identical AI-drafted message (email, SMS, WhatsApp, Instagram, or Messenger)
within moments of each other — the one send path in the entire app with no human review to catch it
before it goes out. It also doubles the CRM note push-back (`pushCrmNote` in `src/lib/sending.ts`)
and the OpenAI drafting/risk-assessment cost for that lead. On an `ASSISTED`-tier lead the risk gate
still runs twice and (assuming it agrees with itself) produces two `ai.hold` audit rows and two
identical "drafted and waiting for your approval" notifications instead of a duplicate send — still
wrong, just less severe.

**Fix direction (not applied):** replace the plain `prisma.lead.update` claim in both files with a
conditional `updateMany` mirroring `checkRapidEngagement()`'s pattern exactly — e.g.
`updateMany({ where: { id: lead.id, OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }] }, data: { lastAutomationCheckedAt: new Date() } })` — and skip the lead (`continue`/return a `"skipped"` outcome) when `.count === 0`, since that means another concurrent run already claimed it. `runSequencesForBusiness()` needs the equivalent claim on `sequenceStepDueAt` (or a new per-lead "in progress" marker) before drafting/sending, not only the post-send reschedule it does today.

---

## 2. The AI activity log on a lead's Trust panel silently caps at 25 events with no indication there's more — a lead with a longer automated history looks fully audited when it isn't — trust/compliance, low-medium severity, confirmed

**Where:** `getLeadAuditTrail()`, `src/lib/leads-data.ts:113-127`, and its only consumer,
`LeadTrustPanel.tsx` (`src/components/LeadTrustPanel.tsx:98-116`).

```ts
const events = await prisma.auditEvent.findMany({
  where: { businessId: ctx.businessId, targetType: "lead", targetId: leadId },
  orderBy: { createdAt: "desc" },
  take: 25,
});
```

This is a hard `take: 25`, most-recent-first, with no total count returned alongside it and no cursor
for "load more." `LeadTrustPanel` renders exactly what it's given (`auditTrail.map(...)`, line 102) —
if the array happens to be exactly 25 long, there is nothing in the component's output distinguishing
"this lead has exactly 25 AI actions on record" from "this lead has 40 AI actions and you're seeing
the newest 25." The panel's own framing (`"AI activity log"`, a `<History>` icon, the empty-state copy
"Nothing sent or held for this lead yet") presents itself as *the* record of what FollowUp's AI has
done to this lead — which is the exact question this feature exists to answer per its own doc comment
(`LeadTrustPanel.tsx:6-15`, "a chronological 'what did the AI actually do to this lead' log").

**Concrete failure scenario:** A lead that automation has repeatedly held for manual review — e.g. an
`ASSISTED`-tier lead whose drafts keep getting flagged medium/high risk, or a long-neglected
`unanswered` lead that gets re-evaluated roughly every 20 hours (`recheckCutoff` in
`src/lib/automation.ts:120`) for weeks because nobody ever answers it — accumulates one `AuditEvent`
row (`ai.hold` or `ai.send`) per consideration. Past 25 such events (a few weeks of a genuinely stuck
lead, or any lead old enough to have been through several sequence steps plus several silence/
unanswered cycles), the oldest entries — including, potentially, the very first automated action ever
taken on this lead, or a send made under settings that have since changed — become permanently
invisible in the UI a business owner would actually check to answer "did the AI do anything I need to
know about here," with no hint that history was truncated. For a feature whose entire purpose is
trust/compliance visibility into autonomous actions, quietly dropping the tail of the record without
saying so undercuts exactly the guarantee it's meant to provide.

**Fix direction (not applied):** either raise the cap to something a real lead's lifetime activity
won't realistically exceed, or — better — return the total count (a cheap `prisma.auditEvent.count()`
with the same `where`) alongside the capped list and have `LeadTrustPanel` render something like "Showing
the 25 most recent of 40 actions" when the total exceeds what's shown, so the panel never implies
completeness it doesn't have.

---

## Summary

Two new findings. #1 (no atomic claim on the automation/sequence schedulers) is the more serious one —
it's a genuine, reachable race in the codebase's one unreviewed-send path, in a spot every other
similar race in this same codebase was already fixed with a one-line change to a conditional
`updateMany`, making this look like an inconsistency that slipped through rather than a novel design
problem. #2 (audit trail's silent 25-event cap) is a real completeness gap in a feature whose whole
purpose is compliance visibility, but lower severity since the underlying `AuditEvent` rows are never
actually lost — only the UI's rendering of them is incomplete.

Re-verified as still true from the prior (`2026-09-08-newer-surface-audit.md`) pass: CRM sync
pagination is fixed; Instagram/Messenger/Lead-Ads inbound idempotency is fixed. Areas checked fresh
in this pass and found clean: Ponds/lead claiming (`claimLead()`'s atomic `updateMany` correctly scopes
by the pre-validated lead id, and `businessId`/`userId` are never attacker-influenced independently of
the caller's own session); Smart Views (`src/lib/savedFilters.ts` — criteria are evaluated client-side
against the caller's own already-tenant-scoped lead list, so there is no server-side query string for
an injection risk to live in, and both create/delete correctly scope by `businessId` plus, for delete,
the original creator); CRM tenant isolation (`pushCrmNote()` re-checks `conn.provider === provider`
against the business's *current* CRM connection before pushing a note, so a note can never be pushed to
the wrong provider even if a business reconnects a different CRM after a lead was originally synced
from another one); per-business deletion cascade (`deleteBusinessData()` in `src/lib/businessData.ts`
was checked against every one of the 23 Prisma models with a `businessId`/`Business`/`User` relation —
all are covered, in an FK-safe order, except `AuditEvent`, which is deliberately excluded and
documented as such; `Notification.leadId` is deliberately not a real foreign key, so it can't block or
orphan anything); one-click Instagram/Facebook OAuth (`state` is a random `randomBytes(24)` token in an
httpOnly cookie, correctly compared on callback, for both flows; requested scopes are minimal and match
what's actually used); and a zod-validation spot check across `/api/business/delete`, `/api/saved-
filters`, `/api/leads/[id]/send`, `/api/leads/[id]/automation`, `/api/automation/settings`, and
`/api/integrations/gmail/push` — every one of these actually gates on `parsed.ok`/`payload.success`
before touching the parsed data; none defines a schema and then forgets to enforce it.
