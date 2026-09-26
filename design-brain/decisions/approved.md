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

**Approved:** 2026-09-26, founder: *"I believe we are going well with the desktop one."*
**What this covers:** the direction of the three desktop app artboards: sidebar, ruled table or list, the
open person or conversation beside the list, and the held reply as the one black card. It covers the
direction, not every detail. The state-dot colours are still a separate open question.
**In the same breath he rejected the phone versions (R-015),** so this approval is desktop-only.

## A-026 — Phone reply block: two buttons, plus a quiet "Don't send" link ^A-026

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
