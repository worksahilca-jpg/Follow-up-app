# CRM and adjacent-category dashboard research — "what needs me right now"

**Source:** Multiple (see per-example citations below)
**Category:** dashboards
**Added:** 2026-09-13
**Added by:** Claude — research pass on dashboard/home-screen design for FollowUp
**Status:** REVIEWED — not yet walked through with the founder.
**Files:** link only (no screenshots — see sourcing note)

---

## Sourcing note — read before trusting any quote below

**WebFetch is blocked in this sandbox** (same confirmed block as the landing-page research
pass — tested against unrelated domains including Wikipedia). Everything below is a
**WebSearch snippet**, not a directly rendered screen. Authenticated app screens
(dashboards specifically) are also generally behind login even when WebFetch works, so
even a healthy sandbox would be relying on marketing-page screenshots, help-center
documentation, and independent design-review write-ups rather than a live login in most
cases. Quotes are marked **verbatim** or **paraphrase** as in the landing-page file. Where
a finding is corroborated by FollowUp's own prior research
(`followup/research/market/2026-09-06-realtor-tool-landscape.md` and related files), that
file is cited instead of re-deriving the same fact.

---

## Part A — "what needs my attention" vs. a generic table

### A1. HubSpot's own written design rule for its sales workspace

Already surfaced in the landing-page companion file, restated here because it's the single
most directly on-topic finding of the whole pass: HubSpot's own product documentation says
a rep's queue should be built so that **"each account should arrive with a reason it
deserves attention: a research-intent signal, a meaningful return visit, a high-fit account
that has gone untouched, or a score crossing a validated threshold,"** and that **"a rep
opening HubSpot should see a prioritized queue — not an alphabetical contact list or 47
overdue tasks."**
[HubSpot Knowledge Base](https://knowledge.hubspot.com/prospecting/review-sales-activity-in-the-sales-workspace),
accessed via WebSearch 2026-09-13.

**UX principle:** a queue is not a list. A list is sorted; a queue is *justified* — every
row should be able to answer "why am I looking at you, right now, before the others."
FollowUp's lead score already carries a reason (`scoreReason`/`scoreFactors` per
`PRODUCT_DIRECTION.md`) — this is external validation that the *mechanism* is right; the
open question is whether the *dashboard's visual hierarchy* actually leads with the reason
or just the score number.

**What FollowUp could learn:** the phrase "not an alphabetical contact list or 47 overdue
tasks" is a good gut-check to hold the FollowUp dashboard against — does today's leads/queue
view read as "a plan for the next 20 minutes" or "a pile you have to get through"?

**What FollowUp should NOT copy:** HubSpot's own breadth undermines this good design
intent in practice — the "overwhelming" complaint pattern documented in the landing-page
file exists *despite* this stated design philosophy, which is itself a lesson: writing the
right design principle down doesn't protect you from also shipping six other competing
surfaces that bury it. FollowUp's advantage is having only one job to organize a screen
around; don't dilute that by adding parallel top-level views "because a real CRM has them."

---

### A2. Linear's "Priority" inbox — a September 2026 feature built for exactly this problem

