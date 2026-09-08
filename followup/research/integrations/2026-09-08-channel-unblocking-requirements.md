# Channel unblocking (task #65) — Google OAuth, Twilio A2P, WhatsApp templates, Meta App Review

Checked: 2026-09-08. Consolidates and cross-references prior single-integration research
(`2026-09-06-gmail-oauth-verification.md`, `2026-09-06-twilio-sms-compliance.md`,
`2026-09-06-whatsapp-business-production-readiness.md`,
`2026-09-06-instagram-meta-business-verification.md`) into one side-by-side view for task #65,
plus new research this session on Facebook Messenger's App Review specifically (not previously
covered — the existing Instagram doc only covers `instagram_business_manage_messages`, and
Messenger/Lead Ads capture shipped later, commit 1209218). WebFetch is blocked; everything here
is WebSearch-snippet-sourced. Where a claim was already graded in a prior doc, that grade and
citation are carried forward rather than re-derived.

## At a glance

| Blocker | What's required | Realistic timeline | Who bears it |
|---|---|---|---|
| Google OAuth verification (Gmail) | Branding review + CASA Tier 2 security assessment (restricted `gmail.readonly` scope) | 6-12 weeks first time; ~2-3 days if only branding | FollowUp, once, app-wide |
| Twilio A2P 10DLC | Brand + Campaign registration per business, TCR + carrier vetting | 2-6 weeks; Brand fast, Campaign 10-15+ days, AT&T review adds 2-4 weeks | Each customer business |
| WhatsApp template approval | Per-template ML content review | 15-30 min typical; rejections re-reviewed same-day | Each customer business (per template) |
| Meta App Review — Instagram | `instagram_business_manage_messages` (sensitive/scrutinized scope) + Business Verification | 4-8+ weeks first submission, expect 1+ revise cycle | FollowUp, once, app-wide |
| Meta App Review — Messenger/Lead Ads | `pages_messaging`, `pages_show_list`, `leads_retrieval` (+ `business_management` dependency) | ~2-4 weeks per Meta's standard SLA; less scrutinized than Instagram's DM scope per available signal, not independently confirmed | FollowUp, once, app-wide |

## 1. Google OAuth app verification (Gmail) — see full detail in `2026-09-06-gmail-oauth-verification.md`

No new research this session; carrying forward the prior doc's findings as still current:
- 100-test-user cap while in Testing mode; test-user grants expire after 7 days (silent re-auth
  churn for any customer connected under Testing status).
- `gmail.readonly` is a **restricted** scope requiring both verification and an annual CASA Tier 2
  third-party security assessment (~$540-$1,800/year, multiple named vendors).
