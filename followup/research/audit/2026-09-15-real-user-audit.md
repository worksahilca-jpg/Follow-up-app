# Real-user audit — 2026-09-15

Not a code read. FollowUp was **actually run and used** for this pass.

**Setup.** The configured `DATABASE_URL` points at the production Supabase instance, so it was
left untouched. Instead: the local Postgres 16 cluster was started, a `followup_dev` database
created, all 24 migrations applied with `prisma migrate deploy`, and `next dev` run against it.
A NextAuth session cookie was minted with the app's own `NEXTAUTH_SECRET` (Google OAuth can't be
driven headlessly), and a first user + business were created by replicating `src/lib/auth.ts`'s
`signIn` callback exactly — so the first-run state is the real one, not a fixture.

Everything below was reproduced against **pristine `origin/main` @ `b0c823c`** in a separate
`git worktree` on port 3100. That matters: while this audit was running another agent was editing
`settings/page.tsx`, `workflows/page.tsx`, `PipelinePageClient.tsx` and `globals.css` in the shared
working tree (and briefly left a syntax error in it). No finding here is based on that tree.

**Journeys walked:** landing → signed-in redirect → onboarding step 1 → step 2 → "I'll do this
later" → empty dashboard → seeded leads → approval queue → approve (which failed) → lead detail →
leads list → pipeline → follow-up plans → analytics → activity → settings (all five tabs) →
billing → public booking link → embed widget → a bad lead URL → a SALES teammate → a lapsed
subscription.

**Measurements**, not impressions: `document.scrollWidth` vs viewport at a true 390×844 iPhone 13
viewport; WCAG 2.1 contrast computed from the real token hexes; `:focus-visible` matching plus
computed `box-shadow` plus A/B screenshots; tap-target rects; heading order; label associations.

Screenshots referenced below are in the session scratchpad at
`/tmp/claude-0/-home-user-Follow-up-app/3d916d81-53e7-51a4-bb6d-b93bad3e4d33/scratchpad/shots/`.

Findings 1, 2, 3, 4 and 6 of `2026-09-15-bug-hunt.md` are excluded as agreed — they're being fixed.
Ranked by damage to a real customer.

---

## 1. The empty dashboard tells a business with nothing connected that FollowUp is watching their inbox — high severity, confirmed

`src/app/(app)/dashboard/page.tsx:104-106`

```tsx
<p className="text-lg leading-relaxed">
  FollowUp is watching your inbox. The moment a lead writes, it replies within a minute and shows you
  here.
</p>
```

That sentence is unconditional. Only the *sub*-line beneath it is gated:

```tsx
{gmail.connected && ( ... Watching {gmail.email} ... )}
```

**What a real owner does.** Signs up, reaches onboarding step 2, taps "I'll do this later" (a first-class
option the screen offers), and lands on the dashboard. Screenshot `C-_dashboard-phone.png` /
`C-_dashboard-desktop.png`: the product states, as a fact, that it is watching an inbox it has no
access to. No mailbox is connected, nothing is being watched, and no lead will ever appear.

The code comment immediately above says the state should say *"what's actually true right now
(watching, or not yet set up)"* — the "or not yet set up" branch was never written.

It is wrong in the other direction too: `gmail` here is `getGmailStatus()` only, so a business that
has genuinely connected **Outlook** is watching a real inbox and never gets the confirmation line.

**Cost.** This is the product's entire promise, asserted falsely, on the first screen after signup, to
the exact user who hasn't finished setup. Brand principle "trust outranks sophistication" — a
first-run screen that lies is the most expensive copy defect in the app.

---

## 2. Outlook is a second-class citizen through the whole of first-run — an Outlook business can never finish setup — high severity, confirmed

Three places assume Gmail is the only mailbox:

- **Onboarding step 2** (`src/components/OnboardingForm.tsx:271-296`) offers exactly one button,
  `Connect Gmail`, under the copy *"This is the whole point — FollowUp reads your sales
  conversations… Without it, the dashboard stays empty."* There is no Outlook option and no
  "I use something else". Screenshot `B-onb2-phone.png`.
- **The setup checklist** (`src/lib/setupStatus.ts:29-58`) computes the inbox step from
  `getGmailStatus(businessId)` alone:
  ```ts
  if (!gmail.connected) {
    steps.push({ id: "gmail", title: "Connect your inbox", ctaLabel: "Connect Gmail", ... });
  }
  ```
