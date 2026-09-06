# Instagram DM (Meta Graph API) — Business Verification production readiness

Checked: 2026-09-06. Current wiring: `src/lib/instagram.ts` is real — HMAC signature validation
of Meta's webhook payloads (`validateMetaSignature`), a single app-wide Meta Developer App
("FollowUp", App ID 2713853435677364), per-business routing by `instagramUserId`. `growth-agent.md`
states Instagram is "blocked on Meta Business Verification, not code" — confirmed accurate; the
code path is real, the account is just capped.

## Hard blocker before this can be real at volume

### What actually clears it: Business Verification + App Review, not just "verify the business"
Because FollowUp's Meta app needs to read/send DMs for Instagram professional accounts it doesn't
own (i.e., its customers' accounts), Meta requires **Advanced Access**, which is gated behind two
things that have to both clear:
1. **Business Verification** (company-level, done once for the FollowUp Meta Business/App account)
2. **App Review** for the specific permission the app uses:
   `instagram_business_manage_messages` (this is the scope that unlocks DM read/send — without it
   the app can authenticate but the messages endpoint returns a permissions error).

Source: https://developers.facebook.com/docs/instagram-platform/overview/ ,
https://singhamandeep.com/instagram-messaging-api-approval-getting-instagram_business_manage_messages-2026/
(cross-checked, consistent on the Advanced Access requirement).

**Business Verification steps (what actually clears it):**
- Submit official business documents (business registration/incorporation doc, tax ID document,
  or utility bill matching the legal business name) — high-res scan or PDF, not a photo of a
  screen.
- **Domain verification** for the business's website — add a DNS TXT record or meta-tag Meta gives
  you, proves domain ownership. Typically resolves in 1-2 business days once submitted correctly.
- Legal business name in the submitted document **must exactly match** the name entered in Meta
  Business Manager — this is called out as the single most common rejection reason in 2026.
- Use a corporate-domain contact email (e.g. an `@followupbase.io` address) rather than a personal
  Gmail — sources note this roughly halves review time versus a personal-email submission, since
  it's a corroborating signal of legitimacy.
Source: https://saveoffice.io/blog/meta-business-verification-documents ,
https://chakrahq.com/article/meta-business-verification-rejected-reasons/ (cross-checked; the two
sources independently list the same top rejection causes — name mismatch, non-HTTPS or broken
website, unauthorized representation, self-created/non-official documents — which is a reasonable
verification signal for research-quality secondary sources).

**Common rejection reasons to preempt before first submission:**
- Website not on HTTPS, or not functioning/reachable at review time (worth confirming
  `followupbase.io` — or whatever domain is registered with Meta — resolves and loads over HTTPS
  before submitting)
- Legal name mismatch between the document and Business Manager
- Blurry/cropped document scans
- Submitting on behalf of a business without documented authorization to represent it
Do **not** resubmit same-day after a rejection — same-day resubmissions reportedly get
auto-flagged; fix the specific flagged item and wait ~24 hours.

**App Review timeline:** standard permissions clear in ~2-4 weeks; `instagram_business_manage_messages`
is called out specifically as one of the slower, more scrutinized sensitive scopes, and a reviewer
request for changes restarts the review clock. Expect first-submission rejection to be the norm,
not the exception, for exactly this permission — plan for at least one revise-and-resubmit cycle.
Source: https://www.getphyllo.com/post/instagram-api-integration-101-for-developers-of-the-creator-economy

## Correction to growth-agent's framing worth flagging explicitly
growth-agent's copy treats this as a single blocker ("Meta Business Verification"), but the real
gate is **Business Verification + App Review together**, and App Review is the slower and less
predictable of the two (Business Verification is mostly a paperwork/DNS exercise measured in
days; App Review for this specific scope is measured in weeks with a real chance of rejection and
resubmission). If growth-agent or anyone else is setting customer/investor expectations on when
Instagram "goes live," the honest estimate is 4-8+ weeks from first submission, not a quick
one-time verification step, and it's a single app-wide gate (one submission unlocks it for every
FollowUp customer's Instagram account, per the one-app-many-businesses architecture already in
`instagram.ts`) — so it's a one-time cost, not a per-business one, which is good news but doesn't
make it fast.

## Should do before scale, not before launch
- **The 25-test-user Development Mode ceiling**: before Business Verification + App Review clear,
  the app can only work with up to 25 manually-added Instagram test accounts. If FollowUp wants
  to demo Instagram DM to real prospective customers before the review clears, each one has to be
  manually added as a test user in the Meta console — worth knowing so it isn't mistaken for a
  bug when a non-test customer's Instagram connection silently fails.
- **24-hour messaging window**: once live, the Graph API only allows free-form replies within
  24 hours of the lead's last inbound DM; after that, only limited "Human Agent" messages are
  allowed (customer-support framing only, 7-day window). This is a real product constraint on
  Instagram-sourced leads — a stale Instagram lead can't be re-engaged with an arbitrary follow-up
  message the way an email or SMS lead can. Worth backend-agent surfacing to frontend-agent so the
  UI doesn't offer "Send now" on an Instagram lead outside that window without at least a warning.
  Source: https://www.blotato.com/blog/instagram-messaging-api

Sources checked 2026-09-06:
- https://developers.facebook.com/docs/instagram-platform/overview/
- https://singhamandeep.com/instagram-messaging-api-approval-getting-instagram_business_manage_messages-2026/
- https://saveoffice.io/blog/meta-business-verification-documents
- https://chakrahq.com/article/meta-business-verification-rejected-reasons/
- https://www.getphyllo.com/post/instagram-api-integration-101-for-developers-of-the-creator-economy
- https://www.blotato.com/blog/instagram-messaging-api