- Realistic timeline: 6-12 weeks end-to-end for a first-time submitter needing CASA; 2-3 days if
  only the branding/consent-screen review were needed (it isn't, given the scope mix).
- **Common rejection/pitfall already flagged**: consider whether `gmail.readonly` (the expensive,
  CASA-triggering scope) is actually necessary versus a narrower scope — this is the single
  highest-leverage decision for cutting the timeline, not a paperwork fix.
Source (carried forward, graded B in the original doc): https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification ,
https://developer.nylas.com/docs/provider-guides/google/google-verification-security-assessment-guide/

## 2. Twilio A2P 10DLC — see full detail in `2026-09-06-twilio-sms-compliance.md`

No new research this session; carrying forward:
- Unregistered 10DLC traffic is **blocked outright** by all three major US carriers, not just
  throttled — a live-today problem for any connected Twilio number sending automated texts.
- Two-step registration per business: Brand (minutes-24h, ~$4-48) then Campaign (10-15+ days,
  ~$15/mo + per-segment surcharges). AT&T runs its own independent 2-4 week manual review on top.
- Realistic timeline: 3-6 weeks end-to-end, per business, not a one-time platform-level fix.
- **Common pitfall already flagged**: this is per-business, not one-time for FollowUp — today's
  `TwilioConfig.tsx` has no registration path at all, which is the actual product gap, not just a
  compliance detail.
Source (carried forward, graded B): https://support.twilio.com/hc/en-us/articles/4405758341659 ,
https://www.telphiconsulting.com/blog/twilio-a2p-registration-timeline

## 3. WhatsApp Business template message approval — see full detail in `2026-09-06-whatsapp-business-production-readiness.md`

No new research this session; carrying forward:
- Template approval is **per-template, automated, and fast** — 15-30 minutes via Meta's
  ML-assisted review, nothing like the App Review process below. This is the good-news item on
  this list.
- Common rejection reasons (cross-checked across two sources in the prior doc): marketing-toned
  language inside a "utility"-category template (most-cited cause), formatting/variable-count
  mismatches, near-duplicate templates. None of these require re-submitting the whole app — just
  the offending template.
- **Separate and more load-bearing gate than the template review itself**: sender/display-name
  verification status caps an unverified WhatsApp sender at 250 business-initiated messages/24h
  regardless of template approval; full Meta Business Verification (2-10 business days once
  submitted correctly) removes that cap. This sits with each customer business under the
  recommended Twilio self-sign-up path, not with FollowUp.
Source (carried forward, graded B/C mix, see original doc for per-claim grading):
https://chati.ai/blog/whatsapp-template-approval-time-2026-common-rejections-how-to-get-approved-faster ,
https://www.twilio.com/docs/whatsapp/self-sign-up

## 4. Meta App Review — Instagram DMs — see full detail in `2026-09-06-instagram-meta-business-verification.md`

No new research this session; carrying forward:
- Gate is Business Verification (paperwork/DNS, ~days) **+** App Review for
  `instagram_business_manage_messages` (weeks, one of Meta's more scrutinized sensitive scopes).
- Realistic timeline: 4-8+ weeks from first submission; first-submission rejection is described as
  the norm rather than the exception for this specific scope.
- Common rejection reasons already flagged: legal-name mismatch between document and Business
  Manager (single most-cited cause), non-HTTPS/unreachable website, blurry document scans,
  unauthorized representation. Do not resubmit same-day after rejection — same-day resubmissions
  reportedly get auto-flagged.
- **This is a one-time, app-wide gate** (one FollowUp Meta app submission covers every customer's
  Instagram connection), not per-business — the good structural news buried in an otherwise slow
  process.

## 5. Meta App Review — Facebook Messenger + Lead Ads (new research this session)

Not previously covered in the corpus. Relevant because commit 1209218 ("Facebook Messenger DMs +
Facebook Lead Ads capture") shipped after the 2026-09-06 Instagram-only research pass, and uses a
different, though related, permission set: `pages_messaging` (Messenger DM send/receive),
`pages_show_list` (enumerate Pages the user manages, needed for the connect flow), and
`leads_retrieval` (fetch Lead Ads form submissions), with `business_management` as a stated
dependency for all three under Facebook Login for Business. **[Grade C — sourced from a
developer-forum thread and two blog write-ups, not Meta's docs directly.]**

- **App Review is required only for Advanced Access** (needed to message people who aren't
  FollowUp's own test users/Page admins) — an app operating only on Pages the developer account
  itself manages doesn't need review at all, which matters for internal testing but not for
  shipping to real customers.
- **No specific timeline figure found for `pages_messaging`/`leads_retrieval` review this
  session** beyond Meta's general standard-permission SLA (~2-4 weeks, the same figure the prior
  Instagram doc cited for "standard permissions" as distinct from the slower
  `instagram_business_manage_messages`). Whether Messenger/Lead Ads review is meaningfully faster
  than Instagram's DM scope in practice was not confirmed — flagging as an open question rather
  than asserting it, despite one search summary characterizing Instagram's DM scope as the more
  "sensitive, more scrutinized" one by comparison. **Do not plan around Messenger being
  meaningfully faster without direct confirmation.**
- **Common rejection reasons for Meta App Review generally** (not Messenger-specific, but
  directly applicable): the demo screencast is the single most-cited failure point — reviewers
  reject vague product walkthroughs that never clearly show the exact permission being exercised
  end-to-end (login → account connection → the specific feature using that data), and a mismatch
  between what the screencast shows and what the written use-case description claims is treated
  as its own rejection reason. Practical implication for FollowUp: the App Review submission
  needs a screencast that shows, concretely, a lead's Facebook Page comment/DM triggering
  FollowUp's Lead Ads/Messenger capture and a real outbound message being sent — not a generic
  product tour — with the use-case text describing exactly that flow. **[Grade C — two blog
  sources, consistent with each other but both vendor/practitioner blogs, not Meta's own review
  guidelines page.]**
- **Same underlying Business Verification** that gates Instagram DM access also gates
  `pages_messaging`/`leads_retrieval` Advanced Access (it's a Business Manager-level primitive,
  not per-product) — per the WhatsApp doc's finding that Business Verification is shared across
  products within one Meta Business Manager account. Since FollowUp's Business Verification is
  presumably already cleared or in progress for Instagram, **this specific gate should not need
  to be redone for Messenger/Lead Ads** — only the separate App Review submission for the new
  scopes does.

Sources (new this session, all secondary/unverified against Meta's own docs):
https://developers.facebook.com/community/threads/394417879987788/ ,
https://singhamandeep.com/facebook-page-api-permissions-app-review/ ,
https://singhamandeep.com/meta-app-review-screencast-why-your-demo-video-gets-rejected-2026/ ,
https://woopsocial.com/blog/meta-app-review-rejected-2026-fix-guide

## Net read for task #65

Of the four, **WhatsApp template approval is not actually a blocker in any meaningful sense** —
it's fast and automated, and the real gate on WhatsApp volume is sender verification (covered
above), not templates. The other three are genuine multi-week blockers, and three of the four
(Gmail, Instagram App Review, Messenger/Lead Ads App Review) are one-time app-wide costs FollowUp
itself bears once, while A2P 10DLC and WhatsApp sender verification are recurring, per-customer
friction that has no one-time fix — worth weighting product/onboarding-UX investment toward the
per-business items (A2P, WhatsApp verification) since the app-wide ones are pure waiting, not
something more engineering effort accelerates.

Sources checked 2026-09-08 (new, beyond the four carried-forward docs):
- https://developers.facebook.com/community/threads/394417879987788/
- https://singhamandeep.com/facebook-page-api-permissions-app-review/
- https://singhamandeep.com/meta-app-review-screencast-why-your-demo-video-gets-rejected-2026/
- https://woopsocial.com/blog/meta-app-review-rejected-2026-fix-guide