- **The dashboard empty state**, per finding 1.

`getOutlookStatus` exists (`src/lib/integrations/outlook.ts:86`) and is referenced in exactly two
files — `api/integrations/outlook/status/route.ts` and `src/lib/sending.ts`. Neither is onboarding,
setup status, or the dashboard.

**What a real owner does.** A home-services or dental business on Microsoft 365 — three of the seven
industries the previous onboarding step offers — connects Outlook successfully in Settings. The
dashboard then still shows *"Connect your inbox · N more setup steps after this"* forever, with a
"Connect Gmail" button, and the remaining-steps count is permanently overstated by one. The
checklist can never reach zero.

Settings itself already knows better — `src/app/(app)/settings/page.tsx:750` says *"Connect Gmail or
Outlook to start pulling in your real leads"* — while the card above it is still labelled
*"Gmail + Calendar — **Required**"* (`:626`). Required and one-of-two at the same time, on one screen.

**Related, same function:** `setupStatus.ts:70` marks the widget step done only when a
`Lead` with `source: "Website form"` already exists. A business that correctly pastes the snippet into
their site but hasn't had a submission yet is told forever that they haven't added the widget.
Completion is measured by an event the *visitor* controls, not the action the step asks for.

---

## 3. Keyboard focus is invisible across the entire signed-in app — high severity, confirmed on pristine main

`src/app/globals.css:175-180`

```css
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible,
textarea:focus-visible, [tabindex]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--rust-soft), 0 0 0 1px var(--rust);
  border-radius: 4px;
}
```

The rule kills the browser's own focus outline and replaces it with a `box-shadow` ring **that never
paints**. Measured, keyboard-driven (not programmatic), on `origin/main`:

| check | result |
|---|---|
| `document.activeElement.matches(":focus-visible")` after `Tab` | `true` |
| computed `box-shadow` on that element | `rgba(0,0,0,0) 0px 0px 0px 0px, rgba(0,0,0,0) 0px 0px 0px 0px` |
| `--rust-soft` / `--rust` resolve on the element | `#2a5cdb1f` / `#2a5cdb` — fine |
| rendered result | no ring — see `CLEAN-navlink-unfocused.png` vs `CLEAN-navlink-focused.png` |

Reproduced on the sidebar nav links and on the approval queue's **"Approve & send"** button
(`G2-focus.png`). The computed value is Tailwind's `--tw-ring-shadow, --tw-shadow` transparent
default, i.e. something in the utility layer is winning the `box-shadow` declaration; injecting the
same rule with `!important` at runtime did not restore it either. **I could not pin the exact cascade
mechanism** and am not going to guess at it — but the user-visible defect is certain and reproducible.

**What a real user does.** Anyone navigating by keyboard — or any user of a screen magnifier, or
anyone who simply tabs out of a text field — has no idea what is focused. Because `outline: none`
removes the fallback, the app is strictly *worse* than having no focus CSS at all. The most dangerous
instance: on the dashboard, `Tab` ×12 lands on "Approve & send" — a button that sends a real message
to a real customer — with zero visual indication.

**Fix direction:** an `outline` / `outline-offset` based indicator can't be clobbered by shadow
utilities the way `box-shadow` can.

---

## 4. Three pages scroll sideways on a phone; primary actions are clipped off-screen — high severity, confirmed

Measured `document.scrollWidth` at a 390px viewport on `origin/main`:

| route | scrollWidth | verdict |
|---|---|---|
| `/dashboard` | 390 | ok |
| **`/leads`** | **636** | 63% wider than the screen |
| `/pipeline` | 390 | ok |
| **`/workflows`** | **493** | overflow |
| `/analytics` | 390 | ok |
| `/activity` | 390 | ok |
| **`/settings`** | **470** (430–470 on every tab) | overflow |

**`/leads`** — `src/app/(app)/leads/LeadsPageClient.tsx:133-138`:

```tsx
<div className="flex items-start justify-between gap-4">
  <div><h1 …>Leads</h1><p …>{leads.length} total, sorted by follow-up priority.</p></div>
  <div className="flex shrink-0 gap-2">   {/* ← 522px of buttons that refuse to shrink */}
```

