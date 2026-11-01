# Platform, legal and trust risks to FollowUp's plan, and the alternatives that reduce them

Researched 2026-11-01. Canada first, then US. This is research, not legal advice: every legal point below needs confirmation by a Canadian lawyer (CASL, PIPEDA, TRESA) and a US lawyer before US expansion.

**How to read the evidence tags.** [S] strong: an official or primary source (Google, Meta, Microsoft, CRTC, RECO, NAR, FTC/FCC rulings). [M] moderate: a law firm or reputable trade press, or several secondary sources that agree. [W] weak: a single vendor, consultant blog, forum post or first-hand anecdote. **Method limit:** this session's network allowlist blocked direct page fetches from developers.google.com, developers.facebook.com, crtc.gc.ca and reco.on.ca. All findings from those sites come from search-engine extracts of the official pages, not from reading the full page. Re-check exact wording before relying on it.

**Internal context** (from `/home/user/Follow-up-app/BRAIN.md`, not external evidence):
- New Gmail users still see Google's unverified-app screen, and FollowUp is capped at 100 users until CASA.
- Existing Gmail connections lasted 13–23 days, so the project is not under Testing-status 7-day expiry.
- Instagram was approved by Meta on Oct 9, 2026.
- The Messenger + Lead Ads review videos (A–E) were planned for submission around Oct 31, 2026.
- Meta "access verification" was submitted Sep 25, 2026, was still "In review" on Oct 20, and has a Dec 18, 2026 deadline before the app is restricted.

**Risk at a glance** (each row is sourced in the sections below)

| Risk | What it requires | Chance it blocks FollowUp | Cheapest way around |
|---|---|---|---|
| Gmail restricted scopes (CASA) | Lab assessment (TAC Tier 2 from about US$540/yr), Google review (about 6 weeks estimate), redone every 12 months. Lifetime cap of 100 users until verified. | **Medium on timing** (Jan 2027 is about 9 weeks away), **low on cost** | Start TAC Tier 2 now. In parallel, build a mode with no restricted scopes: forward lead notifications to an inbound address and send with `gmail.send` (sensitive, no CASA). |
| Meta 24-hour window | No automated message outside 24h. `human_agent` allows 7 days, but humans only. | **Certain** constraint on day-3/7/14/30 DMs (a policy rule, not a review risk) | Capture email or phone inside the first 24h, then run the cadence by email |
| Meta Messenger / Lead Ads review | App Review (vendors report about 20 days per cycle), Business Verification, Advanced Access | **Medium**: each rejection costs a cycle | Get Lead Ads through the CRM or Zapier as a fallback. Access Verification was reportedly retired Oct 9, 2026. |
| CASL | Implied consent for 6 months after an inquiry. Sender ID and a working unsubscribe in every message. Keep consent records. | **Low** if built into the product. Penalties are large but rare. | Consent ledger, auto-expiry at 6 months, a compliant footer, instant STOP |
| US TCPA (texts) | Prior express consent (written consent for marketing) | **High** if US SMS is added without consent capture | Stay on email and DMs in the US until consent capture exists |
| RECO / TRESA | Registrant and brokerage accountable for AI output. Brokerage named exactly as registered in advertising. | **Low**, but brokerage sign-off adds friction | Brokerage name in every signature, an audit log, human approval by default |
| US state chatbot disclosure laws | California, Utah and Maine rules, each with different triggers | **Low–medium** (US only) | A disclosure line, and an honest answer to "is this a bot?" |
| Privacy (PIPEDA, Google Limited Use) | Comparable protection for third-party processing. No training of generalized AI on Gmail data. | **Low**, but a Limited Use breach would end Google verification | LLM terms with no training and no retention, plus a Limited Use statement in the privacy policy |
| Consumer and agent trust | Clear disclosure, a visible path to a human, accuracy | **Medium** (adoption risk, not legal) | Approval-first default, autonomy earned rule by rule |

---

## 1. Google restricted Gmail scopes (CASA): requirements, costs, timelines, caps, and alternatives (narrower scopes, add-on, forwarding, Outlook/Graph, working through the CRM)

### Takeaway
CASA itself is cheap and well-trodden. TAC Security's Tier 2 starts at about US$540 per app per year, and first-hand reports describe weeks, not months. The real constraints are elsewhere:
- **Timing:** Google estimates about 6 weeks for restricted-scope verification, on top of the lab's 1–5 weeks, against a January 2027 deadline.
- **The lifetime cap:** 100 users until verification.
- **Repeat work:** remediation every year.
- **Limited Use:** Google forbids using Gmail data to train generalized AI models.

The cheapest structural way around CASA is to stop *reading* Gmail: forward lead notifications to an inbound address and send with `gmail.send`, which Google lists as sensitive, not restricted. The price is that FollowUp loses automatic visibility of customer replies.

