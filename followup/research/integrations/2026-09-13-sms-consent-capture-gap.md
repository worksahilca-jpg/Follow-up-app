# SMS consent inference vs. what TCPA and a Twilio Campaign Registration actually require

Checked: 2026-09-13. Scope: task #65 sub-item — audit whether `src/lib/consent.ts`'s
`deriveConsentBasis()` (inferring SMS consent from `Lead.source`) is a defensible basis for
FollowUp to *automatically text* a lead, specifically for the `"website form"` and
`"manual"` source buckets, and whether it survives contact with (a) TCPA and (b) the
truthful-consent-description requirement in a Twilio A2P 10DLC Campaign Registration.
Builds on `2026-09-06-twilio-sms-compliance.md` (which already flagged FollowUp's follow-up
texts as "arguably a gray area" on the marketing-vs-informational line, and flagged STOP/opt-out
and quiet-hours as open items) and `2026-09-08-twilio-a2p-self-serve-api-scoping.md` (which
documents the `Usa2p` Campaign resource's required consumer-opt-in-description field). Neither
prior doc traced `deriveConsentBasis()` itself or FollowUp's actual lead-capture surfaces —
this pass does.

## Bottom line

**No, the current inference is not defensible for `"website form"` or `"manual"` sources, and
this is a real gap, not a false alarm.** `deriveConsentBasis()` is exactly what its own doc
comment says it is — "NOT a new field or a new capture-time prompt," a read of data that
already exists — and it is **never used to gate a send**, only to render a label on
`LeadTrustPanel`. Nothing in `src/lib/sending.ts`, `src/lib/sequences.ts`, or
`src/lib/acknowledge.ts` checks `deriveConsentBasis()` or any equivalent before choosing to
text a lead; the only send-time gate on SMS/WhatsApp is `Lead.optedOutAt` (STOP-based
opt-out), confirmed by `grep -rn "deriveConsentBasis" src` returning only
`LeadTrustPanel.tsx` and its test, and `grep -n "optedOutAt" src/lib/sending.ts` returning
only the STOP-out check. That means today: a lead captured via the embed widget or added
manually, who never explicitly agreed to receive texts, **can be auto-texted by a sequence
step** the moment email either isn't on file or has already been tried — see the concrete
path traced below — with the only consent basis being "the source string looked like a form
submission."

This is scoped as a **hard blocker before FollowUp can safely auto-text website-form or
manually-entered leads at real volume**, not a should-do-later item — see recommendation.

## Why this specific gap is real, traced end-to-end

1. **The embed widget (`src/app/embed/[businessId]/page.tsx`) collects a phone number with
   zero SMS-specific disclosure.** The form requires "Name, and either an email or phone
   number" (see `handleSubmit`'s validation) — a visitor can submit **phone only, no email**.
   There is no checkbox, no "message and data rates may apply," no opt-out mention, no link to
   terms/privacy near the phone field — the only copy on the page is a "Powered by FollowUp"
   footer link. The lead is created with `source: "Website form"` hardcoded
   (`src/app/api/embed/[businessId]/lead/route.ts:129`).
2. **`AddLeadForm.tsx` (manual entry) collects a phone number with no consent field at all** —
   `source` is a free-text input defaulting to blank (stored as whatever the teammate typed, or
   implicitly "Manual entry" per `deriveConsentBasis`'s own regex). Nothing prompts the person
   adding the lead to confirm the lead agreed to be texted; `deriveConsentBasis()`'s own
   generated copy for this source ("confirm there's a real relationship or prior contact before
   sending automated messages") is a warning that exists **only as UI text on the lead-detail
   page**, read after the fact if a business owner happens to look — it is not a gate anywhere
   in the send path.
3. **CSV import (`src/app/api/leads/import/route.ts`)** defaults `source` to `"CSV import"`
   when no source column is given, same display-only treatment, same absence of any
   consent-capture prompt at upload time.
4. **Sequences fall back to SMS/WhatsApp automatically, source-blind.** In
   `src/lib/sequences.ts`, `detectNonEmailChannel(lead)` is called (importing from
   `src/lib/sending.ts`) whenever `!lead.email || triedEmailAlready`, and the resolved
   `channel` is used to auto-send a freshly AI-drafted message once `assessSendRisk()` scores it
   "low" (`sequences.ts` lines ~479-586) — **with no check of `Lead.source` or any consent
   field anywhere in that path.** A phone-only embed-widget submission (case 1, above) hits
   `!lead.email` on the very first sequence step, meaning the very first automated touch that
   lead ever receives from FollowUp's automation can be an SMS, with the only "consent" being
   an inferred label nobody enforces.
5. **The one place this *is* already handled correctly is `acknowledge.ts`'s instant
   ack** — its own doc comment states the rule explicitly: "only on a channel the lead wrote to
   us on (a web form is acknowledged by email only — we don't text a number nobody texted
   from)." This is the right principle, already implemented, but **it only covers the
   first-touch instant ack, not the ongoing sequence/workflow sends** that come after it (see
   point 4). The inconsistency between these two code paths — one channel-safe, one not — is
   itself worth naming: the fix pattern already exists in the codebase, it just isn't applied
   everywhere a text could go out.
6. **The business owner is warned, generically, about exactly this** —
   `TwilioConfig.tsx` (lines ~378-385): "If you're not sure your leads have opted in to
   texting, check with your own legal counsel." That's the right posture for a $29/mo tool that
   can't vet a business's records, but it's a warning about *the business's* leads in general —
   it does nothing for the specific, traceable case where **FollowUp's own capture form** is the
   thing that collected the phone number with no disclosure at all. That part isn't the
   business's judgment call to get right or wrong; it's FollowUp's own form design.

## TCPA analysis: is a bare form submission "consent" to be auto-texted?

Grade B — cross-checked across FCC's own rule text and multiple independent secondary summaries
agreeing with each other; not run past FollowUp's own counsel, which the existing TwilioConfig.tsx
notice correctly tells the business owner to do for their own records.

- **Two different consent bars exist, and message content decides which one applies**: purely
  informational/transactional messages need "prior express consent," which can be **implied** —
  a consumer "knowingly provid[ing] a phone number to a company in the normal course of
  business, without conditions" — so long as the message "closely relate[s] to the purpose for
  which the number was originally provided" (the FCC's own utility-bill example). **Marketing or
  promotional content, sent via an autodialer/automated system, needs *prior express written
  consent*** — a specific, documented, opt-in agreement — and courts have generally rejected
  implied consent as sufficient for that category.
  Source: [ActiveProspect — TCPA consent: the complete guide](https://activeprospect.com/blog/tcpa-consent/),
  [Ginsburg Law Group — What counts as consent under the TCPA](https://ginsburglawgroup.com/2026/02/what-counts-as-consent-under-the-tcpa-plain-english-guide/) —
  checked 2026-09-13, consistent with each other and with the FCC's own utility precedent both cite.
- **This means the honest answer is genuinely content-dependent, not a flat yes/no** — a purely
  responsive, non-promotional first text to a website-form lead ("Thanks for reaching out — when
  works for a quick call?") is closer to the defensible, implied-consent end of the spectrum; a
  sales-toned automated follow-up sequence (which is what FollowUp's `generateFollowUpMessage`
  produces, per `sequences.ts`) drifts toward the "marketing" end where implied consent is
  weaker ground. **`deriveConsentBasis()`'s flat label ("Submitted a form" → "they gave you
  their contact details expecting a reply") collapses that distinction entirely** — it treats
  every automated text to a website-form lead as equally fine, regardless of what the message
  actually says or how many follow-ups deep the sequence is.
- **The number was given for "a reply," not specifically "a text."** A form that only asks for
  "Phone" with no channel preference doesn't establish that a *text*, specifically, is the
  expected reply channel — a call or email would satisfy "we'll get back to you" just as
  well. This is a real, not hypothetical, gap between what the lead actually agreed to and what
  `deriveConsentBasis()`'s explanation asserts they agreed to.
- **A checkbox cannot be required to submit the form or receive a reply.** 47 CFR
  §64.1200(f) and its "not a condition of purchase/service" requirement means any consent
  mechanism FollowUp adds must be **opt-in and optional**, not a mandatory field gating form
  submission — a required "yes, text me" checkbox to even submit a lead-capture form would
  itself risk violating this rule (as well as suppressing lead volume for no compliance
  benefit, since a business can still reply by phone/email without SMS consent).
  Source: [eCFR — 47 CFR 64.1200, Delivery restrictions](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200),
  [LeadCompliant — Consent Not a Condition of Purchase](https://leadcompliant.com/glossary/consent-not-condition-of-purchase) —
  checked 2026-09-13.

## Campaign Registration analysis: would this survive Twilio/TCR scrutiny?

Grade B — Twilio's own blog/support-doc titles and content returned directly by search,
cross-checked across three independent Twilio-authored or Twilio-focused pages agreeing with
each other on the same requirements; not fetched and read in full (WebFetch unavailable this
session), consistent with the grading convention used in the 2026-09-08 scoping doc.

- **The Campaign's opt-in description must be truthful about the actual collection
  mechanism** — "if you registered for 'account alerts' and start sending marketing, that's a
  violation," and reviewers "check to make sure that the call-to-action and the right
  disclosures are displayed **at the time of phone number collection**." If a business
  registers its Campaign as "website form opt-in" while its actual FollowUp-hosted embed widget
  has no SMS disclosure, checkbox, or terms link at the phone field, **the truthful description
  of what the form actually does is "we collected a phone number with no SMS-specific
  disclosure" — which is a materially weaker opt-in method than what a Campaign reviewer expects
  to see described**, and is the kind of gap that gets a Campaign rejected or later flagged
  during a carrier audit, not just a paperwork nicety.
- **Concretely required at the point of collection, per Twilio's own guidance**: the recipient
  must be told the sender's identity, how the phone number will be used, and the specific
  subject matter of messages; for a website opt-in specifically, the flow should reference the
  site's Privacy Policy and Terms & Conditions URLs; recurring-message programs need a
  message-frequency disclosure and an opt-out mention (STOP). None of this exists on
  FollowUp's embed widget or `AddLeadForm.tsx` today.
- **Twilio explicitly rejects campaigns that make consent a condition of using a service** —
  Twilio error 30923, "Message consent cannot be required for service use," is the productized
  form of the same 47 CFR 64.1200(f) rule above. This cuts against solving this by force — a
  mandatory checkbox to submit the lead form is both a bad TCPA design and a documented Twilio
  rejection pattern — and confirms the checkbox needs to be optional/unchecked-by-default, with
  automation behavior (not form access) responding to whether it's checked.
- **Businesses must retain proof of consent** ("as long as needed... at least until a recipient
  withdraws consent") — today FollowUp stores nothing that could serve as that proof for a
  website-form or manually-entered lead; the only persisted signal is the free-text `source`
  string, which records *where the lead came from*, not *whether they agreed to be texted*.
  Source: [Twilio — Improving your chances of A2P 10DLC registration approval](https://www.twilio.com/en-us/blog/insights/best-practices/improving-your-chances-of-a2p10dlc-registration-approval),
  [Twilio Support — A2P 10DLC Campaign Onboarding Guide](https://support.twilio.com/hc/en-us/articles/11847054539547-A2P-10DLC-Campaign-Onboarding-Guide),
  [LeadCompliant — Twilio opt-in SMS: what you must collect before you send](https://leadcompliant.com/articles/sms-compliance/twilio-opt-in-sms),
  [Twilio API error 30923](https://www.twilio.com/docs/api/errors/30923) — checked 2026-09-13.

## What's actually fine as-is (verified, not assumed)

Not every `deriveConsentBasis()` rule has this problem — worth stating plainly so the fix stays
scoped:
- **Gmail/Outlook, Instagram, Messenger, WhatsApp, inbound SMS/voicemail sources** are all cases
  where the lead contacted the business first, *on that exact channel* — replying there is
  squarely within "closely related to the purpose for which they gave contact info" (they used
  that channel; a reply on it is exactly what they should expect), and each platform's own
  messaging policy (WhatsApp Business messaging policy, Meta Messenger policy) independently
  covers the DM channels. No gap found here.
- **CRM-synced leads** (`CRM_LIKE` regex — Follow Up Boss, HubSpot) reasonably defer to consent
  already established in the source system, per the existing comment — this pass didn't find
  reason to dispute that as a starting assumption, though it's worth noting FollowUp still can't
  verify it, same caveat the code already states.
- **`acknowledge.ts`'s instant-ack channel restriction is a correct, already-shipped mitigation**
  for the *first* automated touch — the gap is specifically that sequences/workflows don't carry
  the same restriction forward.

## Recommendation: this needs a real capture-time consent field, and a real send-time gate — brief for backend-ai-agent + frontend-3d-agent

**Scope: too large and cross-cutting for this audit pass to fix directly** — it touches a schema
change, three capture surfaces (embed widget, manual-entry form, CSV import), and the send-path
gating logic in `sending.ts`/`sequences.ts`. Handing off as a brief, not attempting here.

**The concrete failure scenario to design against**: a visitor submits the embed widget with
phone only, no email, no consent language shown. A sequence enrolls the lead. Step 1 fires:
`!lead.email` is true, `detectNonEmailChannel` resolves to `"text"`, `assessSendRisk` scores the
AI-drafted message "low," and it auto-sends — the lead receives an unsolicited automated text
they never agreed to receive, and the business's Campaign Registration (if it truthfully
describes its actual opt-in method) either gets flagged/rejected by TCR, or — if it inaccurately
describes a checkbox/disclosure that doesn't exist — is one carrier audit away from being pulled
for a truthfulness violation.

**What to build:**

1. **A real, persisted consent signal — not a smarter regex on `source`.** `deriveConsentBasis()`
   cannot be fixed by pattern-matching harder; the underlying problem is missing data, not
   misclassified data. Add something like `Lead.smsConsent: DateTime | null` (timestamp, not a
   bare boolean — consent proof needs a "when," per the retention requirement above) set at the
   moment of capture, distinct from `Lead.source`.
2. **Embed widget (`src/app/embed/[businessId]/page.tsx`)**: an unchecked-by-default checkbox
   near the phone field, plain-language copy disclosing the business name, that they may receive
   automated text messages, message frequency varies, msg & data rates may apply, reply STOP to
   opt out, with a link to the business's privacy/terms if one exists. **Must not be required to
   submit the form** (47 CFR 64.1200(f) / Twilio error 30923, above) — leaving it unchecked
   should still let the lead through with `smsConsent: null`, just without SMS eligible as an
   automation channel. This is real design/UX work (copy, placement, not breaking the widget's
   current minimal feel) — flagging for frontend-3d-agent to design within the existing
   design-brain rather than bolting on generic legal boilerplate.
3. **`AddLeadForm.tsx` (manual entry)**: same optional checkbox, phrased for a teammate adding a
   lead on someone else's behalf ("This lead has already agreed to receive texts from your
   business") — defaults unchecked, same effect.
4. **CSV import (`src/app/api/leads/import/route.ts` + its upload UI)**: a per-row checkbox isn't
   feasible for bulk data — instead, a **one-time attestation checkbox at upload time**
   ("I confirm the phone numbers in this file belong to people who have already agreed to
   receive texts from this business"), recorded via `recordAudit` for the batch. If unchecked (or
   if the CSV has no explicit consent column), imported leads get `smsConsent: null`, same
   downstream effect as the other two surfaces — consistent with `deriveConsentBasis()`'s
   existing (currently unenforced) instinct that bulk-imported consent needs confirming, not
   assuming.
5. **The actual gate, backend-ai-agent**: extend `detectNonEmailChannel` (or its caller in
   `sending.ts`/`sequences.ts`) so that when a lead's `source` matches the website-form/manual/CSV
   buckets **and** `smsConsent` is null, SMS/WhatsApp is treated as **not a reachable channel for
   automated sends** — same effective treatment as "no phone on file" today — while still leaving
   the number visible for a human to call or text manually from the lead-detail page (this is
   about gating *automation*, not hiding data from the business owner). A lead's own **inbound**
   reply on SMS/WhatsApp should still establish fresh, direct consent going forward — this mirrors
   the "texted your number" rule `deriveConsentBasis()` already gets right, so the gate should
   clear itself the moment the lead texts in, not require the business to retroactively check a
   box for them.
6. **`LeadTrustPanel`/`deriveConsentBasis()`**: once `smsConsent` exists, the website-form/manual
   labels should read differently depending on whether it's set — "Submitted a form — agreed to
   texts" vs. "Submitted a form — no text consent captured, calls/email only" — so the trust panel
   reflects the real gate instead of the current blanket assumption.
7. **Feed this into the upcoming A2P Campaign Registration UI** (per
   `2026-09-08-twilio-a2p-self-serve-api-scoping.md`'s `Usa2p` consumer-opt-in-description field):
   once the above ships, that registration flow should populate/suggest the opt-in description
   from the business's *actual* capture-time consent copy (not a generic template), and should
   warn a business if it has leads flagged for auto-SMS eligibility whose `source` is
   website-form/manual/CSV with no `smsConsent` recorded — surfacing exactly the mismatch this
   doc found, at the moment it matters (registering with Twilio), not buried in a lead-detail
   panel nobody's required to read.

## What I did not check

- FollowUp's actual current customers' real-world exposure (whether any live business has
  already auto-texted a website-form lead who never consented) — this was a code-path/policy
  audit, not a production-data query, and querying live lead data wasn't in scope here.
- State-specific "mini-TCPA" statutes (Florida's FTSA, Oklahoma's, Washington's) which in some
  cases impose stricter consent/disclosure requirements than federal TCPA — flagging as a real
  gap in this research, not just an omission, since FollowUp's customers could be in any state.
- Twilio's live `Usa2p` API schema fields in a real sandbox call (relying on the 2026-09-08
  scoping doc's secondary-source findings on that resource, not independently re-verified this
  session).
- This was not run past FollowUp's own counsel — per the existing `TwilioConfig.tsx` notice's own
  correct instinct, that's the right next step before finalizing checkbox copy, not something to
  finalize from web research alone.