Four buttons — Clean up leads / Log a call / Import CSV / **+ Add lead** — on one non-wrapping row
marked `shrink-0`. At 390px the group measures 522px, the title column is crushed so "5 total,
sorted by follow-up priority." wraps to four lines, and the primary **"+ Add lead"** is cut off at
the right edge. Screenshot `D-_leads-phone.png`.

**`/workflows`** — same pattern, worse typography: the `<h1>` breaks into "Follow-/up/plans" over
three lines and the description becomes a twelve-line ribbon down the left gutter, while "+ New plan"
is clipped. Screenshot `D-_workflows-phone.png`.

**`/settings`** — two separate offenders: the five-tab strip runs past the edge (the **"Advanced"**
tab sits at x-right 430), and in the CRM card the row
`[Follow Up Boss ▾] [API key] [Connect]` is `flex gap-2` with no wrap
(`src/components/CrmConfig.tsx:145-168`), putting the **"Connect" button at x-right 470 — 80px
off-screen**. Screenshot `E-_settings-phone.png`.

**What a real user does.** The ICP is "on a phone, interrupted, up a ladder". They open Leads to add
the job they just quoted and the Add-lead button is half off the screen; the page slides sideways
under their thumb while they try to scroll the list. On Settings they paste their CRM key and cannot
reach Connect at all without horizontally scrolling the whole document.

---

## 5. A working Free-tier business is told it must start a trial to do things it can already do — high severity, confirmed live

`src/lib/setupStatus.ts:40`

```ts
if (!hasActiveAccess(business?.subscriptionStatus)) {
  steps.push({ id: "billing", title: "Start your free trial",
    description: "14 days, no card required — needed to sync, add leads, and send follow-ups.", … });
}
```

`hasActiveAccess` is called **without the tier argument**. Per its own doc comment
(`src/lib/billing.ts:23-54`), omitting the tier means a Free business — which by design has no Stripe
subscription at all — reads as fully locked out. That's the exact regression that comment describes as
having once made "the whole Free tier non-functional end to end"; it's still live in this call site.

**Disproved empirically.** As a brand-new Free business with `subscriptionStatus: null`:

```
POST /api/leads  →  200  {"success":true,"id":"cmu2aa0fy00037dvtp9cziizi"}
```

Adding leads works. The banner says a trial is "needed to … add leads". Every gated route uses
`requireActiveBilling`, which *does* pass the tier — so the gate is right and only the checklist is
wrong.

**And the product contradicts itself two clicks away.** Settings → Billing (screenshot
`T-settings-Billing.png`) is excellent and honest: *"Free · $0/mo · Email + web widget, 20 leads/mo,
assisted only. No card needed — **this is where you are now**."* with a live "5/20 leads this month"
meter. The dashboard's only setup banner tells the same user the opposite.

**Cost.** The single most prominent call-to-action on the home screen pushes a Free user toward
checkout using a false scarcity claim. That reads as a dark pattern even though it's a bug.

---

## 6. A customer whose card just failed is told to "start your free 14-day trial" — medium-high severity, confirmed

`src/lib/billing.ts:74-75`

```ts
export const BILLING_LOCKED_MESSAGE =
  "Start your free 14-day trial to unlock this — see Billing in Settings.";
```

One constant, **43 call sites** across the API. It cannot distinguish "never subscribed" from "card
declined" from "cancelled". Driven live with `subscriptionStatus: "past_due"`, `tier: "plus"`:

```
POST /api/leads/{id}/send   → 402  "Start your free 14-day trial to unlock this — see Billing in Settings."
POST /api/leads             → 402  "Start your free 14-day trial to unlock this — see Billing in Settings."
POST /api/automation/run    → 402  "Start your free 14-day trial to unlock this — see Billing in Settings."
```

**What a real user does.** A paying customer's card expires. Their follow-ups stop. Every button they
press tells them to start a trial they've already used and cannot start again. Nothing names the real
problem (a failed payment) or the real fix (update the card).

The correct words already exist — `src/app/(app)/settings/page.tsx:1112-1114` renders *"Payment
failed — update your card to keep your account active."* — but only on the Billing tab, which the user
has to already know to visit. The message they actually encounter, at the moment of failure, points
them somewhere else entirely.

**Cost.** This is the highest-churn-risk moment in the whole product and it's handled with the wrong
sentence, 43 times over.

---

