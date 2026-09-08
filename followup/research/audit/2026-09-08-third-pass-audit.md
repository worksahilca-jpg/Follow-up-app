# Code audit — third pass — 2026-09-08

Scope per this pass's brief: Stripe billing (`src/lib/billing.ts`, `src/app/api/billing/*`),
every Twilio inbound route keyed by a URL `[secret]` segment plus `src/app/api/webhooks/lead/[secret]`
and `src/app/api/embed/[businessId]/lead`, Vercel Cron endpoints (`src/app/api/cron/*`), team
roles/permissions (`src/lib/team.ts`, `src/app/api/team/*`), the multi-channel send router
(`src/lib/sending.ts`), and the website embed widget + CSV import route.

`research/audit/2026-09-08-newer-surface-audit.md` and `research/audit/2026-09-08-second-pass-audit.md`
were read first. Nothing already reported there (voice-agent bridge auth — now fixed via
`voice-agent-auth/[secret]`, CRM sync pagination — fixed, Instagram/Messenger/Lead-Ads webhook
idempotency — fixed and re-verified in this pass by direct code read, Outlook/Gmail OAuth CSRF,
automation/sequence scheduler race — fixed and re-verified in this pass) is re-reported here.

Areas checked in depth and found clean (with reasoning, not just an assertion):

- **Stripe webhook signature verification**: `src/app/api/billing/webhook/route.ts` reads the raw
  body via `request.text()` before any parsing and runs `stripe.webhooks.constructEvent()` against
  `STRIPE_WEBHOOK_SECRET` before touching `event.data` at all; a missing signature or secret is
  rejected before any DB write. No bypass found.
- **Webhook idempotency**: the handler has no explicit "already processed this event.id" guard, but
  every handled event type (`checkout.session.completed`, `customer.subscription.*`) resolves to
  `syncSubscription()`, which re-fetches/derives the full current state and does a plain overwrite —
  redelivery of the same event is a safe no-op, not a duplicate side effect (no rows are created per
  event, only one `Business` row is updated).
- **`requireActiveBilling()` fail-open**: `hasActiveAccess()` defaults to `false` for `null`/anything
  outside `{active, trialing}`, and every one of the 25+ call sites across leads, sequences,
  automation, Twilio inbound, embed, webhooks, team billing, and both cron sync jobs (`gmailSync.ts`,
  `outlookSync.ts`, `crmSync.ts` each independently re-check `hasActiveAccess` per-business since the
  cron route itself has no per-business context) was traced; found no route that creates/sends on
  behalf of a lapsed or never-subscribed business.
- **Checkout race**: `client_reference_id` is the server's own `ctx.businessId` (never client-
  supplied), and the Settings page polls `/api/billing/status` (real DB state) rather than
  optimistically trusting the `?billing=success` redirect — no free-access window.
- **Twilio `[secret]` routes** (sms, voice, whatsapp, voice/transcription, voice-agent-callback,
  voice-agent-auth): all six require both `findBusinessByTwilioSecret()` (unique-indexed DB lookup,
  not a manual string compare, so no per-character timing signal) AND `validateTwilioRequestSignature()`
  / `validateVoiceAgentCallbackAuth()`, both of which use `timingSafeEqual` after an explicit length
  check. `voice-agent-auth/[secret]` (added since the last pass) closes the previously-reported
  bridge-authentication gap correctly. No route is reachable with no secret validation.
- **`webhooks/lead/[secret]` and `embed/[businessId]/lead`**: secret/businessId lookups are DB
  unique-index lookups, not string comparisons; both are rate-limited via `tooManyRecentLeads()`
  (DB-row-count-backed, correctly per-business, immune to serverless-instance memory not being
  shared); `businessId` in the embed route is deliberately non-secret (matches the existing
  booking-link precedent) and is never used to grant any capability beyond "which business's public
  form is this."
- **Vercel Cron** (`automation`, `gmail-sync`, `weekly-digest`, `outlook-sync`, `crm-sync`): all five
  call `requireCronSecret()` first, which fails closed (rejects everything, cron included) if
  `CRON_SECRET` isn't set, and compares the full `Authorization: Bearer <secret>` header. No route
  skips this check.
- **Team roles**: every mutating function in `src/lib/team.ts` (`inviteMember`, `cancelInvite`,
  `updateMemberRole`, `removeMember`) independently re-fetches the acting user's role from the DB and
  rejects non-admins server-side — never trusts a client claim — and every route under
  `src/app/api/team/*` that touches these calls them with the session's own `ctx.userId`, never a
  client-supplied one. Self-demotion/removal of the last admin is guarded (`countAdmins`).
  `POST /api/billing/checkout` and `/portal` both independently gate on `requireAdmin(ctx)` too.

