# Approved decisions

**What the founder has said yes to.** Claude follows these. Deviating from an entry here
requires asking first — consistency with an approved decision beats a new better idea,
because the founder's time is the scarce resource, not ideas.

## How to add an entry

Append to the end. Never rewrite history. Use this shape:

```
## A-00N — [Short title]
**Date:** YYYY-MM-DD
**Scope:** [screen / component / system-wide]
**Approved:** [exactly what was approved — specific enough to reproduce]
**Why it was liked:** [the founder's words if given; your inference marked as inference]
**The generalizable principle:** [what this implies for future, unrelated designs]
**Applies to:** [where this constrains future work]
**Evidence:** [file path, screenshot, PR, or conversation date]
```

**The field that matters most is "the generalizable principle."** "The founder liked the
lead card" helps nothing. "The founder liked that the reason for the score sat directly
under the score, in plain language, without a tooltip" shapes twenty future screens.

## Rules

1. **Record it in the session it happens.** Feedback not written down is feedback lost.
2. **Record specifics, not vibes.** If you can't say what was approved precisely enough
   for another session to reproduce it, ask a clarifying question before writing.
3. **Mark inferences as inferences.** If the founder said "yes, that one" without a
   reason, write the reason as `INFERRED —` and be prepared to be wrong.
4. **Superseding, not deleting.** When a later decision overrides an earlier one, mark the
   old entry `SUPERSEDED (YYYY-MM-DD) → A-0NN` and leave it in place.
5. **An approval is scoped.** Approving a card layout on the dashboard doesn't approve it
   everywhere. Say what the scope is.

---

## Decisions

## A-001 — Split the accent into a fill token and a text token; darken the four status shades ^A-001
**Date:** 2026-09-12
**Scope:** System-wide — `followup/src/app/globals.css` and six call sites
**Approved:** The founder said "go" to the proposed contrast fixes. Two changes:
1. `--accent-text: #8a5a08` added as a **separate token for accent-colored text and
   functional icons**. `--rust` (`#e8a23a`) stays the fill/border/focus-ring/logo token.
   Six text call sites moved to the new token.
2. The four status shades darkened until each clears 4.5:1 on its own soft background:
   `--coral` `#dc2626`→`#ca2323`, `--gold` `#d97706`→`#a35904`,
   `--sage` `#16a34a`→`#117c38`, `--slate` `#64748b`→`#5f6e84`. Hues unchanged.