## 7. Approving a held draft can fail with a raw system reason, no recommendation, and no way forward — medium-high severity, confirmed

Driven end to end: a lead's 30-hour-old enquiry, a draft held by the risk gate, the owner taps
**"Approve & send"**.

```
POST /api/leads/{id}/send → 500 {"success":false,"message":"No Gmail account is connected for this business."}
```

Screenshot `F-approve-failed-phone.png`. The card shows that sentence in coral and then just… sits
there. A business owner cannot answer any of the five questions the design brain requires of an
automated action:

- *What happened?* The message did not go. (Clear enough.)
- *Why?* "No Gmail account is connected for this business" — system language, not theirs.
- *What can I do?* **Nothing offered.** No link, no button, no "Connect your inbox" affordance —
  even though the app knows this exact remedy and has a route for it.
- *What does FollowUp recommend?* Nothing.
- *What needs me?* Unstated — is the draft still queued? Will it retry? Is the lead still waiting?

The setup strip *on the same screen* knows about this problem, but it ranks billing first, so the
inbox step isn't even the one being shown.

**Cost.** The product held a message specifically to ask permission, got permission, and then failed
to send — and the owner is left to work out both the cause and the cure unaided while a real customer
waits.

---

## 8. A lead's automation badge promises a follow-up the business has no way to send — medium severity, confirmed

`src/lib/automationStatus.ts:66-78` defines eight states: `closed`, `workflow`, `workflow_paused`,
`off`, `account_paused`, `due_soon`, `waiting`, `sent`. **None of them is "no sending channel is
connected."** And `BusinessAutomationRules` (`:29-36`) carries only `masterEnabled`,
`silenceTriggerDays`, `unansweredEnabled`, `unansweredHours`, `deadLeadEnabled`, `deadLeadDays` — no
connection facts at all, so the function *cannot* express that state even if a caller wanted it to.

Screenshot `L-_leads_…-phone.png`, on a business with no mailbox connected:

> ● **Following up soon** — Next automation check will pick this up — they wrote and haven't heard back

That is false. The next automation check will reach `sendFollowUpToLead`, fail exactly as finding 7
shows, and the lead will keep waiting. The badge will keep saying "Following up soon" indefinitely.

The file's own header says it exists because *"a lead qualified for an automated reply for hours with
nothing visibly happening… the real reason was only findable by querying the database directly."* It
solved that for the master switch and the per-lead tier, and reproduces it exactly for "nothing is
connected".

---

## 9. One concept, four different names — and one of them points at a page that doesn't exist — medium severity, confirmed

| Where | What it's called |
|---|---|
| `src/components/Sidebar.tsx:26` | **Follow-up plans** |
| `src/app/(app)/workflows/page.tsx` (title, empty state, CTA) | **Follow-up plans** / **New plan** |
| `workflows/page.tsx:132` | "Use recommended **cadence**" |
| `workflows/page.tsx:57` | seeded plan is named "Recommended follow-up **cadence**" |
| `workflows/page.tsx:407` | placeholder `'**Workflow** name, e.g. "New lead nurture"'` |
| `src/components/SourceRoutingSection.tsx:117` | optgroup "**Enroll** in a **workflow**" |
| `src/app/(app)/analytics/page.tsx:69,76` | "In a **workflow**", "**Workflows** completed (30d)" |
| `src/components/LeadTrustPanel.tsx:71` | "a scheduled **workflow** step" |

So: a user clicks **Follow-up plans**, presses **Use recommended cadence**, and ends up with a plan
called **Recommended follow-up cadence** in a box labelled **Workflow name** — then sees it counted
under **Workflows completed (30d)** in Analytics.

Worst instance, `SourceRoutingSection.tsx:136`:

> Build a workflow on the **Workflows page** to also offer "enroll automatically" here.

There is no Workflows page in the navigation. It's called "Follow-up plans". The one piece of
in-product wayfinding sends the user looking for something that isn't there.

"Cadence" and "enroll" are both squarely in the brief's *system-language-not-user-language* category —
a plumber does not have cadences or enrol anyone.

---

## 10. Form controls across the app have no accessible name — medium severity, measured

Counted across `src/components` + `src/app`:

- `<label>` elements **with** `htmlFor`: **1**
- `<label>` elements **without** `htmlFor`: **27**
- `<input> / <select> / <textarea>` total: **59**
- `aria-label` attributes anywhere (including on buttons): **14**

