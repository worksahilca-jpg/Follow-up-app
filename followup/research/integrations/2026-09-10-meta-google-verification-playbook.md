# Meta App Review + Google OAuth verification — 2026 playbook (task: verification unblock)

Checked: 2026-09-10. Solo founder, Toronto ON, not yet a registered business, no budget.
Meta app is in **Development mode** (tester path); Google OAuth consent screen is in **Testing**.

**Method note (read this before trusting any number below).** WebFetch is egress-blocked in this
sandbox for `developers.facebook.com`, `developers.google.com`, and `appdefensealliance.dev` —
i.e. every primary source that actually matters. Everything here is from **search-result snippets**
(including snippets *of* those official pages) plus secondary vendor/practitioner blogs.
So **no claim in this document gets Grade A** (= "I read the primary doc"). Grades used:

- **B** — official Meta/Google/ServiceOntario page content, but seen only as a search snippet, and
  corroborated by at least one independent source.
- **C** — secondary sources (vendor blogs, integration-provider guides, consultants) that agree
  with each other but are not primary.
- **D** — single source, or sources that disagree. Treat as a lead to verify, not a fact.

Anything Grade D, or flagged "UNCONFIRMED", must be re-checked against the live console/doc before
money or a submission depends on it. **Nothing in this document is invented** — where I could not
find a number, I say so instead of guessing.

---

## 0. The exact permissions this app requests (from the code, not from memory)

These are the real strings in the repo as of today. Every review submission must match this list
exactly — asking for anything not in this list is one of the top rejection reasons on both platforms.

**Google** — `followup/src/lib/integrations/gmail.ts` (`SCOPES`, lines 42-46):

| Scope | Google classification | Verification consequence |
|---|---|---|
| `https://www.googleapis.com/auth/gmail.readonly` | **Restricted** | App verification **+ annual CASA security assessment** |
| `https://www.googleapis.com/auth/gmail.send` | **Sensitive** | App verification only |
| `https://www.googleapis.com/auth/calendar.events` | **Sensitive** | App verification only |
| `https://www.googleapis.com/auth/userinfo.email` | Non-sensitive | No verification trigger |

`gmail.send` is sensitive; `gmail.readonly` is restricted — this split is the single most important
fact in the whole Google section, because **`gmail.readonly` alone is what triggers CASA**.
The full restricted Gmail set is `gmail.readonly`, `gmail.metadata`, `gmail.modify`, `gmail.insert`,
`gmail.compose`, `gmail.settings.basic`, `gmail.settings.sharing`.
**[Grade C — scope classification consistent across the Explosion Gmail API guide and Google's own
scopes page as surfaced in snippets; the *specific* restricted-list enumeration is single-source.]**

**Instagram** — `followup/src/lib/instagram.ts:244`
(`INSTAGRAM_OAUTH_SCOPES`): `instagram_business_basic`, `instagram_business_manage_messages`.
These are the **Instagram API with Instagram Login** permissions (not the older
Facebook-Login-based `instagram_basic` / `instagram_manage_messages` pair). Good — it means the
Instagram path does **not** need `pages_show_list` or `business_management`.

**Facebook** — `followup/src/lib/facebook.ts:184` (`FACEBOOK_OAUTH_SCOPES`):
`pages_show_list`, `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`,
`leads_retrieval`.

**Not requested anywhere in the code:** `business_management`, `instagram_basic`,
`instagram_manage_messages`, `ads_management`, `pages_manage_ads`. Keep it that way —
see the `leads_retrieval` gotcha in §1.6.

---

## 1. META

### 1.1 Standard Access vs Advanced Access — what it means for *this* app