Two real findings follow, both in the multi-channel send router, plus one in the embed/webhook
lead-capture paths. Ranked by how much real damage the failure scenario does.

---

## 1. `sendFollowUpToLead()`'s default channel resolution always prefers email over the channel a lead is actually engaging on — automated "reply for me when I haven't" and sequence "Send email" steps can silently text/DM a lead who never checks the email address on file, or silently SMS a lead who never gave a phone number consent for that specific automated content — trust/product, high severity, confirmed

**Where:** `src/lib/sending.ts:88-97` (channel resolution inside `sendFollowUpToLead()`), consumed
unchanged by `src/lib/automation.ts:238-242` (the `UNANSWERED_ACTION`/"Reply for me when I haven't"
path) and `src/lib/sequences.ts:373-377` (the `EMAIL` sequence-step action, labeled "Send email" in
the workflow builder UI — `src/app/(app)/workflows/page.tsx:461`).

```ts
const channel =
  options.channel ??
  (lead.email
    ? "email"
    : isInstagramLeadId(lead.phone)
      ? "instagram"
      : isMessengerLeadId(lead.phone)
        ? "messenger"
        : lead.phone
        ? await detectPhoneChannel(lead.id)
        : null);
```

Whenever `options.channel` isn't passed, a lead with an email address on file *always* gets `"email"`
— regardless of what channel they've actually been communicating through. Contrast this with
`detectPhoneChannel()`, defined two lines above in the same file, whose entire purpose (per its own
doc comment) is "which one to reply on isn't stored on the lead itself, it's inferred from whichever
channel they most recently actually messaged through, same as a human replying in whatever thread
they were just in." That same reasoning is never applied across email vs. phone-based channels — only
within them (text vs. WhatsApp). The codebase demonstrates it knows the correct pattern in a third
place, `acknowledgeNewLead()` (`src/lib/acknowledge.ts`), which always passes an explicit
`channel: input.channel` — the exact inbound channel the lead used — specifically so a "web form is
acknowledged by email only — we don't text a number nobody texted from" (per its own doc comment).
`automation.ts` and `sequences.ts` are the two callers that don't follow this pattern and don't pass
an explicit channel.

**Concrete failure scenario A — "Reply for me when I haven't" replies on the wrong channel:**
`findUnansweredLeads()` (`src/lib/automation.ts:64-80`) exists specifically to catch "the lead wrote,
and the owner never came back" — its whole premise is that the lead sent the most recent message and
is waiting on a reply *to that message*. A lead texts the business a question over SMS (or DMs them
on Instagram) and also happens to have an email address on file (common: many leads give both phone
and email on an initial contact form, or a rep adds an email to an SMS-sourced lead manually). Nobody
replies within the configured window (24h default). The automated "Reply for me when I haven't" rule
picks this lead up (last message is inbound-and-old via SMS/Instagram) and calls
`sendFollowUpToLead(lead.id, message, { automated: true, trigger: "unanswered", subject })` with no
`channel` override — so the reply goes out over **email**, an address the lead may never check, using
a message the lead never expects a reply to over a channel they never engaged on. The lead never sees
the response; the business's dashboard nonetheless shows the neglect as "handled." This directly
undercuts the feature's own premise ("no lead is lost to neglect").

**Concrete failure scenario B — an "EMAIL" sequence step silently sends SMS/WhatsApp/Instagram/
Messenger to a lead with no email:** Sequence enrollment (`enrollLead()`) has no requirement that a
lead have an email address, and the scheduler's eligibility query (`runSequencesForBusiness()`,
`src/lib/sequences.ts:271-283`) filters only on stage and due-date, not on channel availability. A
lead captured via SMS, a missed call, Instagram, or Messenger (no email at all) enrolled in any
sequence whose step is the one and only send-capable action — labeled **"Send email"** with a mail
icon in the workflow builder (`src/app/(app)/workflows/page.tsx:452-461`) — will, when that step
fires, have `sendFollowUpToLead()` fall through to whichever phone-based channel `detectPhoneChannel()`
picks (since `lead.email` is falsy), silently sending an SMS/WhatsApp/Instagram DM/Messenger message
instead. The message body itself is built by `composeFollowUpEmail()` (`src/lib/sender.ts`), which
hardcodes an email-style greeting and sign-off ("Hi {name},\n\n{body}\n\nBest,\n{sender}") — so the
lead receives a stiff, formal, out-of-place text message, and the business owner — who built a
workflow step they explicitly labeled/understood as "send an email" — never learns this step is
actually texting some of their leads. For an `AUTONOMOUS`-tier lead this happens with zero human
review at all.