The pattern, e.g. `src/components/OnboardingForm.tsx:163-171`:

```tsx
<div>
  <label className="text-sm font-medium block mb-1.5">Business name</label>
  <input value={name} onChange={…} className="…" placeholder="e.g. Riverside Realty" />
</div>
```

The label is a sibling, not a wrapper, and carries no `htmlFor`; the input has no `id`. Confirmed at
runtime — every input on onboarding step 1 reports `name: ""`, `id: ""`, no `type` attribute.

Affected on the paths walked: all three onboarding fields (the very first screen of the product), the
leads **search** box, and the CRM **API key** field. A screen-reader user hears "edit, blank".

---

## 11. Mobile tap targets below the minimum, on the two most-used controls — medium severity, measured

At 390×844:

| control | size |
|---|---|
| Notification bell (mobile header) | **32 × 32** |
| Hamburger / Open menu | **32 × 32** |
| Close menu (drawer) | **32 × 32** |
| Every drawer nav row (Today, Leads, Pipeline, …) | 215 × **36** |
| Logo link | 106 × **28** |

Apple's HIG minimum is 44×44; WCAG 2.2 AA (2.5.8) is 24×24 as an absolute floor. The bell and the
hamburger are the *only* two controls in the mobile header — on a phone, in a van, they are the two
things a user reaches for most and the two hardest to hit.

---

## 12. The explanations that carry the most trust are hover-only, so they don't exist on a phone — medium severity, confirmed

Three `title=` attributes doing real explanatory work:

- `src/app/(app)/dashboard/page.tsx:183` — `title="Rescue score, 0–100"` on the coral badge that
  **orders the entire "About to be lost" list**. On a phone the user sees an unexplained number
  (e.g. `79`) deciding which customer to call first.
- `src/components/LeadTrustPanel.tsx:105` — `title="How this person reached you — which is what makes
  replying legal and expected."`
- `src/components/LeadTrustPanel.tsx:138` — `title="Every message FollowUp sent or held for your
  approval on this lead."`

The last two are the *consent basis* and the *AI activity log* — the two things the Trust panel exists
to explain. Both explanations are invisible to every touch user.

---

## 13. "Drag a card to move its stage" — told to users who cannot drag — low-medium severity, confirmed

`src/app/(app)/pipeline/PipelinePageClient.tsx:87`

```tsx
Where every deal stands, and what it&apos;s worth. Drag a card to move its stage.
```

Unconditional. The mobile pipeline (screenshot `L-_pipeline-phone.png`) is actually a **good**
responsive design — it drops the drag-and-drop columns and gives each lead a stage `<select>` instead
— but the instruction above it still tells a phone user to do something the screen doesn't support,
and never mentions the dropdown that does work.

---

## 14. "Weighted value" is a forecast built from invented probabilities, presented as a bare number — low-medium severity, confirmed

`src/app/(app)/pipeline/PipelinePageClient.tsx:19-27, 57, 111`

```ts
const STAGE_WEIGHT: Record<string, number> = {
  new: 0.1, contacted: 0.25, qualified: 0.4, proposal: 0.6, negotiation: 0.8, won: 1, lost: 0,
};
…
const weightedValue = stages.reduce((sum, s) => sum + s.value * (STAGE_WEIGHT[s.id] ?? 0), 0);
…
<StatCard label="Weighted value" value={formatCurrency(Math.round(weightedValue))} icon={TrendingUp} />
```

The card renders **"$13,060"** next to "Total pipeline value $21,000" with no explanation anywhere on
the page. Those percentages are FollowUp's own assumption about a business it has never met — a
roofer's "proposal sent" is not 60% for everyone. The owner cannot see the assumption, cannot
disagree with it, and has no way to know the number isn't measured.

---

## 15. The public booking link is a wall of 128 buttons — low-medium severity, measured

`/book/[leadId]` on a 390×844 phone, measured live:

```
slot buttons: 128     day groups: 8     page height: 2389px     day navigation: none
```

`src/lib/booking.ts:15-18` generates every 30-minute slot across `LOOKAHEAD_DAYS = 10` of 9–5 business
hours and the page renders all of them at once. Screenshot
`P-_book_…-phone.png`: roughly three full phone screens of identical pills, no day picker, no
"next week", no collapse.

