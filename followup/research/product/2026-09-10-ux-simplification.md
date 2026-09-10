# UX simplification: making FollowUp learnable in five minutes, not five months

**Date:** 2026-09-10
**Brief (CEO, verbatim):** "help us design this app and how we can simplify the pages so that it
is understandable and simple to use by users — it should not take months to get familiar with
this app."
**Scope:** structure, information architecture, terminology, and first-run. **Not** a restyle —
the warm editorial palette in `src/app/globals.css` (cream `--paper`, amber `--rust`, the
slate/sage/gold/coral status family, Plus Jakarta Sans) stays exactly as it is. Every
recommendation below names a real file and a real change.
**Method:** read `PRODUCT_DIRECTION.md`, the three market/customer research files named in the
brief, then every authenticated page under `src/app/(app)/`, `src/app/onboarding/`, and the 39
components in `src/components/`. Counts below are from the code, not from memory.

## Sourcing caveat — read before citing anything in section 9

WebFetch is egress-blocked in this sandbox, as in every prior research pass on this repo. Every
external source in section 9 is **WebSearch-snippet-sourced, not fetch-verified**. Confidence is
graded inline in the house style of `research/market/2026-09-08-pentest-vendor-options.md`. The
design argument in sections 1-8 does **not** depend on any external statistic — it rests on the
code inventory, which is first-hand. Several onboarding/churn percentages that surfaced in search
are aggregator-blog numbers with no traceable primary study; they are reported as **Grade D** and
must not go anywhere near a landing page.

---

## 0. What exists today — the inventory, counted

### 0.1 Top-level navigation — 7 items

`src/components/Sidebar.tsx`, the `nav` array (lines 22-30):

| # | Label | Route | File |
|---|---|---|---|
| 1 | Today | `/dashboard` | `src/app/(app)/dashboard/page.tsx` (252 lines) |
| 2 | Leads | `/leads` | `src/app/(app)/leads/page.tsx` → `LeadsPageClient.tsx` |
| 3 | Pipeline | `/pipeline` | `src/app/(app)/pipeline/page.tsx` → `PipelinePageClient.tsx` |
| 4 | Workflows | `/workflows` | `src/app/(app)/workflows/page.tsx` (537 lines) |
| 5 | Analytics | `/analytics` | `src/app/(app)/analytics/page.tsx` |
| 6 | Activity | `/activity` | `src/app/(app)/activity/page.tsx` |
| 7 | Settings | `/settings` | `src/app/(app)/settings/page.tsx` (1,040 lines) |

Plus, in the same sidebar: a notification bell (`NotificationBell.tsx`), a sign-out button, and
**two conditional nag cards** ("Not subscribed", "Gmail not connected"). Lead detail
(`/leads/[id]`) is a child of Leads and has no nav entry of its own.

### 0.2 Settings — 12 sections, in one 1,040-line client component

The sticky jump-nav at `settings/page.tsx:435-457` enumerates them, and the comment above it
admits the problem in the code: *"12 sections is a lot to scroll blind through to find one
thing."*