Linear shipped a dedicated **Priority tab** in its Inbox, launched 2026-09-03, with the
explicit stated purpose: **"separating what needs your attention from what can wait, so
something like a review blocking a release never gets buried."** The changelog is direct
about the failure mode it fixes: *"An active workspace can create a significant amount of
notifications each day, and until now your inbox treated them all the same."* Linear
selects what appears in Priority *by default*, with the option to customize by notification
source or a saved filter — and the old, undifferentiated inbox view still exists
side-by-side for anyone who wants it.
[Linear Changelog, 2026-09-03](https://linear.app/changelog/2026-09-03-priority-inbox),
accessed via WebSearch 2026-09-13.

**UX principle:** the fix for "everything looks equally important" is not better sorting —
it's a **second, smaller, separated view** that only contains the subset that's actually
urgent, with the full unfiltered view still one click away for anyone who wants to
audit everything. This is a materially different move from just adding a priority *column*
to one big list — Linear split the surface itself.

**Visual principle:** a good default (Linear picks what's in Priority automatically) beats
a powerful configuration option nobody sets up on day one. Customization exists, but isn't
required to get value immediately.

**Interaction principle:** the old, complete view isn't removed or demoted — it's kept as
an honest fallback, communicating "we're not hiding anything from you, we're choosing what
to show you first."

**Whose user is this?** Linear's user is a software engineer or PM, at a keyboard, in the
tool much of the working day, comfortable configuring filters. FollowUp's user is an owner
on a phone with 90 seconds, who will almost never build a custom filter. **The
generalizable lesson transfers; the expectation that the user will "customize by notification
source" does not** — FollowUp's version of this needs the automatic default to be right
essentially all the time, since there's no realistic path where the FollowUp user tunes it
by hand the way a Linear power user would.

**What FollowUp could learn:** FollowUp's dashboard already opens on "About to be lost"
per `PRODUCT_DIRECTION.md` — this is structurally the same move Linear just shipped
(a separated, small, default-curated "what needs you" surface distinct from the full lead
list). Worth treating this as validation that the existing architecture decision was
right, not a reason to change it, and a reminder to protect that separation as the product
grows rather than merge it back into one big table "for consistency."

**What FollowUp should NOT copy:** Linear's visual register (dark, dense, keyboard-first)
doesn't fit FollowUp's calm/warm/light brand — the *separation-of-surfaces* idea transfers,
the *density and chrome* should not.

---

### A3. Close CRM's Smart Views and the "lead rot" framing

Already covered in the landing-page file for its marketing language; the dashboard-relevant
part is the mechanism itself. Close's own documentation: **"Smart Views tell sales reps who
to follow up with and when to follow up without the need to create endless tasks and
reminders."** Leads move in and out of a Smart View automatically as their state changes —
the view is a live, saved query, not a manually maintained list. Close explicitly recommends
a Smart View for anything sitting untouched past a set number of days specifically **to
catch it before it "rots."**
[Close Help
Center](https://help.close.com/docs/smart-view-tips-and-suggestions), accessed via
WebSearch 2026-09-13.

**UX principle:** the dashboard's job is to make a *time-based* failure (a lead going
quiet) visible as a *state*, not something the rep has to remember to check for. A saved
filter that a human has to remember to open is a weaker version of the same idea FollowUp
already automates — the neglect trigger and rescue score do this without requiring the
owner to build or check a filter at all.

**What FollowUp could learn:** Close's naming convention (a Smart View literally titled
around the failure it prevents, e.g., "Interested >10 days, no contact") is a good model
for how FollowUp's own dashboard sections should be labeled — name the section after the
*risk being caught*, not a generic status ("About to be lost" already does this well; the
lesson is to keep every future section named the same way, not slide into generic labels
like "All leads" or "Recent").

**What FollowUp should NOT copy:** Close's version is opt-in and manual to set up — a rep
who never builds this Smart View gets no protection at all. FollowUp's advantage is that
this exists by default, for every business, without configuration — worth stating that
distinction confidently rather than underselling it as "just like Close's Smart Views."

---

### A4. Follow Up Boss — the closest adjacent CRM's actual dashboard shape, and a direct naming collision worth flagging

Follow Up Boss's own help documentation describes its dashboard philosophy directly:
**"The main dashboard is intuitive, presenting the most important information — Smart
Lists, tasks, and appointments — front and center, which helps agents start their day with
a clear plan of action."** [Follow Up Boss Help
Center](https://help.followupboss.com/hc/en-us/articles/4402128249367-Dashboard), accessed
via WebSearch 2026-09-13. Follow Up Boss also runs a **default Smart List named "Smart List
Zero,"** an explicit, named borrowing of the "Inbox Zero" concept applied to leads instead
of email — the practice being to "zero out" a Smart List daily by contacting every lead on
it, with completed contacts dropping off the list until they resurface.
[Follow Up Boss / Smart List
Zero](https://www.followupboss.com/integrations/smart-list-zero), accessed via WebSearch
2026-09-13.

**Naming collision worth flagging directly:** Follow Up Boss's own **"Lead Ponds"**
feature — *"a shared lead pool that agents claim... unclaimed leads route to a shared pool
agents can prospect from directly"* — is functionally the same mechanism as FollowUp's own
shipped **Ponds** feature (an unclaimed shared pool anyone can claim, per this agent's own
brief). [Follow Up Boss Help
Center](https://help.followupboss.com/hc/en-us/articles/360048829034-Lead-Ponds-Overview),
accessed via WebSearch 2026-09-13. This isn't a design lesson so much as a fact worth
surfacing plainly: FollowUp did not invent this mechanism or its name in isolation — the
category's most-cited incumbent already ships an almost identically-named feature doing
almost the identical job. That's not disqualifying (a shared-claim pool for unassigned
leads is a sound, well-tested pattern — this is corroborating evidence it works, not a
reason to abandon it), but any positioning copy calling FollowUp's Ponds novel or
unique should be checked against this before shipping, and it's worth a short note back
to whoever owns FollowUp's Ponds copy/naming.

**UX principle (Smart List Zero specifically):** borrowing a well-known productivity
metaphor ("zero") from a different context (email) to describe a lead-management practice
is an effective naming device — it imports an existing mental model instead of teaching a
new one. FollowUp's own dashboard could look for a similarly familiar metaphor rather than
inventing new vocabulary, while staying mindful of principle 4 (no jargon).

**What FollowUp should NOT copy:** Follow Up Boss's dashboard, per multiple independent
reviews summarized in `followup/research/market/2026-09-06-realtor-tool-landscape.md`,
sits inside a product most praised for support and market dominance (Zillow-owned, 41 of
top 50 teams) rather than for UI elegance specifically — no source in this pass or the
prior one described its visual design as calm or best-in-class, only its completeness and
reliability. Its Action Plans are separately noted (per this pass's search) as weaker than
dedicated tools for actual message design. Copy the *organizing principle* (Smart Lists as
live, self-maintaining queues), not an assumption that its visual execution is a model to
imitate.

---

### A5. Attio — density and inline data without becoming a spreadsheet

Independent review commentary describes Attio's approach as **"Notion met a CRM"** — list
views with instant filters and a Kanban pipeline layered on top of the same underlying
data, with the specific claim that this UX is *why reps actually keep the data updated*
(implicitly contrasting with CRMs where data rot happens because updating the record is
too much friction).
[MarketBetter Attio review](https://marketbetter.ai/blog/attio-crm-review-2026/), accessed
via WebSearch 2026-09-13. A separate design-pattern summary states Attio **"layers AI
summaries on top of inspectable data"** and that CRMs generally succeed by investing "in
density, inline edit, and keyboard support where users actually live"
(paraphrase of aggregated design-pattern commentary, accessed via WebSearch 2026-09-13).

**UX principle:** density is not automatically hostile — it becomes hostile when there's
no way to act inline (edit, filter, reassign) without leaving the row. A calm dashboard
isn't necessarily a sparse one; it's one where every visible piece of data has an obvious,
immediate action attached, so density reads as "capable" rather than "cluttered." This
directly matches the dashboards README's own standing test ("a number with no next step is
decoration").

**Whose user is this?** Attio's target user is a sales-led-growth team member, at a
desktop, doing bulk data hygiene — closer to a "software person" than FollowUp's owner-on-
a-phone. The inline-edit/keyboard-shortcut layer of this pattern likely over-serves
FollowUp's actual user; the underlying principle (never show a number without an attached
action) transfers regardless of device.

**What FollowUp should NOT copy:** Kanban-style pipeline views reward a user manually
dragging cards across stages all day — a mismatch for an owner who wants FollowUp to *do*
the stage-appropriate action, not hand them a board to maintain.

---

## Part B — information density and hierarchy for a prioritized queue

### B1. The "radical restraint" pattern named directly in current design commentary

A 2026 design-trend write-up on the "Linear aesthetic" describes the specific mechanism
behind why dense screens still read as calm in the best examples: **"radical restraint
involves near-monochrome surfaces, one accent color, and information density that never
feels crowded because everything non-essential is simply absent,"** and separately,
**"calm design is now a brand attribute, not just a style choice, and the best dashboards
earn trust through restraint, putting the user's 'north star metric' front and center."**
[Aggregated 2026 SaaS design-trend commentary, accessed via WebSearch 2026-09-13 —
paraphrase/close-quote from a roundup discussing the "Linear style" trend, not Linear's own
statement.]

**UX principle, stated precisely:** density and calm are not opposites — the thing that
makes a dense screen feel calm is that *everything present has a job*, and one accent color
is reserved for the thing that actually needs the eye first. A screen with six status
colors is not "more informative," it's six things competing for the same attention budget.
This directly reinforces FollowUp's own standing rejection S-05 ("overly colorful
dashboards... color must mean something") with independent, non-FollowUp evidence that the
same conclusion is an industry-wide observation in 2026, not an idiosyncratic house rule.

**What FollowUp could learn:** the "one north star metric front and center" framing is a
useful discipline question for FollowUp's own dashboard: if the dashboard could show
exactly one number before anything else, what is it? Given FollowUp's actual job, the
honest answer is almost certainly a count or a name tied to "About to be lost" — not a
vanity metric like total leads captured.

---

### B2. HubSpot's own "prioritized queue, not 47 overdue tasks" line (again, but as a density lesson specifically)

Worth re-reading the same HubSpot quote from Part A1 through a density lens: the failure
case it names isn't "too much data," it's **too many equally-weighted items with no
ranking** — 47 overdue tasks, alphabetical, is the same *amount* of information as a good
prioritized queue would show, laid out worse. This reinforces that FollowUp's density
problem to solve is ordering and grouping, not necessarily reducing total lead count shown.

---

## Part C — what makes a dashboard feel calm and trustworthy vs. overwhelming

### C1. Empty states — the day-one problem

Independent SaaS-pattern-cataloguing sites document Attio's onboarding and empty states as
a distinct, deliberately designed set of screens (multiple welcome/setup-wizard states
before any real data exists), rather than a single generic "no data yet" placeholder
reused everywhere. [SaaSUI pattern catalog — Attio onboarding and empty
states](https://www.saasui.design/pattern/onboarding/attio), accessed via WebSearch
2026-09-13. The specific copy/visual detail did not surface in this pass — flagged as an
open question rather than guessed at.

**UX principle (general, not Attio-specific):** an empty dashboard is not a failure state
to apologize for — the design-brain's own dashboards README already states this ("empty
screens are allowed to look calm rather than apologetic," per `brand-principles.md`
principle 2). The research in this pass didn't surface a counterexample worth citing, but
it also didn't surface a strong positive example beyond the general observation that
Attio treats it as deliberately designed rather than default/unstyled — worth treating as
a confirmed direction rather than a new finding.

### C2. Trust through restraint, corroborated from two independent directions

Two separate findings in this pass converge on the same conclusion from different angles:
(1) the design-commentary finding above ("calm design is now a brand attribute... the best
dashboards earn trust through restraint"), and (2) HubSpot's own complaint pattern
(Part A1 / landing-page file) where a platform with a stated "prioritized queue" design
philosophy still gets called "overwhelming" once real breadth is added on top. **Read
together: restraint has to be defended continuously, not just designed once** — HubSpot
presumably had a calm dashboard once too. FollowUp's structural advantage (one job, not a
platform) makes this easier to hold, but it's not automatic — every future feature added
to the dashboard is a small vote against the restraint that currently makes it trustworthy.

### C3. Trust objections specific to an AI system that can act on someone's behalf

Not newly researched this pass — already on file and directly relevant here:
`followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md` and the stats
already logged in `design-brain/brand/brand-principles.md` ("65.5% of owners fear AI makes
their business feel less authentic," "77% want human approval before an agent acts"). Worth
restating in this dashboard-specific context: a calm dashboard for FollowUp specifically
must show, without being asked, what was sent autonomously and what's waiting for approval
— not as a separate audit page but as a visible property of the main queue itself, since
the research says the fear is proactive ("what did it do without me"), not just reactive
("let me go check the log").

---

## Cross-cutting synthesis for FollowUp's dashboard

1. **The "second, smaller, separated surface" pattern (Linear's Priority tab; FollowUp's
   own existing "About to be lost" opening view) is validated, twice over now, as the
   right architecture** — not a full list with a sort option, a genuinely separate,
   pre-filtered, small view that's the *first* thing shown. This is confirmed as correct;
   the risk to guard against is dilution as more views get added later.
2. **Every dashboard number needs an attached action, or it's decoration** — corroborated
   independently by the dashboards README's own standing test, the Attio density
   commentary, and the HubSpot "a number with no next step" framing implicit in its own
   "reason it deserves attention" rule.
3. **Naming a section after the risk it catches, not a generic status, is a repeated
   pattern worth protecting** (Close's rot-focused Smart Views, FollowUp's own "About to
   be lost") — a good instinct already in place, worth applying consistently to any new
   section rather than drifting into generic labels.
4. **Density is not the enemy of calm; competing, unranked, undifferentiated items are.**
   The "radical restraint" framing (one accent color, everything present has a job) gives
   a concrete test for any future dashboard addition: does this need its own color? Its
   own icon? If not, it's probably diluting the thing that currently needs the eye first.
5. **A direct, actionable finding, not just a design principle:** FollowUp's Ponds feature
   shares its name and mechanism almost exactly with Follow Up Boss's "Lead Ponds" —
   worth a short note to whoever owns Ponds copy so positioning never implies it's a novel
   invention (per this agent's brief: "don't claim true skill-based routing exists" — this
   finding sharpens that caution further, since the *category itself* already has a
   well-known feature by nearly the same name doing a similar job).

---

**Status history:**
- 2026-09-13 — REVIEWED (added; cross-referenced against
  `followup/research/market/2026-09-06-realtor-tool-landscape.md` and
  `design-brain/brand/brand-principles.md` rather than re-deriving facts already on file)