**What a real lead does.** They're the customer FollowUp just rescued. They tap the booking link, get
an undifferentiated grid of 128 times, and have to scroll. This is the one screen that converts a
rescued lead into a booked job.

---

## 16. The risk-gate explanation — the app's most trust-critical sentence — is mangled by `.toLowerCase()` and a double period — low severity, confirmed

`src/components/ApprovalQueue.tsx:123`

```tsx
{item.reason && <p className="text-xs text-ink-soft mt-1.5">Held because {item.reason.toLowerCase()}.</p>}
```

Rendered (screenshot `D-_dashboard-phone.png`):

> Held because the draft quotes a specific price and commits to a date — that needs you to confirm**..**

Two defects in one line. The reason strings already end in a period — including the two hard-coded
fallbacks, `"Couldn't assess risk automatically — held to be safe."` (`src/lib/automation.ts:408`,
`src/lib/sequences.ts:591`) — so the appended `.` always doubles. And `.toLowerCase()` destroys every
proper noun, acronym and day name the model produced: a reason mentioning "Tuesday", "VAT" or the
lead's own name renders as "tuesday", "vat".

This is the sentence that justifies FollowUp stopping itself. It should read like a careful colleague,
not like a lowercased log line.

---

## 17. No way back from a lead's page — low severity, confirmed

`src/app/(app)/leads/[id]/page.tsx` and its components contain no `ArrowLeft`, no "Back to", and no
`href="/leads"`. On desktop the persistent sidebar covers it. On a phone (screenshot
`L-_leads_…-phone.png`) the page opens with the lead's name and the only navigation is the hamburger —
two taps and a mental context switch to get back to the list you came from, on the single most
frequently entered-and-exited screen in the product.

---

## What's genuinely good — verified, not assumed

Worth protecting during the fixes above:

- **The approval queue is the best thing in the product.** It shows what the lead actually said, the
  full draft, and why it was held, with three unambiguous actions (Approve & send / Edit / Don't
  send) — no sparkle-icon hand-waving, no hidden "AI magic". `D-_dashboard-phone.png`.
- **The Billing tab is honest to a fault** — names the Free plan as "where you are now", shows a live
  5/20 meter, and states plainly that "Leads still come in past the cap, they just stop getting
  scored/drafted." No countdown timers, no fake scarcity. (Which makes finding 5 all the more jarring.)
- **The colour palette passes WCAG AA everywhere it's used.** Computed from the real token hexes in
  `src/app/globals.css`: ink/card **16.69:1**, ink-soft/card **7.49:1**, ink-soft/paper **7.04:1**,
  rust/card **5.75:1**, coral/coral-soft **5.11:1**, sage/sage-soft **5.50:1**, gold/gold-soft
  **4.73:1**, slate/slate-soft **5.10:1**. My first automated pass reported four contrast failures on
  the Settings tabs; that was **my** bug — the harness mis-parsed an `oklab()` background. There is no
  contrast finding here.
- **The mobile pipeline degrades intelligently** — drag-and-drop columns become a stacked list with a
  per-lead stage dropdown. (Only the instruction text wasn't updated; finding 13.)
- **The lead detail page is well built on a phone** — no overflow, clear hierarchy, "Nothing sends
  without your approval" stated up front, trust sections collapsed by default.
- **The 404 page is friendly, blameless and has a way out** — "Can't find that page… Nothing's wrong on
  our end."
- **Heading order is clean** on every page checked (single `h1`, then `h2`s, no skips).

---

## Resolved from the previous pass

`getPendingApprovals` (`src/lib/pendingApprovals.ts:62-67`) combines `distinct: ["targetId"]` with
`take: 500`. The previous report flagged this as unverified — if `take` were applied before
de-duplication, still-pending holds would silently vanish from the approval queue.

**Settled against the live database. It is not a bug.** Test: one `ai.hold` on lead A dated 10 days
ago, then 600 newer `AuditEvent` rows spread across leads B and C, then the exact query the function
runs:

```
rows returned: 3      distinct targetIds: 3      total matching rows in table: 603
is the buried ai.hold lead present? YES — distinct is applied in the database
```

Prisma 6.19.3 pushes `distinct` down to PostgreSQL (`DISTINCT ON`), so `take: 500` bounds *distinct
leads*, not raw rows. The buried hold survives. No change needed.
