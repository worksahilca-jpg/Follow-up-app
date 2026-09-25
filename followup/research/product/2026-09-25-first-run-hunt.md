# First-run hunt: what a new tester meets, and what Manoj met

**Date:** 2026-09-25
**Author:** product narrative lane (report only)
**Code read at:** `claude/followup-demo-to-production-4k39hr`, HEAD `7a58066`, clean tree. Historical screens were read with `git show <commit>:<path>` at the commits named inline.
**What this is:** a walk of the first-run journey (invite-only sign-in → Google → onboarding → first Gmail sync → first lead → first draft → first "Approve & send", plus the failure paths), with the tester Manoj's exit as the case study. **No source file, design-brain file or git state was changed.** Nothing here is approved.

## Summary

1. **It can't happen today, but it probably did happen to Manoj.** On a tester account, nothing sends without a press. But a 2026-09-19 fix (`2644398`) describes a real owner who *"connected Gmail, got two automatic follow-ups the next day, and disconnected Gmail that evening"*. That matches Manoj's timeline on five points. If it was him, FollowUp sent from his Gmail, twice, without asking. One query settles it (§1.6).
2. **What made him afraid is still in the copy.** When Google asks permission to send email, neither the Email row in onboarding nor the Gmail row in Settings mentions sending. Settings still describes a read-only product, word for word as on 2026-09-07. Testers repeat that consent every 7 days (§2.1).
3. **The one self-serve demo says the product is broken.** On every new account, "Send a test lead to myself" replies *"the reply didn't go out (check that Gmail is connected in Settings)"*. That's false: the reply was held for approval, which is correct. And it sends the owner to the tab whose inbox row has a coral Disconnect button (§2.2).
4. **Three entrances fail badly.** A wrong Google account gets NextAuth's unbranded "Access Denied" page, so FollowUp's own invite-only message never shows. An owner who presses Cancel on Google is told they're "not on the list". An owner who unticks Google's send checkbox sees "Connected", and then their first Approve & send fails (§2.4–2.6).
5. **Outside the first run, but the same fear.** Removing a tester on `/admin` switches their account to sending without asking (`revokeBetaPlan` sets `holdAllForApproval: false`). That is the one code path that could repeat Manoj's event today. It's a one-line fix, and the founder's call (§3.1).

---

## 0. How to read this

- **Evidence tags.** **[code]** = traced in source, cited `file:line`. **[data]** = production numbers from the brief or already on file. **[external]** = outside source, graded. **[inference]** = my reasoning. Nothing marked [inference] has been observed.
- **Not done:** the app was not run. No screenshot. No database query. I didn't try Google's consent flow with a live account. WebFetch to `support.google.com` and `developers.google.com` returned `EGRESS_BLOCKED`, so Google-side claims come from search snippets and are graded as such.
- **Builds on, doesn't repeat:** `2026-09-15-first-run-journey-audit.md`, `2026-09-16-first-run-dead-ends-and-time-to-value.md`, `2026-09-24-simplify-the-app.md`. Anything they already cover that is still live is listed in §4 with a pointer, not re-argued. Everything in §2 and §3 is new, or is a new fact about an old finding.
- **Rejected-list check:** no fix below is a request form (R-012), an AI label (S-13), a channel switch (R-003), a keyboard layer (R-002), or subtraction as the whole answer (R-001). Fixes marked "copy with UX weight" need a `design-decisions.md` entry when shipped.

---

## 1. Manoj: what he was told, what the code did, what the screens say now

### 1.1 The data, and what it cannot say

From the brief **[data]**, for business `cmtqfyyhv0000ld046twam6g4`:
- signed up 2026-09-06 23:27
- connected Gmail 23:28
- `automation.settings.update` at 2026-09-07 21:55
- `integration.gmail.disconnect` at 21:57
- first held drafts on 2026-09-08

Three caveats **[code]** before anything is built on that:

