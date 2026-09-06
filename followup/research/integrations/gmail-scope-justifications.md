# Gmail/Calendar OAuth scopes — draft justifications for Google verification

**Drafted:** 2026-09-05, by backend-agent, as part of Task 5.
**Status of this write-up:** first draft, grounded directly in the current code. Not yet submitted
anywhere — there is no Google Cloud project to submit it to yet (see `gmail.md`'s "Hard blockers").
Written so that whoever fills out the OAuth consent screen's per-scope justification field can
paste each section below in with light editing, and so a Google reviewer with zero prior context on
FollowUp can follow the reasoning without having to guess at the product.

**Relationship to `gmail.md`:** `research/integrations/gmail.md` (integrations-research-agent)
established *that* Google requires a written narrower-scope justification per sensitive/restricted
scope (its §1.5, step 2) and classified all three scopes below as Sensitive/Restricted. This
document is the actual justification text for each of those three scopes, reasoned from what the
code does today. It does not re-derive the scope-tier classification or the verification process —
see `gmail.md` for that. This file is **not** an edit to `gmail.md` and doesn't supersede it.

**A fourth scope FollowUp requests, `.../auth/userinfo.email`, is not covered here** — it's on
Google's non-sensitive/basic tier, so it doesn't get a reviewer-facing justification field on the
consent screen. It's used only by `src/lib/auth.ts` (NextAuth sign-in), a separate OAuth client
configuration from the three below (see that file's own header comment) — this document does not
cover it.

**One verification note before this is submitted:** the Google Calendar scope list and the
gmail.compose/gmail.send distinction below were confirmed via WebSearch on 2026-09-05 against
`developers.google.com/workspace/calendar/api/auth` and the Gmail API reference (cited inline).
Per `gmail.md`'s own methodology note, this sandbox cannot load `developers.google.com` pages
directly — WebSearch could reach and quote them, which is a step better than the pure secondary-source
sourcing `gmail.md` had to fall back to for some of its other claims, but whoever actually fills out
the Cloud Console form should still re-open those two pages directly first and confirm nothing's
changed since this was written.

---

## 1. `https://www.googleapis.com/auth/gmail.readonly`

**Tier:** Restricted (per `gmail.md` §1.2, citing
[support.google.com/cloud/answer/13464325](https://support.google.com/cloud/answer/13464325?hl=en)).
This is the scope that puts FollowUp's whole app in the Restricted tier and triggers the CASA
security assessment requirement — it's the one Google's reviewer will scrutinize hardest.

### What FollowUp actually does with it

FollowUp's core function is turning a small business's existing email inbox into a scored,
prioritized sales pipeline. Concretely, this scope is read by exactly two entry points, both in
`src/lib/integrations/gmail.ts`:

- **`fetchSalesConversations(businessId)`** — runs on every "Sync now" click
  (`src/app/api/integrations/gmail/sync/route.ts`) and once daily via the automation cron. Calls
  `gmail.users.threads.list` scoped to the inbox (excluding Gmail's own promotions/social/updates/
  forums tabs and chat) over the last 90 days, then hands the resulting thread refs to the shared
  helper below.
- **`fetchSpamProspects(businessId)`** — runs only when a user explicitly clicks "Scan spam for
  missed leads" in Settings (`src/app/api/integrations/gmail/scan-spam/route.ts`); same mechanism,
  pointed at `in:spam` instead, because a real prospect's first message can land in spam by mistake
  and nothing else ever looks there.
- Both funnel into **`processThreadRefs()`**, the shared helper that does the actual reading: it
  calls `gmail.users.threads.get(..., format: "full")` for each thread and
  **`extractPlainTextBody()`** decodes the base64url message body (falling back to stripped HTML if
  there's no plain-text part). That body text — not just headers — is what gets used next.
- The body text is what **`classifyAsProspect()`** (`src/lib/integrations/openai.ts`) reads to
  decide whether a thread is a genuine sales conversation at all, before FollowUp ever creates a
  Lead record from it. It is also what **`scoreAndDraftForLead()`** (`src/lib/scoring.ts`) reads —
  via `scoreLead()` and `generateFollowUpMessage()` — to produce the lead's priority score and an
  AI-drafted follow-up reply that actually responds to what the prospect said.
- One smaller, incidental use: right after OAuth completes, **`exchangeCodeForTokens()`** calls
  `gmail.users.getProfile({ userId: "me" })` purely to learn which address was just connected, so
  Settings can show "Connected as sarah@business.com" instead of a blank confirmation.

In short: reading the inbox is not an auxiliary feature bolted onto FollowUp, it is the product's
entire input. The Settings page describes it to users in exactly these terms: "FollowUp reads sales
conversations from your inbox to score leads and draft replies" (`src/app/(app)/settings/page.tsx`).

### Why a narrower scope doesn't work

- **`gmail.metadata`** (headers/labels only, no body) is itself also on Google's Restricted list —
  choosing it buys no reduction in review tier — and it structurally cannot support the product:
  `classifyAsProspect()` and `scoreLead()`/`generateFollowUpMessage()` all reason over message
  *content*. A subject line like "quick question" or "following up" carries no signal on whether
  someone is a real sales prospect or what they actually asked; the classifier and the AI drafter
  both need the body. There's no reduced-scope version of "read the email" that preserves this.
- **`gmail.settings.basic` / `gmail.settings.sharing`** are irrelevant — FollowUp never reads or
  changes the connected account's Gmail settings (filters, forwarding, vacation responder, etc.).
- No narrower Google-offered scope exposes message bodies without also being Restricted-tier
  itself, so there is no version of "read enough to classify and draft" that avoids this review
  path. Restricted-tier review is the cost of the core feature, not a scope FollowUp reached for
  when a cheaper one would do.

### What FollowUp deliberately does *not* do with this scope

`gmail.ts` contains no calls to `messages.modify`, `messages.trash`, `messages.delete`,
`labels.*`, `drafts.*`, or `settings.*` — nothing in the codebase reads or writes anything beyond
`threads.list`/`threads.get` (confirmed by grep across `src/`). FollowUp never labels, archives,
deletes, or reorganizes anything in the connected mailbox — it only ever looks at threads, and only
ever to decide whether to create a Lead. This is why FollowUp requests `gmail.readonly` rather than
`gmail.modify` or the full `https://mail.google.com/` scope, both of which would grant write/delete
access this integration structurally never exercises.

### Where this is visible in-product (for the demo video)

Settings → "Sync now" / "Scan spam for missed leads" buttons
(`src/app/(app)/settings/page.tsx`), and the leads that appear in the pipeline afterward with a
real AI-generated score and reasoning.

---

## 2. `https://www.googleapis.com/auth/gmail.send`

**Tier:** Sensitive (per `gmail.md` §1.2 — send-only, cannot read or delete anything on its own;
becomes part of a Restricted app only because it's requested alongside `gmail.readonly`).

### What FollowUp actually does with it

**`sendEmail(businessId, { to, subject, body })`** (`src/lib/integrations/gmail.ts`) builds a raw
RFC 2822 MIME message and calls `gmail.users.messages.send`. It is the single call site in the
codebase that puts an outbound message on the wire via Gmail. Two real paths lead into it:

- **`sendFollowUpToLead()`** (`src/lib/sending.ts`) — the shared send path for every channel
  (email/SMS/Instagram); for an email-channel lead it calls `sendEmail()` directly, then logs the
  result as a `Message` and a `FollowUp` row regardless of whether a human clicked "send" or
  automation did.
- **Automation** (`src/lib/automation.ts`) — the business-level "Auto follow-up on silence" switch
  in Settings. For a lead set to the **Autonomous** tier specifically, the code "skips the risk
  check entirely — that's the whole point of the tier" (see the comment directly above the
  `automationTier !== "AUTONOMOUS"` branch) and sends the AI-drafted message with **no human in the
  loop at all** — matching Settings' own description: "Autonomous sends every draft with no review
  at all." (Every other tier, "Assisted," still runs `assessSendRisk()` and holds anything
  price-/terms-/negative-sounding for a human first.)

The message is sent **as the connected business's own address** (`From:
${integration.user.email}`) — not from a shared FollowUp-owned mailbox — so a reply continues the
same real conversation thread the prospect already started with that business, rather than arriving
from an unfamiliar third-party domain.

### Why a narrower scope doesn't work

- **There is no Google scope narrower than `gmail.send` that can send mail at all** — per Google's
  own scope reference, `gmail.send` is already the minimum-privilege scope for this capability:
  send-only, with no read/list/modify/delete privileges on the mailbox.
  ([developers.google.com — Gmail API scopes reference](https://developers.google.com/workspace/gmail/api/auth/scopes), via WebSearch, checked 2026-09-05.)
- **`gmail.compose` looks narrower by name but is not narrower in practice — it's a different,
  broader-in-a-different-dimension scope.** `gmail.compose` authorizes the full Drafts resource
  (`drafts.create/get/list/update/delete`) *in addition to* the ability to send an existing draft
  via `drafts.send` — meaning an app holding it can read, list, and delete every draft already
  sitting in the connected mailbox, including ones the account owner wrote by hand and that have
  nothing to do with FollowUp. `sendEmail()` never touches Gmail's Drafts resource at all — it
  constructs the MIME message inline and calls `messages.send` directly, which `gmail.send` alone
  is documented to authorize (`drafts.send` itself requires `https://mail.google.com/`,
  `gmail.modify`, or `gmail.compose` — notably **not** `gmail.send`).
  ([developers.google.com — `users.drafts.send` reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/send), via WebSearch, checked 2026-09-05.)
  Requesting `gmail.compose` here would grant draft-reading/deleting access to a part of the mailbox
  this integration structurally never uses — the opposite of the minimal-scope principle a reviewer
  is checking for.
- **A third-party transactional email provider (e.g. sending via a shared FollowUp domain instead
  of Gmail at all) isn't a "narrower scope," it's a different product**, and specifically the wrong
  one here: the entire design of `sendEmail()` — sending as the business's own address — exists so
  the prospect sees a continuation of their real conversation with that business, not an
  automated-looking message from an unfamiliar sender. Switching to a third-party sender would fix
  nothing about scope minimality (Gmail access would still be needed to *read* the inbox for
  scoring) while breaking deliverability and the product's core promise.
- **A drafts-only approach (create a draft, let the human send it manually in Gmail) would silently
  disable the Autonomous automation tier**, which is an explicit, user-facing product feature (the
  toggle and tier are configured per-lead and described in Settings). A scope that could only ever
  produce a draft, never send it, cannot support a tier whose entire point is sending without a
  human touching anything.

### What FollowUp deliberately does *not* do with this scope

No draft management, no reading of the mailbox to decide what to send beyond what `gmail.readonly`
already supplies, no bulk/mail-merge sending — one `sendEmail()` call per follow-up, driven by a
real lead and a real (AI-drafted or human-edited) message body.

### Where this is visible in-product (for the demo video)

A lead's page → sending a follow-up manually; Settings → "Auto follow-up on silence" toggle set to
Autonomous on a lead, and (separately) the "Run automation check now" button.

---

## 3. `https://www.googleapis.com/auth/calendar.events`

**Tier:** Sensitive (per `gmail.md` §1.2).

### What FollowUp actually does with it

**`createCalendarEvent(businessId, { summary, description, startIso, durationMinutes,
attendeeEmail })`** (`src/lib/integrations/gmail.ts`) is the only Calendar API call anywhere in the
codebase (confirmed by grep — there is exactly one `google.calendar(...)` construction and exactly
one `calendar.events.insert` call in `src/`). It's invoked from one place:
**`createBooking()`** in `src/lib/booking.ts`, the instant a prospect confirms a time slot on their
business's public booking link (`/book/[leadId]`). It creates the event on `calendarId: "primary"`
with `sendUpdates: "all"` and the prospect as an attendee when their email is known — so the
prospect actually receives a real Google Calendar invite for the call they just booked, and the
business owner sees it appear on the same calendar they already use. Booking succeeds regardless of
calendar outcome: `createBooking()` awaits `createCalendarEvent()` but the function swallows its
own errors and returns `{ created: false }` rather than throwing, specifically so a missing/expired
Calendar grant can never roll back a real booking that already happened.

Settings tells the user exactly this: "Booking links now create real events on your Google
Calendar." — and separately warns anyone who connected Gmail before this shipped to hit
"Reconnect" once, since a token issued before `calendar.events` was added to `SCOPES` won't carry
it yet.

### Why a narrower scope doesn't work

Google's current Calendar API scope set is:
`calendar` (full read/write/share/delete on all calendars), `calendar.readonly`,
`calendar.freebusy` (availability only), `calendar.events` (view+edit events on all calendars),
`calendar.events.readonly`, `calendar.settings.readonly`, and `calendar.addons.execute` (for
Calendar Add-ons specifically, a different integration surface than what FollowUp is).
([developers.google.com/workspace/calendar/api/auth](https://developers.google.com/workspace/calendar/api/auth) — "Choose Google Calendar API scopes," via WebSearch, checked 2026-09-05.)

- **Every scope narrower than `calendar.events` in that list is read-only** (`calendar.readonly`,
  `calendar.events.readonly`, `calendar.freebusy`, `calendar.settings.readonly`). None of them can
  create an event, which is the one and only thing `createCalendarEvent()` does. There is no
  Google-offered scope that sits between "read-only" and `calendar.events` for this capability —
  `calendar.events` is the narrowest scope that permits writing an event at all.
- **The broader `calendar` scope is the wrong direction, not a fallback** — it adds calendar
  sharing/permissions management and the ability to create, modify, or permanently delete *other*
  calendars entirely (not just events on them), none of which FollowUp has ever called: there is no
  `calendarList.*` or `acl.*` call anywhere in `src/`.
- **FollowUp only ever targets `calendarId: "primary"`**, never any other calendar the account can
  see — narrower in practice than what `calendar.events` technically permits (which covers events
  across every calendar the account has access to). There is no Google scope that limits the OAuth
  grant itself to "primary calendar only"; that restriction is enforced entirely in FollowUp's own
  code (the literal string `"primary"` in `createCalendarEvent()`), not by a scope choice. Worth
  saying explicitly in case a reviewer asks why the scope looks broader than the feature: the code
  is narrower than the scope allows, because Google doesn't offer a scope that's narrower still.
- FollowUp never reads the business's calendar at all — no free/busy check, no conflict detection
  against existing events (`getAvailableSlots()` in `booking.ts` computes open slots purely from
  FollowUp's own `Booking` table plus fixed business hours, not from Google Calendar). So even
  `calendar.events.readonly`, on top of being unable to create the event, would be requesting read
  access the product doesn't use.

### What FollowUp deliberately does *not* do with this scope

No reading of the connected account's existing calendar or events, no availability/free-busy
lookups against Google Calendar, no calendar creation/deletion, no sharing/permission changes, no
writes to any calendar other than `"primary"`.

### Where this is visible in-product (for the demo video)

A lead's public booking link (`/book/[leadId]`) → picking a slot → the resulting event appearing on
the connected Google Calendar with the prospect as an attendee.

---

## Pre-submission checklist for whoever files this

- [ ] Re-open `developers.google.com/workspace/gmail/api/auth/scopes` and
      `developers.google.com/workspace/calendar/api/auth` directly (not via search) and confirm the
      scope lists and `gmail.compose`/`drafts.send` behavior above haven't changed.
- [ ] Confirm the demo video (required per `gmail.md` §1.5 step 2) actually walks through the three
      "Where this is visible in-product" flows above, in order, with the real app name/branding
      visible during the consent screen itself.
- [ ] Paste each numbered section's "What FollowUp actually does" + "Why a narrower scope doesn't
      work" text into the corresponding scope's justification field on the OAuth consent screen —
      each is meant to stand alone since Google's form asks for them one scope at a time.
- [ ] This document assumes `SCOPES` in `src/lib/integrations/gmail.ts` is unchanged from today
      (`gmail.readonly`, `gmail.send`, `calendar.events`, `userinfo.email`). If that list changes
      before submission, re-check this file against it first.
