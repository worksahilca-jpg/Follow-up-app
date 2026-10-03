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
**SUPERSEDED (2026-09-19)** on colour and type by the charcoal monochrome system the founder approved for the landing page (A-011, A-012, A-015) and then asked to carry into the app ("let's change the whole app"). Its *principle* — the whole product converges on one system, and the landing page is the standard the app is judged against — is what drove the 2026-09-19 move too. See `design-decisions.md`, 2026-09-19, "stage one".
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

**SUPERSEDED (2026-09-18)** by the founder's logo brief (concepts #69/#71: an abstract F in two
forward-moving forms, no literal arrows, monochrome). See the 2026-09-18 logo entry in
`[[design-decisions]]`. Kept for the record; the "forward, nothing dropped" idea carries over.

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

## A-009 — The landing page as a black → grey → white → grey → black gradient, and the logo as concepts #69 / #71 ^A-009

**Approved:** 2026-09-18, founder: "this is sick, just I want the logo to be 69 and 71", on the
render of the page with the dark hero, the light middle and the dark close.

**What specifically was approved:**
- The page's ground moving through black, grey and white: dark hero with the white thread card
  floating on it, a fade to the light middle, a fade back to black for the CTA and footer.
- The thread-story hero (already the direction after R-005) on the dark ground.
- The logo: two leaves as drawn in #69 (favicon) and #71 (horizontal lockup) of the exploration
  sheet. Supersedes the F-with-a-stem build from the brief's text the same day. Geometry and
  ratios in `followup/public/brand/README.md`; decision entry in `[[design-decisions]]`.
  **Logo direction briefly superseded by [[approved#^A-061|A-061]], then reconfirmed by [[approved#^A-062|A-062]] (2026-09-27):
  the leaves stay.**

**Not covered:** the accent colour (still the placeholder indigo, unchosen); the app's restyle.

## A-010 — The faithful Scalable adaptation is the landing page direction ^A-010

**Approved:** 2026-09-18, founder, on the live preview of the fourth build: "this is close, let's
enhance this more." Supersedes A-009 (which R-008 had already closed).

**What specifically was approved:** the reference template reproduced as it is — near-black ground,
dark bordered cards, indigo accent, green badges, italic-serif emphasis word, its section order and
its hero dashboard card — with FollowUp's words, numbers and logo. The founder's word was "close",
not "done": enhancement inside this direction is wanted; a new direction is not.

**Standing exclusions still apply:** no invented testimonials, no fake logo strip, no "book a demo"
only, no annual pricing. The masonry of enforced rules and the channel strip are the honest stand-ins.

**Lesson (inferred, marked inferred):** for this founder, "make it look like X" means X, not a
designer's reading of X. Build the literal thing first; earn the divergence with his reaction.

**Amendment, later the same day:** the founder asked for the black → white gradient ground on
this build ("can we go with white black gradient"). Applied as a slow ramp across the Features
section with a light Pricing/FAQ/CTA/footer zone, never a hard edge (R-007). Details in
`[[design-decisions]]` 2026-09-18, "Enhancement pass". Not yet reacted to.

## A-011 — Black-and-white page with the lead-flow hero illustration ^A-011

**Approved:** 2026-09-18, founder, on the live preview: "this is good."

**What specifically was approved:** the monochrome system (no accent hue; white on black at the
top, black on white at the bottom, one slow ramp between them), the hero line "Never lose a
*lead.*", and the hero illustration of leads flowing from five channels through the FollowUp hub
into five warmed leads, with the dots on the wires and the warmth bars. This is the third
approval of the day and the first on the moving page rather than a still. Supersedes A-010's
indigo (the layout and section order from A-010 stand).

**Rule added in the same breath:** the page follows the device theme. Dark device: black top
fading to white. Light device: white top fading to black. "Vice versa", his words. Recorded in
`[[design-decisions]]` 2026-09-18, "Device theme".

## A-012 — The moving diagram as the hero, on charcoal ^A-012

**Approved:** 2026-09-18, founder, on the live preview: "this is sick."

**What specifically was approved:** the hero as title-and-punchline on top ("Never lose a lead /
*because nobody followed up.*") with the lead-flow diagram full width beneath it: five ways a
lead shows up on the left (icon tile, title, "via" line), FollowUp as an app tile in the middle,
five replies on the right as message cards with a time stamp, dots running the wires, on the
charcoal ground (`#1e1e20`). Supersedes A-011's black ground and its smaller, framed
diagram; the monochrome rule and the fixed first line stand.

**Asked for in the same breath:** "make this come in from everywhere", the entrance animation
recorded in `[[design-decisions]]` 2026-09-18, "From everywhere".

## A-013 — The headline: "Never lose a lead because you forgot to follow up." ^A-013

**Approved:** 2026-09-18, founder, choosing between three wordings. His own dictated line
from earlier in the day, over the README's "because nobody followed up" (which I had used
without asking) and a middle option ("because a message went unanswered").

**Why his wins, in his words and mine:** "forgot" is the word a real person uses for what
actually happens; "nobody" is safe but points at no one. It is said kindly and it is true.
Brand principle 9 in one sentence.

**Standing:** this is the fixed first line of the landing page. Sub-lines, buyer line and
lede are separate decisions (structure v1, questions 1 to 4).

## A-014 — The buyer line: "Only for owners who have leads and don't have time to reply." ^A-014

**Approved:** 2026-09-18, founder, from twelve options across three rounds. His brief, in his
words: "write something crazy like 'this is only for those who have leads', I want to poke the
owners." Chosen over a channel line ("for businesses whose customers write first on Instagram,
WhatsApp or email"), an industry list, and the sharper poke ("great at the work and terrible at
replying").

**What this settles:** the hero's second line is a wry, exclusive "only for…", not a category
description. The channels are shown by the diagram, not named in the line. Tone rule for
future copy in this spot: a poke is allowed when it is true, kind, and the reader would say it
about themselves.

## A-015 — The full page: hero, gap, why it exists, how it works, why not a reminder, product cards, four promises, works with, as it happens, features, prices, questions ^A-015
**SUPERSEDED (2026-09-26)** in its section order by [[approved#^A-023|A-023]] (nine sections).

**Approved:** 2026-09-19, founder: "cool, that's it." After "make it like this but with the
old version's information" and "more older ones": the settled hero (A-013, A-014, A-012's
diagram) on the plain-words page, with the information sections from the page on `main`
brought back in plain words: the gap (the owner's question), why FollowUp exists (tools that
get you leads vs FollowUp), how it works in four steps, why not just a reminder. Not brought
back: the three stats (dead per the 09-16 pass), the two B2B personas (contradict A-014), the
team-pipeline mock.

**Lesson (inferred, marked inferred):** "simple" to this founder means simple *words*, not
fewer sections. The three-steps page (v15/v16) was too bare; he wants a reader to see and
understand the whole product, in plain language. Structure v1's "six sections" finding is
superseded by this.

**Next, in his words:** "let's make it more effective, and let's change the whole app."

## A-016 — "Minimal structure, richer surface" — how the app is to be redesigned ^A-016

**Approved:** 2026-09-20, founder, choosing between three readings of his own brief.

His words that opened it: *"we have to work on our ui ux too we have to keep our app simple
understandable and it should be minimal too and organised accordingly"* — which reads as a
direct contradiction of [[rejected#^R-001|R-001]], where he rejected a dashboard redesign for
being exactly that (*"make it more creative and enhanced i mean its very basic"*). Asked which
held, he chose neither extreme:

> **Fewer things on screen and clearer organisation, but each screen still feels designed —
> depth, real typography, a considered layout — like the landing page. Not a plain admin list.**

**What this settles.** "Minimal" is about *how much is on the screen and how it is ordered* —
not about how much craft is in what remains. Remove the element that does not earn its place;
do not answer a redesign brief by removing chrome and stopping. R-001 is **not** superseded: it
still forbids subtraction as the whole answer, and this entry says what to put in its place.

**The test for a screen under this rule:** count of distinct things went down, *and* a reader
would call the result designed rather than plain. Failing either half fails the rule.

## A-017 — The embed widget's header belongs to the business, not to FollowUp ^A-017

**Approved:** 2026-09-20, founder, choosing "drop the mark, keep the business name."

The widget's header put FollowUp's mark — in a filled accent tile — directly beside the
business's own name, on a page embedded in that business's website and shown to that
business's customer. Two marks side by side is a co-brand nobody agreed to, and the one
wearing the tile was ours.

**What this settles.** On any surface a customer sees, the business is the brand and FollowUp
is the footnote. FollowUp is credited once, at the foot, as "Powered by FollowUp". This
applies to the booking page and any future customer-facing surface, not only the widget.

## A-018 — The radius ladder: 12 / 8 / full ^A-018

**Approved:** 2026-09-20, founder: *"approved, apply both ladders."*

Three values, nothing else. **12px** (`.box`) for any surface sitting on the page; **8px**
(`rounded-lg`) for anything inside one — buttons, inputs, list items, icon tiles;
**`full`** for pills, badges, avatars, toggles. Full detail in
[[surfaces#Border radius]], which this supersedes the `[TO DECIDE]` on.

`rounded-xl`, `rounded-2xl` and `rounded-md` were in use across thirteen files with
nothing distinguishing them. They are gone.

**One judgement recorded against this, honestly.** The only visible consequence is that
four large decorative icon tiles (empty state 64px, onboarding 56px, booking 56px) drop
from 16px to 8px. Rendered and inspected side by side: at that size 8px reads noticeably
squarer than 16px. It is defensible — it matches every other icon tile in the app, which
are already `rounded-lg` — but it is the one place where the ladder costs something rather
than only buying consistency. Shown to the founder with the render at the time of the
change. If he wants them back, the honest form is an explicit exception in
[[surfaces#Border radius]] for decorative tiles above ~48px, not a quiet fourth value.

## A-019 — The heading ladder: 3xl page / xl section / lg card ^A-019

**Approved:** 2026-09-20, founder: *"approved, apply both ladders."*

`font-display text-3xl` for the page title (one per screen, from `PageHeader`),
`text-xl` for a section of that screen, `text-lg` for a single box's own heading. Full
detail in [[typography#The heading ladder]].

**Correction to the claim that prompted this.** It was reported to the founder that
`text-xl` and `text-lg` were "both used for section titles". On a proper audit that was
too strong: the authenticated app was already using them correctly — sections at `xl`,
card titles at `lg`. The real violations were two, and narrower: `/pipeline` hand-rolled
its own page header instead of using `PageHeader` (the seventh screen to do so), and
Terms and Privacy set their top-level sections at `lg`, which made a legal page's
structure read one level flatter than every other screen. Both fixed.

**Scope.** Headings only. Body, caption and metric sizes stay `[TO DECIDE]` — nobody has
looked at those on a real screen, and deciding them from a table is the mistake
`typography.md` already warns against.

## A-020 — An email reply goes out as a reply, under the customer's subject ^A-020

**Approved:** 2026-09-25, founder: *"yes"* — to: "reply in the same thread, like hitting
Reply, subject 'Re: their subject'; the Subject box is ignored for those replies."

When a lead has a captured email thread, Approve & send, Send now and every automated
follow-up answer the customer's newest email in that thread (Gmail: threadId +
In-Reply-To/References + `Re: <their subject>`; Outlook: Graph's own reply). A lead with
no captured thread (form, CSV, manual) still gets a fresh email with the typed subject.

**Consequence for the UI (founder's to design):** on a lead with an email thread the
composer's Subject field no longer decides the subject. Until the screen says so, it is
a field that does nothing there. See [[design-decisions#2026-09-25 — Email replies thread]].

## A-021 — The home-screen icon: white mark, full-bleed on ink ^A-021

**Approved:** 2026-09-25, founder: *"looks sharp"* — after re-adding FollowUp to his phone's
home screen from the #329 icons.

The brand app icon (`public/brand/png/followup-app-icon-1024.png`) resized down, not
re-rendered: the white mark on ink `#111312`, filling the whole square so the phone's own
mask shapes the corners. iPhone reads `src/app/apple-icon.png` (180, no transparency);
Android reads `public/icons/icon-192.png`, `icon-512.png` and `icon-maskable-512.png` via
`src/app/manifest.ts`. What was wrong before: the manifest pointed at the 32×32 favicon,
so the phone stretched it and it blurred.

**Lesson:** a phone keeps the icon from the moment it was added. After an icon change, it
must be removed and re-added (iPhone: clear Safari website data first) before judging it.

## A-022 — The white hero (Hero v3 · light): black type, plain thin headline, the reply as the one black card ^A-022

**Headline weight reconfirmed (2026-09-26, [A-059](#^A-059)):** thin on both desktop and phone. A-058 briefly made the
phone headline bold; that was reversed the same day.

**PARTLY SUPERSEDED (2026-09-26) by [R-018](rejected.md#R-018):** the reply is no longer a black card. It is the landing
gradient with dark text; only Send stays black.

**Approved:** 2026-09-26, founder, on the Figma build: "keep it plain, move to the next section."

**What specifically was approved:**
- Warm off-white ground (`#fdfcfc`), black type, warm-grey secondary text.
- The approved headline wording (A-013) set in three plain lines of Public Sans Light, with no
  serif italic ("keep it plain").
- The buyer line (A-014), one black "Start free" pill, and three promises right under it:
  nothing sends without your OK, no card, delete everything any time.
- On the right, under half the width: source chips, a small stack of waiting messages, and
  FollowUp's reply as the only black card, with Send and Edit.

**Supersedes:** R-006 (the all-light page, rejected 2026-09-18) and R-010's device-theme rule,
for the landing page. **Changes A-013's styling only:** the wording stands; the serif emphasis
is gone. Direction recorded in `[[design-decisions#^light-elevenlabs]]`.

## A-023 — The landing page plan: nine sections, one question each, one goal ^A-023

**Approved:** 2026-09-26, founder, on the plan table: "we are going good." Sections 2–4 were
also kept as built ("lets keep building").

**The plan, in order:** 1 Hero (A-022) · 2 "Works with" strip · 3 The gap · 4 How it works in
three steps · 5 See it working · 6 Promises · 7 Pricing · 8 Questions · 9 Final "Start free".

**Rules that came with it:**
- One goal, "Start free", in the top bar, the hero, after How it works, after Pricing and at the end.
  **AMENDED (2026-09-26) by [[#^A-049|A-049]]:** the hero also has a quiet "See how it works".
- Per section: a small label, one big thin line, one sentence, then the example.
- Black and white; the reply card is the one black "answered" moment.
- Phone version for every section.
- Motion only in the hero.
- Real tester quotes under the hero and by the final button once testers agree; nothing fake before.

**Cut from the 2026-09-18 page (A-015):** "Why FollowUp exists" (merged into The gap), "Why not
just set a reminder?" (becomes an FAQ), the big "Works with" section (now the strip), and "As it
happens" and "Features" (merged into See it working). Supersedes A-015's section order.

**Built so far (Figma, "Page v3"):** the "Works with" strip, and The gap with "Today · 3 people
need you" beside it. How it works: "Three steps. Two minutes to start.", three soft cards with
thin numerals.

## A-024 — Attio's data principles, for the app and for the landing page's product examples ^A-024

**Approved:** 2026-09-26, founder. Asked where the Attio-based People screen should go (the app's redesign,
the landing page's product examples, or both), he answered: "both, build the inbox next."

**What this settles:** the principles in `references/crm/2026-09-26-attio-data-ui.md` are the way FollowUp
shows data, in the app and wherever the landing page shows the product. That means lines instead of boxes,
colour only for state, two sizes / two weights / two inks, and a person's page as label → value plus a quiet
timeline. The typography stays ours (Public Sans, Plex Mono).

**Not settled by this:** the state-dot colours (muted rust, ochre, slate, sage, greys). He didn't answer
that question, so they remain a proposal. Also not settled: whether the People and Inbox screens themselves
are approved as drawn. He asked for the next screen, not for changes, which is encouraging but not approval.

## A-025 — The desktop app direction (People, Inbox, Today) ^A-025

**PARTLY SUPERSEDED (2026-09-26) by [R-018](rejected.md#R-018):** the reply is no longer a black card. It is the landing
gradient with dark text; only Send stays black.

**Approved:** 2026-09-26, founder: *"I believe we are going well with the desktop one."*
**What this covers:** the direction of the three desktop app artboards: sidebar, ruled table or list, the
open person or conversation beside the list, and the held reply as the one black card. It covers the
direction, not every detail. The state-dot colours are still a separate open question.
**In the same breath he rejected the phone versions (R-015),** so this approval is desktop-only.

## A-026 — Phone reply block: two buttons, plus a quiet "Don't send" link ^A-026

**AMENDED (2026-09-26) by [A-046](#A-046):** a second quiet link, "Later", sits beside "Don't send".

**Approved:** 2026-09-26, founder, "ok", after asking "do we need dont send?" and hearing why.
**What specifically:** on the phone, the reply block has **Send** (primary) and **Edit** as buttons, and
**"Don't send"** as a small grey text link underneath. It isn't a third button, but it is always there.
**Why it stays:** without it, the only way to clear an unwanted draft is to send or rewrite it; the person stays
on "needs you" and the reminders keep coming (principle 1: the owner can always stop a message).

## A-027 — Three places on the phone, four on the desktop ^A-027

**Approved:** 2026-09-26, founder: "yes go with it", after the navigation research (appended to
`research/ux-patterns/2026-09-26-calendly-one-job-simplicity.md`: Apple/Material 3–5 tabs, NN/g's cost of hidden
navigation, peers, and our own usage counts).

**What specifically:**
- **Phone:** Today · Inbox · Settings.
- **Desktop:** Today · Inbox · People, with Settings at the bottom of the sidebar. No "Sources" block in the sidebar;
  sources live in Settings.
- **Folded, not hidden:**
  - Pipeline becomes a stage and deal-value field on the person page.
  - Follow-up plans becomes the plan card in Settings.
  - Analytics becomes the weekly email plus one line on Today.
  - Activity becomes "what FollowUp did" inside each person.
  - Nothing goes into a "More" drawer.
- **Guard:** re-check the usage counts at 30 accounts before deleting any page's code.

## A-028 — Meta reply-window time: shown only when it's nearly up ^A-028

**Approved:** 2026-09-26, founder: "ok go with it".
**What specifically:**
- In a conversation on Instagram or Messenger, the time left in the reply window is **hidden** while there's plenty.
- **One line** appears only near the end (for example "3 hours left to reply here"), matching the existing
  "window shuts in N hours" state.
- After the window closes, the badge fixed in PR #334 takes over ("a reply you send yourself can still go out for N
  more days").
**Why:** principle 2. Urgency is stated once, precisely, where it's actionable. A 20-hour countdown is clutter;
the last few hours are the one thing the owner must not miss.

## A-029 — Desktop keeps the coloured state dots ^A-029

**Approved:** 2026-09-26, founder: "Colored one", choosing between two side-by-side versions on the canvas
("Compare · status dots"). I had recommended black-only.
**What specifically:** on desktop, each state pill keeps a small coloured dot:
- **muted rust:** needs you
- **ochre:** going quiet
- **slate:** waiting
- **sage:** reply ready / sent
- **greys:** checked in, done

The dot is the only colour; the pill stays white with a hairline border and the word always says the state.
These values are now the approved state tokens. They were a proposal since A-024.
**Phone is unchanged** (R-015/A-027): a single black dot for "needs you", no colour coding.
**Reason inferred (marked inferred):** at a desk, scanning many rows at once, colour helps; on the phone, one decision at a time, it doesn't.

**Refined the same minute (founder):** *"The needs should only be the bold font… like you have highlighted on the
right side. The rest should not be that highlighted."* Final rule for state pills everywhere, desktop app and landing examples:
- **"Needs you"** (and the landing's "Held for you"): bold, black text.
- **Every other state:** regular weight, soft grey text (`#57534e`).
- The coloured dot stays on all of them. Emphasis marks what needs action; colour tells the states apart.

## A-030 — One group, "Needs you", instead of "Needs you" and "Reply ready" ^A-030

**Approved:** 2026-09-26, founder: "one group".
**What specifically:**
- Everyone waiting on the owner's OK is in one group, **Needs you**, with one line under each name saying why
  (for example "The reply mentions a price, so it waits for you").
- The "Reply ready" state and group are gone, from Today, Inbox and People.
- On desktop Today, the row's button still differs: **Review** where judgement is needed (price), **Send** where the
  reply is routine.
- "Send both" was removed with the second group.
**Why:** both groups waited for the same tap. Two nearly identical groups were extra thinking (principle 4).

## A-031 — Desktop Today keeps the "handled today" line ^A-031

**Approved:** 2026-09-26, founder: "keep it".
**What specifically:**
- On desktop Today, a thin progress line: "1 of 5 handled today · When the list is empty, you're done for today."
- It's the one Duolingo idea kept (`research/ux-patterns/2026-09-26-duolingo-progress-and-completion.md`):
  the day has an end.
- **Desktop only.** The phone stays without it (R-015).
- It's never a streak, never points.

## A-032 — The landing page's soft colour washes stay ^A-032

**Approved:** 2026-09-26, founder: "keep them".
**What specifically:**
- On the landing page only, two soft washes (apricot, rose-sand and a little dusty blue) with a fine paper grain, in exactly two
  places: behind the hero example and behind the final "Start free".
- The page ground stays one tone (R-010's lesson). They're low saturation and grained (S-02).
- Values: `.fu-wash-hero`, `.fu-wash-end` and `.fu-grain` in the landing artboards. They're now approved.
- **Not in the app:** the phone's all-caught-up screen dropped its wash in the phone rebuild (R-015).

## A-033 — "See it work" stays a quiet link, not a second button ^A-033

**Approved:** 2026-09-26, founder: "keep it as a link".
**What specifically:**
- In the landing hero, **Start free** is the only button.
- **"▶ See it work"** sits beside it as a quiet text link with a play mark. It jumps to the Try it demo on the page.
- This keeps A-023's one goal and the research's "no second CTA" finding (conversion-strategies §5), while
  following Intercom's order (start / view demo).

## A-034 — The weekly email leads with a real win ^A-034

**Approved:** 2026-09-26, founder: "lead with the win".
**What specifically:**
- The weekly digest opens with one true outcome in plain words, for example "Tom Reid came back and booked":
  a customer who went quiet and replied after a check-in.
- The outcome counts follow underneath: answered, came back, booked. Never messages sent (principle 7).
- If the week had no win, it opens with the plain count and says nothing is waiting.
- **Status:** a design and copy decision for the existing weekly digest (Phase B). Implementing it is a code change for later.

## A-035 — "Email Sahil" on the private-beta sign-in screen ^A-035

**Approved:** 2026-09-26, founder: "yes add it" (research §3.2, `2026-09-26-conversion-strategies.md`).
**What specifically:**
- Under the sign-in button: "Not in the beta yet? Email Sahil. A short note is already written for you."
- An outlined button opens the visitor's email to contact@followupbase.io, with a pre-written note ("Hi Sahil, I run a ___
  business and I'd like to try FollowUp.").
- It's a link, not a form, a waitlist or a data capture, so R-012 still holds.
- **Status:** design approved. The live sign-in page (`SignInClient.tsx`) changes when the app is built from these designs.

## A-036 — The founder's analytics page ^A-036

**Approved:** 2026-09-26, founder: "okay cool", on the "Admin · how FollowUp is being used" artboards.
**What specifically:**
1. A headline sentence worked out from the numbers.
2. Four big numbers: written, sent by owners, waiting, came back.
3. This week against last week, as a ruled table.
4. "Which parts get used" with thin bars.
5. Website visits via Vercel, with an honest empty state.

Counts only, no names. More numbers can be added later on request ("We can add stuff later on in analytics for
me, right?"). The live /admin section was matched to this before shipping.

## A-037 — The weekly email's design, with who's waiting above the numbers ^A-037

**PARTLY SUPERSEDED (2026-09-26) by [A-038](#A-038):** the email is now a designed HTML email, and the numbers sit
between the win and the waiting list. The plain-text wording below stays as the email's text version.

**Approved:** 2026-09-26, founder: "yes go with it" (canvas version 24, "Weekly email" artboards).
**What specifically:**
- Plain text, from the owner's own Gmail to themselves. No bold, no buttons, no brand colour.
- **A week with a win:** the subject and first line are the win ("Tom Reid came back and booked."), then one
  sentence on how. Next come the replies waiting for an OK, **by name**, with the channel and how long each
  customer has waited, then "Nothing goes out until you send it." and the link. **The numbers come last**
  (customers answered, came back, booked).
- **No win yet:** it leads with the waiting replies by name. The week is one sentence at the end.
- **A quiet week:** "A quiet week." plus one sentence.
**Why:** A-034 puts the win first, to show the value. Main goal #1 puts the waiting names second: they are the
leads most at risk of being lost. Principle 7 means counting customers, not messages. The numbers are the least
actionable part, so they go last. This refines A-034; it does not replace it.

## A-038 — The weekly email, designed (Wispr Flow structure, no streaks) ^A-038

**Approved:** 2026-09-26, founder: "yes go with it" (canvas version 25, "Weekly email · designed", phone and desktop).
**What specifically:**
- A designed HTML email, still sent from the owner's own Gmail to themselves, with the A-037 plain text as its
  text version.
- **Header:** the landing wash with grain as the background image, the FollowUp lockup, the dates, and "Your week,
  {business}".
- **Win card** overlapping the header: label, "Tom Reid came back and booked.", one sentence on how, and a chip
  with the booking time.
- **Three big numbers:** answered, came back, booked, each with "Last week: N". Customers, never messages.
- **Waiting for your OK:** the names, channel and wait time, one black **Open FollowUp** button, and "Nothing goes
  out until you send it."
- **Where customers wrote from** (thin bars) and the **busiest time**.
- **Footer** on the closing wash: lockup, "So no customer gets forgotten.", Website · Privacy · Terms · Contact,
  "Write to Sahil", and why they get it.
- **Not included:** streaks, leaderboards, percentiles, stock photos, and blog links (there is no blog).
**Why:** the founder wanted it "more professional and interesting" like Wispr Flow's. The structure is Wispr's,
the restraint is FollowUp's.

## A-039 — "We talked": one tap stops check-ins after an offline conversation ^A-039

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 27, "We talked" artboards).
**What specifically:**
- Under a waiting reply, two quiet links: **We talked · Don't send**.
- One tap stops FollowUp's check-ins for that customer and removes them from Needs you.
- The history gets a line: "You talked with {name} · {time}". A note says FollowUp won't check in, and that a new
  message from them still shows up.
- No confirm dialog. A white toast, "Check-ins stopped for {name}", offers **Undo**.
**Why:** Close's "Mark as Responded" (Close study #1). FollowUp can't see calls or meetings, and checking in after
you've spoken breaks trust (principle 1).

## A-040 — Landing: "What changes" (outcomes) and "How a normal week goes" (example stories) ^A-040

**Approved:** 2026-09-26, founder: "approve both" (canvas version 28; Notion study,
`research/ux-patterns/2026-09-26-notion-jobs-and-outcomes.md`).
**What specifically:**
- **"How it works" becomes "What changes":** "Two minutes to connect. Then this changes." The three cards are
  outcomes: "Every message gets a reply", "You see who's slipping away", "You step in only when it matters". The
  soft cards and thin numerals stay (A-023).
- **New section right after it, "Examples · How a normal week goes."**, with "Made-up names, real situations." Three
  story cards:
  - Dan the plumber at 7:40 PM: a price question held for his OK, then a visit booked;
  - Maya the realtor at a showing: a day-3 check-in, then a showing booked;
  - Ana the salon owner mid-cut: a reply in Spanish, then a Saturday booking.

  Each card shows the customer's message, what FollowUp did, and a ticked outcome.
- Always labelled as examples. They're replaced by real tester stories when testers agree (A-023 rule stands).
**Refines A-023:** section 4 keeps its place and its look; only its words change. The stories are a new section 4b.

## A-041 — Trust and control: all five Mercury proposals, to build ^A-041

**Approved:** 2026-09-26, founder: "yes design both build all".
**What specifically:**
1. A "Your control" section on the landing page and a plain-words /security page, with an honest "not done yet" list.
2. The rules FollowUp follows, shown as plain sentences in Settings.
3. "Only admins send" as a team option.
4. An email when the account is signed in from a new device, plus "Sign out everywhere".
5. "Pause all sending".

**Rules that come with it:** only true, checkable claims. Never SOC 2, "bank-grade", or badges we don't hold (A-023).
Name the limits before anyone has to ask (Mercury's "not a bank" lesson).
**Status:** the canvas drawings (version 29) haven't been reviewed yet. This approves building the five, not every
drawn detail.

## A-042 — Outcome-first copy (Ramp study) ^A-042

**PARTLY SUPERSEDED (2026-09-26) by [A-045](#A-045):** Today's three "This week" tiles become one line.

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 32).
**What specifically:**
- Landing features become "Less chasing. More booking." Six outcomes, each with the feature as the small line.
- Pricing lines lead with the outcome.
- Today shows "This week": customers answered, came back, booked. Not on the phone Today (R-015).
- Numbers only when they're true by construction or measured. There is no time-saved estimate, because the founder
  didn't answer that question.
- **Kept in mind for later:** a real proof number once testers agree (A-023).

**Built:** PR #340. The small line on "one tap" now says "On Instagram and Messenger", which fixes the weak spot noted
at design time.

## A-043 — Show the work, not the robot (Intercom study) ^A-043

**PARTLY SUPERSEDED (2026-09-26) by [A-045](#A-045):** "sent as written" joins Today's one line.

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 33).
**What specifically:**
- "AI" comes off working screens: "Your reply, ready" (sub-line "Written from your conversation. Nothing sends until
  you do."), "What FollowUp did", "N sorted by how likely they are to book", "Answers your calls".
- One quiet "Based on …" line under each waiting reply. It names only what's in the conversation, and it's built
  without a model call. An amount counts as "you quoted" only if it first appeared in the owner's own message.
- Rewrite chips on the reply: Shorter · Warmer · More formal · In <their language>. The reply still waits for the owner.
- Today: "You sent X of Y replies without changing a word." Real data only (`draftEdited`).
- "Catching up": two or three factual sentences at the top of conversations with 7+ messages, and a link to show them
  all.
- Guardrails: no sparkles, bot avatars or chat-with-the-AI screen (S-13).

**Built:** PR #342. Rewrite chips are 36px tall on phones so they're easy to tap (the weak spot found in review).

## A-044 — Follow-up rules as sentences (Zapier study) ^A-044

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 34), after a plain-words recap.
**What specifically:**
- In Settings, each automatic rule is one sentence: "When …, FollowUp …". Each has one switch, the one number that
  matters (editable in place) and a "stops when" / "unless" line. No "trigger", "action" or "workflow" words.
- "See an example" on each rule shows what it would write for a real recent customer. It's marked as an example and
  never sent.
- A "This week" record under each rule: wrote · you sent · waiting. Real counts only, hidden when zero. On the phone
  it's on the rule's own screen, not the list (R-015).
- A rule that can't run says so where the owner looks: on Today, with the one fix (for example, "Reconnect Gmail").
- Follow-up plans: three ready plans (After a quote, After a no-show, Seasonal check-in), counted in days. You pick one
  and change a day. "Start from scratch" is a quiet link.
- "Your rules" (A-041) stays as the summary beside the cards.
- Guardrails: no flowchart or branching, and no live test that sends.

## A-045 — Today's numbers: one line ^A-045

**Approved:** 2026-09-26, founder: "yes fold into one line". This was asked after the conflict check found Today
gathering more pieces than A-027's "analytics becomes one line on Today".
**What specifically:**
- The "This week" tiles (A-042) and "You sent X of Y without changing a word" (A-043) become one quiet line on desktop
  Today. For example: "This week: 11 customers answered · 2 came back · 1 booked · 18 of 21 sent as written".
- Each part appears only when it's more than zero. The line is hidden when every part is zero.
- The phone doesn't show it (R-015).
- Today's order stays: warnings (paused, can't send) → Needs your OK → the rest.

## A-046 — A calm Today: longest waiting first, an end, once each, coming up, later (Todoist study) ^A-046

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 35). This includes "Later", which was
asked about explicitly.
**What specifically:**
- **Order:** "Needs your OK" puts drafts that need judgement first, then longest waiting first. Each card shows the
  wait as a fact about the customer: "Waiting 5 h" when they wrote, "Quiet 6 days" for a check-in.
- **Start line:** "Start with Priya. She's waited 5 hours and asked about a price." No score.
- **An end:**
  - Desktop gets A-031's handled line: "1 of 5 handled today · When the list is empty, you're done for today."
  - An empty list shows "You're done for today. FollowUp keeps watching. It will tell you when someone writes." There
    is no confetti, no points and no streak.
- **Once each:** "About to be lost" leaves out anyone already in "Needs your OK".
- **Coming up:** who FollowUp writes to next, grouped by day. On desktop it's a card beside the list. On the phone it's
  one line that opens the list.
- **Later:**
  - A quiet link beside "Don't send" offers "Later today (2pm)" or "Tomorrow morning (9am)".
  - The card comes back by itself, or at once if the customer writes again.
  - The draft is kept.

## A-047 — First value, measured and said once (Amplitude study) ^A-047

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 36).
**What specifically:**
- **Definition:** first value is "a customer got a reply that FollowUp wrote". Activated means first value within 7 days
  of first sign-in. Proof is that customer writing back. This is recorded in `PRODUCT_DIRECTION.md`.
- **/admin "Who reaches first value":**
  - The band: activated, median time to first value, back in week 2, and heard back.
  - One sentence naming the biggest drop and the slowest step.
  - Eight steps with counts and median times.
  - "Who's stuck", longest first, with the last step, why, days and an Email link. The link is the founder's own mail;
    nothing is sent automatically.
- **Phone /admin:** the headline, the sentence, who's stuck, and "Every step, with times" (R-015).
- **Today:** one calm card on the day it happens: "Your first reply went out through FollowUp." It gives the
  customer's name and says FollowUp keeps watching. No confetti, points or streaks.
- **Guardrails:** no analytics SDK, only our own tables, founder-only.
**Built:** PR #350.
**CONFIRMED (2026-09-26):** after the founder's reference strategy proposed a different wording, the founder kept
A-047 as the counted definition: "yes keep it". The strategy's wording ("the owner finds a conversation that needs
follow-up and acts on it") becomes the **onboarding target** for the first session, not the activation number.
It's the "First reply ready → First reply sent" step in /admin.

## A-048 — Motion that explains a change of state (Framer study) ^A-048

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 37). That includes the motion tokens,
which were marked "your call".
**What specifically:**
- **Today:** a finished card folds into what happened ("Sent to Priya."), then leaves, and the cards below slide up
  into its place. The same happens for Don't send ("Won't send to Priya.").
- **Undo:** a thin line drains in a straight line over the 10-second window, on each card and on the safe pile. It
  holds still under reduce motion, and the seconds still count.
- **Open in place:** the Later choices, "See an example", "Read a few first" and "Every step" open from their
  trigger. They take 220 ms to open and 120 ms to close.
- **Removed from the app:** load fades, Pipeline's stagger and count-up, and the sparkle and tilt primitives. The
  landing hero is unchanged.
- **Tokens:** `--motion-fast` 150 ms, `--motion-move` 220 ms, `--motion-exit` 120 ms, ease-out in and ease-in out,
  and one spring for layout. The same numbers live in `src/lib/motion.ts`.
**Built:** PR #351 (moments and tokens) and PR #352 (removals).

## A-049 — Hero: "Start free" plus a lower-commitment "See how it works" ^A-049

**Approved:** 2026-09-26, founder: "B, build it", after seeing both options rendered on the real page (desktop and
phone).
**What specifically:** in the landing hero, a quiet outlined "See how it works" sits beside the black "Start free".
It scrolls to the product demo ("See who needs you, and why."). It comes from the founder's reference strategy
(`research/2026-09-26-reference-strategy.md`): one primary action and one lower-commitment action.
**Amends:** [[#^A-023|A-023]]'s "one goal" rule, for the hero only. "Start free" stays the one goal in the top bar,
after How it works, after Pricing and at the end.
**Built:** PR #353.

## A-050 — Talk like the owner, and show the three places (Close study) ^A-050

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 38).
**What specifically:**
- **Words:** "customer", never "lead", on owner-facing screens. The page becomes "Customers". The route, the data
  and the A-013 hero line stay.
- **Three places on Today:** "Needs you · Waiting on customers · Handled today". "Waiting on customers" lists
  everyone we answered who hasn't answered back, each with what happens next. On the phone it's one line.
- **Reply speed:** the week line leads with the median time customers heard back this week, from our own records
  only.
- **Check-ins state their condition:** "unless Priya writes first".
- **Proof on the landing page:** each tester's own before and after reply time, plus their words. It renders only
  when every field is real and agreed (A-023).
**Built:** PR #354 (words), #355 (three places, waiting list, "unless", reply speed), #356 (proof, hidden until real).

## A-051 — Trust before delegation, and a hero that converts (Intercom study) ^A-051

**Approved:** 2026-09-26, founder: "yes approve it, build it" (canvas version 40).
**What specifically:**
- **Preview first:** the last setup step shows "Here's what FollowUp would write to your last 3 customers. Nothing
  was sent." Each draft has Send, Edit or Skip. When there's nothing to show, it says so and goes to Today.
- **One story:** "See how it works" lands on Sarah's case in five numbered steps. The product cards stay below.
- **Promise:** "When it isn't sure, it asks you. Prices, dates and anything tense wait for your OK." The control lede
  adds "Before anything goes out, you see exactly what it would write, to your own customers."
- **Hero number:** a real, pooled reply-speed line, only above a threshold and always with its base. The founder
  also asked for a line in the tester terms ("add the line, build it").
  **HELD (2026-09-26):** our Google Limited Use disclosure limits Gmail data to finding conversations and sending
  follow-ups. The founder decides before this is built.
**Hero number DECIDED (2026-09-26): off the page for now (option A).** The founder was given three choices: keep it
off, count it only from non-Gmail channels, or check Google's policy first. He answered "yes record A", after the
recommendation that a pooled number from a handful of testers reads weak, the real trust lever is showing the
product, and it avoids the Gmail question entirely. The tester-terms line isn't needed either. When a tester has a
real before and after, the number goes on their customer story page (ProofStory, A-023). The HeroProof boards stay on
the canvas as a parked idea.
**Build PAUSED (2026-09-26):** the founder, after R-019: "no dont want any changes in live product lets just focus
on sketching i will finalliese and we will push the design to the main." PR #357 (the story, promise and lede) was
closed unmerged, and the preview-first onboarding step was not started. Everything stays on the canvas until the
founder finalizes it.

## A-052 — Sketch first. Nothing ships to the live product until the founder finalizes the canvas ^A-052

**Approved:** 2026-09-26, founder: *"no dont want any changes in live product lets just focus on sketching i will
finalliese and we will push the design to the main."*
**What specifically:**
- For now, design work stays on the Claude Design canvas. No PRs change the live product's look or copy.
- The founder finalizes the canvas. Then the finished design goes to main in one planned pass.
- Every new board follows the sketched canvas system (R-019), not the live page.
- It supersedes the "approve, build" habit (a study approved and then shipped in small PRs straight away) until the
  founder says otherwise.
**Not covered:** fixing real bugs and security issues in the live product is not design work. It still goes through
normal PRs, and he merges.

## A-053 — Linear + Attio, the rest of the PDF, and the page put together ^A-053

**SUPERSEDED IN PART (2026-09-27) by [A-063](#^A-063):** How it works and See it working (with its tabs) are replaced
by one watchable demo. The rest of A-053 stands.

**Approved:** 2026-09-26, founder: *"yes approve it, put it all together"* (canvas v42–v43).
**What specifically:**
- **Underneath** (DepthTabs): "Simple on the outside. The rest is there when you want it."
  - One product frame with four tabs: Today, Follow-up plans, Rules, Your week.
  - It sits after Your control and before Pricing.
- **How it works** as Connect → Find → Follow up, each step with a small real frame. It replaces "What changes".
- **One section rhythm:** eyebrow and heading on the left, one line on the right, then one full-width frame.
- **See it working** adds "It decides who comes first and what to say. You decide what gets sent."
- **Customer story page** (ProofStory): outcome, before → after, their words, one screen. It exists only when every
  field is real and the customer has agreed in writing (A-023).
- **Pricing:**
  - the line "In the beta you get everything in Pro, free. No card, so nothing can be charged.";
  - Plus marked "Recommended for one owner";
  - three money answers under the plans.
- **Setup button:** "Find who needs a reply".
- **Three untrue lines removed everywhere.** They said simple replies can send by themselves (card 3, the Plus plan,
  FAQ 1, and the control switch line). Every reply waits for the owner's OK.

**Put together:** MainV2 (desktop) and PhoneV2 (phone) are the whole landing page in the journey order. They're built
on copies of the sketched Main and Phone, so the working tabs, "Try it" and the FAQ still work. This is the board the
founder finalizes before anything goes to main (A-052).

## A-054 — The landing page, trimmed to what it needs ^A-054

**Approved:** 2026-09-26, founder. He asked "Do you think it's a big landing page…?", then said *"yes trim it like
this"* to the proposed cuts.
**What specifically:**
- **Cut:**
  - "In short" ($0 / 2 min / 1 list), which repeated the hero's trust lines and Pricing;
  - "Examples" (a normal week), which is a second story next to Sarah's;
  - the tester-quote slot in the hero and in Start free, because proof lives in one place.
- **Merged:** "What you get" into "Underneath". The four tabs each carry one outcome line: no message missed,
  check-ins you'd forget, nothing goes out without your OK, your Monday week.
- **Also:**
  - Sarah's story sits beside its heading.
  - There's less space between sections.
  - The hand-drawn underline under "Start free" is gone (R-020).

**Order:** Hero → Works with → The gap → How it works → One customer → See it working → Your control → (Proof, when
real) → Underneath → Pricing → Questions → Start free.

**Result:** the desktop page is about 8,000px (about 9 laptop screens, down from about 11). I'd estimated 6–7. The
honest gap is that each remaining section is doing a job. Further cuts are the founder's call (listed in
design-decisions).

## A-055 — Three more cuts to the landing page ^A-055

**SUPERSEDED IN PART (2026-09-27) by [A-063](#^A-063):** Your control keeps only Pause all sending as a picture; the
other switches move to /security. Items 2 and 3 stand.

**Approved:** 2026-09-26, founder: *"yes do all three"*.
**What specifically:**
1. **Your control:** "What it can see" (the four Google permissions) moves to /security. The switches stay, as a
   two-column list. The closing line becomes "It asks Google only for what it needs, and can't see anything you
   haven't connected. The full list, and what we haven't done yet:" plus the link.
2. **Underneath:** just the four outcome columns (Today, Follow-up plans, Rules, Your week). No tabs and no Today
   frame.
3. **The gap:** the quote heading and one line: "A CRM stores names. A reminder tells you it's time. FollowUp tells
   you who, and why, every day."

**Result:** desktop is 7,193px (about 8 laptop screens, down from about 11 before any trimming). It's one board.
The phone is two boards.
**Needed when built:** /security must list the four Google permissions (the Security board already does).

## A-056 — FollowUp follows up on its own; only decisions come to the owner ^A-056

**Decided:** 2026-09-26, founder: *"I want this product to be more focused on auto because the main thing is that
this product will be auto-following and handing over the human decision part to the users. Everything else will be
done by follow-up."*
**What it means for design:**
- The page's spine is "It follows up on its own. It hands you only the decisions."
- Decisions are a price, a date, a tense moment, or anything it isn't sure of.
- The owner's control moves from "approve every reply" to three things:
  - decisions come to you;
  - it stops the moment they reply;
  - one switch, **"Ask me before everything"**, turns approval-first back on.

**On the canvas (v53):**
- **Hero lede:** "FollowUp answers every customer and follows up on its own, in their language. When something needs
  your decision, like a price or a date, it hands it to you."
- **Hero trust line:** "Prices and dates always come to you."
- **Hero picture:** "Sent for you · 1 min", with no Send/Edit.
- **How it works:** "Connect. It follows up. You decide." Three steps:
  - Connect;
  - It follows up on its own (a sent log, and one "Needs you");
  - Only the decisions come to you.
- **Sarah's story:** "On its own, except the price." FollowUp answers in a minute → the price comes to you → you
  send → it checks in by itself on Friday.
- **See it working:** "It follows up on its own. It hands you only the decisions…" The tab is "Decisions come to
  you".
- **Switches:** "Ask me before everything", with "Turn it on and every reply waits for your OK."
- **Pricing:**
  - Free: "Prices and dates always come to you".
  - Plus: "Follows up on its own, on every channel".
- **FAQ 1:** "Will it send things on its own? Yes, the everyday ones…"

**It reverses:** the 2026-09-21 product default "hold every message for approval". That default still runs in the
live product. **The page must not ship until the product sends low-risk follow-ups on its own by default and refuses
nothing it now allows.** It's a product change, and it's built only on the founder's word (A-052).
**The research tension, named:** the reference strategy's "trust before delegation" (detect → suggest → approve →
earn trust → offer automation) is now the opposite order. It's mitigated by:
- decisions always come to you;
- instant stop on reply;
- the audit trail ("It's honest");
- the "Ask me before everything" switch.

## A-057 — A shorter phone page, and a real footer ^A-057

**Approved:** 2026-09-26, founder: *"yes do all four and at the bottom, we should do something like this, right? All
big companies have their blogs and stuff, and their handles, contact info, and all that stuff."* (He sent a
screenshot of a large multi-column site footer as the example.)
**What specifically, phone (PhoneV2, canvas v55):**
1. **How it works:** three numbered lines, no frames.
2. **Sarah's story:** plain lines on a thin timeline. A red dot marks the one decision that came to the owner.
3. **Your control:** the promises are a short list with a bold lead-in. The switches are small chips under "Switches,
   any time".
4. **Pricing:** the three money answers move into the FAQ ("What happens when the beta ends?", "What counts as a
   customer?", "Is my data safe? Can I leave?").

**Result:** the phone page is one board again, about 6,730px (down from about 8,000 over two boards).

**What specifically, footer (desktop and phone):**
- A brand column: logo, "So no customer gets forgotten.", and contact@followupbase.io.
- Four columns:
  - **Product:** How it works, See it working, Pricing, Questions, Sign in;
  - **Works with:** Gmail, Outlook, Instagram, Messenger, WhatsApp, Website form (plain text, no logos);
  - **Trust:** Security, Privacy, Terms, Delete your data;
  - **Follow:** Blog, LinkedIn, Instagram, X, drawn dashed as placeholders.
- A bottom row: "© 2026 FollowUp".
- On the phone, the columns sit in a 2×2 grid under the brand.

**The rule for the Follow column (A-023 applied to the footer):** a blog or social link appears only once that
account exists and has something on it. None exist yet, so on the live page the Follow column is hidden. No
placeholder handles and no links to empty profiles.

## A-058 — The phone's first screen: the picture in view, bold headline ^A-058

**SUPERSEDED IN PART (2026-09-26) by [A-059](#^A-059):** the bold headline is reversed. Everything else in A-058
stands.

**Approved:** 2026-09-26, founder: *"B looks better, put it on the phone page"*. He chose it over A (the same layout
with the thin headline).
**What specifically (PhoneV2, canvas v57):**
- **Headline:** the approved wording (A-013), in Public Sans 600 at 40px, three lines.
- **Line under it:** "It answers every customer and follows up on its own. Only the decisions come to you."
- **Picture, in the first screen:** three cards play in order:
  1. the customer asks on Instagram;
  2. "Sent on its own · 1 min";
  3. "Needs you · the price. Reply written. You add the number."
  Under reduce motion, all three simply show.
- **Buttons:** "Start free" is full width and ends at about 670px, above where a phone browser cuts off. Under it,
  one row holds "See how it works" and "Free in beta · No card".

**Scope:** phone only. The founder said the desktop is fine, so it keeps the thin headline (A-022).
**Result:** the phone page is about 6,560px.
**Rejected alongside:** option A (the thin headline on the phone). No reason was given. Inferred (marked inferred):
on a small screen, the thin weight doesn't hold attention.

## A-059 — Thin headline on both desktop and phone ^A-059

**Approved:** 2026-09-26, founder. Asked whether the desktop headline should become bold to match the phone, he
answered: *"thin is fine for both please"*.
**What specifically:** the headline stays Public Sans 300 on desktop and on the phone (40px, three lines). The phone
keeps the rest of A-058: the one-line lede, the picture in the first screen, and the button row.
**What this settles:** the phone's "boring" problem (R-021) was about the picture being below the fold, not about the
headline's weight. That's inferred from this answer, and marked inferred.

## A-060 — The auto follow-up flow and the mixed-example landing page ^A-060

**SUPERSEDED IN PART (2026-09-27) by [A-063](#^A-063):** on the landing page, Sarah's story is no longer its own
section; it plays inside the demo. The onboarding and Today parts stand.

**Approved:** 2026-09-26, founder: *"all good"*, on canvas v59.
**What specifically:**
- **Onboarding:** OnbConnect ("Nothing is sent yet: next, you choose how it works") → OnbChoose (Automatic,
  recommended, with one example; or Assisted) → OnbOldCustomers ("12 people never got a reply", "Send all 10", price
  questions set aside for Today).
- **TodayHoldingPhone:** a price decision showing the "we got you" message already sent, and a "$ price" slot in the
  written reply.
- **Landing page (MainV2 / PhoneV2):**
  - mixed examples (home service, realtor, consultant);
  - "Your team" in Underneath;
  - FAQ 1 names Automatic / Assisted;
  - the hero reply asks for a photo instead of promising "this week";
  - the story shows the holding message at 10:42.

**Still open before building:**
- the "$ price" slot needs a spec;
- the product itself must do all of this (PRODUCT_DIRECTION, "The auto follow-up direction, complete") before the
  page ships.

## A-061 — Logo direction: two messages (option H) ^A-061

**SUPERSEDED (2026-09-27, same day)** by [[approved#^A-062|A-062]]: the founder kept the two leaves.

**Approved:** 2026-09-27, founder, on the six-more board (LogoOptions2): *"h souds my vibe"*.

**What was chosen:** a direction, not a final drawing.
- A message, then a smaller one after it, below and to the right.
- The chat meaning: they wrote, and the follow-up came.
- The gap between the two is kept open.
- Solid, black and white, leaning forward slightly.

**Not chosen:** my recommendation, E (flag), and runner-up, A (sharper leaves). No reason was given. Inferred
(marked inferred): the founder wants the mark to look like conversation, the thing FollowUp handles, rather than
like the email tool's flag.

**Still open:**
- the exact shapes, lean, gap and proportions;
- the wordmark pairing;
- a similarity check against well-known marks;
- a trademark search.

The founder also asked, in the same breath, to study the reference companies' logos first. Those findings go into
the refinement.

**Weak, named when it was proposed:** "looks like any chat app". The refinement has to make it ownable.

## A-062 — Keep the two-leaf logo ^A-062

**Approved:** 2026-09-27, founder: *"let just keep what we have"*.

**Came after a day of rounds on the canvas** (LogoOptions, LogoOptions2, LogoH, LogoIdeas, LogoF, LogoReply, LogoLight,
LogoSoft, LogoMoreF, LogoSmallF), and after an honest user read of the current mark (design-decisions,
2026-09-27):
- it reads as a fast, leaning F, calm and premium;
- it doesn't say "messages" by itself;
- the name and tagline carry the message.

**What is kept:** the mark exactly as shipped. Geometry and usage are in `followup/public/brand/README.md`, drawn in
`src/components/LogoMark.tsx`, with the small-size drawing below 24 px. Nothing changes in code.

**Not taken:**
- option A, one wide-gap drawing at every size;
- the stem and small-f variants (F1, S1).

They stay on the canvas as history. Any future logo change starts from this entry.

**Principles learned on the way, still standing:**
- R-022: no letter whose meaning hides in a small detail.
- R-023: no heavy or chunky marks.
- The logo's one-second message, if it ever changes, is "every message gets a reply".

## A-063 — The landing page with less to read (MainLean, PhoneLean) ^A-063

**Approved:** 2026-09-27, founder: *"yes to all three"* (merge #358, this page, and A-064).
**Came from:** his question "too much information no?" and the measurement against the reference PDF
(design-decisions, 2026-09-27).
**What specifically:**
- **One demo** replaces How it works, One customer and See it working. It is the real Today screen playing Sarah's story
  in 5 steps:
  1. she asks the price;
  2. it comes to you with the reply written and a "$ price" slot;
  3. after 30 minutes the holding line goes out, word for word from `holdingMessage.ts`;
  4. you add $1,200 and send;
  5. on Friday it checks in, she replies, and the check-ins stop.
- **Captions:** five short numbered lines, because they are a sequence.
  - Desktop: all five show; the current one darkens and a line fills under it.
  - Phone: one at a time, with five progress segments.
- **Pause and Replay** (WCAG 2.2.2). Reduced motion shows the end state as still frames.
- **Label:** "An example, not a real customer".
- **Your control:** four one-line promises and one picture, the Pause all sending switch. The other switches move to
  /security.
- **Each promise said once.** The hero's second trust line goes; Free loses "Prices and dates always come to you"; the
  final call keeps one reassurance; Underneath gets shorter lines; the desktop money answers move into Questions.
- **Nav:** "Try it" goes with the tabs.
- **Target:** about 700 words and about 6 screens on desktop (from 1,204 words and about 9).

**It supersedes:**
- A-053 in part (How it works, See it working);
- A-055 item 1 in part (the switches);
- A-060 in part (the story as its own section);
- brand principle "The phone is not a shrunk desktop", in part: on the landing page the phone no longer keeps every
  word; it keeps every *claim*, said once.

**Weak, named when proposed, still true:**
- The loop is 24 seconds. Someone who scrolls past in 5 sees only step 1.
- The first frame is a single message and says little on its own.
- The desktop demo window is 800 px tall, the biggest object on the page.

**Still needed when built:** the "$ price" slot spec (A-060), and the product doing what the demo shows (A-056).

## A-064 — /security with less to read (SecurityLean, SecurityLeanPhone) ^A-064

**Approved:** 2026-09-27, founder: *"yes to all three"*.
**What specifically:** the same facts as the approved /security page, shown instead of listed:
- a flow picture: inbox → FollowUp → your customer, "from your own address";
- the Google permission names as chips (A-055 moved them here);
- six "kept" facts, each with an icon;
- the switches as a picture of Settings (A-063 moved them here);
- the companies FollowUp uses as a 3-column table;
- the honest "not done yet" block, kept word for word.

**Measured:** desktop 428 words and 3,242 px, from 624 and 4,262.
**Depends on PR 1:** the first switch says "Or choose Automatic". Ship it only once onboarding offers that choice;
until then keep the live wording "only if you turn that on".

## A-065 — The booking page and the website form, redrawn for the business's customers ^A-065

**Approved:** 2026-09-27, founder: *"yes build it, edits can go"* (canvas v77: BookingDesk, BookingPhone, BookedDesk,
BookedPhone, FormOnSite, FormPhone, FormErrorPhone, FormSentPhone).

**What specifically:**
- **Both pages belong to the business (A-017, now applied to booking too).** The business's name is the header.
  FollowUp is a quiet "Powered by FollowUp" at the foot, nowhere else.
- **Booking:**
  - One day at a time: a row of the next weekdays, each with how many times are open ("full" when none), then that
    day's times split into Morning and Afternoon.
  - "Times in your time zone · Toronto".
  - A summary before anything is booked: day, time range "your time", and one button, "Book this time". On desktop
    it's a card beside the times; on a phone it's a bar that appears at the bottom once a time is picked.
  - No reschedule or cancel is promised, because none exists: "Need a different time? Reply to the message this link
    came in."
  - Booked: "You're booked.", the time, and **Add to Google Calendar** and **Add to Apple / Outlook**. These two
    buttons are new; they work from the browser alone and change nothing on the business's side.
- **Website form:**
  - "Tell us what you need."
  - A visible label on every field. Email and Phone sit side by side on a desktop and stacked on a phone.
  - The one rule (an email or a phone) is said under the pair: "Add an email or a phone number, so they can reply."
  - Sent: "Sent. Thanks, Sarah.", who has it and where the reply will go, and their own words said back.
- **Always light,** on every device, because both pages sit inside or beside someone else's website. The dark app
  theme doesn't reach them.

**Weak, named when proposed:**
- The business name shows twice when the form sits on their own site.
- The calendar buttons are a small new feature.


## A-066 — The rest of the app, as drawn (canvas v78, "The rest of the app") ^A-066

**Approved:** 2026-09-27, founder: *"yes build all six too"*, after the drawings of Pipeline, Numbers, What FollowUp
did, Coming up (desktop) and Follow-up plans (phone). Waiting on customers was already drawn and approved (A-050).
**What specifically:**
- **Pipeline:** the stages as quiet columns with each customer's value and a total per stage, and one line for won and
  lost this month. The first stage reads "New", not "New Lead". There are no score badges and no per-card stage
  dropdown: moving is by drag or from the person's page. "Only mine" replaces "My leads only". On the phone, one
  stage is open at a time.
- **Numbers:** one sentence with this week's reply speed and last week's; then answered, came back and booked, each
  with last week; eight weeks of "customers answered" as bars; then "Everything else". The phone drops the bars.
- **What FollowUp did:** grouped by day, one sentence per action with the customer's name, then channel and state.
  Tabs filter by kind.
- **Coming up (desktop):** grouped by day. Each row shows who, what, when, "unless … writes first", and whether it
  sends on its own or waits for an OK.
- **Follow-up plans (phone):** the three plans as one list, one opened, and "Use this plan" as its button.
- They all stay out of the menu (A-027).

## A-067 — Today built to its drawing (TodayCalm, TodayCalmPhone) ^A-067

**Approved:** 2026-09-27, founder: *"merge"*, after seeing Today's drawing next to the rebuilt screen (PR #367). This
followed *"i dont see the design on live that i built on canvas"*.
**What specifically:**
- **Phone:** the first customer opens on its own, showing who, the channel, the wait and their own words, then the warm
  reply card with Send and Edit, and Later, Don't send and We talked under it. The title is "N customers need you."
- **Rows:** the customer's own words, then why the reply is held, a channel glyph, and a solid black Review / Send.
- **Desktop:** Coming up is always the right-hand card, with booked calls inside it. About to be lost sits under the
  list. The week line is at the foot and opens Numbers.
- **Not on Today:** the setup strip and the test-lead button, unless nothing needs the owner. "What FollowUp did for
  you this week" and "See all numbers" are gone.
**Rule this sets:** a screen isn't done until it has been compared side by side with its board. Structural likeness
is not enough.

## A-068 — The side-by-side fixes and the rest of the app in the new look ^A-068
**Approved:** 2026-09-27, founder: *"merge"* (PR #368). This came after seeing the drawing-vs-app images and the More
settings before/after, and followed *"keep going until we changed the whole app i want the new design"*.
**What specifically:**
- Onboarding as OnbConnect, OnbChoose and OnbOldCustomers.
- Customers:
  - the A-029 state dots;
  - channel icons;
  - a customer opening beside the list (A-025), with the details, the timeline and the reply card when one waits.
- The conversation page on the phone with ThreadPhone's header.
- Settings › More settings in the overview's look:
  - quiet grey section labels;
  - one column;
  - underline tabs;
  - pill buttons;
  - nothing under 13px.
- Automation state drawn calm: a white card, ink words and one small dot, never a tinted alarm box.
- The 404 and error pages in the app's own type.
**Still open:** More settings and the person page's side column are restyled, not redesigned. They would each need a
drawing first.

## A-069 — Settings as one list, and the customer's side column ^A-069
**Approved:** 2026-09-27, founder: *"yes build them"*. This came after the drawings were checked against the research
(canvas v81: SettingsAll, SettingsAllPhone, SettingsChannel, PersonSide).
**What specifically:**
- **Settings:**
  - the plan and Pause first;
  - "Everything you can change" as one list in plain words, each row showing its state and opening its own page;
  - anything that stopped working shows first as "needs you";
  - "For advanced setups" last: CRM, other tools (Zapier, Make, webhooks) and routing.
  - The five tabs are gone.
- **The customer's side column:**
  - the facts in one card (State pill, Why, Waiting, Language, Came from, Stage, Assigned to);
  - three actions;
  - the state in one calm line;
  - the rest as quiet rows that open in place, with "How it handles …" open by default.
**Research behind it:** Stripe's three layers, Zapier's "a rule that can't run says so at the top", Calendly and NN/g
on hidden menus, Mercury's plain control, Attio's record panel, and the 2026-09-12 trust study.

## A-070 — Assisted by default, on every plan; the owner chooses in setup ^A-070

**Approved:** 2026-09-27, founder: *"Assisted should be the default but we will be asking them on onboarding what they
prefer and they can change it anytime."*
**What specifically:**
- Every new account starts on **Assisted**: every reply waits for the owner (`holdAllForApproval` defaults to true).
- Setup asks "How should FollowUp work?" with **Assisted chosen to start with**. Choosing Automatic is a deliberate
  tap, never the result of pressing the only button.
- **Any plan, Free included,** may choose Automatic in setup or in Settings, and change it any time.
- Only the per-customer "Handle it all" (no risk check at all) is a Plus feature.
**Supersedes the plan lines** that said Free is "assisted only".

## A-071 — The Monday email as drawn, except words on the wash ^A-071

**Approved:** 2026-09-28, founder: *"okay go with A"*, after *"what I'm receiving is not the same"* as the canvas
("Weekly email · designed", phone 390, and "desktop mail 760").
**What specifically:**
- **Two sizes, as drawn:** desktop mail is a 600px sheet in a framed page with 40px margins and the larger type
  (greeting 44, win 30, numbers 38); the phone is edge to edge with 24px margins and the smaller type (34, 26, 30).
- **The icons are kept:** one before each channel in "Where customers wrote from", and a calendar on the booking chip.
  They are carried pictures in the email's dim grey, so they show in Gmail and read in light and dark.
- **Logo at the drawn size** (59×22 top, 54×20 bottom). The footer follows the drawing's order: logo band first, then
  the words.
- **The one exception: no words on the wash.** The date, "Your week, …", the win card and the footer lines sit on the
  plain sheet below the wash, because Gmail's dark mode makes words on the wash unreadable. The founder chose this
  (option A) over matching the drawing exactly (option B).
- **Kept against the drawing:** the waiting box's mid-tone outline (EDGE). Without it the box disappears in Gmail's
  dark mode. The button's arrow is a text arrow, not a drawn one.
**Confirmed on the founder's phone,** 2026-09-28, from the real email sent by the preview link: *"email is good now"*.

## A-072 — "Write like me", the card in Settings → Your data ^A-072

**Approved:** 2026-09-28, founder: *"yes open the PR"*, after seeing the card on a phone.
**What specifically:**
- **The card:** a second card under "Help improve FollowUp", in the same pattern: icon tile (a reply arrow, never a
  sparkle), title, one paragraph, and a switch.
- **The copy** says four things in one paragraph:
  - what it reads: replies sent from Gmail in the last year;
  - what for: drafts that sound like you;
  - who it's for: only your own drafts;
  - how to undo it: turn it off and they're all deleted.
  - It also says names, emails and phone numbers are taken out first.
- **Behaviour:** off by default, and it can't be turned on until Gmail is connected.
- **Status:** one plain status line when it's on (a running count, never a badge).
- **Same PR:** the repeated lede on the Your data page ("Export everything, …" under "Download everything, …") is
  removed.

## A-073 — FollowUp asks the owner what a new employee would ask ("What FollowUp knows") ^A-073

**Approved:** 2026-09-29, founder: *"cool designes are good"*, after the six-screen board
(`prototypes/2026-09-29-owner-questions.html`, https://claude.ai/artifact/1TXxjPo7dUx8eCCvcLukyC). His idea: ask owners
about their business "like a new hired employee asks their manager", without annoying them.
**What specifically:**
- **The daily question (phone):** only in the "You're done for today" state, as one card: a mono label "One quick
  question · 3 of 7", the question, a one-tap answer (choices from the trade) or a short field, one line on why it's
  asked, a black "Save" and a quiet "Skip for now".
- **The daily question (desktop):** in the side column under Coming up, never above a customer.
- **In the moment:** when a held reply needs a fact FollowUp doesn't have (a price), the question sits inside the warm
  reply card. "Add to reply" fills the gap and remembers the answer.
- **From corrections:** after the third "Not a customer" of one kind, a bottom sheet asks "Set these aside from now
  on?" with "Yes, always" and "Just this one".
- **Settings → What FollowUp knows:** every answer in plain words, grouped (What you offer · Where and when · Who isn't
  a customer · Always check with me first), each editable, plus the on/off switch "Ask me a question now and then".
- **Rules:** at most one question a day. Never a notification, email or badge. A skip comes back once, a week later.
  After the first seven questions, it only asks when a real message needs the answer. No "AI" wording, no sparkles.
- **Trust:** answers are for this business only. They're used to sort messages and write replies, and they never
  train a model. Prices still wait for the owner's OK (A-070). Included in the data download and removed with the
  business.
**Left open on the board, accepted as drawn:** the desktop side-column placement. If it proves distracting in use,
desktop waits for an empty list too.

## A-074 — Settings wording: "Your business", "Can reply", and the founding-tester plan card ^A-074
**Date:** 2026-09-29 · **Source:** founder, one decision at a time, from the Settings Pages board
(https://claude.ai/artifact/AQEyWpThMtAUSKwBVBYe85).
**What specifically:**
- **"Your business"** replaces "Name and trade" as the Settings row and page title. "Trade" reads oddly to a realtor
  or a clinic.
- **"Can reply"** replaces "Sales" as the name of the non-admin team role, everywhere it shows. It says what the role
  does; "Sales" reads like a report or a team name.
- **Your plan, during the test:** the card is titled "Founding tester" (the Settings row says the same), and reads:
  "Everything is free while we test. You have every feature. When paid plans start, founding testers get a special
  price." and "We'll email you at least 30 days before anything changes. Nothing is charged without you choosing a plan."
**Why the softer price line:** the founder chose "a special price" over "a lower price for as long as you stay". It
still rewards testers, without locking a price in forever before costs are known. The 30-day notice and "nothing is
charged without you choosing a plan" are real promises and must stay true.
**Not approved yet (still only on the board):** merging "What FollowUp knows" into Your business, and the reworked
team rows. Only the wording above was decided.

## A-075 — "Reply on {site}" for lead-site customers, and the Team page's "drafts only" note ^A-075
**Date:** 2026-09-30 · **Source:** founder, "approve the drawing", on the Lead-Site Replies board
(https://claude.ai/artifact/Gc9LEGNVZ9WsStBWoMfyw3). Backlog b018 and b009.
**What specifically:**
- **When a customer came through a lead site that hides their contact** (Thumbtack, Angi, HomeStars, Kijiji…) and
  FollowUp has no email to write to, the warm reply card becomes **"Reply on {site}"**: one line saying the site keeps
  the email private, FollowUp's written reply (still with the "$ price" blank), and **Open {site} ↗**, **Copy reply**,
  and two quiet links, **I replied · Don't reply**. Every other customer keeps the normal card.
- **On the phone, one button does both:** "Copy & open {site}", with the two quiet links under it (A-026, R-015).
- **If the site shared a phone number,** "Call {number}" is the first button and "Copy & open {site}" the second.
- **"I replied"** works like "We talked" (A-039): one tap, no pop-up, a toast with Undo, a history line "You replied
  to {name} on {site} · {time}", and FollowUp stops reminding. A new message from them through the site shows up again.
- **"Open {site}"** opens the customer's own page when the site's email carries a link to it, else the site itself.
- **Team page, while "Only admins send" is on:** under each "Can reply" role, "Drafts only · only admins send"; on the
  phone it sits on the role line. Under the list, for admins: "'Only admins send' is on. People who can reply can edit
  drafts, and an admin sends them. Change". None of it shows when the setting is off.
**Why:** FollowUp can't press Send inside a lead site, even on Automatic (no connection to it), so the one step it
can't reach comes to the owner, with the words already written. A "Can reply" label that's untrue while only admins
send confuses teammates.
**Wording:** "I replied" stays (the founder approved as drawn; "Done on Thumbtack" was the alternative offered).

## A-076 — The status label says "Auto follow-up is off" instead of counting down ^A-076

**Approved 2026-10-01.** When auto follow-up is switched off for the whole account and nothing is due yet, a customer's
status label reads "Auto follow-up is off" in the calm slate colours, with the detail "FollowUp won't check in with
them on its own. Turn it on in Settings." It used to say "Next check in ~3h" or "Draft ready in ~3h", a countdown to
a message that would never be sent. Founder: "yes fix this". Principle: a label never promises something FollowUp
won't do. Once something is due, the existing coral "Paused — your auto follow-up is switched off" still applies.

## A-077 — The 30-minute "let me check" also goes out on Assisted ^A-077

**Approved 2026-10-01.** Founder: "fix all", then "Yes, send it on holding accounts too". When a customer asks a
price or a date and the owner hasn't answered in 30 minutes, the fixed holding line ("Thanks for asking! Let me check
and I'll send you the price soon.", translated, never a number or a day) now goes out on an Assisted account as well
as on Automatic. It is the one message an Assisted account sends without the owner's OK, so every place that makes
the "nothing goes out without you" promise names the exception in the same breath: the Assisted card in setup, the
Assisted line and the rules intro in Settings, and Today's empty state. Never on a thread FollowUp only inherited from
the inbox import. Supersedes the Automatic-only line in A-060's build notes.

## A-078 — Booking hours are the business's own: days, hours and time zone in Settings ^A-078

**Approved 2026-10-01.** Founder: "fix all", chose "Let each business set its own days and hours in Settings",
then "build it" on the mock (https://claude.ai/artifact/EptoXKiy8FkuAqU4rtkDhn). The booking card in Settings →
Email keeps its two calendar options and gains one block under them: seven day chips (Mon–Sun, Monday first), From /
To selects on the half hour, a time zone dropdown (Canada first, then the US), and one summary line, "People can
book Mon–Sat, 9:00 am–7:00 pm, Toronto time", with a quiet "Saved" tick for two seconds after each change. No Save
button: each change saves on its own, like the two options above it. **Default for everyone, existing accounts
included: Mon–Sat, 9 am–7 pm.** It replaces a fixed Mon–Fri 9–5 that was never shown anywhere. The time zone was
hidden and set to New York for every account; now it is the owner's, and it also governs the 8 am–8 pm sending
window. The two calendar options lose the words "fixed business hours".

## A-079 — The notice emails on the landing page's wash, one white card each ^A-079

**Approved 2026-10-01**, founder: *"cool looks better"* on take 2 (https://claude.ai/artifact/PPQ5aL8kRGi9NjjC2NPFRM),
after rejecting take 1 (R-025). The six emails FollowUp sends an owner outside the Monday digest (Reconnect Gmail,
access ends tomorrow, "{Name} is waiting for your reply", "{N} customers are waiting for your OK", more waiting, new
sign-in) share one shell:
- **The whole email is the hero wash** from the landing page (`landing.module.css` `.washHero`: peach, blue and rose
  radial gradients on cream #f3efea, with the grain), edge to edge, 600px sheet, 22px radius. In mail it is a picture,
  because Gmail drops CSS gradients.
- **The real lockup** top-left on the wash, the date top-right.
- **One white card** (border rgba(10,10,10,.06), radius 22, padding 30) holds everything you read: a dim uppercase
  label, the title in the light weight at 30px, soft body text, an optional sand sub-card (the weekly email's person
  row + a quote, or a quiet key/value table), the black pill button, and the dim "why" line.
- **Under the card, on the wash:** the four links and one line of small print saying who it went to and how often.
- **Light only, like the landing page.** Words never sit on the wash (A-071's rule), so Gmail's dark mode can darken
  the card and lighten the text without touching the picture.

## A-080 — One decision per screen on the desk: Today, the customer page, Settings ^A-080

**Approved:** 2026-10-03, founder: *"yes to all, build today first"*, on the boards in
`prototypes/2026-10-03-one-decision-desk.html` shown beside today's screens. This follows R-026 ("all of it,
too much stuff") and the Laws of UX pass (`research/ux-patterns/2026-10-03-laws-of-ux-applied.md`), whose ten
rules this approval adopts.
**What specifically:**
- **Today (desk):** the headline is the only count. The first person who needs the owner opens on the right
  (their words, the warm reply card, Send, Edit, Later, Don't send, We talked); everyone else is a plain list on
  the left, longest waiting first, each with their words and their wait. A booked call is one line under the
  list, only when one exists. The week line stays at the foot. Send is the one black element.
- **Customer page:** the thread and the reply card are unchanged. The side column is three facts (why it's
  here, waiting, came from), the three outline actions (We talked, Copy booking link, Email) and one "Details"
  row that opens the rest: how it handles this person, why it may write, what it did, the plan, stage, about,
  not a customer, delete.
- **Settings:** one column, five groups, the follow-up plan on top; the one broken thing first when there is
  one. No link grid, no status card that repeats a row.
- **Order:** Today first, then the customer page, then Settings. One PR each, compared with its board before
  merge (A-067).
**Supersedes, in part:** A-031 (the handled line leaves Today; "N of M handled" may return at the foot only when
M ≥ 5), A-045 (the numbers line leaves Today), A-046's "Start with" line (the order already says it) and its
"Coming up" card (a booked call becomes one line; automated check-ins stay on the Coming up page), A-069's side
column as drawn (now three facts, three actions, one Details). Everything else in those entries stands.