### Cited Findings
**Which scopes trigger what**
- **Restricted scopes:** `gmail.readonly`, `gmail.compose`, `gmail.insert`, `gmail.modify`, `gmail.metadata`, `gmail.settings.basic`, `gmail.settings.sharing` and the full `https://mail.google.com/` scope. [M] — [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa); [Nylas verification guide](https://developer.nylas.com/docs/provider-guides/google/google-verification-security-assessment-guide/)
- **`gmail.send` is listed as *sensitive*.** "Projects requesting only sensitive scopes do not need to undergo a third-party security assessment." However, another table in the same Google guide lists `gmail.send` under "Restricted", so the page contradicts itself. [S, internally conflicting] — [Google Cloud Help: Requesting Minimum Scopes](https://support.google.com/cloud/answer/13807380?hl=en)
- **`gmail.addons.current.message.readonly` (Gmail add-on scope) is sensitive, not restricted.** [S] — [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). Add-on scopes "only apply inside a Workspace add-on's runtime and are not a way for a server-side connector to read mail." [W] — [unified.to Gmail OAuth guide](https://docs.unified.to/skills/gmail-oauth-app/SKILL.md). An add-on that also uses a restricted scope must comply with all restricted-scope rules. [S] — [Gmail add-on scopes](https://developers.google.com/gmail/add-ons/concepts/scopes)
- **The assessment is triggered when restricted-scope data is stored on or transmitted through the developer's servers.** [S] — [Google: Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

**Process and timing**
- **Annual renewal:** apps with restricted scopes must complete a security assessment every 12 months, counted from the effective date of the previous Letter of Validation (LOV). [S] — [Google Cloud Help: Annual Recertification](https://support.google.com/cloud/answer/13463816)
- **Google's own estimates:** about 10 business days for sensitive-scope verification and about 6 weeks for restricted-scope verification. [S] — [Google Cloud Help: FAQ](https://support.google.com/cloud/answer/13463817?hl=en)
- **Self-scan for Tier 2 is no longer an option,** and Google has negotiated a discounted Tier 2 rate with TAC Security. [W; thread is about 2 years old] — [Google Apps Script community thread](https://groups.google.com/g/google-apps-script-community/c/XgsHT2Fr7u8)
- **Tier 2/Tier 3 have reportedly been renamed** to assurance levels AL1/AL2. [W] — [Secusy: CASA AL1 / Tier 2](https://www.secusy.ai/services/casa-al1)

**Cost**
- **TAC Security prices** [M — vendor's own pages via search extract; amounts differ between pages and over time]: Basic Tier 2 is US$540 per app. Premium Tier 2 is listed at $720 on one page and $855 on another. Enterprise Tier 2 (unlimited assessments) is $3,600. Tier 3 is $4,500. Turnaround for Tier 2 is roughly 1–3 weeks. — [TAC Security CASA page](https://tacsecurity.com/google-casa-cloud-application-security-assessment/); [TAC ESOF/ADA CASA FAQ](https://tacsecurity.com/?p=18721)
- **Market range** is about $500–$4,500 per year. [W] — [DeepStrike](https://deepstrike.io/blog/google-casa-security-assessment-2025). The widely repeated $50,000–$75,000 figure "reflects outdated pricing or premium top-tier providers." [W] — [Bright Softwares](https://bright-softwares.com/blog/en/google-workspace/the-50000-gmail-add-on-myth-what-google-s-casa-certification-really-costs); see also the [Switch Labs provider comparison](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option) (about 1.5 years old).

**Real timelines**
- **Guides:** 2–3 weeks for Tier 2 and 4–6 weeks for Tier 3. One assessor advertises 2–5 business days once evidence is ready, and 1–5 weeks end to end for a first submission. [W] — [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa); [Secusy](https://www.secusy.ai/services/casa-al1); [Validic KB](https://help.validic.com/space/VCS/5539037190)
- **Mailneo (first-hand):** the first attempt lapsed. A Tier 2 letter was issued on 31 July 2026 and Google accepted it the next morning. [W] — [Mailneo](https://www.mailneo.co/blog/casa-tier-2-certification)
- **Email Unsubscriber (first-hand):** "a few weeks of infrastructure improvements, paperwork, and back-and-forth with Google and the assessor." [W] — [Email Unsubscriber](https://email-unsubscriber.com/blog/casa-t2-validated)

**Caps for unverified apps**
- **Testing status:** limited to 100 test users. Test-user authorizations, including refresh tokens, expire 7 days after consent. Basic identity scopes are exempt from both limits. [S] — [Google Cloud Help 15549945](https://support.google.com/cloud/answer/15549945)
- **The user cap for *unapproved* sensitive or restricted scopes** "applies over the entire lifetime of the project, and it cannot be reset or changed." Verified apps that request only approved scopes are not capped. A separate rate-limits snippet mentions "100 new users in total" for apps that show the unverified screen. [S] — same source

**Limited Use: the rule that matters for an AI product**
- **No training generalized models on Workspace data:** Google bars transferring Workspace user data to train non-personalized (generalized) AI/ML models. Developers must commit to this in their privacy policies. [S] — [Google Workspace blog: API policy protections](https://workspace.google.com/blog/ai-and-machine-learning/api-policy-protections?hl=en)
- **Google closes the request if it sees such training:** "If an OAuth app plans to use Google Workspace or Photos data to train generalized AI/ML models, the OAuth team will close the request." Apps must attest to Limited Use compliance. [S] — [Google Cloud Help: Application Use Cases](https://support.google.com/cloud/answer/13805798)

**Alternatives: shared pre-verified apps**
- **The Nylas Shared GCP App** has passed Tier 3 CASA, and Nylas handles the annual re-assessments.
  - Users see "Nylas" on the OAuth consent screen.
  - It is an add-on to Nylas *Contract* plans, so pricing goes through sales.
  - Moving users from your own GCP project requires every user to re-authenticate.
  - Nylas notes that Google's exemptions cover apps in "Testing" and apps that access fewer than 100 Gmail accounts.

  [M — vendor docs] — [Nylas Shared GCP App](https://developer.nylas.com/docs/provider-guides/google/shared-gcp-app/); [Nylas forum](https://forums.nylas.com/t/google-verification-requirement-with-nylas-hosted-oauth-for-restricted-scopes/855)
- **Composio** markets a similar "no Google verification on your end" Gmail integration. [W] — [Composio](https://composio.dev/content/ship-gmail-integration-in-minutes)

**Alternatives: Microsoft Graph / Outlook**
- **Publisher verification** needs a verified Partner Center account and an app registered with a work or school account. Apps registered with a personal Microsoft account cannot be verified. [S] — [Microsoft Learn: Publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview)
- **Risk-based step-up consent:** since November 2020, where it is enabled, users cannot consent to newly registered multi-tenant apps that are not publisher-verified, when those apps ask for permissions beyond basic sign-in in other tenants. [S] — same source
- **`Mail.Read` is among the permissions typically restricted** in Microsoft's recommended user-consent policy, which pushes it to admin consent. [S] — [Microsoft Learn: Manage app consent policies](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies)
- **Community reports:**
  - A multi-tenant app with Mail scopes works for personal Microsoft accounts but shows "Need admin approval" to non-admin work accounts. [W] — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5926799/multi-tenant-app-blocks-non-admin-users-with-need)
  - "The publisher verification process can be a blocker" for cross-tenant mailbox access. [W] — [Microsoft Tech Community](https://techcommunity.microsoft.com/discussions/officegraph/getting-403-unauthorized-on-graph-api-mail-access-school-project-with-consent-gi/4425817)

**Alternatives: working through the CRM**
- **GoHighLevel:** community MCP tooling sends SMS, email and conversation messages through the GoHighLevel Conversations API under the `conversations.write` scope. Instagram and Facebook DMs appear in the same Conversations inbox, and replies are limited to the 24h window. [W — third-party tooling and blogs, not GHL docs] — [GoHighLevel MCP (glama)](https://glama.ai/mcp/servers/mastanley13/GoHighLevel-MCP); [ConsultEvo GHL Conversations FAQ](https://consultevo.com/gohighlevel-conversations-faq-how-to/); [SupplyGem](https://supplygem.com/gohighlevel-conversations/)

### Inferences
- **Chance of blocking FollowUp: medium on timing, low on cost.**
  - Today is Nov 1, 2026. Google's own estimate is about 6 weeks for restricted-scope review, and the lab adds 1–5 weeks. A January 2027 deadline is reachable only if the lab engagement starts in the next 1–2 weeks.
  - The risk is a failed first scan that needs fixes. Mailneo's first attempt lapsed.
  - Until verified, the lifetime cap of 100 users is the hard ceiling. It allows a pilot but blocks growth.
- **Cheapest options, ranked:**
  1. **Do Tier 2 with TAC Basic (about US$540–$855 per year) now.** This is the cheapest option if FollowUp must keep reading the inbox to see customer replies. Budget the founder's time for fixes and a written Limited Use statement.
  2. **Build a "no restricted scopes" mode as a hedge.** The realtor sets up a Gmail filter that auto-forwards lead notifications (REALTOR.ca, Zillow, website forms) to a FollowUp inbound address. FollowUp sends as the realtor with `gmail.send`, which is sensitive: about 10 business days of review and no CASA, if the classification holds.
     - FollowUp cannot create that filter for the user, because the `gmail.settings.*` scopes are restricted.
     - To see replies, either the realtor forwards replies too, or messages carry a FollowUp Reply-To address. The Reply-To route changes what the customer sees, which is a trust cost.
     - Confirm the `gmail.send` classification in the Cloud console first, given Google's contradictory table.
  3. **A Gmail add-on.** Its scopes are sensitive, but it runs only while the realtor has a message open. That suits "draft a reply here" but cannot run day-3/7/14/30 automation.
  4. **The Nylas shared app.** It removes CASA work, but has unknown contract pricing, puts Nylas branding on the consent screen (a trust cost against FollowUp's "trustworthy" brand), adds a sub-processor for PIPEDA purposes, and forces a re-authentication migration.
  5. **Route through the CRM (a GoHighLevel Marketplace app).** It reuses GHL's existing platform approvals, but only reaches realtors on GHL. Follow Up Boss capability is unconfirmed.
  6. **Outlook/Graph.** No CASA equivalent was found. However, realtors on brokerage-managed Microsoft 365 tenants may hit "Need admin approval" for `Mail.Read`, which makes the brokerage's IT a gate. Personal Outlook.com accounts look easier. Publisher verification needs a Partner Center account under a work account.
- **Limited Use and the AI model:** "Best AI everywhere" is fine under Limited Use as long as Gmail content is never used to train a generalized model. The LLM provider's API terms must exclude training, and the privacy policy must carry Google's Limited Use language. Without that, verification can be closed outright.

### Gaps
- Google docs could not be fetched directly. It is unconfirmed which tier (AL1 or AL2) FollowUp would be assigned; the assessor and Google decide from scopes and user count.
- `gmail.send`: Google's page lists it as both sensitive and restricted. Check the classification shown in FollowUp's own Cloud console.
- Exactly how the "100 new users" unverified cap and the 100 test-user cap interact is unclear.
- No Reddit or first-hand 2026 cost reports surfaced beyond Mailneo and Email Unsubscriber, and neither stated a price.
- Microsoft: no source found on whether any security assessment is mandatory for Mail scopes. Microsoft 365 App Compliance is believed to be optional; not confirmed.
- Nylas shared-app pricing is not public. Whether the Follow Up Boss API can send email or SMS natively is unconfirmed.

---

## 2. Meta: Instagram/Messenger messaging rules, the 24-hour window and Human Agent tag, Lead Ads `leads_retrieval`, App Review timing and rejection reasons, Tech Provider / Business Verification

### Takeaway
Meta's rules allow FollowUp's core use: an instant AI reply to an inbound DM inside 24 hours. They **do not allow automated day-3/7/14/30 follow-ups in Instagram or Messenger DMs**. Outside the 24-hour window, only a *human* reply under the `human_agent` tag within 7 days is permitted. The follow-up cadence therefore has to move to email (or another consented channel) once a contact is captured.

Lead Ads need `leads_retrieval` at Advanced Access, which takes App Review plus Business Verification. App Review reportedly takes about 20 days per cycle in 2026, and screencast problems are the most common rejection reason.

Meta reportedly retired "Access Verification" for Tech Provider apps on Oct 9, 2026. That may make FollowUp's pending Sep 25 submission and its Dec 18 deadline moot. Verify in the App Dashboard.

### Cited Findings
**Messaging windows and tags**
- **Standard window: 24 hours.** It "may last up to 7 days from that message" when the user's first message follows a click on a Click-to-Messenger or Click-to-Direct ad. [S] — [Meta: Messenger Platform and IG Messaging API policy](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy/)
- **`human_agent` tag:** "allows your app to have a human agent respond to user messages using the human_agent tag within 7 days of a user's message." Allowed usage is human support where the issue "cannot be resolved in the standard messaging window." [S] — [Meta: Instagram Platform overview](https://developers.facebook.com/documentation/instagram-platform/overview)
- **The tag needs approval and excludes automation:** App Review and business verification are required, and Meta "does not allow it for automated messages." [M] — [Outstand](https://www.outstand.so/blog/instagram-dm-api); [Blotato](https://www.blotato.com/blog/instagram-messaging-api)

**Bot disclosure, response time, escalation**
- **Disclosure:** automated experiences must tell users they are talking to an automated service *where applicable law requires it*. This applies at the start of a thread, after a long gap, and when a chat moves from a human to automation. [S] — [Meta policy](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy/)
- **Response time:** bots declared "automated" (not "hybrid" or "human") must respond within 30 seconds. [S] — [Meta: Responsiveness Requirements](https://developers.facebook.com/docs/messenger-platform/policy/responsiveness)
- **Escalation:** apps with an automated experience "should be able to escalate to human agents" through a fallback intent, keyword or quick replies. This is worded as "should," not a hard requirement. [S] — [Meta: Human Agent Escalation](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/human-agent-escalation.md)

**App Review timing and rejection reasons**
- **Timing:** App Review "now takes up to 20 days," roughly double the previous 10. [W] — [Saurabh Dhar](https://www.saurabhdhar.com/blog/meta-app-review-20-days-2026-what-changed)
- **Common rejection reasons for messaging permissions** [W — consultants]:
  - The screencast does not show a real end-to-end DM: a test user sends a message, the app receives it, and the reply is sent through the API.
  - No visible send action.
  - The screencast does not match the stated use case.
  - A personal account is used in the demo.
  - The OAuth flow, consent screen or test credentials are incomplete.
  - Permissions are requested that the video does not show.

  Sources: [Singh Amandeep: IG messaging approval 2026](https://singhamandeep.com/instagram-messaging-api-approval-getting-instagram_business_manage_messages-2026/); [Saurabh Dhar: rejection reasons](https://www.saurabhdhar.com/blog/why-meta-app-review-gets-rejection-how-to-get-approved); [WoopSocial](https://woopsocial.com/blog/meta-app-review-rejected-2026-fix-guide)

**Business Verification and Lead Ads**
- **Business Verification is required for all apps requesting Advanced Access.** [S] — [Meta Permissions Reference](https://developers.facebook.com/documentation/development/permissions). It usually takes 2–5 business days. [W] — [Infobip Tech Provider guide](https://www.infobip.com/docs/whatsapp/tech-provider-program/setup-and-integration)
- **Lead Ads webhooks** need `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement` and `ads_management`. [W] — [LeadSync](https://leadsync.me/blog/meta-lead-gen-api-guide/)
- **`leads_retrieval` draws extra scrutiny:** the review must show where leads go and who sees them. [W] — [Singh Amandeep: leads_retrieval guide](https://singhamandeep.com/leads-retrieval-permission-approval-facebook-lead-ads-api/)
- **Standard Access is not enough for customers:** under Standard Access, `leads_retrieval` works only for app admins, developers and testers. Production customers need Advanced Access through App Review and Business Verification. [W — one developer's issue log] — [GitHub issue #293](https://github.com/clickhero-dev/fury-app-v2/issues/293)

**Access Verification**
- **Reportedly retired:** Meta posted "Retiring Access Verification for Tech Provider Apps" on its developer blog on Oct 9, 2026, with no effective date given. The form and status field will be removed from the App Dashboard. Business Verification and App Review remain. [W/M — second-hand, two outlets agree; Meta's post was not reachable] — [Singh Amandeep, Oct 2026](https://singhamandeep.com/?p=3959); [Social Media Today](https://socialmediatoday.com/news/meta-removes-access-verification-for-developers/832678); [Adgully](https://www.adgully.com/post/22175/meta-eliminates-access-verification-from-tech-provider-app-onboarding-process)
- **Conflict:** Infobip's guide still describes access verification as a step after app approval. It may be out of date. [W] — [Infobip](https://www.infobip.com/docs/whatsapp/tech-provider-program/setup-and-integration)

### Inferences
- **Chance of blocking FollowUp:**
  - The DM cadence limit is **certain**. It is policy, not a review outcome. Any day-3/7/14/30 automated DM would breach Meta policy and risk the app's messaging access.
  - Messenger and Lead Ads approval is **medium** risk: each rejection costs roughly another 20-day cycle.
  - Access Verification may no longer be a risk if the Oct 9 retirement is real. Check the App Dashboard this week. If the status field is gone, the Dec 18 deadline probably no longer applies; confirm before dropping it from the plan.
- **Cheapest way around the cadence limit:** inside the first 24 hours, the AI reply should ask for and capture an email address or phone number, stating why. CASL consent language goes here too. Follow-ups then run by email. On Instagram and Messenger, later messages go out only when the lead writes again, which reopens the window. A human-written reply under `human_agent` is possible up to day 7.
- **Open question for FollowUp's Human Agent (video E) use:** does a realtor clicking "approve" on an AI-written draft count as a "human agent" response? No source settles this, and Meta excludes "automated messages." The safest demonstration shows the human typing or editing the reply.
- **Cheapest fallback for Lead Ads:** realtors' CRMs and Zapier commonly ingest Lead Ads already, so FollowUp could read leads from the CRM if `leads_retrieval` is delayed. This is not verified in this research.
- **Disclosure:** Meta defers to "applicable law," so the US state chatbot laws in section 4 decide when the disclosure becomes mandatory on Meta channels.

### Gaps
- Meta's docs were not fetchable directly. Exact current policy wording is unverified.
- Meta's opt-in routes for messaging outside the window (Marketing Messages / recurring notifications) were not researched.
- No source addresses whether human approval of an AI draft qualifies for `human_agent`.
- 2026 App Review time distributions come only from consultants. Meta's official retirement post for Access Verification was not read directly.
- Native Lead Ads integrations in Follow Up Boss and GoHighLevel are unconfirmed.

---

## 3. Canada CASL (implied consent from an inquiry, existing business relationship, identification and unsubscribe, penalties), plus US CAN-SPAM and TCPA

### Takeaway
CASL is compatible with FollowUp's day 1/3/7/14/30 cadence. An inquiry creates implied consent for 6 months, so the whole cadence fits. Conditions:
- Every message identifies the sender and includes a working unsubscribe.
- Opt-outs are honoured within 10 business days at most (FollowUp should make them instant).
- The sender can prove when and how the inquiry happened.

Anything past 6 months (long-term nurture) needs express consent, which must be requested while implied consent is still valid. Statutory maximums are $1M per violation for individuals and $10M for organizations, but reported enforcement is rare and mostly old.

In the US, CAN-SPAM is an opt-out regime, with a maximum of about $53,088 per violating email after the 2025 adjustment. **Texts are the US danger zone (TCPA)**, even after the one-to-one consent rule was struck down in January 2025.

### Cited Findings
**CASL: consent windows**
- **Inquiry window:** CRTC guidance says an inquiry or application within the 6 months before a message is sent supports implied consent through an existing business relationship. The equivalent period after a purchase or transaction is 2 years. [S] — [CRTC: CASL guidance on implied consent](https://crtc.gc.ca/eng/com500/guide.htm)
- **When the window starts is less settled.** One vendor counts from the inquiry date. Another counts from the initial request or the last relevant interaction tied to it. The CRTC wording reads as a look-back from the send date. [W] — [Suped](https://www.suped.com/knowledge/email-deliverability/compliance/how-to-determine-the-start-of-the-six-month-contact-window-under-casl); [Envoke](https://envoke.com/blog/implied-consent-casl/)
- **Burden of proof sits with the sender.** The CRTC recommends treating implied consent as a "bridge" to express consent and tracking expiry dates. [M] — [Envoke](https://envoke.com/blog/implied-consent-casl/)

**CASL: exemptions and required content**
- **Quote/estimate exemption (s. 6(6)):** a message that *solely* provides a quote or estimate the recipient requested is exempt from consent, but must still meet the identification and unsubscribe requirements. [M; the CRTC information-session reading is from 2014] — [Barry Sookman](https://barrysookman.com/2014/06/08/casl-clarified-by-crtc-at-information-sessions/); [JD Supra CASL how-to](https://jdsupra.com/legalnews/email-marketing-in-canada-casl-a-how-to-21383)
- **Identification:** legal or operating name, mailing address, and one of phone, email or web URL. [M] — [SendCheckIt CASL guide](https://sendcheckit.com/blog/casl-compliance-guide)
- **Unsubscribe:** honoured "without delay," and no later than 10 business days. The mechanism must stay valid for at least 60 days. [M; enforcement cases date from 2015] — [Baker McKenzie on Rogers ($200k)](https://connectontech.bakermckenzie.com/2015-12-7-major-media-company-pays-c200000-under-canadas-anti-spam-law/); [Mondaq: deficient unsubscribe settlement](https://www.mondaq.com/canada/privacy-protection/445790/crtc-settles-alleged-casl-violation-deficient-unsubscribe-mechanism)

**CASL: penalties and enforcement**
- **Maximums:** up to $1M per violation for individuals and $10M for organizations. The largest reported penalty is C$1.1M for four violations, and other settlements were C$200k, C$150k and C$48k. [M; dated 2015 — older] — [CCCC: CASL one year later](https://cccc.org/news_blogs/legal/2015/08/07/casl-one-year-later)

**CASL: real-estate guidance (CREA-derived)**
- **Windows:** implied consent runs 6 months from an inquiry and 2 years after a transaction.
- **Referrals:** following up a referral needs express consent or an existing relationship.
- **Stricter reading:** one source says "your response be limited to answering the original inquiry."

[M/W — copy of CREA guidance on a local board site, plus a realtor blog] — [CREA-derived guidance (Interior Realtors)](https://www.interiorrealtors.ca/matrix/documents/guidance_anti-spam_legislation.pdf); [BC Condos & Homes](https://bccondosandhomes.com/news/blog/do-you-have-consent-anti-spam-rules-in-effect-july-1); [CREA Café](https://www.crea.ca/cafe/when-casl-enforcement-is-good-news/)

**US: CAN-SPAM**
- **Maximum penalty:** $53,088 per violating email after the FTC's January 2025 inflation adjustment (Federal Register doc 2025-01361, as cited by vendors). Some sites still show the older $51,744. [M — several secondary sources agree; FTC notice not read directly] — [Tomba](https://tomba.io/blog/can-spam-penalties-per-email); [Prospeo](https://prospeo.io/s/can-spam-penalties-per-email); [MLex](https://www.mlex.com/mlex/amp/articles/2296578)
- **Largest case:** the FTC's $2.95M Verkada settlement (Aug 2024) is described as the largest CAN-SPAM penalty. It involved broken opt-outs. [M] — [Mondaq](https://www.mondaq.com/unitedstates/advertising-marketing-branding/1530002/ftc-gets-record-penalty-in-can-spam-enforcement-action)

**US: TCPA**
- **The one-to-one consent rule was vacated.** On Jan 24, 2025, the Eleventh Circuit vacated the FCC's TCPA one-to-one consent rule as exceeding the agency's authority. [S-equivalent — multiple law firms] — [Morrison Foerster](https://mofo.com/resources/insights/250130-eleventh-circuit-vacates-fcc-s-tcpa-one-to-one-consent-rule); [Kelley Drye](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/eleventh-circuit-vacates-tcpa-11-consent-rule)
- **The TCPA is still risky:** it "remains a dangerous statute even without the rule." [M] — [Steptoe](https://www.steptoe.com/en/news-publications/one-to-none-the-fcc-and-eleventh-circuit-issue-last-minute-rulings-gutting-the-one-to-one-tcpa-consent-rule.html)

### Inferences
- **Chance of blocking FollowUp: low, if it is built into the product rather than left to each realtor.** The day-30 message falls well inside 6 months.
- **What the product needs:**
  1. A consent ledger per lead: inquiry timestamp, source, channel, and a copy of the inquiry.
  2. Automatic stop at 6 months unless express consent is on file.
  3. A step inside the window that asks for express consent ("Want me to keep sending new listings?") and records the answer.
  4. A footer in every automated email: realtor's name, brokerage name, mailing address, contact method, and a one-click unsubscribe. FollowUp's existing "STOP stops everything, every channel" rule already covers the unsubscribe side; make it instant rather than "within 10 days."
  5. No follow-ups on referrals without express consent.
- **Day-1 reply:** a reply that only answers the inquiry is low-risk, either under implied consent or the quote exemption. The stricter CREA-derived reading ("limited to answering the original inquiry") suggests keeping early follow-ups tied to the lead's stated need rather than generic marketing. A lawyer should confirm.
- **US:** keep US users on email and DMs. Adding SMS for US leads without prior express (and, for marketing, written) consent capture is the single most expensive legal mistake available to FollowUp. FollowUp has no calls or texts today (BRAIN.md), which is the right default.

### Gaps
- The CRTC page could not be fetched. The CASL statute text and the CRTC regulations were not read directly.
- Not established: whether a software provider that "causes or permits" sending shares liability with the realtor, and whether messages sent on a realtor's behalf must also name the realtor's brokerage or FollowUp. **A lawyer must confirm.**
- Not established: whether CASL's definition of "electronic address" covers Instagram and Messenger DMs (believed to cover instant-messaging accounts; not confirmed here). Also not checked: whether CASL's private right of action ever came into force (believed not), and whether there were any CRTC CASL enforcement actions in 2024–2026.
- US: the FCC's 2024 ruling on AI-generated voices under the TCPA and the CAN-SPAM opt-out deadline were not confirmed from sources. Quebec Law 25 (automated decisions) was not researched.

---

## 4. Real estate rules (Ontario TRESA/RECO advertising and communications, brokerage supervision, brokerage identification, AI disclosure; NAR and US state guidance on AI chatbots) and privacy (PIPEDA, Ontario)

### Takeaway
No Ontario or US rule found bans AI-drafted or automated follow-ups by realtors. RECO's AI guidance says AI "doesn't change" TRESA obligations: the registrant and the brokerage are accountable for AI output, and AI-assisted marketing must meet the advertising rules, including identifying the brokerage exactly as registered.

No RECO requirement to disclose AI use in messages was found. RECO does require that AI-altered *images* be identifiable. In the US, NAR's position is that agents stay accountable. Chatbot-disclosure duties come from state laws (California, Utah, Maine), each with different triggers.

On privacy, PIPEDA governs, and the federal reform bill C-27 died in January 2025. The binding constraints are practical ones: comparable protection for processors, Google Limited Use, and RECO's warning about putting client data into public AI tools.

### Cited Findings
**Ontario: RECO and TRESA**
- **RECO AI guidance** [S — via search extract; page not fetchable] — [RECO Guidance: Use of AI](https://www.reco.on.ca/agents-and-brokerages/reco-bulletins/reco-guidance-use-of-artificial-intelligence/):
  - AI use doesn't change TRESA obligations, and brokerages and agents remain accountable for AI-generated content.
  - AI-assisted posts, descriptions and visuals must meet TRESA advertising rules, including brokerage identification.
  - Registrants must "carefully review and verify that it is accurate, complete, and compliant" before relying on or sharing AI output.
  - Registrants should not enter client data into public AI tools.
- **AI-altered images:** RECO told CBC that consumers must be able to clearly identify when images have been virtually altered or AI-generated. [M] — [CBC Toronto](https://www.cbc.ca/news/canada/toronto/rising-use-of-ai-staged-real-estate-photos-raises-questions-about-misleading-homebuyers-9.7382211)
- **RECO Bulletin 5.1 (advertising)** [S] — [RECO Bulletin 5.1](https://www.reco.on.ca/getmedia/fc6d0358-a8a1-4e6b-bfaa-2b8c312e1c3b/RECO-Bulletin-5-1-Advertising-requirements.pdf); [RECO Form 5.5.1 checklist](https://reco.on.ca/Reco/media/Documents/PDF/Agents%20and%20Brokers/RECO%20Bulletins/RECO-Form-5-5-1-Advertising-Compliance-Review-Form.pdf):
  - "All advertising must include the name of the brokerage," including by agents in teams.
  - "Agents are prohibited from advertising in any manner unless the brokerage is clearly and prominently identified."
  - The name must match the RECO registration and be followed by "brokerage" or "real estate brokerage." No short forms or nicknames.
- **Bulletin 5.2:** a broker other than the broker of record must use an approved descriptor, such as "real estate agent" or "real estate broker." [S] — [RECO Bulletin 5.2](https://www.reco.on.ca/getmedia/3ef00368-e464-4559-aeb7-c286cb70432b/RECO-Bulletin-5-2-Permitted-terms.pdf)
- **Bulletin 1.2 (supervision):** brokerages have a legal obligation to ensure every agent they employ carries out their duties under the legislation. The broker of record must ensure the brokerage complies, including with the Code of Ethics. [S] — [RECO Bulletin 1.2](https://www.reco.on.ca/getmedia/d56aa6d5-63de-4786-8c68-08a638eeeaa7/RECO-Bulletin-1-2-Duty-to-comply-with-legislation.pdf)

**US: NAR**
- **Liability for agents:** NAR's counsel warned that AI use, including chatbots, "comes with the potential for liability," and advised against using AI to draft contracts, modify standard forms or give legal advice. [S; article dated 2023 — older] — [NAR: Using AI in Your Real Estate Business? 3 Traps](https://www.nar.realtor/magazine/real-estate-news/law-and-ethics/using-ai-in-your-real-estate-business-3-traps-to-avoid)
- **NAR's policy position:** it wants a uniform, light-touch federal AI framework, with liability resting on the developers who build AI systems. [M] — [NAR Focus, Nov 2025](https://www.narfocus.com/publication-issue/view/2025-11-05-technologies-artificial-intelligence); [NAR AI page](https://www.nar.realtor/artificial-intelligence-real-estate)
- **NAR's AI policy template for brokerages** treats agents as accountable for AI content. It is recommended, not required, and has no disclosure script. [W] — [The Paperless Agent](https://thepaperlessagent.com/blog/nar-released-an-ai-policy-template-for-brokerages-here-is-what-it-means-for-you-as-an-agent)
- **Code of Ethics Article 2** bars exaggerating, concealing or misrepresenting pertinent facts. [M] — [NAR AI page](https://www.nar.realtor/artificial-intelligence-real-estate)
- **MLS data:** on chatbot apps, NAR said MLSs should consider whether MLS data reaches an unauthorized party and whether IDX disclosure rules are met. [M] — [Florida Realtors, Oct 2025](https://www.floridarealtors.org/news-media/news-articles/2025/10/nar-ai-apps-must-meet-mls-standards)

**US: state chatbot disclosure laws**
- **California (2019 bot law, older):** disclosure is required when a bot knowingly deceives a person to incentivize a sale or influence an election.
- **California SB 243 (companion chatbots, effective Jan 1, 2026):** reportedly excludes customer-service bots.
- **Utah AI Policy Act (2024, amended 2025, extended to July 2027):** sources disagree. One says disclosure is required on request, and proactively in regulated occupations. Another says Utah "does not make a bot announce itself."
- **Maine (Public Law 2025, ch. 294, effective Sep 24, 2025):** requires disclosure where a chatbot could mislead a consumer into thinking they are dealing with a human. Its scope (all interactions vs. transactions) is contested.

[M/W — law firms and vendors disagree] — [DLA Piper, Jan 2026](https://www.dlapiper.com/insights/publications/2026/01/ai-disclosure-laws-on-chatbots-are-on-the-rise-key-takeaways-for-companies); [National Law Review on Utah](https://natlawreview.com/article/utah-enacts-ai-amendments-targeted-mental-health-chatbots-and-generative-ai); [JD Supra: Utah disclosure](https://production.jdsupra.com/legalnews/utah-s-new-ai-disclosure-requirements-7535777); [Vaquill state chart](https://www.vaquill.ai/blog/ai-chatbot-and-ai-disclosure-laws-by-state); [Entagl](https://www.entagl.com/blog/us-ai-chatbot-disclosure-laws-2026); [Revision Legal](https://revisionlegal.com/internet-law/must-businesses-disclose-ai-chatbots-to-users/); [FPF Enacted AI Legislation Chart](https://fpf.org/wp-content/uploads/2026/02/Enacted-AI-Legislation-Chart-.pdf)

**Canada: privacy**
- **Generative AI principles (Dec 2023):** joint federal, provincial and territorial regulator principles. They are guidance, not law, but likely to shape investigations. [M] — [Mondaq / Torys summary](https://www.mondaq.com/canada/privacy-protection/1418134/canadian-privacy-regulators-weigh-in-on-how-to-comply-with-privacy-laws-when-using-generative-ai-systems); [Canadian Lawyer](https://www.canadianlawyermag.com/practice-areas/privacy-and-data/privacy-commissioner-offers-up-principles-for-using-and-developing-generative-ai-systems/382234)
- **Processors:** under PIPEDA, personal information transferred to a third party for processing must get comparable protection through a contract or other means. [M] — same Mondaq summary
- **Enforcement power:** on June 11, 2026, the OPC found X Corp./xAI (Grok) violated PIPEDA. The OPC cannot impose fines or binding orders. [M] — [Mondaq: OPC Grok decision](https://www.mondaq.com/canada/privacy-protection/1802848/what-the-opcs-grok-decision-means-for-your-organization)
- **Reform status:** Bill C-27, including AIDA, died on prorogation on Jan 6, 2025. [M] — [DLA Piper](https://www.dlapiper.com/insights/publications/2025/01/canadian-privacy-and-ai-horizon-shifts-again); [Gowling WLG](https://gowlingwlg.com/en/insights-resources/articles/2025/privacy-and-cyber-bills-what-to-expect-post-election). A successor, Bill C-36 ("Protecting Privacy and Consumer Data Act"), is reported as tabled. [M] — [Mondaq](https://www.mondaq.com/canada/privacy-protection/1804640/ottawa-tables-long-awaited-federal-privacy-reform-legislation). This is contradicted by a source claiming no successor as of June 2026. [W] — [D-Central](https://d-central.tech/ai-regulation-canada/)

### Inferences
- **Chance of blocking FollowUp: low.** The practical gate is a brokerage compliance officer, not the law. Brokerages carry supervision duties for agents' tools, so expect them to ask:
  - Does every message name the brokerage?
  - Who approved what, and when?
  - Where does client data go?

  Answer all three in the product: the brokerage name exactly as registered plus the agent descriptor in every signature, an audit log of drafts, approvals and sends, and a data-handling page. This is cheap and doubles as a sales asset.
- **Is a one-to-one follow-up "advertising" under TRESA?** It is unresolved. Defaulting to always include the brokerage name costs nothing and removes the question.
- **AI disclosure:** not shown to be mandatory in Ontario. Trust evidence (section 5) and US state laws argue for:
  - an optional disclosure line, on by default for US users;
  - a hard rule that FollowUp never claims to be human and answers "is this a bot?" truthfully;
  - never giving price opinions, legal advice or contract terms. This matches FollowUp's existing "never a guessed price" rule and NAR's counsel warning.
- **Privacy:** FollowUp acts as the realtor's processor. It needs:
  - a data processing agreement or terms;
  - LLM vendors on no-training, minimal-retention terms (this also covers RECO's "public AI tools" warning and Google Limited Use);
  - disclosure of where data is processed (US-based LLM providers);
  - retention and deletion controls.

### Gaps
- reco.on.ca pages could not be fetched. The TRESA regulation text (Code of Ethics / advertising sections) was not read directly. One search extract tied Bulletin 5.1 to O. Reg. 580/05, the pre-TRESA (REBBA) regulation, which may be outdated wording. **A lawyer should confirm** which TRESA regulation sections apply to one-to-one electronic messages.
- No RECO or OREA guidance specific to AI chatbots or automated consumer messaging was found.
- No US state real estate commission guidance on AI chatbots was found (only Texas TREC advertising pages, not reviewed).
- Not confirmed: whether real estate counts as a "regulated occupation" for Utah's proactive-disclosure rule. The exact scope of Maine's law is contested.
- Not sourced here: whether Ontario has its own private-sector privacy statute (believed: none beyond health under PHIPA, so PIPEDA applies). Bill C-36 status is conflicting. Quebec Law 25 obligations for Quebec clients were not researched.

---

## 5. Realtor and consumer trust in AI auto-replies (surveys and evidence 2024–2026)

### Takeaway
Consumers use AI heavily but prefer humans, want to be told when they are talking to AI, and trust it far more when a human is clearly reachable (55% vs 26% in Five9's data). In real estate, buyer trust in AI for home search fell from 30% to 16% between 2025 and 2026 (Cotality), while agents remain the most-trusted source. Realtors' top AI worries are accuracy (63%) and compliance/legal (49%).

Together, this supports FollowUp's approval-first default and a visible human path. It argues against leading the pitch with "fully automatic sending."

### Cited Findings
**Consumers in general**
- **Gartner (5,728 customers; fieldwork December 2023, so older):** 64% of customers would prefer companies did not use AI in customer service. [M] — [Martech.org](https://martech.org/do-consumers-really-want-to-talk-to-bots/); [CX Today](https://cxtoday.com/why-ai-disclosure-could-make-or-break-customer-trust)
- **Gartner, later surveys:** about three-quarters want to know when they are interacting with generative-AI content. A 2026 survey reportedly found 87% say an option to reach a human is essential. [W/M — secondary] — [CX Today](https://cxtoday.com/why-ai-disclosure-could-make-or-break-customer-trust)
- **Five9:**
  - 75% prefer talking to a human for support.
  - 71% say being told they are talking to AI is very or extremely important.
  - Trust in AI to resolve an issue is 55% with a clear path to a human, and 26% without one.
  - Preference for humans rises with age: Gen Z 66%, Gen X 76%, Boomers/Silent 86%.

  [M] — [Customer Experience Dive](https://www.customerexperiencedive.com/news/clear-path-to-live-agent-boosts-trust-ai-customer-service/825835/); [AccountsRecovery, Jul 2026](https://www.accountsrecovery.net/2026/07/03/consumers-will-try-ai-but-they-want-a-human-within-reach-five9-report-finds/); [MarTech Vibe](https://martechvibe.com/article/75-of-consumers-prefer-talking-to-a-human-for-customer-service)
- **SurveyMonkey 2025:** 8% prefer AI over humans in customer service. In Q4 2025, 14% would lose trust in a business whose AI agent does not clearly say it is AI. [M] — [SurveyMonkey](https://www.surveymonkey.com/curiosity/customer-service-statistics)

**Home buyers**
- **Cotality** (buyers in the US, Canada, UK and Australia): trust in AI to help find a home fell from 30% in 2025 to 16% in 2026. One in three US buyers say a significant AI listing error would reduce their trust in the platform. [M] — [Cotality: Trust but verify AI](https://www.cotality.com/insights/analysis/trust-but-verify-ai); [Inman, Apr 2026](https://www.inman.com/2026/04/21/homebuyer-trust-in-ai-is-slipping-survey-finds-video/); [Real Estate News, May 2026](https://www.realestatenews.com/2026/05/09/consumers-increasingly-wary-of-ais-role-in-homebuying)
- **Realtor.com (Oct 2025):** 82% of Americans use AI for housing information, yet agents remain the most trusted and accurate source. For setting an offer price, 25% would trust an agent and only 9% an AI tool. [M] — [Realtor.com release via YCharts](https://ycharts.com/news/story/PRN-LA93392-20251009); [The Real Deal](https://therealdeal.com/data/national/2025/ai-is-rising-as-an-expert-voice-for-real-estate-insights)
- **UK study (200 buyers and sellers):** 83% prefer a person for milestones such as booking a valuation or making an offer. [W] — [The Negotiator](https://thenegotiator.co.uk/news/products-services-news/eight-out-of-10-homebuyers-prefer-human-sales-over-ai/)
- **Outlier:** Veterans United found 53% of prospective buyers comfortable buying with no human involvement. This is mortgage and process oriented, not agent communication. [W] — [National Mortgage Professional](https://nationalmortgageprofessional.com/news/more-half-buyers-say-theyd-purchase-home-without-human-help)

**Realtors**
- **RPR survey (early 2026, 225 NAR-member agents):** top AI concerns are accuracy (63%), compliance or legal issues (49%) and misinterpretation of market data (47%). Only 8% never plan to use AI. [M — reported by NAR; attribution to this exact URL should be verified] — [NAR: You've tried AI, but can you trust it?](https://www.nar.realtor/news/real-estate-news/technology/youve-tried-ai-but-can-you-trust-it)
- **NAR 2025 Technology Survey (July 2025, 1,241 usable responses):**
  - 20% use AI tools daily, 22% weekly and 27% a few times a month; 32% have not used AI in their business.
  - The report says 41% are currently using AI or generative AI. Another summary cites 46% for AI-generated content.

  [S/M] — [NAR 2025 Technology Survey PDF](https://cms.nar.realtor/sites/default/files/2025-09/2025-realtors-technology-survey-report-09-18-2025.pdf); [HousingWire](https://www.housingwire.com/articles/nar-2025-technology-survey-realtor-tech-usage-trends/); [NAR press release](https://www.nar.realtor/newsroom/realtors-embrace-ai-digital-tools-to-enhance-client-service-nar-survey-finds)
- **Adoption vs impact:** 68% of agents say they have adopted AI, but only 17% report a significant positive impact. [W — secondary, verify against the original] — [HousingWire: AI adoption](https://housingwire.com/articles/ai-adoption-real-estate)

### Inferences
- **Do consumers mind AI replies?** They mind being deceived or trapped more than they mind AI as such. An instant, accurate reply, signed by the realtor and brokerage, with an obvious way to reach the person, is likely acceptable. A hidden bot that keeps nudging at day 14 and day 30 is not.
- **Caveat on the evidence:** it comes from general customer service and home-search surveys, not lead follow-up specifically. Treat it as directional.
- **Do agents worry about mistakes and liability?** Yes. Accuracy and compliance are the top two concerns. FollowUp's strongest trust levers:
  - human approval by default;
  - "never a guessed price";
  - an audit log;
  - brokerage-compliant signatures;
  - autonomy earned rule by rule.

  Leading the pitch with "it sends automatically" works against these concerns. Leading with "nothing goes out without your OK, until you choose a rule" works with them.
- **Chance of blocking FollowUp:** medium as an *adoption* risk, not a legal one. CASL-compliant is not the same as welcome. Cadence content after day 7 should add value (new listings that match, an answer to a question) rather than simply "checking in."

### Gaps
- No Canadian-specific survey of consumer reactions to AI replies from realtors was found.
- No independent data was found on reply or conversion rates for AI versus human follow-up in real estate; only vendor claims exist, and they were not collected.
- The HomeLight 2025 Top Agent Insights (AI Edition) report was identified but not read: [HomeLight PDF](https://homelightblog.wpengine.com/wp-content/uploads/2025/07/HomeLight-2025-Top-Agent-Insights-Report-AI-Edition.pdf).
