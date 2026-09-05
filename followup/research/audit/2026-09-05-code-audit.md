# Code audit — 2026-09-05

Ad-hoc audit pass (no dedicated agent charter yet — see `.claude/agents/README.md`). Scope: CSV import, notification/engagement system, onboarding, booking, sequences engine, session/multi-tenant scoping, and frontend design-token usage. Each finding below was traced through the actual code path, not inferred from a code smell. Ranked most severe first. Findings-only — no fixes applied here; backend-agent/frontend-agent act on these next.

Already-covered territory from earlier this session (billing gate coverage, rate limiting on public/authenticated costly routes, Twilio/Instagram signature verification, mobile layout fixes, npm audit) is intentionally not repeated here.

---

## 1. Concurrent inbound messages create duplicate Lead records (Twilio SMS + Instagram DM) — backend, high severity

**Where:** `src/lib/twilio.ts` `findOrCreateLeadByPhone()` (lines 82–100), `src/lib/instagram.ts` `findOrCreateLeadByInstagram()` (lines 103–126).

Both functions are a manual find-then-create with no DB-level uniqueness guard on phone number:

```ts
const existing = await prisma.lead.findFirst({ where: { businessId, phone } });
if (existing) { return prisma.lead.update(...); }
const lead = await prisma.lead.create({ data: { businessId, name: phone, phone, ... } });
```

The code comment even documents *why* this isn't a Prisma `upsert` ("Phone numbers have no unique DB constraint... so this is a manual find-or-create") but doesn't address the resulting race: two inbound webhook requests for the same sender processed concurrently (two different serverless invocations) both run `findFirst`, both see no existing lead, and both `create` a brand-new Lead row for the same phone/Instagram sender.

**Concrete failure scenario:** A new contact texts a business's Twilio number twice in quick succession ("Hey" then "are you open today?" a second later) — an extremely common real-world pattern, not an edge case. Twilio also independently retries a webhook delivery if the handler doesn't respond fast enough, which is a second, production-realistic trigger for the same race. Both requests hit `POST /api/twilio/sms/[secret]` concurrently, both find no existing lead for that phone number, and two separate `Lead` rows get created for one real person — one message on each. This splits the conversation history, doubles the lead count in the dashboard/pipeline/analytics, can assign the two halves to two different team members (round-robin `pickAssignee`), and fires `applySourceRouting` / scoring / rapid-engagement checks twice as if two different leads exist. The exact same pattern applies to Instagram DMs via `findOrCreateLeadByInstagram`.

**Fix direction (not applied):** add a unique constraint on `(businessId, phone)` (nullable-safe, same pattern as the existing `(businessId, email)` constraint) and use a real `upsert`, or wrap the find+create in a transaction/advisory lock.

---

## 2. `detectReplies()` attributes one real reply to multiple pending FollowUps, inflating reply-rate and response-time analytics — backend, high severity

**Where:** `src/lib/outcomes.ts` `detectReplies()` (lines 26–72), consumed by `src/lib/analytics-data.ts` (`repliedCount`, `medianReplyHours`, `automatedReplyRate`, `manualReplyRate`, lines 171–196) and `src/lib/leads-data.ts` `getWeeklyReport()` (`repliesReceived`, lines 144–159).

The function fetches every `FollowUp` with `status: "sent"` and `repliedAt: null` for a business, then for each one independently finds "the first inbound message after `sentAt`" across *all* of that lead's conversations and stamps it as the reply:

```ts
const firstReply = followUp.lead.conversations
  .flatMap((c) => c.messages)
  .filter((m) => m.sentAt > sentAt)
  .sort(...)[0];
if (firstReply) await prisma.followUp.update({ ..., data: { repliedAt: firstReply.sentAt } });
```

There is no check that a given inbound message hasn't already been claimed as the reply to an earlier, still-pending FollowUp processed in the same loop.

**Concrete failure scenario:** A lead gets two automated follow-ups sent without responding to either (e.g. step 1 and step 2 of a sequence, both still `repliedAt: null`) and then finally sends one reply. On the next Gmail sync, `detectReplies()` loads both pending FollowUps in the same `pending` array; for FollowUp A (sent first) the "first inbound message after `sentAt`" is that one reply, and for FollowUp B (sent later) the "first inbound message after `sentAt`" is *also* that same reply — so both get `repliedAt` set to the identical timestamp. The result: `repliedCount`/`repliesReceived` counts one genuine reply as two, `automatedReplyRate`/`manualReplyRate` on the Analytics page are inflated, and the median response-time metric gets polluted with a second, fabricated "response time" computed from FollowUp B's `sentAt` to a reply that was actually to FollowUp A. This is a normal multi-touch-before-reply pattern, not a rare corner case — any business running a 2+ step sequence will see it.

