# Simplify the app: what a new owner has to learn, and how to get it under a minute

**Date:** 2026-09-24 (file name as briefed; finished early on 2026-09-25)
**Author:** product/UX lead (product-narrative lane)
**Brief (Sahil, verbatim):** *"We want to improve our apps, internal dashboards, pipeline leads, and all the stuff to make it simpler so that users can have a more simplified version of FollowUp. That way, they can understand they should not invest their time learning the FollowUp app. That is very disturbing for them as well. I wanted it to be very simple and quick to learn, so that they can easily manage their workflow with the help of FollowUp."*
**The bar used throughout:** a new owner (a realtor or contractor, on a phone, who will not read instructions) understands what to do **within one minute, without being taught**.
**Code read at:** `claude/followup-demo-to-production-4k39hr`, HEAD `ec179f5`, clean working tree.
**What this is:** research and a ranked proposal. **No app source, design-brain file or git state was changed.** Nothing here is approved; nothing was recorded in `design-brain/decisions/` because nothing was decided.

**Read this before quoting anything.** Every claim about the app is taken from the code and cited by file. Every claim about how an owner would *feel* or *act* is my inference, marked **[inference]**. Nobody has watched a real owner use this app, including for this document. Two external sources are cited (§9). Both come from WebSearch snippets only. WebFetch returned `EGRESS_BLOCKED` for nngroup.com this session, the same block every earlier research pass hit.

---

## Summary

