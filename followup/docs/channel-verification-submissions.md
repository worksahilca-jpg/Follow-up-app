# Draft submission text — Google OAuth verification & Meta App Review

Copy-paste starting points for the two one-time, app-wide unblocks from task #65
that only the account owner can actually submit (they need Google/Meta account
access, business verification documents, and in Google's case a paid CASA
assessment). Everything here is drafted from the real scopes the code requests
and the real user-facing flow — adjust tone/detail to match whatever form field
you're actually filling in, but the substance shouldn't need rework.

Do NOT submit either of these until you've re-read them once yourself — a
reviewer is a human (or an ML model trained on humans) checking that the
written description matches what the screencast shows, and a mismatch is one
of the most-cited rejection reasons for both platforms.

---

## 0. Pre-submission readiness check (2026-09-11)

What's actually true in the code right now, checked directly rather than assumed,
against the requirements `research/integrations/2026-09-10-meta-google-verification-playbook.md`
flagged. Confirmed items need no action; gaps are called out with a fix.

| Requirement | Status | Where |
|---|---|---|
| Homepage publicly describes reading Gmail | ✅ Confirmed | `src/app/page.tsx` — "Connect your inbox — FollowUp reads your sales conversations in Gmail — nothing else" (line 244) plus two FAQ answers naming Gmail explicitly |
| Homepage describes Google Calendar event creation | ❌ Gap | `src/app/page.tsx` never mentions Calendar/scheduling anywhere. Playbook §4.2 wants the homepage copy to name every Google product the OAuth consent screen asks for, not just Gmail. **Fix:** one clause added to the "Connect your inbox" feature bullet or the FAQ — e.g. "...and creates a calendar event when a lead asks to schedule a call." Small copy change, not a design change — say the word and I'll add it. |
| Privacy policy on the same domain as the app | ✅ Confirmed | `src/app/privacy/page.tsx`, served at `followupbase.io/privacy` |
| Privacy policy carries the Limited Use statement | ✅ Confirmed | `src/app/privacy/page.tsx:84-103`, "Google user data — Limited Use disclosure" section, links Google's own policy |
| Privacy policy's Limited Use section names Calendar data specifically | ❌ Gap | Same section (line 98) says "the Gmail scopes needed..." but never mentions `calendar.events` by name. Same fix as above, one line, on request. |
| Meta data-deletion disclosure (name what's held, what's deleted, timeframe) | ✅ Confirmed | `src/app/privacy/page.tsx:106-134` ("Instagram and Facebook data") + a "Data retention & deletion" section further down committing to confirming deletion within 2 business days |
| Scope justifications match the code exactly | ✅ Confirmed | The four Google scopes and the Meta permission lists in §1/§2 below were checked line-by-line against `src/lib/integrations/gmail.ts`, `src/lib/instagram.ts`, `src/lib/facebook.ts` on 2026-09-10 — nothing requested in code is missing from these drafts, and nothing drafted here asks for more than the code requests |

What's **not** checkable from inside the repo — these are yours to do directly in
each console, in this order (per the Phase 0 checklist in the 2026-09-10 playbook):

1. Confirm `followupbase.io` resolves over HTTPS and the OAuth client's authorized
   domain is set to `followupbase.io` exactly (not a Vercel preview URL).
2. Set up `verification@followupbase.io` (a forwarding alias is enough) and use
   it as the contact/verification email on both the Google and Meta submissions.
3. Verify `followupbase.io` as a **DNS Domain property** (not URL-prefix) in
   Google Search Console, from an account that's Owner/Editor on the GCP project.
