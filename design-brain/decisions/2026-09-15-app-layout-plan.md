# App-wide layout plan — every authenticated screen

**Date:** 2026-09-15
**Status:** PROPOSAL. Nothing here is implemented. No app code was written to produce it.
**Scope:** `/dashboard`, `/leads`, `/leads/[id]`, `/pipeline`, `/workflows`, `/analytics`,
`/activity`, `/settings`, `/onboarding`, `/signin`, `/admin`, `/admin/office`, plus the
shell (`(app)/layout.tsx` + `Sidebar`) that all of them inherit.
**Method:** every page's current code was read before it was planned. Line references below
are to `followup/src/…` at `origin/main` (`5e0caf0`).

---

## 0. What this plan is built from, and what it is deliberately not

### 0.1 The one constraint that decides everything

The founder ran a six-pair A/B calibration today, each pair isolating one variable:

| Variable | His pick |
|---|---|
| Density | **Tight** — more on screen, not roomy |
| Edges | **Soft corners + real shadow** — not crisp/flat |
| Colour | **Colour-coded** — let the status colours speak |
| Numbers | *no preference* |
| Grouping | **Each item in its own box** — not bare hairline rows |
| Accent blue | **Held back** — saved for one moment, not used across the screen |

The principle underneath: **status colour does the work; the brand blue stays quiet.**

That is measured data, not a hypothesis, and it is the first input this session has had that
the standing note at the end of `rejected.md` would count as coming from the founder rather
than from Claude's guess about him. **Open question 1 below asks him to confirm that
reading before the dashboard is touched.**

### 0.2 The repeating device this produces

One structural primitive, used on every screen. Call it the **item box**:

- An opaque `--card` box on the `--paper` background. 12px radius. **No border.** A real
  shadow — the value already shipping in `components/landing/SignInClient.tsx:101`
  (`0 30px 60px -28px rgba(11,31,51,0.28), 0 0 0 1px rgba(11,31,51,0.06)`), stepped down for
  list density to roughly `0 1px 2px rgba(11,31,51,0.05), 0 8px 20px -14px rgba(11,31,51,0.20)`.
  Hover deepens the shadow; nothing translates.
- A **3px left status rail** in one of the four status colours. This is the only place
  colour enters a box.
- **Tight:** 12–14px internal padding, 8px gap between boxes. Two text lines max.
  Line 1: name (medium) + the one right-aligned figure. Line 2: one plain-language fact.
- Section label sits **outside** the box — mono, uppercase, `--ink-faint`/`--ink-soft`.

This replaces the string that is currently the single most-repeated layout in the app —
`rounded-xl border border-line bg-card divide-y divide-line` — which ships at
`dashboard/page.tsx:167`, `:203`, `:227`, `leads/LeadsPageClient.tsx:280`,
`activity/page.tsx:83`, `admin/office/page.tsx:212`. That pattern is precisely the option
the founder voted **against** in two of the six pairs at once (flat edges, bare hairline
rows). Replacing it is the highest-leverage single change in this document.

### 0.3 Walking the tension with S-05, S-06 and S-09 deliberately

Dense + boxed + colour-coded sits close to three standing rejections. Here is the specific
rule that keeps each one on the right side, stated so it can be enforced in review:

