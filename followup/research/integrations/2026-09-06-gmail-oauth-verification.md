# Gmail OAuth (Google Cloud) — consent screen verification production readiness

Checked: 2026-09-06. Current wiring: `src/lib/integrations/gmail.ts` is real — full OAuth2 code
exchange, refresh-token storage, `fetchSalesConversations()` and `sendEmail()` calling the live
Gmail API, plus Calendar API on the same connection. Confirmed via this session's context: the
Google Cloud OAuth consent screen is still in **Testing** publishing status.

## Hard blocker before this can be real at volume

### The 100-test-user cap is a real ceiling, not a formality
While the OAuth consent screen is in Testing status, Google hard-caps the app at **100 authorized
test users total** — every business that connects Gmail counts against this. FollowUp is a
multi-tenant SaaS meant to onboard real customers past that number, so this is a genuine launch
blocker for growth, not just a cosmetic warning. Additionally, test-user authorizations **expire
after 7 days**, at which point re-consent is required — meaning any Testing-mode customer's Gmail
connection would silently need re-auth weekly, which reads as a broken/unreliable connection to a
customer who doesn't know why.
Source: https://www.unipile.com/google-oauth-100-user-limit/ , corroborated by Google's own support
doc: https://support.google.com/cloud/answer/15549945

### Every new (non-test) user sees Google's unverified-app interstitial
Before reaching the FollowUp consent screen, a non-test-user is shown Google's own "This app isn't
verified" warning page first, requiring an extra "Advanced" click-through to proceed — a real
trust/conversion hit during onboarding, and this is a difference in kind (Testing mode isn't just
"unverified for a while," it's the mechanism that produces this specific warning screen).
Source: https://support.google.com/cloud/answer/7454865

### The scopes FollowUp requests are exactly the ones that require the heaviest verification path
`gmail.ts`'s `SCOPES` constant requests `gmail.readonly` (restricted scope), `gmail.send`
(sensitive scope), `calendar.events` (sensitive), and `userinfo.email` (non-sensitive). Google
classifies scopes into three tiers with different verification requirements:
- **Sensitive scopes** (`gmail.send`, `calendar.events`): require app verification (branding
  review, justification of use, privacy policy, homepage) but not a security assessment.
- **Restricted scopes** (`gmail.readonly`): require verification **and** an annual third-party
  security assessment (Google's CASA program) before the app can be used in production with more
  than the 100-test-user cap.
Source: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification

**What the CASA security assessment actually involves and costs:** CASA (Cloud Application
Security Assessment) tiers scale with what the assessment covers. For an app of FollowUp's shape
requesting `gmail.readonly`, Google typically requires **Tier 2** — a lab-validated vulnerability
scan performed by a Google-approved third-party assessor against the OWASP ASVS control set.
Pricing across providers researched: roughly **$540-$1,800** per assessment (multiple named
vendors — TAC Security ~$675-855/year, NCC Group $1,200+, NetSentries $900-1,500), done annually
going forward, not once.
Source: https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option ,
https://tacsecurity.com/esof-appsec-ada-casa-faqs/ (cross-checked, both list Tier 2 as the
applicable tier for restricted-scope apps of this size, with reasonably consistent pricing bands).

**Realistic timeline:** Brand/OAuth-screen verification alone (if branding is already correct) can
clear in ~2-3 business days. But the full cycle for a first-time submitter needing the CASA
assessment — branding review, then commissioning and completing the assessment, then remediating
whatever the assessor flags, then Google's final sign-off — commonly runs **6-12 weeks end to
end**, per a Nylas provider-integration guide aimed at exactly this kind of email-API SaaS.
Source: https://developer.nylas.com/docs/provider-guides/google/google-verification-security-assessment-guide/

**Recommendation:** Because `gmail.readonly` is the expensive scope here (it's what triggers CASA,
not `gmail.send`), it's worth backend-agent/manager-agent explicitly deciding whether FollowUp
needs read access to the *entire* inbox via `gmail.readonly`, or whether a narrower approach
(e.g. `gmail.metadata`, or `gmail.modify` scoped via label-based filtering, or the
`gmail.addons.current.message.readonly` add-on scope) could satisfy `fetchSalesConversations()`'s
actual need without pulling in the restricted-scope/CASA requirement. This is exactly the kind of
tradeoff worth surfacing before committing to the 6-12 week/CASA-cost path rather than after.
I did not verify from Gmail API docs directly whether a narrower scope covers FollowUp's actual
read pattern (needs a look at what `fetchSalesConversations()` actually queries) — flagging as an
open question for backend-agent, not a settled recommendation.

## Should do before scale, not before launch
- **Homepage and privacy-policy requirements**: verification requires a live privacy policy (already
  exists at `src/app/privacy/page.tsx`, and its own comment notes it's there partly *for* OAuth
  verification — good, this groundwork is already done) and an app homepage that matches the
  domain used in the OAuth client. Confirm the OAuth client's authorized domain matches whatever
  production domain (`followupbase.io` vs. the Vercel URL) is actually live before submitting for
  verification — resubmitting due to a domain mismatch adds a full extra review cycle.
- **Gmail API sending/reading quotas**: per-user Gmail API quota is 1,000,000,000 quota units/day
  at the project level with per-method costs (e.g. `messages.send` = 100 units, `messages.list` =
  5 units) — this is generous enough that FollowUp is extremely unlikely to hit it at current or
  near-term scale; not a blocker, just worth backend-agent knowing the numbers exist if scoring +
  polling ever runs much more aggressively per lead.

Sources checked 2026-09-06:
- https://www.unipile.com/google-oauth-100-user-limit/
- https://support.google.com/cloud/answer/15549945
- https://support.google.com/cloud/answer/7454865
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option
- https://tacsecurity.com/esof-appsec-ada-casa-faqs/
- https://developer.nylas.com/docs/provider-guides/google/google-verification-security-assessment-guide/