1. **The biggest learning cost: FollowUp asks the owner to learn how it makes decisions.** There are 12 separate controls over what it writes and sends, spread across 4 screens and 3 different sets of words. Meanwhile one default the owner never sees (`holdAllForApproval @default(true)`: every account holds every message) means most of those controls have no visible effect.
2. **What the owner actually needs to know fits in one sentence:** *"FollowUp writes your follow-ups. You press send. Later, you can let it send the simple ones."* Everything else should stay out of sight until it actually does something.
3. **Change 1: make Today the product, and make it truthful (S–M, presentation).** One queue, with each person shown once. One name for that queue everywhere (four places in the app tell owners to go to an "Approvals" page that doesn't exist). No tiles stuck at zero (2 of the 3 tiles count only automatic sends, so they show 0 on every account today).
4. **Change 2: cut the menu from seven items to three (M, presentation).** Today · Leads · Settings, shown as a bottom tab bar on phones instead of a hamburger menu. Pipeline becomes a view inside Leads. Follow-up plans move into Settings. Analytics and Activity are reached from Today. No page or capability is removed.
5. **Change 3: one place, first in Settings, that says what FollowUp is allowed to do (M, presentation plus one call for Sahil).** The send permission comes first, the timing controls fold away, the guarantee is stated once, and the per-lead and per-source autonomy choices stay hidden until sending is actually switched on.
6. **Confidence:** this is inferred from the code and earlier research, not from watching an owner. Nobody knows yet why Manoj switched off. One audit-log query (§3) will show which switch he used, and it should be run before any of this is built.

---

## 0. The bar, and what the app currently asks a new owner to learn

### 0.1 The one-minute bar as four questions

A new owner passes the bar if, within a minute of landing on Today, they can answer these without help:

| # | Question | Does the app answer it today? |
|---|---|---|
| Q1 | *Is FollowUp working?* | **Only while the account is empty.** The line "Watching you@… — last checked 2 minutes ago" appears only when there are no leads (`dashboard/page.tsx:208-233`). Once leads exist, nothing on Today says it is watching. |
| Q2 | *What do I need to do?* | **Mostly.** The queue answers it well (`ApprovalQueue.tsx`). But the same person can appear again under "About to be lost" (`rescue.ts:116-121` never excludes leads that already have a held draft), and the headline adds both counts together (`dashboard/page.tsx:140-148`). |
| Q3 | *Will it send anything without me?* | **No, and in places it implies the opposite.** On a holding account the empty queue says *"Anything FollowUp isn't sure about will show up here before it sends"* (`ApprovalQueue.tsx:260`), which suggests the sure things go out on their own. Nothing does. The true answer lives in Settings → **Advanced** (`settings/page.tsx:1087-1251`) and in an onboarding step the owner can skip. |
| Q4 | *Where is the person who wrote to me yesterday?* | **Yes.** Leads has search (`LeadsPageClient.tsx:373-381`). |

### 0.2 What changed since the last inventory (2026-09-10)

| Measure | 2026-09-10 | Now | Source |
|---|---|---|---|
| Top-level nav items | 7 | **7** | `Sidebar.tsx:22-30` |
| Settings sections | 12, one long page | **14 visible**, across 5 tabs | `settings/page.tsx:40-69` and the section list |
| `settings/page.tsx` length | 1,040 lines | **1,901 lines** | `wc -l` |
| Stat tiles | 32 | **~10**, plus 9 fact rows on Analytics | dashboard 3, pipeline 3, analytics 1+3 |
| Controls over what FollowUp writes or sends | ~6, across 3 pages | **12, across 4 screens** (list below) | — |

**The 12 controls**, each checked in the code:

1. Settings → Advanced: "Let FollowUp send without asking" (`settings/page.tsx:1105-1251`)
2. Settings → Advanced: "Let some leads skip the check" (`:1258-1371`)
3. Settings → Advanced: "Automatic follow-ups" master switch (`:1373-1397`)
4. Settings → Advanced: "Auto follow-up on silence" plus a number of days (`:1401-1438`)
5. Settings → Advanced: "Check for anyone waiting, right now" (`:1449-1461`)
6. Settings → Advanced: "Instant reply to new leads" (`:1469-1502`)
7. Settings → Advanced: "Reply for me when I haven't" plus a number of hours (`:1503-1559`)
8. Settings → Advanced: "Reactivate cold leads" plus a number of days (`:1560-1603`)
9. Lead page: a three-way per-lead mode (`LeadAutomationToggle.tsx:11-15`)
10. Lead page: "Put on…" a plan (`LeadWorkflowEnrollment.tsx:119`)
11. Follow-up plans page: the plan builder, with Pause/Activate (`workflows/page.tsx`)
12. Settings → Team: a rule per source with five options, plus "Apply to every lead" (`SourceRoutingSection.tsx:148-172`, `:282`)

The same per-lead mode goes by three sets of words:

- *"I'll do it myself / Ask if risky / Handle it all"* on the lead page
- *"Off / Assisted / Autonomous"* in the source rules (`SourceRoutingSection.tsx:160-171`, `:272-274`) and in the Settings rule text (`settings/page.tsx:1406-1410`)
- *"skip the check"* in the permission box (`:1261`)

Plans have four names of their own: *"Follow-up plan"* (nav), *"workflow"* ("Enroll in a workflow", `SourceRoutingSection.tsx:151`; "Workflow name" and "Save workflow", `workflows/page.tsx:535`, `:665`), *"enrolled"* (`:382`) and *"Put on…"*.

By my count, at least 14 new concepts have reached the owner's screen since 2026-09-10 and about 3 have left it. The new ones:

- the two permissions
- "routine" vs "needs you" drafts
- "waiting before you turned sending on"
- Meta's reply windows
- the beta hold
- quick-reply buttons
- "how they write"
- filtered emails
- spam scan
- booking calendar
- business profile
- the consent switch for improving FollowUp
- dismissible setup steps
- the send undo window

Most of these are real and necessary. **What's wrong is where they are shown, not that they exist.**

### 0.3 The fact that changes everything else: every account holds every message

- `holdAllForApproval Boolean @default(true)` (`prisma/schema.prisma:235`) has been the default since 2026-09-21. `autonomousAllowed @default(false)` (`:257`).
- On a holding account the effects are:
  - **The per-lead mode does nothing visible.** Assisted and Autonomous leads are both held (`LeadAutomationToggle.tsx:60-69`; the comment itself says the tier "never sends by itself today").
  - **A plan runs only one step.** It drafts step 1, holds it, and takes the lead off the plan (`sequences.ts:455`, `sequenceId: null` in the hold branch). `workflows/page.tsx:231-242` says so on screen.
  - **"Answered for you" and "Came back" are zero by design.** They count only `automated: true` sends (`rescued.ts:39`, `:97-98`). The Monday digest was fixed for this (`rescued.ts:127-137`). The dashboard tiles were not.
  - **Activity is nearly empty.** It lists only automated sends, notifications and finished plans (`activity.ts:38-41`). Approved sends and held drafts do not appear.
- Production on 2026-09-23 had 20 held drafts in total, 17 of them never judged by the risk check, so they all landed in "needs you" (`design-decisions.md`, "Undo on the single send", table).

**[inference]** An owner looking at this app is shown a lot of machinery for autonomy, and their account uses almost none of it. The one thing they actually do every day is read a draft and press send. That's the job the whole app should be organised around.

---

## 1. Status of earlier simplification recommendations

Status key: **SHIPPED** · **PARTIAL** · **NOT** (not shipped) · **FIXED** (an audit defect, since fixed) · **N/A** (overtaken by events). Each status was checked in the code at `ec179f5`.

### 1.1 `2026-09-10-ux-simplification.md` (§8 plan, plus §2 and §3 sub-items)

| # | Recommendation | Status | Evidence / note |
|---|---|---|---|
| 1 | Approval queue pinned to the top of Today | **SHIPPED** | `ApprovalQueue.tsx`, `pendingApprovals.ts`. Since then: grouped by source, routine pile, 10-second undo on single and bulk sends. |
| 1a | A held draft on an unassigned lead notifies someone | **SHIPPED** | Falls back to admins, `automation.ts:1414-1416` |
| 1b | Bell counts held drafts | **PARTIAL** | Hold notices reach the bell and are summarised above 3 (`holdNotices.ts`). The bell counts unread notifications, not the live queue. |
| 2 | Terminology pass | **PARTIAL** | Shipped: plain labels for the lead mode; "Follow-up plans" in the nav; "Check for anyone waiting, right now"; "Not reviewed yet"; "Weighted value" renamed to "Likely to close" (the proposal was to delete it); rescue-score number removed from Today rows. Not shipped: Assisted/Autonomous/"Enroll in a workflow" in source rules; "Workflow name / Save workflow / hours after enrollment" in the plan editor; the **"AI-suggested follow-up"** heading (`MessageComposer.tsx:114`) and **"Consent & AI activity"** (`leads/[id]/page.tsx:194`); "Unclaimed" (the proposal was "Unassigned"); "Our promise:" still repeated 3× (`settings/page.tsx:1407`, `:1478`, `:1511`). |
| 3 | Today: 13 tiles down to 3, reordered | **SHIPPED** | `dashboard/page.tsx:315-337`. **New problem:** 2 of the 3 read 0 on every holding account (§0.3). |
| 4 | Rebuilt empty Today: promise, "watching" line, setup strip, test lead; sidebar nag cards removed | **SHIPPED** | `dashboard/page.tsx:191-301`, `setupStatus.ts`, `TestLeadButton.tsx`, `Sidebar.tsx:139-146` |
| 5 | Nav 7 → 4 | **NOT** | Only the rename Workflows → "Follow-up plans" shipped. `Sidebar.tsx:22-30` |
| 6 | Settings → 4 tabs with channel status cards | **PARTIAL** | Tabs shipped, but **5** of them, and "Connect" and "Channels" mean the same thing to an owner. No three-state `ChannelCard`. Outlook hidden when unavailable: shipped. CRM taken out of the "Instagram" section: shipped. Team tab hidden for one-person businesses: not shipped. **Automation moved *into* Settings → Advanced, the opposite of the proposal.** Feedback moved to the sidebar (`FeedbackDialog`) and is *also* still in Advanced (`:1790-1832`). |
| 7 | One master switch, one paragraph, the guarantee said once | **PARTIAL** | Master switch, computed sentence and "Change the timings" expander: shipped (`:445-498`, `:1373-1397`). Placement: now in Advanced. Guarantee said once: not shipped. Two permission boxes were added above it. |
| 8 | Lead page: one main action, four collapsed sections | **PARTIAL** | Shipped: status badge moved up, composer moved up, side sections collapsed. Not shipped: a main action that depends on the lead's state; `rescue.reason` as the status line (it uses `scoreReason`); a "held" version of the composer; score, priority pill, stage and deal value still above the fold (`leads/[id]/page.tsx:50-67`). |
| §2 | Leads filter chips 9 → 4 | **NOT** | Still 9, plus Custom filter and saved lists (`LeadsPageClient.tsx:71-81`) |
| §2 | Leads tiles 4 → 0 | **SHIPPED** | Counts moved onto the chips (`:245-249`) |
| §2 | Destructive "Clean up" moved into an overflow menu | **SHIPPED** | "More" menu, `:94-152` |
| §2 | Pipeline as a List/Board switch inside Leads | **NOT** | |
| §2 | Activity merged into an automation area; 3 recent rows on Today | **NOT** | |
| §2 | Analytics out of the nav, reached from Today | **PARTIAL** | The "See all numbers" link shipped (`dashboard/page.tsx:444-449`). It is still in the nav. |
| §3 | Drop team size from onboarding step 1 | **NOT** | `OnboardingForm.tsx:369-382` |
| §3 | Onboarding ends on a proof screen (a real reply) | **NOT** | Step 3 is sources, then Continue → Today (`OnboardingSources.tsx:209-216`) |
| §3 | "Send a test lead to myself" | **SHIPPED** | Also shown on a populated Today while setup is incomplete (`dashboard/page.tsx:387-391`) |
| §9 | Measure page views before cutting the nav | **UNKNOWN** | Vercel Web Analytics is enabled (`STATUS.md:115`). I found no sign anyone has read per-route numbers. |

### 1.2 `2026-09-13-usability-and-engagement.md`

| # | Recommendation | Status | Evidence / note |
|---|---|---|---|
| 1 | Proof-screen onboarding first | **NOT** | See §3 above |
| 2 | Check which channel the "needs your OK" signal reaches the owner on | **NOT** | In-app bell only (45-second poll, `NotificationBell.tsx`), one reminder a day later (`staleApprovals.ts`), and the Monday digest. No push, SMS or per-hold email anywhere I searched (`src/`, and the `mobile/` shell has no notifications). |
| 3 | Keep the queue small and high-precision | **PARTIAL** | Routine vs needs-you split and burst summaries shipped. But on a holding account *every* draft, instant acknowledgements included, goes to the queue, and 17 of 20 in production were never judged. |
| 4 | "Checked, nothing needs you" stated with a timestamp | **PARTIAL** | Stated (`ApprovalQueue.tsx:256`). Only timestamped on an empty account. |
| 5 | A track record that invites more autonomy | **NOT** | The raw number exists: "Drafts sent as written" on Analytics (`analytics/page.tsx:104`) |
| 6 | Rule out gamification in writing | **NOT** | No entry in `rejected.md`. Nobody has proposed it either. |
| 7 | Tell the owner when an automated send went wrong | **NOT FOUND** | I found no surface for this |

### 1.3 First-run audits (`2026-09-15-first-run-journey-audit.md`, `2026-09-16-first-run-dead-ends-and-time-to-value.md`), UX-facing items only

| Item | Status | Evidence |
|---|---|---|
| $29 "one plan" on the landing page vs $0/$39/$79 in the app | **FIXED** on the landing page | No "$29" or "One plan" in `app/page.tsx`. `setupStatus.ts:96` still says "Start your free trial" to a lapsed account. |
| Onboarding headline described a read-only product | **FIXED** | `OnboardingForm.tsx:457-534`, beat 3 |
| A failed first sync shows nothing | **NOT FIXED** | `OnboardingForm.tsx:121-135` has no `else`. The `.catch` is silent. |
| Raw `access_denied` shown to the owner | **FIXED** | `gmail/callback/route.ts:43-47` |
| Queue empty outside 08:00–18:00, because the send window blocks *drafting* | **NOT FIXED** | `automation.ts:565-568` runs before the draft |
| Business timezone can't be set | **NOT FIXED** | No UI or API writes `Business.timezone`, so every account is on New York time |
| Setup strip stuck on a phone step that can never be finished | **FIXED** | Gated by a flag (`setupStatus.ts:181`); widget step can be dismissed |
| Instagram/Facebook "connected" but never subscribed to messages | **ADDRESSED** (not re-checked end to end) | `subscribed_apps` in `instagram.ts`/`facebook.ts`; `ChannelNotReceiving` |

### 1.4 `research/customers/2026-09-05-icp-pain-and-trust-objections.md`

| Flag | Status |
|---|---|
| Treat home-services contractors as an ICP alongside realtors | **In the app:** "Home services (contractor, cleaning, etc.)" is an onboarding industry (`industries.ts:20`). The landing page dropped personas by decision (A-014). |
| A consent reminder when a business connects SMS | **N/A.** Carrier channels are withdrawn (`CARRIER_CHANNELS_AVAILABLE = false`), so a new customer can't connect SMS. |

**Pattern across the tables.** The trust fixes and the per-screen polish landed. The structural simplifications did not: nav, settings layout, lead page hierarchy, onboarding payoff. Meanwhile the automation features grew into the gap. The one proposal that moved in the opposite direction is automation, which went further *into* Settings.

---

## 2. Per-screen findings

"One job" is the single question a busy owner opens the screen to answer.

| Screen | The one job | What doesn't serve it | Merge / hide / remove | Words an owner won't recognise |
|---|---|---|---|---|
| **Today** `/dashboard` | *Who needs me, and what do I tap?* | Two tiles stuck at 0 on holding accounts. People with a held draft repeated in "About to be lost". The subtitle *"Automation is already working these"* (`:343`) is false when holding. "Start with Priya — Gmail, **scored 72**" is a bare number (`ApprovalQueue.tsx:302`). The "watching" line disappears once leads exist. | Keep. Remove duplicates, make the tiles count true things, bring the "watching" line back. Absorbs Activity and Analytics as links. | "drafts", "routine", "At risk", "Came back", "Answered for you", "scored" |
| **Leads** `/leads` | *Find a person.* | 9 chips + Custom filter + saved lists. Team chips (Mine, Unclaimed) for a one-person business. A row says "following up soon" (`LeadsPageClient.tsx:62`) where the lead page says "Writing a reply for you to approve" (`AutomationStatusBadge.tsx:163-171`); the list missed the fix for holding accounts. | Keep. 4 chips. Gains a "By stage" view (the old Pipeline). | "Unclaimed", "Hot", "Cold", "Custom filter", "high priority" |
| **Lead page** `/leads/[id]` | *What's going on with this person, and what do I send?* | The composer comes **above** the conversation, so the owner replies before reading. The composer doesn't know a draft was held: no reason shown, **"Send now" with no undo**, while the same draft on Today has "Approve & send" with a 10-second undo (`MessageComposer.tsx:55-69`, `:168`; `ApprovalCard` uses `useUndoableSend`). Score, priority, stage and value crowd the top. The three-way mode shows under "Automation" but does nothing on a holding account. | Keep. Show "they said → the draft → held because → Approve & send (undo)". Move score, stage and value into Details. | "AI-suggested follow-up", "Consent & AI activity", "Automation", "potential", "82/100" |
| **Pipeline** `/pipeline` | *Where does each deal stand?* (a CRM job, Rule 4) | 7-column board. Dragging works only with a mouse (`:270-288`). "Likely to close" comes from a fixed weight table (`:19-27`). Score badges on cards. "My leads only" shown to one-person businesses. | **Out of the nav.** Becomes a "By stage" view in Leads. Stage stays on the lead page. | "Pipeline", "Likely to close", stage names |
| **Follow-up plans** `/workflows` | *Put people on a schedule of check-ins.* | On every account today a plan drafts step 1, holds it and takes the lead off the plan, so no tester has seen step 2. It overlaps the account-wide automatic follow-ups. The editor still says "Workflow name", "hours after enrollment", "Change stage", "Save workflow". | **Out of the nav.** Moves to Settings → Sending. Needs Sahil's decision on resuming after approval (§4, #12). | "workflow", "enrollment", "step", "Change stage", "Activate" |
| **Analytics** `/analytics` | *Is it paying for itself?* | Median reply time as the headline. 9 "Everything else" rows, three of them reply-rate variants. Charts. A team section. Mostly metrics that matter to us, not the owner. | **Out of the nav.** Reached from Today via "See all numbers" (already there). | "Median reply time", "Conversion rate", "Reply rate — automated" |
| **Activity** `/activity` | *What did FollowUp do while I was out?* | Lists only automated sends, which are zero on holding accounts. Approved sends and held drafts are absent. Overlaps the bell and each lead's history. | **Out of the nav.** "Everything FollowUp did →" from Today. Include approvals and held drafts, or it stays empty. | "Automation sent…", "workflow finished", "Stopped itself" |
| **Settings** `/settings` | *Connect a source, or change what FollowUp does.* | 5 tabs, 14 sections. "Connect" vs "Channels". The most consequential decision in the product sits under **Advanced**, as a small underlined link (`:1144`). Business name under **Team**. Source rules under **Team**, pointing to "Automation **above**" (`SourceRoutingSection.tsx:184`), which is on another tab. It also points to a "Workflows page" (`:194`) that the nav calls "Follow-up plans". Two webhook sections listed before WhatsApp and Instagram. Feedback appears twice. "Our promise:" appears 3×. | 4 tabs named after the owner's questions (§4, #7). Webhooks and CRM go under "Other ways in". | "Integrations", "Channels", "webhook", "Outbound webhook", "CRM sync", "Lead routing", "Assisted", "Autonomous" |
| **Onboarding** | *Set me up.* | Asks team size at step 1. Ends on "Continue" into a Today where drafts may not exist until the next cron tick inside 08:00–18:00 New York time. A failed first sync is silent. | Keep the three steps. End on a real draft (§4, #10). Drop team size. | — |
| **Shell** (sidebar / mobile) | *Get me to the right screen.* | On phones all 7 items sit behind a hamburger (`Sidebar.tsx:46-63`). | Bottom tab bar with 3 items (§5). | — |

---

## 3. Manoj: what his account would have shown, and how to find out why he left

**Known:** he switched FollowUp off about 22 hours after connecting (from the brief; I didn't verify this). On 2026-09-23 his business held **10 drafts, all 10 never judged by the risk check, average 247 characters** (`design-decisions.md`, 2026-09-23 production table).

**What the code would have shown him** [inference from code, not observed]:

- Today: "Needs your OK (10)". With `QUEUE_PAGE_SIZE = 3` (`queuePaging.ts:67`), that's three cards, then "7 more need your OK". No routine pile, because unjudged drafts can't be bulk-sent.
- Tiles reading "Answered for you **0**" and "Came back **0**".
- Very likely the same people again under "About to be lost".
- Nothing sent on his behalf, not even the instant "got your message" reply, which is also held since 2026-09-20/21.
- The drafts were mostly for Gmail threads imported from up to 90 days back.

**Four hypotheses. None is evidence.**

| # | Hypothesis | Proposals that would address it |
|---|---|---|
| H1 | **More work, not less.** The first thing FollowUp gave him was ten messages to read. | #1, #9, #11 |
| H2 | **Drafts for conversations that weren't live leads** (old threads, suppliers, pitches; see the 2026-09-20 photographer case). | Not UX. Classification and backfill scope. |
| H3 | **He thought it was about to send.** Settings shows "Automatic follow-ups" switched on, with a sentence listing four rules. Today says "Automation is already working these". The rule for cold leads says FollowUp "switches to a different kind of message" (`settings/page.tsx:1567`). | #1(c), #3 |
| H4 | **No visible value.** Two zeros and nothing sent. | #1(d), #10 |

**How to find out, cheaply, before building anything:**

1. **Which switch did he use?** Query `AuditEvent` for his `businessId` over his first 48 hours, looking for `automation.settings.update` (the master switch), `integration.gmail.disconnect` / `integration.*.disconnect`, `ai.hold_dismissed`, `lead.send` and `approvals.send_safe`, with timestamps. The first two tell you whether he stopped the behaviour or cut the connection. The rest show whether he tried the queue first.
2. **Ask him one neutral question** (in the spirit of `research/customers/2026-09-15-owner-interview-guide.md`): *"What did you expect FollowUp to do the day you connected it, and what did it do instead?"*

---

## 4. Ranked proposals

**Effort:** S = under a day · M = 1–3 days · L = a week or more.
**Type:** "Presentation" means what's shown and said changes, and what the product does doesn't. "Behaviour" changes what the product does and needs **Sahil's decision** under `PRODUCT_DIRECTION.md`.
**Rule** refers to `PRODUCT_DIRECTION.md`'s six rules. Where none applies I say "table stakes".

**Constraints every build must respect.** These come from the design brain. Structural proposals go to `frontend-3d-agent` to build.

- **A-016:** the number of things on the screen goes down *and* the result still reads as designed.
- **R-001:** subtraction is never the whole answer. No proposal below replaces Today with a sentence (D-020) or strips it to text.
- **A-006:** status colour always comes with its word; accent used once per screen; one level of boxes; at most three hues.
- **A-018 / A-019:** the radius and heading ladders.
- **R-002:** no keyboard layer and no command palette.
- **R-003:** no channel switching.
- **S-13:** no "AI" labels.

| Rank | Proposal | Effort | Type | Rule |
|---|---|---|---|---|
| 1 | Today tells the truth and shows each person once | S–M | Presentation (one option is a claim change) | 3 |
| 2 | Nav 7 → 3, with a bottom tab bar on phones | M | Presentation | 1, 4 |
| 3 | One place, first in Settings, for what FollowUp may do; controls stay hidden until they do something | M | Presentation, with one consequence for Sahil | 3, 5 |
| 4 | The lead page treats a held draft the same way Today does | M | Presentation | 3 |
| 5 | One word per concept (§6) | S | Copy | table stakes |
| 6 | One-person mode: hide team words from a team of one | S–M | Presentation | table stakes |
| 7 | Settings tabs named after the owner's questions | M | Presentation | table stakes |
| 8 | Leads: four chips, and the same words as the lead page | S | Presentation | table stakes |
| 9 | The waiting decision reaches the owner outside the app | M | **Behaviour** | mission point 1, 3 |
| 10 | The first session ends on a real reply to send | M–L | **Behaviour** | mission point 1, 3 |
| 11 | A track record that invites "send the simple ones" | M | **Behaviour-adjacent** | 5 (moat) |
| 12 | Follow-up plans: decide how they work, then show them | S / M | **Behaviour** | 1 |

### 1. Today tells the truth and shows each person once

**What changes:**

- **(a) One name for the queue.** Keep the heading **"Needs your OK"**. Rewrite the four user-facing strings that send the owner to "Approvals", a place with no nav entry, so they say *"waits for your OK on Today"*. The four strings: `dashboard/page.tsx:224`, `settings/page.tsx:497`, `:1113`, `workflows/page.tsx:238`. Apply the same fix to "your approval queue" (`LeadAutomationToggle.tsx:36`, `:40`) and "your approvals" (`AutomationStatusBadge.tsx:167`).
- **(b) Each person once.** Leave leads that already have a held draft out of "About to be lost", since they're already on screen with the fix ready. The headline stops counting them twice.
- **(c) Sentences that are true on a holding account:**
  - Empty queue: *"Every reply FollowUp writes shows up here first. Nothing goes out until you send it."*
  - "About to be lost" subtitle: *"FollowUp will write a reply for each of these. It'll appear above for your OK."*
  - Replace "scored 72" with the hold reason.
- **(d) Tiles that can move.** While the account holds, show "Written for you this week" (count of `ai.hold`) and "Waiting for your OK" (count from `getPendingApprovals`) in place of the two tiles that are zero by design. This is presentation, using data that already exists.
  - **Alternative, which needs Sahil:** redefine "Answered for you" and "Came back" to include replies FollowUp wrote and the owner sent. That changes a deliberate trust claim ("Only replies to messages FollowUp sent on its own count here", `dashboard/page.tsx:401`).
- **(e)** Show the *"Watching you@… — last checked N min ago"* line on a populated Today as well.

**Why:** Today is the first screen and the one opened twenty times a day. At the moment it shows two permanent zeros, lists the same people twice, and uses sentences written for an account that sends. Q1–Q3 in §0.1 fail here first. Serves brand principles 1 (trust), 2 (urgency stated once, precisely) and 6 (a verdict with its reason).

**Effort:** S for (a), (c), (e). S–M for (b). M for (d).
**Risk:** low. Option (d)-alt is medium, because crediting FollowUp for replies the owner sent could read as padding the numbers.
**Type:** presentation, except (d)-alt.
**Rejected-list check:** keeps the tiles and the page structure; corrects what they say. Not R-001 or D-020.

### 2. Seven nav items become three, with a bottom tab bar on phones

**What changes:** see §5.

**Why:** four of the seven items lead to builders, numbers or near-empty history. To a new owner, a long menu says "there's a lot here to learn" before they've tapped anything **[inference]**. `design-brain/components/navigation.md` already names both overlaps (Leads/Pipeline, Dashboard/Activity) as open `[TO DECIDE]` items. The same spec says phones need "a bottom tab bar of 3–4 items, not a drawer containing seven". Serves principles 4 (busy owner) and 5 (familiar patterns); Rules 1 and 4 (stop giving prime space to CRM-parity screens).

**Effort:** M. L if Pipeline becomes a true view inside Leads rather than a linked page.
**Risk:** medium. The founder is the only active user and may rely on Pipeline or Analytics. Every route stays and redirects. Check Vercel Web Analytics per-route views first, keeping in mind they are mostly one person's.
**Type:** presentation.

### 3. One place, first in Settings, for what FollowUp may do

**What changes:**

- A new first Settings tab, **"Sending"**, laid out as:
  1. The contract in one sentence: *"FollowUp writes every follow-up. Nothing goes out until you send it."*
  2. The one decision: "Let FollowUp send the simple ones", the existing permission with its four facts, unchanged.
  3. "Change the timings" (the four rules and the master switch), folded, with the stop-on-reply guarantee **said once**. Delete the three "Our promise:" repeats.
  4. "Follow-up plans".
  5. "When a new lead arrives" (renamed from Lead routing, moved from the Team tab).
- **Only after send permission is granted**, show "Let some leads skip the check". Before that, one line: *"More choices open once you let FollowUp send."*
- On the lead page, the per-lead control shows **two** states on a holding account: *"FollowUp writes for {First}"* / *"Leave {First} to me"*. The third ("Handle it all") appears only once skip-the-check is allowed.
- The same rule applies to the "Autonomous" option in the source rules.

**Why:** this is the biggest learning cost (§0.2). It turns 12 controls in 4 places into one sentence, one decision, and details you only see if you go looking. It also makes the autonomy ladder readable in one glance: *writes → sends the simple ones → sends everything*. That's Rule 5 made visible. Serves principles 4 and 3.

**Effort:** M.
**Risk:** medium.
- It touches the most trust-sensitive copy, so the `trustCopy` and `sendPermission` tests need updating.
- It **contradicts reasoning written into the code** at `SourceRoutingSection.tsx:161-168`: *"an option that vanishes teaches nothing"*. The one-line explanation is my answer to that.

**Type:** presentation. **One consequence for Sahil:** an owner can no longer pre-set a lead to Autonomous before granting permission. That's safer, and it is a real change to what can be configured.

### 4. The lead page treats a held draft the same way Today does

**What changes:**

- When the lead has a held draft, the top of the page shows, in this order: *"{First} said, over {channel}: …"* → the draft → *"Held because …"* → **Approve & send** (same `useUndoableSend` 10-second undo) · Edit in place · Don't send.
- Without a held draft: a composer titled **"Reply to {First}"**, with FollowUp's suggestion pre-filled and the line *"FollowUp wrote this from your conversation."* Remove "AI-suggested follow-up".
- The score sentence stays as the status line. The priority pill, stage and deal value move into Details.
- Rename "Consent & AI activity" to **"What FollowUp did here"**, and "Automation & follow-up plan" to **"Follow-ups for {First}"**.

**Why:**
- "Edit" on a Today card lands here, where the same message has a different name, no reason and no undo. The product's most trust-bearing action behaves two different ways.
- Reading before replying is the order the Today card already uses (`ApprovalQueue.tsx:133-155`).
- D-007 already excluded the "AI-suggested follow-up" heading (S-13).

Serves principles 1, 5, 6. Carries forward 2026-09-10 #8.

**Effort:** M.
**Risk:** low–medium. It touches the send path, but reuses the existing hook.
**Type:** presentation.

### 5. One word per concept

The table is in §6. String edits only.

**Effort:** S. **Risk:** low. It must move with the `trustCopy` and `emptyStates` tests, which pin exact wording. **Type:** copy.

### 6. One-person mode: hide team words from a team of one

**What changes:** when the business has one user, hide:
- the Mine and Unclaimed chips
- "My leads only" on Pipeline
- the "Assigned to" row
- "Leave unclaimed — first to grab it gets it"
- Team performance
- "Shared with the team" on saved lists

"Invite a teammate" stays under "Your business".

**Why:** the ICP is a solo owner. Every team word is one more concept that does nothing for them. Carries forward 2026-09-10 §6's "hide Team until teamSize > 1".

**Effort:** S–M.
**Risk:** low. First check how many of the 10 production businesses have more than one user.
**Type:** presentation.

### 7. Settings tabs named after the owner's questions

**What changes:**

- Tabs become **Sending · Lead sources · Your business · Billing**.
- "Lead sources" merges Connect and Channels, in the order an owner likely has them: Email → WhatsApp → Instagram & Facebook → Website form. Then a folded "Other ways in": CRM import, lead webhook, outbound webhook.
- "Your business" holds name and trade, team, and export or delete.
- Drop the duplicate feedback box; the sidebar already has one.
- Fix the two broken pointers in the source rules ("Automation above", "Workflows page").
- Keep every existing section id in `SECTION_TAB` so deep links still work.

**Why:** an owner can't predict whether Instagram lives under "Connect" or "Channels", or that their business name is under "Team" **[inference]**. Serves principle 4 and carries forward 2026-09-10 #6.

**Effort:** M.
**Risk:** low. The tab-hydration bug fixed on 2026-09-23 (`settings/page.tsx:78-127`) shows this file is fragile, so it needs rendering, not just type-checking.
**Type:** presentation.

### 8. Leads: four chips, and the same words as the lead page

**What changes:**

- Chips become **All · Waiting on you · Going quiet · Won or lost**. Hot, New, Follow-up today and Lost move into Custom filter.
- The row fact for `due_soon` on a holding account reads *"reply being written for your OK"*, matching the lead page.

**Effort:** S. **Risk:** low. **Type:** presentation. Carries forward 2026-09-10 §2.

### 9. The waiting decision reaches the owner outside the app (behaviour, Sahil)

**What changes:** when a draft has waited long enough to trigger the existing one-time reminder (`staleApprovals.ts`), also send **one** message to the owner's own email, linking straight to that card. At most one a day. Can be switched off. SMS only when carrier channels return. Never one message per hold.

**Why:**
- Today the app only works if the owner remembers to open it, which is the exact failure FollowUp exists to fix.
- It's also the biggest possible cut to "learning the app": an owner who taps from a message straight to the card never navigates at all.
- Carries forward 2026-09-13 rec 2 / Mode F.
- Principle 2 sets the cap: urgency stated once, precisely.

**Effort:** M.
**Risk:** notification fatigue (2026-09-13 Mode C), hence the hard cap.
**Type:** **behaviour.** A new message to the owner.

### 10. The first session ends on a real reply to send (behaviour, Sahil and backend)

**What changes:**

- At the end of the sources step, run one automation pass.
- Let it **hold drafts at any hour**, so the send window only gates *sending*. This is 2026-09-16 §5, still unfixed at `automation.ts:565-568`.
- Then land on Today with *"FollowUp wrote {N} replies while you were setting up. Here's the first one."* If there are none, show the test lead.

**Why:** time to first value. Today the payoff arrives at the next in-window cron tick, which is ~14 hours for an evening signup. Carries forward 2026-09-10 §3 and 2026-09-13 rec 1.

**Effort:** M–L.
**Risk:** a burst of drafts for old threads. Pair with the burst logic in `holdNotices.ts`, and consider only drafting for threads with recent inbound messages.
**Type:** **behaviour.**

### 11. A track record that invites "send the simple ones" (behaviour-adjacent, Sahil)

**What changes:** once enough drafts have been sent unchanged, Today shows once:

> *"You've sent 18 of FollowUp's last 20 replies without changing a word. Want it to send replies like these itself?"*

That opens the existing permission panel with its four facts. It can be dismissed and appears at most once a week. The figures in the quote are illustrative. The number already exists as "Drafts sent as written" (`analytics/page.tsx:104`).

**Why:** without this, an account that holds by default never gets past approving every draft (2026-09-13 Mode E). Rule 5: the kind of moat a platform selling seats won't build.

**Effort:** M.
**Risk:** reads as a nudge towards autonomy. Honest numbers only, never urgency.
**Type:** **behaviour-adjacent.** The trigger criterion is a product decision.

### 12. Follow-up plans: decide how they work, then show them (behaviour, Sahil)

**What changes:** on a holding account a plan currently holds step 1 and takes the lead off the plan (`sequences.ts`). Two options:

- **(a)** Resume the plan after the owner approves a held step. **Effort:** M.
- **(b)** Keep plans in Settings → Sending, labelled *"runs one step at a time until you let FollowUp send"*, until sending is on. **Effort:** S.

This question has been open since 2026-09-20.

**Type:** **behaviour.**

**Deliberately not proposed** (all dead per `rejected.md` or earlier exclusions):
- keyboard shortcuts, J/K navigation, a command palette (R-002)
- any channel fallback (R-003)
- replacing Today with one computed sentence, or stripping it to text (R-001 / D-020)
- sparkle icons or an AI persona (S-13)
- streaks, points or gamification (2026-09-13 §2.3)
- swipe-to-approve, or "approve all" beyond the existing routine pile (D-007's exclusions)

---

## 5. The simplest navigation

### Proposal: three items

```
Desktop sidebar:   Today · Leads · Settings            (+ bell, feedback, sign out)
Phone:             bottom tab bar  [ Today ] [ Leads ] [ Settings ]   bell top-right, no hamburger
```

| Question the owner asks | Where it's answered |
|---|---|
| What needs me? Is it working? What did it do? | **Today**: queue, going quiet, this week, "Everything FollowUp did →", "See all numbers →" |
| Where's that person? Where does a deal stand? | **Leads**: search, 4 chips, "List · By stage" |
| How do I hook up a source, or change what FollowUp does? | **Settings**: Sending · Lead sources · Your business · Billing |

### Where every current destination goes (nothing is deleted; every route keeps working)

| Today | Becomes | Route |
|---|---|---|
| Today `/dashboard` | Stays. Links to Activity and Analytics. | unchanged |
| Leads `/leads` | Stays. Gains "By stage". | unchanged |
| Pipeline `/pipeline` | "By stage" view of Leads | redirect to `/leads?view=stage`, or keep the route and link it |
| Follow-up plans `/workflows` | Settings → Sending → Follow-up plans | kept, linked |
| Analytics `/analytics` | "See all numbers" on Today (already linked) | kept, not in nav |
| Activity `/activity` | "Everything FollowUp did" on Today and per lead | kept, not in nav. Must include approved sends and held drafts or it stays empty. |
| Settings `/settings` | 4 tabs (#7) | unchanged; old `#section` anchors still map |

### Why three, and why not the four ("Today · Leads · Autopilot · Settings") proposed on 2026-09-10

- **Three covers every question the owner asks** (table above). History and numbers answer "is it working?", which is Today's question. Plans and rules are configuration. Pipeline is a different arrangement of Leads.
- **External support, graded:**
  - NN/g's hidden-navigation study (179 participants, run December 2015) found discoverability "cut almost in half" when main navigation is hidden. Visible navigation was used 1.5× as often as the hamburger on mobile, and hidden-navigation tasks were rated 15% harder (**Grade B**: NN/g's own article, specific figures, snippet only).
  - Apple's HIG advises three to five tabs and "the minimum number of tabs required" (**Grade B**: Apple's own page, snippet only).
  - NN/g's intranet study found a median of 7 top-level items for organisations with thousands of staff (2026-09-10 §9g). FollowUp's user is one person.
- **Why not "Autopilot":**
  - The name promises autonomy, and autonomy is off by default on every account.
  - Sahil's own framing (2026-09-22) is "follows up for you, *under your eye*".
  - Its contents are mostly inactive today (§0.3).
  - The 2026-09-10 file asked for a hallway test of the word, and none was run.
- **When to revisit:** add a fourth item ("Sent" or "History") once a meaningful share of businesses have granted sending. At that point "what did it send?" becomes a daily question. That follows `navigation.md` rule 6: never add a nav item just because a feature shipped.

---

## 6. One word per concept

| Concept | Words in use today | Use this everywhere |
|---|---|---|
| The daily queue | "Needs your OK", "Approvals", "your approvals", "approval queue" | **Needs your OK** (on Today) |
| Approving a draft | "Approve & send" (Today), "Send now" (lead page) | **Approve & send** when held; **Send** when the owner wrote it |
| The draft | "The draft reply", "AI-suggested follow-up", "routine draft" | **FollowUp's reply** / **Reply to {First}** |
| Per-lead mode | "I'll do it myself / Ask if risky / Handle it all", "Off / Assisted / Autonomous", "skip the check", "Automation" | **Leave {First} to me** · **FollowUp writes, you send** · then **Send the simple ones** · **Send everything** (only once allowed) |
| The account permission | "Let FollowUp send without asking", "send on my behalf" | **Let FollowUp send the simple ones** |
| Plans | "Follow-up plan", "workflow", "enroll", "enrolled", "Put on…", "Save workflow" | **follow-up plan** · **put on a plan** · **take off the plan** |
| New-lead rules | "Lead routing", "source rule", "No special handling" | **When a new lead arrives from…** |
| Unassigned lead | "Unclaimed", "Leave unclaimed — first to grab it gets it", "pool" | **Unassigned** (teams only) |
| Going cold | "At risk right now", "About to be lost", "going quiet", "Cold", "Silent N days" | **Going quiet** + **Silent N days** (A-006's words) |
| Lead quality | "82/100", "scored 72", "High priority", "Hot" | the **reason sentence**; **High / Medium / Low** only where a label is needed; no bare numbers on Today |
| History | "Activity", "Consent & AI activity", "AI activity log" | **What FollowUp did** |
| Automation in general | "Automation", "automation check" | **FollowUp** as the subject: "FollowUp checks every hour" |

Test for each row (brand principle 9): read it aloud to someone who runs a shop and has never used a CRM. If they ask "what does that mean?", the word is wrong.

---

## 7. Self-critique: the weakest parts of this proposal

1. **The navigation cut (#2) rests on reasoning, not usage.**
   - The only active user is the founder, and I haven't seen his route usage.
   - Apple's guidance also says too few tabs can feel disconnected; three is its floor.
   - Putting "Follow-up plans" inside Settings is awkward: something you *build*, filed under configuration.
   - Cutting the nav on its own is subtraction. R-001 and A-016 mean it only works if Today gets the designed treatment that makes up for it. This document specifies structure, not that design layer.
2. **Hiding inactive controls (#3) goes against reasoning already in the codebase.** `SourceRoutingSection.tsx` argues that a disabled option with a reason teaches more than a hidden one. My one-line "more choices open once…" is a compromise, and nobody has tested whether owners notice it.
3. **Recounting the tiles (#1(d)-alt) is the proposal most likely to backfire.** The sentence "your own replies are yours" exists to stop FollowUp claiming credit for the owner's work. Counting approved drafts is defensible, since FollowUp wrote them, but badly worded it reads as padded numbers. That's why the presentation-only swap is the recommended default.
4. **The Manoj hypotheses are guesses.** H2 (drafts for non-leads) is plausibly the most damaging and no UX change here fixes it. If the audit query shows he disconnected Gmail after reading drafts, this whole ranking should be re-read against draft and classifier quality before any layout work.
5. **The count of 12 controls and the "14 new concepts" are my own enumeration.** Someone else could reasonably group them differently. The direction stands; the exact numbers shouldn't be quoted as precise.
6. **The effort sizes are guesses.** The 2026-09-23 decision log shows almost every change in this area turning up a defect only when rendered. Assume M means M plus a rendering pass.
7. **One-person mode (#6) assumes most of the 10 businesses are solo.** One query would confirm or kill it.
8. **Nothing here has been shown to an owner.** A five-minute unmoderated test (one new owner, one phone, "tell me what this app will do for you") would check the one-minute bar better than this whole document.

---

## 8. Not answered here, and cheap checks to run first

- **Why Manoj left:** run the §3 query and ask the §3 question.
- **Route usage:** Vercel Web Analytics per route for `/pipeline`, `/workflows`, `/analytics`, `/activity` over 14 days. Expect it to be mostly the founder.
- **Solo share:** users per business across the 10.
- **Problems found in the design brain, reported but not fixed** (the brief was proposal-only):
  - `approved.md` A-006 cites `[[design-decisions#^D-023|D-023]]` and `design-brain/decisions/2026-09-15-app-layout-plan.md`. **Neither exists.**
  - `components/navigation.md` "Current state" still lists "Dashboard, … Workflows", which are old labels.
  - Both should be corrected so the brain stops describing things that aren't there.
- **If Sahil approves any of this:** record the approval in `approved.md` and date it in `design-decisions.md` in the same session (CLAUDE.md feedback rule). Structural items go to `frontend-3d-agent`. Copy items (#5, and 1(a), 1(c)) can be edited directly by the product lane.

---

## 9. Sources

**Internal, read first-hand at `ec179f5`:**

- *Brief and rules:* `CLAUDE.md`; `followup/PRODUCT_DIRECTION.md`
- *Design brain:* `README.md`, `brand/brand-principles.md`, `decisions/approved.md`, `decisions/rejected.md`, `decisions/design-decisions.md` (D-007; entries dated 2026-09-20 to 2026-09-24), `components/navigation.md`, `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`
- *Research:* `followup/research/product/2026-09-10-ux-simplification.md`, `…/2026-09-13-usability-and-engagement.md`, `…/2026-09-15-first-run-journey-audit.md`, `…/2026-09-16-first-run-dead-ends-and-time-to-value.md`; `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md`, `…/2026-09-15-owner-interview-guide.md`; `STATUS.md`
- *App pages:* `src/components/Sidebar.tsx`; `src/app/(app)/{layout,dashboard/page,leads/LeadsPageClient,leads/[id]/page,pipeline/PipelinePageClient,workflows/page,analytics/page,activity/page,settings/page}.tsx`
- *Components:* `src/components/{ApprovalQueue,MessageComposer,LeadAutomationToggle,AutomationStatusBadge,SourceRoutingSection,OnboardingForm,OnboardingSources,NotificationBell}.tsx`
- *Lib:* `src/lib/{setupStatus,rescue,rescued,activity,assignment,holdNotices,staleApprovals,queuePaging,industries,pricing}.ts`, `src/lib/automation.ts` (send-window and notification sections), `src/lib/sequences.ts` (hold branch); `src/app/api/integrations/gmail/callback/route.ts`; `prisma/schema.prisma` (`holdAllForApproval`, `autonomousAllowed`)

**External (WebSearch snippets only; WebFetch returned `EGRESS_BLOCKED` for nngroup.com on 2026-09-24):**

- [NN/g — Hamburger Menus and Hidden Navigation Hurt UX Metrics](https://www.nngroup.com/articles/hamburger-menus/). Checked 2026-09-24. 179 participants, run December 2015. Discoverability "cut almost in half", visible navigation used 1.5× as often on mobile, hidden-navigation tasks rated 15% harder. Also [the methodology page](https://www.nngroup.com/articles/hidden-navigation-methodology/). **Grade B.**
- [Apple Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars). Checked 2026-09-24. "In general, use three to five tabs"; "use the minimum number of tabs required". **Grade B.**
