# Research

Dated findings — what has already been investigated, so it isn't investigated twice.

**Check this index before starting any research.** Seventy-odd write-ups live here, several
of them answering questions that look new and aren't. Re-deriving an answer that's on file
is the most common way to lose a day on this project.

## How this folder works

- **One file per topic, per pass.** Extend with a new dated file rather than rewriting an old
  one, so the history of what was known when stays intact. A finding that was true in
  September and false in November is worth more as two files than as one overwritten one.
- **Sourcing is graded.** Several files carry an explicit confidence grade and a note on what
  could and couldn't be read directly — this sandbox's egress proxy blocks `twilio.com`,
  `developers.google.com` and `developers.facebook.com`, so some research is
  search-snippet-sourced and says so. Trust the grade.
- **Never invent a number.** A statistic with no source is worse than no statistic;
  `market/2026-09-08-62pct-missed-calls-stat-verification.md` exists because a
  widely-repeated figure needed checking before it went near the landing page.

Filenames are dated and descriptive; the notes below are added only where the filename
doesn't carry the finding. A file with no note is not less important.

---

## `integrations/` — what a real integration actually requires

The constraints, verification processes and compliance obligations for each third-party
service. **Read the relevant file before wiring up a channel**, not after it fails review.

| File | |
|---|---|
| `2026-09-06-gmail-oauth-verification.md` | `gmail.readonly` is a **Restricted** scope — the slow verification lane |
| `2026-09-06-instagram-meta-business-verification.md` | |
| `2026-09-06-openai-pricing-data-retention.md` | |
| `2026-09-06-stripe-billing-compliance.md` | |
| `2026-09-06-supabase-postgres-production.md` | |
| `2026-09-06-twilio-sms-compliance.md` | |
| `2026-09-06-voice-ai-and-multilingual-scoping.md` | Why the voice bridge is built in-house rather than on Vapi/Retell/Bland |
| `2026-09-06-whatsapp-business-production-readiness.md` | |
| `2026-09-08-channel-unblocking-requirements.md` | |
| `2026-09-08-meta-business-agent-webhook-behavior.md` | |
| `2026-09-08-meta-conversation-history-pull-api.md` | |
| `2026-09-08-twilio-a2p-self-serve-api-scoping.md` | The ISV path — registering customers' brands via API, and Starter Brand fee coverage |
| `2026-09-10-meta-google-verification-playbook.md` | |
| `2026-09-16-meta-channels-production-audit.md` | |
| `2026-09-16-meta-human-agent-and-quick-replies-api-facts.md` | |
| `2026-09-19-whatsapp-coexistence.md` | Why WhatsApp goes through Meta directly, not Twilio |
| `2026-09-23-meta-app-review-submission.md` | The App Review pack: justifications, shot lists, pre-flight, rejection risks |
| `2026-09-24-sms-from-the-business-own-number.md` | Hosted SMS works for landline/toll-free only — **mobile numbers cannot be hosted**, which is most of the ICP. Recommendation: don't build SMS yet |

## `audit/` — code-level bug findings

Concrete defects found by code-audit and pentest passes, each with the reasoning. Worth
reading before a security or correctness change in the same area — the passes are numbered in
order and later ones assume the earlier fixes landed.

`2026-09-05-code-audit.md` · `2026-09-08-newer-surface-audit.md` ·
`2026-09-08-second-pass-audit.md` · `2026-09-08-third-pass-audit.md` ·
`2026-09-09-fourth-pass-audit.md` · `2026-09-09-fifth-pass-audit.md` ·
`2026-09-09-sixth-pass-audit.md` · `2026-09-09-seventh-pass-audit.md` ·
`2026-09-16-bug-hunt-automation-and-send-engine.md` ·
`2026-09-16-security-audit-auth-tenancy-and-api.md` ·
`2026-09-16-security-audit-meta-surface.md` ·
`2026-09-24-app-review-path-audit.md` — the stored Instagram id is the app-scoped one, so webhooks never match and FollowUp's own sends come back as a lead (F1/F2)
· `2026-09-25-daily-path-bug-hunt.md` — "Send all routine" can re-send the same drafts; a new draft inherits the old risk verdict; approved emails start new Gmail threads

