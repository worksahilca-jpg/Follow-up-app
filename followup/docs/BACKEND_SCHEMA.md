# FollowUp — Backend Schema Reference

**Status:** living document, describes `prisma/schema.prisma` as actually deployed as of 2026-09-08.
**Source of truth:** `prisma/schema.prisma` itself — every model there carries a detailed doc
comment explaining *why* a field exists, not just its type; this document is a navigational map
over that file, organized by domain instead of declaration order. When they disagree, the schema
file wins — update this doc.

---

## How to read this

27 models, all under one Postgres database (Supabase), accessed exclusively through Prisma. No
raw SQL in application code. Every tenant-scoped model carries `businessId` (directly or
transitively) — see `docs/TRD.md` §3 for the multi-tenancy invariant this enforces.

## 1. Identity & tenancy

```
Business (1) ──< User (N)
Business (1) ──< Invite (N)     [pending team invitations, by email, pre-User]
```

- **`Business`** — the tenant root. Holds every integration's connection state directly as columns
  (Twilio secret/tokens, Instagram/Facebook ids and tokens, Stripe customer/subscription ids,
  `voiceAgentEnabled`, `allowModelTraining`) rather than one generic "integrations" JSON blob — each
  field's own doc comment in the schema explains the specific reason it's separate (e.g.
  `twilioSecret` is deliberately not reused for the generic `webhookSecret`, so regenerating one
  can't silently break the other's already-configured webhook URL).
