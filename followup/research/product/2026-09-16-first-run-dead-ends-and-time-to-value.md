# Where a new business silently fails to reach value

**Date:** 2026-09-16
**Author:** security-compliance agent (audit pass, no code changed)
**Branch / commit:** `claude/followup-demo-to-production-4k39hr`, HEAD `b30ba83`
("Drop the carrier channels, make the Meta ones safe to launch on", #250), **working tree clean**.
Every line number below is from that commit.

**Scope:** the real first-run path, traced in the code — sign-in → onboarding → connecting a
channel → first lead → first AI action the owner can see. Plus: what is measurable about that path
today with no new instrumentation.

**What this extends, not duplicates.** `research/product/2026-09-15-first-run-journey-audit.md`
traced the same journey one day and four commits earlier and is still the reference for
*what the product says vs. what it does*. This pass is about **dead ends, elapsed time, and
measurement**, and it is written against a tree where several of that document's findings have
since been fixed (§6 lists which, so nobody re-fixes them). Where a finding there is still live and
still matters to first-run, it is referenced by section rather than restated.
`research/integrations/2026-09-16-meta-channels-production-audit.md` owns the Meta channel
mechanics; §1.3 below is only the first-run *consequence* of its §3c.

**Method and its limits — read before quoting anything.**
- Everything marked as behaviour is read from the source at `b30ba83` and cited `file:line`.
- Everything marked **[inference]** is my reasoning about what an owner would experience. It is
  not user research. No user research was conducted and none is cited.
- **No statistic, benchmark or activation figure appears in this document.** I did not have one
  worth citing, so there is none. Where I rank findings by "how many users this loses", that is an
  ordering argument from the code's own branch conditions — stated as such, never as a number.
- **What I could not verify:** the production Vercel environment. Specifically `GMAIL_PUSH_TOPIC`,
  `CRON_SECRET`, `OPENAI_API_KEY`, `MICROSOFT_CLIENT_ID`, `INSTAGRAM_APP_ID`/`FACEBOOK_APP_ID`, and
  the Vercel plan (nine cron entries in `vercel.json`, several sub-hourly, plus
  `maxDuration = 300` on the sync route — neither is available on Hobby). Each finding that turns
  on one of these says so. The local `.env` contains only eight variables (`DATABASE_URL`,
  `DIRECT_URL`, the three Google ones, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOWED_EMAILS`) — that
  is a dev file, not evidence about production, and is used below only where it is the only
  evidence available.
- I did not run the app. No screenshot, no live click-through.

---

## 0. The sequence, as the code actually runs it

| When | What happens | Where |
|---|---|---|
| T+0 | "Continue with Google". `signIn` callback creates a `Business` + three enabled automations in one transaction. | `src/lib/auth.ts:105-142`, automations at `:117-122` |
| T+0 | `ALLOWED_EMAILS`, if non-empty, rejects any email not on it — `return false`. | `src/lib/auth.ts:66-68` |
| T+0 | `tier` defaults `"free"`, `subscriptionStatus` null. `hasActiveAccess(null, "free")` is **true**, so Free tier is real access. | `prisma/schema.prisma:98`, `src/lib/billing.ts:60-62` |
| T+0:30 | Onboarding step 1: name, industry, team size → `POST /api/onboarding`. `onboarded` stays false. | `src/components/OnboardingForm.tsx:186-248`, `src/app/api/onboarding/route.ts:41-44` |
| T+1:00 | Step 2: "Connect Gmail" + a four-bullet disclosure box. Outlook button only if `MICROSOFT_CLIENT_ID` is set. | `OnboardingForm.tsx:294-383`, `:376` |
| T+1:30 | Google consent → `/api/integrations/gmail/callback` → `?gmail=connected`. `state` is a real CSRF token in an httpOnly cookie. | `src/app/api/integrations/gmail/callback/route.ts:36` |
| T+1:31 | A `useEffect` fires `POST /api/integrations/{provider}/sync`. Deep pass: `newer_than:90d`, ≤100 threads listed, **≤25 classified**, **≤15 scored**. | `OnboardingForm.tsx:78-102`; `src/lib/integrations/gmail.ts:849-853`; `src/lib/gmailSync.ts:28-29` |
| during that sync | Any newly-created lead whose newest inbound is **under 60 minutes old** and has no outbound gets an AI-written acknowledgement **sent from the owner's Gmail**. | `gmail.ts:760-773` → `src/lib/acknowledge.ts` (`STALE_AFTER_MS`, `:78`) |
| T+~3:00 | "Found N leads already, M scored." — or **nothing at all** (§1.1). | `OnboardingForm.tsx:89-97`, `:272-282` |
| T+3:05 | "Continue to dashboard" → `onboarded = true`. | `OnboardingForm.tsx:143-160` |
| next `:00`, **if 08:00–17:59 America/New_York** | Hourly automation cron. **This is the first tick that can put anything in the approval queue.** | `vercel.json` `"0 * * * *"`; `src/lib/automation.ts:350` |
| every 10 min | Gmail/Outlook sync crons. First tick after connecting does a deep pass (`!deepSyncedAt`). | `vercel.json`; `src/lib/gmailSync.ts:165` |
| every minute | Instant-ack cron — DM channels only (email acks fire inline during sync). | `vercel.json`; `src/app/api/cron/instant-ack/route.ts` |

---

## 1. Dead ends

Ranked by how many new accounts the branch condition catches — largest first. Each states what the
owner did, what they saw, and why nothing happened.

---

### 1.1 — The dashboard sends every new user to a setup step that cannot be completed, and it hides the one step they could complete

**This is the clearest dead end in the product, and it is four days old.**

`getIncompleteSetupSteps` builds the dashboard's setup strip in a fixed order: billing, inbox,
**phone**, widget. The phone step is pushed unconditionally:

```ts
// src/lib/setupStatus.ts:89-97
if (!business?.twilioPhoneNumber) {
  steps.push({
    id: "phone",
    title: "Catch the calls you miss too",
    description: "Needs a Twilio number, about 10 minutes.",
    ctaLabel: "Set up",
    ctaHref: "/settings#phone",
  });
}
```

On 2026-09-16 the carrier channels were dropped (`src/lib/pricing.ts:79`,
`CARRIER_CHANNELS_AVAILABLE = false`). Settings' phone section is behind that flag:

```tsx
// src/app/(app)/settings/page.tsx:811-818
{CARRIER_CHANNELS_AVAILABLE && (
  <section id="phone" className="scroll-mt-16">
    <h2 className="font-display text-xl">Phone (SMS + calls)</h2>
    <div className="mt-4"><TwilioConfig /></div>
  </section>
)}
```

`setupStatus.ts` was not updated. Three consequences, all verified:

1. **The CTA goes nowhere.** `/settings#phone` resolves through `SECTION_TAB` (`settings/page.tsx:48`,
   `phone: "channels"`) so the Channels tab opens, then `document.getElementById("phone")`
   (`:75`) returns null and nothing scrolls. The owner clicked "Set up" for "Catch the calls you
   miss too" and landed on a page about website widgets and Instagram. No error, no explanation.
2. **The step can never clear.** `Business.twilioPhoneNumber` is written by exactly one client —
   `src/components/TwilioConfig.tsx:137` — which renders only inside the gate above. The only other
   writer is `POST /api/twilio/config` (`route.ts:120`), reachable from no visible UI. So the
   remaining-step count is permanently inflated by one, which is precisely the failure
   `setupStatus.ts:59-67` documents as *already fixed* for the Outlook case.
3. **It buries the widget.** `SetupStrip` renders `steps[0]` only (`src/components/SetupStrip.tsx:15`).
   Phone sits in front of widget forever, so **"Add your website widget" is never shown to anyone** —
   and that is the single day-zero capture channel needing no third party at all (§3.2).

Worse, the widget step is doubly unreachable: `SetupStrip` is rendered only in the
*has-leads* branch of the dashboard (`src/app/(app)/dashboard/page.tsx:312`, inside the
`leads.length === 0 ? … : …` else at `:158`). A business with no leads never sees the strip; a
business with leads sees only the broken phone step.

**Why this slipped:** `src/lib/__tests__/channelAvailability.test.ts` exists for exactly this class
of bug — its header says *"the expensive half of dropping a channel is not switching it off, it is
remembering every place that still promises it"* (`:10-13`). It checks `app/page.tsx` and
`WhatsAppConfig.tsx`. It does not check `src/lib/setupStatus.ts`.

**Who it catches:** every business that completes onboarding with an inbox and gets at least one
lead — the success path.

---

### 1.2 — The first sync can fail and say nothing at all

```ts
// src/components/OnboardingForm.tsx:87-101
fetch(`/api/integrations/${inboxProvider}/sync`, { method: "POST" })
  .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
  .then(({ ok, data }) => {
    if (ok && data.success) { setAutoSyncSummary(…); }
  })
  .catch(() => {
    // Silent — see comment above.
  })
  .finally(() => setAutoSyncState("done"));
```

There is no `else`. The summary line renders only when `autoSyncSummary` is set (`:272-282`), so a
non-OK response sets nothing and renders nothing. The route can return:

- **402** — `requireActiveBilling` (`src/app/api/integrations/gmail/sync/route.ts:23-25`). Note this
  is now *unreachable for a new signup*: `hasActiveAccess(null, "free")` is true
  (`src/lib/billing.ts:60-62`). The comment at `OnboardingForm.tsx:70-73` still justifies the
  silence by that case, which no longer exists.
- **429** — five syncs per ten minutes (`sync/route.ts:29-31`).
- **500** — any thrown sync error, including a Gmail API failure or a serverless timeout
  (`sync/route.ts:36-39`; `maxDuration = 300` at `:11`, which needs a paid Vercel plan).

**What the owner sees:** "Pulling in your first leads…" with a spinner (`:274-277`), then the line
disappears, leaving "Gmail connected / Connected as name@co.com" and a Continue button. They press
it and get a dashboard with zero leads and the sentence *"FollowUp is watching your inbox"*
(`dashboard/page.tsx:181-184`). **[inference]** There is no way for them to distinguish "my inbox
genuinely had no sales threads in 90 days" from "the import broke". Both render identically.

The success path is honest about the empty case — *"No sales conversations found yet — that's
normal for a quiet inbox."* (`:92-93`) — which makes the silence on failure worse, not better: the
product has a sentence for "nothing found" and none for "we didn't get to look".

---

### 1.3 — Connecting Instagram or Facebook succeeds, subscribes to nothing, and then claims it is working

Both OAuth flows are correct as OAuth: `state` is a random token in an httpOnly cookie and is
checked back (`src/app/api/instagram/oauth/start/route.ts:24-28` /
`callback/route.ts:29`; `facebook/oauth/start/route.ts:17-20` / `callback/route.ts:43`). Both then
write credentials and redirect:

```ts
// src/app/api/instagram/oauth/callback/route.ts:39-51
await prisma.business.update({
  where: { id: ctx.businessId },
  data: { instagramAccessToken: exchanged.accessToken, instagramUserId: resolved.id },
});
void recordAudit(ctx, "integration.instagram.connect", { meta: { via: "oauth" } });
settingsUrl.searchParams.set("instagram", "connected");
```

Neither route — nor `facebook/oauth/select-page/route.ts:37-48`, nor either `config` route — ever
calls `POST /{id}/subscribed_apps`. That gap and its Meta-side reasoning are already documented in
`research/integrations/2026-09-16-meta-channels-production-audit.md` §3c, which also notes that
`pages_manage_metadata` — the permission that authorises the call — is requested at
`src/lib/facebook.ts:190` and never used. I re-verified by grep at this commit: zero occurrences of
`subscribed_apps` or `subscribed_fields` anywhere in `src/`.

**The first-run consequence, which is this document's part:** the UI states success twice, in the
present tense, with no qualifier.

```tsx
// src/components/InstagramConfig.tsx:42
{ kind: "success", text: "Instagram connected — real DMs will become leads automatically." }
// :149-152
<Check /> Connected — Instagram account ID {instagramUserId}. Real DMs will become leads automatically.
```

There is no "waiting for the first message" state, no "we haven't received anything yet" line, and
nothing anywhere that reconciles "Connected" against "zero leads from this channel, ever". A
business that connects Instagram and receives nothing has no in-product way to learn that, and the
copy actively tells them the opposite. **[inference]** The owner's conclusion is "nobody DMs us",
not "this is broken" — which is the version of this failure that never generates a support ticket.

Instagram additionally needs the customer's own **Connected tools → Allow access to messages**
toggle (same Meta write-up, §3d, graded C there) — a setting on the customer's phone that no code
can substitute for and that the connect flow never mentions.

---

### 1.4 — A declined Google consent screen shows a raw protocol string

`callback/route.ts:34` passes Google's `error` param through verbatim to `fail()`, which puts it in
`?message=`; `OnboardingForm.tsx:108-113` renders that as the user-facing text. Clicking "Cancel"
on Google's screen returns the owner to onboarding reading, in coral:

> **access_denied**

The fallbacks ("Couldn't connect Gmail.") apply only when Google sends no message at all. Carried
forward from the 2026-09-15 audit §2.2 — still true at `b30ba83`, and it belongs in this list
because it is the highest-stakes moment in the funnel: the person was one click from the product's
only real capability and is now looking at a protocol token.

Worth pairing with §4: this path records **no audit event**, so it is also invisible in the data.

---

### 1.5 — The WhatsApp panel calls itself "Connected" on three unvalidated strings

```ts
// src/components/WhatsAppConfig.tsx:87
const connected = !!accountSid && hasAuthToken && !!whatsappPhoneNumber;
```

`POST /api/twilio/config` stores all three with no verification of any kind — no Twilio API call,
no sender lookup, no format check beyond `z.string().trim()`
(`src/app/api/twilio/config/route.ts:11-19`, `:114-126`). A typo'd Account SID, a revoked Auth
Token, or a number that is not actually a WhatsApp sender all produce:

```tsx
// WhatsAppConfig.tsx:295-298
<Check /> Connected — a reply to a WhatsApp lead is sent from {whatsappPhoneNumber}.
```

The panel is otherwise the most honest surface in the product about third-party gates — it names
the Twilio account *and* Meta's review up front (`:191-199`) and explains the 250-conversation
pre-verification limit (`:270-289`). The gap is only that "Connected" is a statement about three
non-empty text boxes, and the owner has no way to test it without a real inbound WhatsApp message.

**Sequencing note for time-to-value (§2):** the credential fields are not reachable until
`whatsappUrl` exists (`:234-252`), and the 24-hour template fields are not reachable until
`connected` is true (`:402`). So the panel enforces the order Twilio-account → generate URL →
paste-into-Twilio → credentials → template — five steps, three of them outside FollowUp.

---

### 1.6 — Carried forward, still live, still first-run relevant

| Dead end | Why it still matters on day one | Cite |
|---|---|---|
| **A revoked Outlook token reports "watching your inbox" forever.** There is no `needs_reconnect` status for Outlook anywhere; `setupStatus.ts:79-87` raises the reconnect step for Gmail only. | Gmail's own code calls this *"the worst shape a failure can take in this product"* (`gmailSync.ts:188-190`) and fixed it on one provider. | 2026-09-15 audit §4.3; `src/lib/setupStatus.ts:69,79` |
| **The approval queue is empty until the next in-window hour**, because the send-window check runs *before* drafting and releases the claim. | This is the whole of §2 and §5 below. | `src/lib/automation.ts:350-353` |
| **`Business.timezone` is set by no UI or API**, so the send window is 08:00–17:59 America/New_York for every business on the platform. | A Vancouver business signing up at 15:10 local has its first possible hold at 05:00 local the next day. | `prisma/schema.prisma:51-55`; 2026-09-15 audit §4.4 |
| **Free tier's 20-lead AI cap is consumed by the first import**, and is explained only inside the Settings billing tab. | A 60-thread import leaves 40 leads with no score and no draft, on the dashboard, unexplained. | `src/lib/pricing.ts:96`; `src/lib/billing.ts:209-223`, `:290-298` |
| **`ALLOWED_EMAILS` rejects sign-in outright** when set; the signin screen says *"That Google account isn't authorized for this workspace."* | The repo's own `.env` sets it to one address and `docs/security.md:68` says to keep it set. `STATUS.md:14-15` records that it is **not** set in the Vercel project — treat that as the founder's claim, dated 2026-09-13, not something I verified. | `src/lib/auth.ts:66-68`; `src/components/landing/SignInClient.tsx:130-134` |

---

## 2. Time to first value, honestly

Three different things get called "first value". They have very different clocks.

### 2.1 "Leads on a screen" — minutes, inside onboarding

The auto-sync at `OnboardingForm.tsx:78-102` is the best thing in this flow and it is genuinely
fast. Bounded by `maxDuration = 300` and by the per-run caps, and the owner is told the count.

**Two honesty caveats on that count.** The first pass classifies at most 25 threads and scores at
most 15, of up to 100 listed (`gmailSync.ts:28-29`, `gmail.ts:852`). A busy inbox is told a number
well below the truth with no indication more is coming — `truncated` is computed
(`gmailSync.ts:79-81`) and returned to the route, and the route's JSON
(`sync/route.ts:35`) drops it. And the window is 90 days (`gmail.ts:851`), narrowed from 180 on
2026-09-15 for a stated and good reason (`:830-845`); `gmailSync.ts:14` still says "180-day".

### 2.2 "FollowUp did something visible" — the real clock

The thing the dashboard is built around is the approval queue, and it is derived purely from
`ai.hold` audit events (`src/lib/pendingApprovals.ts:53-70`). Only `runAutomationForBusiness`
(`automation.ts:598`) and `sequences.ts:612` write those. And:

```ts
// src/lib/automation.ts:350-353
if (!isWithinSendWindow(new Date(), timezone)) {
  await prisma.lead.updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } });
  return { kind: "deferred" };
}
```

That gate sits *before* drafting and before the hold branch (`:548`). **A hold is not a send, but it
is gated as if it were.** So:

| Signup time (America/New_York) | First possible `ai.hold` | Elapsed |
|---|---|---|
| 09:50 | 10:00 | ~10 min |
| 17:05 | 17:00 tick missed → next day 08:00 | ~15 h |
| 18:05 | next day 08:00 | ~14 h |
| Saturday 11:00 | same day 11:00 (no weekday check) | ~0–60 min |
| Vancouver, 15:10 local (18:10 ET) | next day 05:00 local | ~14 h |

The dashboard in that state reads *"Nothing needs your OK right now."* (`dashboard/page.tsx:132`),
which is true and, **[inference]**, indistinguishable from a product that does nothing.

**The one genuinely instant path** is the email instant-acknowledgement fired inline during the
onboarding sync (`gmail.ts:760-773`) — but only for a lead whose newest inbound is under 60 minutes
old (`acknowledge.ts:78`) with no outbound in the thread. For most signups that set is empty: the
90-day import is mostly old threads. So the fastest real demonstration is the one the owner has to
find and press themselves (§3.3).

### 2.3 The third-party gates, counted

This is the number that matters for "where people leave", and it has grown.

| Step | Third party | What the owner must do | Blocking? |
|---|---|---|---|
| Sign in | Google | Approve basic profile/email scopes | Yes — no other provider exists (`auth.ts:51-56`) |
| Connect inbox | **Google** | Approve `gmail.readonly` + `gmail.send` + `calendar.events` (`gmail.ts:41-46`). Two **Restricted** scopes → consent-screen verification + CASA; pre-verification, Testing mode caps at 100 users and **refresh tokens die after 7 days** | Yes for the core loop. See `research/integrations/2026-09-06-gmail-oauth-verification.md` |
| Connect inbox (MS) | Microsoft | Only offered if `MICROSOFT_CLIENT_ID` etc. are set (`OnboardingForm.tsx:376`) | Env-dependent; unverifiable from here |
| Instagram / Messenger | **Meta** | Business Verification + App Review; plus the customer's own "Allow access to messages" toggle; plus a `subscribed_apps` call the product does not make (§1.3) | Yes |
| WhatsApp | **Twilio + Meta** | Paid Twilio account (~$1/mo, stated in-panel at `WhatsAppConfig.tsx:193-199`), a WhatsApp Sender, Meta review, then a Content Template Meta must approve before any follow-up past 24 hours works | Yes — the largest stack in the product |
| SMS / voice | — | **Withdrawn.** `CARRIER_CHANNELS_AVAILABLE = false` (`pricing.ts:79`) — but the dashboard still asks for it (§1.1) | n/a |
| Billing | Stripe | Not required: Free tier is real access (`billing.ts:60-62`) | No |

**Website widget is the only capture channel with zero third parties** — copy an iframe snippet
(`src/components/CopyEmbedSnippet.tsx:24-26`) and paste it into a site. It is also the step the
setup strip can never reach (§1.1).

---

## 3. What a brand-new account can actually do on day zero

### 3.1 The voice corpus — thinner than it looks, and thinnest for the target customer

`getVoiceSamples` pulls outbound `Message` rows with `source: null` on written channels
(`src/lib/voice.ts:163-181`), excluding anything matching a `FollowUp` send record by body or
timestamp (`:87-118`), with `MIN_SAMPLE_LENGTH = 40` (`:45`) and at most two per lead (`:52`).

The Gmail importer **does** create outbound rows — direction is computed per message from the
`From` header against the connected address (`gmail.ts:547`) and every parsed message in the thread
is upserted (`:735-747`). So a business that has replied to prospects in the last 90 days *does*
have a corpus on day zero, and the ordering works out: `syncGmailForBusiness` imports every thread
(`gmailSync.ts:76-82`) before scoring any lead (`:88`).

Where it is genuinely empty:

- **A business that skipped the inbox** ("I'll do this later", `OnboardingForm.tsx:384-390`) — zero
  outbound messages exist.
- **The ICP.** FollowUp's stated customer is someone whose inbox is full of people they never got
  back to. For every thread where they never replied, there is no outbound message and therefore no
  sample. The thinner the reply history, the more FollowUp is needed — and the less it knows how
  they write. That is not a bug; it is a fact worth having written down.
- **Short repliers.** "Sounds good, I'll call you" is 26 characters and is filtered at `voice.ts:45`.

The no-samples branch is well handled and honest — it asks for *"the register of a competent
tradesperson answering an email between jobs, not a marketing department"*
(`src/lib/integrations/openai.ts:883-885`). What is missing is that **nothing tells the owner
this**. The first draft they judge the product on is the one written with the least information
about them, and no screen says "these will sound more like you once I've seen how you write."
**[inference]** A first draft that reads generic is the most likely single reason a trial user
decides the AI isn't good enough — and it is the one case the product could explain and doesn't.

### 3.2 A business with no leads

- No score, no draft, no approval queue, nothing in "What FollowUp did for you this week".
- The empty state is **honest and well-built** — three distinct branches for connected / revoked /
  never-connected (`dashboard/page.tsx:179-231`), the connected one naming the address and the last
  check time. This is the best-written state in the flow and the 2026-09-15 audit said so too.
- One overclaim in it: *"it replies within a minute"* (`:182`). That is true only when the Gmail
  push watch is live, which needs `GMAIL_PUSH_TOPIC` set (`gmail.ts:288-289`); otherwise the floor
  is the 10-minute cron. Settings gets this exactly right — *"new emails are picked up within
  seconds"* vs *"within 10 minutes"*, branched on `pushActive` (`settings/page.tsx:631`). The
  dashboard does not branch.

### 3.3 The one self-serve demonstration, and what it costs

`TestLeadButton` → `POST /api/leads/test-lead` creates a real lead addressed to the owner's own
email and runs the genuine score + instant-ack path (`route.ts:45-53`). It is the only way to see
the core promise work on a quiet day, and it is good.

It renders **only** inside `leads.length === 0` (`dashboard/page.tsx:158`, `:232-234`). Two
consequences at this commit:

1. An owner whose import produced 40 stale leads and no live ones — the exact owner this product is
   for — never sees it (carried from 2026-09-15 §2.4).
2. Using it **destroys its own entry condition**: the lead it creates makes `leads.length > 0`, so
   the button disappears, the "FollowUp is watching your inbox" confirmation disappears with it
   (that sentence lives only in the empty state), and the setup strip appears — with the broken
   phone step at the front of it (§1.1). The one successful demonstration in the product hands the
   user straight to the one dead click.

It also permanently consumes one of the Free tier's 20 monthly AI leads
(`billing.ts:209-223` ranks by creation order within the calendar month; nothing excludes
`source: "Test lead"`, which is explicitly a Free-tier-allowed source at `billing.ts:163`).

---

## 4. What is measurable today, with zero new instrumentation

The substrate already exists: `AuditEvent` (`prisma/schema.prisma:1118-1131`, indexed
`[businessId, createdAt]` and `[targetId]`), plus timestamps on `Business`, `Integration` and
`Lead`. `recordAudit` is called at ~50 sites and never throws (`src/lib/audit.ts:11-38`).

### 4.1 Six things the founder could learn this week, from the database as it stands

1. **Time-to-first-value, per business, exactly.**
   `min(AuditEvent.createdAt) where action in ('ai.hold','ai.send') and businessId = X`
   minus `Business.createdAt`. Those two events are written at `automation.ts:598` and
   `sending.ts:603` and are, by construction, the moment FollowUp first did something on its own.
   **This is the metric the brief is asking for and it needs no new code.** The distribution of it
   against hour-of-signup would confirm or kill §2.2 immediately.

2. **The onboarding funnel, in three stages.** `Business.createdAt` → `industry IS NOT NULL` (set
   only by step 1, which is why `onboarding/page.tsx:31` uses it as the resume key) →
   `onboarded = true`. Where the count drops is where the flow drops people.

3. **Signup → inbox connected, and how long it took.**
   `AuditEvent where action = 'integration.gmail.connect'` (`callback/route.ts:41`), `.../outlook.connect`
   (`outlook/callback/route.ts:41`). Businesses with no such row and `onboarded = true` are the
   "I'll do this later" population, counted exactly.

4. **"Connected but nothing ever happened" — the §1.3 population, countable today.**
   `Business.instagramUserId IS NOT NULL` (or `facebookPageId`) with zero `Lead` rows of the
   matching `source`. Same query shape for Gmail: `Integration.status = 'connected'` with zero
   leads. `admin-data.ts:161-165` already assembles `connectedChannels` per recent signup and
   `leadCount` beside it — the two numbers are on the same screen and nobody has made them talk to
   each other.

5. **Abandoned approvals.** `getPendingApprovals` already derives "most recent event for this lead
   is still `ai.hold`" (`pendingApprovals.ts:62-70`). Run the same derivation with an age filter
   and you have "drafts that were held and never acted on" — i.e. the owner saw the queue and did
   nothing. `ai.hold`'s `meta` carries `riskLevel` and `trigger` (`automation.ts:601-605`), so it
   splits by *why* it was held.

6. **Leads captured but never processed.** `Lead.scoreReason IS NULL` with messages present — the
   exact predicate `scoreUnscoredLeads` uses (`gmailSync.ts:42-47`). A business where this stays
   high is over its tier cap, on a disallowed channel, or `OPENAI_API_KEY` is unset
   (`scoring.ts:32`). Also: `FilteredEmail` rows per business (`gmail.ts:608-621`) vs. leads created
   — how aggressive the classifier was on someone's first import.

Also free: `Integration.status = 'needs_reconnect'` counts (Gmail only — Outlook has no such state,
§1.6), `Integration.lastSyncError`, `RateLimitHit`, `ProductFeedback`, `Notification` volume.

### 4.2 The four blind spots, and which one is cheap to close

- **No sign-in event.** `auth.ts` records no audit. "Signed in and never came back" is unanswerable;
  the closest proxy is `Business.createdAt` with nothing after it.
- **No `onboardedAt`.** `onboarded` is a bare boolean (`schema.prisma:49`), overwritten at
  `onboarding/route.ts:42`. You can tell *whether* someone finished, never *when* — so
  "time from signup to finishing onboarding" cannot be computed, even retrospectively.
- **No sync outcome event.** `syncGmailForBusiness` stamps `lastSyncedAt` (`gmailSync.ts:111-118`)
  and overwrites it every ten minutes. The **first** sync's result — the single most important
  number in this whole funnel — is not recorded anywhere. §1.2's silent failure is silent in the
  data as well as on screen.
- **No OAuth-failure event.** `callback/route.ts:25-32`'s `fail()` records nothing, while the
  success path at `:41` records `integration.gmail.connect`. So "reached Google's consent screen and
  did not come back" — the classic drop-off — is invisible.

**The cheap one:** a `recordAudit(ctx, "integration.gmail.connect_failed", { meta: { reason } })`
inside `fail()`, and the equivalent in the Instagram/Facebook callbacks. Three lines each, no schema
change, no new table, and it turns the highest-drop-off step in the funnel from unmeasurable into a
`groupBy`. I am not making that change in this pass (audit only) — it is a proposal for
`backend-ai-agent`.

---

## 5. The single highest-leverage fix

**Stop gating the approval queue on the send window. Hold drafts at any hour; gate only the send.**

`src/lib/automation.ts:350-353` checks `isWithinSendWindow` before drafting, releases the claim and
returns `deferred`. The check is correct in intent — `src/lib/sendWindow.ts:4-7` exists to stop *"an
automated text or email landing at 3am local to the business"* — and it is applied one step too
early. Drafting and holding send nothing to anybody. They put a card on the owner's own dashboard.

**The concrete failure, as the code runs it today:** an owner finishes onboarding at 18:05 ET. The
19:00 cron fetches their eligible leads, claims each one, immediately releases the claim, and
returns `deferred` for every single lead. So do 20:00, 21:00, 22:00 and 23:00. The dashboard says
"Nothing needs your OK right now." until 08:00 the next morning — around fourteen hours — with no
line anywhere saying why or for how long. For anyone outside US Eastern it is worse, because
`Business.timezone` is set by no UI (`schema.prisma:51-55`).

**Why this one and not the others:**

- It is the only finding here that hits **every** new account on a clock rather than a condition.
  §1.1 needs leads to exist, §1.2 needs a failure, §1.3 needs Meta, §1.5 needs Twilio. This one
  needs only that you signed up after 6pm — and a small-business owner evaluating software in the
  evening is not an edge case. **[inference]**, but it is an inference about who signs up, not about
  a number.
- It converts the product's *actual* first-value moment from "wait for a cron in a window" to
  "minutes", using drafts the system was already going to write.
- It costs nothing in trust. Nothing sends. The one guarantee that matters —
  *"Anything it isn't sure about waits for your OK first"* (`OnboardingForm.tsx:343`) — gets
  *stronger*, because more things wait for the OK.
- It is the difference between the product's own definition of success and silence: `ai.hold` is
  literally the event §4.1's time-to-first-value metric measures.

**Shape of the fix (proposal — not applied, and it changes behaviour, so it is `backend-ai-agent`'s
call, not mine):**

1. Move the window check from `automation.ts:350` down to the send branch at `:616`, so out-of-window
   leads fall through the risk gate and take the hold path at `:548` instead of being skipped. An
   `AUTONOMOUS` lead that would otherwise auto-send out of hours should be **held**, not sent — and
   the held card should say so, since "held because it's 9pm" is a different sentence from "held
   because the model was unsure".
2. Keep releasing the claim (`lastAutomationCheckedAt = null`) only for leads that took the
   deferred-send path, so nothing loses its 20-hour recheck protection.
3. Companion, cheaper and independently worth doing: kick one `runAutomationForBusiness` pass at the
   end of the onboarding sync, so the first hold lands while the owner is still on the screen rather
   than at the top of the next hour.
4. Extend `src/lib/__tests__/` with the trust-guarantee this creates and the one it must not break:
   *out of window, a draft is held and no send occurs*. The approval-first tests are load-bearing
   here — this change touches the same gate.

**Runner-up, and the reason it is not first:** §1.1 (the dead phone step) is smaller, safer, and I
would ship it the same day — it is a `CARRIER_CHANNELS_AVAILABLE` guard in `setupStatus.ts:89` plus
a line in `channelAvailability.test.ts`. But it costs a new user one confused click and a hidden
suggestion. The send window costs them the entire first evening.

---

## 6. Checked, and not broken — so nobody re-fixes it

- **The 2026-09-15 audit's #1 finding is fixed.** Cold-lead holds are now keyed on `isCold`
  (`automation.ts:428`, `:548`) rather than `isDeadLead`, and the comment at `:544-547` records
  exactly why. A 70-day-old unanswered thread is now held, not auto-sent.
- **The billing/setup contradiction is fixed.** `getIncompleteSetupSteps` selects `tier`
  (`setupStatus.ts:34`) and `hasActiveAccess` treats `"free"` as access, so a new Free business is
  no longer told to start a trial. The comment at `:43-48` documents the bug it fixed.
- **Tier AI caps are now enforced on every tier**, not just Free (`pricing.ts:124-128`,
  `billing.ts:270-299`), and `checkAiEligibility` reads only `subscriptionStatus` rather than the
  whole `Business` row — correctly avoiding needless decryption of `ENCRYPTED_FIELDS`
  (`billing.ts:276-282`).
- **OAuth CSRF is correct on all three flows** (Gmail, Instagram, Facebook): random `state`, httpOnly
  cookie, compared on return, cookie deleted either way.
- **Facebook's multi-Page picker encrypts the pending page tokens** before they touch a cookie
  (`facebook/oauth/callback/route.ts:69-75`).
- **A DM ack no longer races the owner**: two-minute grace period plus a per-minute cron with an
  atomic claim and a lease (`acknowledge.ts:105-121`, `api/cron/instant-ack/route.ts`).
- **The Gmail importer's `lastContacted` can only move forward** (`gmail.ts:682-690`), which is what
  stops a 90-day import making a live lead look cold.

---

## 7. Sources

Read first-hand at `b30ba83`, clean tree:

`src/lib/auth.ts` · `src/lib/setupStatus.ts` · `src/lib/billing.ts` · `src/lib/pricing.ts` ·
`src/lib/voice.ts` · `src/lib/scoring.ts` · `src/lib/gmailSync.ts` · `src/lib/integrations/gmail.ts` ·
`src/lib/automation.ts` · `src/lib/acknowledge.ts` · `src/lib/pendingApprovals.ts` ·
`src/lib/sendWindow.ts` · `src/lib/audit.ts` · `src/lib/admin-data.ts` · `src/lib/instagram.ts` ·
`src/lib/facebook.ts` · `src/lib/cronAuth.ts` · `src/lib/integrations/openai.ts` (voice block only) ·
`src/components/OnboardingForm.tsx` · `src/components/SetupStrip.tsx` · `src/components/TestLeadButton.tsx` ·
`src/components/WhatsAppConfig.tsx` · `src/components/InstagramConfig.tsx` · `src/components/CopyEmbedSnippet.tsx` ·
`src/app/(app)/dashboard/page.tsx` · `src/app/(app)/settings/page.tsx` · `src/app/(app)/layout.tsx` ·
`src/app/onboarding/page.tsx` · `src/app/signin/page.tsx` · `src/components/landing/SignInClient.tsx` ·
`src/app/api/onboarding/route.ts` · `src/app/api/integrations/gmail/{connect,callback,sync}/route.ts` ·
`src/app/api/instagram/oauth/{start,callback}/route.ts` ·
`src/app/api/facebook/oauth/{start,callback,select-page}/route.ts` · `src/app/api/twilio/config/route.ts` ·
`src/app/api/leads/test-lead/route.ts` · `src/app/api/cron/instant-ack/route.ts` ·
`src/lib/__tests__/channelAvailability.test.ts` · `prisma/schema.prisma` · `vercel.json` · `.env` (key
names only, no values) · `STATUS.md`.

Prior repo documents relied on and cited rather than re-derived:
`research/product/2026-09-15-first-run-journey-audit.md` ·
`research/integrations/2026-09-16-meta-channels-production-audit.md` §3c, §3d ·
`research/integrations/2026-09-06-gmail-oauth-verification.md`.

**External sources: none.** No statistic, benchmark, quote or timing in this document comes from
outside the repository. Everything marked **[inference]** is my own reasoning and is labelled.