**vs [[rejected#^S-05|S-05]] (over-colourful dashboards).** Three hard caps.
(a) **At most one hue per box** — the rail, and nothing else. No coloured numbers, no
coloured icons, no tinted fills inside the box.
(b) **A hue never appears without its word in the same box.** If the rail is coral, line 2
says "Waiting 26h." Colour is a second encoding of a stated fact, never the only encoding
— which is also the accessibility rule, not just a taste one.
(c) **No screen shows more than three distinct hues at once.** Where a screen currently
exceeds that (`/activity` uses four, `/analytics` uses three across twelve tiles), this
plan reduces it. A rainbow means nothing; four colours that each mean one thing and are
each also written in words is not a rainbow.

**vs [[rejected#^S-06|S-06]] (clutter).** Tight is a *spacing* decision, not a *quantity*
decision. The rule applied per screen below: **every screen that gains density must also
lose elements.** `/leads` loses a 4-tile stat row, `/analytics` loses nine tiles' worth of
equal weighting, `/pipeline` loses a chart that repeats the board beneath it. If a screen
comes out of this pass with more things on it, the pass failed on that screen.

**vs [[rejected#^S-09|S-09]] (card-in-card soup).** **Exactly one box level, everywhere.**
The item box *replaces* the outer container rather than sitting inside it — boxes sit
directly on `--paper`. Where a box genuinely needs internal structure, the divider is a
hairline or a 2px left rule, never a second box. This is already the shipped fix in
`ApprovalQueue.tsx` (see its own header comment, lines 19–36) and it generalises. The two
live violations this plan fixes are `leads/[id]/page.tsx:134-192` (a `divide-y` stack
wrapping `CollapsibleSection`s that each wrap a `rounded-xl border` card — three levels)
and `settings/page.tsx:672` (a bordered box nested 52px inside a section).

**vs [[rejected#^S-11|S-11]] (tiny text).** Two live violations: `pipeline/PipelinePageClient.tsx:235`
(`text-[10px]` on the stage select, on every card) and `workflows/page.tsx:312`
(`text-[11px]` step number). Both fixed in the token pass, step 0.

### 0.4 How this differs from the four concepts already rejected today

Re-proposing a dead idea in new clothes is the failure mode `rejected.md` exists to
prevent. Explicitly, against each:

- **Not [[design-decisions#^D-020|D-020]] ("very basic", [[rejected#^R-001|R-001]]).** D-020's
  entire answer was subtraction — remove the banner, remove the tiles, leave 14px text on
  hairline rows at one scale. This plan *adds* a designed surface (the shadowed box), keeps
  the aurora banner and gives it real content, keeps the stat cards, and adds colour as
  structure. R-001's own text says the individual moves "may survive inside a richer
  design" and that what is closed is "subtraction as the whole answer." Two D-020 moves are
  reused below and are flagged where they are: the *computed* greeting line, and replacing
  the at-risk score pill with the concrete time fact.
- **Not [[design-decisions#^D-021|D-021]] ("Live Desk").** The calibration contradicts D-021's
  central spending decision. D-021 put the accent blue everywhere — a dark navy/blue hero
  band, gradient-clipped display numbers, dashed accent borders on every draft bubble,
  an accent-soft setup strip. "Accent blue held back" retires all of it. Also dropped: the
  24-hour timeline, decay bars, the score circle's return, and the two-column board.
- **Not [[design-decisions#^D-022|D-022]] ("Quiet Desk").** The calibration contradicts D-022
  on three of six axes: it chose tight over roomy (D-022: 640px column, 64px top padding),
  colour-coded over "almost no colour" (D-022: no pills, no chips, one coral dot), and
  each-item-in-a-box over grouped hairline rows (D-022: "grouped inset lists… rows divided
  by a hairline"). What survives from D-022 and is used here: the soft-shadow borderless
  surface, section labels outside the box, and **one filled control per screen**.
- **Not [[rejected#^R-002|R-002]] (Queue Zero / keyboard-first).** Nothing in this plan is a
  shortcut, a command palette, a `J`/`K` affordance, a `<kbd>` hint, or a "fast once you
  learn it" argument. Every interaction below is a tap or a click. The ICP is an owner on a
  phone with 90 seconds.

### 0.5 The standing rule this plan follows about the dashboard

`rejected.md`'s closing note: *"Do not open a fifth concept without [an external reference
the founder actually chose]."* This plan therefore **does not lead with the dashboard.**
The dashboard is step 3 of the implementation order, assembled from primitives he will
already have seen working on two lower-risk screens, rather than presented as a fifth
concept. See §14.

---

## 1. The shell — `(app)/layout.tsx` and `Sidebar.tsx`

Everything below inherits this, so it goes first.

**The one job:** get the owner to one of seven places and stay out of the way.

**Current, and what's wrong:**
- `(app)/layout.tsx:19` — `max-w-5xl` container, `pt-20 lg:pt-10`. **No change.** The
  container width is right; a 640px column (D-022) was the alternative and the calibration's
  "tight" vote argues against under-using the screen.
- `Sidebar.tsx:111-125` — the active nav item expresses itself three ways at once: a
  `--rust-soft` background fill, `--rust` text, **and** a 3px `--rust` bar. Under "accent
  blue held back," that is three blue events for one piece of chrome, on every screen.
  → **Keep the 3px bar in `--accent`; drop the tint fill; active label becomes `--ink` at
  600.** One blue mark says "you are here," and the screen's real accent moment is freed up
  for the page's own primary action.
- `Sidebar.tsx:48`, `:81` — the Compass logo in `--rust`. Keep (the mark is the brand, and
  it is one small glyph), but it means the sidebar carries two blue moments; if open
  question 3 comes back as "one blue per screen, full stop," the logo goes to `--ink`.
- `Sidebar.tsx:23` — nav label **"Today"** for the route `/dashboard`, whose `h1` is a
  greeting, not "Today". Three names for one screen. See §12.4.
- **390px:** the sidebar is an off-canvas drawer behind a hamburger (`:46-61`). Switching
  screens costs two taps for a phone-first ICP. A 4-destination bottom tab bar (Today,
  Leads, Pipeline, More) is the conventional answer. **Flagged as open question 7, not
  decided** — it's a real structural addition, not a tidy-up.

**States:** no loading state anywhere in the shell (every page is `force-dynamic`
server-rendered, so navigation shows the old page until the new one is ready). Worth a
route-level loading treatment eventually; out of scope for this pass.

---

## 2. `/dashboard`

**The one job:** in 90 seconds, tell the owner what needs a decision from them right now,
and let them make it without leaving the page.
**Who's on it:** the owner, interrupted, on a phone. This is the screen opened twenty times
a day. Default context applies in full.

**Information hierarchy, ranked before layout:**
1. **Drafts waiting on a yes/no** — the only thing on this screen that is blocked on a human.
2. **Leads about to be lost** — not blocked on a human, but the product's actual thesis.
3. **Proof it worked this week** — the trust deposit (principle 1). Reassurance, not work.
4. **Upcoming calls** — a commitment, not a decision.
5. **Remaining setup** — configuration, below the work.
6. **Everything numeric** — deferred to `/analytics`, already true today and correct.

**What's wrong with the current version, specifically:**
- `dashboard/page.tsx:77-88` — the aurora banner is a full-width bordered box whose entire
  content is `getGreeting()` and the fixed string "Here's what needs your attention today."
  Zero information, on the highest-traffic screen. That is [[rejected#^S-12|S-12]].
- `dashboard/page.tsx:92` — `SetupStrip` sits *between* the approval queue and the at-risk
  list, so an incomplete-configuration nag interrupts the two work sections.
- `dashboard/page.tsx:127-155` — `StatCard` renders the value in the accent colour
  (`StatCard.tsx:38`), so "At risk right now" is a large coral number at the top of the
  page. That is manufactured urgency (principle 2), and it also sits against
  [[approved#^A-005|A-005]]'s own principle — a figure is information, not a severity signal.
  The tinted-icon-square (`StatCard.tsx:29-36`) is the one thing on this page that reads as
  a generic SaaS template ([[rejected#^S-15|S-15]]).
- `dashboard/page.tsx:180-186` — each at-risk row ends in a coral 0–100 pill whose meaning
  lives in a `title` tooltip ("Rescue score, 0–100"). Principle 5's own test: *"did this
  need a tooltip to be understood? Then redesign it, don't add the tooltip."*
- `dashboard/page.tsx:172`, `:208`, `:232` — every row has `hover:-translate-y-px
  hover:shadow-sm`. Eight rows that lift on hover is motion that explains nothing
  ([[rejected#^S-08|S-08]]).
- `dashboard/page.tsx:159-166`, `:196-202`, `:223-226` — three sections each open with an
  h2 + icon + an explanatory paragraph. At 390px that is roughly six lines of prose before
  the first actionable row.
- `ApprovalQueue.tsx:159` — `if (visible.length === 0) return null`. **There is no all-clear
  state anywhere in this product.** On a good day the owner gets a greeting, three tiles and
  a link, and the screen reads as broken rather than as calm. Principle 2 says silence is a
  valid state; the app currently cannot express it.
- `ApprovalQueue.tsx:123` — "Held because …" renders *after* the draft, at 12px, last. The
  reason is what tells you what to check the draft *for* (principle 6); it is currently the
  last thing read.
- `ApprovalQueue.tsx:95-99` — a `flex justify-between` row containing exactly one child.

**What changes:**
| Change | Serves |
|---|---|
| Banner keeps the aurora and the greeting; its fixed subtitle is replaced by **one computed sentence** — "2 drafts need your OK · 5 leads going quiet" / "Nothing needs your OK. FollowUp answered 4 for you since yesterday." | D-020's surviving move, per R-001; principle 2 (the all-clear is a sentence, not an empty box) |
| `SetupStrip` moves below "About to be lost", above "What FollowUp did this week" | Hierarchy rank 5, not rank 1.5 |
| `StatCard`: drop the tinted icon square; value always `--ink`; the status colour moves to a 3px rail on the card edge; `p-5`→`p-4`; drop the `min-h-[2.25rem]` label reserve for 1-line labels | Calibration (colour-coded, tight, blue held back); A-005's principle; S-15 |
| At-risk rows become **item boxes**: 3px rail from `urgencyColor(daysSince)`, line 1 = name + right-aligned `formatCurrency` in `--ink`, line 2 = the concrete fact in mono ("waiting 26h" / "silent 6d"). **Score pill dropped**; the score stays on the lead page where its reasoning lives | Calibration (boxed, colour-coded); principle 5 (no tooltip); principle 6 (the fact is derivable, the score isn't) |
| Hover: shadow deepens, no translate | S-08 |
| Section intros cut to one clause each — **except** "Only replies to messages FollowUp sent on its own count here" (`:200-202`), which stays verbatim | Principle 1 — that sentence is a trust claim and earns its space |
| **New:** an all-clear box when the queue is empty — one line, a `--sage` rail, "Nothing needs your OK right now." plus what FollowUp did instead | Principle 2; closes the app's missing state |
| "Needs your OK" card: **the held-reason moves directly under the name**, above what the lead said | Principle 6 — read the reason, then judge the draft against it |

**Layout, desktop:** unchanged single column in `max-w-5xl`. No two-column board — that was
D-021's, and a two-column layout gives two things "first."
**Layout, 390px:** identical stack. Boxes run full-bleed to the 16px gutter. Stat row stays
3-up (≈110px each at `p-4` with the icon square gone); label 12.5px, figure 24px.
Nothing hides — the phone gets the same information as the desktop, which is the point of
the tight-density vote.

**States:**
- *First-run (no leads):* `:103-118` is already the right idea — one honest sentence plus
  `TestLeadButton`. **Keep; box treatment only.**
- *All-clear (leads exist, nothing pending, nothing at risk):* currently unexpressed. New,
  as above.
- *Loading:* none today; server-rendered, so a navigation holds the previous page. Out of
  scope, noted.
- *Error:* **a real gap.** `getRescueReport` / `getPendingApprovals` failing returns the
  same zeros as a genuinely quiet day (`:55-56`). Principle 6 says "not reviewed yet" is a
  distinct state from "nothing needed." The dashboard cannot currently tell the owner which
  one they're looking at. Fixing this is a data-layer change; flagged, not designed here.

**Components:** reuses `ApprovalQueue`, `SetupStrip`, `StatCard`, `TestLeadButton`,
`AuroraBackground`, `FadeIn`, `CountUp`. New: `ItemBox` (§12.2), `AllClear` variant of
`EmptyState` (§12.5).

---

## 3. `/leads`

**The one job:** find one particular person, or scan who has been waiting longest.
**Who's on it:** the owner, usually with a name already in mind, often on a phone.

**Hierarchy:** 1. the list. 2. filters. 3. search. 4. counts. 5. add/import/log.

**What's wrong:**
- **The list is fourth.** `LeadsPageClient.tsx:131-202` puts header + four buttons + four
  stat tiles + a chip row above it. On desktop the first lead sits ~340px down; on a phone,
  considerably further. The page's entire reason to exist is below the fold on the device
  the ICP uses.
- `LeadsPageClient.tsx:189-202` — four `StatCard`s (Total / Hot / Going cold / Won) sitting
  directly above filter chips named **Hot**, **Cold** and **Won** (`:25-35`). The same three
  facts, twice, stacked. "Total" duplicates the subtitle at `:136`.
- `LeadsPageClient.tsx:138-162` — four top-right buttons (Clean up, Log a call, Import CSV,
  Add lead). At 390px they wrap under the `h1` and consume the first screen.
- **Row anatomy, `:284-314`** — seven columns: score circle, name+company, `PriorityPill`
  (`hidden sm:block`), `AutomationStatusBadge` (`hidden md:block`), assignee
  (`hidden lg:block`), last-contacted date (`hidden md:block`), value. At 390px the only
  things that survive are **a number with no unit and a dollar figure.** Priority, automation
  state and staleness — the three things that tell an owner whether to act — are all hidden
  on the ICP's actual device. The 3px urgency rail (`:287-288`) survives but nothing on the
  row explains it.
- `:317-319` — "No leads match this filter." names neither the filter nor the way out.
- `:124` sorts by score always, while `:136` calls it "sorted by follow-up priority." Score
  is not the same as how long someone has been waiting, which is the product's own thesis.
  Sort is **open question 5** — changing the default is product territory.

**What changes:**
| Change | Serves |
|---|---|
| **Delete the four stat tiles; fold the counts into the chips** — "Hot 12", "Cold 7", "Won 30". "Total" already exists in the subtitle | S-06 (lose elements while gaining density); removes the duplicate |
| Top-right becomes **one** filled `--ink` "Add lead"; Log a call / Import CSV / Clean up move into a "More" menu | Calibration (one accent/one primary moment); 390px first-screen |
| **New row anatomy, identical at every width** — 3px `urgencyColor` rail; line 1 = name + right-aligned value in `--ink`; line 2 = one plain-language fact composed from what is currently hidden: "Waiting 26h · high priority" / "Silent 9 days · automation paused · unassigned". Score number kept as small mono on the right at `sm` and up; dropped below | Calibration (tight, boxed, colour-coded); principle 4 — the phone view gets *more* information, not less |
| Empty-filter line becomes "No leads match **Hot**. Show all leads." with the escape as a link | Principle 5 |
| Chip row scrolls horizontally on one line at 390px (currently `flex-wrap`, `:205`, giving three rows of chips) | Tight |

**Layout, desktop:** header (`h1` + subtitle + one primary action) / chips + search on one
line / boxed list.
**Layout, 390px:** `h1`, primary action full-width beneath it, chips on one scrolling line,
search full-width, list. Nothing hidden.

**States:** first-run `EmptyState` at `:320-343` is good — **no change** beyond the shared
component's box treatment. Filtered-empty as above. No loading state (server-rendered).
No error state on the saved-filters fetch — `:64` swallows it deliberately and documents
why; that reasoning holds, **no change**.

**Components:** reuses `ScoreBadge`, `PriorityPill`, `AutomationStatusBadge`, `AddLeadForm`,
`ImportLeadsForm`, `LogCallForm`, `SmartViewForm`, `CleanupLeadsButton`, `EmptyState`.
Drops `StatCard` from this screen. New: `ItemBox`, plus a small overflow menu (stated
reason: four sibling buttons is the thing being fixed, and no menu primitive exists).

---

## 4. `/leads/[id]`

**The one job:** decide what to say to this person, and send it.
**Who's on it:** the same owner, but here they have *chosen* to focus — this is the one
screen where reading is the task, so it can afford more vertical room than any other.

**Hierarchy:** 1. who, and why FollowUp thinks they matter. 2. what's waiting / what
automation is doing. 3. the draft and the send. 4. the conversation. 5. the score's
factor breakdown. 6. details, notes, consent, plan, delete.

**What's wrong:**
- `leads/[id]/page.tsx:36` — `ScoreBadge size="lg"` is a 64px circle, the second-largest
  element on the page, top-right, containing a bare number. Its explanation ("Why this
  score", `:79-80`) is several hundred pixels below it in the left column. Principle 6 says
  the reasoning accompanies the verdict; here they are separated by the full width and
  height of the layout.
- `leads/[id]/page.tsx:125-131` — `MessageComposer`, the page's actual job, is **third** in
  the left column, below the entire conversation (`:94-123`), which is unbounded. A lead
  with twenty messages pushes the send box arbitrarily far down, on a phone especially.
- `leads/[id]/page.tsx:134-192` — **the S-09 violation.** An `aside` with
  `divide-y divide-line` wrapping four `CollapsibleSection`s, three of which wrap their own
  `rounded-xl border bg-card` card (`:137`, `:168`, plus `LeadTrustPanel`). Three box levels.
- `leads/[id]/page.tsx:48-52` — "Email" is the only filled `--ink` button above the composer,
  and it opens `mailto:`, which leaves the product entirely: no record, no audit trail, no
  scoring input. That is a direct hole in Rule 2 ("own the data"). **Open question 6** —
  whether it should exist at all is product territory.
- `leads/[id]/page.tsx:97-105` — outbound messages get `marginLeft: 1.5rem` plus a bordered
  box. At 390px a 24px indent on a bordered box leaves very little line length.

**What changes:**
| Change | Serves |
|---|---|
| **`scoreReason` moves directly under the name**, one sentence, with the score as a small mono figure beside it. The 64px circle goes. The weighted factor list (`:81-91`) stays, collapsed under "See the factors" | Principle 6 — verdict and reasoning in the same glance |
| **Composer moves above the conversation**, directly under `AutomationStatusBadge`. The conversation collapses to the **last three messages** with "Show all 14" | Principle 4 — the job is reachable in one screen on a phone |
| The `aside` loses its inner cards: each `CollapsibleSection` *is* the box; the `divide-y` wrapper goes | S-09 |
| `mailto:` "Email" demoted to a small text link ("open in your mail app"); the page's one filled button becomes the composer's Send | Calibration (one primary moment); Rule 2 |
| Conversation: drop the indent below `sm`; keep the `--slate-soft` fill difference for outbound | Tight at 390px |

**Layout, desktop:** unchanged `md:grid-cols-3` (2/1). The reordering is within the left
column. **No change to the grid — it is already right.**
**Layout, 390px:** the grid already collapses to one column and the aside's five collapsed
sections land below the composer, which is the correct order. **No change.**

**States:** `notFound()` on a bad id (`:25`) — fine. No loading state. No "this lead has no
conversation yet" state — a manually-added lead renders an empty `Conversation` heading
with nothing under it; needs one line ("Nothing yet — the first message will show here").
No "not reviewed yet" treatment for `scoreReason === null`, though `PriorityPill` already
handles the equivalent case correctly at `PriorityPill.tsx:17` — reuse that honesty here.

**Components:** reuses `ScoreBadge` (small), `PriorityPill`, `StageSelector`,
`MessageComposer`, `LeadAutomationToggle`, `LeadWorkflowEnrollment`, `LeadAssignmentSelect`,
`DeleteLeadButton`, `CopyBookingLinkButton`, `LeadTrustPanel`, `AutomationStatusBadge`,
`CollapsibleSection`. No new components.

---

## 5. `/pipeline`

**The one job:** see where money sits, and move a deal.

**Hierarchy:** 1. the board. 2. total at stake. 3. the filter.

**What's wrong:**
- `PipelinePageClient.tsx:155` — `lg:grid-cols-4` with **seven** stages, so the board wraps
  4 + 3 with a gap. A pipeline is read left-to-right; a wrapped grid destroys the one thing
  the visual is for. At `sm` it's 2 columns (four rows); at 390px it's seven stacked columns
  and an endless scroll.
- `PipelinePageClient.tsx:137-143` — a "Value by stage" bar chart sits **above** the board
  and shows exactly the same numbers the board prints in each column header (`:199-201`).
  Same data twice, chart first.
- `PipelinePageClient.tsx:111` — "Weighted value" is jargon (principle 4) computed from a
  hardcoded weight table (`:19-27`) that is never shown. A number the owner cannot derive
  or dispute (principle 6).
- `PipelinePageClient.tsx:235` — `text-[10px]` on a stage `<select>` that renders on every
  card at every width. [[rejected#^S-11|S-11]] (12px floor), and it puts a form control in
  every row of a scannable board.
- `PipelinePageClient.tsx:175-177` — drag-over uses `--rust` (now blue) dashed 2px. This is
  a **correct** held-back use: one interaction, one moment. **No change.**

**What changes:**
| Change | Serves |
|---|---|
| Board becomes a **horizontal scroller**: seven fixed 260px columns at every width | Principle 5 — the conventional kanban, executed precisely, beats a wrapped grid |
| **Delete the "Value by stage" chart** | S-06; the board already carries it |
| "Weighted value" → **"Likely to close"**, with the basis stated in one line under it, or dropped entirely | Principle 4 (jargon), principle 6 (show the reasoning) |
| Cards become item boxes: rail already exists (`:216`); raise the select out of the card into a press/tap action, or at minimum to 12px | S-11; tight without clutter |
| Column header: stage label + count + value, count colour kept for Won/Lost only (`:186-197`) — that is already correct, one hue each, meaning-bearing | S-05 cap (c) |

**Layout, desktop:** stat row (3) / scrolling board.
**Layout, 390px:** stat row 2-up, board as one visible column with swipe. This turns a
seven-screen vertical scroll into one gesture.

**States:** `EmptyState` at `:115-135`, including the distinct `mineOnly` copy — **already
right, no change.** The per-column "No leads at this stage" suppression logic (`:245-254`)
is genuinely well-reasoned in its own comment — **no change.** `moveError` (`:145-149`)
renders below the stat row, far from the card that failed — move it adjacent to the card, or
make it a transient inline state on the card itself.

**Components:** reuses `ScoreBadge`, `StatCard`, `EmptyState`. Drops `PipelineSnapshot` from
this screen (it stays available for `/analytics`).

---

## 6. `/workflows`

**The one job:** define a follow-up plan once, and know exactly what it will send.
**Who's on it:** the owner, at a desk, once — this is a setup screen, not a daily one. It is
the one ICP screen where a longer read is acceptable.

**Hierarchy:** 1. the plans that exist. 2. the guarantee (it stops when they reply).
3. creating one. 4. per-step detail.

**What's wrong:**
- `workflows/page.tsx:132` — a **`Sparkles` icon**. [[rejected#^S-13|S-13]] names sparkle
  icons specifically. It isn't labelled AI here, but it is the exact motif the rejection
  exists to keep out, and it sits on a button whose action is "load a template."
- `workflows/page.tsx:132` — "cadence" is jargon, on a page whose `h1` (`:114`), button
  (`:142`) and empty state (`:182`) all say **plan**. `brand-principles.md` 4 bans exactly
  this word.
- `workflows/page.tsx:114-122` — three paragraphs before any content. The third
  (`:118-121`) is the **stop-on-reply guarantee** — the single most trust-bearing sentence
  in the product (Rule 3 in `PRODUCT_DIRECTION.md`) — set as the third paragraph of body
  copy in `--ink-soft`.
- `workflows/page.tsx:308-331` — each step is a numbered circle plus a run-on sentence that
  includes the entire channel-fallback rule ("falls back to text if the lead has no email,
  or hasn't replied to an earlier email step and has a phone on file"). Three lines per
  step, four steps, repeated per plan.
- `workflows/page.tsx:318` vs `:158` — **two mental models on one screen.** The card says
  "3d after enrollment / 4d later" (gaps); the intro says "(day 3, 7, 14, 30)" (cumulative).
- `workflows/page.tsx:312` — `text-[11px]`. S-11.

**What changes:**
| Change | Serves |
|---|---|
| **Drop the `Sparkles` icon**; button reads "Use our recommended plan" | S-13; principle 4 (no "cadence") |
| The guarantee gets **its own box** above the plan list — one line, `--sage` rail, stated once, removed from the header prose | Rule 3 ("ship trust like a feature"); principle 2 (stated once, where it's relevant) |
| Step line becomes **"Day 3 · Email"** + the hint quoted beneath. Cumulative days, matching how a person thinks about a plan. The channel-fallback rule is stated **once** below the list, not per step | Principle 4; tight |
| Step number to 12px | S-11 |
| Plan cards already are boxes (`:262`) — add shadow, drop border | Calibration |

**Layout, desktop:** header + one primary / guarantee box / stack of plan boxes.
**Layout, 390px:** the two header buttons (`:124-145`) stack full-width; with the shortened
step lines the cards stop wrapping into eight-line blocks.

**States:** empty state (`:179-184`) is good — **no change** beyond box treatment. `error`
renders at `:148-152` above everything, detached from the card that failed — same fix as
pipeline's `moveError`. No loading state before `loaded` flips (`:178`) — the page renders
an empty region for a beat; a single "Loading your plans…" line would close it.

**Components:** no new ones. `WorkflowCard` / `WorkflowEditor` stay local to this file.

---

## 7. `/analytics`

**The one job:** answer "is this thing working?" with a number the owner would repeat to
somebody else.
**Who's on it:** the owner, occasionally, usually when deciding whether to keep paying.

**Hierarchy:** 1. one headline figure. 2. money. 3. everything else, as reference.

**What's wrong:**
- `analytics/page.tsx:31-82` — **twelve `StatCard`s in one flat 4-column grid.** Twelve
  equal things is zero hierarchy. Six of the twelve are reply-rate variants.
- The page never states the product's own headline claim in its own terms. The closest
  thing to it — **median reply time** (`:48-53`), described in its own code comment as "the
  core 'how fast do we get leads to respond' number behind the product's whole pitch" — is
  tile eight of twelve, the same size as "Avg. deal value".
- `:116-120` — "N of M sent follow-ups have gotten a reply so far" is a 12px grey line under
  the grid, and it is the clearest sentence on the page.
- Three hues across twelve tiles with no rule about which gets which (sage for six of them,
  slate for four, none for two). Against the S-05 cap.

**What changes:**
| Change | Serves |
|---|---|
| **Three tiers, replacing the flat grid.** (1) **One headline box**: median reply time, large, with the sentence that makes it mean something. (2) **Three money boxes**: revenue won, avg deal value, conversion rate. (3) **The remaining eight as a two-column reference list** — label left, figure right, hairline rows, no boxes | Principle 8; S-06 |
| The `:116-120` sentence moves up into the headline box | It is already the best copy on the page |
| Colour: headline box `--sage` rail only if the number is genuinely good; money tier `--ink` throughout (A-005); reference list uncoloured | S-05 caps (a) and (c) |

**A stated exception to the founder's boxed preference.** The eight secondary stats become a
list, not boxes. **Boxes are for items you act on; a reference table of numbers you glance at
is a table.** Twelve boxes on one screen is where "each item in its own box" stops helping
and becomes the clutter S-06 rules out. This is the one place in this plan that deliberately
does not apply a measured preference, and it is **open question 8** rather than a decision —
he should overrule me if he disagrees, but not by accident.

**Layout, desktop:** headline box full-width / 3 money boxes / 2-column reference list /
charts / team section.
**Layout, 390px:** headline box / money boxes 1-up / reference list 1-column. Today this
screen is six rows of 2-up tiles before a chart.

**States:** the `data.totalLeads === 0` `EmptyState` (`:93-108`) is good — **no change.**
`:126-134` gating team performance on `teamBreakdown.length > 1` is correct — **no change.**
`:28` "Sign in to view analytics." is a bare unstyled paragraph on an otherwise-empty page,
which should never render (the layout redirects first) — dead code worth deleting.
`AnalyticsCharts` was not read in depth; **charts are out of scope for this pass** and need
their own review.

**Components:** reuses `StatCard` (tiers 1–2 only), `AnalyticsCharts`,
`TeamPerformanceSection`, `EmptyState`. New: a `FactList` (label/figure hairline rows) —
stated reason: no reference-table primitive exists, and three screens want one (here,
`/leads/[id]`'s Details, `/admin`).

---

## 8. `/activity`

**The one job:** prove what automation actually did, so the owner can trust it — or catch it.

This screen is closer to right than any other in the app, and its header copy (`:78-81`,
"Proof, not a promise") is the best writing in the product. **Most of it is no change.**

**Hierarchy:** 1. the events, newest first. 2. when. 3. what kind.

**What's wrong:**
- `activity/page.tsx:83-95` — one outer bordered card, `divide-y` rows, **plus a 32px
  coloured icon circle per row** (`:42-47`). Four icon circles in four colours on one
  screen is the closest thing in the app to [[rejected#^S-05|S-05]], and the icon is the
  decorative half of a signal the rail and the sentence both already carry.
- `activity/page.tsx:19` — `automated_send` uses **`--rust`**, which is the accent blue, as
  a *status* colour. So "FollowUp sent this" and the sidebar's "you are here" are rendered
  in the same colour. That is precisely what "accent blue held back" forbids.
- No day grouping. Sixty events (`activity.ts:33`, `LIMIT = 60`) in one undifferentiated
  stream is hard to place in time.
- No indication that the feed is capped at 60 — it simply stops.

**What changes:**
| Change | Serves |
|---|---|
| Each event becomes an **item box** with a 3px rail; **the icon circle goes** | Calibration (boxed); S-05 cap (a) |
| **Recolour:** `automated_send` → `--slate` (routine, it happened); `sequence_paused` → `--sage` (**the guarantee firing — the best event on this page**); `rapid_engagement` → `--coral` (needs you now); `sequence_completed` → `--slate`. Two hues plus ink | Accent held back; S-05 cap (c); Rule 3 |
| **Day headers** — mono, uppercase, on the paper, outside the boxes: "Today", "Yesterday", then dates | Principle 5 |
| One line at the end: "Showing the last 60 events." | Principle 1 — never imply completeness the app doesn't have |

**Layout:** single column at both widths, unchanged. **No change to the container width or
the header.**

**States:** the empty state (`:84-88`) is a bare centred `<p>` rather than the shared
`EmptyState`, but its copy — "Nothing here yet — this fills in as automation actually does
something" — is better than the component's usual tone. Keep the words; move them into the
component (§12.5). No error state; a failed `getActivityFeed` renders as "nothing happened,"
which on *this* screen specifically is a trust problem, not a cosmetic one. Flagged.

---

## 9. `/settings`

**The one job:** connect a channel, or change one rule, and leave.
**Who's on it:** the owner, deliberately, usually once per task, often from a desktop.

**Hierarchy:** 1. the tab they came for. 2. the section. 3. the control.

**What's wrong:**
- 1,317 lines, 14 sections, 5 tabs (`:33-39`, `:596-614`). The structure is sound; the
  presentation is one long document — `space-y-10` (`:590`, `:616`) between `h2`s with no
  surfaces at all.
- **`settings/page.tsx:597` — a real layout defect.** The tab bar is `sticky top-0`, but the
  app shell renders a `fixed top-0` mobile header (`Sidebar.tsx:46`, ≈56px tall) and pads
  content with `pt-20` (`(app)/layout.tsx:19`). On a phone the sticky tab bar sticks
  *underneath* the fixed header — it slides behind it. Needs a breakpoint-aware offset.
- **`settings/page.tsx:678` — a live [[approved#^A-005|A-005]] violation still shipping.**
  "Scan spam for missed leads" is a `--gold-soft` / `--gold` filled button. A-005 reserves
  `--gold` for "going cold" alone.
- `settings/page.tsx:633`, `:663`, `:668`, `:672` — `ml-[52px]` hardcoded at four call sites
  to align sub-controls with an `IntegrationRow`'s icon. A magic number replicated four
  times will diverge.
- `settings/page.tsx:672` — a `rounded-lg border` box nested inside an already-indented
  section. S-09.
- `settings/page.tsx:638`, `:654` — status colours (`--slate-soft`/`--slate`) used as
  *button fills*. Status colours encode lead state; a button is an action. Two meanings on
  one token.
- **"Scan spam for missed leads"** is among the most thesis-aligned features in the whole
  product — leads buried in spam is the first pillar of the pitch — and it is a gold button
  indented 52px, three screens down, inside the Gmail sub-block.
- At 390px, five tabs at `px-3.5` with `gap-1` (`:604`) totals right at 380px. It will
  overflow on the narrowest common phone.

**What changes:**
| Change | Serves |
|---|---|
| Each section becomes **one box**; its label sits outside it, mono uppercase; sections stack at 12px gaps rather than 40px | Calibration (boxed, tight) |
| Tab bar offset fixed: `top-[56px] lg:top-0`; tabs scroll horizontally at 390px | The defect above |
| "Scan spam" button: `--gold` → `--ink` outline; **promoted out of the Gmail sub-block to its own row under Integrations** | A-005; the feature's actual weight in the pitch |
| `ml-[52px]` replaced by a `children` slot on `IntegrationRow` | One source of truth |
| The nested box at `:672` unwrapped | S-09 |
| Sub-control buttons move off status tokens to ink/outline | A token means one thing |

**Layout, desktop:** `h1` + subtitle / sticky tab bar / boxed sections.
**Layout, 390px:** same, with a scrolling tab bar and full-width boxes.

**States:** loading is handled per-integration (`gmailStatusLoaded`, `:629`) — good, no
change. Errors are per-control and inline — good. There is no "you have unsaved changes"
state anywhere; most controls save on interaction, so this is consistent. **No change.**

**Components:** reuses `TwilioConfig`, `InstagramConfig`, `FacebookConfig`, `CrmConfig`,
`OutboundWebhookConfig`, `BookingCalendarConfig`, `CopyEmbedSnippet`, `CopyWebhookUrl`,
`TeamSection`, `SourceRoutingSection`, `DataPrivacySection`, `FilteredEmails`. No new ones
beyond the shared box.

---

## 10. `/onboarding`

**The one job:** get Gmail connected. Everything else on this screen is secondary to that.

**Hierarchy:** 1. connect Gmail. 2. what happens next. 3. business name. 4. everything else.

**What's already right — no change:**
- `OnboardingForm.tsx:142-143` — `min-h-screen` centred `max-w-sm`, no sidebar. Correct
  shape for a linear flow.
- `OnboardingForm.tsx:284-290` — **"Connect Gmail" is the only `--rust` (accent blue) filled
  button in the flow**, while `:214` and `:258` are `--ink`. That is a textbook held-back
  accent: the single most important action in the product gets the colour, once. This is the
  best existing example of the calibration's sixth preference already shipping. **No change,
  and it is the reference for the rule.**
- `:222-252` — the connected state, including the live auto-sync status line. Good. No change.

**What's wrong:**
- `OnboardingForm.tsx:145`, `:152`, `:155` — the Compass logo and **both** progress pips are
  `--rust`. Three blue marks on a screen whose one blue moment is the Connect button.
- **Step 1 asks three questions before the one that matters** (`:162-218`): business name,
  industry, team size. Name feeds drafts. Industry and team size feed nothing the owner ever
  sees. Two fields of friction ahead of the action the whole flow exists for
  (`brand-principles.md` 4). **Note the constraint before acting:** `onboarding/page.tsx:29-31`
  uses the presence of `industry` as the `step1Done` sentinel, so making it optional breaks
  resume-after-OAuth. Any change here needs that sentinel replaced first.
- **Nothing on this screen tells the owner what FollowUp will start doing on their behalf.**
  Follow-up is on by default (`PRODUCT_DIRECTION.md`, "Follow-up is on by default"), and the
  owner finds this out after the fact. `brand-principles.md` 1 — "no hidden automation, no
  'we sent 47 messages' surprises" — is not currently satisfied by this flow.

**What changes:**
| Change | Serves |
|---|---|
| Logo to `--ink`; pips to `--ink` / `--line` | Accent held back; the Connect button keeps the only blue |
| **One line on the connected step** stating the default the business is now on, with the guarantee attached | Principle 1; Rule 3 |
| Industry/team size: either optional, or moved after Gmail | Principle 4 |

**The default line is not written here on purpose.** `PRODUCT_DIRECTION.md` (2026-09-06) says
new leads start **Assisted**, approval-first. More recent product framing says autonomous send
for low-risk replies is now the default with a consent record. Those are different sentences
to an owner, and only one is true. **Open question 4** — this is copy that carries UX weight
and it must be verified against the shipped default before it is written, not guessed at.

**Layout:** `max-w-sm` centred at both widths. **No change.**
**States:** error (`:278-282`), saving (`:216`), syncing (`:244-247`), finishing (`:260`) all
present and well-handled. Missing: "you connected a different Google account than you signed
in with." Low frequency; noted, not scheduled.

---

## 11. `/signin`

**The one job:** one tap to Google.

**This screen is already the design system the founder just voted for.**
`SignInClient.tsx:99-101` is a borderless `--card` box, `rounded-2xl`, on the landing
background, with a real shadow and a hairline drawn *by* the shadow's second layer rather
than by a border. Soft corners, real shadow, boxed, and exactly one accent moment (none —
the Google button is correctly white per Google's brand rules).

**→ Its shadow value is proposed as the source of the app-wide box token.** See §12.1 and
open question 2.

**What's wrong:** one thing only.
- `SignInClient.tsx:103-105` — "Welcome back" / "Sign in to see your real leads and
  follow-ups." The landing page's "Get started" lands first-time visitors here too, so
  roughly half the traffic is greeted as a returning user on their first ever visit.
  → **"Sign in to FollowUp"**, with the subtitle unchanged.

**Layout:** `max-w-sm`, centred. No change at either width.
**States:** `redirecting` (`:120`), `AccessDenied` (`:126-130`), generic error (`:131-136`),
and the silent single auto-retry (`:46-80`) are all present and unusually well-reasoned.
**No change.**

---

## 12. `/admin` and `/admin/office`

**The one job:** the founder's own instrument panel.
**Who's on it:** an audience of exactly one, at a desk, by choice.

**This is the one place in the app where different rules are correct, and saying so
protects the rest of the system from being loosened by analogy.** The ICP constraints —
90 seconds, a phone, not a software person — do not apply here. Density can go further,
a real data table is the right answer, and jargon is fine. Nothing learned on these two
screens should be carried back into the seven ICP screens.

**Already right — no change:**
- `admin/layout.tsx` — deliberately outside `(app)`, no sidebar, `max-w-6xl`, with the
  reasoning documented in the file. Correct.
- `admin/page.tsx:57-94` — a real header-row data grid. It is the only proper table in the
  app and it should stay one; it should not become boxes.
- `admin/page.tsx:28-31` — the link to `/admin/office` in `--rust`, directly under the `h1`.
  One accent moment on the page, on the page's one navigation. Correct.
- `admin/page.tsx:40-44` and `admin/office/page.tsx:196-199` — both pages explain how their
  own numbers are computed, in plain language, under the numbers. That is
  `brand-principles.md` 6 done properly, and it is better here than on any ICP screen.

**What's wrong:**
- `admin/office/page.tsx:64`, `admin/page.tsx` stat row — `rounded-xl border bg-card p-5`;
  same border-not-shadow treatment as everywhere else.
- `admin/page.tsx:60`, `:72` — the seven-token grid template is duplicated as a literal
  string in the header and the row. It will diverge.
- `admin/office/page.tsx:148` — "Read the note" `<summary>` in `--rust`, inside a box that
  already sits below a blue page link. Two blue moments. Low priority.
- Neither admin page links back to the app. A founder who lands on `/admin` has to edit the
  URL.

**What changes:** box treatment (shadow, no border) on the desk cards and stat cards; the
grid template extracted to one constant; a "← Back to FollowUp" link in the admin header.
Nothing else. **This is last in the order and should stay cheap.**

**Layout:** `max-w-6xl` at desktop. At 390px both pages are usable but were not designed for
it, and that is acceptable for an audience of one. **No mobile work scheduled.**

---

## 13. Across the app — what should be consistent and currently isn't

1. **Page headers — five different shapes ship.** `h1` + subtitle (`analytics:86-87`,
   `activity:77-81`); `h1` + subtitle + right actions (`leads:133-163`,
   `pipeline:83-101`, `workflows:112-146`); `h1` inside an aurora box (`dashboard:77-88`);
   `h1` + subtitle + sticky tabs (`settings:591-614`); back-link + `h1`
   (`admin/office:168-177`).
   → **One `PageHeader`**: optional back link, `h1` (`font-display text-3xl`), **one**
   subtitle line, right-aligned actions with **at most one filled primary**. New component;
   stated reason: five variants of one thing is the definition of an unresolved pattern.

2. **Row anatomy — six different shapes ship** for what is conceptually the same object:
   `dashboard:169-188` (at-risk), `dashboard:204-216` (rescued), `leads:284-314`,
   `activity:41-56`, `admin/office:130-157`, `admin:70-91`.
   → **One `ItemBox`** per §0.2: rail, line 1 (title + right figure), line 2 (one fact),
   optional chevron. New component; this is the plan's central primitive.

3. **List containers.** `rounded-xl border border-line bg-card divide-y divide-line` at six
   call sites (§0.2). → Replaced by boxes-on-paper. **Highest-leverage single change.**

4. **Naming — four collisions, all live:**
   - `/dashboard` route / **"Today"** nav label (`Sidebar.tsx:23`) / a greeting as `h1`.
   - `/workflows` route / **"Follow-up plans"** `h1` (`workflows:114`) / **"sequences"** API
     (`/api/sequences`) / **"cadence"** button (`workflows:132`) / **"plan"**
     (`LeadWorkflowEnrollment`'s "Put on plan").
   - Lead urgency: a **score** number (`ScoreBadge`), a **rescue score** pill
     (`dashboard:180-186`), a **priority** pill (`PriorityPill`), and **"Worth chasing"** in
     a tooltip (`ScoreBadge.tsx:31`). Four names, three of them visible at once on `/leads`.
   - `--rust` is the token name and `#2a5cdb` is its value (`globals.css:41`). Every future
     session will misread it.
   → One vocabulary, written down in `design-brain/brand/`. The token rename is mechanical
   and belongs in step 0.

5. **Empty states — two systems.** The `EmptyState` component (`leads:320`, `pipeline:116`,
   `analytics:94`) and four ad-hoc centred paragraphs (`activity:85`, `office:214`,
   `workflows:179`, `dashboard:103`). Two of the ad-hoc ones are *better written* than the
   component's usual output.
   → One component with a **`tone`**: `"nothing-yet"` vs `"all-clear"`. **The app currently
   cannot express the difference anywhere**, which is a principle-2 gap, not a tidiness one.

6. **Action placement.** Top-right on `/leads`, `/pipeline`, `/workflows`; inline on
   `/dashboard`; bottom on `/onboarding`. Top-right is right — but at 390px it wraps and
   consumes the first screen on all three.
   → Top-right at `sm`+; **full-width below the header at 390px**; one filled primary.

7. **Status colour vs. accent colour.** `activity:19` uses the accent as a status; `settings:638`,
   `:654` use statuses as button fills; `settings:678` uses `--gold` against A-005.
   → **Status tokens encode lead/event state only. The accent encodes interactive/selected
   only. Neither crosses.**

8. **Sub-12px text:** `pipeline:235` (`text-[10px]`), `workflows:312` (`text-[11px]`). S-11.

9. **Inline error placement.** `pipeline:145-149` and `workflows:148-152` both render a
   failure message at page level, detached from the control that failed.
   → Errors render adjacent to their cause.

---

## 14. Recommended implementation order

Cheapest high-impact first, and sequenced so the dashboard is assembled from parts the
founder has already seen working rather than proposed as a fifth concept.

**Step 0 — tokens and defects. No visible redesign.**
Add the box radius/shadow tokens (sourced from `SignInClient.tsx:101`); alias `--rust` →
`--accent`; fix the two sub-12px sites; fix the settings sticky-tab offset; fix the `--gold`
button per A-005; extract the duplicated admin grid template. Half a day, zero design risk,
unblocks everything after it.

**Step 1 — build `ItemBox` + `PageHeader`, and prove them on `/activity`.**
`/activity` is the lowest-risk screen in the app: one list, one row type, no actions inside
rows, and no prior founder review to overturn. It is the honest place to see tight + boxed +
colour-coded + blue-held-back at real density before anything high-traffic moves.

**Step 2 — `/leads`.**
Highest-traffic list, and the screen where the row redesign pays for itself most obviously —
it puts priority, staleness and automation state back onto the phone view, where they are
currently all hidden.

**Step 3 — `/dashboard`.**
Only now, and only if open question 1 comes back yes. By this point every element on it
(`PageHeader`, `ItemBox`, the all-clear state, the recoloured stat card) exists and has been
seen in context.

**Step 4 — `/leads/[id]`.** Reasoning under the name, composer above the conversation,
un-nest the aside.
**Step 5 — `/pipeline`.** Horizontal scroller, drop the duplicate chart, fix the card.
**Step 6 — `/workflows`.** Sparkle out, guarantee into its own box, step lines shortened.
**Step 7 — `/analytics`.** The three-tier restructure. Last of the daily screens because it
is the least-opened.
**Step 8 — `/settings`.** Large but mechanical once the box primitive exists.
**Step 9 — `/onboarding` and `/signin`.** Small; mostly already right.
**Step 10 — `/admin` + `/admin/office`.** Audience of one. Keep it cheap.

---

## 15. Open questions for Sahil — flag, don't decide

**Design-system questions:**

1. **Does the six-pair calibration count as the founder-chosen reference?**
   `rejected.md`'s standing note says not to open a fifth dashboard concept without one.
   The calibration is *his* measured data rather than Claude's hypothesis, which is the
   spirit of that note — but it is not an external product or screenshot, which is its
   letter. **This gates step 3.**

2. **`[TO DECIDE]` — the box shadow and radius.** Proposing `SignInClient.tsx:101`'s shipped
   values as the app-wide token, stepped down for list density. Needs a yes; these tokens
   are deliberately open and are not Claude's to finalise.

3. **`[TO DECIDE]` — how far "held back" goes.** One accent moment per **screen**, or per
   **region**? This plan assumes per screen, plus the sidebar's "you are here" as chrome. It
   determines whether the Compass logo stays blue in the sidebar and in onboarding.

4. **`[TO DECIDE]` — the reference-list exception on `/analytics`.** Eight secondary stats as
   a hairline list rather than boxes. The one place this plan deliberately overrides a
   measured preference; he should overrule it knowingly if he wants to.

**Product-behaviour questions — `PRODUCT_DIRECTION.md` territory, needing explicit sign-off:**

5. **What is the actual shipped default for a new lead?** `PRODUCT_DIRECTION.md` (2026-09-06)
   says Assisted / approval-first. More recent framing says autonomous send for low-risk
   replies is now default with a consent record. The onboarding line in §10 is only honest
   once this is settled, and it is the sentence that decides whether principle 1's "no
   hidden automation" is satisfied at signup.

6. **Should `/leads` default-sort by "waiting longest" instead of by score?**
   `LeadsPageClient.tsx:124` sorts by score; `:136` calls it "follow-up priority." The
   product's own thesis is time-to-response, not intent ranking.

7. **Should the `mailto:` button on `/leads/[id]` (`:48-52`) exist?** It routes a reply
   outside FollowUp — no record, no audit trail, no scoring input. That is a hole in Rule 2
   ("own the data, don't just view it"). Keep, demote to a text link, or remove.

8. **Mobile navigation: bottom tab bar, or keep the hamburger drawer?** A phone-first ICP
   argues for the tab bar; it is a real structural addition, not a tidy-up.

9. **Do `/admin` and `/admin/office` get their own looser rules?** §12 assumes yes — an
   audience of one, at a desk. Worth confirming so nobody later "fixes" them into
   consistency with the ICP screens.

---

## 16. Self-critique — `design-review.md`, the honest part

- **The weakest claim in this document is that tight + boxed + colour-coded will not read as
  busy at real data volume.** A dashboard with 12 held drafts and 8 at-risk leads is 20
  shadowed boxes on one scroll. The caps in §0.3 are rules, not proof. Step 1 exists
  specifically to find out on a screen where being wrong is cheap — but if `/activity` at 60
  events looks heavy, the whole system needs the gap and shadow dialled back before step 2,
  and that should be treated as a real possibility rather than a formality.
- **Shadows cost more than borders.** Twenty boxes with two-layer shadows is measurably more
  paint work than one bordered container with hairline dividers, and low-end Android is the
  ICP's likely device. Not measured. Should be, at step 1.
- **Dropping the score from the `/leads` row and the dashboard's at-risk list trades away the
  owner's ability to compare two leads at a glance.** `ScoreBadge.tsx:9-13` argues, with a
  research citation, that the number is genuinely useful for exactly that. "Waiting 26h ·
  high priority" carries the reason but not the weighting. This is a real trade, not a free
  win — the same trade D-022 flagged in its own self-critique and did not resolve.
- **§13's `PageHeader` and `ItemBox` are two new components in a plan that otherwise argues
  for reuse.** The justification is genuine (five and six variants respectively), but two new
  primitives is the largest new-pattern budget in this document and should not grow.
- **`/analytics` is the screen this plan thought about least**, and `AnalyticsCharts` was not
  read in depth. The three-tier restructure is a hierarchy argument, not a considered chart
  design. It is correctly last, and it will need its own pass.
- **Every "what's wrong" here is from reading code, not from watching the founder use the
  app.** Six of the nine consistency findings are inconsistencies the founder may never have
  noticed or minded. The A/B calibration is the only real preference data in this document;
  everything built on principles rather than on that table is Claude's judgment and should
  be read as such.