1. **"No drafts existed when he left" is an artefact of when logging began.**
   - `ai.hold` and `ai.send` audit events were first written by `fc6db0d` (#117), merged 2026-09-08 11:28 EDT. The first recorded hold falls on 2026-09-08 because that is when holds started being recorded at all.
   - Before that, a hold was only a `Lead.suggestedMessage` write (`automation.ts` at `e48897c`, lines 193–198).
   - The import itself wrote a draft for every scored lead (`scoring.ts` at `e1cb531`, lines 54–77).
   - There was **no approval queue anywhere in the product** until `0819a7b` (#165, 2026-09-10).
   - So drafts existed on his lead pages. What didn't exist was a queue, or any record of holds.
2. **The settings event proves a click, not a change.**
   - `automation.settings.update` is recorded *before* the billing check, with no meta (route at `1209218`, lines 39–43).
   - It is still recorded that way today (`src/app/api/automation/settings/route.ts:118-119`).
   - It shows he pressed something. It doesn't show what was saved.
3. **The brief's times have no timezone.**
   - Read as UTC, he signed up at 19:27 EDT. That is 25 minutes *before* "Follow-up on by default" (#83, `e1cb531`) merged at 19:52 EDT.
   - That PR's migration (`prisma/migrations/20260906234500_follow_up_on_by_default`) inserted an enabled `auto_send` row for every existing business and moved open leads to ASSISTED. If this reading is right, automatic follow-up was switched on in his account by a deploy, after he had connected, with nothing said to him.
   - Read as Eastern time, it was on from the moment he signed up.
   - Either way it was on by the next morning.

### 1.2 New evidence: a fix that describes his account

`2644398` (#274), 2026-09-19. The commit message, repeated in `src/lib/sendChannels.ts:6-11` **[code]**:

> "Found on 2026-09-19 in a real account: the owner connected Gmail, got two automatic follow-ups the next day, and disconnected Gmail that evening. For the twelve days after, the hourly automation kept drafting follow-ups for his eleven old leads and holding them for approval — 97 holds …"

The account isn't named. It matches Manoj on five points **[inference, strong]**:
1. Gmail connected.
2. "The next day" is 2026-09-07. The automation cron then ran **daily at 13:00 UTC** (`vercel.json` at `95ca164`), and hourly only from `f8d515c` (15:00 EDT, 2026-09-07).
3. Disconnected "that evening": 21:57.
4. "Twelve days after" runs from 09-07 to 09-19, the date of the fix. The brief's first holds on 09-08 fit.
5. "Eleven old leads" fits the 10 held drafts on his account in the 2026-09-23 production table (`design-brain/decisions/design-decisions.md:6044`).

**What this changes.**
- **The leading hypothesis gets stronger.** "He saw FollowUp *could* email his clients" becomes "FollowUp *did*, twice, from his own Gmail, the morning after he connected". At connect he had been told only that it *"reads your sales conversations and tells you who needs a follow-up today"* (`OnboardingForm.tsx` at `e1cb531`, lines 266–267).
- **How he'd have found out.** Silence sends then produced no in-app notice (2026-09-15 audit §5). So the likely routes are his Gmail Sent folder, a reply, or the dashboard's "This week's AI report — Sent" tile (dashboard at `1209218`, lines 207–210). **[inference]**

**A second inference, from the same fact.**
- The 97 holds could only happen with `auto_send` enabled, because `runAutomationForBusiness` returns empty otherwise.
- That gate has not changed: `automation.ts:380-385` today, and the same at `fc6db0d:96-101`, `0819a7b:193-198` and `2644398:299-304`.
- No later migration re-enables it. Only `20260906234500` inserts Automation rows.
- **So whatever he changed at 21:55 left "Auto follow-up on silence" on.** He changed the delay, the instant reply, or "Reply for me", or he switched the master off and back on.
- Two minutes later he removed Gmail.
- The reading I'd test first **[inference]**: the Settings screen gave him no way to confirm he had stopped it, so he cut the connection, the one control he was sure of.

### 1.3 Then and now, screen by screen

| Moment | What he met (2026-09-06/07) | What a tester meets today |
|---|---|---|
| Connect screen | *"This is the whole point — FollowUp reads your sales conversations and tells you who needs a follow-up today."* Nothing about sending (`OnboardingForm` at `e1cb531:266-267`) | The promise *"Nothing goes out behind your back. Every message it writes waits for your OK…"* sits on step 2 (`OnboardingForm.tsx:489-490`), whose "Got it" and "Skip" do the same thing (`:402`, `:518-531`). The row with the Connect button says *"Gmail or Outlook — where most enquiries already land."* (`:231`) |
| Google | Unverified-app warning, then a permission list that includes sending | The same. Testing mode and the same scopes (`src/lib/integrations/gmail.ts:41-46`) |
| Default | `auto_send` on, leads ASSISTED: low-risk drafts sent unreviewed | `holdAllForApproval @default(true)` (`schema.prisma:235`), re-applied at every tester sign-in (`auth.ts:193`). Nothing sends without a press |
| First automated act | A **send**, within a day | A **held draft**, at the next hour inside 08:00–18:00 New York time |
| Settings, Gmail row | *"Required — FollowUp reads sales conversations from your inbox to score leads and draft replies…"* | **Byte-identical** (`settings/page.tsx:863`) |
| Settings, Automation | Same page, 6th section. *"Master switch — on by default"*; *"Autonomous sends every draft with no review at all"* | 5th of 5 tabs ("Advanced"). The first box is good (*"FollowUp asks you before every message"*, `:1109-1113`). Below it: the same ON switch, and **the same "Autonomous sends every draft…" sentence** (`:1409`) |
| Today | *"Automation is already working these; the ones at the top need you."* | *"Automation is already working these — the ones at the top need you."* (`dashboard/page.tsx:343`) |
| Disconnect | *"Disconnect Gmail? FollowUp will stop reading this inbox and revoke its access at Google. You can reconnect any time."* | **Byte-identical** (`settings/page.tsx:705`) |

### 1.4 Would today's first run cause the same fear?

- **The event: no, for testers [code].** Every draft is held.
  - `automation.ts:1033`
  - `acknowledge.ts:529-539` (the instant acknowledgement too)
  - `grantBetaPlan` re-applies the hold on every tester sign-in (`billing.ts:37-47`, `auth.ts:193`)
- **What causes the fear: partly yes [code + inference].**
  - **At consent:** the owner still grants Google's send permission on screens that say nothing about sending (§2.1).
  - **At the first demo:** the product tells them it failed and points them to Settings (§2.2).
  - **In Settings:** the calming sentence is four tabs from the Disconnect button, and five sentences on its own tab contradict it (§2.3).
  - The residual risk is no longer an unasked send. It's an owner who can't tell *from the screen* that nothing will be sent.
- **The one path that could repeat the event** is administrative, not first-run: §3.1.

### 1.5 What this does to the 2026-09-24 hypotheses (`2026-09-24-simplify-the-app.md` §3)

- **H1, "ten drafts to read":** ruled out by timing unless he came back later. The ten drafts were created after he left. Sign-ins aren't recorded, so a later return can't be excluded.
- **H2, "drafts for non-leads":** now a question about the two **sends**. Did they go to old threads, suppliers, or people he'd already handled? Query 1 answers it.
- **H3, "thought it was about to send":** upgraded. It probably *had* sent.
- **H4, "no visible value":** weakened. The 2026-09-07 dashboard would have shown a Sent count.
- **Consequence for that document's ranking.**
  - Its §7.4 said to re-rank against draft quality if he left after reading drafts. He didn't read queued drafts: none were queued.
  - If query 1 confirms the sends, the root cause was **sending without consent**. Behaviour already fixes that. What's left is the presentation gaps in §2 below.

### 1.6 Four read-only queries (about 5 minutes, founder)

```sql
-- 1. Did FollowUp send before he left? To whom, saying what, triggered by what?
SELECT f."sentAt", f.automated, f.trigger, f.channel, left(f.message, 300) AS message, l.name, l.email, l."createdAt" AS lead_created
FROM "FollowUp" f JOIN "Lead" l ON l.id = f."leadId"
WHERE l."businessId" = 'cmtqfyyhv0000ld046twam6g4'
ORDER BY f."sentAt";

-- 2. Which switch did he touch at 21:55? A rule row he toggled for the first time
--    was CREATED then (the route upserts; auth.ts at the time created only auto_send).
SELECT action, enabled, "triggerDays", "triggerHours", "createdAt"
FROM "Automation" WHERE "businessId" = 'cmtqfyyhv0000ld046twam6g4' ORDER BY "createdAt";

-- 3. Which rules were still producing drafts after he left?
SELECT meta->>'trigger' AS trigger, count(*), min("createdAt"), max("createdAt")
FROM "AuditEvent" WHERE "businessId" = 'cmtqfyyhv0000ld046twam6g4' AND action = 'ai.hold'
GROUP BY 1;

-- 4. Did anyone answer the automated sends?
SELECT f."sentAt", f."repliedAt", l.name FROM "FollowUp" f JOIN "Lead" l ON l.id = f."leadId"
WHERE l."businessId" = 'cmtqfyyhv0000ld046twam6g4' AND f.automated;
```

Then ask him the neutral question from `2026-09-24-simplify-the-app.md` §3: *"What did you expect FollowUp to do the day you connected it, and what did it do instead?"*

---

## 2. Findings, ranked by how likely each is to make a new owner give up

The order is my judgement **[inference]**: how many owners reach the condition, multiplied by how close it sits to the decision to stay. Effort for every fix below is S (a day or less), except where noted.

### 2.1 The consent moment says nothing about sending, and testers repeat it weekly

**Where [code]:**
- `OnboardingForm.tsx:231`, the Email row: *"Gmail or Outlook — where most enquiries already land."*
- `:234`, once connected: *"Connected as {email}"*
- `:408-429`, the only box under a connected inbox. It asks for data, not trust: *"Help improve FollowUp — Let us learn from the replies you edit…"* (`ImproveFollowUpToggle`)
- `settings/page.tsx:863`, the Gmail row when not connected: *"Required — FollowUp reads sales conversations from your inbox to score leads and draft replies, and puts booked calls on your Google Calendar."* ("Required" is also false: onboarding treats every source as optional.)
- `dashboard/page.tsx:252-266`, the weekly reconnect, which sends testers to exactly that Settings row

**What the owner sees:**
1. They press Connect.
2. Google warns that the app is unverified (repo research, Grade B: `research/integrations/2026-09-10-meta-google-verification-playbook.md` §2.1).
3. Google lists the send permission. Its wording for `gmail.send` is, to my knowledge, *"Send email on your behalf"*: Grade C, not confirmed verbatim, since Google's scope page was egress-blocked. One screenshot would settle it.
4. They're back on "Connected as …", with a request to share their edits.

At no point on that path does FollowUp say it won't send. The one sentence that does is on the previous screen, and it can be skipped.

**Why it hurts:**
- This is the order Manoj met: told "reads… and tells you", asked by Google to allow sending, then saw sends. Today's order is the same minus the sends. The owner has to take on faith something the product never said at the moment it mattered.
- The 2026-09-15 audit (§1.5) found the read-only framing on the onboarding screen. The onboarding version was fixed; **its twin in Settings wasn't**.
- Every Gmail consent after the first happens in Settings: a skipped connect, a second inbox, and above all **the reconnect forced every 7 days by Google's Testing mode**. So every tester gives the send permission weekly against a sentence that says FollowUp reads.

**Smallest fix (presentation only; copy with UX weight):**
- **Email row:** *"Gmail or Outlook. Google will ask to let FollowUp read and send email. Nothing is sent until you press send."*
- **Beta line under it:** *"Google will also warn that FollowUp isn't verified yet. That's expected during the beta."* This is the in-product version of what `docs/tester-onboarding-checklist.md` asks the founder to text each tester.
- **Once connected:** *"Connected as {email}. Nothing is sent from it until you press send."*
- **Settings row (`:863`):** the same sentence, branched on `holdAllForApproval` (already loaded on that page), so it's never false for an account that has granted sending.
- Principle 9 check: no "OAuth", "scope" or "draft".

**Rule:** 3.

### 2.2 "Send a test lead to myself" reports a failure on every new account

**Where [code]:**
- `src/app/api/leads/test-lead/route.ts:69-75` and `:86-90` build the message from `result.sent`.
- On a holding account, `acknowledgeNewLead` returns `{ sent: false, reason: "held for approval" }` (`acknowledge.ts:529-539`).
- `holdAllForApproval` defaults to true (`schema.prisma:235`).
- No test pins these strings.

**What the owner sees:**
- Pressing the button returns: *"Created the test lead, but the reply didn't go out (check that Gmail is connected in Settings)."*
- A second press returns *"Used your existing test lead, but the reply didn't go out (check that Gmail is connected in Settings)."*
- Meanwhile the reply sits under "Needs your OK" on the same page.
- On the first press the message may only flash: the refresh swaps Today's empty branch for the populated one, which unmounts the button. **Not rendered.**

**Why it hurts:**
- This is the only self-serve way to see the product work (2026-09-16 audit §3.3), and it reads as a broken Gmail connection. It's the reverse of the truth: Gmail is connected, and FollowUp did what the beta promises, which is to wait.
- It sends the owner to Settings. Settings opens on Connect, where the inbox row carries a coral Disconnect button (`settings/page.tsx:880-887`). **[inference]** "Is it broken?" is the thought that ends a trial.

**Smallest fix (presentation only):**
- When `result.reason === "held for approval"`, say: *"Test lead added. FollowUp wrote a reply and it's waiting for your OK at the top of Today. Send it and it arrives at {email}."*
- Keep the Gmail wording only for a real send failure.

**Rule:** 3.

### 2.3 The route Manoj took through Settings is still built the same way

**Where [code]:**
- `settings/page.tsx:103` opens on the "Connect" tab; `:40-47` puts "Advanced" last of five.
- `:880-887`: coral Disconnect beside the inbox. `:705`: the confirm text, unchanged since 2026-09-07.
- `:1109-1113`: the correct reassurance, on Advanced.
- `:1373-1392`: an ON switch named "Automatic follow-ups".
- `:505-512`: its off-confirm.
- `:1395`: "Change the timings" expands to four rule boxes whose copy predates the hold.

**What the owner sees on a holding account (true for every tester):**

| Line | Says | True? |
|---|---|---|
| `:510` (master-off confirm) | "Turn off every automated follow-up? **Nothing will go out on its own until you turn this back on**" | Implies things go out on their own now. They don't |
| `:1409` | "**Autonomous sends every draft with no review at all** — opt-in per lead only." | False while held, and contradicts the "Let some leads skip the check: Off" box two boxes up |
| `:1474-1477` | "Within a minute of a new lead's first email, **FollowUp sends** a short 'thanks…' … If it does reply, it tells you what it sent." | False. The acknowledgement is held (`acknowledge.ts:529`) |
| `:1509` | "FollowUp drafts the reply and **either sends it** … or holds it" | Half false |
| `:1567` | "FollowUp **switches to** a different kind of message" | Already quoted in 09-24 H3; still live |

**Why it hurts:**
- The first box says nothing reaches a customer without the owner. Directly under it: a live switch called "Automatic follow-ups", a confirm that talks about things going out on their own, and four rules that say "sends".
- An owner can't tell which is true. The one control whose effect they can be sure of is Disconnect, on the first tab.
- That is the sequence Manoj went through: settings at 21:55, disconnect at 21:57.
- The 2026-09-23 decision log (self-critique 4, "The two surfaces that still described a sending account") says no single list of every surface that claims sending exists. The table above plus the inventory in §2.3a is that list, for first-run surfaces.

**Smallest fix (presentation only):**
- **(a)** Branch these five strings on `holdAllForApproval`, exactly as `describeAutomationState()` already does (`:445-498`). For example:
  - `:1474`: *"When someone writes for the first time, FollowUp writes a short 'thanks, we got your message' in their language and puts it in Needs your OK."*
  - `:510`: *"Turn off automatic drafting? FollowUp will stop writing follow-ups for you. Nothing was being sent without you either way."*
- **(b)** Under the connected Gmail row on the Connect tab, one line: *"Nothing is sent from this address until you press send. What FollowUp may send is under Advanced."*
- **(c)** The structural move, a "Sending" tab first, is `2026-09-24-simplify-the-app.md` #3. It's not proposed again here; `frontend-3d-agent` builds it if approved.

**Rule:** 3. Copy with UX weight.

#### 2.3a Remaining "sends on its own" claims on first-run surfaces (holding account)

| Surface | file:line | Covered before? |
|---|---|---|
| Settings, five strings | table above | `:1567` only (09-24 H3) |
| Today, empty queue: "Anything FollowUp isn't sure about will show up here before it sends." | `ApprovalQueue.tsx:260` | 09-24 #1(c) |
| Today, "About to be lost": "Automation is already working these" | `dashboard/page.tsx:343` | 09-24 §2. **The same sentence Manoj read on 2026-09-07** (dashboard at `1209218:116-117`) |
| Today, no inbox: "Connect one and it starts answering the people who write in, within minutes." | `dashboard/page.tsx:275-276` | New, see §2.8 |
| Leads list: "following up soon" | `LeadsPageClient.tsx:62` | 09-24 #8 |
| Test-lead result | `test-lead/route.ts:74`, `:89` | New, §2.2 |
| Landing, "As it happens": "FollowUp sends something for you." | `src/app/page.tsx:422` | New. Seen before sign-up; lower weight, my lane |

### 2.4 Google refusals: an owner who cancels is told they're not on the list; one who isn't on it is stuck on Google's page

**Where:** `src/app/api/integrations/gmail/callback/route.ts:43-47` **[code]**.

**What the owner sees:**
- **(a) An owner who presses Cancel** on Google's unverified warning or permission screen comes back to onboarding reading: *"Google didn't allow the connection. While FollowUp is in beta, Google only lets accounts Sahil added as test users connect — email contact@followupbase.io with this address and try again once it's added."* These are the Manoj-type owners.
- **(b) A tester Sahil forgot to add on Google's side** (step 2 of `docs/tester-onboarding-checklist.md`) sees Google's own "Access blocked … Error 403: access_denied" page. One external report says Google does **not** redirect back from that page ([home-assistant/core#138435](https://github.com/home-assistant/core/issues/138435), Grade C, read through a summarising fetch). If that holds, FollowUp's message never appears for the case it was written for.

**Why it hurts:**
- (a) mistakes hesitation for a permissions problem. The result is an email to Sahil, "you're already on the list", and a loop. Nobody tells the hesitant owner the one thing that would help: nothing was shared, and they can try again.
- (b) is a dead end on someone else's page, with the browser's back button as the only way out.

**Smallest fix (presentation only):**
- Cover both causes: *"Google didn't finish connecting. If you pressed Cancel, nothing was shared, so press Connect when you're ready. If Google said FollowUp is blocked or still in testing, your address isn't on the beta list yet: email contact@followupbase.io and we'll add it."*
- §2.1's pre-warning covers the rest.
- **Verify (b)** with one Google account that isn't a test user. Two minutes.

**Rule:** 3 / table stakes.

### 2.5 A wrong Google account at sign-in lands on NextAuth's unbranded error page

**Where [code]:**
1. `src/lib/auth.ts:134-136` sets only `pages.signIn`.
2. The gate returns `false` (`:179-185`).
3. NextAuth redirects to `/api/auth/error?error=AccessDenied` (`node_modules/next-auth/core/routes/callback.js:83-87`).
4. `AccessDenied` is not in the list NextAuth sends back to the sign-in page, and `pages.error` is unset (`core/index.js:208-223`).
5. So NextAuth renders its built-in page (`core/pages/error.js:30-37`).

FollowUp's own message in `SignInClient.tsx:131-139` (*"That Google account isn't on the list. FollowUp is invite-only for now — email contact@followupbase.io"*) **cannot be reached on this path.**

**What the owner sees:** a plain NextAuth card, "Access Denied / You do not have permission to sign in." with a "Sign in" button. No FollowUp branding, no contact address, no hint.

**Why it hurts:**
- An owner with both a personal and a business Google account who picks the wrong one meets a page that looks like a broken site.
- Testers know Sahil personally, so the likely cost is a bad first impression plus a message to him, rather than a lost tester. **[inference]**
- Sign-in itself is *not* blocked by Google's Testing mode. Google exempts apps that request only name, email and profile, and "Sign in with Google" ([Google, OAuth 2.0 overview](https://developers.google.com/identity/protocols/oauth2), Grade B snippet). So this page, not Google, is the real wall at the door.

**Smallest fix:**
- `pages: { signIn: "/signin", error: "/signin" }`. One line; the existing message then renders.
- Optionally add: *"Signed in with a different Google account? Press Continue and pick the one you gave Sahil."*
- **Type:** presentation only. It doesn't change who gets in.
- **Verify** with one unlisted account.
- **Rule:** table stakes.

### 2.6 An owner who unticks "send" on Google's screen gets "Connected", then a failing first Approve & send

**Where:**
- FollowUp requests three permissions beyond sign-in (`gmail.ts:41-46`). Google shows per-permission checkboxes when an app requests more than one ([Google, "How to handle granular permissions"](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions), Grade B snippet) **[external]**.
- `exchangeCodeForTokens` never reads the granted scopes (`gmail.ts:175-217`). It only calls `getProfile`, which needs read access **[code]**.
- A send error's raw `err.message` reaches the approval card (`sending.ts:666` → `ApprovalQueue.tsx:90-92`).

**What the owner sees:**
- Onboarding says Connected, leads import, and drafts appear.
- The first **Approve & send** fails, with Google's raw error under the card. For a missing scope the Gmail API's usual text is *"Request had insufficient authentication scopes."* (**[inference]**, not observed).
- If they unticked *read* instead, `getProfile` fails and Google's raw message comes back to onboarding (`callback/route.ts:61-64`).

**Why it hurts:** the owner most likely to untick "send" is the careful one, exactly who approval-first is designed for. The product's main button fails for them the first time they press it, in jargon.

**Smallest fix (presentation plus a small check; nothing about what is sent changes):**
- Compare the granted scopes at connect. If `gmail.send` is missing, return with: *"Connected for reading only. FollowUp can write replies, but Google wasn't allowed to send them from here. Reconnect and allow sending when you're ready."*
- Map the insufficient-scope send error to the same sentence.
- **Founder's call (behaviour):** a deliberate "read-only" mode, where FollowUp writes and you send from Gmail yourself. It would be a lower first rung on the autonomy ladder (Rule 5), for the owner who won't grant sending on day one.

**Rule:** 3.

### 2.7 The first "Approve & send" ends in silence

**Where [code]:**
- On success the card is simply removed (`ApprovalQueue.tsx:88-95`).
- Only the cancel path gets a sentence (`:210`, *"Stopped — nothing was sent."*).
- The page headline is server-rendered and keeps saying "N drafts need your OK" (`dashboard/page.tsx:187`, `:140-148`).

**What the owner sees:** "Sending to Priya in 10s", then the card is gone. No "Sent", no address, no link to the thread.

**Why it hurts:** the first message ever sent in the owner's name is the moment trust is confirmed or doubted. Brand principle 1: the owner "must always be able to see what was sent, to whom". This is a low risk of giving up, but a real trust cost.

**Smallest fix (presentation only):**
- For a few seconds, replace the card with *"Sent to Priya from your Gmail. It's in your Sent folder too."*, linked to the lead.
- Refresh the headline count.

**Rule:** 3.

### 2.8 The no-inbox state is false for Instagram- or WhatsApp-only owners, and for holding accounts

**Where [code]:**
- `dashboard/page.tsx:123-127` treats only Gmail or Outlook as "connected".
- `:271-277` shows: *"No inbox is connected yet, so FollowUp isn't watching for leads. Connect one and it starts answering the people who write in, within minutes."*
- `setupStatus.ts:141-151` adds a "Connect your inbox" step that can't be dismissed.
- Onboarding offers Instagram, Facebook and WhatsApp (`OnboardingForm.tsx:240-295`) and says *"Leave the rest — FollowUp won't ask about them again"* (`OnboardingSources.tsx:188-189`).

**What the owner sees:** an owner who connected only a DM channel is told FollowUp isn't watching, is asked for an inbox immediately after being promised it wouldn't ask, and is promised "answering within minutes", which a holding account never does.

**Why it hurts:** it tells an owner who set things up correctly that the product isn't working, and makes a sending promise the account doesn't keep.

**Smallest fix:**
- **Presentation only:** branch on any connected source (the page can read what `onboarding/page.tsx:42-43` reads) and on the hold. For example: *"FollowUp is watching your Instagram. When someone writes, it writes the reply and waits for your OK."*
- **Founder's call:** whether email should be dismissible. The two decisions on file disagree: `setupStatus.ts:54-58` versus the founder's quote at `OnboardingSources.tsx:19-25`.

**Rule:** 3.

### 2.9 Most testers keep the pre-filled business name, and customers see it

**Where [code]:**
- `auth.ts:250` names a new business *"{Google name}'s Business"*.
- `onboarding/page.tsx:48` and `OnboardingForm.tsx:93` pre-fill it, which hides the *"e.g. Riverside Realty"* placeholder (`:343`).
- `leadName.ts:81-86` treats only "My Business"-style names as placeholders.
- `acknowledge.ts:260-262` writes the name into *"Thank you for contacting {name}."*

**[data]:** in the 2026-09-23 production table (`design-decisions.md:6044-6046`), two of the three businesses holding drafts still carry the generated name: "Manoj Thakur's Business" and "Vansh Goura's Business".

**Why it hurts:**
- Not a reason for an owner to give up. It's a trust cost on the customer's side.
- It's also a sign that step 1 gets clicked through unread, which fits §2.1's concern about step 2. **[inference]**

**Smallest fix:**
- **Presentation only:** don't pre-fill; add the hint *"This name goes in messages to your customers."*
- **Founder's call (behaviour):** treat the generated name as a placeholder in `businessDisplayName`.

**Rule:** 3.

### 2.10 The onboarding sync summary uses our words and sets no expectation

**Where [code]:** `OnboardingForm.tsx:125-128`: *"Found 18 leads already, 15 scored."*

**Why it hurts:**
- "Scored" is internal vocabulary (brand principle 9).
- Nothing says what happens next. With drafting tied to the send window (still unfixed, §4), the next screen can show leads, two zeros and an empty queue for up to ~14 hours.

**Smallest fix (presentation only):**
- *"Found 18 customer conversations. FollowUp will write replies for the ones waiting on you and put them on Today for your OK."*
- No time promise until the send-window change in 09-24 #10 ships.

**Rule:** table stakes.

---

## 3. Outside the first run, but it is Manoj's fear exactly

### 3.1 Removing a tester switches their account to sending without asking. HIGH severity.

**Where [code]:**
1. `/admin` "Remove" (`AccessRequestList.tsx:139`) calls `api/access-request/[id]/route.ts:28`.
2. That calls `setBetaPlanForEmail(email, false)` (`billing.ts:62-67`).
3. Which calls `revokeBetaPlan`, and that writes `{ subscriptionStatus: null, tier: "free", holdAllForApproval: false }` (`billing.ts:49-55`).
4. A removed tester can still sign in: the gate governs sign-up only (`auth.ts:154-164`, `:186-195`). Their inbox stays connected.
5. With the hold off and `autoSendAllowedAt` null, the backlog guard doesn't apply (`automation.ts:909-922`). ASSISTED leads with low-risk drafts on live threads (not cold, not backfilled) are then **sent unreviewed** on the next hourly check (`:1033`). Free tier still allows this: it only blocks the skip-the-check mode (`:923`).
6. `betaPlan.test.ts:61` pins this behaviour.

**Why it matters:**
- It is the one code path by which today's product can repeat Manoj's event. It fires from a routine admin action, and the owner never granted anything.
- It contradicts the landing FAQ (*"Every account starts with each reply waiting in your approvals list until you send it"*, `page.tsx:565`) and the `@default(true)` that has applied to every account since 2026-09-21.
- Manoj himself is safe only because his Gmail is disconnected (`sendChannels.ts`).

**Smallest fix:**
- Drop `holdAllForApproval` from `revokeBetaPlan`'s write, and update the test.
- **Type:** behaviour. **Founder's call; I'd recommend the same day.**
- **Rule:** 3.

### 3.2 A tester's "send on my behalf" is silently undone at their next sign-in

**Where [code]:**
- `grantBetaPlan` runs on every tester sign-in (`auth.ts:193`) and sets `holdAllForApproval: true` (`billing.ts:44`).
- Sessions last at most 7 days (`auth.ts:117`).

**What the owner sees:** a tester who pressed "Yes, send on my behalf" finds Settings back at "FollowUp asks you before every message" within a week, with no message saying so.

**Why it hurts:** it fails safe, but it breaks the promise in reverse: a setting the owner chose turns itself off. It matches the founder's 2026-09-19 intent (*"I want them to keep an eye"*, `billing.ts:40-43`), which is exactly why the UI shouldn't offer testers the choice.

**Smallest fix (founder's call):**
- **Presentation only:** on beta accounts, replace the grant link with *"During the beta, FollowUp always asks first."*
- **Behaviour:** apply the hold only when the beta plan is first granted.

### 3.3 The record still couldn't explain the next Manoj

**Where [code]:**
- `automation.settings.update` is written before validation, with no meta (`automation/settings/route.ts:118-119`).
- Sign-ins aren't recorded (2026-09-16 §4.2).
- Disconnecting records no reason.

**Why it matters:** this is why his exit took nineteen days and a code comment to reconstruct.

**Smallest fix:**
- Record the event after the save, with `{ field, from, to }` (table stakes, Rule 2/3).
- **Founder's call:** an optional one-tap "what made you disconnect?" in the Disconnect confirm. It would feed the passive-feedback pillar, must stay skippable, and adds no step.

---

## 4. Already covered and still live (not re-argued)

| Finding | Where now | Covered in |
|---|---|---|
| A failed first sync shows nothing | `OnboardingForm.tsx:121-135`. **New detail:** the comment excusing the silence (`:107-112`, "no active subscription") describes a case that can no longer happen for a tester (beta plan) or a Free account (`billing.ts:123`) | 09-15 §2.1; 09-16 §1.2; 09-24 §1.3 |
| Drafting blocked outside 08:00–18:00 New York; empty queue after an evening signup | `automation.ts:565-568` | 09-16 §5; 09-24 #10 |
| Business timezone can't be set | `schema.prisma` `Business.timezone` | 09-15 §4.4 |
| "Approvals" is named, but no page by that name exists | `settings/page.tsx:497`, `:1113`; `dashboard/page.tsx:224` | 09-24 #1(a) |
| Tiles fixed at zero on holding accounts | `dashboard/page.tsx:315-337` | 09-24 #1(d) |
| Team size asked at step 1 | `OnboardingForm.tsx:369-382` | 09-24 §1.1 |
| "Found N" undercounts; `truncated` dropped | `sync/route.ts:34-35` | 09-16 §2.1 |
| Lead page "Send now" has no undo; "AI-suggested follow-up" | `MessageComposer.tsx` | 09-24 #4 |
| A held draft reaches the owner only through the bell or Today | `holdNotices.ts`, `NotificationBell.tsx` | 09-24 #9 |
| Instagram connect, webhook id, poller echoes | `instagram.ts`, `instagramPoll.ts` | `research/audit/2026-09-24-app-review-path-audit.md` F1–F4 |

## 5. Checked and fine, so nobody re-fixes it

- **Testing mode doesn't block sign-in.** Only name, email and profile are requested at sign-in, which Google exempts (external, Grade B). The wall is §2.5.
- **The 7-day Gmail expiry is explained on Today** (`dashboard/page.tsx:252-257`), with one-click reconnect.
- **On a holding account the instant acknowledgement is held, recorded (`ai.hold`) and announced** (`acknowledge.ts:529-539`). Nothing can go out during the onboarding sync.
- **Nothing is drafted for a business with nothing connected** (`sendChannels.ts`). Manoj's twelve days of drafting can't recur.
- **Step 2's third point is true today** (`OnboardingForm.tsx:489-490`). The problem is where it sits, not what it says.
- **The single Approve & send has a 10-second undo** (`ApprovalQueue.tsx:83-97`).
- **A failed OAuth connect returns to onboarding step 3 with its error**, not the explainer (`onboardingResume`, `OnboardingForm.tsx:146-148`).

## 6. Self-critique

1. **None of this was run.** The test-lead flash (§2.2), the Google redirect behaviour (§2.4b), the granular checkboxes and their error text (§2.6), and Google's exact consent wording (§2.1) are all unverified live. Each has a named check that takes two minutes.
2. **Treating `2644398` as Manoj's account is an inference.** It's strong, five matching points, but the commit names nobody. §1.2's second inference (the master switch stayed on) depends on it. Query 1 confirms or kills both.
3. **The timezone of the brief's data is unknown.** It changes which Settings version he saw (two rules or three), not the conclusion.
4. **The ranking is judgement.** §2.5 could reasonably sit higher: it's a total block for whoever hits it. I placed it lower because testers are hand-invited and can reach Sahil directly.
5. **§3.1 is outside the brief's scope** and more serious than anything in §2. It's in the summary on purpose.
6. **Not examined:** the Outlook first-run path, and the WhatsApp popup path in onboarding.

## 7. Sources

**Code, first-hand at `7a58066`:**
- `src/lib/auth.ts`; `src/components/landing/SignInClient.tsx`; `src/app/signin/page.tsx`; `src/app/api/auth/[...nextauth]/route.ts`
- `node_modules/next-auth` (v4.24.15): `core/routes/callback.js`, `core/index.js`, `core/pages/error.js`
- `src/app/onboarding/page.tsx`; `src/components/{OnboardingForm,OnboardingSources,ImproveFollowUpToggle,ApprovalQueue,TestLeadButton,useUndoableSend,LeadAutomationToggle}.tsx`
- `src/app/api/integrations/gmail/{connect,callback,sync,disconnect}/route.ts`; `src/lib/integrations/gmail.ts`; `src/lib/gmailSync.ts`
- `src/app/api/leads/test-lead/route.ts`; `src/app/api/leads/[id]/send/route.ts`; `src/app/api/automation/settings/route.ts`; `src/app/api/business/setup-step/route.ts`
- `src/lib/{acknowledge,automation,sendChannels,billing,setupStatus,holdReasons,leadName,pricing,sending}.ts`
- `src/app/(app)/{dashboard,settings}/page.tsx`; `src/app/page.tsx`
- `prisma/schema.prisma`; `prisma/migrations/*` (Automation inserts)

**History (`git show`):**
- `e1cb531` (#83), with migration `20260906234500`
- `e7c258e`/`e1cb531`: `OnboardingForm.tsx` as of 2026-09-06
- `3df0357` and `1209218`: `settings/page.tsx` and the dashboard as of 2026-09-07
- `e48897c`: `automation.ts` and `vercel.json`
- `95ca164` and `0908b88`: `vercel.json` (daily cron)
- `fc6db0d` (#117: first `ai.hold`/`ai.send`)
- `fdd77b4` (#96: audit trail, disconnect)
- `0819a7b` (#165: approval queue)
- `2644398` (#274: the "real account" fix)

**Repo documents:**
- `research/product/2026-09-15-first-run-journey-audit.md`, `2026-09-16-first-run-dead-ends-and-time-to-value.md`, `2026-09-24-simplify-the-app.md`
- `research/integrations/2026-09-06-gmail-oauth-verification.md`, `2026-09-10-meta-google-verification-playbook.md` §2.1
- `research/audit/2026-09-24-app-review-path-audit.md`
- `docs/tester-onboarding-checklist.md`
- `design-brain/decisions/design-decisions.md` (2026-09-23 entries, production table at `:6044`)
- `TEAM.md`; `PRODUCT_DIRECTION.md`

**External (checked 2026-09-25; WebFetch to Google domains was `EGRESS_BLOCKED`, so snippets only):**
- [Google — Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2). Testing-mode exemption when only name, email and profile are requested, including "Sign in with Google". **Grade B** (snippet).
- [Google — How to handle granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions). Per-permission checkboxes when more than one scope is requested. **Grade B** (snippet).
- [home-assistant/core#138435](https://github.com/home-assistant/core/issues/138435). "Access blocked… Error 403: access_denied" leaves the user on Google's page with no redirect. **Grade C** (one report, read through a summarising fetch).
- Google's consent wording for `gmail.send` ("Send email on your behalf"). **Grade C**: my recollection, weakly corroborated by a snippet from [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). Confirm with one screenshot before quoting on a screen.