- **Standard Access** is granted automatically. It works **only** for accounts/Pages/IG accounts
  that the app itself owns or manages, and only for people who hold an app role (Administrator,
  Developer, Tester) or a role on a business portfolio that has claimed the app.
  **[Grade C — consistent across singhamandeep's Advanced Access guide and Blotato's IG messaging
  post, both echoing Meta's own wording.]**
- **Advanced Access** is the level required when the app "serves Instagram professional accounts
  that you don't own or manage" and is used by people with no role on the app.
  **[Grade C, same sources.]**

FollowUp is by definition the Advanced-Access case: it is a multi-tenant SaaS whose customers own
their own Pages and IG accounts. **There is no version of this product that ships on Standard
Access.** Standard Access is a development affordance, not a launch mode.

Advanced Access is gated on **two independent things that both have to clear**:
1. **Business Verification** of the business portfolio behind the app, and
2. **App Review** of each individual permission.

Meta stated this as policy in a developer-blog post ("Developer Platform will now require Business
Verification for Advanced Access", 2023-02-01) and it is still the operative rule in 2026.
**[Grade B — official Meta developer blog + Meta's own `docs/development/release/business-verification/`
page surfaced in search; corroborated by multiple 2026 practitioner guides.]**

### 1.2 Which permission needs what

Per-permission mapping. **Access-level and review requirements were read from search snippets of
Meta's Permissions Reference and per-product guides, not the live table** — re-check each row in the
App Dashboard's "Permissions and Features" screen, which shows the authoritative current state per
permission for *your* app.

| Permission | Needs App Review for Advanced Access? | Needs Business Verification? | Notes |
|---|---|---|---|
| `instagram_business_basic` | Yes (Advanced) | Yes (BV gates Advanced) | Metadata only: IG username, ID, profile picture **[Grade C]** |
| `instagram_business_manage_messages` | **Yes — the scrutinised one** | Yes | Receive/send IG DMs; explicitly called out as one of the slower, more-scrutinised scopes **[Grade C]** |
| `pages_messaging` | Yes | Yes | Messenger send/receive on Pages you don't own **[Grade C]** |
| `pages_show_list` | Yes | Yes | Lists the Pages the connecting user administers **[Grade C]** |
| `pages_manage_metadata` | Yes | Yes | Needed to subscribe the Page to your webhook **[Grade C]** |
| `pages_read_engagement` | Yes | Yes | **[Grade C]** |
| `leads_retrieval` | Yes | Yes — but see below | Reads Lead Ads form submissions **[Grade B/C]** |

**Ordering nuance on `leads_retrieval`:** one integration-partner guide (Convertr, describing the
actual Lead Ads submission flow) says "**After approval, you will be asked to complete Business
Verification**" — i.e. for this permission BV may land *after* App Review rather than before.
This contradicts the general "BV first" rule. **[Grade D — single source, contradicts the general
rule.]** Do not plan around it; plan on BV first, and treat a post-approval BV prompt as a bonus.

### 1.3 What an App Review submission actually requires, per permission

For **each** permission separately (this is the part people get wrong — one video for five
permissions is a rejection):

1. **A written justification** naming the concrete feature the permission powers.
2. **A screencast** demonstrating that permission end-to-end.
3. **Reviewer test credentials** — a working login to FollowUp itself.

**Screencast requirements** (highest-value section in this document — most 2026 rejections are here):

- Start from the **public landing page or login screen**, not from inside an authenticated
  dashboard. **[Grade C]**
- Show the **full OAuth/consent flow**, with the Meta login popup and **the specific permission
  visibly listed on the consent screen**, then the accept click. A "generic product walkthrough
  that never clearly shows the consent screen and the scope in action is the most common failure."
  **[Grade C — singhamandeep screencast guide, corroborated by saurabhdhar and PostMoore.]**
- Then show **that permission's data rendering in your app's front end** — for
  `instagram_business_manage_messages`, a **real DM exchange**: an inbound DM arriving in FollowUp
  and a reply going back out and landing in Instagram. **[Grade C]**
- Use a **real Instagram Business or Creator account, not a developer test user** assigned in the
  App Dashboard. **[Grade C — stated by two IG-review sources; UNCONFIRMED against Meta's own docs
  and slightly in tension with Meta's general "use test users" advice, so verify before recording.]**
- UI language in **English**, zoom in on small text, add **text overlays/annotations** saying which
  permission is being exercised at each timestamp. **[Grade C]**
- A screencast **without** a matching written description is auto-rejected, and vice versa — both
  are required per permission. **[Grade C]**

**Test credentials requirements:**

- Provide credentials in the **initial** submission, not on request. **[Grade C]**
- They must work for an outsider: "a common mistake is providing credentials that work for the
  internal team but fail for outsiders." **[Grade C]**
- **Remove any staging/HTTP-basic password in front of the review URL** — Meta's own submission
  guide lists this as a blocker. **[Grade C]**
- Don't hand over your personal Meta account credentials. **[Grade C]**

### 1.4 Turnaround times (2026)

- Meta's dashboard previously promised ~10 days; in 2026 the stated expectation **roughly doubled to
  ~20 days**. **[Grade C — bundle.social's "Meta App Review Now Takes 20 Days", corroborated in
  framing by singhamandeep's "how long does it take" page. Not confirmed against Meta's dashboard
  copy, which I could not fetch.]**
- Reported range is still "a few days to several weeks" depending on queue and submission quality.
  **[Grade C]**
- **Every rejection restarts the clock from zero.** Reviewers are described as clearing tickets
  fast — imperfect submissions get rejected rather than queried. Budget for at least one
  revise-and-resubmit cycle on `instagram_business_manage_messages`. **[Grade C]**
- Business Verification itself is days-to-~2-weeks of paperwork/DNS, but community reports of
  "In Review 10+ days blocking App Review submission" exist. **[Grade D — one community-forum thread.]**

**Honest planning number: 6-10 weeks from "start Business Verification" to "Advanced Access live",
assuming one rejection cycle.** Not a two-week task.

### 1.5 Common rejection reasons for messaging permissions — and the fix

| Rejection reason | Fix |
|---|---|
| Screencast doesn't show the consent screen with the scope on it | Re-record starting at the landing page; freeze on the consent screen **[Grade C]** |
| Screencast doesn't show the end-to-end use case described in the notes | Description and video must narrate the *same* story, beat for beat **[Grade C]** |
| Requesting permissions for features that aren't built yet | Only submit permissions you can demo *today* **[Grade C]** |
| Requesting unnecessary permissions | Submit the exact five/two in §0, nothing extra **[Grade C]** |
| **No working webhook / no callback URL** — called out specifically for messaging permissions | Webhook must be live and verifiable at review time. FollowUp already validates Meta's HMAC signature (`validateMetaSignature` in `instagram.ts`), so this is a deployment-uptime issue, not a code issue **[Grade C]** |
| Messaging use case doesn't read as business-to-customer service | Frame FollowUp as a business replying to *its own* inbound leads. Do **not** frame it as bulk outreach, cold DM, or growth automation — DM access is rejected if it isn't clearly a B2C conversation flow **[Grade C]** |
| Data deletion path missing or inconsistent | See §4.1 **[Grade C]** |
| Business name mismatch between document and Business Manager | See §1.7 **[Grade C]** |

### 1.6 `leads_retrieval` gotcha — a possible extra permission

Meta's Lead Ads guide (via snippet) says: "your app must undergo App Review and include the
`leads_retrieval` **and `pages_manage_ads`** permissions in your submission," and separately that
reading ad-level fields (`ad_id`, `campaign_id`) additionally needs `ads_management`,
`pages_read_engagement`, and `pages_show_list`.
**[Grade B/C — Meta's own Lead Ads doc via snippet, but I could not confirm whether
`pages_manage_ads` is mandatory for a submission that never reads ad-level fields.]**

FollowUp's code requests **neither** `pages_manage_ads` nor `ads_management`. **Action: before
submitting, check in the App Dashboard whether the `leads_retrieval` request form demands
`pages_manage_ads`.** If it does and FollowUp doesn't need ad-level attribution, this is a real
fork: adding a permission you can't justify is itself a rejection reason. **FLAGGED — unresolved.**

Also note (product constraint, not verification): **lead data is retrievable for only 90 days from
submission; after that it cannot be retrieved by any method.** **[Grade B — Meta Lead Ads doc snippet.]**

### 1.7 Business Verification for an Ontario sole proprietorship

**Meta explicitly supports "Sole proprietorship" as a selectable business type.** **[Grade C —
multiple BV guides; not confirmed in Meta's own help centre text.]**

**Accepted document types** (Meta's own list, five types): Certificate/Articles of Incorporation;
**Business registration or licence document**; Government-issued business tax document; Business
bank statement; Utility bill. **[Grade B — Meta's help-centre list quoted consistently by
saveoffice.io and singhamandeep.]**

Hard constraints on those documents:

- **Self-filed tax forms and self-created/non-official documents are not accepted.** **[Grade B]**
- Documents must be **unexpired and issued by the relevant authority**. **[Grade B]**
- Must be in a supported language (English and French both qualify — relevant in Canada). **[Grade B]**
- The **legal name on the document must exactly match** the legal entity name in Business Manager.
  This is the #1 cited rejection cause. **[Grade B/C — cited by every source checked.]**
- The document must also evidence the **registered business address or phone number** matching what
  you entered in Business Manager. Meta typically wants **two documents: one proving legal name,
  one proving address & phone.** A utility bill counts **only** for address/phone, never for legal
  name. **[Grade C — saleshiker + Wati; consistent.]**
- A utility bill must show **the business** as account holder/subscriber, **not the individual** —
  even when the individual is the sole owner. **[Grade C.]** *This is a live risk for a home-based
  Toronto sole prop whose Hydro/Bell bill is in a personal name.*

**Does Meta accept an Ontario Master Business Licence?**
Not confirmable directly — no source I found names the Ontario MBL in Meta's accepted list.
**FLAGGED — UNCONFIRMED.** What can be said:

- The Ontario "Master Business Licence" has been **renamed the Business Name Registration** for a
  sole proprietorship; it is the ServiceOntario document proving registration under the Business
  Names Act, contains the same information as the former MBL, is valid **5 years**, and costs
  **CAD $60** direct from ServiceOntario. **[Grade B — Ownr help centre + Ontario Business Central +
  enterprisecentre.ca, mutually consistent; the rename is stated by Ownr, Ontario's own registrar
  partner.]** This matches the founder's ~$60 plan exactly.
- It is a **government-issued business registration document**, which is precisely category 2 of
  Meta's five accepted types. So it *should* qualify on its face. **[Grade D — this is my inference
  from the two facts above, not a sourced statement. Verify by uploading it; a rejection here costs
  time, not money.]**
- Registration is only *required* if trading under a name other than your own full legal name —
  which "FollowUp" is. So the registration is needed anyway.
- Caveat: a bare Business Name Registration may **not carry a phone number or address** in a form
  Meta accepts as the second document. Have a backup ready (business bank statement in the
  registered name, or a CRA business-number / GST-HST document as the "government-issued business
  tax document").

**Is a business-domain email required?** Not stated as a hard requirement, but strongly indicated:

- One source states the verification-code email "must use the same domain as your website" and that
  `name@gmail.com` paired with `www.business.com` is not accepted. **[Grade D — single source,
  stated as a hard rule; other sources describe it as a soft signal.]**
- Softer, corroborated version: free-email submissions (Gmail/Outlook/Yahoo) go to a slower queue
  and are rejected at a materially higher rate. **[Grade C — two sources agree directionally; the
  specific "3×" multiplier is single-source, treat as illustrative not measured.]**
- **Practical call: set up `verification@followupbase.io` before submitting.** A forward-to-Gmail
  alias is enough — Meta is reading "does this person control the domain." Cost is zero at most
  registrars. **[Grade C.]**

**Is a business phone required?** A phone number matching Business Manager must appear on one of
the submitted documents (or be evidenced by a utility bill). **[Grade C.]** No source says it must
be a *dedicated business line* — a personal mobile that appears on the registration/bank document
appears acceptable. **UNCONFIRMED whether a personal number is accepted.**

**Website requirements at BV time:** domain registered ≥7 days, served over **HTTPS**, business name
visible in the homepage title, and at least one footer contact element (email, phone, or address).
**[Grade C — single detailed source; the HTTPS + reachable-at-review-time requirement is
corroborated by the 2026-09-06 internal research doc's sources.]** `followupbase.io` must resolve
and load at review time — a broken or 404ing site during review is a listed rejection cause.

**Do not resubmit the same day after a rejection** — same-day resubmissions are reported to get
auto-flagged. Fix the specific flagged item and wait ~24h. **[Grade C/D — carried over from the
2026-09-06 internal doc; single-source there too.]**

### 1.8 "Business Verification" vs "App Verification" as of 2026, and can a solo dev defer it?

There are **four** distinct Meta things that all get called "verification." Keeping them straight
matters because only one of them is on FollowUp's critical path:

1. **Business Verification (BV)** — backend/operational, invisible to end users. Proves the business
   portfolio is a real registered entity. **This is the one that gates Advanced Access.** Free.
   **[Grade B/C.]**
2. **Advertiser Verification (AV)** — separate protocol, relevant to running ads, not to API access.
   **[Grade C.]** Not on FollowUp's path.
3. **Meta Verified for Business** — the **paid subscription** with the blue/green check, impersonation
   monitoring, priority support. Tiered pricing per platform. **This is a marketing product, not an
   API gate. Do not buy it for App Review.** **[Grade C — Hootsuite + androidinfotech, consistent.]**
4. **Developer organization / admin verification** — this exists, but the results I found describing
   it are **Meta Horizon OS / Quest store** (`developers.meta.com/horizon/...`), not the
   Facebook/Instagram Graph platform. On Horizon, an independent developer can verify via
   **admin identity verification with a government ID**, done in minutes, instead of business
   verification. **[Grade C.]**

**Critical caveat:** I found **no evidence** that the Horizon-style "verify an admin's government ID
instead of a business" escape hatch exists for the Facebook/Instagram Graph API platform.
Everything on the Graph side points to business-entity BV for Advanced Access. **Do not assume the
ID-only path is available here. FLAGGED — UNCONFIRMED, and it would be the single biggest
cost/time saver if it turned out to exist. Worth 15 minutes in the App Dashboard's verification
flow to check what options it actually offers a Canadian individual before registering the sole prop.**

**Can a solo developer defer BV?** For *building and demoing*, yes indefinitely — Development mode
needs no verification at all. For *serving a single real paying customer whose IG/Page you don't
own*, **no**. There is no documented skip, defer, or grace period; community reports show BV
pending simply blocks the App Review submission. **[Grade C.]** In practice BV is deferrable only
as long as revenue is deferrable.

### 1.9 The exact limits of Development mode / the tester path

**What Development mode gives you:** the app functions fully, with real (non-Advanced) permissions,
for anyone holding an app role — **Administrator, Developer, Tester, Analytics User** — assigned in
the App Dashboard's Roles tab. Each such person needs their own Meta Developer account and must
**accept** the role invitation. **[Grade B/C.]**

**The part that actually bites — and it is worse than "25 customers":**

> "Until your app has been submitted and approved for public use on Messenger through Meta's App
> Review, Page tokens only allow your Page to interact with Facebook accounts that have been
> granted the Administrator, Developer, or Tester role for your app."
> **[Grade B — Meta Messenger Platform overview via snippet, corroborated by the Expertflow and
> messengerbot.app setup guides.]**

Read that carefully. In Development mode the restriction is not just on **who can connect their
Page** — it is on **who can message it**. So when a tester's Page is connected:

- The **tester (business owner) can connect** their Page/IG and OAuth succeeds.
- But **an actual lead** — a random member of the public DMing that Page or IG account — has no app
  role, so **their message does not produce a usable webhook event / the Page token can't act on
  it.** The connection looks healthy and then silently does nothing on real traffic.
- Same for Instagram: only people with a role on the app can send messages that the app can see.
- Consequence: **you cannot pilot with a real customer's real leads in Development mode.** You can
  only demo with yourself and other role-holders playing the lead. Every "lead" in a demo has to be
  a Meta account you've added as a Tester.
- `leads_retrieval` in Development mode is similarly limited to your own test Pages and forms —
  "Standard Access only works with your own test Pages and forms." **[Grade C.]**

**How many testers?** The founder's working assumption is 25. **I could not confirm any documented
numeric cap on Meta app roles (Administrator/Developer/Tester) — four separate searches returned
nothing, and the only "25" figures in results were Apple TestFlight, not Meta. FLAGGED —
UNCONFIRMED. The number 25 may be a conflation with a different Meta product limit.** The 2026-09-06
internal doc also asserts 25 without a supporting citation, so it is not independent corroboration.
**Do not build a plan on "25 free pilot customers."** Even if 25 is correct, per the paragraph above
the ceiling that matters is *the leads can't message you*, which makes the tester count nearly
irrelevant for a pilot. Check the live Roles tab for a cap.

Also note the standing product constraint once live: Instagram/Messenger allow free-form replies
only within **24 hours** of the lead's last inbound message; after that only limited Human Agent
messages (7-day window, customer-support framing). **[Grade C — carried from the 2026-09-06 internal
doc, sourced to blotato.com.]**

---

## 2. GOOGLE

### 2.1 The three publishing states and what each costs you

**Testing mode (where FollowUp is now):**

- Hard cap of **100 test users** listed on the consent screen; every business that connects counts
  against it. **[Grade B — Google Cloud help `answer/15549945` via snippet, corroborated by Unipile.]**
- **Refresh tokens issued by an unverified app expire after exactly 7 days.** A test user's
  authorization dies a week after consent and needs re-consent. **[Grade B — same sources, plus
  multiple Google Groups threads and two independent 2026 blog write-ups of hitting this.]**
- Google shows a warning before the consent screen telling the user this is an unverified app and
  they should consider the risk. **[Grade B.]**

**This 7-day expiry — not the 100-user cap — is the real blocker.** FollowUp's whole value
proposition is unattended background follow-up via a stored refresh token. In Testing mode every
customer's Gmail silently disconnects weekly. There is no production pilot possible on Testing mode.

**Published + unverified:** the "This app isn't verified" interstitial appears for every new user,
requiring an "Advanced → go to (unsafe)" click-through. **[Grade B — `support.google.com/cloud/answer/7454865`.]**
For sensitive/restricted scopes this state is not a viable steady state.

**Published + verified:** no cap, no interstitial, normal long-lived refresh tokens.

### 2.2 What verification actually requires

**Brand verification** (app name, logo, support email, homepage, privacy policy, ToS all consistent):

- ~**2-3 business days**. May be folded into the sensitive-scope request as a subset. **[Grade C —
  singhamandeep brand-verification guide; Google's own brand-verification page surfaced but
  unfetchable.]**
- You must have a **published branding status before you can request data-access verification**.
  **[Grade B/C.]**

**Domain verification:**

- You must verify ownership of the OAuth client's **authorized domains** in **Google Search
  Console**, using a Google account that is an **Owner or Editor on the GCP project**. **[Grade B —
  `support.google.com/cloud/answer/13804266` via snippet.]**
- Verify the **top private domain** (`followupbase.io`), not a subdomain — if the homepage is
  `https://sub.example.com/product`, you verify `example.com`. **[Grade B.]**
- Must be a **Domain property (DNS-level)**, **not** a "URL prefix" property. **[Grade C — stated by
  two guides; this trips people constantly.]**
- Free.

**Homepage requirements:**

- Publicly accessible (**not** behind login), containing **a description of the app's functionality**
  plus links to the privacy policy (and optionally ToS). "The relevance of your home page to the app
  under review must be clear." **[Grade B — Google Cloud verification-requirements page via snippet.]**
- So `followupbase.io` must, in plain public copy, describe that FollowUp reads a connected Gmail
  inbox to identify sales inquiries, sends replies from it, and creates calendar events. A pure
  marketing page that never mentions Gmail is a rejection risk.

**Privacy policy requirements:**

- Must be **linked from the OAuth consent screen**, and **the policy linked from the homepage and
  the one on the consent screen must be the same**. **[Grade B — Google API Services User Data Policy.]**
- Must be **on the same domain** as the app — a policy hosted on a different domain (Notion,
  Termly, a Google Doc) is a cited rejection trigger. **[Grade C.]** FollowUp is fine here:
  `src/app/privacy/page.tsx` serves `followupbase.io/privacy`.
- Must actually **disclose how the app accesses, uses, stores and shares Google user data** —
  not boilerplate. **[Grade B.]**
- Must carry an **affirmative Limited Use statement**, either in-product or on a website page linked
  from the homepage. **[Grade B — Google API Services User Data Policy via snippet.]** FollowUp
  already has this: the "Google user data — Limited Use disclosure" section at
  `src/app/privacy/page.tsx:84-105`, linking Google's policy. **Confirm the homepage links to it.**

**Scope justification:** each scope tied to a concrete feature, using the **least privilege**
necessary. Over-broad scopes and weak justifications are top rejection reasons. **[Grade B/C.]**
Draft justifications already exist at `followup/docs/channel-verification-submissions.md` — they
are good and match the code.

**Demo video:**

- Must show the **complete OAuth consent screen with the exact same scopes being requested**, with
  the **language toggled to English**. **[Grade B — `support.google.com/cloud/answer/13804565`
  ("Demo Video") via snippet.]**
- Must demonstrate the app functionality that uses each requested scope. **[Grade B.]**
- For Gmail specifically: demonstrate **bi-directional** functionality — show synchronisation
  between the app and Gmail (e.g. send an email from FollowUp, then show it appearing in the Gmail
  sent folder). **[Grade C.]**
- Narration (voice or on-screen text) explicitly calling out each requirement is recommended by
  Google and "can greatly help facilitate the review." **[Grade B.]**

### 2.3 CASA — the expensive part, and what changed in 2026

**Applies because of `gmail.readonly` only.** `gmail.send` and `calendar.events` are sensitive, not
restricted, and do **not** trigger CASA on their own.

**The tier model changed.** The old Tier 1/2/3 naming is **legacy**. The App Defense Alliance now
uses **Assurance Levels**: **AL1** and **AL2** (with AL0 as a non-certifying developer
self-assessment). **[Grade B/C — deepstrike + valuementor both describe the AL1/AL2 model and the
ADA `casa/casa-tiering` page is titled "Assurance Levels"; I could not fetch the ADA page itself.]**

| Level | What it is |
|---|---|
| AL0 | Developer self-assessment, **produces no formal certification** **[Grade C]** |
| **AL1** — "Verified Self-Assessment" | Developer submits evidence + compliance statements for every audit test case, **including required automated scan artifacts**; an **ADA-approved lab reviews the evidence** without testing the running app **[Grade C]** |
| **AL2** — "Lab Assessment" | The lab evaluates every test case **directly against the running application** (DAST scan by an authorised lab) **[Grade C]** |

**Is there still a free Tier 1 self-assessment?** Partly — and the framing in the sources is
misleading. What is described as "free Tier 1, fill out a self-assessment, no cost" applies to apps
that request **only** `openid`/`email`/`profile` — i.e. plain Sign-in-with-Google. **[Grade C.]**
That is **not FollowUp**. Multiple sources state that **for all restricted scopes, Tier 2 / lab
involvement is mandatory**. **[Grade C.]** So: **no free path for `gmail.readonly`.**

**You do not choose your level — Google assigns it**, based on data sensitivity, **user count**, and
its own risk signals. **[Grade C — deepstrike + valuementor, consistent.]** **No source gave a
numeric user-count threshold for AL1 vs AL2. FLAGGED — UNCONFIRMED.** A small pre-revenue app *might*
land on the cheaper AL1 evidence-review path; do not assume it.

**Cost:**

| Source | Figure |
|---|---|
| Overall range across labs | **$500 – $4,500** **[Grade C — deepstrike]** |
| TAC Security base AL2/"Tier 2" | **$540 per app** — described as a **Google-negotiated discounted rate** **[Grade C — switchlabs + tacsecurity, consistent with the 2026-09-06 internal doc]** |
| TAC Security "Premium" (unlimited rescans) | **$720** **[Grade C]** |
| TAC Security "Enterprise Tier 2" (unlimited assessments) | **$1,800** **[Grade C]** |
| Higher-level / comprehensive review | ~**$4,500** one-time **[Grade C]** |

**This is annual, not one-time.** Restricted-scope apps must complete a security assessment every
12 months, timed from the effective date of the previous **Letter of Validation (LOV)** (some
sources say Letter of Assessment / LOA — same artifact, inconsistent naming). Miss the window and
Google can revoke production access. **[Grade B/C — `support.google.com/cloud/answer/13463816`
"Annual Recertification" via snippet, corroborated by two labs.]**

**Approved labs named across sources:** TAC Security (repeatedly described as the Google-preferred /
discounted lab), Leviathan Security Group, NCC Group, DEKRA, Coalfire, Prescient Security,
NetSentries. **[Grade C — no single source lists all; the ADA maintains the authoritative list,
which I could not fetch. Get the current list from the console/ADA before paying anyone.]**

**Conflicting claim, flagged:** one source (Explosion's Gmail API guide) asserts `gmail.readonly`
triggers **Tier 3 — "a full penetration test that costs thousands"**. Every other source says
Tier 2 / AL2 is what restricted scopes require, and that Tier 3 is for Google Workspace Marketplace
badges. **[Grade D — I judge the Tier-3 claim to be wrong, but flagging it because if it were right
the cost is ~10× the plan.]** Resolve this by asking the lab for a quote against your actual scope
list before committing.

### 2.4 Google timelines

| Step | Time |
|---|---|
| Brand verification | 2-3 business days **[Grade C]** |
| Sensitive-scope verification (complete submission) | 3-5 business days typical; up to ~10 days; 2-4 weeks when adding new sensitive scopes **[Grade C — sources give overlapping but not identical bands]** |
| Restricted-scope + CASA, end to end | **4-12+ weeks** from first submission **[Grade C — two independent sources, one of them Nylas's provider guide written for exactly this class of email SaaS; matches the 6-12 weeks in the internal 2026-09-06 doc]** |

**Start CASA in parallel with the OAuth review, not after it** — they are not required to be
sequential and CASA is the long pole. Note though that one source says the OAuth review team
"will reach out to you when it's time to start the security assessment," implying Google gates
the start. **[Grade C — mild conflict; ask the review team directly.]**

### 2.5 Common Google rejection reasons

- **Mismatched branding** — app name/logo/support email inconsistent between the consent screen,
  the homepage, and the domain. Most-cited trigger. **[Grade C]**
- Privacy policy **missing, on a different domain, or not actually describing Google user data
  handling**. **[Grade C]**
- **Over-broad scopes / weak justifications** not tied to a concrete feature. **[Grade C]**
- **Incomplete demo video** — skips the consent screen, or doesn't show the data in use. **[Grade C]**
- Homepage **not publicly accessible** or not obviously related to the app under review. **[Grade B]**
- Domain verified as a **URL-prefix property instead of a Domain property**. **[Grade C]**

---

## 3. Sequenced checklist — order, cost, and what defers

### Phase 0 — free, do now, unblocks everything else (days)

| # | Action | Cost |
|---|---|---|
| 0.1 | Confirm `followupbase.io` resolves over **HTTPS**, homepage is public, shows business name in `<title>`, has a footer contact element, **and describes in plain copy that FollowUp reads/sends Gmail and creates Calendar events**. | $0 |
| 0.2 | Ensure the homepage **links to `/privacy`**, and that `/privacy` is the *same* URL configured on the Google consent screen. | $0 |
| 0.3 | Set up **`verification@followupbase.io`** (a forwarding alias is enough). Use it for both Meta and Google submissions. | $0 at most registrars |
| 0.4 | Google Search Console: verify **`followupbase.io` as a DNS Domain property**, from a Google account that is Owner/Editor on the GCP project. | $0 |
| 0.5 | Meta App Dashboard → Settings: fill the **Data Deletion Callback URL or Data Deletion Instructions URL**. See §4.1 — this is a hard submission blocker. | $0 |
| 0.6 | Check the Meta App Dashboard's verification flow for whether an **individual/ID-based** verification path is offered to a Canadian individual (§1.8, item 4). If it is, the sole-prop registration may be unnecessary. | $0 |
| 0.7 | Check whether the `leads_retrieval` request form demands **`pages_manage_ads`** (§1.6). Decide then whether to drop `leads_retrieval` from the first submission. | $0 |
| 0.8 | Check the live Roles tab for an actual tester cap (§1.9). | $0 |

### Phase 1 — Google, the cheap half (1-2 weeks, $0)

Do Google first: it is cheaper, faster, and Gmail is the channel with the most immediate customer
value. **Decision point before submitting** — see §4.4 on whether to ship without `gmail.readonly`.

| # | Action | Cost |
|---|---|---|
| 1.1 | Finalise app info + scope justifications (drafts already written in `docs/channel-verification-submissions.md`). | $0 |
| 1.2 | Record the **Google demo video**: English UI, full consent screen showing the exact scopes, then each scope's feature in use, bi-directional Gmail send→sent-folder. Narrate. | $0 |
| 1.3 | Submit **brand verification** (2-3 days). | $0 |
| 1.4 | Submit **sensitive-scope verification** for `gmail.send` + `calendar.events`. | $0 |

### Phase 2 — Meta, free but slow (6-10 weeks, $60)

| # | Action | Cost |
|---|---|---|
| 2.1 | Register the **Ontario Business Name Registration** (ex-Master Business Licence) at ServiceOntario, using the exact legal name you will type into Meta Business Manager. | **CAD $60** (5 yrs) |
| 2.2 | Line up the **second document** proving address + phone (business bank statement in the registered name, or CRA business-number / GST-HST document). Do not rely on a personally-named utility bill. | $0-varies |
| 2.3 | Submit **Meta Business Verification** from the business-domain email. Wait. Do not resubmit same-day on rejection. | $0 |
| 2.4 | Record **one screencast per permission** (§1.3). Prepare working reviewer test credentials with no staging password in front of them. | $0 |
| 2.5 | Submit **App Review** for the Instagram pair, then Messenger/Pages, then `leads_retrieval`. Consider submitting Instagram alone first — a rejection on `leads_retrieval` shouldn't reset the IG clock. **[Judgement call, not a sourced rule.]** | $0 |
| 2.6 | Budget one revise-and-resubmit cycle (~20 days each). | $0 |

### Phase 3 — CASA, the only real money (4-12 weeks, $540-$1,800/yr) — DEFER

| # | Action | Cost |
|---|---|---|
| 3.1 | Get quotes from ≥2 ADA-approved labs against your actual scope list. Confirm AL1 vs AL2, and resolve the Tier-3 claim in §2.3. | $0 |
| 3.2 | Complete the CASA scoping questionnaire (infra, token storage, encryption, incident response). | $0 |
| 3.3 | Pay for and pass the assessment; remediate findings; lab issues the LOV to Google. | **$540-$1,800**, recurring annually |
| 3.4 | Google grants restricted-scope approval; diarise **annual recertification** from the LOV effective date. | — |

### Cost summary

| Item | Cost | Timing |
|---|---|---|
| Ontario Business Name Registration | **CAD $60** / 5 years | Before Meta BV |
| Business-domain email alias | ~$0 | Now |
| Google Search Console domain verification | $0 | Now |
| Meta Business Verification | $0 | — |
| Meta App Review (all permissions) | $0 | — |
| Google brand + sensitive-scope verification | $0 | — |
| **Google CASA (only because of `gmail.readonly`)** | **$540-$1,800/yr** (range across labs $500-$4,500) | Deferrable |
| Meta Verified subscription | **not needed — do not buy** | — |

**Total unavoidable spend to get Instagram/Messenger/Lead-Ads live and Gmail-send + Calendar live:
CAD $60.** Everything else in that path is free.
**Adding Gmail inbox *reading* costs $540+/year forever on top.**

### What defers until there are paying customers

- **All of Phase 3 (CASA, $540+/yr).** Defer by shipping without `gmail.readonly` (§4.4) —
  `gmail.send` + `calendar.events` alone verify for free.
- **Any pentest** (see `research/market/2026-09-08-pentest-vendor-options.md`) — CASA AL2 is a lab
  DAST scan, not a pentest, and is not the same purchase.
- **SOC 2.** Not required by either platform.

### What does *not* defer

- **Meta BV + App Review** — Development mode cannot serve one real customer's real leads (§1.9).
- **Google publishing + sensitive-scope verification** — the 7-day refresh-token expiry makes
  Testing mode unusable for unattended follow-up, regardless of the 100-user headroom.

---

## 4. Gotchas specific to this app

### 4.1 Meta: the data-deletion requirement is a hard submission blocker

Meta requires a **Data Deletion Callback URL** *or* a **Data Deletion Instructions URL** in the App
Dashboard, and **you cannot submit for App Review or switch to Live mode without one**. **[Grade C —
stated by two sources; Meta's own `data-deletion-callback` doc surfaced but was unfetchable.]**

Two paths:
- **Instructions URL** (simpler): a public page describing exactly **what data you hold, what gets
  deleted, and a timeframe**. "Email us to delete your data" with no detail is explicitly called out
  as insufficient. **[Grade C]**
- **Callback URL** (more work): an HTTPS endpoint receiving a POST with a signed request containing
  an app-scoped user ID; you must return **a confirmation code and a status URL**. **[Grade C]**

**Where FollowUp stands:** `src/app/privacy/page.tsx:106-130` already has an "Instagram and Facebook
data — Meta Platform Terms" section that names deletion and points at the account-deletion process
and Facebook's app-removal settings; `:151-169` is the "Data retention & deletion" section, which
already commits to **confirming deletion within 2 business days**. That is close to sufficient as an
Instructions URL — it names what's held, how to delete, and a timeframe.

**Action:** point the App Dashboard's Data Deletion field at
`https://followupbase.io/privacy` (or better, an anchor to the deletion section) and re-read that
section against "what data / what gets deleted / timeframe."
**Reviewers cross-check the deletion method against the privacy policy against the permissions
requested — inconsistency between those three is a named rejection trigger.** **[Grade C]** So the
privacy policy's list of Meta data must match the five Facebook + two Instagram permissions in §0.

### 4.2 Google: the homepage, not just the privacy policy

The privacy policy is in good shape. The **homepage** is the likelier gap: Google requires it to be
public and to **describe the app's functionality** clearly enough that its relevance to the reviewed
app is obvious. **[Grade B]** A landing page selling "never miss a lead" without ever saying
"connects your Gmail" is exactly the ambiguity that causes a clarification round. Add explicit
copy naming Gmail and Google Calendar, plus the homepage→privacy-policy link carrying the Limited
Use statement.

### 4.3 Meta: the Instagram screencast needs a real IG Business/Creator account

Two sources say App Review for `instagram_business_manage_messages` wants a **real Instagram
Business or Creator account, not a developer test user**. **[Grade C, UNCONFIRMED against Meta docs.]**
Meanwhile Development mode means only role-holders can message it. So the recording setup is:
a real IG Business account you control, connected to FollowUp, with a *second* real Meta account
that you have added as a **Tester** playing the lead who sends the DM. Set this up before you start
recording — it is the fiddliest hour in the whole process.

### 4.4 The single highest-leverage decision: `gmail.readonly`

`gmail.readonly` is the **only** reason CASA applies. Dropping it turns a $540+/yr, 4-12-week,
annually-recurring obligation into a free 1-2-week review. But:

- **Every other Gmail read scope is also restricted** — `gmail.metadata`, `gmail.modify`,
  `gmail.compose`, `gmail.insert` are all on the restricted list. **[Grade C]** So there is **no
  cheaper read scope**. The 2026-09-06 internal doc floated `gmail.metadata` as a possible
  workaround — **that is wrong; it is equally restricted.** Correction worth propagating.
- Gmail **add-on** scopes avoid the assessment but are for Workspace add-ons, not a web SaaS
  reading an inbox in the background. **[Grade C]** Not applicable.

So the real fork is binary: **either FollowUp reads the inbox (CASA, $540+/yr, forever) or it
doesn't (free).** A "Gmail-send + Calendar only" build — where leads arrive via IG/Messenger/Lead
Ads/forms and Gmail is only ever a *sending* channel — verifies for free in ~2 weeks and is a
legitimate v1. `fetchSalesConversations()` is the feature that costs $540/year. That should be an
explicit product decision, not an accident of the scope array.

### 4.5 Meta: don't buy Meta Verified

The paid blue/green-check subscription (§1.8 item 3) does nothing for API access. It is easy to
buy under deadline pressure believing it unblocks App Review. It does not.

### 4.6 Both: name consistency is the cheapest thing to get wrong

The legal name on the Ontario registration, the name in Meta Business Manager, the Meta app name,
the Google OAuth app name, the homepage `<title>`, and the privacy-policy entity name should all be
the same string. Name mismatch is the #1 cited Meta BV rejection cause and "mismatched branding" is
the #1 cited Google rejection cause. **Decide the exact legal name before registering the sole prop,
because the $60 registration is what everything else has to match.**

---

## Open questions / could not confirm

1. **The 25-tester Development-mode limit** — no documented Meta cap found. §1.9. **Check the live
   Roles tab.**
2. **Whether the Ontario Business Name Registration is explicitly accepted by Meta** — inferred
   from category matching, never seen stated. §1.7.
3. **Whether an individual/government-ID verification path exists on the Facebook-Instagram Graph
   platform** (as it does on Meta Horizon). If yes, it removes the $60 and the whole BV paperwork
   burden. **Highest-value open question in this document.** §1.8.
4. **Whether `pages_manage_ads` is mandatory in a `leads_retrieval` submission** that never reads
   ad-level fields. §1.6.
5. **AL1 vs AL2 user-count thresholds** — no numeric threshold published in any source found. §2.3.
6. **Whether `gmail.readonly` maps to AL2/Tier 2 (most sources) or Tier 3 (one source)** — a ~10×
   cost difference. §2.3.
7. **Whether a business-domain email is a hard requirement or a strong signal** for Meta BV. §1.7.
8. **Whether a personal mobile number is acceptable** as the Meta BV business phone. §1.7.
9. **Whether Google gates the *start* of CASA** on its own review, or whether it can truly run in
   parallel. §2.4.
10. **Meta's current official stated App Review SLA** — the "20 days" figure is from a secondary
    source describing Meta's dashboard copy, not the dashboard itself. §1.4.

---

## Sources checked 2026-09-10

WebFetch was **egress-blocked** for `developers.facebook.com`, `developers.google.com`, and
`appdefensealliance.dev`; all official-doc content below reached me as search-result snippets only.

Meta / official-ish:
- https://developers.facebook.com/blog/post/2023/02/01/developer-platform-requiring-business-verification-for-advanced-access/
- https://developers.facebook.com/docs/development/release/business-verification/
- https://developers.facebook.com/docs/permissions/
- https://developers.facebook.com/docs/development/build-and-test/app-modes/
- https://developers.facebook.com/docs/development/build-and-test/app-roles/
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads
- https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving
- https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback
- https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide
- https://developers.facebook.com/docs/instagram-platform/overview/
- https://www.facebook.com/business/help/2058515294227817
- https://www.facebook.com/business/help/1095661473946872
- https://developers.meta.com/horizon/resources/publish-organization-verification/
- https://developers.meta.com/horizon/blog/developer-organization-verification-what-you-need-to-know/

Meta / secondary:
- https://bundle.social/blog/meta-app-review-20-days
- https://singhamandeep.com/what-is-meta-advanced-access/
- https://singhamandeep.com/instagram-messaging-api-approval-getting-instagram_business_manage_messages-2026/
- https://singhamandeep.com/instagram-api-advanced-access-approval/
- https://singhamandeep.com/meta-app-review-screencast-why-your-demo-video-gets-rejected-2026/
- https://singhamandeep.com/meta-business-verification-documents-required/
- https://singhamandeep.com/facebook-data-deletion-callback-url/
- https://singhamandeep.com/leads-retrieval-permission-approval-facebook-lead-ads-api/
- https://singhamandeep.com/meta-app-review-how-long-does-it-take/
- https://woopsocial.com/blog/meta-app-review-rejected-2026-fix-guide
- https://www.saurabhdhar.com/blog/meta-app-approval-guide
- https://www.postmoo.re/blogs/meta-app-review-disapproved-how-to-get-approved
- https://saveoffice.io/blog/meta-business-verification-documents
- https://saleshiker.com/blog/meta-business-verification-document-requirements-phone-number/
- https://anylinga.com/blog/en/meta-business-verification-rejected-7-fixes.html
- https://support.wati.io/en/articles/11463208-meta-business-verification-required-documents-by-country
- https://docs.360dialog.com/docs/resources/meta-business-verification/classic-business-verification
- https://support.convertrmedia.com/hc/en-us/articles/360010746573-Completing-the-Facebook-App-Review
- https://www.blotato.com/blog/instagram-messaging-api
- https://www.getphyllo.com/post/instagram-api-integration-101-for-developers-of-the-creator-economy
- https://docs.expertflow.com/cx-knowledgebase/latest/facebook-connector-deployment-guide
- https://messengerbot.app/facebook-messenger-webhook-setup-2026-developer-guide-for-receiving-and-responding-to-messages/
- https://blog.hootsuite.com/meta-verified/
- https://www.androidinfotech.com/all-meta-verified-business-plans-compared-the-definitive-2026-guide/
- https://communityforums.atmeta.com/discussions/Questions_Discussions/business-verification-in-review-10-days-%E2%80%94-blocking-app-review-submission/1372323

Google / official-ish:
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://developers.google.com/terms/api-services-user-data-policy
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://support.google.com/cloud/answer/13464321 (verification requirements)
- https://support.google.com/cloud/answer/13804565 (demo video)
- https://support.google.com/cloud/answer/13804266 (domain verification)
- https://support.google.com/cloud/answer/13807380 (requesting minimum scopes)
- https://support.google.com/cloud/answer/13463816 (annual recertification)
- https://support.google.com/cloud/answer/13465431 (security assessment)
- https://support.google.com/cloud/answer/15549945 (manage app audience / 100 test users)
- https://support.google.com/cloud/answer/7454865 (unverified app screen)
- https://appdefensealliance.dev/casa/casa-tiering
- https://appdefensealliance.dev/casa/tier-2/tier2-overview

Google / secondary:
- https://deepstrike.io/blog/google-casa-security-assessment-2025
- https://valuementor.com/blogs/casa-certification-for-web-applications-and-apis-the-engineering-guide-to-al1-al2-assessment
- https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option
- https://tacsecurity.com/google-casa-cloud-application-security-assessment/
- https://casa.tacsecurity.com/site/home
- https://www.leviathansecurity.com/programs/google-casa-cloud-application-security-assessment
- https://prescientsecurity.com/casa
- https://developer.nylas.com/docs/provider-guides/google/google-verification-security-assessment-guide/
- https://www.nylas.com/blog/google-oauth-app-verification/
- https://singhamandeep.com/google-oauth-verification-guide/
- https://singhamandeep.com/google-oauth-brand-verification/
- https://www.unipile.com/google-oauth-100-user-limit/
- https://www.unipile.com/google-oauth-refresh-token/
- https://www.unipile.com/gmail-api-scopes-guide/
- https://www.explosion.com/210203/gmail-api-integration-guide-oauth-scopes-and-casa/
- https://www.shipaddons.com/blog/google-oauth-verification-guide
- https://meetorbis.com/blog/how-we-passed-google-casa-tier-2-with-claude
- https://buzzclan.com/cyber-security/google-casa-tier-2-assessment/

Ontario / sole proprietorship:
- https://help.ownr.co/en/articles/5739448-the-master-business-license-is-now-called-the-business-name-registration-for-a-sole-proprietorship
- https://www.ownr.co/blog/master-business-licence/
- https://www.ontariobusinesscentral.ca/blog/master-business-licence-registration-in-ontario/
- https://enterprisecentre.ca/starting-a-business/registration-licensing/master-business-licence/
- https://www.simplyfybiz.com/blog/register-sole-proprietorship-ontario

Internal material read first:
- followup/src/app/privacy/page.tsx
- followup/src/lib/instagram.ts
- followup/src/lib/facebook.ts
- followup/src/lib/integrations/gmail.ts
- followup/docs/channel-verification-submissions.md
- followup/research/integrations/2026-09-06-gmail-oauth-verification.md
- followup/research/integrations/2026-09-06-instagram-meta-business-verification.md
- followup/research/market/2026-09-08-pentest-vendor-options.md (house style)
