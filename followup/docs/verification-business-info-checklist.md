# What to gather before submitting Meta Business Verification & Twilio's ISV registration

A pure checklist, not draft text (that's `channel-verification-submissions.md`) —
the point of this one is to collect the actual documents and facts *before*
sitting down to fill in either form, so the submission itself is copy-and-paste
instead of a scavenger hunt. Sourced from
`research/integrations/2026-09-10-meta-google-verification-playbook.md` §1.7
and `research/integrations/2026-09-08-twilio-a2p-self-serve-api-scoping.md`.

Two separate registrations, gathered once each — neither is per-customer here;
this is what **FollowUp itself** (the business behind the app) needs to submit.

---

## A. Meta Business Verification (gates Instagram DMs + Messenger + Lead Ads, app-wide)

### 1. Decide the exact legal name first — everything else has to match it

Per §4.6 of the playbook: the legal name on the business registration, the name
typed into Meta Business Manager, the Meta app's display name, the Google OAuth
app name, the homepage `<title>`, and the privacy policy's entity name should
all be the *same string*. Name mismatch is the single most-cited Meta BV
rejection cause. Pick the string now, before registering anything, and use it
everywhere below.

### 2. Register the business (if not already done)

- [ ] **Ontario Business Name Registration** (the document formerly called the
  Master Business Licence) at ServiceOntario — **~CAD $60, valid 5 years**.
  Needed because "FollowUp" isn't your own full legal name. Use the exact
  legal name decided in step 1.
  Link: ServiceOntario's business registration portal (search "Ontario
  Business Name Registration" — the playbook couldn't confirm a direct URL).

### 3. Gather two documents (Meta typically wants one proving legal name, one proving address/phone)

- [ ] **Document 1 — legal name.** The Ontario Business Name Registration
  certificate from step 2 satisfies this (Meta's accepted-document category:
  "Business registration or licence document").
- [ ] **Document 2 — address & phone.** A **business** bank statement (account
  in the registered business name, not your personal name) or a CRA
  business-number / GST-HST registration document. **Do not use a personal
  utility bill** — Meta requires the utility account holder to be the business,
  not an individual, even for a sole proprietor.
- [ ] Confirm both documents are **unexpired**, **issued by the actual
  authority** (not self-filed/self-created), and in **English or French**.

### 4. Business contact info that must match Business Manager exactly

- [ ] **Business-domain email** — set up `verification@followupbase.io` (a
  forward-to-personal-inbox alias is enough) *before* submitting. Free-email
  submissions (Gmail/Outlook) go to a slower queue and are rejected more often.
- [ ] **Business phone number** — must appear on one of the two documents above,
  or be evidenced by them. A personal mobile is not confirmed as acceptable by
  itself (playbook flags this UNCONFIRMED) — safest to have it appear on the
  bank statement or registration document.
- [ ] **Business address** — the one on the registration/bank document; this is
  what goes into Business Manager.

### 5. Website checks (Meta reviews the live site during verification)

- [ ] `followupbase.io` resolves over **HTTPS** at review time (a 404 or
  outage during review is a listed rejection cause).
- [ ] Domain has been registered **≥7 days** before submitting.
- [ ] Business name is visible in the homepage `<title>`.
- [ ] Footer has at least one contact element (email, phone, or address).

### 6. Before clicking submit

- [ ] Check the Meta App Dashboard's verification flow for an **individual/
  ID-based** option instead of full business verification — unconfirmed
  whether this exists for the Graph API platform (as opposed to Meta
  Horizon), but worth 15 minutes to check since it would skip everything
  above if available.
- [ ] Fill in the **Data Deletion Callback/Instructions URL** field with
  `https://followupbase.io/privacy` — App Review cannot be submitted without
  this field set, separately from Business Verification itself.
- [ ] **Do not resubmit the same day** if rejected — wait ~24h and fix the
  specific flagged item first; same-day resubmissions are reported to get
  auto-flagged.

---

## B. Twilio ISV registration (FollowUp's own Primary Customer Profile — gates every future customer's A2P 10DLC SMS)

This is a **prerequisite for everything else A2P-related** — Twilio's docs
state FollowUp's own Primary Customer Profile must reach "Twilio Approved"
status with an ISV/Reseller business identity before any customer (Secondary
Customer Profile) can be registered at all.

### 1. Business identity info Twilio's Trust Hub will ask for

- [ ] Same legal business name as decided in step A.1 (consistency helps
  nothing gets flagged, though this isn't a stated hard requirement the way
  Meta's name-matching is).
- [ ] **Business registration document** — the same Ontario Business Name
  Registration from A.2 should cover this.
- [ ] **EIN / Canadian equivalent business number** — for a Canadian sole
  prop this is typically the **CRA Business Number (BN)**; register for one
  free via CRA if you don't already have one (needed for the GST/HST document
  in A.3 anyway, so this can be one trip).
- [ ] Registered business address (same as A.4).
- [ ] A contact person's name, email, and phone at the business.

### 2. Business identity *type* to select

- [ ] **"ISV Reseller or Partner"** — not a plain single-business type. This is
  what unlocks creating Secondary Customer Profiles for future customers via
  API rather than registering FollowUp as if it were the only sender.

### 3. What this does *not* require yet

- No per-customer information needs to be gathered now — that's a future
  in-app collection form (legal name, EIN, address, and the TCPA consent
  description for each customer business), which is a build task, not
  something to prep by hand today. The A2P scoping research flagged Twilio's
  **Starter Brand** tier (free registration + free monthly campaign fee, for
  businesses under 3,000 SMS/day on ≤5 numbers) as the right default for
  FollowUp's actual customer size — worth defaulting new customers into that
  tier once the in-app flow exists, rather than full Standard registration.

### 4. Before starting

- [ ] Confirm whether Twilio's ISV onboarding requires a sales/partnership
  conversation before API access is granted — the scoping research didn't
  confirm this either way. Worth a quick check with Twilio support or your
  account rep before assuming this is a pure self-serve API flow.

---

## What this checklist deliberately leaves out

- **Google OAuth verification** — no business/legal documents needed there
  (it's domain + branding verification, not entity verification); see
  `channel-verification-submissions.md` §0 for what that path actually needs.
- **CASA** (the $540+/yr security assessment gmail.readonly triggers) — no
  business documents involved, just infrastructure/security questionnaire
  answers; deferred per the playbook's recommendation unless `gmail.readonly`
  is actually shipped.
- **Per-customer WhatsApp/A2P registration** — that's each future customer's
  own paperwork, not FollowUp's; the product-side work (an in-app collection
  form) is a build task tracked separately, not something this checklist can
  front-load by gathering documents today.