**Fix direction (not applied):** track which inbound message ids have already been consumed as a reply within the same `detectReplies()` pass (or match each FollowUp only against messages strictly after the *previous* FollowUp's `sentAt` and before the next one), so one inbound message can close out at most one pending FollowUp.

---

## 3. CSV lead import never calls `applySourceRouting` — imported leads silently skip configured sequence enrollment / automation tier — backend, medium severity

**Where:** `src/app/api/leads/import/route.ts`, lines 152–154:

```ts
const result = toInsert.length
  ? await prisma.lead.createMany({ data: toInsert, skipDuplicates: true })
  : { count: 0 };
```

`backend-agent.md`'s own documented convention: "New lead creation must call `applySourceRouting(businessId, lead.id, source)` right after `prisma.lead.create` ... every real-time lead-creation call site below calls this exactly once" (`src/lib/sourceRouting.ts` header comment). Every other creation path — manual entry (`src/app/api/leads/route.ts:65`), embed widget (`src/app/api/embed/[businessId]/lead/route.ts:122`), generic webhook (`src/app/api/webhooks/lead/[secret]/route.ts:106`), Gmail sync (`src/lib/integrations/gmail.ts:367`), Twilio (`src/lib/twilio.ts:105`), Instagram (`src/lib/instagram.ts:124`) — calls it. CSV import is the one path that doesn't, because it uses `createMany` (which has no per-row hook) instead of individual `lead.create` calls.

**Concrete failure scenario:** A business sets up a Source Rule in Settings (`SourceRoutingSection.tsx`) for "Website form" → auto-enroll in a "New lead nurture" sequence. They later bulk-import a CSV export of webform leads from another tool, with a `source` column containing "Website form" for every row (or leave it blank, which defaults to `"CSV import"`). None of the imported leads get enrolled in the sequence or have their automation tier set — the rule silently does nothing for this entire batch, with no error or indication to the user that anything was skipped. The only workaround is manually enrolling each imported lead after the fact.

**Fix direction (not applied):** either call `applySourceRouting` per created lead id after `createMany` returns (only for rows actually inserted, not `skipDuplicates`-skipped ones), or switch to per-row `lead.create` inside a transaction if the row count makes that acceptable.

---

## 4. `checkRapidEngagement` has a check-then-write race that can produce duplicate "lead is replying right now" notifications — backend, low/medium severity

**Where:** `src/lib/engagement.ts`, lines 51–63:

```ts
const alreadyNotified = await prisma.notification.findFirst({
  where: { leadId, createdAt: { gte: since } },
  select: { id: true },
});
if (alreadyNotified) return;

await prisma.notification.create({ data: { userId, leadId, message: ... } });
```

The dedup check is a read followed by a write with no DB constraint (`Notification` has no unique index — `prisma/schema.prisma` lines 416–431) and no transaction/lock between them.

**Concrete failure scenario:** This function is called synchronously, once per inbound message, from `src/app/api/twilio/sms/[secret]/route.ts:56` and `src/app/api/instagram/webhook/route.ts:77` — both public webhooks where two inbound messages for the same lead can arrive as two separate, concurrently-processed HTTP requests (exactly the "rapid back-and-forth" pattern this feature is designed to detect — a lead firing off two texts seconds apart). If both requests' `checkRapidEngagement` calls run their `findFirst` dedup check before either has committed its `create`, both see "not yet notified" and both insert a Notification — the assigned rep gets the same "lead is actively replying right now" alert twice in the bell dropdown for one burst.

**Fix direction (not applied):** a unique constraint (e.g. `(leadId, createdAt)` bucketed, or a separate `lastRapidEngagementNotifiedAt` timestamp column with an atomic conditional update) would close the window; this is a minor UX annoyance rather than a data-integrity problem, hence ranked last.

---

## Areas checked with no findings worth reporting

- **Booking flow** (`src/lib/booking.ts`, `src/app/api/book/[leadId]/route.ts`): double-booking is correctly guarded by a real `@@unique([businessId, scheduledAt])` DB constraint with the unique-violation caught and turned into a friendly "someone just took that slot" error — not just an app-level check. Timezone math uses `Intl.DateTimeFormat` correctly across DST. No bug found.
- **Sequences engine** (`src/lib/sequences.ts`): the "stop on reply" pause logic, step-list-edited-out-from-under-a-lead handling, and completion-timestamp bookkeeping are all internally consistent and match their documentation.
- **Team management** (`src/lib/team.ts`) and other `[id]`-scoped routes checked (`leads/[id]/*`, `team/invites/[id]`, `team/members/[id]`, `notifications/[id]`, `sequences/[id]`): all follow the documented session + ownership-check pattern correctly.
- **Onboarding flow**: no correctness bugs found; Gmail OAuth round-trip and step-resumption logic handle page-state loss correctly.
- **Frontend design tokens**: the only hardcoded hex/rgba colors outside `globals.css`/`chart-colors.ts` are in `opengraph-image.tsx`/`icon.tsx` (Edge-runtime image generation, can't use CSS custom properties there), the Google "G" logo brand colors on the sign-in page, and `rgba(0,0,0,0.4)` modal backdrops in three form components (a generic scrim, not a themed UI color) — none of these are violations of the documented token rule.