- **`User`** — belongs to at most one `Business`. `TeamRole` is `ADMIN | SALES`. Created lazily on
  first Google sign-in (`src/lib/auth.ts`'s `signIn` callback), which also checks for a matching
  `Invite` to decide whether the new user joins an existing business or gets a fresh one.

## 2. The lead lifecycle — the core domain

```
Lead (1) ──< Conversation (1) ──< Message (N)
Lead (1) ──< Deal (N)
Lead (1) ──< FollowUp (N)
Lead (1) ──< Task (N)
Lead (1) ──< Booking (N)
Lead (1) ──< AIInsight (N)
Lead (N) ──> Sequence (0..1)     [enrollment — a lead is in at most one sequence at a time]
Lead (N) ──> User (0..1)         [assignedTo]
```

- **`Lead`** — the central row. Notable fields beyond the obvious (name/email/phone/source/stage):
  - `score` / `scoreReason` / `scoreFactors` (JSON) — AI urgency scoring, always with a
    human-readable reason and per-factor weights, never a bare number (Rule 3: trust ships like a
    feature, made concrete in the schema itself).
  - `automationTier` (`OFF | ASSISTED | AUTONOMOUS`) — per-lead, not business-wide; see
    `docs/PRD.md` §6.4.
  - `optedOutAt` — TCPA/CTIA SMS/WhatsApp opt-out (STOP), checked by every send path.
  - Several **atomic-conditional-update markers**
    (`lastRapidEngagementNotifiedAt`, `lastMissedCallTextAt`, `acknowledgedAt`,
    `lastAutomationCheckedAt`) — each is set via a single conditional `updateMany`, never a
    read-then-write pair, specifically to survive concurrent webhook deliveries for the same lead
    without double-firing (see each field's own comment in the schema for the exact race it closes).
  - `sequenceId`/`sequenceStepIndex`/`sequenceStepDueAt` — workflow enrollment state, mutually
    exclusive with `automationTier`'s silence-based cadence (a lead is driven by one or the other,
    never both).
- **`Conversation`** — one per (`leadId`, `channel`) pair in practice (email/call/text/whatsapp/
  instagram/messenger/web), created lazily on first message. `externalId` (Gmail thread id /
  Outlook conversationId) makes re-sync idempotent.
- **`Message`** — `direction` (`inbound`/`outbound`), `body`, `sentAt`, `opened`. **`externalId`
  is the idempotency key** for any channel that provides one (Gmail message id, Meta's `mid`, a
  Lead Ad's `leadgen_id`) — `@unique`, so a redelivered webhook event either upserts a no-op or
  hits a caught unique-constraint violation, never a duplicate row (see
  `research/audit/2026-09-08-newer-surface-audit.md` finding #3 and its fix). `source` is set only
  for an outbound message FollowUp *captured* but didn't send itself (e.g. Meta's own free Business
  AI answering a DM) — null means FollowUp sent it.
- **`Deal`** — a pipeline-stage snapshot with value/won/lost timestamps, separate from `Lead.stage`
  (the lead's *current* stage) so historical stage transitions aren't lost.
- **`FollowUp`** — one row per send attempt (not just successful ones): `status`
  (`pending|sent|dismissed|snoozed`), `automated`, `trigger`
  (`instant_ack|unanswered|silence|sequence|manual`), and **`repliedAt`** — the field the
  recovered-revenue report is built on (`src/lib/rescued.ts`): a reply to an automated trigger is a
  rescued conversation, a reply to a manual send is the owner's own work.
- **`Task`** — an internal to-do the business creates for itself; distinct from `Booking` below.
- **`Booking`** — a call a lead booked themselves via their public booking link
  (`/book/[leadId]`). `@@unique([businessId, scheduledAt])` is the actual double-booking guard —
  enforced at the DB level, not just in application code, since two people confirming the same slot
  in the same instant would otherwise race a check-then-create.
- **`AIInsight`** — a lightweight running summary per lead, separate from the score/scoreReason
  pair above.

## 3. Workflows & routing

```
Sequence (1) ──< SequenceStep (N, ordered)
Sequence (1) ──< Lead (N)          [enrollment]
Sequence (1) ──< SourceRule (N)
Business (1) ──< SourceRule (N)
```

- **`Sequence`** / **`SequenceStep`** — a business-defined ordered list of steps
  (`EMAIL` with an AI-drafted, hint-steered message, or `CHANGE_STAGE` with no message), each with
  a `delayDays` measured from when the *previous* step ran. `@@unique([sequenceId, order])`.
- **`SourceRule`** — what happens automatically the instant a new lead is created from a given
  `source` string: enroll in a `Sequence`, set a default `AutomationTier`, or route to a shared pool
  (`routeToPool`) instead of normal least-loaded assignment. Checked once at creation, never on
  re-sync. `@@unique([businessId, source])`.

## 4. Team & assignment

```
Business (1) ──< SavedFilter (N)
User (1) ──< SavedFilter (N)       [createdBy]
User (1) ──< Notification (N)
```

- **`SavedFilter`** ("Smart Views") — a named, optionally-shared (`shared: Boolean`) custom lead
  filter; `criteria` is a loose JSON predicate evaluated client-side, not translated to SQL.
- **`Notification`** — per-user; `leadId` is deliberately **not** a real foreign key, so a
  notification stays legible (and its dedup lookup still works) even after the lead it refers to is
  deleted, instead of cascade-deleting or blocking the delete.

## 5. Integrations & external accounts

```
User (1) ──< Integration (N)       [gmail | google_calendar | outlook | instagram | ...]
Business (1) ──1 CrmConnection     [followupboss | hubspot — one per business]
```

- **`Integration`** — per-user OAuth connection state (`accessToken`/`refreshToken` encrypted at
  rest), plus `lastSyncedAt` (incremental) and `deepSyncedAt` (the once-a-day full re-pass) so a
  thread is fetched/classified once, not re-processed every tick.
- **`CrmConnection`** — the business's own outside CRM (Follow Up Boss or HubSpot) that FollowUp
  syncs *alongside*, not instead of. `apiKey` encrypted at rest. **Known gap**: no persisted
  pagination cursor — `lastSyncedAt` alone isn't enough to resume a backfill that truncated past
  ~500 contacts; see `docs/TRD.md` §8.
- **`FilteredEmail`** — a thread the AI prospect classifier rejected (not a lead), kept (not
  discarded) with the classifier's reasoning and a one-click override, so a real customer email the
  classifier got wrong doesn't just vanish. `@@unique([businessId, threadId])` also stops the sync
  from re-classifying the same rejected thread every cron tick.

## 6. Trust, security & compliance

```
Business (1) ──< AuditEvent (N)
Business (1) ──< RateLimitHit (N)
Business (1) ──< ProductFeedback (N)
```

- **`AuditEvent`** — append-only (by convention, no route ever updates/deletes a row): who did
  what, when, for a given `targetType`/`targetId`. Written by `src/lib/audit.ts` from every
  sensitive action — sends, deletes, imports, integration connect/disconnect, settings/team
  changes, billing. `meta` (JSON) never carries credentials or message bodies, only identifiers and
  counts. **This is the data behind the per-lead Consent & AI activity panel** (`docs/PRD.md`
  §6.4) — filtered by `targetType: "lead"` on read, not a separate log.
- **`RateLimitHit`** — one row per attempt at a rate-limited action (Gmail sync, spam scan, AI
  regeneration) — these draw on one shared platform API key, not billed per-business, so nothing
  else stops a single careless account from running up a real bill.
- **`ProductFeedback`** — passive feedback about FollowUp itself, from the people using it. No
  read/resolved workflow state on purpose — a message in a bottle, not a support ticket.
  `userId`/`userName` are a point-in-time snapshot, not a live relation, so a submission stays
  legible even after that user is removed from the team.

## 7. Encryption at rest

Any column holding a real credential (OAuth access/refresh tokens, CRM API keys, Instagram/
Facebook page tokens) is wrapped by `src/lib/db.ts`'s `ENCRYPTED_FIELDS` mechanism — verified this
session to cover every integration added so far, including the newer ones (Outlook, Follow Up
Boss/HubSpot), with no gap found in the most recent audit pass.

## 8. Enums (quick reference)

| Enum | Values |
|---|---|
| `TeamRole` | `ADMIN`, `SALES` |
| `PipelineStage` | `NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST` |
| `Priority` | `HIGH`, `MEDIUM`, `LOW`, `NONE` |
| `AutomationTier` | `OFF`, `ASSISTED`, `AUTONOMOUS` |
| `SequenceAction` | `EMAIL`, `CHANGE_STAGE` |

## 9. Migration discipline

- `DATABASE_URL` (pooled, pgbouncer) is what the running app uses; `DIRECT_URL` (direct connection)
  is used only by `prisma migrate`/`prisma db push`, which can't run through a pooler.
- Every schema change ships as a real Prisma migration under `prisma/migrations/`, never a manual
  `db push` against production.
- The app is meant to connect as a least-privilege role (`followup_app`), not the Supabase admin
  role — see `docs/least-privilege-db-role.md` for the cutover steps (task #71, code ready,
  production swap pending).