**Why it was liked:** Presented as measured WCAG AA failures rather than taste — the amber
accent read 2.17:1 as text (1.77:1 in the Sidebar chip), and all four status pills failed
at their 12px size, gold worst at 2.86:1.
**The generalizable principle:** **A fill color and a text color have opposite contrast
requirements, so one token cannot serve both.** Any light accent needs a darker sibling for
text, and any "soft tint + saturated text" pill pattern must be measured at the size it
actually renders — 12px counts as normal text and needs 4.5:1, not the 3:1 that "large
text" allows. Eyeballing low-saturation pairs reliably fails.
**Applies to:** Every future use of an accent or status color. Never use `--rust` as text.
Never introduce a soft/saturated pair without measuring it.
**Evidence:** `design-brain/[[color-system]]` (full audit table), [[design-decisions#^D-005|D-005]] below.

---

## A-002 — Unify the whole app on the "Award Direction" navy/blue system ^A-002
**Date:** 2026-09-13
**Scope:** System-wide — every authenticated-app page, `/signin`, and the landing page all
converge on one visual system (navy `#0b1f33` / blue `#2a5cdb`, Bricolage Grotesque + Public
Sans + IBM Plex Mono — currently `landing-award.module.css`, to be promoted into
`globals.css` as the app-wide baseline). Retires the warm-cream/amber system entirely.
**Approved:** Given a direct choice between reskinning the app to match the landing page's
navy/blue direction, or reverting the landing page back to the app's existing cream/amber,
the founder chose to move the app: "Reskin the app to navy/blue."
**Why it was liked:** The founder's own framing was that the landing page ("our landing
page is cool") should be the standard the rest of the product is judged against, not the
other way around — the internal app pages read as dated *by comparison* to it.
**The generalizable principle:** When a page-scoped design experiment reads as better than
the system it deliberately diverged from, that's a real signal the system should move, not
a violation to correct by reverting the experiment. Don't assume the older, more broadly
shipped system is the anchor by default.
**Applies to:** Supersedes [[approved#^A-001|A-001]]'s cream/amber baseline (the underlying contrast-fixing
*principle* in [[approved#^A-001|A-001]] still applies, just against the new navy/blue values — see [[design-decisions#^D-010|D-010]]).
Every future screen designs against Award Direction's tokens, not `globals.css`'s retired
cream ones.
**Evidence:** This conversation, 2026-09-13. See `[[design-decisions]]` [[design-decisions#^D-010|D-010]] for the full
reasoning and implementation plan.

---

*Note: the cream/amber UI documented in `[[color-system]]` and
`[[visual-direction]]` as of 2026-09-12 is now SUPERSEDED by [[approved#^A-002|A-002]] above — those files
need updating to describe Award Direction's navy/blue values as the real baseline once the
app-wide reskin ships. Until then, treat their "current values" sections as historical, not
current.*

---

## A-003 — `--ink` is the primary-button color inside the authenticated app; `--rust` stays reserved for accent roles and lead-facing pages ^A-003
**Date:** 2026-09-13
**Scope:** System-wide — `[[buttons]]`'s primary-button spec, plus the one shipped outlier
(`LeadWorkflowEnrollment`'s "Put on plan") fixed to match
**Approved:** The founder approved `[[design-decisions#^D-014|D-014]]`'s recommendation as
proposed: update the documented spec to match the shipped app (`--ink` fill for every
in-app primary button, `--rust` fill reserved for accent-only roles plus the public
booking page / embed widget / global error page) rather than reskinning 38 buttons to blue.
**Why it was liked:** Not recorded verbatim — approved via "approve both decisions" alongside
[[approved#^A-004|A-004]], without a stated reason beyond the write-up's own reasoning.
**The generalizable principle:** A fill color used on every button stops signaling
anything — reserving the one accent for genuinely interactive/selected states (nav, focus,
toggles) keeps it meaningful, and the operator's own tool can stay calm/near-monochrome while
a lead-facing surface still gets a touch of the brand color. The highest-trust action in the
product (`ApprovalQueue`'s "Approve & send") is correctly calm, not a marketing-style CTA.
**Applies to:** Every future primary button inside the authenticated app defaults to `--ink`;
`--rust` fill as a *primary* button is scoped to surfaces a business's own customer sees
directly, not the operator's dashboard.
**Evidence:** `[[design-decisions#^D-014|D-014]]` (full grep evidence and reasoning);
`[[buttons]]` updated to the two-row primary spec; `LeadWorkflowEnrollment.tsx`'s outlier
fixed from `--rust` to `--ink`.

## A-004 — Keep `--gold` for "going cold"; reword its documented meaning, don't change its value ^A-004
**Date:** 2026-09-13
**Scope:** `[[color-system]]`'s `--gold` status color and its documented meaning
**Approved:** The founder approved `[[design-decisions#^D-015|D-015]]`'s recommendation as
proposed: keep `--gold` for the "going cold" lead-urgency pill rather than switching to
`--slate`, and reword `--gold`'s documented meaning to drop "Warming" (which literally
contradicted "going cold").
**Why it was liked:** Not recorded verbatim — approved alongside [[approved#^A-003|A-003]]
without a stated reason beyond the write-up's own reasoning.
**The generalizable principle:** The four status colors are a traffic-light *severity* ramp
(fine → caution → urgent), not a literal temperature or hue-matching scale — a color's
job is escalation, not thematic consistency with a label's literal wording. Don't
repurpose a color that's already meaningful elsewhere (here, `--slate` = "Total" in the same
stat row) just to resolve a surface-level wording coincidence.
**Applies to:** Any future status-color naming question — check what the color already means
elsewhere before reassigning it, and prefer a wording fix over a value change when the
underlying color choice is still correct.
**Evidence:** `[[design-decisions#^D-015|D-015]]` (full contrast measurements and reasoning);
`[[color-system]]`'s `--gold` row reworded from "Warming / warning / attention soon" to
"Caution / needs attention soon (traffic-light amber — a severity step, not a temperature)."

## A-005 — Stop using `--gold` for currency and for warning/error text; both get an existing, more-correct token instead ^A-005
**Date:** 2026-09-13
**Scope:** System-wide — 30 call sites across 15 files (dashboard, leads, leads detail,
pipeline, analytics, admin, settings, `TwilioConfig`, `TeamSection`, `FilteredEmails`,
`LeadAssignmentSelect`, `ApprovalQueue`, `SparkleBurst`)
**Approved:** The founder noticed the authenticated app "feels totally yellowish" against the
navy/blue landing page. Checked against the code first (colors/fonts were already unified —
`--gold` was the actual cause, at 5x the scope [[design-decisions#^D-016|D-016]] had found).
Approved the proposed fix as-is: currency figures move to plain `--ink` (money is information,
not an urgency signal); warning/error text moves to `--coral` (already documented as "needs
attention now / error" — the correct existing token for these sites, not a new one).
**Why it was liked:** The founder's own report was the trigger — "go ahead, proceed with your
recommendation" once the scope and fix were shown with the actual grep evidence.
**The generalizable principle:** A status color used consistently enough to look intentional
can still be wrong — consistency is not the same test as correctness. When a color shows up
everywhere on the highest-traffic screens, check whether it's actually carrying its documented
meaning at every site before assuming volume means the convention is fine. Reuse an existing,
correctly-meaning token before minting a new one — this fix needed zero new colors.
**Applies to:** Every current and future currency/deal-value display (`--ink`, never a status
color) and every warning/error message in the authenticated app (`--coral`, not `--gold`,
which stays reserved for "going cold" alone).
**Evidence:** `[[design-decisions#^D-017|D-017]]` (full 30-site breakdown by category);
implementation via `frontend-3d-agent`, PR pending.

## A-006 — The founder's A/B taste test is the design reference for the authenticated app ^A-006
**Date:** 2026-09-15
**Scope:** The authenticated app, system-wide — and, procedurally, it satisfies the gate
`rejected.md`'s standing note placed after four rejected dashboard concepts
**Approved:** Two things, in one answer.

*First, the calibration itself.* After D-020, D-021, D-022 and Queue Zero were all rejected,
the method changed: instead of proposing a whole concept, six paired A/B comparisons were
rendered with FollowUp's own components and tokens, one visual axis each, and the founder
picked between them with no explanation attached. His answers, `B A A - A B`:

| # | Axis | Chose | Reads as |
|---|---|---|---|
| 1 | Density — roomy vs tight | **B · Tight** | dense, more on screen |
| 2 | Edges — soft+shadow vs crisp+hairline | **A · Soft + shadow** | soft corners and real shadow |
| 3 | Colour — colour-coded vs near-monochrome | **A · Colour-coded** | status colour doing the work |
| 4 | Numbers — big display vs modest | **– · No preference** | not a live axis; don't design around it |
| 5 | Grouping — boxed vs lines only | **A · Each in a box** | everything in its own container |
| 6 | Accent blue — used freely vs held back | **B · Held back** | accent saved for one moment |

*Second, that these answers count as the founder-chosen reference* the standing note demanded.
Asked directly whether the taste test satisfied that gate, he said **"YES USE MY ANSWERS."**
The dashboard work is therefore unblocked, and it is to be assembled from these six answers —
not from a fifth hypothesis, and not from an external product's screenshot.

**Why it was liked:** Not stated, and deliberately not asked per-axis — the point of the
format was to get preference without argument. What *is* known is why the format worked: it
showed real FollowUp surfaces side by side, so each answer is a reaction to this product
rather than to a description of it. The four rejections were all reactions to a whole concept,
where a single wrong element sinks every other decision in the proposal.

**The generalizable principle:** two, and the second matters more than the first.

1. **Status colour does the work; brand blue stays quiet.** Axes 3 and 6 together are one
   instruction, not two — the screen is allowed to be colourful, but the colour must be
   *meaning* (coral/sage/gold/slate), and `--rust` (#2a5cdb) is spent once, on the single
   thing the owner should act on. Paired with axes 1, 2 and 5: dense, boxed, lifted —
   an opaque card with a real shadow and no border, carrying a status rail, sitting on
   `--paper`. This directly retires `rounded-xl border border-line bg-card divide-y` —
   flat edges plus bare hairline rows, which loses axes 2 and 5 at once.
2. **When whole-concept proposals keep failing, change the unit, not the concept.** Four
   rejections came from asking one big question repeatedly; six small forced choices with
   nothing riding on them produced more usable direction in one pass than all four concepts
   combined. Reach for the paired comparison whenever this founder's taste is the unknown.

**A hard constraint that travels with axis 3** — and the founder raised it himself, asking
"HOW WOULD I KNOW THIS COLOUR LANGUAGE": *"colour-coded" means colour makes the screen
scannable, never that colour carries the meaning alone.* Every coloured element names its
state in words in the same box — coral with "Needs you", gold with "Going cold — 6 days",
sage with "Replied", slate with "Waiting on them". Cover the colour and the screen still
reads; cover the word and it doesn't. That is the test. A colour legend, key, or any element
the owner must *learn* is forbidden — that is R-002's failure in new clothing, and this ICP
is an owner on a phone with ninety seconds, not someone who studies an interface.

**Applies to:** every authenticated screen. Concretely: the caps the layout plan derives from
it — one hue per box, a hue never without its word, at most three hues per screen, exactly one
box level anywhere (S-09), and any screen gaining density must lose elements to pay for it
(S-06). Also applies to the *procedure*: the standing note in `rejected.md` is satisfied by
this entry and no other; a future concept still needs a reference the founder chose.

**Evidence:** the taste test (`taste-test.html`, rendered with FollowUp's real tokens and
components); the founder's answers `B A A - A B`; his "YES USE MY ANSWERS" on 2026-09-15;
`[[design-decisions#^D-023|D-023]]` — the app-wide layout plan built on this calibration,
`design-brain/decisions/2026-09-15-app-layout-plan.md`.

## A-007 — "Not now" from a lead on Instagram or Messenger is respected: no day-2–7 draft ^A-007

**Approved:** 2026-09-18, founder, choosing "No draft, respect it" over "Still draft it".

**What was approved:** when a lead taps the exit reply button ("Not now" / "Leave it") on
an automatic DM, FollowUp writes nothing further — not the day-2–7 hand-off draft, not a
badge that says the lead is unanswered. Only the lead typing something later restarts the
sequence. This is the point where the reaction strategy (chips give the lead an honest way
out) and the rescue strategy (one more human-sent message might recover them) disagree,
and the founder ruled for the way out.

**Why it matters for design:** the exit button is only honest if tapping it ends things.
An owner-facing draft that appears anyway would make the button a trick, which is the
"spam tool" failure `CLAUDE.md` forbids. Copy on the approval card and in Settings may say
so plainly: "If they tap Not now, that's the end of it unless they write again."

**Evidence:** PR #258 (exit tap stops the unanswered rule and the badge), PR #259 (no
hand-off draft after an exit tap; mutation-tested), and the 2026-09-18 entry in
`[[design-decisions]]`.

## A-008 — Logo direction: the forward chevron ^A-008

**Approved:** 2026-09-18, founder, choosing the first of three arrow-based concepts ("1st is
better") over the reply turn and the return loop.

**What was approved:** the logo is built on a single forward chevron — one clean arrow, no
bend, no loop. Of the three, it is the simplest mark and the one that reads at favicon size;
it says "next step" rather than "we go back", which fits the product's promise (the follow-up
happens, the lead moves forward) better than either of the two that curve back on themselves.

**Not yet decided:** wordmark pairing, exact stroke weight, colour treatment on light and
dark grounds, and the app icon crop. Those are the next round, built on this direction only.

**Evidence:** the "FollowUp Logo Concepts" artifact (three directions), shown 2026-09-14 and
again 2026-09-18; the founder's pick; the 2026-09-18 entry in `[[design-decisions]]`.