1. **Integrations** — Gmail + Calendar (Connect / Sync now / Disconnect / Reconnect / Scan spam
   for missed leads / `FilteredEmails` review list), Outlook / Microsoft 365 (or a greyed
   "not set up yet (see docs/outlook-setup.md)" row when OAuth env isn't configured).
2. **Website widget** — `CopyEmbedSnippet`
3. **Lead webhook** — `CopyWebhookUrl`
4. **Outbound webhook** — `OutboundWebhookConfig`
5. **Phone (SMS + calls)** — `TwilioConfig`, **35.7 KB, the single largest component in the app**:
   Account SID, Auth Token, phone number, three copyable webhook URLs (voice / SMS / status),
   an auto-configure button that writes Twilio's own webhooks, a recent-calls probe, an A2P 10DLC
   registration notice, a WhatsApp sub-panel with its own number + Content SID + approved-template
   text, and the AI voice-agent toggle.
6. **Instagram** — and, confusingly, *also* `FacebookConfig` **and** `CrmConfig` (Follow Up Boss /
   HubSpot sync) live inside the section labelled "Instagram" (`settings/page.tsx:625-630`).
7. **Automation** — four independent toggles, three with a number input each:
   Auto follow-up on silence (+ N days), Instant reply to new leads, Reply for me when I haven't
   (+ N hours), Reactivate cold leads (+ N days), plus "Run automation check now."
8. **Lead routing** — `SourceRoutingSection`: one dropdown per source, four possible values
   (nothing / enroll in workflow / start on tier / leave in the shared pool).
9. **Team** — `TeamSection` (invites, members, roles)
10. **Billing** — Stripe checkout / portal / trial state
11. **Feedback** — a free-text box
12. **Your data** — `DataPrivacySection` (export everything, delete this business)

### 0.3 The lead page — 15 interactive controls on one screen

`src/app/(app)/leads/[id]/page.tsx` renders, in order: `ScoreBadge` (0-100), `PriorityPill`,
`StageSelector` (7 options), a deal-value figure, Email / Phone-or-channel / `CopyBookingLinkButton`,
"Why this score" + weighted factor list, the conversation, `MessageComposer` (Send now +
Regenerate + editable subject/body), then a right rail of `AutomationStatusBadge`, a Details card
(source, `LeadAssignmentSelect`, last contacted, next follow-up), Notes, `LeadTrustPanel`
(consent basis + opt-out state + a 25-row AI activity log), `LeadAutomationToggle`
(Off / Assisted / Autonomous, with a confirm dialog), `LeadWorkflowEnrollment`, and
`DeleteLeadButton`.

### 0.4 Stat tiles — 32 across four pages

Dashboard 13 (4 top + 4 "What FollowUp saved you this week" + 5 "This week's AI report"),
Leads 4, Pipeline 3, Analytics 12. Every one of them is a `StatCard` with an icon and a
`CountUp` animation.

### 0.5 Concepts a user must learn — 41

Counted as distinct things with their own vocabulary and their own rules, from the code:

*Lead objects:* lead · lead score (0-100) · score reason · score factors (weighted ±) ·
priority (high/medium/low/none/**not reviewed yet**) · pipeline stage (7) · stage weight ·
deal value · potential revenue · weighted pipeline value · source · assigned-to · "Up for grabs"
(unassigned) · claim.
*Rescue:* rescue score (0-100) · at-risk (≥50) · neglect × intent × recoverability ·
"About to be lost" · recovered / "came back" · trigger types (instant_ack, unanswered, silence,
sequence, manual).
*Automation:* automation tier (Off / Assisted / Autonomous) · automation **status** — a *second*,
different 7-value vocabulary (`workflow`, `workflow_paused`, `off`, `account_paused`, `due_soon`,
`waiting`, `sent`) · risk gate / held for approval · stops-on-reply · instant ack ·
auto-follow-up-on-silence window · unanswered-reply window · dead-lead reactivation window ·
working-hours deferral · workflow / sequence · sequence step (delay + EMAIL|CHANGE_STAGE +
message hint) · enrollment · source routing rule · pond (shared pool).
*Trust:* consent basis (10 derived labels) · opt-out (STOP/START) · audit trail / AI activity log ·
A2P 10DLC · TCPA.
*Views:* smart view / saved filter · custom filter criteria · quick filter (9 chips) ·
urgency rail colour.
*Other:* handoff / rapid engagement · missed-call text-back · voice agent · booking link ·
inbound webhook · outbound webhook · embed widget · CRM sync · spam scan · filtered emails.

**Forty-one concepts, seven nav items, twelve settings sections, thirty-two stat tiles, and a
1,040-line settings page.** That is the answer to "why does it take months."

### 0.6 The single biggest structural gap found

**There is no approval queue.** The product's core promise is approval-first: the risk gate holds
a draft and the owner approves it in one click (`src/lib/automation.ts:391-406`, `"ai.hold"`).
But the only place a held draft surfaces is:

- a `Notification` row — created by `notifyNeglect()` in `src/lib/automation.ts:459`, which
  **returns early when `lead.assignedToId` is null**, so a held draft on an unassigned/pond lead
  notifies nobody at all; and
- the lead's own page, where `MessageComposer` shows the same "AI-suggested follow-up" box for
  *every* lead whether or not anything was actually held for review.

So the owner cannot tell "FollowUp is waiting on me for this one" from "here's a draft you never
asked for," and there is no screen that answers "what needs my OK right now." The dashboard opens
on "About to be lost" instead — a ranked list of problems, not a queue of one-click resolutions.
Everything else in this document is second to fixing that.

---

## 1. Jobs to be done

The customer is a plumber between jobs, a clinic manager between patients, a tutor between
lessons. They open this app on a phone, standing up, for ninety seconds. In their words:

### Job 1 — "Did anyone I need to answer fall through the cracks?"
The literal wording of the mission (`PRODUCT_DIRECTION.md`: *"business owners are not able to
follow up"*). This is the *only* job the owner has that FollowUp uniquely does.
**Served by:** the rescue score, "About to be lost", the unanswered-reply trigger, the instant
ack, automation status, the urgency rail on list rows.

### Job 2 — "Is what it's sending on my behalf okay?"
The trust job. The ICP research (`research/customers/2026-09-05-icp-pain-and-trust-objections.md`)
found 77% of consumers want human approval before an agent acts, and 65.5% of business owners
fear AI making their business feel impersonal. Approval-first exists *because* of this.
**Served by:** the risk gate, the automation tier, `MessageComposer`, `LeadTrustPanel`'s AI
activity log, the Activity page. **Blocked by:** the missing approval queue (§0.6).

### Job 3 — "Is this thing earning its $29?"
The pricing research says willingness-to-pay is unproven *precisely because* the owner can't see
the return. **Served by:** "What FollowUp saved you this week" (answered for you / came back /
booked / in play). This is the retention feature and it currently sits **fifth** on the dashboard,
below three other sections.

### Job 4 — "Where does this deal stand?" (weaker, and not FollowUp's job)
Real, but it is the job every CRM already does, and `PRODUCT_DIRECTION.md` Rule 4 says don't
compete there. **Served by:** pipeline stages, deal value, analytics, the board view.

### Which inventoried concepts actually serve a job

| Serves a job | Exists for edge cases | Exists for the builder's convenience |
|---|---|---|
| Lead, score + reason, priority, rescue score, "About to be lost", instant ack, unanswered-reply, held-for-approval, consent basis, opt-out, "what we saved you", deal value | Ponds/shared pool, source routing rules, smart views, dead-lead reactivation window, outbound webhook, CRM sync, spam scan, filtered emails, team roles, A2P/WhatsApp template config | The **two parallel automation vocabularies** (tier vs. status); stage weights & weighted pipeline value; 12 of the 32 stat tiles (median reply time, reply-rate-automated vs. manual, workflows completed 30d, "Analyzed", "Conversations analyzed"); the Workflows *builder* (steps × delays × actions × message hints) as a top-level destination; `CleanupLeadsButton`; "Run automation check now" |

The builder's-convenience column is not waste — most of it is real capability. It is *placed*
wrong: it is on the same visual plane as the four things that matter.

---

## 2. Information architecture — 7 top-level items down to 4

### Proposed navigation

```
Today   ·   Leads   ·   Autopilot   ·   Settings
```

Four items. Each answers a question the owner actually asks:
**Today** = "what needs me right now?" · **Leads** = "find a person" ·
**Autopilot** = "what is it doing for me, and did it do it?" · **Settings** = "hook it up."

On "Autopilot": it names the mental model an owner already owns from a car or a plane — *it flies,
you're still in command, and it hands back the controls when it matters.* If that reads as too
much autonomy for the approval-first guarantee, the fallback name is **"Auto follow-up"**; do not
use "Automation," which is what every CRM calls the thing the owner never sets up.

### Mapping every existing surface

| Today's surface | Verdict | Justification |
|---|---|---|
| `/dashboard` ("Today") | **Keep, restructure** | Right idea, wrong contents — see §3 and §7. Add the missing "Needs your OK" queue at the top; demote the 13 stat tiles to 3. |
| `/leads` list | **Keep as-is (mostly)** | The one screen that does exactly one thing well. Cut the 4 stat tiles and 9 quick-filter chips to 4 chips (see below). |
| `/leads/[id]` | **Keep, restructure** | Most-used screen; see §4. |
| `/pipeline` | **Merge into Leads** as a `List \| Board` toggle | Identical data, different projection. It costs a permanent nav slot for a drag-and-drop that HTML5 DnD can't even do on the phone this owner actually uses — `PipelinePageClient.tsx:238` already ships a `<select>` fallback admitting this. Preserve every behaviour; move the entry point. |
| `/workflows` | **Demote into Autopilot → "Advanced" tab** | A 537-line multi-step sequence builder is a power-user surface. The recommended-cadence template (day 3/7/14/30) is genuinely good and should stay one click from Autopilot, but "build a sequence from a blank sheet" must not be the fourth thing a plumber sees. |
| `/activity` | **Merge into Autopilot → "What it did" tab** | This *is* the proof half of the automation story ("Proof, not a promise" — its own subtitle). It belongs next to the switches it's proving, not in a separate nav slot. Also surface its 3 most recent rows on Today. |
| `/analytics` | **Demote to Today → "See all numbers"** | 12 tiles + charts + team performance. The two numbers that sell the product (leads FollowUp answered for you, leads that came back) already live on the dashboard. Median reply time and reply-rate-automated-vs-manual are *our* metrics, not the owner's. Keep the page, drop the nav slot. |
| Settings §1 Integrations | **Merge into Settings → Connect** | See §6. |
| Settings §2 Website widget | **Merge into Settings → Connect** (as a channel card) | It is a capture channel, not a separate concept. |
| Settings §3 Lead webhook | **Demote to Settings → Advanced** | Nobody who says "a plumber" pastes a webhook URL. |
| Settings §4 Outbound webhook | **Demote to Settings → Advanced** | Same. |
| Settings §5 Phone (TwilioConfig) | **Merge into Settings → Connect**, behind a status card | See §6 — this is the highest-value single change in the document after the approval queue. |
| Settings §6 Instagram (+ Facebook + CRM) | **Split**: Instagram and Facebook become channel cards under Connect; `CrmConfig` moves to **Advanced** | A CRM sync living inside a section titled "Instagram" is a filing accident, not an IA. |
| Settings §7 Automation | **Move to Autopilot → "Rules"** | Automation controls do not belong in Settings at all; see §5. |
| Settings §8 Lead routing | **Demote to Autopilot → Advanced** | Per-source rules presume you already know what your sources do differently. Nobody knows that in week one. |
| Settings §9 Team | **Keep as-is, under Settings → Team** | Already coherent. Hide the whole tab until `teamSize > 1` (it's already collected in onboarding). |
| Settings §10 Billing | **Keep as-is, under Settings → Billing** | Already coherent. |
| Settings §11 Feedback | **Demote to a persistent link in the sidebar footer** | It doesn't need a settings section; it needs to be reachable from anywhere. |
| Settings §12 Your data | **Demote to Settings → Advanced** | Export + delete-business. Important, rarely used, and its own confirm flow already protects it. |
| Sidebar "Not subscribed" / "Gmail not connected" cards | **Merge into one setup strip on Today** | Two persistent nag cards in a 4-item sidebar is proportionally enormous. One dismissible strip at the top of Today, showing only the *next* unfinished step. |
| `NotificationBell` | **Keep, and fix its input** | It's the only real-time signal in the app. It should count held drafts, not just rapid-engagement events (§0.6). |
| `CleanupLeadsButton` (Leads header) | **Hide until needed** | A destructive bulk operation sitting third from the left in the Leads header. Move it into an overflow "…" menu. |

### Second-order cuts inside the pages that stay

- **Leads quick filters: 9 chips → 4.** Keep `All`, `Needs a reply`, `Hot`, `Won`. Fold
  `Mine` / `Unclaimed` behind a "Just mine" toggle (they only mean anything on a team), and
  `New` / `Follow-up today` / `Cold` / `Lost` into the Custom filter builder that already exists
  (`SmartViewForm.tsx`). Smart Views stay — they're the earned reward for the second month.
- **Dashboard tiles: 13 → 3.** Keep *At risk right now*, *Answered for you*, *Came back*. Everything
  else moves behind "See all numbers."
- **Leads tiles: 4 → 0.** Total/Hot/Going cold/Won duplicate the filter chips immediately below them.

---

## 3. The first five minutes

### What onboarding does today

`src/app/onboarding/page.tsx` + `OnboardingForm.tsx` — and it is already good, which should be
said plainly before criticising it:

1. **Step 1:** business name, industry (7 options), team size. One POST to `/api/onboarding`.
2. **Step 2:** Connect Gmail, with honest copy — *"This is the whole point... Without it, the
   dashboard stays empty"* — plus an "I'll do this later" escape hatch.
3. On return from Google, `OnboardingForm.tsx:71-91` **auto-fires a Gmail sync** and reports
   *"Found N leads already, M scored."* Then "Continue to dashboard."

Two steps, a two-dot progress indicator, resume-safe across the OAuth round trip. The auto-sync is
the best thing in the flow.

### What's wrong with it

The flow ends one beat before the payoff. "Found 12 leads already" is *inventory*, not *value*.
The owner arrives at a dashboard with 13 stat tiles and a ranked list of problems, and the product
has not yet done a single thing *for* them. FollowUp's actual promise — an instant, correct,
in-their-language reply going out without the owner lifting a finger — is never demonstrated.

### Proposed: three steps to first value

**Step 1 — Who are you?** (unchanged) Business name + industry. **Drop the team-size field** from
step 1; ask it only when someone opens Team. That's one fewer field on the first screen
(Baymard's finding is about checkouts, but the mechanism — field count, not step count, drives
abandonment — transfers; see §9).

**Step 2 — Connect your inbox.** (unchanged, including the auto-sync and the escape hatch.)

**Step 3 — The proof screen. New.** Instead of "Continue to dashboard," show the value that just
happened, with the actual text:

> **Meet Priya Raman — she wrote 2 days ago and never got an answer.**
> FollowUp already replied for you, in English, 40 seconds after we found her:
> *"Thanks for reaching out to Riverside Plumbing — I've got your message and I'll come back to
> you shortly."*
> **6 more leads are waiting. 2 of them need your OK before we reply.**
> `[ Show me the 2 →]`  ·  `I'll look later`

That button lands on **Today → Needs your OK**, not a dashboard. The owner's first action in the
product is approving a real reply to a real customer. That is the activation event
(Lenny's Newsletter's framing of the activation milestone; see §9).

**When there is genuinely nothing to show** (empty inbox, or "I'll do this later"), step 3 becomes
a single honest sentence and one action:
> *"Nothing in your inbox looks like a sales conversation yet — that's normal. The moment one
> arrives, FollowUp answers it within a minute and shows it to you here."*
> `[ Send a test lead to myself ]` · `[ Go to my dashboard ]`

"Send a test lead to myself" — a one-click seeded lead that runs the real instant-ack path against
the owner's own address — is worth building: it is the only way to demonstrate the core promise to
a business with a quiet week, and it costs one API route reusing existing machinery.

### The empty dashboard, before any lead exists

Today's empty state is an `EmptyState` inside "Today's follow-ups" — icon, "No leads yet",
"Connect Gmail in Settings", one button — sitting *underneath* four zeroed stat tiles and *above*
an empty pipeline chart and a zeroed AI report. Four zeros are a worse first impression than one
honest sentence. Proposed contents, in order (wireframe in §7):

1. **A one-line promise in the present tense:** "FollowUp is watching your inbox. The moment a
   lead writes, it replies within a minute and shows you here."
2. **A live "waiting" indicator**, not a zero: "Watching `manoj@riversideplumbing.com` — last
   checked 2 minutes ago."
3. **A setup strip** with only the *next* incomplete step (connect a phone number / add the
   website widget / start your trial), one at a time, never all four.
4. **`[ Send a test lead to myself ]`** — the way to see it work today.
5. **No stat tiles at all.** Render the tile row only once `leads.length > 0`.

---

## 4. The lead page

This is the screen the owner opens twenty times a day. Today it presents fifteen controls with
almost no hierarchy: `ScoreBadge` and `PriorityPill` and `StageSelector` and deal value all appear
above the fold, and the *reply* — the reason the page exists — sits below the conversation, below
"Why this score."

### The principle: one lead is in one state, and each state has exactly one next action

| Lead state (derivable today) | The ONE primary action | Everything else |
|---|---|---|
| A draft was held by the risk gate | **Approve & send** (with Edit / Don't send beside it) | collapsed |
| They wrote, nobody answered, nothing drafted yet | **Reply** (composer pre-filled, focused) | collapsed |
| FollowUp already replied, waiting on them | **Nothing — say so.** Secondary: "Send another anyway" | collapsed |
| Gone quiet, due for a nudge | **Send the check-in** (draft shown) | collapsed |
| Hot / rapid back-and-forth | **Call them** (`tel:` link, primary) | collapsed |
| Won / Lost | **Reopen** | collapsed |

`src/lib/automationStatus.ts` already computes six of these six states — the mapping is a pure
presentation change over data that exists.

### Proposed layout

**Above the fold (in this order):**
1. Name, company, and *one* status line in plain English, replacing the score badge + priority
   pill + stage dropdown cluster: **"Priya wrote 2 days ago and is still waiting."** (The rescue
   `reason` string in `src/lib/rescue.ts` already produces exactly this sentence — it is currently
   shown only on the dashboard's at-risk list, not on the lead page.)
2. **The one primary action**, full-width, per the table above.
3. The last 3 messages of the conversation, newest last, with a "Show all N" expander.

**Collapsed by default (a single row of quiet disclosure triggers):**
- `Why we think this is worth 82` → the score, its reason, and the weighted factors
- `Details` → source, assigned to, last contacted, next follow-up, deal value, notes
- `What FollowUp has done here` → `LeadTrustPanel`'s AI activity log + consent basis + opt-out
- `Settings for this lead` → `LeadAutomationToggle`, `LeadWorkflowEnrollment`, stage, booking link, delete

**Moved off the page entirely:** nothing. Every control stays reachable; four of them stop being
shouted.

### Terminology table

Applies to `LeadAutomationToggle.tsx`, `AutomationStatusBadge.tsx`, `LeadTrustPanel.tsx`,
`ScoreBadge.tsx`, `PriorityPill.tsx`, the dashboard headings, and the Settings automation copy.
Almost all of these are string edits.

| Current term | Proposed plain-language term | One-line tooltip |
|---|---|---|
| Rescue score (`0-100`, coral pill) | **"About to be lost"** — drop the number, keep the sort order | "Ranked by how long they've waited, how interested they seem, and how cold the trail has gone." |
| Follow-up score / `ScoreBadge` 0-100 | **"Worth chasing: high / medium / low"** | "How likely this person is to buy, based on what they've actually written to you." |
| Automation tier: **Off** | **"I'll handle this one myself"** | "FollowUp won't message this person at all. Nothing sends without you writing it." |
| Automation tier: **Assisted** | **"Ask me first if it's risky"** *(default)* | "FollowUp replies for you on the easy stuff, and asks your OK before anything about price, terms, or a tense conversation." |
| Automation tier: **Autonomous** | **"Handle it all, don't ask"** | "Every reply sends automatically with no review — including price and tense conversations. Only for leads you're comfortable letting go." |
| Automation status: `due_soon` | **"Following up soon"** *(already good — keep)* | "Nothing's been missed; the next check will pick this up." |
| Automation status: `account_paused` | **"Paused — your auto follow-up is switched off"** | "This would be followed up now, but auto follow-up is off for your whole account." |
| Automation status: `sent` / "Waiting on their reply" | *(already good — keep)* | — |
| Consent basis | **"Why it's okay to message them"** | "How this person reached you — which is what makes replying legal and expected." |
| Audit trail / AI activity log | **"What FollowUp did here"** | "Every message FollowUp sent or held for your approval on this lead." |
| Workflow / Sequence *(used interchangeably in the UI today)* | **"Follow-up plan"** — pick one word and use it everywhere | "A set schedule of check-ins. It stops the moment they reply." |
| Enroll in a workflow | **"Put on a plan"** | — |
| Pond / shared pool / "Up for grabs" | **"Unassigned"** | "Nobody on your team has picked this one up yet." |
| Smart view / saved filter | **"Saved list"** | "A search you use often, saved to one click." |
| Silence window / trigger days | **"Wait this long before nudging"** | — |
| Instant ack | **"Instant 'we got it' reply"** *(the settings copy already calls it this — make the code and docs match)* | "A fixed one-liner FollowUp sends within a minute so nobody's left hanging. It never answers a question or quotes a price." |
| Handoff / rapid engagement | **"They're replying right now — jump in"** | — |
| Priority: `none` + not reviewed | **"Not looked at yet"** *(already fixed in `PriorityPill.tsx` — good, keep)* | — |
| "Run automation check now" | **"Check for anyone waiting, right now"** | — |
| Weighted pipeline value | *(delete from the UI)* | — |

---

## 5. Automation controls — one switch and one sentence

### What the owner must grasp today

Six independent things, spread across three pages: a business-wide master switch + 3 more
business-wide toggles + 3 number inputs (`settings/page.tsx` §7), a per-lead 3-way tier
(`LeadAutomationToggle`), a 7-value status vocabulary (`AutomationStatusBadge`), a workflow
builder (`/workflows`), per-lead enrollment (`LeadWorkflowEnrollment`), and per-source routing
rules (`SourceRoutingSection`). The safety guarantee is stated four separate times in four
different wordings, each starting "**Our promise:**".

### The proposed mental model

> **FollowUp answers people for you. It asks first when the answer is risky.**

One sentence. Everything else is a detail *of* that sentence, and the UI should be shaped like it.

**Autopilot → Rules** becomes a single page with **one master switch** and **one plain-English
paragraph that renders from the current settings** — not four cards with four toggles:

```
Autopilot is ON.
Here's exactly what FollowUp does for you:

  · Someone new writes  →  it says "got your message" within a minute, in their language.
  · You haven't answered in 24 hours  →  it writes the reply and sends it,
    unless it's about price, terms, or a tense thread — then it asks you first.
  · They go quiet for 5 days  →  it sends one friendly nudge.
  · Still nothing after 45 days  →  it tries once more with a real reason to reply.

  It stops the instant they reply. It never contradicts something you've said.
  It never quotes a price without your OK.

  [ Change the timings ]     [ Turn Autopilot off ]
```

The four toggles and three number inputs still exist — they live behind **"Change the timings,"**
which expands the four cards that are on the Settings page today, unchanged. The 90% case reads a
paragraph; the 10% case clicks once.

**The per-lead control keeps its three states** (the architecture in `PRODUCT_DIRECTION.md` Rule 5
depends on it) but is renamed to the three sentences in §4's table and is **collapsed by default**
inside "Settings for this lead." A default of Assisted plus a clear account-wide paragraph means
the per-lead control is an exception mechanism, and exception mechanisms should not be above the
fold on every lead.

**The safety guarantee gets said once, prominently, in one wording** — on Autopilot, in the
paragraph above — instead of four times in four wordings. Repeating a promise four ways reads as
nervousness, not reassurance.

**Where the advanced options live:**
- *Autopilot → Advanced:* per-source routing rules (`SourceRoutingSection`), follow-up plans /
  the workflow builder (`workflows/page.tsx`), and the "Check for anyone waiting, right now"
  button.
- *Autopilot → What it did:* today's `/activity` feed, unchanged.

---

## 6. Settings — 12 sections to 4 tabs

### Proposed

```
Settings   [ Connect ]  [ Team ]  [ Billing ]  [ Advanced ]
```

**Connect** — one card per channel, status first, config behind the card. Never a form up front.

| Channel | Card states |
|---|---|
| Email (Gmail) | **Connected** — "manoj@… · new email picked up within seconds · 41 leads found" + Sync now / Disconnect · **Not connected** — "This is where most of your leads already are." `[Connect Gmail]` |
| Phone & text | **Connected** — "+1 860 935 8202 · answering calls and texts" · **Not connected** — "Catch calls and texts you miss. **What's needed:** a Twilio account (~$1/month) and 10 minutes." `[Set up]` · **Half-set-up** — "Number saved, but Twilio isn't pointed at FollowUp yet." `[Finish]` |
| WhatsApp | Card, nested under Phone once Phone is connected — never before |
| Website form | **Live** — "Receiving leads from riversideplumbing.com" · **Not added** — "Paste one line into your site." `[Get the code]` |
| Instagram | Connected as @handle / `[Connect]` |
| Facebook | Connected as Page / `[Connect]` |
| Outlook | Only rendered when `outlookOauthAvailable` — today a greyed row saying *"not set up yet (see docs/outlook-setup.md)"* is shown to every user, which reads as a broken feature and points a plumber at a markdown file in a repo. Hide it entirely instead. |

Each card carries exactly three things: **connected / not connected / what's needed**. All of
`TwilioConfig`'s 35 KB — Account SID, Auth Token, three webhook URLs, A2P 10DLC, WhatsApp Content
SIDs — lives *inside* the Phone card, revealed on `[Set up]`, and the A2P/TCPA notice appears at
the moment the owner connects SMS, which is also the flag raised in the ICP research
(`2026-09-05-icp-pain-and-trust-objections.md`, "Flag for CEO", item 2).

**Team** — `TeamSection`, unchanged. Tab hidden entirely until `teamSize > 1` or a first invite.

**Billing** — unchanged.

**Advanced** — lead webhook, outbound webhook, CRM sync (`CrmConfig`), spam scan + filtered
emails, export your data, delete this business. One flat list, each with a one-line "what this is
for."

**Removed from Settings:** the whole Automation section (→ Autopilot), lead routing (→ Autopilot →
Advanced), Feedback (→ sidebar footer link).

---

## 7. Wireframes (structural only — palette and type unchanged)

### 7.1 Dashboard — empty (no leads yet)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Good afternoon, Manoj                                               │
│                                                                      │
│  FollowUp is watching your inbox. The moment a lead writes,          │
│  it replies within a minute — and shows you right here.              │
│                                                                      │
│  ● Watching manoj@riversideplumbing.com — last checked 2 min ago     │
└──────────────────────────────────────────────────────────────────────┘

┌── One more thing (1 of 3) ───────────────────────────────────────────┐
│  Catch the calls you miss too                        [ Set up → ]    │
│  Needs a Twilio number, about 10 minutes.              [ Not now ]   │
└──────────────────────────────────────────────────────────────────────┘

              ┌──────────────────────────────────┐
              │   Want to see it work right now?  │
              │   [ Send a test lead to myself ]  │
              └──────────────────────────────────┘

  (no stat tiles, no empty chart, no zeroed report)
```

### 7.2 Dashboard — populated

```
┌──────────────────────────────────────────────────────────────────────┐
│  Good afternoon, Manoj                            2 need your OK  ●  │
└──────────────────────────────────────────────────────────────────────┘

╔══ NEEDS YOUR OK (2) ═════════════════════════════════════════════════╗
║  Priya Raman · she asked what a full re-pipe costs                   ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │ "Hi Priya — a full re-pipe on a 3-bed usually runs $4-6k        │  ║
║  │  depending on access. Happy to come look Thursday?"             │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║  Held because it mentions a price.                                   ║
║  [ Approve & send ]   [ Edit ]   [ Don't send ]                      ║
║  ─────────────────────────────────────────────────────────────────   ║
║  Dan Whitmore · he sounded annoyed about the delay        [ Open → ] ║
╚══════════════════════════════════════════════════════════════════════╝

┌── ABOUT TO BE LOST (5) ──────────────────────────────────────────────┐
│  Sam Iqbal      wrote 2 days ago, still waiting            $3,200  › │
│  Lena Ortiz     no reply for 9 days since your last message  $900  › │
│  … 3 more                                             [ See all → ]  │
└──────────────────────────────────────────────────────────────────────┘

┌── WHAT FOLLOWUP DID FOR YOU THIS WEEK ───────────────────────────────┐
│    12                  3                   1                         │
│    answered for you    came back           booked                    │
│                                                                      │
│  Only replies to messages FollowUp sent on its own count here.       │
│  [ Rahul Menon replied 6h after we nudged him — $2,400 ]         ›   │
│                                              [ See all numbers → ]   │
└──────────────────────────────────────────────────────────────────────┘

┌── UPCOMING CALLS (2) ────────────────────────────────────────────────┐
│  Priya Raman   Thu 2:00 PM      ·   Dan Whitmore   Fri 9:30 AM       │
└──────────────────────────────────────────────────────────────────────┘
```

Three tiles, not thirteen. The pipeline snapshot chart, "Today's follow-ups", and the 5-tile
"This week's AI report" move behind **See all numbers**.

### 7.3 Lead page

```
‹ Back to leads

┌──────────────────────────────────────────────────────────────────────┐
│  Priya Raman                                          Riverside, CT  │
│  She wrote 2 days ago and is still waiting.                          │
└──────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════╗
║  FollowUp wrote this and is waiting for your OK                      ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │ Subject: Re: full re-pipe quote                                │  ║
║  │                                                                │  ║
║  │ Hi Priya — a full re-pipe on a 3-bed usually runs $4-6k …      │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║  Held because it mentions a price. Nothing sends until you say so.   ║
║                                                                      ║
║  [   Approve & send   ]    [ Edit ]   [ Rewrite it ]  [ Don't send ] ║
╚══════════════════════════════════════════════════════════════════════╝

┌── CONVERSATION ──────────────────────────────────────────────────────┐
│  Priya · email · 2 days ago                                          │
│  "Hi — what would a full re-pipe cost for a 3-bedroom?"              │
│                                                                      │
│                          You · email · 4 days ago  ─────────────────►│
│                          "Thanks for reaching out to Riverside…"     │
│                                          [ Show all 6 messages ]     │
└──────────────────────────────────────────────────────────────────────┘

  › Why we think this is worth chasing            (score 82, factors)
  › Details                        (source, owner, value, notes, dates)
  › What FollowUp did here          (consent basis, opt-out, AI log)
  › Settings for this lead    (who replies, plan, stage, link, delete)

  [ 📞 Call Priya ]   [ ✉ Email ]   [ 🔗 Send booking link ]
```

### 7.4 Settings → Connect

```
Settings      [ Connect ]   Team   Billing   Advanced

┌──────────────────────────────────────────────────────────────────────┐
│  ✉  Email                                            ● Connected     │
│     manoj@riversideplumbing.com — new mail picked up within seconds  │
│     41 leads found so far                                            │
│                                    [ Sync now ]   [ Disconnect ]     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  📞 Phone & text                                     ○ Not connected │
│     Catch the calls and texts you miss — FollowUp answers them.      │
│     What's needed: a Twilio account (~$1/month) and about 10 min.    │
│                                                       [ Set up → ]   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  🌐 Website form                                     ◐ Half done     │
│     Code generated but no leads received yet.                        │
│     What's needed: paste one line into your site.                    │
│                                              [ Show me the code → ]  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  📷 Instagram                                        ○ Not connected │
│     Answer DMs to your business page.          [ Connect Instagram ] │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  👤 Facebook Messenger                               ○ Not connected │
│                                                 [ Connect Facebook ] │
└──────────────────────────────────────────────────────────────────────┘

  (WhatsApp appears nested under Phone once Phone is connected.
   Outlook appears only when its OAuth app is actually configured.)
```

---

## 8. Implementation plan — ordered by user impact ÷ effort

Sizes: **S** ≈ under a day · **M** ≈ 1-3 days · **L** ≈ a week+.
"Copy" = strings and labels only, no logic. "Structural" = components move or are created.

| # | Change | Files | Size | Type |
|---|---|---|---|---|
| **1** | **Ship the approval queue.** A `Needs your OK` section pinned to the top of the dashboard, listing leads whose most recent `AuditEvent` is `ai.hold`, each with the held draft inline and `Approve & send` / `Edit` / `Don't send`. Also fix `notifyNeglect()` so an *unassigned* lead's held draft still notifies the business owner instead of silently notifying nobody. | new `src/lib/pendingApprovals.ts` (query `AuditEvent` where `action='ai.hold'`, newest per lead) · `src/app/(app)/dashboard/page.tsx` · new `src/components/ApprovalQueue.tsx` (reuse `MessageComposer`'s send path, `/api/leads/[id]/send`) · `src/lib/automation.ts:459` `notifyNeglect` early-return · `src/components/NotificationBell.tsx` badge count | **M** | Structural |
| **2** | **Terminology pass.** Apply the whole §4 table. No logic, no data, no migrations — every one of these is a string literal. Highest ratio in the document. | `LeadAutomationToggle.tsx` (`TIERS`, `DESCRIPTIONS`) · `AutomationStatusBadge.tsx` (`REASON_LABEL`, `describe()`) · `LeadTrustPanel.tsx` (headings) · `ScoreBadge.tsx` (`title`) · `dashboard/page.tsx` (section headings) · `settings/page.tsx` automation copy · `workflows/page.tsx` (pick "follow-up plan", drop "sequence") · `LeadsPageClient.tsx` ("Up for grabs" → "Unassigned") | **S** | **Copy** |
| **3** | **Cut the dashboard from 13 tiles to 3 and reorder the sections.** Order becomes: Needs your OK → About to be lost → What FollowUp did for you → Upcoming calls. Move "Today's follow-ups", `PipelineSnapshot`, and the 5-tile weekly AI report behind a `See all numbers` link to `/analytics`. Render no tile row at all when `leads.length === 0`. | `src/app/(app)/dashboard/page.tsx` only | **S** | Structural (single file) |
| **4** | **Rebuild the empty dashboard** per §7.1: promise sentence, live "watching <inbox>" line, one-at-a-time setup strip, `Send a test lead to myself`. Requires one new API route that creates a seeded lead from the owner's own address and lets the real instant-ack path run. | `dashboard/page.tsx` · new `src/components/SetupStrip.tsx` · new `src/app/api/leads/test-lead/route.ts` (reuses `src/lib/acknowledge.ts`) · delete the two sidebar nag cards in `Sidebar.tsx` | **M** | Structural |
| **5** | **Collapse the nav from 7 to 4** and create the two container pages. `/pipeline` becomes a `List \| Board` toggle inside `/leads`; `/workflows` and `/activity` become tabs under a new `/autopilot`; `/analytics` keeps its route but loses its nav slot. Keep every old route working as a redirect so bookmarks and in-app links (there are several to `/settings`) don't break. | `src/components/Sidebar.tsx` (`nav` array) · new `src/app/(app)/autopilot/page.tsx` with tabs rendering the existing `workflows` and `activity` bodies · `src/app/(app)/leads/LeadsPageClient.tsx` (mount `PipelinePageClient` behind a toggle) · redirects in `next.config.ts` | **M** | Structural |
| **6** | **Settings → 4 tabs with channel status cards.** Split the 1,040-line page into `Connect / Team / Billing / Advanced`; generalise the existing `IntegrationRow` into a three-state `ChannelCard` (connected / not connected / what's needed) and put `TwilioConfig`, `InstagramConfig`, `FacebookConfig`, `CopyEmbedSnippet` *inside* cards rather than inline. Move `CrmConfig` out of the "Instagram" section. Hide Outlook when `!outlookOauthAvailable` instead of showing a greyed docs reference. | `src/app/(app)/settings/page.tsx` (split into `settings/connect/`, `settings/advanced/`, …) · new `src/components/ChannelCard.tsx` · `TwilioConfig.tsx` (wrap, don't rewrite) · `InstagramConfig.tsx` · `FacebookConfig.tsx` · `CrmConfig.tsx` | **L** | Structural |
| **7** | **Autopilot "here's what we do for you" paragraph.** One master switch plus a sentence-per-rule paragraph generated from the existing `/api/automation/settings` payload; the four existing toggle cards move behind `Change the timings`. Say the safety guarantee once, not four times. | new `src/components/AutopilotSummary.tsx` · move the automation `<section>` out of `settings/page.tsx:633-848` into `autopilot/page.tsx` · `SourceRoutingSection.tsx` moves to the Advanced tab | **M** | Structural + copy |
| **8** | **Lead page: one primary action, four collapsed sections.** Drive the primary action off `computeAutomationStatus()` + `assessRescue()`, which already exist; surface `rescue.reason` as the page's status line; collapse score/details/trust/settings behind disclosure triggers. | `src/app/(app)/leads/[id]/page.tsx` · new `src/components/LeadPrimaryAction.tsx` · `MessageComposer.tsx` (accept a `held` variant) · `src/lib/rescue.ts` (no change — already returns `reason`) | **M** | Structural |

**Do #1, #2 and #3 first.** Together they are roughly three days of work, one of which is pure
string editing, and they change the product from "a dashboard of problems" to "a queue of
one-click decisions in plain English" — which is the actual answer to the founder's brief.

**Explicitly not recommended:** deleting any capability. Ponds, smart views, source routing,
outbound webhooks, the workflow builder, and the 12 analytics tiles all stay — they are placed
differently, not removed. `PRODUCT_DIRECTION.md` Rule 5 (design for rising autonomy) and Rule 2
(own the data) both argue against amputating machinery to simplify a surface.

---

## 9. Evidence, with confidence grades

Every source below is WebSearch-snippet-sourced; none was fetched. Graded in the style of
`research/market/2026-09-08-pentest-vendor-options.md`.

**a. Progressive disclosure is the named remedy for exactly this problem, and it is Nielsen's
own.** Jakob Nielsen introduced progressive disclosure in 1995 specifically to reduce errors in
complex programs: defer secondary options to a subsidiary screen so the primary options are the
only ones shown by default. This is the direct justification for §4's collapsed sections and §6's
"status card, config behind it." **[Grade B — the definition and attribution are consistent across
NN/g's own video page, Wikipedia, and IxDF's glossary; the underlying 1995 source was not fetched.]**

**b. Users don't understand feature names, and plain language should lead.** NN/g's writing
guidance: avoid jargon, business-speak and feature-driven language; users want to know what the
thing does for them, not its branded name; write at a 6th-8th grade level for general audiences;
and where the audience is mixed, lead with plain language and put the jargon in parentheses. That
is precisely the shape of §4's terminology table (plain term first, mechanism in the tooltip).
**[Grade B — two separate NN/g article titles surfaced with consistent guidance
("Technical Jargon", "User-centric vs. Maker-centric Language"); snippets, not full articles.]**

**c. Empty states are the only UI 100% of new users see, and they should teach.** NN/g frames
empty states as teachable moments balancing three forces — system status, learning cues, and a
direct path to the task. §7.1's empty dashboard does all three deliberately: "watching your inbox"
is status, the promise sentence is the learning cue, "Send a test lead to myself" is the path.
**[Grade C — NN/g's "Empty States in Application Design: 3 Guidelines" is a real NN/g video, but
the elaboration reaching me came via third-party blogs summarising it, not NN/g directly.]**

**d. Form-field count matters more than step count.** Baymard's checkout research finds that what
drives usability is the number of form fields users must consider, not the number of steps, and
that the average checkout carries roughly twice as many fields as necessary. Checkout ≠ SaaS
onboarding, so this is a transferred mechanism, not a transferred number — but it supports
splitting setup into more, smaller steps (§3's three steps) and dropping the team-size field from
step 1 rather than compressing everything onto one screen. **[Grade B for the qualitative finding
(Baymard's own blog, corroborated by Amazon Pay's summary of the Baymard report series); Grade D
for the specific "4-6% completion drop per field beyond the eighth" figure, which appeared only in
a vendor blog with no traceable primary study — do not cite that number.]**

**e. Time-to-first-value is the highest-leverage onboarding lever.** Lenny's Newsletter defines
the activation milestone ("aha moment") as the earliest point in onboarding that, by showing the
product's value, predicts long-term retention — and frames reducing time to that moment as the
single highest-leverage onboarding optimisation. This is the entire argument for §3's step 3
being a *real reply that already went out*, not a "you're all set" screen. **[Grade B — Lenny's
Newsletter is a well-regarded primary practitioner source and two of its own posts
("What is a good activation rate", "How to determine your activation metric") surfaced directly;
snippet-level only.]**

**f. Dashboards fail by KPI count.** The commonly repeated best practice is 5-9 KPIs on a primary
view, grounded in the 7±2 working-memory heuristic, with a Summary → Context → Details tiering and
the 3-5 most critical numbers at the top. FollowUp's dashboard currently carries **13** tiles in
three separate groups; §3/§7.2 cut it to 3. **[Grade C — the 5-9 guidance is consistent across
several dashboard-design roundups that attribute it to NN/g, but I could not confirm the
attribution against an NN/g page; treat "5-9" as accepted practice, not a cited NN/g finding.
The claims that "progressive disclosure reduces cognitive load by up to 55%" and "dashboards built
around user goals boost usability by 70%" appeared in the same snippets attributed to NN/g and are
**Grade D — do not repeat them**; they have no traceable study behind them.]**

**g. Top-level navigation counts cluster around 7, and size is not a reason for more.** NN/g's
survey of 77 intranet information architectures found a median of 7 top-level categories (mean
7.6, range 3-31), with *no* correlation between organisation size and category count. FollowUp is
at 7 today — i.e. at the median for an intranet serving thousands of employees, for a product
whose entire user is one plumber. Four is the argument. **[Grade B — a specific, quantified NN/g
finding surfaced in NN/g's own article snippet; the underlying report was not fetched.]**

**h. Choice count slows decisions (Hick's Law), and progressive disclosure is the standard
mitigation in onboarding.** Widely-taught UX principle: increasing option count increases decision
time and cognitive load; the standard onboarding application is to show only essential fields
first and reveal the rest as the user progresses. Supports §2's chip reduction (9 → 4) and §5's
one-switch model. **[Grade C — Hick's Law itself is a well-established psychophysical result
(Hick 1952 / Hyman 1953), but everything reaching me was UX-blog secondary material
(Laws of UX, Dovetail, IxDF-adjacent); no primary paper fetched. I searched specifically for a
Growth.Design case study on this and found none — that source is unconfirmed for this pass.]**

**i. SMB software is abandoned during setup, not after evaluation.** Multiple onboarding-industry
sources converge on the same direction: SMBs have no IT staff, drop off during trials rather than
formally cancelling, and the failure is described as a clarity problem rather than a marketing
one. Directionally consistent with FollowUp's own ICP research, which found the segment
specifically resents complexity it must administer (`2026-09-05-icp-pain-and-trust-objections.md`
quotes a competitor positioning against *"a complex system that requires a full-time administrator
to manage"*). **[Grade D on every number — the "85% abandonment in complex SMB software",
"67% quit because of too many steps", "72% abandon during onboarding", "90% churn if not engaged
within 3 days" and "70% churn within 90 days due to onboarding failures" figures all came from
content-marketing blogs with no primary study named, and several are mutually inconsistent.
Report the *direction* only. Do not put any of these on the landing page.]**

**j. Activation and time-to-value benchmarks exist but are not trustworthy at this sourcing
level.** Search surfaced a spread of 2026 "benchmark" figures (median TTV ~1 day; "top performers
under 5 minutes"; SMB activation targets of 35-50%; SaaStr-attributed "90% activation within 30
days"). They come from SEO benchmark-roundup sites, disagree with each other, and in at least one
case attribute a number to SaaStr without linking it. **[Grade D — useful only as evidence that
"fast time-to-value" is an industry-wide preoccupation, which is a claim §3 doesn't need
statistics for. Do not cite any specific number from this cluster.]**

### What this evidence does and doesn't carry

It carries: progressive disclosure as the right *technique*, plain language over feature names,
empty-states-as-onboarding, field-count over step-count, activation-as-first-real-value, ~7 as a
generous top-level nav ceiling. It does **not** carry any quantified prediction about FollowUp's
own activation rate, and this document makes none. The strongest evidence in this pass is not
external at all — it is the code inventory in §0: 41 concepts, 12 settings sections, two parallel
automation vocabularies, and no approval queue for an approval-first product.

### Open questions this pass could not answer

- **Does a small-business owner read "Autopilot" as "it sends things without asking"?** That's a
  five-person hallway test, not a research question. Run it before shipping change #5.
- **Is the rescue score's number worth showing at all?** §4 proposes dropping the 0-100 and
  keeping only the ordering. That is a judgement call about whether transparency-as-trust
  (`PRODUCT_DIRECTION.md`'s "visible-reason AI scoring" moat) requires a *number* or only a
  *reason*. The reason string already exists and reads well; the number may be adding precision
  the owner can't act on.
- **How many real users have ever opened `/workflows` or `/analytics`?** No product analytics were
  found in this pass beyond Sentry instrumentation. Demoting two nav items on reasoning alone is
  defensible; demoting them on usage data would be better. Worth adding a page-view counter before
  change #5, not after.

---

## Sources checked 2026-09-10

Internal (read in full, first-hand):
- `/home/user/Follow-up-app/followup/PRODUCT_DIRECTION.md`
- `/home/user/Follow-up-app/followup/research/market/2026-09-08-product-direction-synthesis.md`
- `/home/user/Follow-up-app/followup/research/market/2026-09-07-lead-rescue-gap-and-strategy.md`
- `/home/user/Follow-up-app/followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md`
- `/home/user/Follow-up-app/followup/research/market/2026-09-08-pentest-vendor-options.md` (house style)
- `src/app/(app)/layout.tsx`, `dashboard/page.tsx`, `leads/page.tsx`, `leads/LeadsPageClient.tsx`,
  `leads/[id]/page.tsx`, `pipeline/PipelinePageClient.tsx`, `workflows/page.tsx`,
  `analytics/page.tsx`, `activity/page.tsx`, `settings/page.tsx`
- `src/app/onboarding/page.tsx`, `src/components/OnboardingForm.tsx`
- `src/components/`: `Sidebar.tsx`, `LeadAutomationToggle.tsx`, `AutomationStatusBadge.tsx`,
  `LeadTrustPanel.tsx`, `MessageComposer.tsx`, `LeadWorkflowEnrollment.tsx`, `ScoreBadge.tsx`,
  `PriorityPill.tsx`, `StageSelector.tsx`, `EmptyState.tsx`, `NotificationBell.tsx`,
  `SourceRoutingSection.tsx`, `TwilioConfig.tsx` (structure), `DataPrivacySection.tsx` (structure)
- `src/lib/`: `rescue.ts`, `consent.ts`, `automationStatus.ts`, `automation.ts`, `leads-data.ts`,
  `demo-data.ts` (`PIPELINE_STAGES`)
- `src/app/globals.css` (palette confirmed unchanged by this proposal)

External (WebSearch snippets only — WebFetch egress-blocked):
- https://www.nngroup.com/videos/progressive-disclosure/
- https://en.wikipedia.org/wiki/Progressive_disclosure
- https://ixdf.org/literature/book/the-glossary-of-human-computer-interaction/progressive-disclosure
- https://www.nngroup.com/articles/technical-jargon/
- https://www.nngroup.com/articles/user-centric-language/
- https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
- https://www.nngroup.com/articles/intranet-information-architecture-ia/
- https://www.nngroup.com/reports/intranet-information-architecture-design-methods/
- https://www.linkedin.com/posts/nielsen-norman-group_empty-states-in-application-design-3-guidelines-activity-6988859227289120769-gKaQ
- https://baymard.com/blog/checkout-flow-average-form-fields
- https://pay.amazon.com/blog/for-businesses/the-baymard-report-series-too-many-fields-too-little-time
- https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate
- https://www.lennysnewsletter.com/p/how-to-determine-your-activation
- https://lennyrachitsky.wiki/articles/activation-rate
- https://lawsofux.com/hicks-law/
- https://dovetail.com/ux/hicks-law/
- https://carbondesignsystem.com/patterns/empty-states-pattern/
- (Grade D, listed for traceability only, not for citation: shno.co SaaS onboarding statistics;
  getperspective.ai 2026 onboarding benchmark; productquant.dev activation benchmarks;
  saasfactor.co onboarding framework; profitbooks.net SMB trial drop-off)
