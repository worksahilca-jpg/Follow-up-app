# Twilio A2P 10DLC self-serve registration: does a programmatic API exist, and what would a guided in-app flow take?

**Date:** 2026-09-08
**Scope:** `research/integrations/2026-09-08-channel-unblocking-requirements.md` flagged that
`src/components/TwilioConfig.tsx` today only links out to Twilio's own console
(`twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart`) for A2P 10DLC registration — no
in-app flow. This is scoping only: does Twilio expose an API FollowUp could build a guided flow
around, and roughly what would that take? WebFetch still blocked; findings are WebSearch-snippet
sourced against Twilio's own docs pages (titles/URLs returned directly from twilio.com, which is
a stronger source than the usual third-party aggregator, but still not a page read directly).
*Graded B throughout — primary-vendor documentation URLs and endpoint names returned directly by
search, cross-checked across multiple twilio.com doc pages agreeing with each other, but not
fetched and read in full.*

## Yes — full programmatic registration exists, and it's built specifically for FollowUp's shape of business (an ISV/platform registering many customers)

Twilio has a documented **ISV (Independent Software Vendor) onboarding path** distinct from a
single business registering itself — this is the exact model FollowUp needs (one FollowUp Twilio
account registering many customer businesses), not a workaround. Key pieces, all with real REST
endpoints:

1. **Trust Hub API — Customer Profiles.** FollowUp would hold one **Primary Customer Profile**
   (its own business identity, set once, "ISV Reseller or Partner" business-identity type) and
   create one **Secondary Customer Profile** per customer business via API
   (`POST` to the Trust Hub REST API's profile-creation endpoint — "API: Create a Secondary
   Customer Profile" is a named, documented Twilio doc page). This profile holds the customer's
   business info (legal name, EIN/tax ID, address, etc.).
2. **BrandRegistrations resource (Messaging API).** `POST` creates a `BrandRegistration` — this
   submits the customer's Brand for vetting by The Campaign Registry (TCR), the actual industry
   body behind A2P 10DLC. Documented at `twilio.com/docs/messaging/api/brand-registration-resource`.
3. **Usa2p resource (Campaign registration, Messaging API).** `POST
   https://messaging.twilio.com/v1/Services/{MessagingServiceSid}/Compliance/Usa2p` creates the
   Campaign tied to a Brand — this is the step that actually authorizes a specific use case
   (e.g., "customer care," "mixed") to send traffic. Required fields include a campaign
   description (40-4096 chars) and an explicit consumer opt-in description. Submitting this
   incurs the real per-campaign fee.
4. **Starter Brand API — the most relevant single finding for FollowUp specifically.** Twilio
   offers a lighter-weight **Starter Brand** registration path (a documented, GA'd API —
   "Starter Brands API now available for A2P 10DLC registration of ISV customers," per Twilio's
   own changelog) for customers sending **fewer than 3,000 daily SMS/MMS segments** over **five or
   fewer** 10-digit long codes. **Twilio covers the Starter Brand registration cost and the
   monthly campaign fee for these** — i.e., no separate Brand/Campaign fee passed to the end
   customer at this volume tier. This maps almost exactly onto FollowUp's actual customer
   profile: a solo contractor or small team sending nowhere near 3,000 messages/day on one phone
   number. A guided in-app flow could default new customers into Starter Brand and only route
   them to full Standard registration once their usage actually crosses the threshold.
5. **A sandbox exists for building/testing this without live fees.** Twilio documents a "Create
   Mock US A2P 10DLC Brands and Campaigns" endpoint specifically for development/testing —
   meaning FollowUp could build and test the whole flow before it touches a real customer's
   identity or incurs real registration fees.

## What this would take to build, roughly

This is a real build, not a thin wrapper — three layers of actual work:

- **One-time, FollowUp-side setup:** get FollowUp's own Primary Customer Profile to "Twilio
  Approved" status with an ISV/Reseller business identity — a prerequisite the docs state
  explicitly before any Secondary Profile creation is possible. This is analogous in shape (though
  smaller in scope) to the Google OAuth app-verification one-time gate already documented in the
  companion channel-unblocking doc — a real approval step with Twilio, not just a code change.
- **Per-customer data collection UI:** a form inside `TwilioConfig.tsx` (or a new onboarding step)
  collecting the legal business info Trust Hub/TCR require (legal name, EIN, address, business
  type, and — critically for the Campaign step — an explicit description of how the customer's
  leads consent to being texted, which ties directly into the TCPA-consent messaging the component
  already displays as a warning today).
- **API integration + status polling:** calls to create the Secondary Profile → Brand → Campaign
  in sequence, each with its own async vetting status (Brand vetting can return a score/outcome in
  minutes-to-hours; Campaign vetting and carrier-specific review, especially AT&T's, takes
  materially longer per the prior compliance doc's 10-15+ day / 2-4 week figures) — meaning the
  UI needs a real "registration in progress, check back" state, not a synchronous submit-and-done
  form. Twilio's documented 1-request/second rate limit on Brand/Campaign endpoints is a minor but
  real constraint on any bulk-migration tooling for existing customers.
- **Starter-vs-Standard branching logic:** deciding programmatically (or defaulting all new
  signups to Starter, escalating only on volume) which registration tier a given customer needs —
  this is genuinely new product logic, not just form-filling.
- **Ongoing status surfacing:** the registration outcome (approved/rejected/pending, and *why* on
  rejection) needs to flow back into the UI so a business isn't stuck wondering why texts aren't
  arriving — this is the actual product gap the compliance doc named ("an unregistered Twilio
  number can look 'Connected' here while its messages quietly never reach anyone").

## Bottom line for scoping purposes

**Not a build-or-don't-build blocker — Twilio's API fully supports it, including a low-friction,
no-extra-fee tier (Starter Brand) that fits FollowUp's actual customer size well.** The real cost
is (a) FollowUp's own one-time ISV/Reseller approval with Twilio, which has its own lead time not
yet researched here, and (b) the per-customer async, multi-step nature of Brand→Campaign vetting,
which means the UI has to manage a pending state gracefully rather than treat this as a simple
settings toggle. This lines up with Rule 3 (trust ships like a feature) more than Rule 6 (moat) —
it's closer to table-stakes credibility work (a customer shouldn't have to leave the app and
self-serve Twilio's console to make their own texts actually deliver) than a defensible
differentiator, though a smooth guided flow here could plausibly become a real point of
comparison against competitors who also punt this to "read Twilio's docs yourself."

## What I did not check

- FollowUp's own current Twilio account type/business-identity status — whether it already
  qualifies as, or has applied for, "ISV Reseller or Partner" is a code/account fact this pass
  didn't check (out of scope — no code changes made per instructions, and this wasn't visible in
  `TwilioConfig.tsx` alone).
- Exact pricing for Standard-tier Brand/Campaign registration once a customer exceeds the Starter
  Brand volume threshold (the prior compliance doc's ~$4-48 Brand / ~$15/mo+surcharge Campaign
  figures still stand as the best available numbers, not re-verified here).
- Whether Twilio's ISV onboarding APIs require a sales/partnership conversation with Twilio before
  API access is granted (some ISV-tier Twilio features gate behind account-team approval) — this
  wasn't confirmed either way and would matter for a realistic timeline estimate.