`backend-backlog.md` is the one undated file — a running list rather than a pass.

## `market/` — competitors, pricing, the business case

| File | |
|---|---|
| `2026-09-05-competitor-feature-gaps.md` | Where the "Ponds" shared lead pool came from |
| `2026-09-06-realtor-tool-landscape.md` | |
| `2026-09-07-lead-rescue-gap-and-strategy.md` | |
| `2026-09-07-why-followup-evidence-for-and-against.md` | The honest case against building this, alongside the case for |
| `2026-09-08-62pct-missed-calls-stat-verification.md` | Checking a widely-repeated figure before using it |
| `2026-09-08-missed-calls-126k-stat-verification.md` | Same discipline, second figure |
| `2026-09-08-broader-competitive-landscape.md` | |
| `2026-09-08-pentest-vendor-options.md` | |
| `2026-09-08-pricing-validation-home-services-icp.md` | |
| `2026-09-08-product-direction-synthesis.md` | |
| `2026-09-08-realtor-competitor-refresh.md` | |
| `2026-09-08-soc2-timing-scoping.md` | |
| `2026-09-09-business-model-case.md` | |
| `2026-09-10-first-paying-customers-gta.md` | |
| `2026-09-10-pentest-engagement-scope.md` | |
| `2026-09-10-pricing-and-packaging.md` | |
| `2026-09-11-calendar-booking-source-competitive-check.md` | |
| `2026-09-11-self-hosting-and-custom-voice-ai.md` | |
| `2026-09-11-stripe-tier-billing-implementation.md` | |
| `2026-09-11-tier-pricing-recommendation.md` | |

## `product/` — how the product should behave

| File | |
|---|---|
| `2026-09-09-followup-cadence-best-practices.md` | |
| `2026-09-10-instant-ack-safety-gate.md` | |
| `2026-09-10-ux-simplification.md` | |
| `2026-09-13-landing-page-research.md` | FollowUp's own page audited section by section, with a ranked gap list |
| `2026-09-13-scoring-and-drafting-accuracy.md` | |
| `2026-09-13-usability-and-engagement.md` | |
| `2026-09-14-landing-page-company-strategy.md` | What real companies' landing pages do, as a survey |
| `2026-09-15-ai-cost-per-lead.md` | |
| `2026-09-15-cost-to-serve-one-customer.md` | |
| `2026-09-15-first-run-journey-audit.md` | |
| `2026-09-15-reaching-back-out-to-ignored-leads.md` | |
| `2026-09-15-reactivation-consent-spec.md` | |
| `2026-09-16-first-run-dead-ends-and-time-to-value.md` | |
| `2026-09-16-instagram-getting-a-reply-buttons-and-questions.md` | |
| `2026-09-16-meta-window-close-what-shipped-products-do.md` | |
| `2026-09-16-positioning-after-the-carrier-drop.md` | |
| `2026-09-16-training-data-sources-for-human-texture.md` | |
| `2026-09-16-what-makes-a-short-message-read-as-human.md` | |
| `2026-09-19-multilingual-accuracy-data.md` | |
| `2026-09-24-simplify-the-app.md` | The biggest learning cost is 12 send controls across 4 screens; proposes a 3-item menu and one "Sending" tab. Includes which earlier simplification ideas shipped |

## `customers/` — who this is for

| File | |
|---|---|
| `2026-09-05-icp-pain-and-trust-objections.md` | The ICP: an owner up a ladder. Their business number is their mobile — a fact that has since decided several product calls |
| `2026-09-08-sourcing-multilingual-test-coverage.md` | |
| `2026-09-13-what-leads-actually-say-first-contact-patterns.md` | |
| `2026-09-15-owner-interview-guide.md` | |

## `competitors/` — single-competitor deep dives

`2026-09-13-uplift-ai.md`

---

## Where related knowledge lives instead

- **Design research** is not here — it's in `../../design-brain/research/`, alongside the
  decisions it produced.
- **Operational setup guides** (how to configure Gmail push, Meta OAuth, the least-privilege
  DB role) are in `../docs/`, not here. Research is *what we learned*; docs are *how to do it*.
- **What's open right now** is `../../STATUS.md`.