4. Fill in the Meta App Dashboard's Data Deletion Callback/Instructions URL field
   with `https://followupbase.io/privacy` (or an anchor straight to the "Data
   retention & deletion" section).
5. Check the Meta App Dashboard's verification flow for whether it offers an
   individual/ID-based path instead of full business verification — the 2026-09-10
   playbook flagged this as unconfirmed and potentially the single biggest
   time/cost saver if it exists for a Canadian individual.

---

## 1. Google OAuth verification (Gmail + Calendar scopes)

**Where this happens:** Google Cloud Console → APIs & Services → OAuth consent
screen → Publishing status → Prepare for verification.

**Before you submit:** confirm the OAuth client's authorized domain matches
`followupbase.io` exactly (not a Vercel preview URL) — a domain mismatch adds
a full extra review cycle per the research on this.

### App information

- **App name:** FollowUp
- **User support email:** (your support address)
- **App homepage:** https://followupbase.io
- **App privacy policy:** https://followupbase.io/privacy
- **App terms of service:** https://followupbase.io/terms
- **Authorized domain:** followupbase.io

### Application description (the free-text box Google shows verifiers)

> FollowUp is a lead follow-up tool for small businesses (real estate agents,
> contractors, and similar service businesses) who receive sales inquiries by
> email and struggle to follow up on them consistently. A business connects
> their own Gmail account; FollowUp reads incoming messages to identify which
> ones are sales inquiries (as opposed to newsletters, receipts, or personal
> mail), uses AI to draft a suggested reply, and — only after the business
> owner explicitly approves each draft, unless they've opted into automated
> sending for low-risk replies — sends the reply from their own Gmail account.
> It also creates calendar events when a lead requests to schedule a call or
> meeting. No Gmail or Calendar data is shared with any other business using
> FollowUp, sold, or used to train AI models without being stripped of
> personally identifying information first (see our privacy policy).

### Scope justifications

**`https://www.googleapis.com/auth/gmail.readonly`** (restricted scope):

> FollowUp needs to read the full content of incoming emails — not just
> metadata — to determine whether a message is a genuine sales inquiry and to
> generate a contextually accurate suggested reply. We search a business's
> inbox (excluding Promotions/Social/Updates/Forums categories) for messages
> from the last 90 days and read each message's subject, sender, and full
> plain-text/HTML body. We do not read or store emails from folders/labels
> the user hasn't implicitly included in this search, and we never read or
> act on emails unrelated to sales inquiries.

**`https://www.googleapis.com/auth/gmail.send`** (sensitive scope):

> FollowUp sends follow-up replies to a business's own leads, from the
> business's own Gmail account, so the reply appears to come from the
> business owner directly (not from a third-party "no-reply" address). Every
> automated draft requires the business owner's explicit approval before
> sending, unless they've specifically opted a lead into low-risk autonomous
> sending — this is a per-lead, opt-in setting, not a default.

**`https://www.googleapis.com/auth/calendar.events`** (sensitive scope):

> When a lead asks to schedule a call or meeting in their email, FollowUp can
> create a calendar event on the business owner's calendar so the meeting
> isn't missed. This is triggered only by an explicit scheduling request in a
> lead's message, never created speculatively.

**`https://www.googleapis.com/auth/userinfo.email`** (non-sensitive):

> Used only to identify which Google account has been connected, for display
> in Settings and to prevent connecting the wrong account.

### The CASA Tier 2 assessment

`gmail.readonly` is a **restricted** scope, which requires an annual
third-party security assessment (Google's CASA program) in addition to the
verification review above — this is the expensive, slow part (6-12 weeks,
~$540-1,800/year). Google's site lists approved assessors; the research this
was drafted from named a few with public pricing (TAC Security, NCC Group,
NetSentries) as a starting point for getting quotes, not a recommendation of
one specific vendor. Start this in parallel with the verification review, not
after it — they don't have to be sequential, and CASA is the long pole.

Google will ask for a **CASA scoping questionnaire** before the assessment
even starts — expect it to ask about your infrastructure (Vercel + Supabase
Postgres + Prisma, in FollowUp's case), where refresh tokens are stored,
whether data is encrypted at rest and in transit, and your incident-response
process. Worth having straightforward, honest answers ready (e.g. "refresh
tokens are stored encrypted in Postgres, application-layer tenant isolation
via businessId filtering on every query, TLS in transit") rather than
scrambling when asked.

---

## 2. Meta App Review — Instagram (`instagram_business_manage_messages`)

**Where this happens:** Meta App Dashboard → your app → App Review →
Permissions and Features.

**Permissions to request:** `instagram_business_basic`,
`instagram_business_manage_messages`.

**Before you submit:** make sure your Meta Business Manager has already
cleared Business Verification (legal business name matching exactly what's in
your incorporation/registration document) — a name mismatch is the single
most-cited rejection reason found in research for this specific review.

### Use case description

> FollowUp lets a small business connect its own Instagram professional
> account so that direct messages from potential customers are captured as
> leads and can be replied to from within FollowUp. When someone sends a
> message to the business's Instagram account, FollowUp creates a lead record
> from it, uses AI to suggest a reply, and — after the business owner reviews
> and approves it (or has opted a lead into automated low-risk replies) —
> sends the reply back to that person on Instagram. This is not a bulk
> messaging or broadcast tool: FollowUp only replies to a specific person who
> has already messaged the connected business, in that one conversation
> thread.

### Screencast script

Reviewers reject vague product tours; the demo needs to show the *exact*
permission being exercised end to end. Record this as one continuous take,
narrating each step:

1. **Show the FollowUp Settings page**, click "Connect with Instagram."
2. **Complete the real Instagram OAuth consent screen** (the one Instagram
   itself shows, listing the requested permissions) and grant access.
3. **Cut to Instagram itself** (or a test account): send a DM to the
   connected business's Instagram account from a second account, as if
   you're a customer asking a question.
4. **Cut back to FollowUp**: show the new message appearing as a lead on the
   Leads page within a minute or two, with the message content visible.
5. **Open the lead**, show the AI-suggested reply, click Approve/Send.
6. **Cut back to Instagram**, show the reply arriving in the DM thread from
   the business's account.

Narrate what's happening at each step out loud or with on-screen captions —
reviewers have said they reject submissions where the use-case text and the
video don't obviously match up.

---

## 3. Meta App Review — Facebook Messenger + Lead Ads

**Permissions to request:** `pages_show_list`, `pages_messaging`,
`pages_manage_metadata`, `pages_read_engagement`, `leads_retrieval` (with
`business_management` as the stated dependency for all of them under Facebook
Login for Business).

**Note:** this uses the same Business Verification as Instagram above — if
that's already cleared, you don't need to redo it for this submission, only
the separate permissions review.

### Use case description

> FollowUp lets a small business connect its own Facebook Page so that (a)
> messages sent to the Page via Messenger, and (b) form submissions from the
> Page's Lead Ads campaigns, are captured as leads inside FollowUp. For
> Messenger: when a customer messages the connected Page, FollowUp creates a
> lead, drafts a suggested reply with AI, and sends it back through Messenger
> once the business owner approves it (or has opted the lead into automated
> low-risk replies) — the same reviewed workflow as Instagram DMs. For Lead
> Ads: when someone submits one of the Page's lead-generation ad forms,
> FollowUp retrieves that submission via the Lead Ads API and creates a lead
> record so the business can follow up, instead of the submission sitting
> unseen in Meta's Ads Manager. `pages_show_list` is used only during the
> connect flow, to let the business owner pick which of their own Pages to
> connect.

### Screencast script

Two flows to demonstrate in one take:

**Messenger:**
1. Settings → "Connect with Facebook" → complete the real OAuth consent
   screen, select the Page.
2. From a second account, send a message to the connected Page.
3. Cut to FollowUp: show the message appearing as a new lead.
4. Approve/send an AI-drafted reply; cut back to Messenger showing it arrive.

**Lead Ads:**
1. Submit a test lead form on the connected Page's Lead Ads campaign (a test
   ad or Meta's Lead Ads Testing Tool works for this).
2. Cut to FollowUp: show the same submission appearing as a new lead within a
   minute or two, with the form's field values visible on the lead.

Same rule as Instagram: narrate what's happening, and make sure the written
use-case description above doesn't claim anything the video doesn't actually
show.

---

## 4. WhatsApp Business — template drafts

**Where this happens:** each customer business's own Twilio Console → Messaging
→ Content Editor (or Settings → Phone in FollowUp once a template-picker UI
exists) — per `research/integrations/2026-09-06-whatsapp-business-production-readiness.md`,
this is the recommended Path A (Twilio self-sign-up), so template approval sits
with **each business**, not with FollowUp once, app-wide. It's also fast and
mostly automated (15-30 minutes typical, 24-48 hours if flagged for manual
review) — nothing like the Google/Meta App Review timelines above.

**Why a template is needed at all:** WhatsApp only allows free-form text replies
within 24 hours of the lead's last inbound message. Re-engaging a lead who's
gone quiet longer than that — FollowUp's core "rescue a cold lead" pattern —
must open with a pre-approved template. `src/lib/twilio.ts`'s `sendWhatsApp()`
already has the retry-via-template code path built (`ContentSid` +
`ContentVariables`); what's missing is an actual approved template to point it
at (`Business.whatsappTemplateSid`, set in Settings → Phone).

**Current code constraint — read this before submitting more than one:** today
the schema holds exactly **one** `whatsappTemplateSid` per business, and the
send path fills exactly **one** variable slot (`{{1}}`, the lead's first name —
see `sendWhatsApp()`'s `ContentVariables: JSON.stringify({ "1": ... })`). So
only one of the drafts below can actually be wired up per business right now.
Pick the one that fits FollowUp's most common re-engagement case (draft A,
below, is the recommendation) and submit that one first; supporting a small
library of templates the AI picks between is real future engineering, not a
paperwork step — flagged in the 2026-09-06 research as "needs product design,"
not something to build as a side effect of a template submission.

**Category to select: Utility.** Every source in the 2026-09-06 research agrees
marketing-toned language inside a utility template is the single most-cited
rejection reason — so keep these plain, specific, and free of promotional
language ("special offer," "limited time," exclamation points, emoji).

### Draft A — general re-engagement (recommended first submission)

> Hi {{1}}, just following up on your inquiry — still interested? Reply here
> anytime and I'll get right back to you.

- **Category:** Utility
- **Variables:** `{{1}}` = lead's first name
- **Matches:** the general "lead went quiet" case — the most common trigger for
  FollowUp's automation, and the safest utility-toned framing per the rejection
  research.

### Draft B — quote/pricing follow-up

> Hi {{1}}, wanted to check in on the quote we sent over — any questions I can
> help with before you decide?

- **Category:** Utility
- **Variables:** `{{1}}` = lead's first name
- **Matches:** a lead who received pricing and went silent. Slightly more
  specific than Draft A; worth a second submission once volume through Draft A
  shows this case comes up often enough to justify the code work to select
  between templates.

### Draft C — missed call / voicemail follow-up

> Hi {{1}}, sorry we missed you on the phone — what's the best way to reach you
> to help with your request?

- **Category:** Utility
- **Variables:** `{{1}}` = lead's first name
- **Matches:** the voice/voicemail channel's own re-engagement case
  (`research/*channel-deep-dive*` docs for Twilio Voice) — lowest priority of
  the three since it only fires for leads that came in by phone.

**Opt-in note before submitting any of these:** Meta can request proof of opt-in
during template review (per the 2026-09-06 research, §4) — for FollowUp this is
straightforward since a business-initiated WhatsApp send only ever targets a
lead who already messaged in first (opted in by definition), but have that
framing ready if asked, rather than scrambling for it mid-review.

---

## Common rejection reasons to check before submitting (from prior research)

- **Google:** domain mismatch between the OAuth client and the live app;
  requesting `gmail.readonly` without a clear justification for reading full
  message bodies rather than just metadata (this doc's justification above
  addresses that directly).
- **Meta (both):** legal business name in Business Verification documents not
  matching *exactly* what's typed into Meta Business Manager; a screencast
  that reads as a generic product tour instead of demonstrating the specific
  permission; resubmitting the same day as a rejection (reportedly gets
  auto-flagged — wait at least a day and address the stated reason first).
