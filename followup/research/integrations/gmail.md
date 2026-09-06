# Gmail — production-readiness research

**Researched:** 2026-09-05, by integrations-research-agent
**Status of this write-up:** first pass. No prior file existed in `research/integrations/`.

## Methodology note (read before trusting exact numbers)

`WebFetch` was unavailable for this entire task — every domain tried (`developers.google.com`,
`support.google.com`, `docs.cloud.google.com`, and every third-party site, down to
`en.wikipedia.org` as a control) came back `EGRESS_BLOCKED` from this sandbox's network policy.
Per the sandbox's own guidance that governs this ("do not retry or route around it — report the
blocked host"), all findings below come from `WebSearch` instead — which does reach and quote live
Google documentation and reputable secondary sources, just through a different path than a direct
fetch from this session. Every claim below is cited with the URL WebSearch attributed it to and
checked 2026-09-05. Where independent secondary sources gave conflicting exact numbers, I've said
so explicitly rather than picking one — **whoever provisions the real Google Cloud project should
re-confirm exact quota figures directly in Cloud Console / the cited developers.google.com pages
before relying on them for capacity planning**, since I could not verify them against the primary
source myself in this environment.

## Correction to an assumption baked into README.md / backend-agent.md / manager-agent.md

**`src/lib/integrations/gmail.ts` is not a mock.** I read the full file before researching (per
this agent's own instructions) and it is a complete, real implementation: a real
`google.auth.OAuth2` client, a real consent-URL builder (`startGmailOAuth`), a real token exchange
(`exchangeCodeForTokens`), real Gmail API calls (`gmail.users.threads.list/get`,
`gmail.users.messages.send`) with Prisma persistence, a real Calendar API integration
(`createCalendarEvent`), spam-folder scanning, and defensive concurrency capping
(`mapWithConcurrency(threadRefs, 5, ...)`) with a comment that already shows awareness of Gmail/API
rate limits. There is no demo-data branch inside this file at all.

This contradicts the framing in:
- `followup/README.md`'s table, which lists `src/lib/integrations/gmail.ts` as the "File to edit"
  to make Gmail real — implying code work remains. It doesn't; the file already **is** the real
  implementation.
- `followup/.claude/agents/manager-agent.md`'s own worked example: *"'get ready for real Gmail' is
  integrations-research-agent on verification requirements, then backend-agent to implement
  against those findings."* For Gmail specifically, there is essentially no implementation gap
  left for backend-agent — see "Hard blockers" below, all of which are external
  (credentials/provisioning/Google's review process), not code.

I went looking for the actual demo/real switch and it's less clean than I expected — worth
someone's attention, not just a footnote. Settings' "Connect Gmail" button (`src/app/(app)/settings/page.tsx`)
is a plain `href="/api/integrations/gmail/connect"` link straight to the real route, which calls the
real `startGmailOAuth()` — **no demo branching at all** in that path. Same for its "Sync now" and
"Scan spam" buttons (`/api/integrations/gmail/sync`, `/api/integrations/gmail/scan-spam`) — real
routes, real `gmail.ts` functions, gated only by `getSessionContext()` (real NextAuth) returning a
real session. Meanwhile the Dashboard/Leads/Pipeline pages import from `src/lib/demo-data.ts`
directly for what they display. So the actual split isn't "these buttons are fake, these are real"
as README.md's blanket "Send email, Connect Gmail, Send now... are demo interactions" line implies —
it looks closer to "the integration actions are already real and will genuinely try to hit Google
the moment credentials exist and someone can sign in, while the data shown elsewhere in the UI is
still demo-data until a real sync populates the real DB." I did not do a full page-by-page audit of
every button (out of scope for what was asked here) — but this is enough to say the README's framing
undersells how real this already is, and someone should double check there isn't a half-wired state
where a stray demo account could trip a real Google API call before Gmail is meant to go live.

Practical implication for this report: because the *code* is already real, "going live" for Gmail
is overwhelmingly a **provisioning + Google-review** problem, not a backend engineering problem. It
also needs a real Postgres database (`DATABASE_URL`) to be live at all, since every function here
reads/writes through `prisma` — that's the README's separately-tracked DB gap, not a new one.

---

## 1. Google Cloud OAuth consent-screen verification

### 1.1 What FollowUp actually requests

`gmail.ts`'s `SCOPES` constant:
```
gmail.readonly, gmail.send, calendar.events, userinfo.email
```

### 1.2 Scope classification (this determines everything else)

Google buckets OAuth scopes into three tiers — non-sensitive/basic, **Sensitive**, and
**Restricted** — and an app's overall verification requirement is set by its *most* restrictive
scope, not requested case-by-case:

- `gmail.readonly` is on Google's **Restricted** scopes list, alongside `gmail.modify`,
  `gmail.metadata`, `gmail.insert`, `gmail.compose`, `gmail.settings.basic/sharing`, and
  `https://mail.google.com/`.
  (Sources: [support.google.com/cloud/answer/13464325](https://support.google.com/cloud/answer/13464325?hl=en) — Restricted Scopes list; [unipile.com/gmail-api-scopes-guide](https://www.unipile.com/gmail-api-scopes-guide/), checked via WebSearch 2026-09-05.)
- `gmail.send` is classified **Sensitive**, not Restricted, on its own — it can only send, it can't
  read or delete existing mail.
  (Source: [unipile.com/gmail-api-scopes-guide](https://www.unipile.com/gmail-api-scopes-guide/), checked 2026-09-05.)
- `calendar.events` is also **Sensitive**.
- "If you request both `gmail.send` (Sensitive) and `gmail.readonly` (Restricted), your
  application is classified as Restricted" — i.e. **FollowUp's app is Restricted, full stop**,
  because it needs `gmail.readonly` to read conversations at all.
  (Source: same Unipile guide, checked 2026-09-05.)

There is no narrower-scope escape hatch here: `gmail.metadata` (headers only, no body) is also
Restricted and wouldn't satisfy the product anyway, since `classifyAsProspect`/scoring reads message
*bodies* (`extractPlainTextBody`). Dropping to a narrower scope doesn't avoid Restricted-tier review
for this product — reading inbox content is the core feature.

### 1.3 What "Restricted" means in practice: Testing vs. Production

An OAuth client starts in **Testing** publishing status. In that state, two things bite a real
multi-tenant SaaS immediately, corroborated across multiple sources:

- **100-user hard cap, and no self-serve.** Only users the developer has manually added to a "Test
  users" allowlist in Cloud Console can complete the OAuth flow at all — there is no path for an
  arbitrary small business to sign up and click "Connect Gmail" themselves. The cap applies "up to
  100 test users listed in the OAuth consent screen... regardless of how many test user emails you
  add." (Sources: [support.google.com/cloud/answer/15549945](https://support.google.com/cloud/answer/15549945?hl=en); [unipile.com/google-oauth-100-user-limit](https://www.unipile.com/google-oauth-100-user-limit/), checked 2026-09-05.)
- **Refresh tokens expire every 7 days while in Testing.** "Google automatically expires all
  refresh tokens issued by unverified apps after exactly 7 days as a security measure." Concretely:
  every connected business's Gmail sync/send would silently stop working weekly until they manually
  reconnect. (Sources: [unipile.com/google-oauth-refresh-token](https://www.unipile.com/google-oauth-refresh-token/); corroborated by a HomeSeer forum thread and Google's `adwords-api` group threads describing the same 7-day testing-mode behavior, checked 2026-09-05.)
- **The unverified-app warning is shown to every user, every time**, described next.

Once verification is granted, both the 100-user cap and the 7-day refresh-token expiry go away —
"once you submit for verification and Google approves your app, the 100-user cap is lifted and the
7-day expiry goes away... refresh token lifetime becomes indefinite (subject to remaining
conditions)." (Source: [tech.queenofsandiego.com — Fixing OAuth Token Expiration in Google Cloud](https://tech.queenofsandiego.com/posts/2026-05-06-2124.html), via WebSearch, checked 2026-09-05.)

### 1.4 What the "unverified app" warning actually looks like to a user

Before any scope consent, Google interstitial-screens the user with a warning headed **"Google
hasn't verified this app."** The body explains the app is requesting sensitive/restricted scopes
without having completed Google's review, and that they should only proceed if they trust the
developer. The user must click a small **"Advanced"** link, which reveals a
**"Go to [App Name] (unsafe)"** link, before they reach the normal permission-grant screen. Typing
past this is optional but requires that extra, scary-looking step — it is not a silent pass-through.
(Sources: [support.google.com/cloud/answer/7454865](https://support.google.com/cloud/answer/7454865?hl=en) — "Unverified apps"; TechCrunch's original coverage of Google launching this screen; multiple help-desk articles describing the same "Advanced" → "Go to X (unsafe)" click path, checked 2026-09-05.)

For FollowUp this means: even a single friendly pilot customer connecting their real Gmail, before
any verification is filed, sees a page telling them the app is unsafe and has to click through an
"unsafe" link — a rough first impression for a paid B2B tool, and one every reconnect (see 7-day
expiry above) repeats.

### 1.5 The verification steps themselves, in order

1. **Brand verification** — confirms app name/logo/homepage/support email and, critically,
   **domain ownership via Google Search Console** for whatever domain is on the OAuth consent
   screen and privacy policy. Usually automated and takes minutes; escalates to manual review
   (~2-3 business days) if Google's automated check can't resolve it. (Source: [developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) via WebSearch, checked 2026-09-05.)
2. **Sensitive-scope verification** — a Google reviewer checks: a live privacy policy hosted on
   the verified/owned domain (not a third-party page) that actually describes Google user data
   handling; a working homepage; and, **for every sensitive/restricted scope requested, a written
   justification for why a narrower scope wouldn't work plus a screen-recorded demo video** that
   shows the full OAuth consent flow (with the real app name/branding visible) and exactly how each
   scope is used in-product. Typically **3-5 business days**, but can extend across multiple
   remediation rounds if Google's reviewer asks follow-up questions. (Sources: [developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification); [support.google.com/cloud/answer/13804565](https://support.google.com/cloud/answer/13804565?hl=en) — Demo Video requirements; [support.google.com/cloud/answer/13464321](https://support.google.com/cloud/answer/13464321?hl=en) — Verification requirements, all via WebSearch, checked 2026-09-05.)
3. **Restricted-scope verification + security assessment** — because `gmail.readonly` is
   Restricted, FollowUp additionally needs a third-party security assessment against Google's
   **CASA** (Cloud Application Security Assessment) standard, culminating in a **Letter of
   Validation** submitted to Google. Google assigns a tier based on risk signals (scopes requested,
   user count, other app-specific signals):
   - **Tier 2** is what Google requires for apps using restricted scopes like Gmail access in the
     normal/expected case — a lab-validated self-assessment. Multiple assessor-pricing pages put
     Tier 2 at roughly **$500–$2,000** (one Google-negotiated discount program cites ~$540; other
     labs quote $800–$1,800 depending on package), turning around in about **1-3 weeks** to a
     Letter of Validation. (Sources: [deepstrike.io/blog/google-casa-security-assessment-2025](https://deepstrike.io/blog/google-casa-security-assessment-2025); [switchlabs.dev — CASA Tier 2 & Tier 3 pricing](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option), checked 2026-09-05.)
   - **Tier 3** is "the most rigorous level... reserved for the highest-risk cases" and is where
     the much scarier, widely-cited **$15,000–$75,000+** figure for Google's security assessment
     comes from (a GMass post titled exactly around that number). That figure predates/describes
     the harder, uncapped third-party-assessor path rather than the CASA Tier 2 self-assessment
     track most apps like FollowUp go through today. (Sources: [gmass.co — "$15,000-$75,000 OAuth verification"](https://www.gmass.co/blog/google-oauth-verification-security-assessment/); [support.google.com/cloud/answer/13465431](https://support.google.com/cloud/answer/13465431?hl=en) — Security Assessment, checked 2026-09-05.)
   - **Google itself does not disclose the exact tier-assignment thresholds** — "tier assignment is
     dynamic and based on multiple factors including user count and scopes" — so FollowUp cannot
     know with certainty it'll land in Tier 2 until it's actually in the process. Given FollowUp's
     profile (small-business SaaS, not yet at large scale, requesting a narrow, well-justified scope
     set), Tier 2 is the reasonable expectation, not a guarantee.
   - The **Google verification review itself is free**; it is specifically the third-party security
     assessment that costs money. (Source: WebSearch synthesis of the same restricted-scope-verification page, checked 2026-09-05.)

### 1.6 Realistic end-to-end timeline

Adding these up, and corroborated by a from-scratch estimate found independently ("after
submission, it can take anywhere from **2 to 8 weeks**, depending on Google's submission queue and
the number of remediation rounds"): budget **roughly 3-8 weeks** from "submit for verification" to
"fully verified, warning gone, 100-user cap lifted," assuming no major remediation loops, and
**longer** if Google comes back with scope-justification questions or the CASA assessor's report
needs revisions. One Google Cloud community thread reported a Workspace add-on verification stuck
**8+ weeks**, i.e. this is not a hypothetical worst case. (Sources: [Nylas — Google OAuth Verification: Costs, Timelines, Process](https://www.nylas.com/blog/google-oauth-app-verification/); [Google Cloud community — "OAuth Verification... Stuck for 8+ Weeks"](https://security.googlecloudcommunity.com/security-validation-5/oauth-verification-for-workspace-add-on-stuck-for-8-weeks-client-critical-6543), checked 2026-09-05.)

This timeline **does not start** until: the Google Cloud project exists, a real domain is owned and
verified in Search Console, and a demo video of the actual product is recorded. One of these is
further along than I expected going in: **`src/app/privacy/page.tsx` already exists**, and its own
code comment says it was written specifically for this — *"Required for Google OAuth verification
(the consent screen links here), so the Google API Services User Data Policy / Limited Use
disclosure below uses Google's own required wording, not paraphrased."* Reading it, it does name the
actual Gmail scopes' purpose, links Google's API Services User Data Policy, and states the Limited
Use commitments (no ads use, no human access without consent/abuse investigation, no third-party
transfer beyond the named AI provider) that verification reviewers specifically check for. Someone
already did this homework — it isn't a gap. What's still missing is getting it live on a
Search-Console-verified real domain (it's currently just a route in an unshipped app) and actually
linking it from the Cloud Console OAuth consent screen once that project exists — both provisioning
steps, not writing.

---

## 2. Gmail API quotas for a multi-tenant SaaS

Two separate limits matter, at two different layers, plus a third limit that's neither a Google API
quota nor per-project — it's per end-customer mailbox.

### 2.1 Per-connected-mailbox (per FollowUp tenant) API quota

Google's Gmail API usage-limits page describes a per-user rate limit — historically **250 quota
units/user/second** (≈15,000/minute), enforced as a moving average so short bursts are fine.
Multiple sources describe a **change effective May 1, 2026** (i.e. four months before this
research date, likely after this agent's training cutoff — treat as current but worth
double-checking against the live page): new Cloud projects are now subject to **6,000 quota
units/minute/user/project** — a reduction from the prior ~15,000/minute/user figure — alongside a
**1,200,000 quota units/minute** limit for the whole project. Projects that already had usage
between November 2025 and April 2026 keep their old quotas for now; a project FollowUp creates
today would fall under the **new, lower** per-user regime.
(Sources: [Nylas — Gmail API quotas and limits](https://developer.nylas.com/docs/cookbook/email/gmail-api-quotas/); [Nylas CLI — Gmail API Quotas in 2026](https://cli.nylas.com/guides/gmail-api-quotas-2026); [Unipile — Gmail API Limits](https://www.unipile.com/gmail-api-limits/), all via WebSearch, checked 2026-09-05. I could not load `developers.google.com/workspace/gmail/api/reference/quota` directly — see Methodology note — so **this recent-change claim specifically should be re-verified against that page before it's used for capacity planning**.)

A single small business's own sync (list one thread page + `threads.get` on up to 30 threads, per
`fetchSalesConversations`'s `maxResults: 30`) is nowhere close to either the per-user or per-project
ceiling on its own. `gmail.ts` already caps fan-out at 5 concurrent thread fetches per sync
(`mapWithConcurrency(threadRefs, 5, ...)`) — a sensible existing guard, not a gap.

**Per-method quota-unit costs are inconsistently reported across secondary sources** — one table
gave `messages.get`=20, `threads.get`=40; another gave `messages.get`=5(ish list-tier),
`threads.list`=10; all agree directionally (list < get < send, and `messages.send`/`drafts.send` = **100
units**, the most expensive single call), but I would not trust an exact per-method number from this
research without pulling it fresh from `developers.google.com/workspace/gmail/api/reference/quota`
once someone can reach it directly.

### 2.2 Per-project (shared across every FollowUp tenant) quota — the one that matters at scale

Because every tenant's Gmail calls run through the **same** Google Cloud project (one
`GOOGLE_CLIENT_ID`), the project-wide ceiling — **1,200,000 quota units/minute** under the post-May-2026
regime described above — is shared across FollowUp's entire customer base, not just one business.
Rough math at that ceiling: even at ~300-400 quota units per business per sync (a `threads.list` +
~30 `threads.get` calls), FollowUp would need on the order of **tens of thousands of businesses
syncing in the same one-minute window** before bumping into the project-wide per-minute limit — this
is a "watch it as you grow" concern, not a launch blocker. Google also introduced (same May 2026
change, per the same sources) an **80,000,000 quota-units/day per-project "billing threshold"** —
described as not yet triggering charges, with Google committing to ≥90 days' notice before it does.
(Sources: same as 2.1, checked 2026-09-05.)

A **quota increase** is requestable in Cloud Console (APIs & Services → Gmail API → Quotas →
"Request higher quota"), reportedly reviewed in **3-5 business days for smaller increases, up to two
weeks for large ones**, and Google asks for a written justification (expected daily active users,
average calls per user per day, breakdown by method). This is a lower-confidence claim (one source),
worth confirming once FollowUp actually has a project quotas page to look at.
(Source: [Unipile — Gmail API Limits](https://www.unipile.com/gmail-api-limits/), via WebSearch, checked 2026-09-05.)

### 2.3 Sending limits — per end-customer mailbox, not a FollowUp-wide bottleneck

Gmail's anti-abuse **sending** caps are enforced at the mailbox/account level and apply the same way
regardless of whether mail goes out via the web UI, SMTP, or the Gmail API — there is no separate,
larger "API sending" allowance:
- **500 recipients/24h** (rolling window, not midnight-reset) for a free/consumer Gmail account.
- **2,000 recipients/24h** for a Google Workspace account.
- Limits are recipient-counted, not message-counted — one email to 500 people exhausts a free
  account's whole daily budget the same as 500 separate one-to-one emails.
- Going over triggers a temporary sending suspension (roughly 1-24 hours depending on overage).
(Sources: [support.google.com/a/answer/166852](https://support.google.com/a/answer/166852?hl=en) — Gmail sending limits in Google Workspace; corroborated by GMass, Saleshandy, Smartlead, Mailreach sending-limits explainers, all describing the same 500/2,000 figures, checked via WebSearch 2026-09-05.)

Because `sendEmail()` in `gmail.ts` sends **as the connected business's own Gmail/Workspace
account** (not from a shared FollowUp-owned mailbox), this limit is **per tenant, not shared across
FollowUp's customer base** — good news for multi-tenant scaling. The practical implication is
narrower: a small business still using a free `@gmail.com` account (not Workspace) doing any kind of
bulk-ish follow-up sequence could realistically hit 500/day on its own, which is a product/support
consideration (warn or detect this) more than an infra one.

---

## Hard blockers before real Gmail can go live

1. **A real Google Cloud project + OAuth client don't exist yet.** `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` are blank in `.env.example`. Creating the Cloud
   project, configuring the OAuth consent screen, and owning/verifying a real domain in Search
   Console is a **human/CEO action** — it requires a Google account with billing/ownership
   authority over the company's domain, not something backend-agent can do from this sandbox.
2. **The app is Restricted-tier, not just Sensitive**, because reading inbox content requires
   `gmail.readonly`. That means verification isn't just the ~3-5 business day Sensitive review — it
   also requires a CASA security assessment (realistically Tier 2: ~$500-$2,000 and 1-3 weeks, but
   Google decides the tier) before FollowUp can serve more than 100 manually-allowlisted users.
   Budget **3-8 weeks and a few hundred to a couple thousand dollars**, start to finish, and that
   clock hasn't started.
3. **A demo video of the real product's OAuth + scope usage** is a required submission artifact and
   doesn't exist yet — someone has to record one showing the actual consent flow and exactly how
   each scope (`gmail.readonly`, `gmail.send`, `calendar.events`) is used in-product. The privacy
   policy itself is **not** a gap: `src/app/privacy/page.tsx` already exists, written specifically
   for this purpose (see above) — it just needs to be live on the verified domain and linked from
   the Cloud Console consent screen once that project exists.
4. **A real Postgres database** — separate from Gmail specifically, but every function in
   `gmail.ts` reads/writes through Prisma, so Gmail literally cannot function without the DB gap
   (already tracked in README.md) also being closed first.
5. Until verification clears, every connecting business must be **manually added** to a 100-user
   test list (no self-serve signup can connect real Gmail), sees the **"Google hasn't verified this
   app... (unsafe)"** interstitial on every connect, and has their **refresh token silently expire
   every 7 days**, forcing a weekly reconnect. This makes even a limited real-Gmail pilot with
   friendly early customers rough, not just a cosmetic warning.

## Should do before scale, not before launch

- **Monitor and proactively request Gmail API project-quota increases** as the tenant count grows —
  not urgent at launch (rough math above suggests tens of thousands of syncing businesses before the
  shared per-project ceiling is a real risk), but should be on a dashboard/alert before that point,
  not discovered via 429s in production.
- **Detect/soft-warn free-`@gmail.com`-tier customers** approaching the 500-recipient/day sending
  cap, since it's invisible until they hit it and get a temporary send suspension — a Workspace
  account raises this to 2,000/day.
- **Re-pull exact per-method Gmail API quota-unit costs from `developers.google.com/workspace/gmail/api/reference/quota`
  directly** once someone can reach it (this sandbox couldn't) — secondary sources disagreed on
  exact numbers for `messages.get`/`threads.get`, only agreeing directionally.
- **Re-confirm the post-May-2026 quota regime** (6,000 units/min/user/project, 1,200,000
  units/min/project, 80,000,000 units/day billing threshold) against the primary page before
  capacity planning — this is recent enough that it's plausibly after this research method's
  effective knowledge, and every source I could reach for it was secondary.
- Consider whether `users.watch` (push notifications via Cloud Pub/Sub) is worth it later to replace
  polling-based sync — **not researched in this pass** (out of scope for what was asked), flagged
  only as a follow-up question: it would change the quota-consumption shape (fewer `threads.list`
  polling calls) but adds a Pub/Sub subscription per mailbox that Google's docs have historically
  required periodically renewing. Don't take the "periodically renewing" detail as a researched
  figure — confirm the actual renewal interval and setup cost from
  `developers.google.com/workspace/gmail/api/guides/push` directly before scoping any work here.

---

## Sources (all checked 2026-09-05 via WebSearch; WebFetch was blocked for every domain tried in this sandbox)

- [developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [support.google.com/cloud/answer/7454865](https://support.google.com/cloud/answer/7454865?hl=en) — Unverified apps
- [support.google.com/cloud/answer/13464321](https://support.google.com/cloud/answer/13464321?hl=en) — Verification requirements
- [support.google.com/cloud/answer/13464325](https://support.google.com/cloud/answer/13464325?hl=en) — Restricted Scopes list
- [support.google.com/cloud/answer/13465431](https://support.google.com/cloud/answer/13465431?hl=en) — Security Assessment
- [support.google.com/cloud/answer/13804565](https://support.google.com/cloud/answer/13804565?hl=en) — Demo Video requirements
- [support.google.com/cloud/answer/15549945](https://support.google.com/cloud/answer/15549945?hl=en) — Manage App Audience (100-user cap)
- [support.google.com/a/answer/166852](https://support.google.com/a/answer/166852?hl=en) — Gmail sending limits in Google Workspace
- [developers.google.com/workspace/gmail/api/reference/quota](https://developers.google.com/workspace/gmail/api/reference/quota) — Gmail API usage limits
- [www.nylas.com/blog/google-oauth-app-verification](https://www.nylas.com/blog/google-oauth-app-verification/)
- [www.unipile.com/gmail-api-scopes-guide](https://www.unipile.com/gmail-api-scopes-guide/)
- [www.unipile.com/gmail-api-limits](https://www.unipile.com/gmail-api-limits/)
- [www.unipile.com/google-oauth-100-user-limit](https://www.unipile.com/google-oauth-100-user-limit/)
- [www.unipile.com/google-oauth-refresh-token](https://www.unipile.com/google-oauth-refresh-token/)
- [www.gmass.co/blog/google-oauth-verification-security-assessment](https://www.gmass.co/blog/google-oauth-verification-security-assessment/)
- [deepstrike.io/blog/google-casa-security-assessment-2025](https://deepstrike.io/blog/google-casa-security-assessment-2025)
- [www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option)
- [developer.nylas.com/docs/cookbook/email/gmail-api-quotas](https://developer.nylas.com/docs/cookbook/email/gmail-api-quotas/)
- [cli.nylas.com/guides/gmail-api-quotas-2026](https://cli.nylas.com/guides/gmail-api-quotas-2026)
- [security.googlecloudcommunity.com — OAuth Verification for Workspace Add-on Stuck for 8+ Weeks](https://security.googlecloudcommunity.com/security-validation-5/oauth-verification-for-workspace-add-on-stuck-for-8-weeks-client-critical-6543)
- [tech.queenofsandiego.com — Fixing OAuth Token Expiration in Google Cloud](https://tech.queenofsandiego.com/posts/2026-05-06-2124.html)