**Fix direction:** pass an explicit `channel` from both call sites instead of relying on the default:
`automation.ts`'s unanswered-reply path should reply on whatever channel the triggering inbound
message actually came in on (the same "last engaged channel" already computed for `detectPhoneChannel`,
just needs to also arbitrate against email); `sequences.ts`'s `EMAIL` step should pass
`channel: "email"` explicitly and skip/hold the lead (with a visible "no email on file" reason) rather
than silently falling through to a different channel it was never asked to use.

---

## 2. Embed widget and generic lead webhook silently discard the visitor's message on a duplicate-email resubmission — the API reports success but the new content is never recorded anywhere — data-loss, medium severity, confirmed

**Where:** `src/app/api/embed/[businessId]/lead/route.ts:113-146` and
`src/app/api/webhooks/lead/[secret]/route.ts:96-129`, both in the `catch` block around
`prisma.lead.create()`.

`Lead` has `@@unique([businessId, email])` (`prisma/schema.prisma`). Both routes handle a repeat
submission from the same email the same way:

```ts
try {
  const lead = await prisma.lead.create({ data: { businessId, name, email: email || null, ... } });
  ...
  if (message) {
    const conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "web" } });
    await prisma.message.create({ data: { conversationId: conversation.id, direction: "inbound", body: message, sentAt: now } });
    await scoreAndDraftForLead(lead.id);
  }
  if (email) await acknowledgeNewLead(lead.id, { ... });
  return NextResponse.json({ success: true });
} catch (err) {
  if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
    return NextResponse.json({ success: true }); // <-- nothing else happens
  }
  throw err;
}
```

When the `create()` throws `P2002` (an existing lead already has this email for this business), the
catch block returns `{ success: true }` and does **nothing else** — the submitted `message` is never
appended to the existing lead's conversation, `scoreAndDraftForLead` never runs, and no acknowledgement
is sent. The visitor's (or Zapier/Make's) new message content is discarded outright, and the caller is
told the submission succeeded, so nothing anywhere flags that it was actually dropped.

This is inconsistent with how every *other* duplicate-contact race in this codebase is handled:
`findOrCreateLeadByPhone()` (`src/lib/twilio.ts:151-176`) hits the exact same kind of unique-constraint
race and explicitly finds-and-updates the existing lead on conflict so the caller's request still does
something real; the manual "Add lead" route (`src/app/api/leads/route.ts:71-84`) surfaces the same
`P2002` as a real `409` error ("You already have a lead with this email") so a human knows to go find
the existing record. Only these two public-facing capture paths swallow the conflict silently while
also dropping the payload that came with it.

**Concrete failure scenario:** A website visitor submits the embed contact form, then later — a
common pattern for genuine follow-up questions, or a browser retry after a slow/ambiguous first submit
— submits it again with the same email and a new message ("actually, can you also quote me for X").
The second submission returns `{ success: true }` to their browser (they see the normal "thanks,
we'll be in touch" confirmation), but the new message is never written anywhere: not on the existing
lead's conversation history, not re-scored, no new acknowledgement sent. The business never sees the
second inquiry at all. The same happens for the generic Zapier/Make webhook when an integration
re-sends an updated payload for a lead it already pushed once (e.g., a Google Form edit-response
sync, or a CRM export re-run) — every subsequent submission for that email is a total no-op beyond the
row already existing.

**Fix direction:** on `P2002`, look up the existing lead by `(businessId, email)` and, if a `message`
was included, append it to that lead's `"web"` conversation and re-run `scoreAndDraftForLead` (and
`acknowledgeNewLead`, subject to its own once-only/staleness guards) against the *existing* lead id —
the same "conflict → find and continue" shape `findOrCreateLeadByPhone()` already uses — instead of
silently no-oping.

---

## Summary

Two findings, both concrete and traced through both sides of the interaction rather than inferred.
#1 is the more serious: it's a genuine, reachable defect in the exact area this pass was scoped to
scrutinize (`src/lib/sending.ts`), sitting in the one place — automated, sometimes fully unreviewed
(`AUTONOMOUS` tier) — where getting the channel wrong actually costs a business a lead, and the
codebase's own `acknowledgeNewLead()` demonstrates the correct pattern right next to the two call
sites that don't use it. #2 is a real, verified data-loss bug in the public lead-capture surface,
lower severity since the lead record itself isn't lost (just the specific follow-up message), and
scoped narrowly (only fires on a repeat submission from an already-known email).

Billing (`src/lib/billing.ts`, `src/app/api/billing/*`), every Twilio `[secret]`-keyed inbound route
plus the generic lead webhook and embed lead-capture endpoint's authentication, Vercel Cron's
`CRON_SECRET` gate, and team role enforcement were all read in full on both sides of their respective
interactions and came back clean — see the "checked and clean" section above for the specific
reasoning behind each, rather than a bare assertion.
