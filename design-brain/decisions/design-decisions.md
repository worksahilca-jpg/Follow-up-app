# Design decisions log

The chronological record of **every design decision that matters**, whether or not the
founder was in the room.

`[[approved]]` and `[[rejected]]` record the founder's verdicts. This file records the
*reasoning* — including decisions Claude made autonomously while building, which future
sessions need to understand rather than silently re-litigate.

## What belongs here

- A structural or layout decision on any screen
- A choice between two or more viable approaches, with why one won
- A token, pattern, or component decision
- A decision to *not* do something obvious (often the most valuable entries)
- Resolving a `[TO DECIDE]`
- A deviation from an established pattern, with justification
- A design you shipped that you're not fully satisfied with, and why it shipped anyway

## What doesn't

Copy tweaks, bug fixes, one-off spacing corrections, or anything a future session
wouldn't need to know.

## Entry format

```
## D-00N — [Title]
**Date:** YYYY-MM-DD
**Decided by:** [founder | Claude (autonomous) | Claude, confirmed by founder]
**Status:** [active | superseded by D-0NN | reversed]
**Context:** What problem forced a decision.
**Options considered:** The real alternatives, not strawmen.
**Decision:** What was chosen.
**Reasoning:** Why — tied to a brand principle where possible.
**Trade-off accepted:** What this costs. Every decision costs something; name it.
**Revisit when:** The condition that should reopen this, or "stable".
```

**"Trade-off accepted" is not optional.** A decision log where every decision was
costless is a marketing document, not an engineering record.

---

## Decisions

## D-001 — The design brain precedes the design work ^D-001
**Date:** 2026-09-12
**Decided by:** Founder
**Status:** active
**Context:** FollowUp already ships a real application with a working token system built
ad hoc, alongside a strong product-direction document (`[[PRODUCT_DIRECTION]]`)
and a research practice (`followup/research/`). There was no equivalent for design:
each session re-derived visual decisions from scratch, and founder feedback lived only in
conversations that ended.
**Options considered:**
1. Keep designing screen by screen, documenting after the fact.
2. Build a design system (tokens + components) first.
3. Build a *design brain* — principles, memory, references, research, and process —
   before any further UI work.
**Decision:** Option 3.
**Reasoning:** The binding constraint isn't a missing token file — the app has usable
tokens. It's that design quality doesn't accumulate: preferences are forgotten, rejected
ideas return, and references are never analyzed. A token system alone would not fix any of
those. Principles and memory outlast values.
**Trade-off accepted:** No new UI ships during this pass, and some of the brain (the
reference library, competitor research) starts empty and stays empty until real input
arrives. An empty folder looks like incompleteness; filling it with invented content would
be worse.
**Revisit when:** Stable. The brain evolves; the decision to have one doesn't.

## D-002 — Document the shipping system as provisional rather than redesigning it ^D-002
**Date:** 2026-09-12
**Decided by:** Claude (autonomous) — flagged to founder for confirmation
**Status:** active
**Context:** The brief said to start from scratch and not choose final colors or
typography. The repository is not from scratch: `followup/src/app/globals.css` defines a
complete, coherent, in-production token system, and ~36 components depend on it.
**Options considered:**
1. Write the brand docs as if nothing exists, leaving every value `[TO DECIDE]`.
2. Document what ships, and treat it as decided.
3. Document what ships as `Current (provisional)`, with the genuinely open questions
   marked `[TO DECIDE]` alongside it.
**Decision:** Option 3.
**Reasoning:** Option 1 produces a design brain that contradicts the product on day one —
a future session reading it would "helpfully" invent a second color system. Option 2
would quietly ratify decisions the founder never made (notably the accent color, which
has changed three times without ever being decided). Option 3 is the only one that is both accurate and
leaves the real decisions open, which is what the brief actually asked for.
**Trade-off accepted:** The brand files are longer and less clean than a greenfield spec,
because they carry both the current state and the open question. Accuracy over tidiness.
**Revisit when:** The founder ratifies or replaces the current values — then the
provisional notes collapse into decided values.

## D-003 — Two files added beyond the specified structure ^D-003
**Date:** 2026-09-12
**Decided by:** Claude (autonomous)
**Status:** active
**Context:** The brief specifies an exact folder tree, and separately requires
documentation for border radius, shadows, elevation, grid, and badges. Those don't map to
any file in the specified tree.
**Decision:** Added `[[surfaces]]` (radius, borders, shadows, elevation) and
`[[badges]]` (badges, pills, score and priority indicators). Grid and
breakpoints went into `[[spacing]]`, which they naturally belong to.
**Reasoning:** The alternative was scattering elevation rules across unrelated files or
omitting them. Two clearly-named files beat both.
**Trade-off accepted:** The tree differs slightly from the brief. Flagged explicitly
rather than done silently.
**Revisit when:** The founder prefers a different organization.

## D-004 — The shipping app has drifted toward the aesthetic the brief rejects ^D-004
**Date:** 2026-09-12
**Decided by:** Claude (autonomous finding) — **founder decision required**
**Status:** active, unresolved
**Context:** While verifying the design brain's factual claims against the current branch
head, an audit of `globals.css` and `src/components/motion/` found decorative primitives
rendering inside the authenticated product:
- `AuroraBackground` — three oversized, blurred, drifting color fields — on the **dashboard**
- `.text-gradient-accent` — an animated shimmering gradient text treatment
- `.btn-shine` — a diagonal light sweep on primary CTAs
- `Reveal` (mount/scroll-triggered reveals) on dashboard, leads, and pipeline
- `CountUp` (animated counters) on lead metrics across three pages
- Unused but present: `SparkleBurst`, `TiltCard`, `KineticHeadline`, `ParallaxDots`

Separately, the accent token `--rust` has held three different values (blue → violet →
amber) and the typeface has changed at least twice — each time in place, none by a
recorded decision.

**Why this matters:** these map directly onto standing rejections [[rejected#^S-02|S-02]] (cheap gradients),
[[rejected#^S-07|S-07]] (unnecessary 3D), [[rejected#^S-08|S-08]] (random animation), [[rejected#^S-12|S-12]] (decoration that doesn't improve
usability), [[rejected#^S-13|S-13]] (AI gimmicks — sparkles), and [[rejected#^S-15|S-15]] (startup-template aesthetics).

**What is *not* being claimed:** that this work is bad or careless. It is the opposite —
every animation is gated behind `prefers-reduced-motion`, every color comes from the
palette, and each primitive carries a thoughtful comment defending its own restraint. The
craft is good. The drift happened anyway, one defensible commit at a time, because no
file existed that said "not this." That is exactly the failure the design brain prevents,
and finding it on day one is evidence the brain is worth having.

**Decision:** **None taken.** Documented in `[[visual-direction]]` and
`[[motion]]`, flagged to the founder, and deliberately not acted on. Ripping
decoration out of a shipped product is a product decision with real cost, and the brief
was explicit that this pass builds the design brain and does not change the UI.

**Trade-off accepted:** The design brain currently documents a product that contradicts it
in places. That inconsistency is visible and uncomfortable, which is correct — an accurate
description of a gap is more useful than a tidy document that hides it.

**Revisit when:** The founder decides whether to run a decoration audit. Until then,
**new** work follows the brain; existing decoration stays until it is explicitly reviewed.

## D-005 — Fix the measured contrast failures; do not touch the accent hue ^D-005
**Date:** 2026-09-12
**Decided by:** Founder ("go"), implemented by Claude
**Status:** active
**Context:** The 2026-09-12 audit found the amber accent failing AA as text (2.17:1 on
card, 1.91:1 on paper, 1.77:1 on `--rust-soft`) and all four status pills failing at their
rendered 12px size (gold 2.86:1, sage 3.00, coral 3.95, slate 4.34).
**Options considered:**
1. Change `--rust` to a darker amber that works as both fill and text.
2. Lighten the four soft tints instead of darkening the saturated shades.
3. Add a separate `--accent-text` token; darken the four saturated shades.
**Decision:** Option 3.
**Reasoning:** Option 1 would change the product's whole visual identity as a side effect
of an accessibility fix, and the accent hue is an open founder decision (see
`[[color-system]]`) — fixing contrast must not quietly settle it. Option 2 is
arithmetically impossible: the soft tints are already within a few percent of white, so
there is no room to move. Option 3 fixes both failures without altering a single hue, and
the new token documents the underlying rule — a fill and a text color have opposite
contrast requirements.
**Trade-off accepted:** One more token to keep straight, and a rule contributors must learn
(`--rust` for fills, `--accent-text` for text). Mitigated by a long comment in
`globals.css` stating the measured numbers and the reason. The four status colors are also
now marginally darker everywhere they appear, including as standalone error text and as
fills — verified to improve contrast in both cases, never worsen it.
**Verification:** All 14 pairs re-measured from the committed CSS. Every one passes.
Logo-mark uses of `--rust` deliberately left alone — logotypes carry no WCAG contrast
requirement.
**Revisit when:** The accent hue is decided. If a darker accent is chosen, `--accent-text`
may become redundant and should be collapsed back into `--rust`.

## D-006 — First research pass: read the repo's own research through a design lens ^D-006
**Date:** 2026-09-12
**Decided by:** Founder ("research"), conducted by Claude
**Status:** active
**Context:** `followup/research/` held 19 dated files of real customer and market research
that no design work had ever drawn on.
**Decision:** Read it as design input rather than commissioning new external research.
Six findings written up in `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`.
**Reasoning:** New research would have duplicated work already done, and the existing
material turned out to answer live design questions directly — two `[TO DECIDE]` items were
resolved by it (prioritized list over table; mobile-first for the core loop) and four brand
principles gained external evidence.
**Trade-off accepted:** **Confidence is capped at medium and stays there.** The source
research states that WebFetch was blocked in its sandbox, so every figure is a
search-snippet citation, some flagged by its own author as possibly vendor-influenced.
That is enough to steer design and not enough to print. No figure from this pass may appear
in product copy or on the landing page without a direct fetch first — recorded in the
write-up, the research log, and here, because this is exactly the kind of caveat that gets
lost between sessions.
**What it changes:** The **approve-a-draft screen** is now the highest-priority screen to
design — ahead of the dashboard and the lead card. It is where the trust the research
describes is either earned or lost, and it has never been designed against the brain.
**Revisit when:** A primary source or a real FollowUp user raises the confidence.

## D-007 — "Review": giving the approve-a-draft moment a place of its own ^D-007
**Date:** 2026-09-12
**Decided by:** Claude (proposed) — **awaiting founder approval, not yet implemented**
**Status:** proposed
**Context:** Research ([[design-decisions#^D-006|D-006]]) put this ahead of the dashboard as the product's most important
screen. Investigating the code first found something bigger than a styling problem:
**the approval moment has no home.** `suggestedMessage` is rendered in exactly one place —
`src/app/(app)/leads/[id]/page.tsx` — and nothing on the dashboard or leads list indicates a
draft is waiting. To approve three follow-ups an owner must guess which leads have them,
open each, and scroll past the header, the score, and the conversation to reach the composer,
which sits fourth on the page. For a contractor on a phone between jobs, that loop is broken
before any visual design enters into it.

**Options considered (five, genuinely different — not variants):**
1. **Queue** — dedicated full-screen triage, one draft at a time, keyboard-driven. Fast;
   risks becoming a conveyor belt that trains rubber-stamping.
2. **In place** — keep drafts in the lead page, promote above the fold. Full context;
   no way to clear several, still requires knowing which leads to open.
3. **Message-first** — render the draft as the message the customer will receive, context
   collapsed behind it. Directly answers the documented fear; less reasoning visible.
4. **Split list/detail** — pending drafts left, selected draft right. Good for orientation;
   the generic CRM answer, and poor on a phone, which is the primary device here.
5. **Approve from the notification** — no screen; approve from the alert. Fewest taps;
   far too little context for an irreversible message to a real customer.

**Decision:** **3 delivered inside 1** — a `Review` destination that shows one draft at a
time, rendered as the message it will become, with the reason above it and the full thread
one tap away. The queue is implicit on a phone (a counter) and visible on desktop (a rail).

**Reasoning:** The two research findings pull in opposite directions — speed matters
enormously (391% lift from a one-minute reply) and trust is the entire product (77% want to
approve before an agent acts). Optimising for speed alone produces a conveyor belt, and an
owner who stops reading drafts is worse than one who never enabled automation. The
resolution is not friction: it is making the content unavoidable. The message is the
largest thing on screen, so approving it means having looked at it. Speed then comes from
removing navigation, not from removing consideration.

**Trade-off accepted:** A new top-level destination on a sidebar already carrying seven
items — and `navigation.md` flags seven as the upper limit. Justified because this is where
the product's core promise is kept or broken, but it makes the Leads/Pipeline and
Dashboard/Activity consolidation question more urgent, not less. Also: one-at-a-time is
slower than bulk for an owner with twenty drafts waiting. That is the intended cost.

**Deliberately excluded:** bulk "approve all" (it is the blast-tool affordance, and [[rejected#^S-13|S-13]]'s
sibling); the sparkle icon and "AI-suggested follow-up" heading the current composer uses
([[rejected#^S-13|S-13]], and it feeds the exact fear in Finding 2); a confidence percentage (false precision);
an auto-send countdown (manufactured urgency on the calmest screen in the product);
swipe-to-approve (undiscoverable, and far too easy to trigger by accident on a real customer).

**Open / weakest points, named rather than hidden:**
- Whether `Review` is a new nav destination or a mode of the dashboard is genuinely
  unresolved. The mockup shows the former; the latter may be better given nav pressure.
- Not designed: the edit state, the multi-draft-per-lead case, and what happens when a lead
  replies while their draft is open for review — that last one is the "stops the instant a
  lead replies" guarantee meeting a race condition, and it needs real interaction design.
- The reason line quality depends entirely on `scoreReason` being written in plain language.
  If the model emits "engagement lapse detected", the whole screen fails. Unverified.

**Mockup:** static HTML, phone + desktop + all-clear + send-failure. Not a live screenshot.
**Revisit when:** The founder reviews it.

---

## D-008 — "Award Direction": a second, page-scoped visual system for the public landing page ^D-008
**Date:** 2026-09-13
**Decided by:** CEO (directed the concept and the specific standing-rule exceptions), Claude
(implementation)
**Status:** active
**Context:** The CEO reviewed a standalone HTML design exploration ("Award Direction" — deep
navy / professional blue / cloud white, Bricolage Grotesque + Public Sans + IBM Plex Mono,
with a WebGL orbit diagram, frost particles, cursor-glow, drifting background rings, an
animated gradient mesh, and a placeholder testimonial) and asked for it to become the real
`followup/src/app/page.tsx`, replacing the current amber/Plus Jakarta Sans landing page —
**landing page only**; `/signin` and the authenticated app keep the shared amber system.

**Decision:** Built the concept as a genuinely separate, page-scoped design system:
- New tokens in `src/app/landing-award.module.css` (`.root`): `--paper #f6f8fb`,
  `--ink #0b1f33`, `--ink-soft #46566b`, `--accent #2a5cdb`, `--accent-deep #17348a`,
  `--coral #c93752`, `--success #0f7c44`, etc. — scoped to this module only, never touching
  `globals.css`'s app-wide `--paper`/`--ink`/`--rust`, and never touching `/signin`'s
  `landing.module.css` (the warm amber system, which a shared `LandingNav`/`HeroMockup`
  would have forced this page to keep). New components live under
  `src/components/landing/award/` for exactly this reason — nothing there is imported by
  `/signin`.
- Three new `next/font/google` exports in `src/lib/fonts.ts` (`bricolageGrotesque`,
  `publicSans`, `ibmPlexMono`), following the existing `plusJakarta` convention rather than
  a `<link>` tag — consistent with how this codebase already loads fonts, and avoiding a
  render-blocking third-party font request.
- All copy is the CEO-approved, fact-checked copy from the (unmerged)
  `copy-fixes-conversion-thesis-audit` branch, reapplied by hand onto `main` rather than
  merging that branch: the real channel list (Gmail, Outlook, Twilio/SMS, Instagram,
  WhatsApp — no Stripe, which the exploration's copy had wrongly listed as a "channel"),
  the sourced stats (62% of calls to small businesses go unanswered, 63% of companies never
  respond to an inbound lead, 29–47 hrs average first-response time — not the exploration's
  unsourced 79%/47hrs), and the ASSISTED-by-default automation guarantee (low-risk,
  on-topic replies only, never once the lead has replied, everything else opt-in per lead).
- The exploration's placeholder testimonial ("Marcus Webb, Independent Consultant") is
  **omitted entirely**, not relabeled as an example — FollowUp has no real customers yet,
  and inventing attributed praise is exactly the failure mode a same-day stat-fabrication
  finding in this same design system flagged. The pricing section ships as a single
  centered card with no testimonial beside it.
- The exploration's WebGL/CSS orbit diagram (six channel "electrons" circling a glowing
  core, with hover tooltips and a firing-signal animation) is **cut, not simplified** — the
  hero's app-window mockup plus the hero's own "reads what you already use" pill row
  already carries the same information (which channels, and that they're unified into one
  conversation) without a several-hundred-line WebGL/fallback machine to maintain. This is
  the "hero mockup is probably enough on its own" option, not the "simple static channel
  row" option — a dedicated channel section would have been redundant with the hero, and
  the exploration's own per-channel "facts" ("Reads live, replies drafted in seconds") were
  unvetted copy no one asked for.
- The exploration's ambient decoration is cut wholesale, not tuned down: frost particles,
  cursor-follow glow, drifting background orbit rings, the animated multi-blob gradient
  mesh, the pricing card's spinning conic-gradient border, and the badge's ✦ sparkle icon.
  None of it explained anything; all of it was atmosphere. The background is flat and
  static. The one exception is the hero mockup's own idle float + mouse parallax (kept,
  same technique as the existing `HeroMockup.tsx` — it's the product demonstration itself,
  not ambient decoration behind it).
- The exploration's hero mockup used a frosted-glass treatment (`backdrop-filter: blur()`
  over translucent white). **Not carried over** — that specific texture is the standing
  [[rejected#^S-03|S-03]] rejection (excessive glassmorphism), and the CEO's override only named [[rejected#^S-07|S-07]] (3D),
  [[rejected#^S-08|S-08]] (ambient animation), and [[rejected#^S-13|S-13]] (sparkle). The mockup card here is opaque white, same
  as the shipping amber-system `HeroMockup.tsx`.
- The reveal-on-scroll pattern was reimplemented, not copied verbatim, because the original
  vanilla version's fix (IntersectionObserver + a `catchSkipped` scroll listener + a
  `@media print, (scripting: none)` CSS override) doesn't translate directly into React
  state. `RevealAward.tsx` + `reveal-registry.ts` check each element's own
  `getBoundingClientRect()` on every scroll/resize (one shared, rAF-throttled listener for
  the whole page) rather than relying on IntersectionObserver sampling at all — a fast
  programmatic scroll or an instant anchor jump can't skip an element between two observed
  instants and leave it permanently hidden, which was the actual, previously-real bug this
  pattern exists to prevent. `landing-award.module.css`'s `.reveal` rule additionally forces
  every section visible for `prefers-reduced-motion: reduce` and for `@media print,
  (scripting: none)`, so a PDF export or a JS-disabled visit never depends on the check
  running at all. Verified with a JS-disabled full-page screenshot: every section renders at
  rest; the sole gap is the hero's `21×` counter freezing at `0×` (see below).

**Reasoning:** A marketing/entry surface earning a distinct visual identity from the
in-product UI is already an established, accepted split in this codebase (the prior
amber-vs-token-system landing redesign) — this is the same move, once more, on the same
page, at the CEO's explicit direction. Keeping the new system genuinely separate (own CSS
module, own component directory, own fonts) rather than parameterizing the existing
`landing.module.css` with a "theme" flag was the only way to satisfy "this page gets its
own distinct visual system" *and* "do not touch `/signin`" simultaneously — a shared file
would have coupled the two pages' color decisions by construction.

**Trade-off accepted:** Two parallel marketing design systems now exist in the same
directory (`landing.module.css` for `/signin`, `landing-award.module.css` for `/`), plus a
second `HeroMockup`/`LandingNav`/`LandingFaq` component family under
`components/landing/award/`. This is deliberate duplication, not an oversight — but it
means a future visual-language unification of `/` and `/signin` (if the CEO ever wants one)
is a real, undone piece of work, not a small flag flip. Also: `CountUp` (reused as-is,
generic and shared elsewhere in the app) has no print/no-JS fallback of its own — the hero's
`21×` stat freezes at `0×` under those conditions. This is pre-existing behavior in a shared
component outside this task's stated scope (landing page visual system only), not a
regression introduced here; it's the one known gap in an otherwise-verified fallback.

**Deliberately excluded (do not re-propose on this page):** ~~the WebGL orbit diagram and
its flat-CSS fallback~~ — **SUPERSEDED same-day, see [[design-decisions#^D-009|D-009]] below**; frost particles, cursor-glow, drifting
background rings, animated gradient mesh, spinning conic-gradient borders ([[rejected#^S-08|S-08]] exception
used for the hero word-reveal, hover states, and the FAQ accordion only); the ✦ sparkle
badge icon and any other sparkle/AI-gimmick iconography elsewhere on the page ([[rejected#^S-13|S-13]] — the
CEO's override was for the hero badge specifically, not a blanket pass for this page); a
headline word-rotor cycling through synonyms ("went quiet" / "went cold" / "ghosted you") —
present in the exploration but read as decorative wordplay rather than the "explains a
sequence" motion the word-by-word reveal and FAQ accordion are; the fabricated testimonial,
under any label.

**Revisit when:** The CEO reviews the live page, or a future session is asked to unify `/`
and `/signin` onto one marketing visual system.

---

## D-009 — Orbit diagram reinstated in the hero, as CSS 3D rather than WebGL ^D-009
**Date:** 2026-09-13
**Decided by:** CEO (asked for the orbit diagram back, same day as [[design-decisions#^D-008|D-008]]; specified it
should sit in the hero), Claude (asked which visual shape and where before building,
implementation)
**Status:** active — supersedes the orbit-diagram exclusion in [[design-decisions#^D-008|D-008]]
**Context:** After [[design-decisions#^D-008|D-008]] shipped, the CEO reviewed the live page and asked for the orbit
diagram back ("the n8n 3D model as well"), confirming: (1) an orbit diagram — channel icons
circling a glowing core, not an n8n-style connected-node canvas — and (2) placed in the
hero, next to the headline.

**Decision:** Built `OrbitDiagramAward.tsx` + supporting styles in
`landing-award.module.css`, rendered behind (not replacing) `HeroMockupAward` in the hero's
right column:
- A tilted ring built from plain CSS 3D (`perspective` + `transform-style: preserve-3d` +
  `rotateX`), not WebGL/canvas/Three.js — no new dependency, and this codebase already uses
  CSS 3D for the hero mockup's own parallax. Five nodes (Gmail, Outlook, Twilio, Instagram,
  WhatsApp — the same five channels as the hero's own "reads what you already use" pill
  row, not the exploration's channel list) placed via `rotateZ + translateX`, each labeled
  with plain text in a pill matching the page's existing chip style — no per-channel
  "facts" invented, since the exploration's unvetted copy ("Reads live, replies drafted in
  seconds") was exactly what [[design-decisions#^D-008|D-008]] flagged as copy no one asked for.
- No frost particles, cursor-glow, firing-signal animation, or sparkle — those [[design-decisions#^D-008|D-008]] cuts
  stand; only the orbit shape itself came back. The core is a static gradient square (the
  same mark as the nav logo), not an animated glow.
- Pure CSS `@keyframes` animation, not framer-motion — nothing here needs per-frame JS
  control, so `prefers-reduced-motion: reduce` freezes the ring via the stylesheet directly
  rather than a second JS-driven code path (same outcome as `HeroMockupAward`'s
  `useReducedMotion` check, different mechanism because this element has no JS state).
- Desktop-only (`min-width: 1024px`, matching the hero's existing `lg:` stacking
  breakpoint) — there's no room for a ring around the mockup once the hero stacks to one
  column, and forcing it into that layout would have meant either shrinking it past
  legibility or overlapping the stacked copy above it.
- `aria-hidden="true"` on the whole diagram — it's decorative reinforcement of information
  the page states as plain text twice already (the pill row, the channel list in the
  page's own copy), not a second source of that information.

**Reasoning:** This is the CEO's own call to make — [[design-decisions#^D-008|D-008]] explicitly named the orbit
diagram as page-scoped-exception territory ([[rejected#^S-07|S-07]]), so reinstating it is a same-scope
adjustment of an already-granted exception, not a fresh standing-rule violation. Asked
before building rather than guessing which of "orbit diagram" vs. "n8n-style node graph"
was meant, and where — real WebGL/3D work is expensive to redo, and the two shapes read
as different products (a hub-and-spoke story vs. a pipeline/workflow story).

**Trade-off accepted:** The hero's right column now composites two 3D layers (the ring's
`rotateX` tilt, the mockup's own parallax tilt) in the same visual space. Kept them as
independent transforms on separate elements (never combined into one nested 3D context)
so each stays simple to reason about and neither fights the other's `will-change` hints.

**Revisit when:** The CEO wants the node-graph variant instead, wants the ring's radius or
spin speed tuned, or wants it extended to mobile.

---

## D-010 — Unify on the "Award Direction" navy/blue system app-wide; retire the warm-cream system ^D-010
**Date:** 2026-09-13
**Decided by:** CEO (explicit direction, asked directly: reskin the app to navy/blue rather
than bring the landing page back to cream), Claude (finding + implementation)
**Status:** active — supersedes [[design-decisions#^D-008|D-008]]'s scope restriction and [[approved#^A-001|A-001]]'s cream/amber baseline
**Context:** [[design-decisions#^D-008|D-008]] deliberately scoped "Award Direction" (navy `#0b1f33`/blue `#2a5cdb`,
Bricolage Grotesque + Public Sans + IBM Plex Mono) to the public landing page only, keeping
`/signin` and the authenticated app on the existing warm-cream/amber system (`globals.css`,
`landing.module.css`) — its own "Revisit when" named exactly this: a future session asked to
unify `/` and `/signin` onto one system. The CEO independently noticed the app now reads as
two different products ("our landing page is cool, but I've seen our internal pages... are
still the old ones") and, given the choice, chose to move the *app* rather than revert the
*landing page* — meaning the unification is now larger than [[design-decisions#^D-008|D-008]] anticipated: every
authenticated-app surface (dashboard, leads, pipeline, settings, workflows, analytics,
activity, onboarding) plus `/signin`, not just the marketing pages.

**Decision:** Navy/blue Award Direction becomes the one system-wide visual language.
Retire the warm-cream/amber tokens in `globals.css` and `landing.module.css` in favor of
tokens derived from `landing-award.module.css`'s `.root` scope, applied globally instead of
page-scoped. Implementation (in progress — see task tracker) extracts the Award Direction
tokens into `globals.css` as the app-wide system and reskins every authenticated-app page
and `/signin` to match, following the existing component/typography/motion conventions
`landing-award.module.css` already established rather than reinventing them per page.

**Reasoning:** The founder's own call on which visual identity represents FollowUp now —
not a Claude judgment call, and not something to default silently in either direction
given neither system was "approved" over the other (`design-brain/[[approved]]`
explicitly notes the cream baseline was "provisional... not ratified as final"). Once made,
this is exactly [[design-decisions#^D-008|D-008]]'s own named revisit condition firing, just wider in scope than that
entry anticipated.

**Trade-off accepted:** This retires [[approved#^A-001|A-001]]'s contrast-fix work (the accent-text token split,
the darkened status shades) as applied to the cream/amber values specifically — the
*principle* behind [[approved#^A-001|A-001]] (a fill color and a text color need separate tokens; measure
soft/saturated status pairs at their real render size, don't eyeball them) carries over and
must be re-verified against the new navy/blue values, not re-derived from scratch. Two
previously-separate marketing systems (`landing.module.css` for `/signin`,
`landing-award.module.css` for `/`) collapse into one, which is the intended outcome, not a
new trade-off. This is a large surface-area change (every authenticated page) shipped as a
tracked, reviewed body of work rather than a single sweeping commit.

**Revisit when:** The CEO reviews the reskinned app and either confirms it (record as
`[[approved#^A-002|A-002]]`) or asks for adjustments to specific screens.

---

## D-011 — Implementing D-010: token mapping, contrast re-audit, and what was deliberately left alone ^D-011
**Date:** 2026-09-13
**Decided by:** Claude (implementation of [[design-decisions#^D-010|D-010]], per [[approved#^A-002|A-002]])
**Status:** active
**Context:** [[design-decisions#^D-010|D-010]]/[[approved#^A-002|A-002]] decided *that* the app moves to navy/blue; this entry records the
concrete choices made while actually doing it, none of which the founder was asked to
adjudicate individually.

**Decision — keep token names, change values, again:** Every promoted token kept its
existing name (`--paper`, `--ink`, `--rust`, `--rust-soft`, `--on-accent`, `--slate`,
`--sage`, `--gold`, `--coral`, `--line`, `--card`) rather than renaming to match
`landing-award.module.css`'s own names (`--accent`, `--accent-deep`, etc.) — with one
addition, `--accent-deep`, since nothing existing covered "a darker step of the accent" and
several patterns from the landing page's own component language (button hover states, the
gradient-text mid-stop, the aurora wash) needed one. This is the same call the codebase has
made every previous time the accent moved (blue → violet → amber → this blue): renaming
`--rust` to something accurate is real, worthwhile cleanup, but it's an orthogonal, purely
mechanical change across ~90 call sites and bundling it with a value change would have made
this diff much harder to review for the thing that actually matters (are the new *values*
right). Logged as its own open `[TO DECIDE]` in `[[color-system]]`.

**Decision — collapse `--accent-text` back into `--rust`:** [[design-decisions#^D-005|D-005]] introduced
`--accent-text` because the retired amber (`#e8a23a`) failed AA as text (2.17:1) while
working as a fill. The new blue (`#2a5cdb`) clears AA in *both* roles from one value
(5.40–5.75:1 as text, 5.75:1 as white-on-fill) — measured, not assumed, per [[approved#^A-001|A-001]]'s own
standing principle that a fill and a text color have different requirements and must be
checked, not just carried over from the last hue. [[design-decisions#^D-005|D-005]]'s own "Revisit when" named this
exact condition. The four call sites that used `--accent-text` (`NotificationBell.tsx`,
`LogCallForm.tsx`, `workflows/page.tsx`, `embed/[businessId]/page.tsx`) now use `--rust`
directly; the token and its `@theme inline` mapping were removed from `globals.css`.

**Decision — new status-pill values, not the amber system's values carried over:** `--gold`
is unchanged (`#a35904`) — it already passed AA and doesn't visually collide with a blue
accent the way it did with amber. `--slate`, `--sage`, and `--coral` were re-derived and
re-measured against the new navy/cloud neutrals (see `[[color-system]]`'s contrast
audit for the full numbers: all four clear 4.5:1 on their own soft tint, on `--card`, and on
`--paper`, at the 12px size these pills actually render). `--coral` in particular is
**deliberately darker** than the landing page's own decorative `--coral` (`#c93752` in
`landing-award.module.css`, used there as a 3px card-border accent) — reusing that exact
value for 12px pill text measured 4.10:1, a silent AA failure. Same relationship `--gold`
already had to nothing in particular: a shared hue family, tuned per use, not one value
forced into two jobs with different contrast floors.

**Decision — `/signin` stops carrying its own token set:** `landing.module.css`'s `.root`
used to redeclare `--cream`/`--surface`/`--ink`/`--amber`/`--coral`/`--blue` locally so it
could diverge from the app's tokens. Now that there's one system, those local declarations
were deleted outright rather than just repointed to new values — the file's remaining rules
(`.nav`, `.appWindow`, `.signinChip`, etc.) reference the app's global custom properties
(`var(--ink)`, `var(--card)`, `var(--rust)`, ...) directly, inherited from `:root` in
`globals.css`. This is a real simplification, not just a recolor: one less place a future
session could accidentally let `/signin` drift from the app again. `SignInScene.tsx`'s two
aurora blobs, which used to be amber+blue, now use `--rust` and `--accent-deep` — two depths
of the one accent, not a second decorative hue. Its "92" score chip was recolored to
`--coral`/`--coral-soft`, matching `ScoreBadge.tsx`'s actual convention (a lead score is a
status, drawn from the urgency palette, never the accent) rather than reusing whatever the
old amber system happened to use there.

**Decision — `AuroraBackground.tsx` (rendered on the dashboard) recolored, not restructured:**
Its three blobs used three independent decorative hues before (amber/blue/coral,
deliberately *not* the app's own accent or status colors, per its own header comment). Kept
the same "not a status color" discipline: the three blobs are now two depths of `--rust`
(`#2a5cdb`, `#17348a`) plus a light tint of the same blue (`#b4c6f2`, not a token — pure
decoration, not meant to mean anything), rather than reaching for `--coral`/`--gold`/`--sage`
for the third one, which would have violated the standing rule that those colors mean
something everywhere they appear. Whether `AuroraBackground` should be on the dashboard at
all is [[design-decisions#^D-004|D-004]]'s still-open, still-unresolved question — out of scope here, which was a color
pass, not a decoration audit.

**Decision — fonts promoted at the layout level, not per-page:** `bricolageGrotesque`,
`publicSans`, and `ibmPlexMono` (already defined in `src/lib/fonts.ts` for the landing
page) are now also applied on `<html>` in the root layout, alongside `globals.css`'s
`--font-display`/`--font-body`/`--font-mono` pointing at them. `plusJakarta` was removed
from both the root layout and `/signin` (its only two call sites) and deleted from
`fonts.ts` — nothing imports it anymore. The landing page's own font loading in
`src/app/page.tsx` was left untouched (out of scope — [[design-decisions#^D-010|D-010]]/[[approved#^A-002|A-002]] explicitly said not to
touch the landing page); it now duplicates a font already loaded at the layout level, which
is harmless (same `next/font` options, same resulting `@font-face`) but is a small,
named inefficiency, not a correctness problem.

**Deliberately not done (named, not hidden):**
- **`HeroMockup.tsx`, `LandingNav.tsx`, `LandingFaq.tsx`, `FadeHeadline.tsx`** (the pre-Award
  landing components) still contain hardcoded amber/cream hex values. Confirmed via
  `grep` that none of the four is imported anywhere reachable from a route — they were
  already orphaned before this pass, when `src/app/page.tsx` moved to the Award components.
  Left untouched: recoloring dead code that renders nowhere would be busywork masquerading
  as thoroughness. Flagged here so a future session doesn't mistake their stale colors for
  a live bug, and doesn't mistake their continued existence for a decision to keep them.
- **`global-error.tsx`** intentionally stays outside the design system (documented in its
  own header comment: it renders when the root layout itself has failed, so it can't rely
  on `globals.css` or the app's fonts loading at all). Not touched, on purpose.
- **The `--rust` → `--accent` rename** (see above) — logged as `[TO DECIDE]`, not done.
- **A second re-run of [[design-decisions#^D-004|D-004]]'s decoration audit** (aurora, shine, shimmer, `Reveal`/
  `CountUp` on dashboard/leads/pipeline) — this pass recolored those primitives to fit the
  new palette because leaving them in the retired amber would have been a visible bug, not
  because their presence was reconsidered. That question is still open and still the
  founder's to decide.

**Trade-off accepted:** The visual identity moved cleanly, but the app now carries the same
few unresolved code-quality loose ends it carried before (an unrenamed `--rust` token, four
orphaned components, an unresolved decoration audit) — this pass fixed *colors*, not every
pre-existing gap the color system's own docs already flagged. Re-litigating those would have
expanded this from "reskin the app to match the landing page" into "also finish three
unrelated cleanups," which wasn't what was asked and would have made the diff harder to
review for the one thing that mattered here.

**Verification, done this session:** `npx tsc --noEmit` clean. `npx eslint` on every changed
file clean. `npx vitest run` — 554/554 tests pass (a purely visual pass; any failure would
have meant an accidental logic change, and there were none). `rm -rf .next && npm run
build` succeeds (the expected sandboxed Supabase `P1001` warning during `prisma migrate
deploy` appears and is non-fatal, exactly as expected; `next build` itself reports
"Compiled successfully"). Screenshots taken with a locally-launched Playwright Chromium
against the real production build: the landing page live, scrolled section-by-section at
1440×900 (confirms it renders exactly as before — untouched, per scope); `/signin` live,
confirming the aurora wash, chip colors, and card all read correctly on the new tokens.
Authenticated pages can't be screenshotted live without a seeded session, so Dashboard/
Leads/Pipeline/Settings were built as static HTML mockups **using the real token values**
(not approximated) and screenshotted the same way, clearly labeled as mockups.

**One verification note, not a regression:** a `fullPage: true` Playwright screenshot of
the live landing page (a single resized-viewport capture, not an incremental scroll) showed
several sections blank. Re-tested by actually scrolling the page in increments of ~850px
(simulating a real visitor) and every section rendered correctly — this is a known
characteristic of that specific capture method against `RevealAward`'s scroll-position
mechanism, not a bug in the page, and nothing in this pass touched `RevealAward.tsx`,
`reveal-registry.ts`, or `page.tsx`. Noted here rather than silently discarded, since a
future session using the same blunt full-page-screenshot method would otherwise reasonably
conclude the page regressed.

**Revisit when:** The founder reviews the reskinned app end to end (screenshots taken this
session: landing page live at rest — unchanged, per scope — `/signin` live, and static
mockups of Dashboard/Leads/Pipeline/Settings since those require auth). Any of the "not
done" items above are fair game for a follow-up session.

---

## D-012 — Eight convergent audit findings: presentation/copy fixes, no token or IA changes ^D-012

**Date:** 2026-09-13
**Scope:** `AddLeadForm`, `OnboardingForm`, `Sidebar`, `StatCard`, `analytics/page.tsx`,
`SetupStrip`, `settings/page.tsx` (Team → Lead routing), `PipelinePageClient`.

Two independent new-user UX audits converged on eight small, concrete defects — all
presentation/copy bugs, none touching the ink-vs-rust accent question, the "going cold"
gold semantic, or body-text color, which stay open founder-level questions per
`[[color-system]]`'s `[TO DECIDE]`s. Each fix reused an existing pattern rather than
inventing one; none required a new token or component.

1. **Add-lead modal didn't close on Escape** — `[[modals]]` calls this
   non-negotiable. No modal in the codebase had an Escape handler yet (checked
   `ImportLeadsForm`, `LogCallForm`, `SmartViewForm`, `LeadTrustPanel` — same gap in all
   four, not fixed here since the audit scoped this to Add-lead only). Added a
   `keydown`-listener `useEffect` calling the existing `onClose` prop. **Flag for a future
   session:** the other four overlays share this gap and should get the same treatment —
   ideally as one shared hook (`useEscapeToClose`) rather than four more copies of the same
   `useEffect`, once that's in scope.
2. **Onboarding's industry `<select>` defaulted to "Real estate"** — a real "picked the
   wrong option by doing nothing" trap. Changed the default state to `""`, added a disabled
   `value=""` placeholder option ("Select an industry"), marked the `<select>` `required`,
   and added the matching client-side check before submit. Verified both the native
   browser constraint-validation message and the custom error path fire correctly.
3. **Sidebar said "Workflows," the page it points to calls itself "Follow-up plans"**
   everywhere (H1, empty state, its own copy) — renamed the nav label only, left the page
   untouched, since the page's language was already the established one and the audit
   confirmed nav was the outlier.
4. **`StatCard`'s label row had no reserved height**, so a two-line label ("Reply rate —
   automated") pushed its value down relative to a one-line neighbor ("Reply rate —
   manual") in the same grid row. Fixed generically in the shared component — `min-h-
   [2.25rem]` on the label paragraph, `items-start` on the row — rather than shortening the
   one label, since the same failure mode is latent for any future StatCard label anywhere
   in the app, not just these two. Verified pixel alignment via a cropped screenshot;
   verified no regression on Leads/Pipeline's short single-line labels.
5. **Analytics had no empty state** — unlike Leads/Pipeline, which both show `EmptyState`
   with "Connect Gmail in Settings..." + a "Go to Settings" action when there's no data.
   Gated on `data.totalLeads === 0`; when true, the whole stat grid + charts + team section
   are replaced by the same `EmptyState` component (bare, unwrapped, matching Pipeline's
   treatment more than Leads' card-wrapped one, since Analytics has no surrounding list
   container to justify the wrapper). Copy closely mirrors the existing Leads/Pipeline
   phrasing rather than inventing new language — this is a UI-pattern fix directed and
   scoped explicitly enough that it didn't need a fresh product-ux-agent spec, but any
   *further* wording pass on this copy still belongs to that agent.
6. **Trial banner's "· 3 more after this" was uninterpretable on its own.** Traced the
   actual referent: `SetupStrip` renders `getIncompleteSetupSteps()`'s ordered list
   (billing → gmail → phone → widget from `setupStatus.ts`); "N more" is a count of the
   *other* incomplete setup steps, unrelated to `TRIAL_PERIOD_DAYS` (14, from
   `billing.ts`) or to any billing tier. Rewrote to "N more setup step(s) after this" —
   the minimal change that makes the referent explicit without restructuring the strip.
7. **Settings → Team → Lead routing had the same sentence twice** — the page-level subhead
   ("Give a lead a head start... before anyone's looked at it") and `SourceRoutingSection`'s
   own intro line ("What happens automatically... before anyone looks at it") said the same
   thing. Kept the box's line — more concrete (names the actual mechanism, "the moment a
   new lead comes in from each source") — and deleted the page-level subhead entirely,
   which matches an existing pattern already used elsewhere in the same file (CRM sync,
   Website widget, Lead webhook, Outbound webhook sections all have an H2 with no subhead
   at all, letting the section's own content explain itself).
8. **Pipeline's empty state repeated 8 times** — the top-level "No leads yet" `EmptyState`
   plus all 7 kanban columns each saying "No leads at this stage." Suppressed the
   per-column line only when the *unfiltered* `leads` prop is empty (the whole pipeline has
   zero leads, business-wide) — not when a "My leads only" filter merely yields zero
   visible leads while other leads exist elsewhere, since that's a different, legitimate,
   non-redundant empty state the audit explicitly said to preserve. Verified both branches
   via screenshot: an all-zero business renders 7 blank columns under one top message; a
   business with 5 real leads still shows "No leads at this stage" on its actually-empty
   columns (Qualified, Proposal Sent, Negotiation, Won, Lost).

**Why these and not others:** All eight are presentation/copy corrections inside existing
patterns — no new component, no new token, no IA change. Deliberately did not touch: the
ink-vs-rust primary-button question, the gold "going cold" semantic, body-text color tint
(all explicitly out of scope per the task), or the other four modals' missing Escape
handlers (out of scope for *this* pass, flagged above for a future one).

**Verification, done this session:** `npx tsc --noEmit` clean. `npx eslint .` clean.
`npx vitest run` — 554/554 pass. `rm -rf .next && npm run build` succeeds. Every fix
verified against a live locally-running instance (isolated `followup_test` Postgres DB,
`prisma migrate deploy` already current, three seeded test businesses — one with 5 leads,
one with zero leads, one pre-onboarding — and minted NextAuth JWT session cookies, no real
Google OAuth needed) via Playwright screenshots at 1440×900, not static mockups, since
these are all authenticated pages but a full local stack was available and used instead of
settling for a mockup.

**Revisit when:** Someone picks up the flagged "shared Escape-to-close hook" cleanup for
the other four modals, or product-ux-agent wants a further wording pass on the Analytics
empty-state copy beyond the minimal Leads/Pipeline-matching version shipped here.

---

## D-013 — Platform admin dashboard (`/admin`): a founder-only, cross-tenant screen with its own visual scope ^D-013

**Date:** 2026-09-13
**Decided by:** Claude (autonomous — no `product-ux-agent` copy spec existed for this internal
tool; kept the copy minimal, literal, and un-marketed rather than inventing a voice for it)
**Status:** active

**Context:** New feature, not a redesign of anything in `[[approved]]`/`[[rejected]]` — a
platform-wide view (total businesses, leads platform-wide, channel/tier breakdown, a rough
MRR estimate, active-vs-dormant, recent signups) for the founder only, at `/admin`, hidden
from the Sidebar and gated by a new `PLATFORM_ADMIN_EMAILS` allowlist independent of both
`ALLOWED_EMAILS` (ordinary sign-in) and any business's own `TeamRole` (per-business admin).

**Decision — reuse the Analytics page's visual language exactly, don't invent an "admin" look:**
Same `StatCard`, same Recharts primitives via `src/lib/chart-colors.ts` (`CHART_PRIMARY`
for bars that are just counts, `CHART_INK` for the horizontal channel chart, matching
`AnalyticsCharts.tsx`'s own `CHART_PRIMARY`/`CHART_INK` split), same
card/border/spacing tokens. No Sidebar (this route isn't part of `(app)`'s route group at
all — no dependency on the caller having an onboarded business, since a platform admin's own
business status is irrelevant here), no aurora/shine/count-up decoration: this is an
internal ops tool, and brand principle 2 ("calm over urgent") plus the standing [[rejected#^S-06|S-06]]/[[rejected#^S-08|S-08]]
rejections argue for the plainest possible rendering of real numbers, not a demo moment.

**Decision — StatCard icon colors follow Analytics' own established (if not perfectly
`color-system.md`-compliant) convention, not a fresh interpretation:** `color-system.md`
states status colors (`--slate`/`--sage`/`--gold`/`--coral`) are for lead-urgency semantics
"everywhere they appear, forever" — but the *shipped* Analytics page already uses them as a
looser categorical convention on `StatCard` icons (slate = neutral count, sage = positive
outcome, gold = money), unrelated to lead urgency. Matched that shipped convention here
(slate for count metrics, sage for "Active businesses," gold for "Estimated MRR," slate
again for "Dormant" rather than reaching for coral, since a dormant business is a normal
SaaS fact, not an error — manufacturing urgency there would fight brand principle 2) rather
than either inventing a third convention or unilaterally "fixing" Analytics' drift as part
of an unrelated task. **Flagging, not resolving:** this is the same tension `color-system.md`
already names as open (status colors used decoratively is exactly what the doc's own rule
forbids) — a future session doing a real color-system consolidation pass should look at
`StatCard` usage on both pages together, not just one.

**Decision — no bespoke "admin chrome":** no logo swap, no "internal tool" visual signaling
beyond the H1 and subhead saying what the page is and who it's for in plain language. The
generic app-wide `not-found.tsx` (compass icon, "Can't find that page," a link back to
FollowUp) is what a non-admin sees — deliberately not customized, since a distinctive 404
for this one route would itself be a signal that something special lives behind it.

**Bug found and fixed en route, not part of the original scope:** `TeamPerformanceSection.tsx`'s
grid (`grid-cols-[minmax(0,1fr),auto,auto,auto]`) uses **commas** between Tailwind arbitrary
`grid-template-columns` tracks. That compiles to literally invalid CSS
(`grid-template-columns: minmax(0,1fr),auto,auto,auto`, which the browser discards outright),
silently collapsing every row to one stacked column instead of four — confirmed by inspecting
the actual compiled stylesheet, not assumed. This codebase's own established pattern (the
only other place a multi-track arbitrary grid template existed) was itself broken, and the
admin dashboard's own "Recent signups" table was built by pattern-matching it, so it shipped
with the identical bug on first render — caught in the required screenshot-verification step,
not by inspection. Fixed both call sites to use `_` (space) between tracks, which Tailwind's
arbitrary-value syntax requires. Re-screenshotted after the fix to confirm the real render,
not just the diff. **This means `TeamPerformanceSection` (Analytics → "Team performance,"
visible only for businesses with more than one teammate) was silently broken in production
before this change** — worth a note for whoever next touches that page, since nothing else
in this task's scope exercises that code path.

**Verification, done this session:** `npx tsc --noEmit` clean (after `npx next typegen` to
refresh the stale route-type cache for the new `/admin` route — a one-time codegen step, not
a code change). `npx eslint .` clean. `npx vitest run` — 571/571 pass, including new
access-control regression tests (`isPlatformAdmin`'s fail-closed behavior, `requirePlatformAdmin`'s
notFound()-not-a-403 behavior, and `getPlatformAdminData`'s aggregation logic). Verified
against a real, isolated local Postgres DB (`followup_test`, freshly created, `prisma migrate
deploy` applied), seeded with 10 synthetic businesses spanning all three tiers, several
subscription statuses (including canceled/past_due paid tiers, to verify the revenue estimate
correctly excludes them), varying lead volumes across many `source` values, and a mix of
Gmail/Outlook/Instagram/Facebook connections — via a locally-run dev server (a different port
than an unrelated concurrent session already using 3000 on this shared host) and a minted
NextAuth JWT session cookie (no real Google OAuth needed, same technique as [[design-decisions#^D-012|D-012]]). Screenshotted
with Playwright Chromium: the real rendered `/admin` dashboard for an allowed email (200,
real seeded data), and the real generic 404 for a non-admin email (404, not a distinguishable
"not authorized" response). `rm -rf .next && npm run build` succeeds, `/admin` appears in the
route table as dynamic (ƒ), with the expected sandboxed Supabase `P1001` warning during
`prisma migrate deploy` and nothing else.

**Revisit when:** `product-ux-agent` wants real copy for this screen instead of the literal,
un-marketed placeholder text shipped here; or a future session runs the color-system
consolidation pass this entry flags for `StatCard`'s status-color usage on Analytics/Admin
together.

---

## D-014 — Ink, not the accent, is the real primary-button color in the shipped app — update `[[buttons]]` to match, don't "fix" the 37 ^D-014
**Date:** 2026-09-13
**Decided by:** Claude (frontend-3d-agent), proposed — **approved by founder 2026-09-13**, see `[[approved#^A-003|A-003]]`
**Status:** approved — implemented (`[[buttons]]` updated, `LeadWorkflowEnrollment`'s outlier fixed)
**Context:** `[[buttons]]` documents "accent fill, `--on-accent` label" as the primary-button
spec. A grep of `followup/src/` for the actual inline styles
(`backgroundColor: "var(--ink)"` vs. `backgroundColor: "var(--rust)"`) found the audit's
37-vs-12 split confirmed almost exactly: **38 `--ink` fills, 12 `--rust` fills.** Two prior
reads disagreed on whether this is a problem. It isn't random — the split is a clean,
consistent pattern by *surface*, not a mistake by *button*.

**What the grep actually shows:**
- **Every primary CTA inside the authenticated app's core screens uses `--ink`:** "Add
  lead," "Save workflow," "New plan," "Start free trial," "Manage billing," "Send"
  (feedback), the active Settings tab, and — the single highest-stakes button in the whole
  product per `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`
  Finding 1 — `ApprovalQueue`'s **"Approve and send."** None of these are `--rust`.
- **`--rust` fills split into two honest categories, both already compliant with
  `[[color-system]]`'s own rule ("accent only on interactive elements: buttons, links,
  active nav, focus rings, selected states"):**
  1. Genuine accent-only elements: the active-nav rail (`Sidebar.tsx`), the unread-count
     badge (`NotificationBell.tsx`), toggle-on/selected-tab/selected-radio fills (Settings'
     automation toggles, `BookingCalendarConfig`, `LeadAutomationToggle`, workflow step-type
     dots), small inline text links ("Add step," the `Sparkles` icon on "Use recommended
     cadence"). These are not "primary buttons" at all — they're exactly what the accent is
     for.
  2. Primary-button fills, but only on the three surfaces that sit *outside* the
     authenticated app's own chrome: the public lead-facing booking page
     (`book/[leadId]/page.tsx`, "Confirm [time]"), the public embeddable widget
     (`embed/[businessId]/page.tsx`, "Send message"), and the global error boundary
     (`error.tsx`, "Try again" — a page that by definition renders when the app shell has
     already failed).
- **One genuine outlier, not a second category:** `LeadWorkflowEnrollment`'s small inline
  "Put on plan" button (`leads/[id]/page.tsx`) uses `--rust` despite living inside the core
  app next to `--ink`-styled buttons on the same screen. This is the one real inconsistency
  the audit found — see the trade-off below.

**Options considered:**
1. Fix the 38 to use `--rust`, matching the documented spec.
2. Fix `[[buttons]]` to document `--ink` as the primary-button color for the authenticated
   app, and scope `--rust`-as-primary-fill to public/outward-facing pages plus its existing
   accent-only roles.
3. Leave both the spec and the code as-is, unreconciled (the status quo one prior audit
   accepted).

**Decision:** Option 2. Update `[[buttons]]`'s primary-button row to: **"Primary — `--ink`
fill, `--paper`/white label — the default for every authenticated-app screen. `--rust` fill
is reserved for accent-only roles (nav, focus, toggles, selected states, inline links) and
for the handful of pages a business's own customer sees directly (the public booking page,
the embeddable widget) or that render when the app chrome itself is unavailable (the global
error page)."** Fix the one real outlier (`LeadWorkflowEnrollment`'s "Put on plan") to
`--ink` for internal consistency — flagged here for implementation, not done by this task
(this task is research/recommendation only, no `followup/src/` edits).

**Reasoning:** This is the founder's call to confirm, not mine to ship silently — per
`CLAUDE.md`'s "finalizing a `[TO DECIDE]` token requires asking first" — but the case for
option 2 over option 1 is strong on the brand principles themselves, not on which is less
work:
- **Brand principle 8 (precision, restraint) and standing rejection
  [[rejected#^S-15|S-15]] ("startup template aesthetics"):** a bright accent-fill button on
  every "Add," "Save," and "Send" in the product is *the* generic SaaS default — the first
  thing every template ships. Reserving the accent for a narrower set of true interactive
  signals (which nav item is active, which toggle is on, where focus is) and using the
  calmer near-black `--ink` for ordinary action buttons is a more disciplined, Linear/
  Notion-style restraint, not a compromise.
- **Brand principle 2 (calm over urgent):** if `--rust` fired on every primary button, its
  meaning would dilute from "this is the interactive/selected thing" to "this is just what
  buttons look like" — the same failure mode `[[color-system]]` names for status colors
  used decoratively ("once green is decorative, green can no longer mean 'fine'"), applied
  to the accent instead of a status color.
  Colors mean more when they're used less; a button that's *always* colored stops
  signaling anything.
- **Brand principle 1 (trust) — the strongest evidence:** `ApprovalQueue`'s "Approve and
  send" is, per the design brain's own research
  (`research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`,
  Finding 1: *"the approve-a-draft screen is the highest-stakes surface in the product"*),
  the single most consequential click a user makes — it sends a real message to a real
  customer on the business's behalf. Rendering it in calm near-black rather than a bright
  "look-at-me" blue fill is the right instinct even if nobody articulated it as a rule when
  it shipped: it reads as a considered, serious confirmation rather than a marketing-style
  "click here" CTA. Making it blue to match the spec would be a regression dressed as
  consistency.
- **Where `--rust`-as-primary-fill *does* still make sense, it already lines up with a
  real distinction:** the booking page and the embed widget are surfaces a business's own
  *customer* sees and interacts with directly — closer in spirit to the landing page/
  `/signin` (which also use `--rust` for their primary actions) than to the operator's own
  dashboard. The operator's tool is calm and near-monochrome; the lead-facing surfaces get
  a touch more of the brand's one accent color. That's a defensible split worth keeping and
  naming, not collapsing into one rule.
- **What would justify option 1 instead:** if the founder's actual reaction to a live
  screenshot is that `--ink` primary buttons read as flat or unfinished rather than calm —
  a real possibility this session couldn't test, since `--ink` buttons are common in the
  navy/blue system but this specific comparison hasn't been shown to the founder since the
  A-002 reskin. That's exactly why this is proposed, not decided.

**Trade-off accepted:** Formalizing "`--ink` is primary inside the app" means the app's
primary buttons carry less color than `[[buttons]]`'s original one-line rule implied, which
some readers may find under-designed compared to a more colorful competitor screenshot.
It also means `--rust` earns a second job (primary fill on three specific outward-facing
pages) that isn't a single clean rule ("accent = interactive only") — it needs the two-part
carve-out written above to stay legible to a future session, and a future session that
skims only the summary line risks missing why `book/[leadId]` and `embed/[businessId]`
get an exception. Naming the carve-out explicitly, not leaving it implicit, is meant to
close that gap.
**Revisit when:** The founder reviews this against the live app (screenshots/mockups) and
either confirms (move to `[[approved]]`) or asks for the 38 to move to `--rust` instead
(reopens as option 1). If confirmed, update `[[buttons]]`'s primary-button spec and fix
`LeadWorkflowEnrollment`'s outlier in the same pass.

---

## D-015 — "Going cold" stays gold, not slate — the axis is escalation, not literal temperature; flag `[[color-system]]`'s wording, not its value ^D-015
**Date:** 2026-09-13
**Decided by:** Claude (frontend-3d-agent), proposed — **approved by founder 2026-09-13**, see `[[approved#^A-004|A-004]]`
**Status:** approved — implemented (`[[color-system]]`'s `--gold` wording reworded)
**Context:** A reviewer flagged that `--gold` (going cold) sitting next to `--coral` (hot)
on `LeadsPageClient`'s stat row (`Hot` / `Going cold` StatCards, coral `Flame` icon next to
gold `Snowflake` icon) reads as "two different warm colors" rather than a clear
hot-to-cooling gradient, and proposed something cooler — e.g. `--slate` — instead.

**Options considered:**
1. Keep `--gold` for "going cold."
2. Reassign "going cold" to `--slate` (cooler, blue-gray, closer to a literal "cold" hue).
3. Introduce a new, dedicated "cooling" hue distinct from both.

**Decision:** Option 1 — keep `--gold`. Reject option 3 outright (violates
`[[color-system]]`'s own foundational rule, "four color roles and nothing else" /
"no new color without a new meaning" — introducing a fifth status hue for one label is
exactly the drift that rule exists to prevent). Reject option 2 for the reasons below, but
recommend a **wording fix, not a value change**, in `[[color-system]]`'s description of
`--gold` (see Reasoning).

**Measured, not eyeballed, per [[approved#^A-001|A-001]]'s and D-011's precedent (both options clear AA at
the actual 12px pill/text size, on their own soft tint):**
| Pair | Ratio |
|---|---|
| `--gold` (`#a35904`) on `--gold-soft` (`#fef3c7`) | 4.73:1 ✅ (already in `[[color-system]]`'s audit) |
| `--slate` (`#56677e`) on `--slate-soft` (`#eef1f6`) | 5.10:1 ✅ |
| `--slate` on `--gold-soft` (hypothetical swap, same bg) | 5.19:1 ✅ |
| `--gold` on `--card` (white) | 5.27:1 ✅ |
| `--slate` on `--card` (white) | 5.77:1 ✅ |
Both hues clear 4.5:1 comfortably in every pairing checked. **This is not a contrast
question — both are legible — so the decision has to be made on meaning, not on a
measured failure**, unlike the four-shade darkening in [[approved#^A-001|A-001]]/D-005, which was forced
by a real failing number.

**Reasoning:**
- **The four status colors already encode a traffic-light *severity* ramp
  (sage → gold → coral: fine → caution/act soon → urgent), not a literal temperature
  scale.** `[[color-system]]`'s own table defines `--gold` as "Warming / warning /
  attention soon" — the intended reading is "this is escalating, act before it becomes
  urgent," the same amber-before-red convention used everywhere from traffic lights to
  battery indicators. Swapping to `--slate` (documented meaning: "Neutral / informational /
  medium") would trade a *warning* color for a *neutral* one on a stat that exists
  specifically to prompt action — "going cold" is not neutral information, it's the thing
  the whole product exists to prevent (`PRODUCT_DIRECTION.md`: "no lead is lost because of
  no follow-up, late follow-up, or wrong follow-up"). A neutral gray Snowflake reads as
  "FYI," which undersells exactly the leads FollowUp's core mission is about.
- **`--slate` is already spoken for in the same stat row.** `LeadsPageClient` renders
  `Total` in `--slate` immediately to the left of `Hot`/`Going cold`/`Won` — reassigning
  "going cold" to `--slate` would make two adjacent StatCards share one hue for two
  unrelated meanings (a neutral count vs. a warning), which is precisely the failure mode
  `[[color-system]]`'s rule 4 exists to prevent ("each color means exactly one thing,
  everywhere, forever"). Trading a mild "two warm hues look similar" problem for a "one
  hue means two different things four inches apart" problem is not an improvement.
- **Ties to brand principle 2 ("calm over urgent"):** the reviewer's instinct — that hot
  and cooling shouldn't read as the same register — is the right instinct, but the fix
  brand principle 2 actually recommends is proportionate escalation (sage → gold → coral),
  not defusing the warning into a neutral gray. Calm-over-urgent means *not manufacturing*
  urgency for things that don't need it, not *removing* signal from a state that
  legitimately needs a nudge before it becomes a coral-level miss.
- **The real, narrower problem is the icon, not the color:** a literal `Snowflake` icon
  rendered in a warm amber genuinely mixes metaphors at the icon layer (cold imagery, warm
  hue) — that's the part of the reviewer's complaint that holds up on inspection. Per
  `[[color-system]]` rule 3, color is never the only signal; the `Snowflake` icon *and* the
  "Going cold" label already carry the literal meaning, so the color's job is
  severity, not temperature-matching. **Recommend to `product-ux-agent`/founder as a
  smaller follow-up:** either keep `Snowflake` and accept that its color encodes
  urgency-tier rather than temperature (consistent with how `Flame`/coral doesn't literally
  mean "hot to the touch" either), or swap the icon to something escalation-coded
  (`Hourglass`, `Clock`, `AlertTriangle`) if the mixed metaphor still reads badly in a live
  screenshot. This is a copy/iconography call for `product-ux-agent`, not a token change.
- **Also recommend a documentation-only edit to `[[color-system]]`:** reword `--gold`'s
  listed meaning from "Warming / warning / attention soon" to something that drops the
  literal-temperature word "Warming" entirely (e.g. "Caution / needs attention soon,
  traffic-light amber — not a temperature signal") — the current wording is what invited
  this review question in the first place, since "warming" and "going cold" are literal
  antonyms sitting on the same color. The *value* doesn't need to change; the sentence
  describing it does.

**Trade-off accepted:** This keeps two visually-warm colors (coral, gold) as neighbors on
the Leads stat row, which will still read as "similar-temperature" to someone scanning
fast rather than reading labels — brand principle 4's five-second test is not perfectly
served by this pairing. Accepting that cost because the alternative (repurposing `--slate`)
creates a worse, more structural problem (a collision with `Total` in the same row) than
the one it solves, and because the labels + icons already carry the literal meaning per
rule 3, which is the system's own designed mitigation for exactly this kind of
same-register-color pairing.
**Revisit when:** The founder sees a live screenshot of the Leads stat row and still reads
`Hot`/`Going cold` as ambiguous even with labels and icons present — at that point,
reconsider the *icon* swap named above before reconsidering the *color* again. Also revisit
if a future screen ever needs a color for a true "medium, no warning" bucket in the same
view as "going cold," which would surface the `--slate` collision concretely rather than
hypothetically.

---

## D-016 — Broader post-reskin polish pass: one new high-priority finding, four already-known gaps re-confirmed still open ^D-016
**Date:** 2026-09-13
**Decided by:** Claude (frontend-3d-agent) — findings only, no `followup/src/` changes made
**Status:** findings logged, not actioned
**Context:** Asked to look past the two color decisions above for anything else post-reskin
that reads as unpolished or inconsistent, prioritizing real, already-scoped gaps over
invented busywork.

**New finding (not previously flagged anywhere) — `--gold` is used for currency amounts
app-wide, undocumented and colliding with its own "warning" meaning:**
Every deal-value figure in the app — `FollowUpCard`'s dollar amount, the dashboard rescue
queue's `dealValue`, `LeadsPageClient`'s list-row deal-value column, the lead detail
page's "`$X` potential," `PipelinePageClient`'s per-stage total, `TeamPerformanceSection`'s
per-rep revenue — renders in `--gold`, consistently, across every one of those six call
sites. This isn't accidental (it's applied with total consistency, so it's clearly a
deliberate "gold = money" convention someone adopted), but it's undocumented anywhere in
`[[color-system]]`, which lists `--gold`'s only meaning as "Warming / warning / attention
soon," and it directly violates that same file's own rule 2 ("Status colors only for
status. Never decorative") and rule 4 ("No new color without a new meaning"). A $50,000
deal value and a $50 one both render in the same "caution" amber regardless of whether
anything about that lead needs attention — the color is doing a "this is a dollar figure"
job that has nothing to do with urgency. **Priority: medium-high.** It's cosmetic, not
broken, but it's the single most-repeated color-semantic drift found in this pass (six
call sites, both of the highest-traffic screens — Dashboard and Leads), and a business
owner scanning deal values in "warning" amber is a small, real friction against brand
principle 2 (a revenue number shouldn't visually register as a caution). **Recommend:**
`product-ux-agent`/founder decide whether currency gets its own documented convention (most
likely just `--ink`/`--ink-soft`, i.e. plain emphasized text, since money isn't a lead-
urgency status at all) or whether "gold = money" gets formally adopted as a fifth
documented role distinct from the status-color system. Not fixed here — a token-meaning
question, not an implementation task, and in scope for whoever picks up D-013's already-
flagged "StatCard status-color consolidation" pass, since it's the same underlying tension.

**Four already-known gaps, re-confirmed still open by this pass (not re-litigated, per the
brief):**
1. **Escape-to-close is still missing on four modals** — `ImportLeadsForm`, `LogCallForm`,
   `SmartViewForm`, `LeadTrustPanel` — exactly the four D-012 named after fixing only
   Add-lead's. Re-grepped for any `keydown`/`Escape` handler in each; none exists.
   **Priority: high** — this is a real accessibility/consistency gap on components used
   constantly (logging a call, importing leads), not a cosmetic one, and D-012 already
   scoped the fix (a shared `useEscapeToClose` hook) — it just hasn't been picked up.
2. **Four orphaned pre-Award landing components still exist with stale hardcoded
   amber/cream hex values** — `HeroMockup.tsx`, `LandingNav.tsx`, `LandingFaq.tsx`,
   `FadeHeadline.tsx` in `src/components/landing/`. Re-confirmed via grep that
   `src/app/page.tsx` imports only their `...Award` counterparts
   (`LandingNavAward`, `HeroMockupAward`, `LandingFaqAward`) and none of the four plain
   names appears in any reachable route. **Priority: low** — dead code, not a live bug, but
   worth deleting outright rather than leaving as a trap for a future grep-based color
   audit that doesn't check reachability first (this session nearly did exactly that).
3. **The `--rust` → `--accent` rename is still undone** — 65 remaining `var(--rust...)`
   call sites system-wide. **Priority: low** — purely mechanical, cosmetic-to-the-codebase-
   only (no visual effect), explicitly deferred twice already (D-011) as "worth doing once,
   not bundled with a value change." Still true.
4. **`StatCard`'s status-color usage on Analytics/Admin is still an unresolved looser
   convention** per D-013 (slate/sage/gold used categorically — count/positive/money —
   rather than for lead urgency specifically). **Priority: medium** — this pass's new
   "gold = money" finding above is arguably the concrete instance D-013 was gesturing at in
   the abstract; recommend whoever runs that consolidation pass treats D-013 and this
   entry's gold-currency finding as one piece of work, not two.

**Reasoning for prioritization:** The Escape-to-close gap outranks the others because it's
a functional/accessibility miss on frequently-used components, not a color or dead-code
issue — brand principle 8's "precision is the aesthetic" applies to interaction
correctness at least as much as to visual polish. The gold-currency finding is next because
it's live and visible on the two most-trafficked screens, even though nothing is "broken."
The rename and the orphaned files are genuinely low-priority — named so a future session
doesn't rediscover them as if new, not because they're urgent.

**External research note:** This pass was asked to also gather live web references (small-
business/real-estate CRM UI, trust-and-approval patterns for AI-drafted messages) via
WebSearch/WebFetch. Neither tool was available in this session, and direct HTTPS egress
(tested against a generic host) returned a `403` organization policy denial, which
`/root/.ccr/README.md` explicitly says to report rather than route around. No external
reference was fabricated to fill the gap — per `[[reference-workflow]]`'s own rule
("never describe a product's interface from memory... an imagined reference... poisons
every decision downstream"), an absent citation is safer than an invented one. Grounded
these decisions instead in the design brain's own existing, real, sourced research
(`research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`, itself
drawn from `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md`),
which was directly relevant to D-014's "Approve and send" reasoning. **Flagging for the
coordinator:** if live external UI research is genuinely wanted for these two decisions
before the founder signs off, it needs a session with working WebSearch/WebFetch or
unblocked egress — this one didn't have either.

**Revisit when:** Any of the four re-confirmed gaps gets picked up (update D-012/D-011's
entries as resolved rather than duplicating), or the gold-currency question gets a decision
from `product-ux-agent`/the founder.

---

## D-017 — `--gold` overuse is far bigger than [[design-decisions#^D-016|D-016]] scoped it: 25+ call sites, not 6 — the app reads "yellowish" because of this, not the reskin ^D-017
**Date:** 2026-09-13
**Decided by:** Claude, prompted by the founder noticing the authenticated app "feels
yellowish" against the navy/blue landing page
**Status:** approved — see [[approved#^A-005|A-005]]
**Context:** The founder's report ("we have the blue theme on our landing page, but inside
it's totally yellowish") was checked against the actual code before acting on it, per this
file's own anti-fabrication discipline — first against colors/fonts (confirmed identical:
`globals.css`'s `--ink`/`--rust` match `landing-award.module.css` exactly, and `fonts.ts`
confirms Bricolage/Public Sans/IBM Plex Mono were promoted app-wide, Jakarta/Inter fully
retired, no stale references in any `(app)/**` file), then against `--gold` specifically,
since D-016 had already flagged a narrower version of this same color as a live, undocumented
convention.

**Finding:** `grep -rn "var(--gold)" src` returns **30 matches across 15 files** — D-016's
"six currency call sites" was itself an undercount of just the money-figure category; the
full picture spans three unrelated use categories:
1. **Currency/deal-value figures** (~10 sites) — `FollowUpCard`, `TeamPerformanceSection`,
   the dashboard's rescue queue and lead-row deal values, `LeadsPageClient`'s deal-value
   column, the lead detail page, `PipelinePageClient`'s stage/weighted totals, `analytics`
   and `admin`'s revenue `StatCard`s. This is D-016's original finding, confirmed and
   re-counted.
2. **Warning/error/mismatch text** (~15 sites) — `TwilioConfig` alone accounts for 9 (number-
   mismatch warnings, webhook diagnostics, error messages), plus `TeamSection` (invite
   failures), `FilteredEmails` (sync errors), `LeadAssignmentSelect` (unassigned state),
   `settings/page.tsx`, `ApprovalQueue`'s hold-banner border/icon.
3. **Decorative** (1 site) — `SparkleBurst.tsx`'s confetti-style color array.
None of these are `--gold`'s one documented meaning ("going cold" lead-urgency pill). The
volume matters more than any single site: dollar figures and warning text appear on nearly
every authenticated screen (dashboard, leads, leads detail, pipeline, analytics, settings,
admin, team), so `--gold`'s warm amber is visually everywhere despite the chrome around it
being navy/blue — which is exactly what read as "yellowish" to a founder scanning the real
product, not a misperception to correct with reassurance.

**Recommendation, approved as proposed:**
- **Currency figures → plain `--ink`.** Money is information the user needs to read
  accurately, not a lead-urgency signal — color-coding it adds a false "caution" read to
  every dollar amount regardless of whether anything about that lead needs attention (the
  same point D-016 already made). No new token: reuse the existing primary-text color.
- **Warning/error text → `--coral`.** `[[color-system]]` already documents `--coral` as
  "needs attention now / error / high priority" — the exact semantic these sites actually
  need, and reusing it means zero new tokens for this fix. `--gold`'s "caution / needs
  attention soon" is measurably weaker than what most of these sites are actually saying
  (a broken Twilio number match, a failed invite, a sync error are current-state failures,
  not soon-escalating ones).
- **`SparkleBurst`'s decorative use** — left as a judgment call for whoever implements: it's
  the one non-semantic use and the least consequential (a burst animation, not a persistent
  color statement), but swapping it for a non-status color (or removing `--gold` from its
  palette array) keeps the fix total rather than leaving one deliberate exception unexplained.
- `--gold` goes back to meaning exactly the one thing `[[color-system]]` already documents —
  no rewording needed this time, unlike [[design-decisions#^D-015|D-015]], because the *value* and *meaning* were
  never in question, only the sites using it.

**Reasoning:** This is a bug-fix-shaped decision, not a fresh aesthetic one — every
replacement reuses an existing, already-measured, already-meaningful token
([[approved#^A-001|A-001]]'s contrast work covers both `--ink` and `--coral` already), so
there's no new `[TO DECIDE]` token to ratify, just a scope correction to how far a `[TO
DECIDE]` item from D-016 actually reached once it was re-measured properly.

**Trade-off accepted:** None structural — this is a straightforward token-usage correction.
The only real cost is implementation surface (15 files) versus D-016's originally-scoped 6,
which is why this needed its own entry rather than a quiet fix.

**Revisit when:** `frontend-3d-agent` implements the sweep and reports back — if any specific
call site's context doesn't cleanly fit "currency" or "warning," that gets flagged rather than
forced into one of the two buckets.

**Sweep completed 2026-09-13** by `frontend-3d-agent`. Re-grepped `var(--gold)` before
touching anything — still 34 raw matches, three of which are not misuse and were left
untouched: the `--color-gold` Tailwind wiring in `globals.css` (a token definition, not a
usage), `urgency.ts`'s `urgencyColor()` (the same "getting stale" traffic-light step as the
one documented pill, just generalized to a continuous function), and `LeadsPageClient.tsx`'s
"Going cold" `StatCard` (the one documented pill itself). That leaves 30 misuse sites, matching
the original count exactly, across 13 files:
- **13 currency sites → plain `--ink`** (via removing the inline color so text inherits the
  body default, or dropping the `accent`/`accentSoft` props on `StatCard` so it falls back to
  its own neutral default): `FollowUpCard.tsx`, `TeamPerformanceSection.tsx`,
  `TeamSection.tsx`'s `revenueGenerated`, dashboard's rescue queue + lead-row deal values,
  `LeadsPageClient.tsx`'s deal-value column, `leads/[id]/page.tsx`, `PipelinePageClient.tsx`
  (two `StatCard`s + the per-stage total), `analytics/page.tsx` (two `StatCard`s — `StatDef`'s
  `accent`/`accentSoft` fields made optional to allow omitting them), `admin/page.tsx`'s
  revenue `StatCard`.
- **16 warning/error sites → `--coral`**: `TwilioConfig.tsx`'s 9 (consent/A2P/WhatsApp/voice-
  agent compliance-notice icons, voice/SMS webhook-mismatch text, "number not in account,"
  call errors, `numberError`), `TeamSection.tsx`'s invite-failure text and `notice` (backed by
  `data.warning`), `FilteredEmails.tsx`'s sync error, `LeadAssignmentSelect.tsx`'s "Claim it"
  unassigned-state link, `ApprovalQueue.tsx`'s hold-banner border + icon. One site was *added*
  to this bucket beyond the original list: `LeadsPageClient.tsx`'s row-level "Unassigned" text
  (line ~304) — not separately named in this doc's original site list, but structurally
  identical to `LeadAssignmentSelect.tsx`'s "unassigned = needs a person" signal, so it was
  extended the same treatment for consistency rather than left as a stray `--gold` site.
- **1 decorative site**: `SparkleBurst.tsx` — `--gold` dropped entirely from its particle-color
  array (left with `--rust`/`--sage`) rather than swapped for a new color, per this entry's own
  "keep the fix total" note.

**Flagged, left as `--gold`, not forced into a bucket:** `settings/page.tsx`'s "Scan spam for
missed leads" button (`backgroundColor: var(--gold-soft)`, `color: var(--gold)`). It's a
manual-action button, not warning/error *text*, and not a currency figure — it doesn't cleanly
fit either bucket this entry defines. Whether it should become a plain/neutral button (matching
the adjacent "Reconnect" button's `--slate`/`--slate-soft` treatment) or something else is a
call for whoever owns this decision next, not a mechanical fit into `--ink` or `--coral`.

**Side effect flagged, contrast checked, fill left unfixed (deliberately out of this entry's
scope):** five sites now have a `--coral` icon/border/text sitting on an unchanged
`--gold-soft` background fill — `ApprovalQueue.tsx`'s hold banner, and all four of
`TwilioConfig.tsx`'s compliance-notice boxes (TCPA consent, A2P 10DLC, WhatsApp verification,
voice-agent cost/consent). This entry's scope was `var(--gold)` call sites only (matching the
grep the decision was built on); the `--gold-soft` background fills were never counted as
misuse sites and weren't touched. Per this entry's own instruction to spot-check any new
`--coral` call site not already in `[[color-system]]`'s contrast table: **measured
`--coral` (`#b32a44`) on `--gold-soft` (`#fef3c7`) at 5.66:1** — clears both the 4.5:1 body-text
floor and the 3:1 large-text/UI floor with real margin, so the combination is accessible even
though it reads as a slightly odd amber-fill/red-icon pairing. Visual consistency of that
pairing (whether the fill should eventually move off `--gold-soft` too) is a real open question,
just not an accessibility one — worth a follow-up look, not a blocker.

**Verification:** `npx tsc --noEmit`, `npx eslint` on every changed file, `npx vitest run`
(571 tests), and a full `rm -rf .next && npm run build` all clean after the sweep (the build's
`prisma migrate deploy` step logs the expected sandbox Supabase-unreachable warning and
continues — not a failure). No test asserted on `--gold` usage at any of the 30 sites. Rendering
verified via a static HTML mockup built from the real tokens (all affected screens are
authenticated), screenshotted with Playwright and captioned as a mockup — showed currency
rendering in plain `--ink`, warning/error text and icons in `--coral`, and the "Going cold"
pill still correctly in `--gold`.

---

## D-018 — Status colors for a surface that isn't lead urgency: the office floor reuses the severity ramp, and `--gold` stays out of it ^D-018
**Date:** 2026-09-13
**Decided by:** Claude, building `/admin/office` (the founder-only AI office floor)
**Status:** proposed — not yet reviewed by the founder
**Context:** `/admin/office` needed to show four states of an agent shift — running,
succeeded, failed, and *refused before it started* (over its daily spend ceiling, or the
desk has no runner). The four status tokens were defined for lead urgency, and
[[color-system]] is explicit that they are semantic, not a palette: `--sage` means "fine"
everywhere, and using a status color decoratively destroys the system.

**Decision:**
1. **Succeeded → `--sage`, failed → `--coral`.** Direct reuse of the documented meanings
   ("good / no action needed", "error"), on a non-lead surface. The ramp generalizes; the
   subject doesn't have to be a lead.
2. **Refused → `--slate`, not `--gold`.** The office stopping itself at a spend ceiling is
   the system working as designed, so it is informational, not a caution. `--gold` is also
   now scoped to "going cold" and nothing else per [[design-decisions#^D-017|D-017]] /
   [[approved#^A-005|A-005]] — reaching for it here would have re-broken what that pass
   just fixed, in a new file, which is exactly the repeat-offense pattern
   [[rejected]] exists to prevent.
3. **Running → an outlined pill (`--line` inset ring, `--ink` text), no fill.** There was no
   fifth semantic color to spend, and inventing one would have made the other four mean
   less. An outline reads as "in progress" without claiming a severity.
4. **Currency in plain `--ink`**, per A-005. Sub-cent figures print to four decimals
   (`$0.0004`) rather than the usual two, because a real shift costs well under a cent and
   `$0.00` on every row would teach the reader nothing.

**The generalizable principle:** a new surface inherits the severity ramp rather than
defining its own, and when it needs a state the ramp doesn't have, the answer is a
non-color device (outline, weight, position) — not a fifth hue.

**Revisit when:** the office grows a state that genuinely is a caution — a desk that has
failed several shifts in a row, say. That is a real severity step, and it would be the
first honest case for amber on this surface — at which point `--gold`'s scope needs a
deliberate widening decision, not a quiet call site.


---

## D-019 — Dashboard read as "weird": traced to ApprovalQueue's alarm styling and a duplicated header, not the page's structure ^D-019
**Date:** 2026-09-14
**Decided by:** Claude, in response to the founder flagging the dashboard as "weird" across
all four axes asked about (layout/structure, information density, the draft-reply cards,
colors/visual style).
**Status:** proposed — not yet reviewed by the founder. Shipped on a branch for review, not
merged to `main`.
**Context:** The current dashboard is the direct, deliberate output of
`followup/research/product/2026-09-10-ux-simplification.md` — 13 stat tiles cut to 3, the
approval queue added and pinned to the top, "About to be lost" / "What FollowUp did for
you" / "Upcoming calls" below it, everything else behind "See all numbers." Re-opening that
IA on a vague "too weird" would risk re-deriving the same structure and having it rejected
again for the same unnamed reason, so before proposing anything the actual current render
was reproduced from the real code and tokens (not redrawn from memory) and looked at
directly.

**What that showed, checked against the design brain:**
1. `ApprovalQueue`'s container used a 2px `--coral` border under a `--gold-soft` header
   band — the visual grammar of an alarm/error state, on what is actually the routine,
   trusted, first thing an owner does every day. This also used `--gold` for something
   other than "going cold," which [[approved#^A-005|A-005]]'s own applies-to clause already
   closes off ("`--gold`... stays reserved for 'going cold' alone").
2. Inside each card, the lead's message and the draft reply each sat in their own bordered
   box (dashed, then solid), nested inside the queue's own bordered card — a literal match
   for [[rejected#^S-09|S-09]], "excessive rounded cards / card-in-card soup... symptom of
   unresolved hierarchy."
3. The greeting banner's "N need your OK" pill repeated, word for word, the ApprovalQueue
   heading directly below it — the first two things on the page said the same thing twice.

None of this is an information-architecture problem — the page's section order, the
3-tile cut, and the approval-queue-first placement all still hold and were not touched.

**Decision:** Fix scoped to `ApprovalQueue.tsx` and the dashboard greeting banner only:
- Queue container restyled to the same calm treatment every other dashboard section already
  uses (`rounded-xl border border-line bg-card divide-y divide-line`, plain `font-display`
  heading, icon in `--ink`) instead of the coral/gold alarm band.
- The said-message and draft-reply boxes de-nested into one flowing block separated by a
  single `border-t` divider, keeping the "what they said, then what we'll say" distinction
  without stacking bordered boxes inside a bordered card.
- The greeting banner's duplicate pill removed; the queue's own heading is now the one
  place the count lives.
- `ShieldAlert` (coral) swapped for `ShieldCheck` (ink) — a queue of things to approve, not
  a warning.

**The generalizable principle:** a color and a border are load-bearing signals, not free
emphasis — reaching for the "urgent" treatment (coral border, gold band) on a screen's most
routine, positive-trust interaction teaches the opposite of what FollowUp is trying to be
("calm over urgent," "trust outranks sophistication" — `brand/brand-principles.md`). A
component can be the most important thing on the page by where it sits and what it says,
without also being styled like an incident.

**Revisit when:** the founder reviews the before/after screenshots. If "weird" was actually
about something this pass didn't touch (the 3-tile grid, the list-row density further down,
the overall type scale), that needs a fresh, specific description — don't assume this pass
closes the complaint until he confirms it does.


---

## D-020 — Dashboard redesign proposal, Stage 1 of the app-wide redesign: "Today, in one sentence" ^D-020
**Date:** 2026-09-15
**Decided by:** Claude, as the first stage of the founder's ask to "redesign the whole app
like a human expert made it," using the newly connected 21st.dev component catalog as an
input. Scoped to the dashboard only, on purpose — one screen to agree a direction on before
anything else is touched.
**Status:** REJECTED (2026-09-15) → see [[rejected#^R-001|R-001]] ("very basic") and the
follow-up concept [[design-decisions#^D-021|D-021]]. Kept here as the record of what was
tried. Prototype: `design-brain/prototypes/2026-09-15-dashboard-today-in-one-sentence.html`
(static HTML on the real tokens, opens in any browser; screenshots at 1280px and 390px were
reviewed before this was written).

**Inputs, and what was and wasn't taken from each:**
- *Design brain:* `brand-principles.md` (2 calm over urgent, 6 show the reasoning, 8
  precision is the aesthetic — polish by subtraction), [[approved#^A-002|A-002]] /
  [[approved#^A-003|A-003]] / [[approved#^A-005|A-005]] (tokens, ink buttons, no gold outside
  "going cold"), all of `rejected.md`. **Tokens are unchanged** — navy/blue, Bricolage +
  Public Sans + Plex Mono. Nothing found in the research argued for new values, so there is
  no `[TO DECIDE]` reopened here.
- *21st.dev* (`mcp__21st__get_inspiration` + `search`, plus the source of two components,
  "Message Draft" by tool-ui and "Collaborative Requests Dropdown" by shadcnspace; preview
  images could not be fetched from this sandbox). Taken as *principles*: a cancellable grace
  period after "send" (reversibility as trust), a "read more" fold for long drafts, an
  explicit all-caught-up state. **Explicitly not taken:** the generic shadcn dashboard look
  itself (icon-in-tinted-square KPI tiles, trend badges, bento grids, gradient area charts)
  — that is exactly [[rejected#^S-15|S-15]]'s template aesthetic and [[rejected#^S-05|S-05]]'s
  over-colored dashboard; bulk "approve all / reject all" — a blast affordance
  (`brand-principles.md` 7); and the row-slide/confetti-style motion.
- *ui-ux-pro-max* (`--domain ux`): supported "confirm before irreversible actions" (→ the
  undo grace), "don't encode status with color alone" (→ time facts as text, not a colored
  number), sequential heading levels. Its database returned **no match** for stat-card /
  metric density — the decision to fold the stat tiles into a sentence rests on brand
  principle 8, not on the skill.

**What the current dashboard does that a senior designer would cut, and the proposal:**
1. *The aurora "welcome banner"* is a full-width bordered box whose only content is a
   greeting and a fixed subtitle — chrome carrying no information ([[rejected#^S-12|S-12]]).
   → Replaced by a plain header: mono date eyebrow, `h1` greeting, and **one computed
   sentence that is the day**: "2 drafts need your OK and 5 leads are about to be lost. This
   week FollowUp answered 12 for you and 3 came back." Each number is a link to its list.
   This is also the all-caught-up state — "Nothing needs your OK today" reads as calm in a
   sentence where an empty box reads as apologetic.
2. *The three `StatCard` tiles* (colored icon chips: coral / slate / sage) sit between
   "decide" and "act", and are the one place the page looks like a generic SaaS template.
   → Removed from this screen; their three numbers live in the sentence above. `StatCard`
   stays as a component (`/analytics` uses it).
3. *Flat section hierarchy* (every section same size, same treatment).
   → Two tiers: **work** ("Needs your OK", "About to be lost" — `h2`, first) and
   **reassurance** ("What FollowUp did this week", "Upcoming calls" — `h3`, lighter, last).
   The setup strip moves between the tiers, unchanged as a component.
4. *Approval row information order.* Today: name → what they said → draft → "held because"
   → actions. → Name + **why it was held** first (the reason tells you what to check the
   draft for — principle 6), channel and age as mono meta on the right, then what they
   said, then the draft set off by a single 2px left rule (a quotation, not a box —
   [[rejected#^S-09|S-09]] stays closed), then actions. After "Approve & send" the row does
   not vanish: it becomes "Sending to Dan in 4s · Undo" (`aria-live`), then "Sent".
5. *"About to be lost" rows* today end in a coral 0–100 score pill — a verdict without a
   unit. → Replaced by the concrete fact the score is built from, as text: "waiting 26h"
   (in `--coral` only past the day mark) or "silent 6d" (in `--ink-soft`). The score stays
   on the lead page. Currency stays plain `--ink` per A-005.

**Open questions for the founder, not decided here:**
- The undo grace on "Approve & send" is a *behavior* change (a 5-second delayed send, with
  a cancel path) — `PRODUCT_DIRECTION.md` territory, needs a backend change and his OK.
  The proposal works without it; it is the single best thing 21st.dev surfaced.
- Whether he wants the three numbers glanceable as tiles anyway. The sentence is the
  stronger design; a tile row is the more conventional one.

**Self-critique (design-review.md), the honest part:** the setup strip's filled `--ink`
"Set up" button is the only other filled button on the page and competes a little with
"Approve & send" — it should probably be the outline style. The mono meta and time facts
sit at 12px, the floor; "waiting 26h" is arguably must-read and could be 13px. The at-risk
row description ("wrote 26h ago and is still waiting…") repeats the fact on the right —
one of the two should shorten. Empty and error states are described, not rendered. Weakest
part: the whole header depends on the sentence generator handling every zero/one/many
combination gracefully; a clumsy sentence would be worse than the tiles it replaces.

**The generalizable principle:** the expert version of a screen FollowUp already has is
usually the same information with less chrome, not a new layout — a computed sentence
beats a row of tiles, a left rule beats a nested box, a fact ("waiting 26h") beats a score
("72"). When a component catalog is an input, take its *interactions* (undo, fold, empty
state) and leave its *look*; the look is what makes every AI-era SaaS dashboard identical.

**Revisit when:** the founder reacts. Approved → log in `approved.md`, implement as its own
PR (dashboard only), then apply the same subtraction pass screen by screen — leads list,
lead detail, pipeline, settings — each as a proposal first. Rejected → record which of the
five moves was wrong and why, so the next screen doesn't repeat it.

*Outcome, same day:* rejected as "very basic" → [[rejected#^R-001|R-001]]. Superseded by
D-021 below.


---

## D-021 — Dashboard concept 2, "Live Desk": the landing page's approved language applied to the real screen ^D-021
**Date:** 2026-09-15
**Decided by:** Claude, directly after [[rejected#^R-001|R-001]] ("make it more creative and
enhanced, it's very basic"). Dashboard only; still a proposal.
**Status:** proposed — not yet reviewed by the founder. Prototype:
`design-brain/prototypes/2026-09-15-dashboard-live-desk.html`. Screenshots reviewed at
1280px and a true 390px viewport before this was written.

**Where the richness comes from — and why it isn't a violation of the standing rejections:**
the reference is not a component catalog, it is the founder's own approved landing page
([[approved#^A-002|A-002]]: "our landing page is cool"). Every visual device below already
ships there and was approved there; this concept moves them into the authenticated app so
the product reads as one designed thing (A-002's own principle) rather than a marketing
page in front of an admin list.
- *The dark band* — `landing-award.module.css`'s closing gradient (`#050d17 → --ink →
  --accent-deep`) with `AuroraBackground`'s three blue depths, blurred. Now the page's
  hero, carrying the day: greeting, three display numbers, and the timeline.
- *Big display numbers* — Bricolage 800 at 46px with the landing page's `accentText`
  gradient-clip treatment (white → light blue here), the count-up stat from the landing
  hero. "2 need your OK · 5 about to be lost · $17,300 at stake", each a link, each with
  one line of who/what underneath.
- *Opaque cards with deep soft shadows, 16px radius* — `HeroMockupAward`'s card language
  (`0 40px 80px -28px` shadow family), not glass ([[rejected#^S-03|S-03]] stays closed).
- *The score circle* — the mockup's "92" circle, back on the at-risk rows (D-020 had
  removed it; the founder's approved mockup has it). Coral tint only when the trail is
  past the day mark.
- *The "DRAFT READY" pulse motif* — the mockup's floating draft card, now the outgoing
  bubble in each approval card: dashed accent border, mono eyebrow "Draft — not sent yet"
  with the pulse dot. Honest by construction: it looks unsent because it is.

**What is genuinely new (the "creative" part), all of it information, none of it ornament:**
1. **A 24-hour response timeline** across the hero band: every inbound message today as a
   dot at its hour — light blue = FollowUp answered it, white outline = waiting for the
   owner's OK, coral with halo = nobody has answered — with a "now" marker. The gaps *are*
   the product's argument, made visible. Ticks at 6a/9a/12p/3p/6p/9p, mono.
2. **Conversation bubbles** in the approval card: what the lead said (incoming, `--paper-2`,
   timestamped) and the draft (outgoing, dashed accent). The owner reads it the way the
   lead will.
3. **Decay bars** on the at-risk rows: a 4px bar for how long the trail has gone cold
   against its threshold (24h for "waiting", 10d for "silent"), `--coral` past the mark,
   `--slate` otherwise, with the mono fact ("waiting 26h" / "silent 6d") beside it.
4. **Money made legible**: "$ at stake" as the third big number; in "This week", a two-tone
   bar — `--sage` "$4,150 came back" against `--coral-soft` "$17,300 still at stake".
5. **Two-column board on desktop** (7/5): decisions left, what's going cold / what came
   back / what's booked right. Stacks on phones.

Kept from D-020: why-it-was-held stated first (top-right of each card), the undo grace
with a draining progress bar (still a behavior change needing the founder's OK and a
backend delayed send), the setup strip demoted to the bottom of the right column (now in
`--accent-soft`, not a second filled ink button).

**Color check against [[rejected#^S-05|S-05]]:** three meaningful hues on a light page —
accent blue (decision / interactive), `--coral` (nobody answered / at stake), `--sage`
(came back). The dark band is monochrome blue. No status color used decoratively.

**Motion (not in the static mockup, all existing patterns):** aurora drift (`aurora-blob`
keyframes), count-up on the three numbers (`CountUp`), reveal stagger on the cards
(`RevealGroup on="mount"`), pulse on the coral timeline dot and the draft eyebrow
(`pulseDot`). Reduced-motion honored by each already.

**Self-critique, the honest part:** the hero band is a lot of dark at the top of a screen
an owner opens 20 times a day — it earns it on a busy day; on a quiet one it must still
read as calm ("FollowUp answered everything" is a fine timeline), and that empty state is
described, not rendered. The score circle is back, which D-020 argued against; the decay
bar now explains it, but it is still a number the owner can't derive. Two-column layouts
give two things "first" — the left column is the deliberate first, and the 7/5 split
keeps it so. Timeline labels collide when messages cluster (Priya/Dan at 9:05 and 9:30) —
production needs collision handling or hover-only labels. Weakest part: the "held because"
text top-right competes with the name for the eye on desktop; it may want to move under
the meta line.

**Open, for the founder:** (1) direction yes/no; (2) the founder said he will change "that
send message kind of thing in front" — the approve/send card is therefore the part of this
concept most likely to change and was kept simplest; (3) the undo grace as before.

**The generalizable principle:** for this product, "more creative" means moving the
approved marketing-page craft *into* the tool and spending it on real data (a timeline of
today's messages, a bar for how cold a trail is, money at stake) — never on a component
catalog's generic dashboard look. Richness has to be information the owner didn't have a
second ago; the ornament budget was spent on the landing page and is not to be spent
twice.

**Revisit when:** the founder reacts. Approved → `approved.md` entry, implement dashboard
as its own PR (hero band + timeline + board), then carry the same language to leads,
lead detail, pipeline, settings — each as a proposal first.

*Outcome, same day:* not taken — the founder's next instruction was "I want something
minimal, I mean like Apple." Not recorded as a rejection of D-021's individual moves (he
didn't react to them one by one); the direction simply went elsewhere. See D-022.


---

## D-022 — Dashboard concept 3, "Quiet Desk": minimal, in the Apple sense ^D-022
**Date:** 2026-09-15
**Decided by:** Claude, on the founder's instruction "i want something minimal i mean like
apple", given immediately after seeing D-021's dense concept and one turn after rejecting
D-020 as "very basic."
**Status:** proposed — not yet reviewed. Prototype:
`design-brain/prototypes/2026-09-15-dashboard-quiet-desk.html`. Reviewed at 1280px and a
true 390px viewport.

**Reading the two data points together — this is the useful part of the entry.** "Very
basic" (R-001) and "minimal like Apple" look contradictory and are not. What D-020 did was
*strip*: remove the banner, remove the tiles, leave 14px text on hairline rows at the same
scale as everything else. What Apple-minimal actually does is *spend* — on whitespace, on
type scale, on grouped surfaces with real radius and soft shadow, on one accent used
sparingly — while removing color, borders, badges and ornament. Stripping reads cheap;
restraint reads expensive. **The difference is where the money goes, not how much is on
screen.**

**The system, stated concretely so it can be reproduced:**
- *One column, 640px, centered, 64px top padding.* No two-column board, no sidebar cards.
  A phone-shaped page on a desktop screen — the ICP is on a phone anyway.
- *Type does the hierarchy.* Greeting at 38px Bricolage 600 with -0.025em tracking (the
  biggest type in the app); section labels at 11.5px mono uppercase, `--ink-faint`, sitting
  *outside* the card, indented to the card's text column; body at 15px.
- *Grouped inset lists.* Every section is one 18px-radius white card with a barely-there
  shadow (`0 1px 2px` + `0 10px 30px -22px`), rows divided by a hairline that starts at the
  text, not at the card edge. Nothing is bordered. Nothing is nested. This is the one
  structural device on the page and it repeats.
- *Almost no color.* Ink, two greys, one accent blue for text actions only ("Edit", "Set
  up", "See all numbers"), one 7px coral dot for "nobody has answered", one green figure
  for money recovered. No pills, no chips, no tinted icon squares, no score circles, no
  progress bars, no gradient, no dark band.
- *One filled control on the page:* "Approve & send", ink, pill. Everything else is text or
  a row.
- *Row anatomy:* name, one line of plain-language state ("Waiting 26h · high intent",
  "Silent 6 days"), value right-aligned, 8×13 chevron. The chevron is the only affordance
  marking.
- *The open approval* is the first row of its group, expanded in place: who, why held, what
  they wrote, the draft behind a 2px hairline rule, then the actions. The second is
  collapsed to a quoted first line — the queue reads as a list with one item open, the way
  a mail app does.

**What was dropped from D-021 and why:** the dark hero band (atmosphere is the landing
page's job, not the tool's), the 24-hour timeline (genuinely good information, but it is a
second thing competing to be first — it belongs on `/analytics` or as a detail), decay
bars and score circles (a sentence says it), every pill and chip, the two-column layout,
the money bar (replaced by "3 came back · $4,150" as one line).

**Standing rejections check:** [[rejected#^S-16|S-16]] is the live risk here — "like Apple"
is an instruction to borrow. What is borrowed is *discipline* (whitespace, grouped inset
lists, type-led hierarchy, minimal color), which is exactly what `brand-principles.md` 8
already asks for and what the CLAUDE.md standing rules name as the legitimate use of a
reference. No Apple UI element is reproduced: no segmented control, no SF-style icon set,
no system blue, no frosted material. The typefaces and the one blue stay FollowUp's own
([[approved#^A-002|A-002]]). If the result would read as "an Apple app," it is wrong; it
should read as FollowUp with nothing extra.

**Self-critique, honest:** (1) At 640px the desktop page is a lot of empty flank — on a
27" monitor it may read as under-using the screen rather than as composed; that is the
main risk and it is a real one. (2) Removing the score and the decay bar removes the
owner's ability to disagree with the ranking (`brand-principles.md` 6, "show the reasoning")
— "Waiting 26h · high intent" carries the reason but not the weighting, and this is a
genuine trade, not a free win. (3) With this little color, the single coral dot is doing a
lot of work; at a glance the at-risk list reads uniform. (4) A busy day (12 held drafts)
turns this into a long scroll with no density control — D-021's board handled volume
better. (5) The three summary numbers are not links to anything new (they jump down the
page); on Apple's own surfaces a number that big is usually a destination.

**The generalizable principle:** minimal is a budget decision, not a subtraction exercise.
Spend on space, scale and one clean surface treatment; remove color, borders, badges and
ornament. When this founder says "basic" he means *unspent*; when he says "minimal" he
means *spent on the right things*. Both complaints point at the same axis from opposite
ends.

**Revisit when:** the founder reacts to concept 3. Three concepts now exist for the same
screen — D-020 (subtraction, rejected), D-021 (rich, landing-page language), D-022 (Apple
restraint). If he picks one, log it in `approved.md` with what specifically was liked and
implement the dashboard as its own PR before touching any other screen.

---

## 2026-09-15 — Verification pass on PR #243's redesign

PR #243 moved every authenticated screen onto `ItemBox`/`PageHeader` and shipped
with an honest admission in its own description: the screens typechecked and
built, but nobody had looked at them. This is the pass that looked.

Method worth repeating: the screens were rendered by importing the **real page
modules** (mocking only the Prisma/session boundary) through a copy of the real
`(app)/layout.tsx`, against CSS from a **production build**. The dev server's
CSS lacks newly-used Tailwind classes and will show a stale layout — that trap
was hit mid-pass and cost a full re-shoot. Screenshots at 1440, and at 390 via a
520px-viewport iframe crop (headless Chromium clamps the viewport at ~500px).

### Fixed — these were defects, not preferences

1. **`/leads/[id]` scrolled horizontally at 390px** (page width 539px). The
   composer's "To <name> <email>" row: `min-w-0` on the flex item alone is not
   enough, because an `auto` grid track's minimum is its item's min-content, so
   nowrap text propagates up through the track. Needed `min-w-0` on the span
   *and* both grid items.
2. **`/pipeline` rendered lead names as "Der…", "Kon…", "Sar…"** — a 260px
   column split between a score badge and a `shrink-0` stage select left ~30px
   for the only thing identifying the card.
3. **`/pipeline` urgency was colour-only**, with the meaning in a `title`
   tooltip — against A-006's hard constraint, and unreachable on touch. Now
   stated in words on the card, using the same 3/7-day cutoffs `/leads` uses.
4. **"Clean up leads" was a dead button.** Its confirm panel is absolutely
   positioned inside a menu with `overflow-hidden`, so it clipped to nothing;
   at `w-96` it also overran a 390px screen. This is the only irreversible
   destructive action in the product, and it was unreachable.
5. **`/activity` truncated every event sentence at 390px** — on the page whose
   stated job is "Proof, not a promise". `ItemBox` hard-`truncate`d line 1,
   which assumes a short name. Now `line-clamp-2`; also fixes the dashboard's
   at-risk reasons.
6. **`/workflows` plan card broke at 390px** — the delete button sat 6px
   off-screen.
7. **Two S-13 sparkle icons survived** the PR that removed the third and cited
   S-13 by name.

### Open — decisions, not repairs

- **The dashboard renders blank without JS.** `FadeIn` is `whileInView` with
  `initial: opacity 0`, so ~1200px of the page is invisible-but-space-occupying
  until an IntersectionObserver fires. `CountUp` is worse: it SSRs **"0"**, so a
  no-JS dashboard states "At risk right now: 0" beside eight at-risk leads.
  This is the landing page's own failure mode reproduced inside the app.
  Fixing it is a motion-policy change.
- **`/pipeline` is still card-in-card** (S-09), and `ScoreBadge` is a coloured
  circle with a bare number and a tooltip — a second hue in the box with no
  word. `LeadsPageClient` deleted exactly this component for exactly these
  reasons and left it on `/pipeline`. Removing it loses the score entirely.
- **`/leads` shows four status hues at once**; A-006 caps a screen at three.
- **PageHeader puts the secondary action above the primary at phone width.**
  `flex-col-reverse` fixes the hierarchy and breaks focus order; the clean fix
  changes desktop button order.
- **PR #243's "one page header" is two-thirds done** — `/pipeline` and
  `/settings` still roll their own h1 blocks.

### Not verified, and should not be assumed working

Recharts charts on `/analytics` (need a live DOM), everything on `/settings`
past its loading state (gated behind a `useEffect` fetch), all modals, the
notification panel, the workflow editor, and real motion timing.

---

## 2026-09-15 — ScoreBadge and PriorityPill contradicted each other on the same card

**Repair, not a redesign.** `scoring.ts`'s `priorityFromScore` cut at 70/40;
`ScoreBadge.tsx` cut at 75/45. `FollowUpCard` renders both, so every score from
70-74 and from 40-44 disagreed with itself on screen: a lead at 72 showed a
"high priority" pill beside a badge coloured medium whose tooltip read
"Worth chasing: medium".

**70/40 kept, 75/45 dropped.** Not because those numbers are better — neither
pair is backed by research, and that is still open — but because 70/40 already
drives behaviour: `Lead.priority` decides the handoff notification, the Slack
ping and the default ordering. Moving it changes when a business is told a lead
went hot. Moving the badge changes a colour. When two sources of truth disagree,
keep the one with consequences.

Both now read `@/lib/scoreThresholds`, and a test walks every score 0-100
asserting the two agree, so the gap cannot reopen quietly.

**Tooltip corrected too.** It said the number was "how likely this person is to
buy". `scoreLead` actually asks the model "how urgently should they follow up
with this lead TODAY". Those come apart — a certain-to-buy customer who wrote an
hour ago is not urgent, and a wavering one who has waited three days is. The
label now names the quantity being measured. This is a truthfulness fix: a
tooltip that misdescribes its own number teaches the owner to mistrust the
number.

**Still open:** the cut-points themselves are inherited and undocumented. Every
other threshold in this codebase cites its research (`rescue.ts`,
`reactivation.ts`); these two cite nothing. Worth settling separately.

---

## 2026-09-15 — Phone channels dropped from the offer, not from the codebase

**Founder's call:** inbound leads are the core. SMS, voicemail and the live
voice agent are dropped for now and picked up later.

**Why it is a product decision and not a technical one:** every phone channel
sits behind A2P 10DLC registration, which is a *carrier* requirement — Bell,
Rogers, AT&T — not a Twilio one, so switching providers does not avoid it. Each
customer would have to register their own business, with their own business
number, and wait, before sending a single text. That is a telecom onboarding
process bolted to the front of a lead-follow-up product. Email, the website
widget, the lead webhook, Instagram/Messenger, manual entry and CSV have no such
gate.

**What changed on screen:**
- Settings' "Phone (SMS + calls)" section is hidden behind
  `PHONE_CHANNELS_AVAILABLE`.
- The landing page stopped naming SMS, WhatsApp and Twilio. The integrations row
  now reads Gmail · Outlook · Instagram · Messenger, and "Messenger" was added
  because it is live and was missing.

**The rule this follows, and it is worth keeping:** *a logo row is a promise
about what works today.* Naming a channel a visitor cannot then connect is worse
than never mentioning it — they discover the gap after signing up, which is the
cheapest possible way to lose trust. The same argument applied to the $29/$39
price mismatch fixed the same day.

**Hidden, not deleted, on purpose.** `TwilioConfig`, `lib/twilio.ts` and the
inbound Twilio routes all stay. Two reasons: the work is postponed rather than
abandoned, and a business that already pointed a number at FollowUp keeps
working instead of having it go dark with no warning. What is switched off is
the *offer*, not the capability.

A test asserts the flag's effect against the real source — including that the
code is still present — so re-enabling is one boolean and nobody has to
rediscover where the pieces went.

---

## 2026-09-16 — WhatsApp gets its own setup panel; the carrier split, in the UI

Extends the 2026-09-15 entry above, which is where the reasoning for dropping
the carrier channels lives. Two things changed since it was written: the flag
is now `CARRIER_CHANNELS_AVAILABLE` (not `PHONE_CHANNELS_AVAILABLE`) with
`META_CHANNELS_AVAILABLE` beside it, and WhatsApp is explicitly **not** behind
it — it rides the same Twilio account but gates on Meta's review of the
business, the same review Instagram and Messenger already need.

**The defect that followed from the rename.** Hiding the offer hid the setup.
WhatsApp was configured from inside the "Phone (SMS + calls)" panel, so when
that section went behind the flag, a channel the product still sells had no way
to be connected at all. That is a worse version of the landing-page failure the
2026-09-15 entry warned about: there, a visitor read a promise; here, a paying
customer read the promise, signed up, and found no switch.

**The shape of the fix.** `TwilioConfig` keeps SMS, voice, the number
auto-configuration and the voice-agent toggle, and stays behind the flag.
A new `WhatsAppConfig` carries the inbound URL, the Twilio credentials, the
WhatsApp sender number and the 24-hour template, and renders unconditionally
in Settings › Channels, next to Instagram and Messenger.

Not a flag inside the old panel, because the two setups are different jobs, not
one job with a filter on it:

- the Auth Token is **required** for WhatsApp (`sendWhatsApp` refuses without
  it) and was merely recommended for SMS, where it only verified signatures;
- the number is the *sender's* number, which is not always the voice/SMS one;
- the wait is Meta's review, not a carrier's registration.

The three credential fields are duplicated across the two panels on purpose.
They are the same two database columns and the same endpoint; whichever panel a
business saves from, the other reads back as saved. A shared sub-component would
have coupled a live channel's UI to a switched-off one for no user-visible gain.

**Copy rule applied, and worth restating:** *don't apologise for an absent
feature — just don't mention it.* The WhatsApp panel never says why SMS isn't
there, never writes "A2P", and never uses the words text, call or voicemail.
It names only the two things the owner has to go and do. A settings screen that
explains what it no longer offers teaches the owner to wonder what else is gone.

**Small UX repairs carried in the split**, all inherited defects rather than new
ideas: one Save for the three credentials instead of three separate saves that
each claimed success while the channel still could not send; a visible failure
path (the old panel silently swallowed every save error except the voice one);
real `<label>`s instead of placeholder-only fields; and the primary button moved
out of the inline row it shared with "How does this work?", where it read as
part of the sentence.

**Deliberately not done.** The route (`/api/twilio/config`) got no new guard.
Its existing refusal — no voice agent without the Voice add-on — is the gate
that matters, and it stays. Gating the endpoint on `CARRIER_CHANNELS_AVAILABLE`
would turn a hidden offer into a removed capability and break the businesses the
2026-09-15 decision explicitly protected.

**Known weakness, recorded rather than hidden:** the panel is still the old
bordered-card surface (`rounded-xl border border-line bg-card`) that A-006
retires, because every one of its neighbours in Settings › Channels is too.
Moving one panel to the shadow-box surface would have made it the odd one out.
The whole Channels tab should move together, as its own piece of work.

---

## 2026-09-16 — The DM grace period, and the notification that goes with it

**Product decision (founder's, not a design proposal):** on Instagram, Messenger
and WhatsApp, FollowUp waits ~2 minutes before sending its instant reply. If the
owner answers the DM themselves inside that window, FollowUp stays silent. If
they don't, it sends — and then tells the owner it replied for them. Email and
SMS are unchanged. Implementation lives in `followup/src/lib/acknowledge.ts`
(`DM_ACK_GRACE_PERIOD_MS`) and `/api/cron/instant-ack`.

**The only UI surface is one notification string**, and it is written to the
copy rules in `brand/typography.md` — plain, specific, short, no
anthropomorphising, says what happened rather than that something "was
detected":

> Priya Shah messaged on Instagram and hadn't heard back after 2 minutes, so
> FollowUp replied for you: "…" Check the thread.

Three deliberate choices in that one sentence, for future sessions:

1. **It quotes the message verbatim** (truncated at 180 characters). "FollowUp
   sent a reply" would force the owner to open the thread to find out what was
   said in their name — the answer to *what happened?* has to be in the
   notification itself, not one tap away.
2. **It states the wait as a number** ("after 2 minutes"), because the owner's
   first reaction to an automated reply is "why did it do that, I was about to
   answer" — the reason is the delay having elapsed, so the delay is named.
3. **Same mechanism and same shape as `notifyNeglect`** in `automation.ts` (a
   `Notification` row per recipient, assignee first, every admin when the lead is
   unassigned). The bell must not develop a second dialect per feature.

**Honest limitation, recorded rather than buried:** the real delay is 2–3
minutes, not 2, because the worker runs on a one-minute cron. The product should
say "two to three minutes" wherever this is ever described to a customer, not
"instantly, unless you reply first".

**Not done, deliberately:** no new UI anywhere else. No badge on the lead, no
"waiting" state in the conversation view. A 2-minute pending state that resolves
itself is not worth a widget an owner would have to learn — and showing it would
invite them to wait and watch, which is the opposite of the point.

## 2026-09-16 — Settings tells the truth about the Meta 20-hour ceiling

**Product decision (founder's, shipped in #252):** on Instagram and Messenger the
"Reply for me when I haven't" rule never waits past 20 hours, whatever the owner set,
because Meta refuses any business reply more than 24 hours after the lead's last
message and an hourly cron at 24 lands after the door shuts every time. Engine and
lead-page badge share one function (`effectiveUnansweredHours`). Constants live in
`followup/src/lib/metaWindow.ts`, a leaf module, so the client-side Settings page can
read them without pulling Prisma into the browser bundle.

**The UI change is two sentences, both conditional on the configured number being
above the ceiling.** Below 20 the ceiling changes nothing, and a note that changes
nothing is noise (principle 8). At 21 and up:

1. The "what's active right now" sentence gains a parenthetical:
   *"…steps in if you haven't answered within 24 hours (20 on Instagram and
   Messenger)…"*. That sentence exists to state what is true, so it has to carry the
   real number — an owner-set value that silently means something else on two
   channels is the surprise principle 1 forbids.
2. A one-line note under the hours field:
   *"On Instagram and Messenger, FollowUp steps in by 20 hours whatever you set here.
   Meta only lets a business reply within a day of the lead's last message — after
   that, nothing gets through."* This is the *why* (principle 3's five questions),
   placed where the "why did it go out early" question would otherwise be asked,
   with no platform jargon — "window" does not appear.

**Both channels are named, not just "Meta".** A 90-second owner may not map "Meta"
to "Instagram and Messenger" (principle 4); the sentence does it for them.

**The number is never typed.** `trustCopy.test.ts` fails if `20 hours` appears as
a literal in Settings, and fails if Settings imports from `@/lib/automation` rather
than the leaf module. One home for the number; one way for it to change.

**Honest limitations, recorded rather than buried:**
- Not rendered live. Settings sits behind Google sign-in and this sandbox cannot
  authenticate. The change is one `<p>` in the same `text-xs text-ink-soft` classes
  as its two neighbours and one longer string in an existing sentence, so layout
  risk is low — but "low" is a judgment, not a screenshot.
- The parenthetical makes an already-long summary sentence longer. At the 24-hour
  default, the majority case, every owner now reads it. Two words shorter was not
  found; a future pass on that whole sentence is worth doing.
- The note appears *after* the owner types 21 or more, not before. That is correct
  for principle 8, but means the first time most owners see it is when they read
  their existing default — which is fine, and is the case it was written for.

**Not done, deliberately:** the input's `max` stays 168. An owner may still set 72
hours; it is honoured on email and capped on the two DM channels, and the copy says
so. Removing the option would take a working email behaviour away to simplify a DM
one. WhatsApp is not named in either sentence because it is not capped — it has
templates as a way through — and naming it would be the false claim the sentence
was written to avoid.

**Weakest part, named:** the summary sentence. It now describes four rules and a
channel exception in one breath. It is true, and it is the one place a cautious
owner reads before trusting the product, which is why it had to be true first and
short second. Making it both is the next job on that screen.

## 2026-09-16 — Instagram and Messenger follow-up is DM-only; the strategy that replaces the email fallback

**Product decision (founder's):** on Instagram, follow-ups go in the lead's DMs and
nowhere else — see `rejected.md` R-003. Messenger is being treated identically because
Meta's rules are identical; the founder has not separately confirmed Messenger, and that
is recorded here as an assumption, not a decision.

**The consequence, accepted:** Meta refuses any automated DM more than 24 hours after
the lead's last message, and refuses even a human-sent one after 7 days. Nothing FollowUp
builds gets around either. So on these two channels the plan is shaped by the door, not
by a cadence chart:

| When | What FollowUp does |
|---|---|
| **First 24 hours** | Automatic, up to three touches: instant reply at ~2 min (built), a real follow-up at ~3 h if quiet (built), a last one by 20 h before the door shuts (built 2026-09-16, #252). Every one ends with an easy question — something answerable in a word — because **any reply from the lead reopens the 24-hour door**, and that is the whole game. |
| **Days 2–7** | FollowUp drafts one message, written to the reactivation rules (name the gap, lead with something worth their time, never "just checking in"), and puts it on the owner's dashboard. **The owner taps send.** It goes as a DM under Meta's human-agent allowance, which needs the permission the founder is already requesting in App Review. |
| **After day 7** | Leave them. Anything more is spam and Meta blocks it regardless. If the lead ever writes again, everything restarts. |

**What has to be built, in order** (each its own PR):
1. Workflow steps in **hours**, not days — a plan that counts only in days cannot place a
   second touch inside a 24-hour window at all (`SequenceStep.delayDays`, found in the
   2026-09-16 window research §5.1). Additive column, backfilled; existing plans keep their
   exact timing.
2. **DM-shaped drafts** — `generateFollowUpMessage` writes an email with a subject line
   whatever the channel (research finding, verified). Instagram needs short, no subject,
   one question at the end. Then **reply buttons** on every Instagram/Messenger message: a
   tap counts as a reply and resets Meta's clock (window research §1, grade B).
3. **Tap-to-send** for days 2–7 — the out-of-window step is drafted and held, not failed;
   the owner's one-tap send carries the human-agent tag; past day 7 it refuses with a
   plain sentence.
4. Settings still promises a past-24h DM "goes by email instead." That is now false
   twice over (never built; now rejected). Replace it.

**The workflow builder, after the unit change (PR A):** the field reads "hours after
enrollment / the previous step" and the step list keeps saying "Day 3", "Day 7" for anything
that is a whole number of days — the unit most people plan in, which is what the list showed
before. Hours appear only when someone actually types a sub-day value ("3 hours in", "Day 1,
+6h"), and a small "= 3 days" hint sits next to the field so 72 is never mental arithmetic.
Nobody building an email plan sees the word "hours" in the list at all. Visuals untouched:
same input, same row, one label and one derived hint. Not rendered live (Google sign-in
gate); the change is one label string, one number input's bounds, and one conditional
`<span>` in the same row.

**Principle to carry forward:** on a channel with a closing door, the message's job is to
get *a reaction*, not to deliver information. "Morning or afternoon?" beats "Let me know
if you're interested." This is a copy rule for every DM draft, not a one-off.

**Not done, deliberately:** no channel switch of any kind on these two channels (R-003).
No fourth automatic touch inside the day — three is already the ceiling the brand's
"never the spam tool" principle will bear, and each stops the moment the lead replies.

## 2026-09-16 — DM drafts take the DM's shape, and every automatic DM ends in a question with reply buttons (PR B)

**What shipped (backend; no screen changed):** step 2 of the DM-only build order above.

- **The draft matches the channel.** A lead who last wrote on Instagram or Messenger now
  gets a DM-shaped suggested reply: 8–30 words, no subject, no greeting frame, exactly one
  question and it is the last sentence. Before this, the suggested reply for a DM lead was
  an email with "Hi <name>," and a sign-off, and the automation pass sent exactly that into
  their Instagram inbox (research finding, verified in code). Email leads are untouched.
- **Which question is decided by facts, not by the model.** `src/lib/dmDrafts.ts` picks the
  situation from the thread — did they ask a price or a day, has the business replied, did
  that reply name a price or slots, was their last message a button tap — and hands the model
  the matching instruction from the buttons research §6. The model never chooses the set.
- **Two or three reply buttons under every automatic DM**, each a plain one-word answer, in
  the lead's language, 20 characters or fewer, with an honest "no" marked as the exit
  wherever the question is yes/no. Never more than three; volume is the spam signal.
- **A deterministic shape check runs before anything is stored or sent** — same posture as
  the instant ack's `checkAckShape`. One question, question last, length, no bot closers
  ("let me know if you have any questions", "sound good?", "are you interested?"), no number
  nobody wrote, no link, ≤3 buttons, one exit at most. A draft that fails twice is held for
  the owner on every tier, including AUTONOMOUS.
- **"Not now" stops everything.** A tap on the exit chip is recorded, the owner gets one
  plain line ("…tapped "Not now" on Instagram, so FollowUp has stopped. They can write again
  any time."), and no further automatic message goes out — engine and badge both read the
  stored tap. Anything the lead types later restarts everything. This is the guarantee the
  whole reply-button strategy rests on (buttons research §5.1) and it is pinned by tests.
- **An answer chip hands the lead to the owner** ("they answered you, and this one needs you
  now"), with a fresh draft that confirms the answer and does not ask again. A tap is never
  acknowledged by the instant-ack path — "thanks for your message" in reply to a button press
  is exactly the machine-sounding reply this is trying not to send.

**Copy rules carried into code, for any future screen that shows these drafts:**
- Owner-facing copy must never promise the lead "will see buttons" — chips render in the
  Instagram app only, never on desktop (api-facts §A3).
- The exit chip says "Not now" / "Leave it" / "Sorted elsewhere" and nothing else. No
  confirmshaming, no "last chance", no slot counts, no mention of the 24-hour window.

**Deliberately not in this PR, each its own piece of work:**
1. **The third touch (≤20 h).** The situation sets for it exist (`price_last`,
   `interest_last`) but nothing sends it yet — today's engine sends the ~3 h follow-up and
   then waits for the lead. The mechanism is a small follow-on PR.
2. **Buttons on the instant ack (touch 1).** The ack's allow-list of three speech acts is a
   safety design; adding a question to it is a product decision, not a code change.
3. **Chips on the approval card.** A held DM draft stores its buttons, but the owner's
   approve-and-send path still sends plain text. Showing the chips on the card and sending
   them on approval is UI work through the design-brain loop.
4. **Workflow steps on DM channels** still use the old non-email hint, not the DM shape.
5. **Reactions** (`message_reactions`) are still dropped at the webhook.
6. **Live verification** of what a tap does to Meta's window (api-facts §E) — the code
   assumes a tap reopens it, which is grade C until a real token settles it.

**Weakest part, named:** the shape check's banned-closer list is English only, like the
prompt's opener ban. A "¿te interesa?" gets through the check and relies on the prompt alone.

## 2026-09-17 — Days 2–7 on Instagram and Messenger: the owner's one tap (PR C)

**What shipped (backend; no screen changed):** step 3 of the DM-only build order.

- **Meta's window is judged before any send, in words the owner can act on.** Inside 24 hours
  of the lead's last message: any send. Between 24 hours and 7 days: only a *person's* send,
  under Meta's human-agent allowance. Past 7 days, or before the lead has ever written on the
  channel: nothing, with a plain sentence ("Aanya last wrote on Instagram more than 7 days ago
  — Meta doesn't allow a business to message them now. They'll need to write first, and then
  everything restarts."). No fallback to another channel, ever (R-003).
- **The tag is structurally human-only.** It can be attached only by the manual send route,
  the one place a signed-in person has the whole message in front of them and tapped Send
  for it; the acting user is recorded beside the tag in the audit trail. Cron, sequences,
  auto-send and retries cannot carry it whatever they pass. Chips are never combined with a
  tagged send (unverified with Meta; a rejected send would cost the owner their one message).
- **The engine writes the day-2–7 draft once and hands it over.** For a DM lead whose window
  has shut with nothing further from them, one draft to the reactivation rules: name the gap
  in a clause, lead with something concrete (answer what they asked if the thread allows,
  otherwise say what you'd need), one question with the way out inside it, no apology, never
  a mention of any limit. It lands in the approval queue and the owner gets one line: "Aanya
  didn't reply to the automatic follow-ups on Instagram, and Meta now only lets a person send
  the next one — you have 5 days. This draft is yours to send, or leave."
- **Nothing automatic goes out past the window.** The silence and unanswered rules skip a
  DM lead past 24 hours without drafting or risk-checking, so no OpenAI spend on a message
  Meta would refuse.

**Copy rules carried into code:** the owner-facing refusal and hand-off lines say *what
happened, why, what they can do, and how long they have* (CLAUDE.md's five questions) and
never use Meta's own jargon ("messaging window", "human agent tag") in front of the owner.

**Decided by default, pending the founder (flagged in the code):** a lead who tapped
"Not now" gets no day-2–7 draft. This is the one place the reaction strategy and the rescue
strategy disagree; until the founder rules, "Not now" means not now.

**Not in this PR:**
1. The App Review request for the "Human Agent" feature (founder; needs a screencast of an
   owner replying from FollowUp's inbox to a DM older than 24 hours). Until it is granted,
   Meta rejects the tagged send — the first live run pins the exact error, which both senders
   now log verbatim.
2. Live verification of the Instagram request shape for the tag (api-facts §E3).
3. Sequence steps on DM channels past the window: they now fail cleanly and notify the
   owner, but do not produce the hand-off draft themselves.

**Weakest part, named:** the hand-off draft is written without the model risk gate. The
owner reading the whole text before tapping is the gate, which is the documented shape, but
a draft that misstates a price the business never gave would reach their screen unflagged.

## 2026-09-18 — Four founder rulings that close the DM-only build's open defaults

Asked as four forced choices in one message; the founder took the recommended option on
each. Recorded here so no future session re-opens them as "flagged, pending".

1. **"Not now" means not now.** A lead who taps the exit button on Instagram or Messenger
   gets no day-2–7 draft. The reaction strategy wins over the rescue strategy at this one
   point; anything the lead *types* later still restarts everything. Was the coded default
   since PR C (#259); now a decision, not a default. → `[[approved#^A-007|A-007]]`.
2. **Up to three automatic touches inside Meta's 24-hour window.** Re-confirms the
   2026-09-16 decision against the quieter alternative (stop at two). Each touch ends in one
   easy question with reply buttons; any reply reopens the window and stops the sequence.
3. **The Monday "what FollowUp saved you" digest goes to every business, Free tier
   included.** What PR #257 (B-004) shipped is the intended behaviour; the digest is the
   product's strongest upgrade prompt, not a paid feature.
4. **Sign-up is invite-only for now. No public sign-up, no trial.** Product behaviour, so
   the canonical record is `followup/PRODUCT_DIRECTION.md`; noted here because Settings and
   the sign-in page carry its copy. Dipesh owns the gate (`src/lib/auth.ts`).

**What this does not decide:** a third-touch *timing* inside the window (the research
recommends spacing toward the end of the window; still to be built and reviewed), and
whether Messenger's rules diverge from Instagram's anywhere — still the flagged assumption
from 2026-09-16.

## 2026-09-18 — Logo direction chosen: the forward chevron

The three arrow-based concepts presented on 2026-09-14 (forward chevron, reply turn, return
loop) were shown again and the founder picked the first. → `[[approved#^A-008|A-008]]`.

**Why it is the right one, in retrospect:** the two rejected concepts both encode "coming
back" — a reply, a loop — which is the *mechanism* of follow-up, not its *result*. The
chevron encodes the result: the conversation moves on. It is also the only one of the three
that survives at 16 px without the counter-form collapsing.

**Next round (not started):** wordmark pairing, stroke weight, light/dark treatment, app
icon crop. Reuse the existing tokens (`--ink`, `--rust`, navy/blue) before inventing any.

## 2026-09-18 — The marketing site rebuilt in the founder's reference template's shape, on white and grey (the "light direction")

**Founder's instruction, verbatim in spirit:** "we should have our own information, the same template
and design, animation, graphics and all" and, when asked to narrow it, "do not follow his pages and
stuff, just get an idea to make our best." The reference is a dark Framer SaaS template ("Scalable").
Its structure, section rhythm and motion are the model; its content, pages and assets are not.

**What shipped (`src/app/page.tsx`, `landing-light.module.css`, `components/landing/light/`):**

- **Ground:** white/near-white paper (`#fbfbfd`), grey panels (`#f4f4f7`), near-black ink
  (`#111318`), a soft radial wash behind the hero. Cards are white with a hairline, 18px radius and
  a real shadow. The founder rejected four palette specimens and ten accent swatches without a pick
  ("wrong kind of colour", "I didn't like any") and then asked for the build; the accent shipped as
  **indigo `#4f46e5` as a placeholder token**, one line in `.root` to change. → `[[rejected#^R-004|R-004]]`.
- **Type:** Bricolage Grotesque headlines, Public Sans body, IBM Plex Mono labels, plus **Instrument
  Serif italic for exactly one emphasised word per headline** — founder's "Yes, add it". The new font
  is loaded in `src/lib/fonts.ts` and used nowhere else.
- **Section shape, every section:** small pill label → headline with the italic word → one line of
  lede → the content. Sections: hero with one wide dashboard card; Product (four cards with live-looking
  figures); The gap (the three sourced benchmarks + three guarantees); Integrations (split, card with
  toggles and progress bars); Right now (split, live rows); How it works (3×2 feature grid); Pricing
  (Free / Plus / Pro, Plus highlighted, from `TIER_INFO`); FAQ (first answer open); CTA band; footer.
  A 404 in the same system.
- **Motion:** rise-and-fade reveals (`RevealLight`, framer `whileInView`; the hero plays on mount so
  the first screen never waits on an observer), the hero card's idle float and light mouse tilt, bar
  chart grow, progress-bar fill, count-up on the two percentages, FAQ accordion, card hover lift. All
  of it is off under `prefers-reduced-motion`.
- **Retired:** the page-scoped navy/blue Award Direction for the landing page (D-008, D-009's orbit
  diagram, `landing-award.module.css`, `components/landing/award/`). A-002's navy/blue system still
  governs the authenticated app until its own restyle lands.

**What was deliberately NOT taken from the template**, and why:

1. **Testimonials and a customer-logo strip.** FollowUp has no customers to quote. An invented quote
   or a made-up logo row is exactly the spam signal the product exists to be the opposite of (S-01,
   brand principle 1). The space is used for the sourced benchmarks and the three guarantees instead.
2. **About, Blog, Contact, Coming Soon, Legal pages.** Content we do not have; the founder confirmed
   "do not follow his pages". Privacy and Terms already exist.
3. **"Book Your Demo" as the primary action.** Sign-up is invite-only (PRODUCT_DIRECTION, 2026-09-18);
   the button stays "Get started" → `/signin`. A "Request an invite" flow is a product question, flagged.
4. **The floating "Use template" pill, the annual/monthly toggle.** No annual price exists; nothing
   is shown that the product does not honour.

**Standing-rejection note (S-15, S-16).** Building on a template's structure is what S-15/S-16 warn
against. This is the founder's explicit, repeated instruction for the marketing site, and it is
recorded as such: the *layout and motion vocabulary* is borrowed, every word, figure and asset is
ours, and nothing in the authenticated app is affected. S-15/S-16 stay in force everywhere else.

**Weakest parts, named:** the accent is a placeholder; the integration "progress bars" are
decorative (they carry no information beyond "connected") and would fail S-12 in the app, tolerated
here as the template's idiom; the pricing card copy for Free vs Plus channels should be re-read
against `billing.ts` when the tier gates change.

**Next:** founder picks the accent (or keeps indigo); the logo brief replaces the placeholder chevron
mark; then the authenticated app follows the same ground in its own PR.

## 2026-09-18 — The logo, built from the founder's brief: an abstract F in two forward-moving forms (supersedes A-008's chevron)

**Trigger:** the founder supplied a full logo brief ("Responsive Brand Logo System", concepts #69
and #71, from another session) hours after picking the forward chevron (A-008). The brief rules
out literal arrows, so the chevron is superseded; the *idea* it carried — forward movement, no
lead dropped — is exactly what the brief asks for, expressed differently.

**What was built (`followup/public/brand/`, `LogoMark.tsx`, `icon.tsx`):** one master geometry
in a 100.8 × 120 box: an upper form (top arm + full stem) carrying ≈65% of the mass and a lower
bar carrying ≈35%, separated by a 16-unit channel (13% of height) on both axes, the whole thing
leaned forward by 0.14, terminals cut on a 1:3 chisel. Reads as a distinctive shape first, an
italic F second, two stages of one movement third — the order the brief asked for. Symbol,
white symbol, favicon variant (wider channels, less lean), dark and light app icons at 56%
occupancy with a 1.2% optical shift left, and a horizontal lockup with the wordmark outlined
from **Inter 600** (tested against Manrope 700 and Geist 600 on one sheet; Inter gave the most
neutral, even relationship with the symbol's chisels — Manrope read rounder than the mark,
Geist near-identical to Inter with slightly looser fit). Symbol height = 1.2 × cap height,
gap = 0.46 × symbol width. Monochrome only: `#111312` / `#FFFFFF`. PNG previews 16 → 1024.

**QA against the brief's six checks:** reads at 16 px (the channel survives as a visible
notch); negative space visible at every size; recognisable without the wordmark; does not read
as a generic arrow (no arrowhead, two forms not one); no obvious resemblance to a common tech
mark found on the sheet (an italic F is a family, not a specific logo — a proper trademark
search is still required before registration); every variant is the one geometry.

**Not yet decided — this is a first drawing awaiting the founder's reaction, not an
approval:** the founder has not seen it. A-008 is marked superseded by the brief; a new
approval entry comes only when he says yes. `[[approved#^A-008|A-008]]` → superseded.

**Weakest part, named:** the lower form's left edge and the stem run parallel with a constant
16-unit gap, which is honest but a little mechanical at 128 px and up; a hair of taper on the
lower bar's left edge would make the channel read as opening forward. Left for round two so
the founder reacts to the plain construction first.

## 2026-09-18 — Black, grey, white: the page as a gradient (corrects the all-light reading)

**Trigger.** The founder saw the first full render of the light-direction page and asked where the
black-to-grey gradient was. Offered hero-only, hero + close, or whole page dark, he answered "whole
page with white and black and greyish gradient". The all-light page is R-006.

**What changed.** Not a redesign: the same sections, copy, components and motion, on a ground that
moves. The page now reads black → grey → white → grey → black:

- **Hero** on a near-black ground (`#08090b` → `#1c1e24`) with one soft grey light behind the
  headline. The white thread card floats on it, which is the strongest thing on the page: the story
  the product exists for, in ink on paper, on black.
- **A 180px fade** from charcoal through grey to paper, then the light middle exactly as built
  (Product, The gap, Integrations, Right now, How it works, Pricing, FAQ).
- **The close** mirrors the hero: a 200px fade from paper down to black, with the CTA and footer on
  the black. The CTA is no longer a card; on a dark ground a card would be a box inside a box.
- **The nav** takes the dark tokens while it sits over the hero and returns to ink on paper once
  the hero has scrolled past (`LandingNavLight` measures `#hero`).

**How.** One `.dark` token scope in `landing-light.module.css` re-maps the paper/ink/line/card/
status/accent tokens; every component already reads its colours from those tokens, so nothing was
duplicated. `.light` re-asserts the paper tokens inside a dark region (used on the thread card).
The italic emphasis word takes `--em`, lavender on dark, the accent on light. Owner bubbles are
`ink on paper` in whichever scope they sit.

**What it is not.** Not a dark theme for the app, not a toggle, not a gradient for its own sake.
The dark regions are where the page opens and closes; the product detail sits on white where it
is easiest to read. The mid-tones of both fades are deliberately short (about a third of each
band) so the grey reads as a passage, not a surface.

**Weakest part, named.** The two fades are the same linear ramp reversed; a real designer might
break the symmetry at the close (a shorter fade, or the footer on flat black without the ramp).
Left symmetrical for now because it is the simpler thing and the founder has not reacted yet.

**Verified.** `next build` + `next start`, captured at 1440 and 390 via CDP: hero, fade, middle,
close, footer, and the nav in both states. Typecheck and lint clean.

**Awaiting.** The founder's reaction to the render.

## 2026-09-18 — The logo is #69 and #71: two leaves (supersedes the F-with-a-stem build of the same day)

**Trigger.** The founder sent the full exploration sheet (72 concepts, twelve families) with
"this is sick, just I want the logo to be 69 and 71". #69 is the favicon on that sheet, #71 the
horizontal lockup. The earlier build of the same day drew an abstract F with a full stem from the
brief's *words*; the sheet shows what the words meant, and it is not that.

**What #69/#71 are.** Two leaves. Each is a parallelogram leaning forward (top and bottom edges
rise to the right at ≈23°, sides lean ≈10°) with the two acute corners left sharp and the two
obtuse corners generously rounded. The upper leaf is larger; the lower leaf is ≈70% the size,
tucked under and to the left with the same lean, its sharp tip sitting just below the upper
leaf's bottom edge with a thin parallel channel between them. No stem, no arm, no arrow. It reads
as a shape first, as two stages of one movement second, as an F only if you look for it.

**What was built (`followup/public/brand/`, `LogoMark.tsx`, `icon.tsx`).** Master geometry in an
81.79 × 120 box, generated from the parameters above (not traced from the sheet's raster).
Channel 6 units in the master, 9.5 in the favicon variant with rounder corners for 16 px. App
icon is #67's rounded square, symbol at 58% of the canvas. The lockup follows #71's proportions,
which are unusual: the symbol is tall beside the word, cap height = symbol ÷ 3.2, gap 12% of the
symbol's height, cap block centred. Wordmark outlined from **Manrope 600** with −0.35 tracking;
on the sheet the word is a rounded geometric grotesque and Manrope is the closest of the three
faces the brief allowed (Inter is too neutral beside the leaves, Geist too narrow).

**Cost named.** At #71's ratio the wordmark is small: at 22 px tall the word is 7 px and
unreadable. Minimum lockup height is therefore 28 px, and the nav keeps using the symbol plus the
live wordmark text, not the outlined lockup.

**Also approved in the same message:** the black → grey → white → grey → black landing page
("this is sick"). Logged as A-009.

**Verified.** Preview sheet at 160/64/32/16 on paper and ink, app icon at 128/64, lockup at
120/40/22, favicon at 32/16. PNG set regenerated. Typecheck and lint clean.

## 2026-09-18 — The landing page now lives in Figma for the founder's review

**Trigger.** After R-007 the founder asked to comment "directly" in whatever tool made the design,
then named Framer/Figma. A claude.ai review artifact was tried first (free) but its comment wake
could not register; he chose to buy Figma Professional (1 Full seat, monthly) so the page could be
rebuilt there and commented on.

**What exists.** Figma file "FollowUp Landing Page", team "Sahil's team":
https://www.figma.com/design/aGklS1sUNbgfYdu3s1BTF9 — one 1440-wide auto-layout frame,
"FollowUp Landing — v1 (2026-09-18)", built section by section from the code with the product's
fonts (Bricolage Grotesque, Public Sans, IBM Plex Mono, Instrument Serif), the leaf logo as SVG,
and every section named. It mirrors the branch at commit 92d8c3f, not a new design.

**Rule for the loop.** Figma is the review surface, code is the source of truth. Founder comments
or edits in Figma → the session reads the file, records the decision here, changes the code, and
re-syncs the Figma frame. The Figma MCP cannot read comments; the founder tells the session when
to look, and edits made directly to the frame are readable.

**Gotcha recorded.** `figma.createAutoLayout()` gives every frame a white fill by default; 133
layout-only containers had to be cleared afterwards. Set `fills = []` on containers at creation.

**Cost.** Figma Pro ≈ $16/month, added to the expenses sheet as "confirm from receipt".

## 2026-09-18 — R-007 acted on: leaf logo re-measured, the fade becomes a section, the chat becomes a timeline, half the cards go

**Trigger.** After R-007 the founder was asked to mark the design; he answered "I don't know,
help me now, change whatever I gave you." His four objections are the brief; no guessing beyond
them.

**1. Logo ("not accurate").** The leaves were re-measured from #69 on the sheet rather than eyeballed:
side edge 0.8 × top edge (was 1.0), corners rounded over most of each side so each leaf reads as
one curve and one point (handle 0.8, tangent 30 of a 45-unit side), lower leaf 57% as wide and 81%
as tall (was a uniform 70%), tip at 55% of the upper's width. Side-by-side with the sketch in the
session scratchpad. Bounding box now 77.7 × 120.

**2. The black-to-white flip.** The 180 px fade band is gone. The Product section itself carries
the gradient: it starts on the hero's charcoal, its head is white on dark, and the ground lightens
to paper over ~900 px behind its own cards, so the eye crosses no edge. The close mirrors it: a
340 px run from paper to black before the CTA.

**3. The Sarah Johnson thread.** Replaced by `HeroTimelineLight`: five quiet rows in one card
(Tue: a lead asks · Tue: you reply · 5 days: nothing · Sun: FollowUp asks one question · Sun:
"Saturday works."). No avatar, no bubbles, no named person, no pretend screenshot. The rows
appear one after another so the silence is felt. `HeroStoryLight` deleted.

**4. Density.** Product: four cards → two (Who needs you today, Drafts that sound like you). The
gap: three guarantee cards → three plain rows under the stats. How it works: six cards → three
(One inbox, Scores you can see through, Follow-up on by default). Section padding 88 → 112. Hero
lede cut to one sentence. Nothing removed is lost: teams, language and Meta's rules stay in
Pricing and the FAQ.

**Figma** synced to match (same file, same frame). **Verified** locally at 1440: hero, fade,
Product, The gap; typecheck and lint clean. **Awaiting** the founder's reaction.

## 2026-09-18 — Fourth build: the founder's reference copied faithfully (the "Scalable" home page with FollowUp's content)

**Trigger.** R-008: the whole page as built this day, in all three states, rejected on look, layout,
words and feel. Asked what next, the founder chose "copy the Scalable template faithfully: its home
page as it is; only the words, numbers and logo are ours. You react to that, then we diverge."

**What was built** (`landing-dark.module.css`, `components/landing/dark/*`, `page.tsx`): the
template's system from his own transcription — `#0A0A0A` ground, `#111214` cards with a 1px
white/10% border and 16px corners, indigo `#5B2CE0` buttons/checks/toggles, green `#22C55E`
badges, white headings and gray-400 copy, 48–72px tight-tracked headlines with one italic serif
word, pill buttons, sticky transparent nav with a "New" badge on one link — and its section order:
hero (badge, H1, subtext, button, wordmark strip, dashboard card with three stat tiles, bar chart
with tabs, line chart with legend), Product 2×2 with in-card mockups (ranked list, activity rows,
pending invitations, a draft), the masonry stories grid, Integrations split (card with logos,
toggles, progress bars), Real-time split (rows with "1 min ago"), features 3×2 with icon chips,
pricing with the middle card glowing, FAQ with the first open, CTA band, footer.

**What was not copied, and why.** Standing rules, not taste: no invented testimonials (the
masonry holds nine of FollowUp's enforced rules, each attributed "FollowUp rule · Safety", with
five small logo marks where the template puts five stars); no fake customer-logo strip (the strip
names the channels we read instead); no "Book a demo" as the only action (we have a free plan);
no monthly/annual toggle (we sell monthly only). Three price cards, not two, because Free is real.
No new font: the template's grotesk is played by Public Sans at 600, which is what we load.

**Cost named.** R-005 rejected a dashboard-card hero on the light page; the founder now asked for
the template "as it is", which includes that card, so it is back, with FollowUp's own dashboard
numbers labelled as an example week. If he rejects it again the reason will finally be clear.

**Awaiting** his reaction to the live preview. Figma not rebuilt for this version: rebuilding a
whole frame costs ~15 tool calls, and he reacts to the moving page, not the still.

## 2026-09-18 — Enhancement pass on the faithful build, then the black → grey → white ground

**Trigger.** A-010: "this is close, let's enhance this more." Mid-pass the founder added: "can we
go with white black gradient." Both applied to the same build; nothing about the section order,
copy or card system changed.

**Enhancements, all from the template's own playbook.** The hero dashboard card got a window
chrome bar (three dots, `app.followup · Dashboard`), a third row of three small stats (waiting on
you / going cold today / booked this week), a slow 8s float and a stronger indigo glow behind it.
The Product grid got the template's signature full-width composite card ("Your week, at a
glance": a total with two buttons and three key-value rows, a replies-by-day bar panel with tabs
and an inline day legend, and a five-row status list with pills). The channel strip got icons
(generic lucide glyphs: mail, inbox, camera, two chat bubbles, since lucide ships no brand marks).
Every section head has a faint indigo radial behind it; cards glow and lift on hover.

**The gradient.** The page now starts black and ends white. The shift is not an edge: it is one
`linear-gradient` ramp across the whole Features section (`.ramp`, ~800px, five stops from
`#0a0a0a` through `#6b6b70` to `#f4f4f5`). The six feature cards are opaque and sit on the
mid-grey band, so no running text ever lands on grey; the section's only text outside a card is
its heading, which sits in the top fifth where the ground is still near-black. Everything below
(Pricing, FAQ, CTA band, footer) is wrapped in `.lightZone`, which re-declares the tokens (white
cards, black text, `rgba(0,0,0,.09)` lines, a softer accent glow) and fades `#f4f4f5` → `#fff`.
The nav stays a dark bar over the light sections. This is the R-007 lesson applied: the founder
rejected a *hard* black→white shift, not the idea of a light bottom.

**Verified** at 1280 and 390 from a production build: the ramp reads as one continuous grade,
cards hold on both grounds, no horizontal overflow, typecheck and lint clean. Preview video
`landing-v5.mp4`; live artifact republished. **Awaiting** the founder's reaction to the gradient.

## 2026-09-18 — Hero line fixed, hero illustration replaces the dashboard, and the page goes black and white

Three founder instructions in one live-editing session on the artifact preview, applied in order.

**1. Hero line.** "Hero line should be 'never lose a lead', one, fixed." H1 is now
`Never lose a *lead.*` (the product's canonical line from `followup/README.md`; the italic
serif falls on the last word, as the template does). The lede is unchanged.

**2. Hero illustration** (`components/landing/dark/HeroFlow.tsx`). R-009 removed the dashboard
card. In its place, an original diagram of the job: five channel rows on the left (Gmail,
Outlook, Instagram, Messenger, WhatsApp, each with a small "3 new"-style count), curved wires
converging on a round FollowUp hub in the middle ("catches · scores · follows up"), wires fanning
out to five lead rows on the right, each with the plain-words state it reached ("Replied · wants
Thursday", "Follow-up sent, on topic", "Booked a call", "Acknowledged in Spanish") and a small
warmth bar that fills from dark grey to white. Dots travel the wires on a loop (SMIL
`animateMotion` on zero-length round-capped strokes with `non-scaling-stroke`, so they stay round
while the wire boxes stretch); the hub pulses; the bars fill once. Reduced motion: no dots, no
pulse, bars full. On phones the wires hide and the three groups stack. Names are an example week,
not customers (standing rule). Nothing is a screenshot of the app.

**3. Black and white.** "I want black and white theme." The indigo accent and the green/amber/rose
status hues are gone from the whole system. Dark zone: white buttons with black text, white
"New" badge, white hub with the black logo, grey→white warmth, white bars, neutral pills at
three weights of white, glows are faint white. Light zone: black buttons with white text, black
checks, a dark-bordered "Plus" card, glows are faint black. New token `--on-accent` carries the
ink on the accent in both zones. Trade-off named: the status pills ("Needs you", "Going cold",
"Sent") no longer differ by hue, only by tone and weight; if he misses the colour signal, one
semantic hue can come back without touching the rest.

**Verified** at 1280 and 390 from a production build; typecheck, lint clean; every colour
literal from the indigo system grepped out. Live artifact republished; `landing-v7.mp4`.
**Awaiting** his reaction to the illustration and the monochrome.

## 2026-09-18 — Device theme: the two ends of the gradient swap with the OS setting

**Trigger.** A-011, and the founder's rule given with it: "for dark mode of device we will do
black background with a whitish gradient, and vice versa."

**How it is built.** The landing system now has exactly two token sets in
`landing-dark.module.css`: INK (black ground, white ink) and PAPER (white ground, black ink),
each ~55 custom properties, from `--bg` and `--text` through the soft fills, glows, shadows, the
hub gradient, the wire and dot colours, the warmth bar and the five ramp stops. Every colour on
the page reads a token; no rule keys on "is this the light zone" any more. `.root` takes INK and
`.lightZone` takes PAPER by default (dark scheme: black → white). Under
`@media (prefers-color-scheme: light)` the two blocks swap sets, and the ramp's five stops are
listed in reverse inside PAPER, so the same `.ramp` rule runs white → black. The nav bar's
scrolled background is a token too, so it matches the top of whichever page it sits on.

**Verified** with the colour scheme emulated at 1280: hero, illustration, ramp, pricing, FAQ, CTA
and footer in both schemes; typecheck and build clean. One fix from the check: the open FAQ's
close icon now takes `--on-accent`, so the cross stays visible on the accent disc in both
schemes. Dead CSS from the removed dashboard card (`.dash*`, `.chrome*`, `.tiles`) is still in
the file; it is inert and can go in a cleanup pass.

**Not done, by choice:** no in-page theme toggle. The founder's rule is about the device
setting, and a toggle would be a product-behaviour decision (his call).

## 2026-09-18 — No transition: one tone per device theme

**Trigger.** R-010. The ramp and the flipped lower zone are gone from `page.tsx` and the
stylesheet. Two token sets remain: ink-on-black is the default on `.root`; under
`@media (prefers-color-scheme: light)` the root takes paper-on-white (`--bg: #ffffff`, white
cards lifted by a 9% border and a soft shadow, black buttons, black hub with the white logo).
The ramp stops and zone tokens were deleted rather than left dormant.

**What this settles for future sessions.** The landing page's ground is one tone, chosen by
the device. Any future "make the bottom lighter/darker" ask should be read against R-010 first.

**Verified** in both schemes at 1280 from a production build; typecheck and build clean.

## 2026-09-18 — Charcoal, not black: the Aer reference was about its colour

**Trigger.** The founder pasted an Aer "Work Anywhere" hero: "let's use this." I asked three
questions (image slot, scope, ground) and built a full Aer-style hero with a generated photo.
Wrong: "I just wanted to use the colour, that's it. No person, I want same as previous."
Everything from that cut is reverted (component deleted, photo deleted, page and nav restored
to the last commit). Only the colour survives.

**What changed:** the dark-mode ground goes from pure black (`#0a0a0a` / cards `#111214` /
`#16171a`) to the shot's charcoal (`--bg: #1e1e20`, `--card: #27272a`, `--card-2: #2e2e31`,
scrolled nav `rgba(30,30,32,.72)`). No other token moved; light mode is untouched. This
amends R-010's "full black with dark mode" to "charcoal with dark mode"; "no transition"
still holds.

**Reference notes** in `references/landing-pages/2026-09-18-aer-editorial-hero.md` record the
layout so nobody rebuilds it.

**Verified** in dark mode at 1280 from a production build; typecheck and build clean.

## 2026-09-18 — The diagram is the hero: full width, moving, under the title

**Trigger.** The founder pasted a rendered concept (FollowUp mark in the middle, lead cards
on the left, wires converging, reply cards on the right, a tagline under the mark) and said:
"don't copy-paste, get the idea of what it is and why I like it: they have the whole diagram.
We have to animate this at the back of the hero page. The title and punchline on top."

**What changed** (`components/landing/dark/HeroFlow.tsx`, `page.tsx`):
- The hero is now title on top, diagram full width beneath (1400px, not the 1120px column),
  with the channel strip removed because the diagram names the channels itself.
- The headline keeps the fixed first line and gains the punchline as the second, in the
  italic serif: "Never lose a lead / *because nobody followed up.*" (the product statement's
  own words; his dictation was "never lose a lead because you forgot to follow up, something
  like that").
- Left column: the ways a lead shows up, each with an icon tile, a title and a "via"
  line (New inquiry via Gmail, Direct message via Instagram, Form submission via your
  website, Missed call via your phone line, New message via WhatsApp). Every one is a real
  capture channel we have built; none is decorative.
- Middle: FollowUp as an app-tile (112px, 28px corners, white-to-grey) with the leaf mark,
  pulsing; "reads · scores · follows up" under it.
- Right column: the lead answering, as message cards (initials, name, the reply, a time
  stamp, a live dot): "Thursday works, see you then." "Yes, send the proposal over." a tapped
  reply button, a reply in Spanish, a booked call. Example week, labelled so in the aria text.
- Motion: source cards slide in from the left one after another, the tile scales in, dots run
  the wires on a loop (grey in, white out), reply cards slide in from the right one after
  another as the follow-ups land. Reduced motion: final state, nothing moves.

**Not copied from the picture:** the plant, books and mug (a rendered room, not a page), the
"more conversations / higher conversions / real growth" claims, the LinkedIn source (we do not
capture LinkedIn), the tagline in caps. Charcoal ground per the earlier decision.

**Verified** at 1440 and 390 from a production build; typecheck, lint, build clean. Video
`landing-v12.mp4`; live artifact republished. **Awaiting** his reaction.

## 2026-09-18 — From everywhere: the diagram's entrance

**Trigger.** A-012, and the founder's note with it: "just try to make this overlay come in
from everywhere."

**What it does now** (`HeroFlow.tsx`): on first paint the FollowUp tile lands first (springs
up from below); each source card then starts far off in its own direction, one from high
above-left, one from far left, one from below, one from low-right of the column, each slightly
turned, and springs into its slot, 160ms apart; each reply then appears at the tile and travels
out to its place on the right, 400ms apart, scaling up as it arrives. After the entrance the
dots keep running the wires. Springs (stiffness 120, damping 18) rather than eased tweens, so
the cards overshoot a touch and settle, which is what makes "arriving" read. Reduced motion:
everything already in place.

**Kept quiet on purpose:** no loop of the entrance (it would compete with reading the title),
no rotation past 7°, no blur. The page's own rule is motion only where it explains something;
here it explains the product's one sentence.

**Verified** at 1440 and 390 from a production build; video `landing-v13.mp4`.

## 2026-09-18 — Plain words: the landing page rewritten for someone who has never used software like this

**Trigger.** Founder, on the approved page (A-012): "the information is very complex. I want to
make it very simple so that every single user can understand. Even someone who wants to use it
without any tough things should understand." Recorded as a brand principle (principle 9 in
`brand/brand-principles.md`); this entry is the first application.

**What changed, copy only** (`page.tsx`; nothing about what the product does moved):
- Every sentence shortened; one idea each. "Lead" became "customer" everywhere a customer would
  read it (the diagram's labels keep "leads come in from everywhere", his own phrase).
- Jargon out: "scores", "sequence", "draft", "autonomy", "CRM", "Meta's window", "routed",
  "urgency score", "on the record", "integrations", "real-time". In: "notices who is going
  quiet", "stops", "reply", "the tools you use now", "Instagram's 24-hour rule", "goes to the
  right person", "written down with the reason", "works with", "as it happens".
- Fewer things: the "Your week, at a glance" card (the densest object on the page) is gone; the
  nine rules are six promises (the two Instagram-window rules and "acknowledges within seconds"
  were the hardest to read cold); the percentage bars under the connected apps are gone (they
  meant nothing to a reader).
- Section heads now say the job in the reader's words: "See who needs you, and why." "What it
  will and won't do." "Works with what you already use." "See what changed, the moment it
  does." "Everything you need, nothing you don't."
- FAQ answers cut to two or three short sentences each; questions asked the way a customer
  would ask them ("Will it send things I did not approve?").

**Kept honest:** no claim was added; every line still describes a built behaviour (the 24-hour
rule, the money hold, stop-on-reply, download-or-delete, HubSpot and Follow Up Boss import).

**Verified** at 1280 from a production build; typecheck, lint, build clean. **Awaiting** his
read.

## 2026-09-18 — As simple as it goes: six things on the page

**Trigger.** Founder, after the plain-words pass: "simplify it as much as you can."

**What the page is now** (`page.tsx`), top to bottom:
1. The promise and the moving diagram. Headline unchanged; the lede is one sentence
   ("FollowUp writes back to your customers, so nobody is forgotten."); the "New:" badge is
   gone; buttons say "Start free" and "How it works".
2. **Three steps**: connect your inbox · FollowUp spots who is going quiet · it writes back
   for you. One line under each.
3. **Three promises**: when a customer replies, it stops · it never talks about money without
   you · you can delete everything, any time.
4. **Works with what you use**: one row of names. No card, no toggles, no descriptions.
5. **Simple prices**: three cards, three lines each, "Start free. No card needed."
6. **Questions**: four, one or two sentences each.
Then "Start free. Connect your inbox. That's it." and the footer. Nav: How it works ·
Prices · Questions · Start free.

**Gone from the page** (not from the product): the four product cards with in-card mockups,
the six-promise grid (three kept), the connected-apps card, the "as it happens" feed, the
six feature tiles, the fourteen-line price lists, two of the six questions, the "New:" badge,
the Integrations and Features nav links. Nothing on the page is untrue; the diagram in the
hero now carries what the removed sections used to explain.

**Cost named.** The page no longer mentions Meta's 24-hour rule, HubSpot / Follow Up Boss
import, the team routing detail, or the language promise in words (the diagram still shows a
reply in Spanish). If any of those turns out to matter for a buyer, it comes back as one
line, not a section.

**Verified** at 1280 and 390 from a production build; typecheck, lint, build clean.

## 2026-09-18 — Process reset: no more building first

**Trigger.** Founder, at the end of a day with five page directions: "I am cooked. Let's not
design directly. Let's do some research, then make a structure, then focus on designing."

**What changes.** Design on the landing page is paused. The v15 page stays on PR #265,
unmerged, as the current state. The next step is his yes / no on the four questions in
`design-brain/research/landing-page/2026-09-18-structure-v1.md`; design starts against that
structure and nothing else. For future sessions: this is the research workflow the design brain
already prescribes (`workflows/research-workflow.md`, step 1: "if you can't write this, you
don't have enough to design"); today it was skipped under pressure, five times.

## 2026-09-18 — Structure v1, question 2: the per-channel line stays off the page

**Founder's call:** no. The line "On email it sends for you; on Instagram and WhatsApp it
writes the message and you tap send" does not go on the landing page. I recommended it as a
trust line; he chose to keep the page to the promise. The fact is still told in two places a
person will look for it: the Questions answer on Instagram's 24-hour rule, and the app itself
at the moment the tap is needed. If trial users report feeling misled about Instagram, this
is the first thing to revisit.

## 2026-09-18 — Structure v1, question 3: four promises

**Founder's call:** yes to the fourth. The promises section, which stands in for proof while
there are no customers to quote, is now: *When a customer replies, it stops. It never talks
about money without you. Every message it sends is written down, with the reason. You can
delete everything, any time.* All four are built and tested (stop-on-reply, the money hold,
the audit trail, export-and-erase). His check before saying yes, worth keeping: "but we send
on Instagram and WhatsApp too, no?" Yes: within Meta's 24-hour window it sends by itself;
after it, it writes and the owner taps. The fourth promise covers every channel.

## 2026-09-18 — Structure v1, question 4: no "who it's for" section; the structure is settled

**Founder's call:** skip it. The hero's second line ("Only for owners who have leads and don't
have time to reply", A-014) already tells the right person it is for them.

**The settled structure**, in order: top bar (How it works · Prices · Questions · Start free);
hero (A-013 headline, A-014 buyer line, the moving diagram A-012, "Start free", one reassurance
under the button); three steps; four promises; works with (names only); prices (three cards,
three lines each, the no-metering line); four questions, the permission one first; start free;
footer. Eight blocks. Design now builds against this and nothing else.

## 2026-09-18 — Built against structure v1

**Founder:** "build." The page now matches the settled structure and nothing else. Changes
from v15, all copy and one grid: headline A-013; buyer line A-014 in place of the lede; one
button ("Start free") with the reassurance under it ("No card. It stops the moment they
reply."); four promises in a four-column grid (two on tablets, one on phones); the
no-metering line in Prices; Questions reordered so "Will it send things I didn't approve?" is
first, with the Instagram 24-hour answer second (the per-channel fact lives here, per
question 2). Nothing visual changed beyond the fourth card. Verified at 1280 and 390 from a
production build; typecheck, lint, build clean. **Awaiting** the founder's read.

## 2026-09-19 — The fuller page comes back, with the settled hero

**Founder**, on the structure-v1 build: "no, make like this but with the old version. I mean
the information the older pages had." Read: the three-steps page was too bare; he wants the
plain-words page from earlier (product cards with in-card examples, the connected-apps card,
the as-it-happens feed, six feature tiles, full price lists) with the decisions from the
structure on top.

**What was built:** the plain-words page (commit 26e7d0c) restored, then: headline A-013,
buyer line A-014, one button with the reassurance under it, no "New:" badge; the promise grid
cut from six to the four decided (the language and setup lines went; both still appear in the
product cards and feature tiles); the no-metering prices line; Questions cut to four with the
permission one first; every button says "Start free"; the close says "Connect your inbox.
That's it."

**Structure v1 amendment:** section 2 ("three steps") is replaced by the four product cards,
and two sections return between the promises and prices: works-with (card with descriptions),
as-it-happens (feed) and the six feature tiles. Recorded here rather than rewriting v1; the
founder's word "information" is the reason: he wants the reader to see the product, not only
be told three verbs.

## 2026-09-19 — The older information comes back, in plain words (A-015)

**Founder:** "more older ones." The page on `main` had four information sections the new page
lacked: the gap (the owner's question, "which lead am I about to lose because I haven't
followed up?"), why FollowUp exists (lead-generation tools vs FollowUp), how it works (four
steps), why not just a CRM reminder (three cards). All four are back between the hero and the
product cards, rewritten to principle 9 ("customer" not "lead", "reply problem" not
"lead-conversion problem", no scores or CRM). Left out on purpose: the three industry stats
(phone-derived or single-sourced), the freelance-consultant and agency personas (the hero's
buyer line replaces them), the team-pipeline mock (the Bring-your-team card covers it).
The four promises moved to a four-column grid (the masonry left the fourth alone).
Verified at 1280 from a production build; typecheck, lint, build clean. Approved on sight.

## 2026-09-19 — Two more chances to press the button (landing, "make it more effective")

**Founder:** "cool that's it, let's just make it more effective." The page was approved
(A-015); the ask is conversion, not redesign. Two additions, nothing new said in either:

- **A centred "Start free" after "How it works."** On a phone the page is eight screens
  tall and the next button after the hero was at the prices, six screens down; a reader
  convinced at the steps had nothing to press. Under it the same reassurance as the hero,
  shortened: "No card. Two minutes to connect."
- **A phone-only bottom bar** (`StickyCta.tsx`) that slides up once the hero has scrolled
  off, so the button is never on screen twice at once; hidden at 900px and up, where the
  sticky nav already carries it. Blurred `--nav-bg` ground, hairline top, safe-area padding.

Not done, on purpose: a second hero button (structure v1 lists it as "out"), urgency or
countdowns, a testimonial or logo strip (none exist), an exit popup. Verified at 390 and
1280, both device themes.

## 2026-09-19 — The app moves onto the charcoal monochrome system, stage one

**Founder:** "let's change the whole app." The landing page's black-and-white system
(A-011, A-012, A-015) becomes the app's system. This supersedes A-002's navy/blue baseline
(#0b1f33 / #2a5cdb, Bricolage Grotesque headings). What A-006 decided about *shape* — tight,
each item in its own box, soft corners with a real shadow, status colour doing the work,
accent held back — is unchanged and, if anything, easier: with a white (dark theme) or
black (light theme) accent there is no brand hue left to overspend.

**Stage one (this entry):** the token layer in `globals.css`, both device themes, the shell,
the dashboard. Token *names* kept (`--paper`, `--ink`, `--ink-soft`, `--line`, `--card`,
`--rust`/`--accent`, the four status tones, `--radius-box`, the three shadows) so the several
hundred call sites keep working; only values moved. Dark: `#1e1e20` page, `#27272a` boxes,
white text and accent. Light: white page and boxes, black text and accent. Two tones by
device, no toggle, exactly as the landing page. New tokens: `--ink-faint`, `--card-2`,
`--line-strong`, `--accent-soft`, and `--coral-fill`/`--on-coral` for a destructive button,
because the coral that reads as text on charcoal (`#f4899a`) cannot hold white text; A-001's
"a fill and a text colour have different requirements" applied to the dark theme.
Status tones re-tuned per theme and measured at 12px on `--card`: dark slate 5.9, sage 7.4,
gold 7.0, coral 6.1; light unchanged from A-001 except slate, which drops its navy tint.
Public Sans carries headings and body (Bricolage retired, one font fewer to load). The
dashboard's aurora banner — the last coloured ornament in the app — is replaced by the app's
one page-header shape (`PageHeader`); `AuroraBackground.tsx` deleted. Every `text-white` on a
filled button now takes its colour from the fill's own token pair (`text-paper` on `--ink`,
`text-on-accent` on the accent, `text-on-coral` on `--coral-fill`), and the five settings
toggles' knobs follow the landing page's rule (on → `--on-accent`, off → `--ink`). The loading
skeleton drops the retired border-and-divider shape for the box shape.

**Verified:** the dashboard's real markup re-rendered with the new built CSS in dark, light
and at 390px (the database was unreachable from the sandbox, so a saved render was used
rather than a live one — an honest limit, noted here); typecheck and production build clean.

**Not yet done — stage two:** the sign-in screen (it still scopes the navy `landing.module.css`
tokens), `chart-colors.ts` (hard-coded navy hex; charts need per-theme values), and a
screen-by-screen pass over leads, lead detail, pipeline, workflows, analytics, activity,
settings, onboarding and admin for anything hard-coded that the token swap did not reach.
Gautam owns app UI per TEAM.md; this stage went in as one PR so the founder can react to the
tokens before the rest is touched. **Needs the founder's yes** before stage two: the status
colours stay (A-006 axis 3) — say if the app should be grey-only like the page.

## 2026-09-19 — The app on the charcoal system, stage two: sign-in, charts, leftovers

**Founder:** "let's do it" on the stage-two list, then "merge" on PR #265 (stage one went
live as 8471a0c). This is the rest.

- **Sign-in** drops the navy-era `landing.module.css` scope and the floating-chip 3D scene
  behind the card (`SignInScene.tsx`, deleted). It is now the app's own ground, the brand
  symbol and wordmark, one lifted card, one filled accent button. The Google mark keeps its
  four colours: it is Google's, not ours, and their sign-in guidelines ask for it. The soft
  radial light behind the card is the landing hero's, in `--accent-soft`.
- **Charts** stop carrying a hand-copied palette. `chart-colors.ts` is now a hook that reads
  the live tokens off the document at mount and again when the device's colour scheme
  flips, because Recharts writes colours onto SVG attributes where `var()` does not resolve.
  Series are ink and ink-soft; money keeps gold as the one meaning-carrying hue. Chart boxes
  take the box shape (shadow, no border).
- **Leftovers:** the unsubscribe page (raw HTML outside the app shell) carries its own copy
  of the tokens in both themes; the manifest's colours are the real ground and ink; the
  booking page's confirm button loses its hard-coded white; the 404 moves off the
  light-direction module (white-only, indigo placeholder accent) onto the landing page's own
  module, so it follows the device theme like everything else, and that module goes with
  the three light-direction components nothing imported. The aurora keyframes and three dead navy-era landing components
  (`LandingNav`, `HeroMockup`, `FadeHeadline`) are removed with the module that styled them.

**Still open for the founder:** whether the four status colours stay (A-006 axis 3) or the
app goes grey-only like the page. Nothing else in the app is blue any more.

**Addendum, same day — the box everywhere.** Twenty-three files still carried the navy-era
`rounded-xl border border-line bg-card` that A-006 retired (settings sections, the workflow
cards, the trust panel, the setup strip, four modals, two popovers). globals.css now has
`.box` (page surface) and `.box-lift` (dialog, dropdown) so the shape lives in one place, and
every one of those call sites uses it. Inputs keep their border on purpose: a field is an
outline you type into, not a box. Rendered: none of these screens could be opened live from
the sandbox (database unreachable); the class compiles and the build is clean.

## 2026-09-19 — One FAQ answer names Gmail and Google Calendar (for Google's reviewers)

Google's OAuth verification requires the public homepage to describe, in plain copy, what the
app does with each Google product it asks for (playbook §2.2, §4.2). The v20 page dropped the
old "reads your sales conversations in Gmail" line, and never mentioned Calendar. Rather than a
new section (nothing else on the page needs it), the "Is my data safe?" answer now says it: reads
incoming Gmail to spot customer enquiries, sends replies from your own address, adds a Google
Calendar event when a customer books a call. Plain words, principle 9. No visual change.

## 2026-09-19 — The beta front door: every button says "Join the beta" and goes to /beta

**Founder:** "let's verify everything then and let's make this a beta version where users can
test and we will improve accordingly." Sign-up stays invite-only (CEO, 2026-09-18), so a
stranger pressing "Start free" hit Google sign-in and a refusal. That was a dead end on the
one button the page exists for.

**What changed.** Every landing button (nav, hero, after How it works, three prices, the close,
the phone bar) now says **Join the beta** and goes to **/beta**: one screen in the landing
module — a Beta badge, "We're letting a few owners in first.", a five-field form (name, the
Google email they'll sign in with, what they sell, where customers write, anything else), the
button "Ask for access", and the note "Free while in beta. No card. Sahil reads every request
himself." The hero note reads "Free while in beta. No card. It stops the moment they reply."
The prices lede says "Free while in beta" instead of "Start free". Sign-in's refusal now points
at /beta. In the app: a small "Beta" mark beside the wordmark and a "Something broke?" item in
the sidebar that opens a one-box feedback dialog (posts to the existing /api/feedback).
/admin lists requests with Approve / Decline; an approved email signs in on its next try, so
adding a tester no longer means editing an env var and paying for a build.

**Amends A-015**: button labels and the two reassurance lines only; structure, sections and
the hero are as approved. **Rule kept:** no hero badge (structure v1 lists badges as out); the
Beta badge lives on /beta and in the app, where it explains something.

**Verified:** /beta at 1280 dark and 390 light from a production build; endpoint refuses a bad
email and a filled honeypot. The admin list and the sign-in gate could not be exercised live
(database unreachable from the sandbox); both are small and typed.

**Superseded the same day (R-012).** The founder does not want a public request form: "I will
personally be adding all the emails." `/beta` and the form are removed; every button says
"Start free" and goes to sign-in again; sign-in says it is a private beta and gives
contact@followupbase.io; `/admin` has an "Add tester" box instead of a request queue. The
tester list, the Beta mark and the feedback dialog stay.

## 2026-09-19 — Settings → WhatsApp becomes "Connect WhatsApp" on the owner's own number

**Founder:** "Nobody wants to bring or use a new number that is nowhere exposed for a business
… Let's build WhatsApp … We'll leave Twilio for phone and SMS." Product decision recorded in
`followup/PRODUCT_DIRECTION.md`; scope in
`followup/research/integrations/2026-09-19-whatsapp-coexistence.md`.

**What changed in the UI.** The WhatsApp panel no longer asks for a Twilio Account SID, Auth
Token, sender number and Content SID. It is now the same shape as the Instagram and Facebook
panels: one sentence on what happens, one button ("Connect WhatsApp") that opens Meta's own
signup where the owner scans a QR code with the phone that already has their number, a
connected line naming the number, and a disconnect link. Below it, one small section for the
follow-up past 24 hours: the template's name and language from WhatsApp Manager and the
approved wording for reference. The two things the owner has to know are said in plain words
(principle 9): the phone must keep the WhatsApp Business app open at least every 13 days, and
a reply past 24 hours needs an approved template or nothing is sent — never email (R-003).
A paste-a-token fallback is folded away behind a disclosure, for the founder's own testing.

**Verified:** typed, built, tests green. The panel could not be exercised against a live Meta
app from the sandbox (no Meta app configuration yet); the first live connect pins the payload
shapes, as the scope doc says.

## 2026-09-19 — Beta gates are said before the click, not discovered as a refusal

Three lists outside FollowUp decide what a tester can connect: the founder's tester list,
Google's test-user list (Testing mode), Meta's app roles (unreviewed app). A tester who hits
one of them reads the refusal as the product being broken. So each connect button now says,
in one plain sentence under it, who Meta lets connect during beta and who to ask; Google's
bare "access_denied" on Gmail becomes a sentence naming the test-user list and the contact
address; Meta's "can't onboard customers" on WhatsApp is explained as Meta still verifying
FollowUp's business. Principle 9 (plain words) and principle 1 (no surprises). The founder's
side of it is one page, `followup/docs/tester-onboarding-checklist.md`. Also: the onboarding
heading now names Outlook when Outlook is what connected.

## 2026-09-19 — Beta testers are on Pro, free, and Settings → Billing says so in one line

**Founder's call** (asked, answered "Beta testers get Pro, free"): Free's 20-lead cap and its
email-and-website-only rule would have left a tester's Instagram, Messenger and WhatsApp
leads captured but never scored, drafted or answered — the product looking broken on the
channels they came to test. A tester's business is stamped with the beta plan at sign-in or
when added on /admin, and reverted on removal (`PRODUCT_DIRECTION.md`).

**UI:** the Billing tab's plan panel reads "FollowUp Pro — … Beta — every Pro feature, free
while you test. Nothing to pay and nothing to manage." and hides "Manage billing" (there is
no Stripe customer to manage). The plan picker is not shown to a beta business; if one wants
to pay for real, the beta ending is the moment for that, not a button now. Plain words,
principle 9. Not rendered live (database unreachable from the sandbox); the branch is one
string and one condition.

## 2026-09-19 — The learning loop: an honest consent switch, and "what testers changed" on /admin

**Founder:** "we need their data to train our model, right?" The honest answer: no model is
trained yet; what ten testers can teach is where the drafts' wording is wrong. So:

- **Settings → Your data** gains "Help improve FollowUp", a switch, off by default. The copy
  says exactly what it does today (keeps the draft beside what you sent; names and contact
  details removed; nothing shared; no model trained yet). The icon is a pen — the replies
  the owner edits are the subject — never a sparkle (S-13). The same switch is asked once at
  the end of onboarding, one sentence, easy no; nothing pre-ticks it.
- **/admin** gains the tester funnel — "N of 10 testers are testing", a thin bar, four counts
  (added, signed in, inbox connected, first lead) — and each tester row says which door they
  are stuck at. Below it, "What testers changed this week": every edited draft from an
  opted-in business, de-identified, side by side, "FollowUp wrote" / "They sent". No chart;
  the diff is the information.

Plain words (principle 9), no surprises (principle 1): the switch names its effect, and the
founder-only page shows only what the switch allows. Rendered as a static harness at 1280
(database unreachable from the sandbox).

## 2026-09-19 — A lead FollowUp skipped now says why, and an unjudged lead stops claiming a verdict

**The case.** The first real Instagram DM arrived on a business whose plan did not cover
Instagram. `checkAiEligibility` refused, correctly, and returned a reason. All three callers
threw the reason away. What the owner saw was a lead with no score, no draft, a pill reading
**"No action needed"**, and a status badge counting down to a follow-up that was never coming.
Every one of those is a claim the product had no basis for, and the whole thing reads as
broken software rather than working software exercising a limit. It took a database query to
find out what had actually happened.

**Principle 6, literally** — show the reasoning, not just the verdict. A refusal is a verdict.
This is the case where the product had the reasoning in hand and dropped it on the floor.

**What shipped.**

- `Lead.aiPausedReason` — the whole sentence, written for the owner, set at all three gates
  (scoring, automation, workflow steps), cleared the moment a score lands. A cache of a
  decision that is recomputed every pass; nothing reads it to decide anything.
- `checkAiEligibility` returns two strings now: `reason` (the fragment that sits after a name
  in a run summary) and `ownerMessage` (a whole sentence for a screen). One string could not
  be good at both jobs, and trying to make it serve both is why the reason was never shown.
  The sentences say what happened to the lead first — **it was saved** — then what FollowUp
  did not do, in plain words, then the one thing that changes it and where. The Free-channel
  one names the actual channel, because "which one" is always the next question.
- `AutomationStatus` gains `ai_paused`, ranked **above every timing state and above the
  workflow branch**. While it is set nothing drafts and nothing sends on any path, so
  "Following up soon" and "next step in 2d" are both promises the engine will not keep. Only
  won/lost outranks it: a closed deal is not waiting on FollowUp for anything.
- `AutomationStatusBadge` renders it in coral with a pause icon — the same family as
  "your auto follow-up is switched off", because to the owner these are one thing: nothing is
  happening and only they can change it. Label **"Paused on this lead"**: short enough for the
  compact pill in a list row, and it makes no claim about where the explanation sits. An
  earlier draft said "see why below", which is true on the detail page and false in
  `FollowUpCard`.
- **One deliberate break from the component's own rule:** this is the only status whose
  `detail` renders at 14px instead of 12px. Every other status has a self-explanatory label
  with the detail as a footnote; this one inverts that — the label only says something
  stopped, and the sentence *is* the answer. Setting the most important sentence on the screen
  in the smallest type the app allows would undo the point of showing it. Expressed as an
  `emphasis` flag, so it is a rule rather than a magic string check.

**The second bug, found while reviewing the first.** `PriorityPill`'s "Not reviewed yet" state
had **never rendered, once, in production**. Both call sites passed `Boolean(lead.scoreReason)`
— and `scoreReason` is never empty, because an unscored lead is handed a placeholder sentence
to render. So `reviewed` was always true and every unlooked-at lead was labelled **"No action
needed"**, which that component's own comment calls "the exact failure this product exists to
prevent". Fixed with a real `Lead.reviewed`, read from the column. A derived boolean that can
only ever be `true` is not a check.

**Self-critique, honestly.** Three weak points.

1. The reason is a **snapshot**, not live. Fix the billing and the sentence stays until the
   next pass touches that lead — up to 20 hours on the automation recheck. Clearing it
   anywhere else (a billing webhook, an upgrade handler) means a second place that has to stay
   right; clearing it where the work actually lands cannot go stale, only be late. Late and
   correct beats early and wrong, but "late" is real and a tester may see it.
2. The **dashboard approval queue was already fine** — "Held because …" has shipped for a
   while. The gap was only ever the refusal path. My first framing to the founder ("a held
   lead shows you nothing") was wrong and was corrected to him in the same session before any
   code was written.
3. Verified as a **static harness** at 1200, both themes, real token values copied from
   `globals.css` — not the running app, because the database is unreachable from the sandbox.
   The wiring is covered by tests and the typechecker; the *look* was checked on a stand-in.

**Not done, deliberately:** no upgrade button inside the badge. Whether a paused lead should
carry a one-tap upgrade is a product-behaviour call and `CLAUDE.md` puts those with the
founder, not here.

## 2026-09-19 — Same language AND same tone: deciding once, and an alert channel worth reading

> **PARTLY SUPERSEDED (2026-09-19)** — the "decided once and held" half is reversed by the
> entry at the end of this file, "The newest message decides the language". The founder's
> correction landed the same evening. The alert-channel half stands unchanged.

Two changes with one thing in common: the product was producing an answer and then
throwing it away.

### How a lead writes, decided once

**The founder, 2026-09-19:** replies should be "in the same language and same tone".
Language was already handled — every prompt is shown the lead's own message and told to
match it. **Tone was not, and could not be**, because nothing was stored. Every message
re-decided formality from whatever text sat in front of it, so the acknowledgement sent
within a minute and the follow-up sent three days later were two independent guesses.

For "which language" that is usually harmless. For **register** it is not. tú/usted,
tu/vous, du/Sie is a *decision*, not a fact about the text, and a thread that switches
reads to a native speaker the way "Dear Mr. Smith… hey dude" reads in English — the one
mistake a native speaker notices instantly and a non-speaker cannot see at all.

`Lead.language` / `languageScript` / `languageRegister` / `languageSetAt`, decided once
from the first inbound message and then held. Threaded into the follow-up draft, the DM
draft, the localized greeting/sign-off frame, the automation pass and workflow steps.
`FollowUp.language` copies it onto each send so the draft-versus-sent pairs the learning
loop already collects finally have a grouping key.

**Four rules the implementation follows, each of them a way of refusing to invent:**

1. **"neutral" is a real answer, not a fallback.** English has no two-way formal/informal
   split; instructing a model to be "neutral" in a language with no such mode invites a
   stiffness the customer never used. A neutral register names the language and stops.
2. **Anything not exactly "formal" or "informal" collapses to neutral.** An improvised
   register ("semi-formal") must never reach a prompt, because the prompt turns it into
   an instruction.
3. **A failed detection stores nothing**, so the next message tries again. Stamping the
   flag anyway to avoid re-paying would freeze a lead whose first message was "ok thanks"
   into "unknown" forever. The retry is near-free — the detector refuses to call the model
   at all below 12 characters.
4. **No stored language changes nothing.** The instruction is an empty string, the
   existing "match their most recent message" paragraph stands alone, and an undetected
   lead behaves exactly as before. This is the property the tests pin hardest.

**Deliberately NOT touched:** `generateInstantReply` and `assessAckRisk`. The ack is the
one message that sends with no human review, and `assessAckRisk` is an English prompt
judging replies in any language — the research names it the weakest link. Changing the
safety gate's wording in the same pass as a feature is how a safety gate quietly stops
working. It stays a founder-level decision, as the research recommended.

### The alert channel

**The founder, same evening:** "there is a server error message popping up every minute in
the Slack follow-up alert." The two Meta webhook URLs are public and named in Meta's own
console, so they take ordinary internet background traffic, and **every single request
posted its own red siren**. An alert channel that cries wolf is worse than no alert
channel: the real one arrives and nobody looks. This is brand principle 2 (calm over
urgent) applied to the founder's own tooling rather than to a customer screen.

Two fixes, smallest first: a bare GET with no `hub.mode` never attempted the handshake at
all, so it is not an auth failure and no longer reports. Everything else is throttled to
one report per kind per ten minutes, carrying the count of what was suppressed so a spike
is never hidden — only stopped from arriving one message at a time.

**Honest limit:** the throttle's memory is per warm serverless instance, so a burst spread
across instances still reports more than once. That is the correct failure direction for a
security signal (over-report sometimes, under-report never), and Sentry's own grouping
still does the real counting.

### Self-critique

- **The register is only as good as one message.** A lead who opens formally and relaxes
  three messages later stays on `usted` — deliberately, since consistency is the point,
  but it is a real trade and the wrong call for some threads. No mechanism yet lets the
  owner override it; that is the obvious next ask.
- **Nothing renders any of this.** A tester cannot see, or correct, what FollowUp decided
  about their lead. The data exists and the drafts use it; the screen is silent. That is
  the same class of failure as the paused-lead blank fixed earlier today, and it should
  not sit unfixed for long.
- **Not verified against a real non-English lead.** The prompt changes are argued from the
  research, not observed. The first Spanish or Hindi tester is the real test.


## 2026-09-19 — The newest message decides the language

**Supersedes** the "decided once and held steady" half of the earlier entry today. The
storage, the detector, the parser and the alert-channel work all stand; only the rule about
WHICH message decides is reversed.

**The founder, within the hour of it merging:** *"suppose I am using Hinglish first and then
switched in English, so reply should be according to the message. Whatever language the lead
will approach, we will reply in the same language."*

**He is right and the first design was wrong.** I had inferred "hold it steady" from the
research's point about register drift (§3) and quietly extended it to language too. Those are
not the same thing. Register drifting *within* a language is a mistake. Language changing is
a **signal**: a lead who switches to English is telling you something, and replying in the
language they have just moved away from is the exact rudeness the feature existed to prevent.
The lock would have produced it on every switching lead.

**What changed:** detection runs on the newest inbound message every pass rather than once;
the stored columns are refreshed each time, so they are a record of what was true at this
message rather than a verdict binding the next; and the prompt block now says outright that
it is a reading of the latest message and that the conversation wins if it disagrees. A
failed read keeps the last good one rather than blanking it — a one-word "ok" is not evidence
a lead stopped speaking Spanish.

**What the stored value is still for**, now that it is not a lock:
1. **Register on a short message.** A three-word reply usually shows its language plainly and
   the formal/familiar form not at all; without a prior reading the model picks one at random.
2. **Answering the question at all.** "How often are we wrong in Spanish" still needs the
   language on the row, and the learning loop still needs it as a grouping key.

**The lesson, and it is the one worth carrying:** research explains a mechanism; it does not
decide the product. §3 correctly described *why register drift hurts*. Turning that into
"therefore lock the language" was my inference, not the research's finding and not the
founder's ask — and the ask, "same language", had been in his own words from the start. When
a research finding suggests a constraint the founder never asked for, that is a question for
him, not a decision to take quietly.

## 2026-09-19 — "How they write", on the lead's own page

**The gap this closes**, named in the same session that created it: FollowUp had started
deciding a lead's language and formality and said nothing about it anywhere. An owner could
watch a reply go out in Spanish with no way to know whether that was a judgement or an
accident — the same blank-screen failure as the paused lead fixed earlier today, one layer
down. Brand principle 6: show the reasoning, not just the verdict.

**Where it lives:** a new section in `LeadTrustPanel`, the panel whose existing job is "on
what basis is FollowUp acting here". Consent was already answered there; language is the
same kind of fact and had nowhere else to go. No new card — the page already has enough
boxes (S-09).

**What it says**, in the owner's words rather than the code's:

> Their last message read as **Hindi, typed in English letters.** FollowUp replies to match it.

Three rules behind that sentence, each a refusal to invent:

1. **The language is named the way people name it.** `pa` renders "Punjabi", not "Panjabi"
   — the standard's own name for it and nobody else's. A hand-written list, not
   `Intl.DisplayNames`, for exactly this reason.
2. **The script is mentioned only when it is news.** Nobody needs telling Spanish was in
   Latin letters. "Hindi, typed in English letters" is the single most useful thing this
   line can say, and the detail a reply most visibly gets wrong.
3. **An unread lead says so.** "FollowUp hasn't read a message from this lead yet" — never
   "English". A guess presented as a reading is precisely what this section exists to
   prevent.

**No colour of its own.** This is information, not a status, and the panel already spends
two hues on consent — A-006 caps a screen at three.

**What was deliberately NOT built, and why it is a question for the founder rather than a
gap:** an owner override. It sounds obvious — see what FollowUp read, correct it if it's
wrong — but it contradicts the rule he set hours earlier, that the newest message decides.
An override would either be wiped by the lead's next message (useless) or outrank what the
lead actually wrote (which is the behaviour he just rejected). Making it stick is a
product-behaviour decision — `CLAUDE.md` puts those with him — so it is raised, not taken.

**Self-critique:** the line sits inside a collapsed section, so an owner has to open
"Consent & AI activity" to see it. That is right for a fact you check when something looks
wrong and wrong for one you want noticed — and if a tester reports a reply in the wrong
language, the first thing they will not think to do is expand a panel. Worth revisiting once
there is evidence anyone looks.

## 2026-09-19 — A lead in an account that cannot send stops promising a follow-up

**Third time today, same shape:** FollowUp knows something and the screen says otherwise.

**The case.** The first tester's only inbox had been disconnected since Sept 7. With nothing
connected, `runAutomationForBusiness` and `runSequencesForBusiness` both return empty
*before they look at a single lead* — so nothing was ever going to send. Every lead still
read **"Following up soon"** or **"Next check in ~3h"**.

**A correction worth recording, because I pitched this wrong to the founder first.** I said
FollowUp told the owner nothing. That was false, and checking took two minutes:
`getIncompleteSetupSteps` does surface *"Connect your inbox"* on the dashboard for exactly
this account. The owner was not in the dark. **The leads were the lie** — and that is the
narrower, real bug. Pitching a build on an unchecked premise is how you end up solving a
problem that isn't there; the check came before the code here only because the founder's
"one by one" gave room for it.

**What shipped:** `BusinessAutomationRules` gains `canSend`, from the existing
`hasAnySendChannel` — one query per page render, not per lead, in the same `Promise.all` the
rules already used. `AutomationStatus` gains `no_send_channel`, ranked above the workflow
branch and every timing state, below `ai_paused` and `closed`.

**The ranking, stated because it is the only real judgement here:** `ai_paused` is specific
to *this lead*; `no_send_channel` is true of *every* lead in the account. The more specific
explanation wins. `closed` still beats both — a won deal is not waiting on FollowUp.

**The copy names the fix, not the diagnosis.** "No send channel" is our words. The line is:

> **Nothing is connected to send with**
> FollowUp can capture leads but has no way to reply to them — no inbox, no Instagram, no
> WhatsApp, no number. Connect one in Settings and follow-ups start on their own.

**Three coral states now sit in one switch** (`no_send_channel`, `ai_paused`,
`account_paused`) and that is deliberate, not drift. To the owner they are one family:
nothing is happening, and only they can change it. What separates them is the sentence.

**Self-critique.** This is the third per-lead explanation added today, and the dashboard now
has two places telling an owner the same thing in different words — the setup strip
("Connect your inbox") and every lead ("Nothing is connected to send with"). Defensible,
because they answer different questions in different places, but it is the beginning of a
pattern worth watching: every time something goes quiet, the fix has been another sentence
somewhere. At some point the right answer is one place that says what is wrong with the
account, not N surfaces each explaining their own corner of it.

---

## 2026-09-20 — "Connected" and "receiving" are two different promises, and Facebook was only keeping one

**The build I pitched, and the correction.** I told Sahil the next job was *"wire up Facebook
connect — Instagram works, Facebook doesn't."* That was wrong, and reading the code first
showed it in five minutes: `FacebookConfig.tsx`, `/api/facebook/oauth/{start,callback,
select-page}`, `/api/facebook/config` and `src/lib/facebook.ts` all exist and are wired into
Settings, and `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` are both set in production. The
"Connect with Facebook" button is live. Task #77 shipped it.

**The real bug, which is narrower and worse.** None of the three connect paths ever called
`POST /{page-id}/subscribed_apps`. Meta only delivers a Page's events to an app listed under
that Page's own subscriptions, so every Page ever connected through FollowUp received nothing
— not one Messenger DM, not one Lead Ad — while Settings showed a green tick reading
*"Connected — Messenger DMs and lead-form submissions become leads automatically."*

Instagram makes this call. WhatsApp makes this call. The comment above
`subscribeInstagramWebhooks` even records finding it live on 2026-09-19. Facebook was the
one of the three that never got it, and nothing caught that because the channel looked
finished from every angle except the one that mattered.

**This is the second time in two days that a check-first pass changed the job.** Yesterday I
pitched "the owner is told nothing" and the dashboard was already telling them. Today I
pitched "Facebook isn't built" and it was built. Both times the real defect was smaller,
more specific, and more damaging than the one I had described. The lesson is not "check
before building" — it is that **a confident pitch is exactly the thing that most needs
checking**, because nobody else will check it.

**What shipped:** `subscribeFacebookPageWebhooks` (network only, testable), wrapped by
`activateFacebookPageWebhooks` which also records the outcome, called from all three connect
paths. `Business.facebookWebhookSubscribedAt` (additive, nullable) stores only a confirmed
success. `POST /api/facebook/subscribe` retries for an already-connected Page.

**The design decision: stop conflating two states.** The panel used to ask one question —
is a token saved? — and answer it in green. It now asks two, because the owner's real
question is not "did I connect it" but "will a message reach me". A Page that is connected
but not receiving gets a coral block (`--coral` on `--coral-soft`, the approved warning
token per [[approved#^A-005|A-005]]) instead of the tick:

> **Facebook isn't sending messages through yet**
> {Page} is linked, but Facebook hasn't switched the connection on — so nothing people send
> the Page reaches FollowUp. This usually clears once Meta approves the app; it can also
> mean you no longer manage the Page.
> [Try again]

Brand principle 3's four questions, in order: *what happened* (it's linked but not switched
on), *why* (Meta approval, or a lost Page role), *what can I do* (try again), *what needs
me* (nothing else). Meta's own refusal sentence is shown verbatim underneath on a failed
retry, because it names the missing permission — which is the actionable thing — and our
paraphrase would not.

**The `?facebook=connected` success banner is suppressed while a Page isn't receiving.** It
makes the identical promise the block below it has to walk back, and the two sitting
together is worse than either alone.

**Self-critique, and it is the same one as yesterday.** The panel is now taller and
two-state where it used to be one line, which is a real cost on a Settings page that already
has six channels on it. I think it is worth paying here — a silent channel is the failure
this whole product exists to prevent — but "add another explanatory block" is now three days
running as my answer to "something is quietly broken," and the honest read is that Settings
is accumulating per-channel prose faster than it is accumulating clarity. The better shape,
eventually, is one status line per channel that states connected/receiving in the same
grammar for all six, rather than six bespoke paragraphs. Not this PR; worth Sahil knowing.

**Also worth saying plainly:** this fix makes FollowUp ask Meta the right question. It does
not make Meta say yes. If `pages_manage_metadata` or `pages_messaging` are still in App
Review, the retry will keep showing Meta's refusal — which is now at least *visible*
instead of being a Page that looks connected and does nothing. That is task #65's territory,
not this one's.

---

## 2026-09-20 — The same sentence, twice in two days, so it becomes one component

**The bug, one day after its twin.** Instagram's two connect paths both called
`subscribed_apps` — unlike Facebook, which never called it at all — but neither stored the
answer. A refusal went into an audit row's `meta` field and nowhere else, so Settings kept
showing *"Connected — real DMs will become leads automatically"* on an account Meta had
declined to deliver for. Connected and broken looked identical.

**WhatsApp was checked and is not affected.** Both of its connect paths return 400 and save
nothing when the subscription fails, so it cannot reach this state and needs no column. I had
told the founder "Instagram and WhatsApp have the identical hole" before checking; that was
wrong, and reading the two routes took two minutes. Third time in three days that a confident
pitch was wrong in the specifics while right in spirit. The pattern is now well enough
established to state as a rule: **a claim about a sibling channel is a hypothesis until the
sibling's code has been read.**

**The design decision: extract, don't duplicate.** Yesterday's entry ended with a self-critique
— that Settings was accumulating per-channel prose faster than clarity, and that the right
shape was one status grammar for all six channels rather than six bespoke paragraphs. Needing
the identical block a second time the next day is the cheapest possible evidence for that, so
this PR takes it: `ChannelNotReceiving.tsx` holds the whole state — heading, explanation,
Meta's verbatim refusal, and the retry — and both Facebook and Instagram pass in four strings.

> **{Platform} isn't sending messages through yet**
> {Subject} is linked, but {Platform} hasn't switched the connection on — so {missed}. This
> usually clears once Meta approves the app; it can also mean {otherCause}.
> [Try again]

The variable parts are deliberately the *specifics* (a Page vs an account; "no longer manage
the Page" vs "no longer a Business account") and never the structure, so the two panels
cannot drift into saying the same thing two ways.

**Self-critique.** The component takes four content strings as props, which is a design smell —
it is a sentence with holes, and a fifth channel with a slightly different shape will strain
it. I judged that acceptable because the alternative (a channel enum inside the component)
puts channel knowledge in a presentational file, and because two call sites is too few to
know the right abstraction. If a third channel needs this, the props should become a per-channel
config object owned next to the channel, not more strings at the call site.

**Not fixed here, and worth knowing:** nothing ever re-checks the subscription after the first
success. If Meta drops it later — the person loses their Page role, a permission lapses — the
column still reads subscribed and the green tick stays. The state is now *showable*; detecting
entry into it is a separate piece of work.

---

## 2026-09-20 — "Make sure no leads slip over": the two-stage import filter

**The founder rejected three answers before this one, and he was right to.** WhatsApp
Coexistence connects the owner's *own* number, so the history import was turning their
accountant, their supplier and their family into scored, drafted-for leads. I offered:
import nothing, show a picker, or shorten the window. His reply: *"i am not satisfied with
any of these solutions."*

Every one of them traded a real customer for tidiness, and this product exists to not lose
customers. The rejection was correct and the better answer was already in the codebase.

**What we already had.** An email inbox is at least as mixed as a WhatsApp chat list, and
`gmail.ts` / `outlook.ts` have gated lead creation on `classifyAsProspect` since the
beginning — "is this thread customer business for this company?". WhatsApp simply never
asked. So the fix was not a new idea, it was **consistency**: same classifier, same
definition of a customer, one more channel.

**What the founder added, and it is the better half of the design.** Asked whether one
check was enough, he said no: *"if it confirms its a lead good if not we need more data to
confirm and then filter it out to make sure again."* That is a second stage, and it changes
the failure mode completely.

- **Stage 1** reads the opening, exactly as the mailbox does. Customer → lead, done.
- **Stage 2** runs *only on a rejection*, and sees what stage 1 structurally could not: the
  **most recent** messages rather than the opening (a chat that starts "hey" and becomes a
  job on message twelve is the exact case), plus whether the **owner ever sent a price, a
  time or an invoice** into that chat.
- Two facts settle it before any AI call: an **empty thread** imports, and a person who is
  **already a lead on another channel** imports. Neither is a judgement.

**Deliberately lopsided, and the code says so.** Missing a real customer is the failure the
whole product exists to prevent; a private chat in the pipeline is untidy and sends nothing
unreviewed. So every uncertain path imports — classifier throws, no business description,
nothing to read. `gmail.ts` already failed open this way; this matches it.

**Nothing is ever deleted.** A chat that fails both stages goes to the same "filtered" list
the mailboxes use, with the classifier's own sentence verbatim, and a one-tap Restore.

**Two things this forced that are worth recording.**

1. `classifyAsProspect` hard-capped at 3 messages. That cap is documented and correct — it
   is about long, heavily-requoted *email* threads where the opening carries the signal. A
   WhatsApp chat is the opposite shape. Rather than fork the classifier, it now takes an
   optional `maxMessages` and the caller says why it is raising it. One judge, different
   evidence.
2. Restore had to keep the thread. Meta delivers a number's history **once**, in one
   webhook, and never again — so a Restore button that re-fetched would return an empty
   conversation and the offer would be a lie. The thread is stored on the filtered row and
   read back defensively.

**Self-critique, and it was acted on the same hour.** The first cut computed "did the owner
send a price or a time?" with a regex list — `$120`, `Tuesday at 3`, `invoice`. English
only, in a product whose whole language story is that customers write in Hindi, Punjabi and
Spanish. I flagged it as the weakest part; the founder's reply was to fix it rather than
note it.

**The fix deleted code rather than translating it.** Stage 2 already reads the owner's own
messages in the transcript, so the model could always see a quoted price — the regex was
only deciding whether to *mention* it. So the list is gone and stage 2 is simply told, every
time: read the business's own messages too, and if they quoted a price, offered a time,
arranged to come out or sent an invoice — *in any language or script, including a language
written in English letters* — then work was discussed.

The general lesson, and it is one this codebase keeps relearning: **when a signal is already
in front of the model, computing it in code is both weaker and more work.** A keyword list
can only ever be as multilingual as the person who wrote it remembered to be.

Also unresolved, and inherited: stage 2 costs a second AI call per rejected chat. On a
30-day import of a busy personal number that is real money for chats that are mostly going
to be rejected anyway. Acceptable at ten testers; worth measuring before it is a hundred.

---

## 2026-09-20 — The product told the tester things about itself that were not true

**What this was.** Not a feature. A pass over the first hour of a beta tester's experience,
fixing the places where FollowUp *stated something about itself* that its own code
contradicted. Every item below is the same bug in a different costume: a screen written
against how the product was designed, not how the account in front of the reader is actually
configured.

The founder's instruction was "go go fix as much as you can", after "let's find more problems".

**The root cause, named once.** Every beta account carries `Business.holdAllForApproval`
(`grantBetaPlan`, founder's decision 2026-09-19: "I can't hand them the full automated
thing"). Until today that column was read by exactly two files — `automation.ts` and
`sequences.ts` — and written to no screen anywhere. So the single most important fact about
a tester's account was invisible to every surface that described what the account does:

- The lead page offered **"Handle it all, don't ask — every reply sends automatically with
  no review"** and made the owner confirm a red warning to choose it. Their account has
  never sent a reply unreviewed and cannot.
- Settings' one computed "here's what's active" sentence said FollowUp *nudges* and *steps
  in* and *switches to a reactivation message*. It drafts all three and files them.
- The plans page sold a four-step follow-up plan. On a holding account a plan drafts step 1,
  holds it, and **unenrolls the lead** — it has never reached step 2 for any tester.

It is now on `FreeTierStatus`, on `/api/automation/settings`, and read by all three surfaces.
The tier selector still offers all three tiers, because the choice is real — it is what takes
effect the day holding is lifted — but the sentences describe what will actually happen, and
the scary confirm is gone on an account where nothing it warns about can occur.

**The design call worth recording: an alarm is correct when nothing arrives, and wrong when
something does.** Yesterday's `ChannelNotReceiving` shipped a coral "nothing people DM you
reaches FollowUp" for any Instagram account without a confirmed webhook. Instagram has a
poller (`src/lib/instagramPoll.ts`, every 3 minutes) that exists *precisely because* the
first real account never got a webhook — so on Instagram that state is **slower, not
broken**, and my own alarm told a tester their working channel was dead. The component now
takes `stillWorks`; with it the block is `--slate` and `Clock` and says "arrives every few
minutes, not instantly". Facebook passes nothing and keeps the coral warning, because
Facebook really does receive nothing. The prop is a difference in the product, not a style
choice.

**"Held because …" had to be a sentence.** The most-read trust-bearing line in the product
rendered, to every tester: *"Held because Ready to send — this account holds every automated
message for you to approve."* A capital mid-sentence contradicting the word before it. The
reasons were being written as standalone sentences in two schedulers; they are clauses now,
they live in one file (`src/lib/holdReasons.ts`), the model that writes the risk reason is
told the same rule in its schema, and `holdReasonGrammar.test.ts` enforces it against the
real strings. Writing the test caught a distinction I had missed: "FollowUp couldn't check
this one" is *correct* capitalised — the rule is "lowercase unless it is a name."

**Other things a screen claimed and the code denied:**

| Screen said | Code did | Now |
|---|---|---|
| "replies within a minute" | Gmail push is off (no `GMAIL_PUSH_TOPIC`); Outlook has no push at all. Capture waits up to 10 minutes. `getGmailStatus` already returned `pushActive` and the dashboard threw it away | Says "every ten minutes" unless push is genuinely live |
| "They'll join automatically the next time they sign in" | `auth.ts` checks `ALLOWED_EMAILS` **before** it looks for the team invite, so an invited teammate is refused and the invite is never consumed | Says the teammate also needs adding to the beta, and how |
| "Email steps send a text instead" | The fallback is whichever channel the lead came in on — WhatsApp, Instagram, Messenger — and SMS needs a number `CARRIER_CHANNELS_AVAILABLE` won't let them buy | Names the real channels; lists text only when it is offered |
| "check Settings → Phone (SMS + calls)" (a send error) | That panel is hidden by the same flag | Points at something that exists |
| "Good morning" | Server clock. UTC on Vercel. A Toronto owner at 8pm | `Business.timezone` |
| "access was removed in Google or a password changed" | While the OAuth app is unverified Google expires the token **every seven days, for everyone** — the likeliest cause by far, and the only one the owner didn't do | Names the seven-day beta expiry first |
| (nothing, before the Google consent screen) | Google shows a full-page red "hasn't verified this app" with the continue link folded under *Advanced* — the most likely single point of tester loss in the funnel | Warned about, with where the button is |
| "One-click connect isn't switched on yet (docs/meta-oauth-setup.md, section 3)" | A path in our own repository, shown to a customer as if they could open it | Says it is ours to finish, not theirs |

**Two bugs that were just bugs:** `getIncompleteSetupSteps` ran on every dashboard load and
rendered only in the has-leads branch — so the one account guaranteed to have unfinished
setup, the brand-new one, was the only account never shown its next step. And the test-lead
button lived only in the zero-lead branch, so pressing it created a lead, which emptied that
branch, which removed the button: one use, then gone, exactly when someone wanted to try it
again on a channel they had just connected. It sits with the setup strip now and retires
with it.

**Self-critique.**

1. **Two of these were mine, from yesterday.** The Instagram false alarm and the `stillWorks`
   prop exist because I shipped an alarm without checking whether the channel had a fallback
   path. The poller's own header comment says why it exists. I did not read it before writing
   a sentence that contradicted it.
2. **The `holdAllForApproval` blind spot should have been caught when the column was added.**
   A `Business` field that changes what the product *does* and is read by no UI is a missing
   screen, not a small omission — and the surfaces that contradicted it were written long
   before, which is exactly why nobody looked.
3. **Not fixed, and I stopped rather than guess:** the website-widget setup step clears only
   when a real widget lead arrives, so a business with no website can never finish setup and
   the strip nags forever. The honest fix is a dismissal, which needs an additive column and a
   route — more than belongs in this pass, and the founder should decide whether "skip this"
   is a thing setup steps get.
4. **Two product questions raised, not answered** (CLAUDE.md puts behaviour with the founder):
   should a held workflow step *resume* after approval rather than unenrolling the lead; and
   should a team invite from an approved tester be enough to let their colleague in, given
   the Team feature currently cannot work at all.
5. **Verified by typecheck, 1348 tests and a production build — not by looking.** The
   database is unreachable from this sandbox, so none of these screens were rendered. Every
   one is a copy or a branch change, which is the kind that typechecks clean and reads wrong.

---

## 2026-09-20 — A photographer pitching the business was filed as a lead

**Reported by the founder, from his own live inbox**, with the thread attached: "I don't
know how this is even a lead, because she is not looking for a photographer. They are the
service provider. Please be more accurate and train them to identify which is a lead and
which is not."

He is right, and the classifier's own prompt already said so — which is the interesting
part. It listed vendors to reject: *"advertising, software, insurance, financing, warranties
or service contracts, leads-for-sale."* Every item on that list is a **B2B commodity**. A
photographer writing to offer their craft looks nothing like any of them, and reads exactly
like a delighted customer: praise for your work, eager to discuss your event, free for a
call this week, a signature with their own portfolio. Tone was doing all the work, and tone
is the one signal a pitch controls completely.

**Two structural defects, not a wording miss.**

1. **The verdict was generated before any reasoning.** Field order is generation order under
   strict structured output — this codebase already knows that, and `scoreLead`'s schema
   carries a comment saying so ("the number is the sum of stated evidence, not a verdict the
   model then rationalises"). That fix was never applied to `classifyAsProspect`, the one
   classifier that can *delete a customer*. `isProspect` came first; `reason` was written
   afterward to justify it. `whoIsSelling` — "whose work would be paid for?" — now generates
   first, so the direction has to be settled before a verdict exists.

2. **Nothing held the two answers against each other.** "They are selling to us" and "they
   are a prospective customer" are opposite ends of one transaction. The code now refuses to
   return both, rather than asking the model to stay consistent — because a warm,
   well-researched pitch is precisely the input that talks a model out of its own rule.

**The override is deliberately one-directional.** It can only turn a `true` into a `false`.
"Not selling to us" does not make someone a customer — a newsletter and a password reset are
both `neither` — so this can never manufacture a lead the model did not find. Getting that
backwards would trade a nuisance bug for the one this product cannot have.

**The second half of the same incident, which the founder did not have to point out.** The
reply FollowUp sent read: *"I can confirm that we're actively seeking a photographer for our
outdoor corporate party in Etobicoke."* Nobody at the business ever said that. Henji asserted
it in a cold email and the draft adopted it as the owner's own confirmed fact.

The drafting prompt already forbade inventing facts, and already refused *"a prior commitment
or agreement the lead merely claims."* It said nothing about a claimed **situation** — an
event you are supposedly holding, a need you supposedly have — which is what came through.
Both drafters now separate two acts that had been treated as one: *referring* to what the
sender said is allowed; *agreeing it is true* is not. Only the business's own messages can
establish a fact about the business.

That one matters more than the classification bug. Echoing a stranger's premise back as
confirmed is how a cold opener becomes a warm confirmed need — and the stranger is the only
party who gains.

**Self-critique.**

1. **The generation-order lesson was written down and not applied.** It is in `scoreLead`'s
   schema, in this file's own history, and it was sitting unfixed on the highest-stakes
   classifier in the product. A lesson recorded in one place and not swept across the others
   is half a lesson.
2. **A list of examples is not a rule.** The vendor list read as thorough and was thorough
   about the wrong axis — it enumerated *what* gets sold rather than testing *which
   direction* the money moves. Any new category of seller would have walked through it, and
   one did.
3. **Prompt-only, and I can't measure it.** The direction guard is enforced in code, which is
   real. The prompt changes around it are not testable beyond asserting the text is present —
   the tests here mock the model. The honest check is the next week of the founder's inbox,
   and the `FilteredEmail` rows are where to look: every rejection is recorded with its
   reason and is overrulable in Settings, so a wrong filter is visible rather than silent.
4. **Untested assumption, stated:** I could not read the production database, so I do not know
   how many existing leads are actually vendor pitches. If Henji is one of several, they are
   already in the CRM and this fix does not retroactively remove them.

---

## 2026-09-20 — What the real threads actually said

The founder pushed back on the vendor fix — "analyze it and improve" — so the production
database was read directly rather than reasoned about. Five leads, forty messages. The
photographer was not one bug. It was four, and two of them are worse than the one he
reported.

### 1. FollowUp told a real person it was not automated

Henji's **first** email, which had not been seen until the database was queried, asked:

> *"Just confirming you're still looking for a photographer and that this is a genuine
> inquiry on your end, not something automated. Occasionally those come through, so I like
> to check before diving in."*

FollowUp answered: *"I can confirm that we're actively seeking a photographer for our
outdoor corporate party in Etobicoke."*

A person asked, directly and politely, whether they were talking to software, and the
software said no. Every other defect in this file costs a lead or a confusing screen. This
one is the product lying on its owner's behalf to the one person who thought to ask — and
it is precisely what `CLAUDE.md` means by *"never designed as a spam tool, a scam."*

There is no wording that makes an automated denial acceptable, so no approved phrasing was
written. Both drafters are now forbidden to answer the question at all: never deny, never
claim to be a person, hand it to the human. That is always available and always correct.

### 2. Connecting Gmail auto-replied to three months of inherited history

Every outbound in the dataset fired within seconds of the same three cron ticks. The
`days_after_their_email` column tells the story:

| Thread | Age | What FollowUp sent |
|---|---|---|
| Glass supplier, mid-payment | **84 days** | *"We appreciate the clarity on the e-transfer process and will proceed accordingly."* |
| Rental application | **50 days** | Thanked as though it had just arrived |
| Closed deal | **38 days** | Congratulated on the accepted offer, again |
| Cold photographer pitch | **27 days** | *"Thank you for your email"* |

The first one is a **payment commitment, in the owner's voice, on a conversation from three
months earlier.** The third and fourth went out on a real estate agent's account, to his
real clients.

`isCold` (45 days) was built on 2026-09-15 for exactly this concern and caught two of the
four. **Age was never the right question.** The property that matters is whether FollowUp
*watched* the silence happen or merely *inherited* it — and `lastContacted < createdAt` says
that exactly: the newest message in the thread predates the lead row itself. A thread like
that has never had a live moment under FollowUp's watch, at any age, so whatever the owner
already did about it (answered by phone, met in person, lost the deal, decided not to
bother) is invisible.

Held, not dropped — finding the follow-up nobody sent is the entire product, so the draft is
still written and still offered. The owner just sees it first. Once anything happens on the
thread under FollowUp's watch, it stops applying permanently.

### 3. The business is called "My Business" and has no industry

Real customers received *"Thanks for reaching out to My Business."* And `industry` is
`null` on the founder's own account — which is the classifier's single most important input,
the one whose absence a comment in `classifyAsProspect` says cost a realtor seven real
deals. So the photographer was judged with no idea what the business does. Onboarding does
require industry, so this is an account that predates that requirement; the gap is that
nothing ever asks again. **Not fixed — flagged.**

### 4. A duplicate send

One lead received the identical drafted message twice, four hours apart. **Not fixed —
needs its own investigation, and one occurrence is not enough to characterise it.**

**Self-critique.**

1. **I fixed the reported bug and stopped.** The founder had to push twice — "analyze it and
   improve" — before the actual data got read. Both of the worst findings here were sitting
   in the first email of the very thread he pasted, and I had been reasoning about a
   truncated copy of it instead of querying the database I had access to the whole time.
2. **The first instinct was another prompt rule.** The durable fixes in this pass are a code
   invariant and a date comparison. Prompt text is where a rule goes when there is nothing
   to compute; here there was.
3. **`isCold` is the same mistake as the vendor list, one week apart.** Both encode a
   plausible proxy — 45 days, a list of commodity categories — for a property that can be
   stated exactly. Both caught the cases their author imagined and missed the next one.
4. **The hold is a product-behaviour change** and `CLAUDE.md` puts those with the founder. It
   ships because it is strictly the safe direction (nothing sends that would not have; a
   human is added) and because the alternative is leaving a known payment-commitment bug
   live. He should still be told, and is.
5. **Two known defects left open**, above, rather than guessed at.

---

## 2026-09-20 — "Don't send any replies without asking me, bro"

The founder's words, with his reason: *"They'll put us on spam, or they might report us."*

`Business.holdAllForApproval` already stopped the silence nudge, the unanswered step-in, the
reactivation and every workflow step. **One message was deliberately exempt** — the instant
acknowledgement — and `acknowledge.ts`'s own header argued the exemption at length: holding
the very first touch "defeats the point of instant."

That reasoning is sound and it no longer decides the question. The ack was the last thing on
a beta account that could reach a stranger with **nobody having read it**, which made it the
only thing that could get the sending domain reported. A domain cannot be un-reported.
"Instant" is worth a great deal and is not worth that.

The lead is not dropped: still captured, still scored, still drafted. A human presses send.
Checked before the `acknowledgedAt` claim, so a held lead is *waiting*, not *handled* — if
holding is ever lifted, it acknowledges normally rather than being silently skipped forever.

**Settings' summary sentence was wrong for exactly one day.** Yesterday it gained "— except
the instant acknowledgement, which always goes straight out." Today that exception is gone.

### The Instagram DM, and a correction I had to make mid-answer

The founder reported: the lead said only *"Hey is this still available?"*, and FollowUp
replied *"Checking on the status now. Will this be for a weekday or weekend?"* The lead's
next message was *"What do you mean"*.

**I first told him this was an echo bug — FollowUp reading its own sent DMs back as inbound —
and it was not.** I had run one query across two lead IDs and read the second lead's rows
(his own test account seeing the same thread from the other side) as duplicates on the
first. I corrected it in the same reply, before acting on it. Worth recording because the
wrong diagnosis was the more *interesting* one, which is exactly when a diagnosis needs
checking hardest.

What actually happened: nobody had mentioned days. On Instagram *"is this available"* points
at a **post FollowUp cannot see**, so it had no idea what "this" was and invented a
dimension to sound like it was making progress.

**A qualifying question is the worst possible place to guess**, because it does not read as
a guess. "Will this be for a weekday or weekend?" reads as the business knowing something
about the enquiry. An invented fact can be caught by a shape check; an invented *question*
passes every one of them, because nothing in it is false — it is just not about anything.

The drafter is now forbidden to qualify on any dimension the lead has not raised (dates,
days, times, sizes, quantities, locations, budgets, service types) and told to ask plainly
what they mean instead. DMs share this drafter, so the rule lands on both.

**Self-critique.**

1. **I got the diagnosis wrong and said it out loud first.** A query written across two
   leads, read as though it were one. The check that would have caught it — look at the
   `externalId` and `source` columns before concluding — took one more query, after the claim.
2. **This is the fourth "the drafter invented something" entry today** (a confirmed event, an
   adopted premise, a denial of being automated, now an invented question). They kept
   arriving as separate prompt rules. The pattern underneath all four is one thing: *the
   drafter fills silence with specifics.* That deserves a single structural answer — most
   likely a check on the draft asking "does every concrete noun in this appear in the
   conversation?" — rather than a fifth rule next week. **Not built. Named.**
3. **The ack hold is a product-behaviour change**, which `CLAUDE.md` puts with the founder. He
   asked for it in plain words, so it ships; but it makes "replies within a minute" false for
   every beta account, and the dashboard sentence fixed this morning now needs revisiting
   again. Flagged to him rather than quietly patched.

---

## 2026-09-20 — One check instead of a fifth prompt rule

The day produced four "the drafter invented something" fixes, and every one of them was
another sentence in a prompt. Named at the time as the wrong shape of answer; this is the
right one.

**The invariant already existed.** Both shape checks — `checkAckShape` and
`checkDmDraftShape` — extract number tokens from a draft and refuse any the conversation
does not contain. That rule is deterministic, costs nothing, and works in every language,
because digits are digits everywhere.

**What neither covered was a specific with no digits in it.** The message that went to a
real lead had none:

> lead: *"Hey is this still available?"* (twice, nothing else)
> FollowUp: *"Checking on the status now. Will this be for a weekday or weekend?"*
> lead: *"What do you mean"*

Not one digit, so both checks passed it. "Weekday or weekend" is as invented as a fabricated
price and worse in one way: **a wrong number reads as a mistake; a wrong question reads as
the business knowing something about the enquiry.**

`src/lib/grounding.ts` closes the calendar class, and both checks now call it.

**Intl, not a word list.** A list of English day names would be an English-only rule in a
product whose language story is Hindi, Punjabi, Spanish and Gujarati — and the founder
rejected exactly that shortcut once already, on the WhatsApp filter: *"a keyword list can
only ever be as multilingual as the person who wrote it remembered to be."* Day and month
names are not a word-list problem; `Intl.DateTimeFormat` generates them for any locale, and
the draft is checked in the lead's own language because that is the language it was written
in.

**Matching is whole-word**, via a hand-rolled check rather than `\b` — which is defined on
ASCII word characters and quietly stops working on the scripts this product has to handle.
Substring matching would ground "mar" against "market" and pass an invented "March".

**Honest coverage.** "Weekday" and "weekend" are not derivable from Intl and sit in a short
English list, marked as incomplete in the source. A place name, a service type or an
invented event is not detectable this way at all. That is why the prompt rules stay: this is
the net under them, not a replacement — and a net with known holes still catches what falls
into it.

**Also:** the dashboard's inbox sentence gained a third state. Holding is checked first now,
because on a holding account nothing is sent at all, so capture speed decides when the
*draft* is ready, not when the lead hears back. The two-state version was true for about six
hours — from the morning's ten-minute fix until the instant reply started waiting for
approval that afternoon.

**Self-critique.**

1. **The helper is the easy half; the wiring is where this fails.** A correct grounding
   function that nothing calls is worth nothing, so four of the tests go through the real
   shape checks with the real message rather than through the helper.
2. **The coverage is one class, not the problem.** "The drafter fills silence with
   specifics" is still mostly unguarded — places, service types, invented events. Calendar
   was chosen because it is the class that actually fired, and the only one with a
   language-neutral generator behind it. The rest remains prompt-only and is not solved.
3. **`UNDERIVABLE_EN` is the seam.** It is a hand-written English list, the exact thing the
   rest of the file is built to avoid, and it is where the next miss will come from — a
   Spanish draft saying *"entre semana o fin de semana"* walks straight through.
4. **Unverified in production.** Every test mocks the model. Whether real drafts trip this
   rule at a sane rate, or whether it starts rejecting good drafts and costing a
   regeneration every time, is only answerable from live traffic. `draftDm` retries once
   before giving up, so the failure mode is cost rather than a lost message.

---

## 2026-09-20 — A real customer got the same email twice

Found by going back to production and asking the database a blunt question: *are there any
outbound messages with the same body, to the same lead, more than once?* One hit.

Two **different** Gmail message ids, **identical** body hash, 3h45m apart. Not one email
recorded twice — two emails delivered.

**Nothing anywhere was checking.** `sendFollowUpToLead` guards volume (`checkSendCap`),
consent (`isSuppressed`) and channel; the send route adds a rate limit of 60 actions per 10
minutes. None of that is duplicate protection. And the approval queue's disabled Send button
is client-side only: a second tab, a slow network with an impatient second click, or a retry
all defeat it.

**It matters more today than it did yesterday.** As of this morning every message on a beta
account goes out through a human pressing Send in Approvals. That path is now *the* path, so
a double-tap is the likeliest way a real customer gets messaged twice.

Sixty seconds, compared on the exact body. Deliberately narrow — a guard that blocks a
legitimate resend would be its own bug.

**Honest about what it does not explain.** The two production sends were **3h45m apart**,
which this window would not have caught, and I could not determine from the data what
produced that gap. Both rows carry `trigger: null`, which means neither came through
`sendFollowUpToLead` (it always stamps one) — they were discovered by Gmail sync. So the
duplicate is real and the guard is right, but the specific incident remains unexplained and
is recorded here as such rather than quietly claimed as fixed.

### The mistake worth recording

The first version used `prisma.message.findFirst`. `sendFollowUpToLead` **already** makes a
`message.findFirst` call — for Meta's 24-hour DM window — so the new guard silently
inherited that lookup's stubbed return in every test that sets it, and **27 tests failed by
refusing every send as a duplicate.**

Two same-named queries answering completely different questions in one function are
indistinguishable to a reader and to a mock. Switching to `count` fixed it and reads better:
the question is "how many", not "which one".

Two test files then needed `count` added to their Prisma mock. That is the honest cost of
adding a query to a hot function, and it is visible rather than worked around.

**Self-critique.**

1. **I shipped a guard whose own test suite told me it was wrong, and I had to be told by
   27 failures rather than by reading.** The collision was visible in the file — the existing
   `findFirst` is forty lines below.
2. **The window is a guess.** Sixty seconds covers a double-click. It does not cover the
   incident that prompted it. I would rather ship the narrow guard and say so than widen it
   to cover a case I do not understand and start blocking legitimate resends.
3. **The right fix is probably a unique constraint**, not a read-then-write: two concurrent
   requests can still both pass this check before either writes. That needs a migration and a
   decision about what the key is (lead + body + minute?), which is more than this pass.
   Named, not built.

---

## 2026-09-20 — "Thank you for contacting My Business"

Found by sweeping production for the obvious things rather than waiting for the founder to
notice them: *are there outbound messages containing a placeholder?* Four, to real people.

`src/lib/auth.ts` names a brand-new workspace `"<their name>'s Business"`, or — when Google
hands over no display name at all — the literal **"My Business"**. That is a row label
waiting to be replaced in Settings, and on the founder's own account it never was. So the
sentence a stranger received was *"Thank you for contacting My Business."*

On a cold first email it is worse than it looks: the **subject line** carried it too, and
the subject is the only thing read before the decision to open. "Thank you for contacting My
Business" sitting in an inbox is indistinguishable from spam — which, the same day the
founder said *"they'll put us on spam, or they might report us"*, is precisely the exposure.

**It is the same bug as "Hi! Instagram,"** — the 2026-09-19 incident where the lead's own
name was the placeholder `findOrCreateLeadByInstagram` writes before a handle is known. That
half was fixed then, with `greetingFirstName`. Nobody looked for the other half.

So `businessDisplayName` lives **beside** `greetingFirstName` in the same module, and the
module's header is now the rule rather than one instance of it: *a placeholder identity never
reaches a customer.* Two modules each enforcing half is how the second half gets forgotten —
and it did, for a day.

Both return `""`, and `""` means **rewrite the sentence**, never interpolate a gap. There is
a test for `"Thank you for contacting ."` because that is the obvious way to get this wrong.

Also checked and deliberately NOT changed: `"My Business Solutions Inc"` is a real name that
merely contains the word, and `"us"` is on the placeholder list because
`acknowledge.ts` already falls back to it — "Thank you for contacting us" is a fine sentence
to reach by having no name, and a bad one to reach by being *named* "us".

**The sweep also cleared several suspicions**, which is worth recording so they are not
re-investigated: no leads stuck mid-sequence, nothing stranded in the outbound retry queue,
and the 146 filtered email threads read as correct rejections on inspection — marketing, HR
notifications, PayPal, showing confirmations, vendors. The classifier is doing its job.

**Self-critique.**

1. **This was findable on 2026-09-19 and I did not look.** The lead-name fix even names the
   pattern in its own header. Fixing the instance in front of me instead of asking "where
   else does this shape exist" cost four real messages.
2. **The subject line was the near miss.** I fixed the body first and only found the subject
   because I grepped every use of `businessName` rather than the one the incident named.
   The body reaches someone who already opened the mail; the subject decides whether they do.
3. **Not fixed: the real cause.** The founder's business still has no name and no industry,
   and nothing in the product ever asks again after onboarding. This guard stops the symptom
   reaching a customer; it does not get the business named. A "finish setting up" prompt is
   the actual fix and is his call, since it is a new piece of UI.

---

## 2026-09-20 — "I don't see any option like business name"

The founder, after I told him to fix his business name in Settings. **He was right and I was
wrong.** There was no such option anywhere in the product.

`Business.name` and `Business.industry` were asked once in the onboarding wizard and then
unreachable forever. `/api/onboarding` had always accepted a partial update — its own comment
says it is "reachable at any time, not just during first-run" — and no screen ever called it
that way. The backend was built for this; the UI was never added.

**This is the cause behind two separate incidents fixed earlier the same day.** Four real
people received *"Thank you for contacting My Business"*, and a photographer pitching a
software founder was read as a customer by a classifier running with `industry: null`. Both
were patched at the symptom. This is the thing underneath them.

### What was built

**A Settings section**, first in the Team tab — that is the account-identity tab, so who the
business *is* belongs above who works in it. Shape copies the other panels exactly (`box
p-5`, square icon tile in `--slate-soft`, title, one line of why it matters). Nothing new
invented; the pattern is already approved.

**A setup step**, second in the strip, right after billing. Cheap to fix and it changes what
every later step produces.

**Two fields, not three.** Team size is collected at onboarding and drives nothing today.
Adding it here would be a third control that changes nothing — [[rejected#^S-12|S-12]],
decoration that doesn't improve usability. It goes in the day it means something.

**The industry field carries a sentence saying what it DOES** — *"FollowUp uses this to tell
a real customer from a supplier or a sales pitch. With it blank, it has to guess."* Without
that line it reads as filing paperwork. With it, it reads as worth doing. That sentence is
the whole reason the field will get filled in.

**The placeholder notice is `--slate`, not `--coral`.** Nothing is broken and nothing has
been lost — but it is a fact the owner cannot otherwise discover, because the name only
appears in mail they never receive.

**`INDUSTRIES` moved to its own leaf module.** Two screens now ask the same question, and a
second copy of the list is how they start offering different answers.

**Self-critique.**

1. **I told him to do something impossible, twice.** "2 min in Settings" was in a status
   list I wrote, and again in the follow-up. I had read that Settings file several times
   today — including grepping it for `SECTION_TAB` — and never noticed there was no profile
   section. Asserting a screen exists without checking is the same error as asserting a
   behaviour exists without checking, and I have made both today.
2. **A test I wrote asserted the wrong premise** — that a Free business produces a billing
   step. It does not; `hasActiveAccess` treats Free as real access, which is recorded in
   `setupStatus.ts`'s own comment as a bug already fixed. The test failed, I read the
   comment, and fixed the test rather than the code. Worth recording because the instinct
   when a new test fails is to suspect the new code.
3. **Seven existing fixtures needed two fields added.** That is the honest cost of a new
   condition in a shared function, and it is visible in the diff rather than worked around.
4. **Unverified in the running app.** The database is unreachable from this sandbox, so the
   section was not rendered — typecheck, 1423 tests and a build are what stand behind it.
   A form is more likely than most changes to have a visual flaw those three cannot see.

---

## 2026-09-20 — One logo, everywhere

**Founder:** *"and logos are diffrent every where"*

He was right, and it was worse than inconsistent. The logo was approved on 2026-09-18, built
from his own concepts #69 and #71. Seven places never got it and were still drawing lucide's
`Compass` — a stock icon from a general-purpose icon set — in the accent blue, which
`public/brand/README.md` explicitly forbids for the mark ("No blue, purple or gradient"):

| Where | Who sees it |
|---|---|
| Sidebar, desktop and mobile | the owner, every day |
| Onboarding | every new account, at first impression |
| Booking page | **the lead** |
| Embed widget footer | **a stranger on the business's website** |
| Terms, Privacy | anyone checking whether this is a real company |

Only the landing page, sign-in and the 404 used the real mark. So every screen the owner
lives in, and two that their customers see, were branded with a stock compass.

**Cause, and the part worth remembering.** The component lived at
`src/components/landing/light/LogoMark.tsx`. That path says "landing page, light theme" —
so the app never reached for it. A shared asset filed under one consumer's folder is a
shared asset that stops being shared. It now lives at `src/components/LogoMark.tsx`.

**A second bug found while fixing the first.** The embed's "Powered by FollowUp" mark was
12px. The brand doc sets 16px as the symbol's minimum, and below ~24px the channel between
the two leaves — the one feature the doc says must never close — stops reading. `LogoMark`
now switches to the wider-channel drawing (the same geometry `src/app/icon.tsx` uses for the
favicon) below 24px automatically, rather than leaving each caller to remember. Verified by
rendering the mark at 12, 20 and 24px and looking at it: the channel survives at every size,
and 12px was visibly weaker than the rest, which is why the embed went to 16.

**Self-critique.**

1. **The rendering check caught something the code review did not.** I had already decided
   12px was acceptable and moved on; the screenshot is what showed it was thin. The design
   brain's "verify it renders" rule earned its place here.
2. **One thing deliberately left.** The embed header's FollowUp tile was not a size or colour
   bug — it was FollowUp's mark sitting on the business's identity block. That needed a
   product decision, not a fix, so it was asked rather than assumed. See A-017.
3. **Not verified in the running app.** Auth and a database are needed to see the sidebar and
   onboarding for real; the mark was rendered standalone at the exact sizes and inspected,
   and typecheck, lint, 1452 tests and a build stand behind the rest. A lockup's spacing
   against real neighbours is the kind of thing that check cannot see.

---

## 2026-09-21 — The favicon, the search result, and the switch

Three things the founder saw from outside the product, which is where the
interesting bugs live.

### "I can still see the compass sign when I'm searching for it on Google"

`src/app/favicon.ico` was dated **2026-09-01** — seventeen days before the logo
existed. In the Next.js App Router a `favicon.ico` in `src/app/` is served at
`/favicon.ico` and wins over the generated `icon.tsx`, and `/favicon.ico` is
precisely the URL a crawler asks for. So yesterday's "one logo, everywhere" pass
replaced the mark on every screen and left the one image a search engine
actually reads.

Rebuilt from `public/brand/png/followup-app-icon-*.png` at 16/32/64/128/256,
PNG-in-ICO so the channel stays crisp at 16px. Google re-crawls favicons on its
own schedule, so this will not change in search results today.

### "I'm seeing the privacy policy, and then 'Never lose a lead to silence'"

Two causes, both real.

1. **Neither legal page had a description.** Both set a `title` and nothing
   else, so both inherited the homepage's marketing description. Google
   therefore had a page titled "Privacy Policy" described as the product pitch —
   a plausible thing to show someone searching the product name. Both now
   describe themselves, and `layout.tsx` gained a title template so a page can
   name itself without repeating the whole homepage title.

2. **The public site URL was `NEXTAUTH_URL`,** in the root metadata, robots.txt
   and sitemap.xml, each falling back to `follow-up-app-two.vercel.app`. Those
   are two different questions sharing one variable: where OAuth comes back to,
   and what address the site publishes as canonical. A sitemap that lists
   vercel.app URLs invites Google to index the deployment host as a second copy
   of the site, and a search engine with two copies picks pages from either.
   Now `src/lib/siteUrl.ts`, with explicit `alternates.canonical` per page.

### "Can we fix all those switches to good 3D switches with proper, smooth animation?"

The same 44×24 switch was copy-pasted six times — five in Settings, one in
ImproveFollowUpToggle — each with its own inline `translateX(22px)`. Now one
`Switch` component.

On the "3D": `motion.md` already names "a toggle moving" as what motion is for,
so this is squarely inside the rules rather than an exception to them. What it
does **not** do is bevels, gloss or gradients — S-07 rules out 3D as ornament
and `CLAUDE.md` bans "gratuitous 3D". The depth is one drop shadow on the knob
over one inset shadow on the track, which says "press me". The movement does
the rest: ~6% overshoot on `cubic-bezier(.34,1.56,.64,1)` over 200ms, plus a
squash along the direction of travel while pressed. `prefers-reduced-motion`
removes all of it.

**A bug found on the way:** the five Settings switches were plain `<button>`s
with no `role="switch"`, no `aria-checked` and no label. A screen reader
announced five unnamed buttons on the screen that controls whether the product
sends anything. The component requires a label, so that cannot recur.

**Self-critique.**

1. **I mangled the file on the first attempt.** A regex with `(.*?)` for the
   `onClick` prop stopped at the first `}`, which is the wrong answer for a
   multi-line arrow function, and it half-rewrote five call sites. Typecheck
   caught it; `git checkout` undid it; a brace-matching pass did it correctly.
   The lesson is the boring one — do not parse nested braces with a regex —
   and the reason it was recoverable is that the change was uncommitted and the
   file's other edits were already merged.
2. **An import landed above `"use client"`,** which silently makes the
   directive inert. Lint caught it. Inserting an import by "first line starting
   with `import`" is not safe in a file whose first line is a directive.
3. **The favicon is not verified end to end.** The .ico was inspected and the
   source PNG looked at, but nothing here proves what a browser tab shows, and
   nothing can prove when Google re-crawls.

---

## 2026-09-21 — A setup step you cannot finish, and the first thing in the product you are allowed to skip

**Founder:** *"can we fix all"* — of five known bugs, one of which was this.

### The bug

`getIncompleteSetupSteps` cleared "Add your website widget" only when a lead actually
arrived through the widget. A business with no website can never cause that, so the strip
on Today asked them, forever, to do something they had no way to do. Because `SetupStrip`
renders `steps[0]` only and the widget is last, this was also the permanent final state of
setup for every such business: the checklist could never reach zero.

I found this on 2026-09-20 and deliberately did not fix it then. The note in that entry
says why: *"the honest fix is a dismissal, which needs an additive column and a route —
more than belongs in this pass, and the founder should decide whether 'skip this' is a
thing setup steps get."* That is a product question, and `CLAUDE.md` puts product questions
with the founder. He answered it today.

### What shipped

A `Business.dismissedSetupSteps` column, a `POST /api/business/setup-step` route, and a
quiet text control beside the strip's button.

**Only two steps can be skipped — `phone` and `widget`** (`DISMISSIBLE_SETUP_STEPS`). Both
are optional capture channels: no website, no widget; no calls, no number. Billing,
business details and the inbox are deliberately not skippable, and the filter is enforced
in `setupStatus.ts` *and* in the route's schema, so posting an id cannot widen it. The
reasoning is [[brand-principles#1|principle 1]]: those three are not preferences, they are
the product not working, and a dismiss on them would help the owner stop being told about
a real failure. Tidying the screen by hiding the problem is the dark pattern, not the fix.

**The label says what skipping means.** Not "Skip" — *"I don't have a website"*, *"I don't
take calls"*, written per step. [[brand-principles#4|Principle 4]] is explicit that the
reader will not work out what a generic "Skip" refers to or what it costs them. A sentence
someone recognises as true about themselves needs no working out.

**Quiet, beside the real action, not competing with it.** `text-xs`, `text-ink-soft`, no
border, no fill. It is the answer for a minority; a second filled button next to the first
would read as two equal options, which they are not.

**No confirmation dialog**, because it is reversible — and reversible for real, not just in
a comment. `SetupStepRestore` appears in Settings → Website widget only when the step has
been skipped, says so in a sentence, and offers "Remind me again". Without it the press
would have been a one-way door with no explanation anywhere for why the reminder stopped.

### What looking at it changed

Rendered at a 358px content width (a 390px phone less the page gutter) against the real
built CSS: no horizontal overflow, the description wraps to two lines, CTA 190px and skip
116px share one 318px row. But the skip control measured **116×16px** — legible, and a
genuinely hard thing to hit with a thumb. The underline moved to an inner span so the
button could carry `min-h-11` (the 44px touch-target floor) without a rule appearing under
empty padding. Measured again: 44px tall, visually identical.

Two things I could not check honestly and am not claiming: headless Chrome clamps its
viewport to 500px, so 390px was tested by constraining the container rather than the
window — valid here only because `sm:` is already inactive at 500px and the layout question
was the flex row's, not the breakpoint's. And the database is unreachable from this
sandbox, so neither the route nor the Settings panel was exercised against a real business.

### Self-critique

1. **The phone step is skippable and cannot be seen.** `CARRIER_CHANNELS_AVAILABLE` is
   false, so it never renders. I put it in the list because it is the same *kind* of step
   and leaving it out would have meant a second decision later, but nothing exercises that
   half in the product today. A test pins the list; the product does not.
2. **The inbox step has the same problem and I did not fix it.** A business that only ever
   gets leads by Instagram DM is asked to connect an inbox forever, exactly as the
   no-website business was asked for a widget. It is not in the skippable list because
   "you have no email at all" is a much rarer claim than "I have no website" and the step
   is load-bearing for most accounts — but that is a judgement, not a fact, and it is the
   next thing to ask the founder about rather than to decide alone.
3. **`SetupStepRestore` does its own fetch on mount.** Settings is a client component with
   no data loader, so the alternative was threading a prop through a page that threads no
   other props. It costs one request on a panel most people open rarely. Acceptable, not
   elegant.
4. **The skip is business-wide and admin-only, and the UI does not say so.** One admin
   pressing "I don't have a website" changes what every teammate sees on Today. That is the
   right scope — it is a fact about the business, not a preference of one person — but a
   non-admin currently sees no control at all rather than an explanation of why.
5. **Verified by typecheck, lint, 1465 tests, a production build and two renders.** Not by
   using it.

---

## 2026-09-21 — Onboarding asks where the leads come from, instead of assuming

**Founder, rejecting the question I asked him.** I had just fixed the website-widget setup
step (which could never be finished by a business with no website) and asked whether the
inbox step should get the same escape hatch. His answer was that I was patching the wrong
thing:

> *"why to skip i mean they should have a proper onboarding process where first we will let
> them know how this works and thats totaly skipable then we will help them to connect the
> sources easyly and skipable too if they dont want that source to be added"*

And, on whether a passed-over source should be raised again later:

> *"why would we ask agin he will be having the option to connect later too in settings"*

He is right, and the diagnosis is better than mine. The nag was a symptom. The cause was
that onboarding had exactly one thing to offer — Connect Gmail — so it decided on the
owner's behalf which channel mattered. A business running on Instagram DMs had nothing to
say yes to, pressed "I'll do this later", and was then told on Today, forever, to connect
an inbox it does not have.

### What shipped

Three steps: **details → how it works → where do your leads come from.**

**"How FollowUp works" is three beats and fully skippable.** The third beat is the one that
has to be exactly true, and it is where the old flow was worst: the Connect Gmail screen
described a read-only product at the moment it asked for send access. This says plainly
that FollowUp writes and sends, and what stops it. No AI language anywhere on the screen
([[rejected#^S-13|S-13]]) — remove every AI-referencing word and nothing changes, because
there were none.

**The sources step lists Email (Gmail/Outlook), Instagram, Facebook Page and the website
form**, each connecting in place. There are no Skip buttons: a row of Skip controls beside
a row of Connect controls is twice the screen for one decision
([[rejected#^S-06|S-06]]). Skipping is simply not connecting — whatever is untouched when
the owner presses Continue is recorded as "I don't use this", and the setup strip on Today
never mentions it again. That reuses the `dismissedSetupSteps` column added earlier the
same day rather than inventing a second mechanism.

**WhatsApp, Zapier and the CRM importers are one honest line pointing at Settings.**
WhatsApp connects through Meta's Embedded Signup — a JavaScript popup living inside
`WhatsAppConfig`, not a link — and the other two need a key or a URL pasted. A button that
cannot work here would be worse than a sentence that says where it does. Named rather than
hidden: a source nobody mentions is a source nobody knows about.

**The Meta callbacks learned where they came from.** Instagram and Facebook hardcoded a
return to `/settings`. During onboarding that does not merely lose the flow — it cannot
work at all, because the `(app)` layout bounces anyone who has not finished onboarding
straight back to `/onboarding`. The owner would authorise Meta and arrive back at the same
step with no message. Both now carry a `next` cookie, the same mechanism Gmail and Outlook
already used, through one shared `oauthReturnUrl` so five callbacks agree instead of
drifting. It is an allow-list of two known pages, not a redirect to whatever the cookie
says — that is the difference between resuming a flow and an open redirect.

**Resume is derived, not stored.** A `Business.onboardingStep` column would be a second
copy of something the server can work out, and a second copy can disagree with the first.
The rule is in `shouldResumeAtSources`, including the clause that matters most: arriving
back from a *failed* connect counts as evidence. Without it a refused Instagram connection
drops the owner two steps back onto the explainer and hands the error to a step that does
not render errors — the button appears to have done nothing.

### What looking at it changed

Rendered all three steps against the real built CSS. One thing was plainly wrong: when
nothing was connected the primary button read **"Skip for now"** in full-width filled
`--ink` — the loudest element on a screen whose whole purpose is to ask a question, telling
the reader to skip it. It is now always "Continue". Nothing blocks the button either way,
so the skipping does not need announcing ([[brand-principles]] #5).

Accent discipline held: four Connect buttons cannot all be the accent
([[rejected#^S-05|S-05]], A-006), so every row's button is the same quiet outline and the
screen's one primary is at the foot in `--ink` (A-003). Icon tiles are 36px at
`rounded-lg`, per A-018. Headings are `text-xl` per A-019.

### Self-critique

1. **Facebook's multi-Page case is a dead end inside the flow.** If Meta returns more than
   one Page, the picker is 296 lines woven into `FacebookConfig` on the Settings page, and
   I did not extract it. The row says so in a sentence and the owner finishes the Page
   choice after setup. That is honest, but it is the one path where onboarding hands off a
   half-finished job.
2. **"Did they set up the website form?" is guessed from whether they opened the panel.**
   There is no connected state to read — a snippet pasted into someone's own site is
   invisible to us until a lead arrives. Opening the panel is the closest honest signal,
   and it is still a guess: someone who opens it out of curiosity and never pastes it will
   keep being asked, and someone who copies it from Settings later was already dismissed.
3. **WhatsApp is named but not connectable here**, which is the weakest part of the step
   for a business that runs on WhatsApp — precisely one of the businesses this rebuild was
   meant to serve. Extracting the Embedded Signup popup is the fix and it is not done.
4. **Nothing was exercised against a real database.** The sandbox cannot reach one, so the
   three steps were rendered as static HTML against the built CSS, not driven. No OAuth
   round trip was actually taken; the `next` plumbing is verified by unit tests and reading,
   not by connecting an account.
5. **The step-2 copy is my writing, not tested on anyone.** It claims to be what a busy
   owner reads in ninety seconds. That is a design intention, not a finding.

---

## 2026-09-21 — WhatsApp connects during onboarding, like everything else

**Founder:** *"Yes"*, to fixing the gap I had flagged in my own self-critique on the onboarding
rebuild earlier the same day.

### The gap

The new "where do your leads come from?" step let a business connect email, Instagram and
Facebook in place — and pointed WhatsApp at Settings, a screen it had not reached yet. I
shipped it that way and said so at the time: *"WhatsApp is named but not connectable here,
which is the weakest part of the step for a business that runs on WhatsApp — precisely one of
the businesses this rebuild was meant to serve."*

Which is the whole problem. The step exists because onboarding used to decide, on the owner's
behalf, that email was the channel that mattered. Offering four sources and sending the fifth
away is a smaller version of the same mistake, aimed at the people it hurts most.

### Why it was harder than the others

Every other source connects by leaving the app and coming back: a link, a callback, a
redirect. WhatsApp does not. Meta's Embedded Signup runs in a popup driven by their
JavaScript SDK, and a finished connection arrives in two halves — a one-time `code` from the
login callback, and the phone number id from a `postMessage` the popup sends back. Whichever
lands second completes it.

All of that lived inside `WhatsAppConfig`, the Settings panel. The mechanism being welded to
one screen is the reason WhatsApp was the odd one out — not a product decision anybody made.

### What shipped

`useWhatsAppSignup` (`src/lib/useWhatsAppSignup.ts`) holds the mechanism; Settings and
onboarding both use it. Settings keeps everything only it offers: the message template, the
webhook reference, the paste-a-token fallback, disconnecting. **119 lines came out of
`WhatsAppConfig`**, so this is a move, not a copy — two copies of a popup handshake would
drift, and the drift would be silent.

The source row grew a third action shape. It had a link (Gmail, Instagram, Facebook) and an
expander (the website snippet); it now also has a button that acts in place, which is what a
popup needs. Reads "Waiting…" while Meta's window is open.

**A judgement against the design brain's own reuse rule, recorded because it is a
deviation.** `WhatsAppConfig` and `FacebookConfig` both use `MessageSquare`. In Settings they
are separate panels and that never shows. In this list they would be adjacent rows wearing
the same icon, which says "these are the same kind of thing". WhatsApp uses `Smartphone`
here. A phone is also the truer picture — this is the number already on the owner's handset,
not a page or an inbox — but the reason is the collision, and the inconsistency with Settings
is real.

### Verification

Typecheck, lint, 1481 tests and a production build, all clean. The sources step was rendered
against the real built CSS with the new row in place.

Two tests carry the change. `channelAvailability.test.ts`'s existing "reaches every value a
WhatsApp reply needs" guard now reads the panel *and* the hook, since half of what it pins
moved — the guarantee is unchanged, only the file holding it. A new case asserts onboarding
can actually start a WhatsApp connect and no longer tells anyone to go to Settings for it;
**verified by removal** — renaming the row's label fails it.

### Self-critique

1. **Not once exercised against Meta.** No popup was opened, no number connected. The sandbox
   has no database and no Meta app, so this is verified by typecheck, tests, a build and a
   render — nothing more. The handshake is line-for-line the code that was already working in
   Settings, which is the only real assurance here, and it is not the same as having run it.
2. **Two reads of `/api/whatsapp/config` on the Settings page now** — the panel's and the
   hook's. One cheap route, twice. The alternative was threading the panel's whole config
   shape through a hook shared by two very different surfaces, which is worse. Still waste.
3. **The icon inconsistency is a real cost**, not a free win. Someone who connects WhatsApp in
   onboarding and later opens Settings sees a different mark for the same thing.
4. **Facebook's multi-Page picker is still stranded**, from the same rebuild and for the same
   underlying reason — mechanism welded to the Settings component. This pass fixed the worse
   of the two and left the other exactly where it was.

---

## 2026-09-22 — The empty screens a tester meets on day one

Every one of the first ten testers lands on these screens with no leads and, quite
possibly, nothing connected. Two things were wrong there, and both are the defect this
codebase keeps finding: a sentence that is true in isolation and misleading in place.

### The dashboard told an empty account it was caught up

`headline()` had the leads list in scope and never looked at it. An account two minutes
old, with nothing connected and nothing ever captured, was greeted with **"Nothing needs
your OK right now."** — what a product says to someone who has been working and is done,
printed directly above a box explaining that FollowUp is not watching anything yet. The
page contradicted itself in one glance, the same way Settings did the day before (#301).

Now, before that line is reached: **"No leads yet."**

It deliberately says nothing about what is or isn't connected. This screen can see an
inbox and cannot see a website snippet someone pasted into their own site, so "nothing is
connected" would be a guess — and guessing is what produced the sentence being fixed. The
box below owns that explanation and already has three properly-reasoned branches for it.
The headline only has to stop claiming calm.

### Three screens sent the wrong business to the wrong place

Leads, Pipeline and Analytics each said **"Connect Gmail in Settings"**. One source out of
eight. A business running on Instagram DMs, WhatsApp or a website form was told to connect
an inbox it does not have.

This is the dead end the founder had already named in onboarding — *"they should have a
proper onboarding process [...] we will help them to connect the sources easyly"* — on
three screens nobody went back and checked after that rebuild. A principle fixed in one
place and left standing in three others is not fixed.

All three now name the sources generally: *"your inbox, website form, DMs or CRM"*.

### What deliberately did not change

`Connect Gmail` stays where it is genuinely Gmail: Google Calendar booking, invite emails,
the Gmail disconnect confirmation, the reconnect prompt. Generalising those would be the
same error pointed the other way.

### Tests

`emptyStates.test.ts`, 12 assertions. **Verified by removal** — dropping the leads check
from `headline()` fails one, restoring the Gmail-only sentence fails another. Three of the
twelve guard the other direction: that a working account still gets the calm line, that a
filtered-empty list is still told it is only the filter, and that Pipeline keeps its
separate "none assigned to you" wording.

### Self-critique

1. **"No leads yet." is flat.** It is honest and it is not warm. A first screen could do
   more than decline to mislead — it could say what happens next — but the box directly
   below already does that, and two sentences competing to explain the same emptiness is
   how the contradiction started.
2. **Source-naming is now a string in four places** (three empty states plus onboarding).
   A shared constant would stop the fifth copy drifting; a test guarding the phrase is a
   weaker substitute for the structure.
3. **Not rendered.** No database in the sandbox, so these were read, not seen. The wording
   is verified; the way it sits on the screen is not.
4. **The Settings setup strip still says "Connect Gmail or Outlook [...] until then the
   dashboard stays empty"**, which is false for a business capturing through the website
   widget. Same family, left alone because it belongs to the setup-steps logic rather than
   to an empty state, and that deserves its own look.

---

## 2026-09-22 — The phone line says "Soon" instead of pretending

**Founder's words:** *"we are not giving voice agent services right now, but we can do
'coming soon' or something, right?"* — the first item on the landing-page gap list from the
13 Sep research (*the voice agent is invisible on the page*), answered his way: not by hiding
it and not by selling it.

### What was actually wrong — worse than "invisible"

The hero's lead-flow diagram lists five sources, and the fourth is **"Missed call · via your
phone line"**, unmarked, beside Gmail and WhatsApp. `CARRIER_CHANNELS_AVAILABLE` is `false`:
the voice agent is built and the inbound routes are live, but no business can point a number
at FollowUp until the carrier registration clears. So the page was not failing to mention the
voice agent. It was **promising a channel a visitor then cannot connect** — the exact failure
`channelAvailability.test.ts` was written to prevent, in the first thing anyone sees.

It got there because that guard reads `app/page.tsx` and nothing else. That was the whole
landing page when it was written; the hero became a component in the 18 Sep rebuild and
walked straight around it. **A guard scoped to a file is scoped to a file, not to a rule.**

### What shipped

1. **A `.pill .pillMuted` "Soon"** on that one row, right-aligned. Not a new chip — the same
   pill the product cards use, so nothing near-duplicate entered the system. The diagram's
   `aria-label` names the phone line as coming soon too.
2. **A fifth FAQ item — "Can it answer my phone?"** — carrying the real answer: what it will
   do, that phone companies make every business register first, and, plainly, that **nothing
   on your phone line is picked up** today. The pill flags it; this explains it.

### What deliberately did not ship

- **No new section.** [[approved#^A-015|A-015]] settles the page's section list. A "what's
  coming" band would be deviating from an approved decision, which is his call, not mine.
- **No "notify me", no waitlist, no email capture** — [[rejected#^R-012|R-012]] is
  unambiguous: the site sells, it does not enrol. An earlier draft ended the FAQ answer with
  *"we will tell you when the phone line is ready"*; cut, because it implies a mechanism that
  does not and must not exist.
- **Not in the integrations card.** That card's off-toggle means *you have not turned this on*.
  Putting an unavailable channel in the same shape would read as connectable — dishonest in
  the opposite direction.

### Tests

Four new assertions in `channelAvailability.test.ts`, now reading the whole
`components/landing/` directory rather than one file. **Verified by removal:** flipping the
row's `soon` to `false` fails; deleting the rendered pill while keeping the flag also fails
(a field nothing reads would otherwise pass). Two guard the other direction — that a working
source is never marked "Soon", and that the FAQ actually says the phone is not picked up, so
the pill cannot become decoration. Rendered and looked at, both states. 1572 pass, eslint
clean, `npx next build` clean.

### Self-critique

1. **"Soon" is a word with no date behind it.** It is honest about availability and says
   nothing about when, which is the weakest kind of honest. The FAQ carries the reason, but a
   visitor who reads only the hero learns "not yet" and no more. Naming a month would be
   better and would also be a promise nobody here can keep — the registration is not ours to
   schedule.
2. **The hero now has a caveat in it.** The thesis picture is the strongest thing on the page
   and this puts a small "not yet" inside it. Worth it — an unmarked promise costs more — but
   it is a real cost, and removing the row entirely was the alternative I did not take because
   the founder asked for the opposite.
3. **The fix is behind a flag with nothing to un-do it.** When the registration clears,
   someone has to remember to flip `soon: true` and pull the FAQ item. `CARRIER_CHANNELS_
   AVAILABLE` gates the tests but not the copy, so the copy will lie in the other direction
   the day the channel works. A derived `soon: !CARRIER_CHANNELS_AVAILABLE` would be
   structurally right; it is not done here because the page must not import pricing flags
   into a client component, and that deserves its own look.
4. **The FAQ answer is five sentences.** Long for this page's register. Each one is doing
   work — what it does, why not yet, what is not captured, what does work — but it is the
   longest answer in the list and it earns that place only if a visitor actually opens it.

---

## 2026-09-22 — "The right person" was never true

**Founder:** *"fix them"* — the rest of the 2026-09-13 landing-page gap list. Checking each
against the current page first turned out to matter: the rebuild had already closed several,
and the one nobody had looked at was the worst.

### Three gaps were already closed by the 18–19 Sep rebuild

- **Gap 3, "Twilio" as a channel label** — gone from the page and every landing component.
- **Gap 4, the conflated hero stat** — the *"21× … no credit card required to see it for
  yourself"* sentence is gone; what remains is a standalone `No credit card required.` note.
- **Gap 2, the thesis arrives late** — the research was written against a metaphor headline
  (*"the one that went quiet"*). [[approved#^A-013|A-013]] replaced it with **"Never lose a
  lead because you forgot to follow up,"** [[approved#^A-014|A-014]] added **"Only for owners
  who *have leads* and don't have time to reply,"** and the second content section's headline
  is now literally **"You don't have a lead problem. You have a reply problem."** The thesis
  reaches a visitor in the hero. Gap closed.
- **Gap 9, trust content positioned late** — the data-handling answer was FAQ 5 of 6; it is
  now 3 of 5.

**The lesson, and it cost real time to relearn:** a gap list is a snapshot. Four of nine items
were stale, and "fixing" them would have meant changing things that were already right. Check
the live code before acting on a report older than the last rebuild.

### Gap 7 was live, and it was being sold

Four places promised that new customers **"go to the right person"**: the team product card,
the features grid, the FAQ, and the **$79 Pro tier's feature list**.

FollowUp does not do skill-based routing, and its own source says so in as many words.
`pickAssignee` in `@/lib/assignment` is *least-loaded* — "whichever team member currently has
the fewest leads assigned to them gets the next one." `@/lib/sourceRouting`'s header calls the
alternative "the more complex 'smart routing to the right salesperson' idea, **parked until
there's a real team to route between**." And a source set to `routeToPool` assigns the lead to
**nobody**, deliberately, until a human claims it.

So the page was selling condo-leads-go-to-the-condo-person. What happens is that the next lead
goes to whoever is least busy. Even distribution is a genuinely good feature — it is simply not
the one on the price card.

**Now:** *"New customers are shared out evenly, so nobody is buried"* on the card, the same in
the features grid, *"New customers shared out evenly across your team"* on Pro, and the FAQ
carries both mechanisms — even sharing **and** the shared list anyone can pick up, because a
visitor told only about the first would be surprised by an unassigned lead.

### Also corrected: the brain was lying about its own type

`brand-principles.md` principle 8 said "one typeface." Three ship — Public Sans for structure,
IBM Plex Mono for labels, Instrument Serif for the hero's emphasis italic (A-013's own
headline). False since the rebuild; gap 8 of the same report. Rewritten, and marked as a
correction rather than quietly edited — *"a small and deliberate set of typefaces"*, with the
real test stated: three faces doing three jobs is restraint, two sans-serifs competing for one
job is not.

### Tests

Five assertions in `trustCopy.test.ts`. **Verified by removal** — restoring "the right person"
fails. Three guard the other direction: that the claim is *replaced* rather than deleted (a
visitor with a team is owed an answer), that the pool case is named, and that the Pro list is
checked separately, since a page-wide match would pass on the other three being fixed while
the paid one lingered. 1576 pass, eslint clean, `npx next build` clean.

### Self-critique

1. **"Shared out evenly" is weaker copy than "the right person."** It is a real downgrade in
   how the feature sells, and the honest version of a claim usually is. No way around it —
   the alternative was continuing to charge for something that does not exist.
2. **Least-loaded is not actually "evenly" either**, strictly. It is even *going forward* from
   whatever imbalance already exists; someone who cleared their queue collects the next several.
   True in practice, loose in the edge case, and I chose the plain phrasing over the accurate
   mouthful. Worth revisiting if a tester ever asks.
3. **Four copies of one claim, again.** Same structural weakness recorded in the empty-state
   entry three days ago: the page repeats a sentence in four places with no shared constant, so
   the fifth copy will drift too. A test pinning the phrase is a weaker substitute for structure,
   and I have now written that substitute twice instead of fixing the cause.
4. **Gap 6 (the hero device) is still unanswered.** Asked twice; R-005 and R-009 both reject a
   mockup hero, so it stays untouched rather than guessed at.

---

## 2026-09-22 — The page sold sending; the product sends nothing

**Founder's decision**, choosing between four options put to him: *keep the pitch, state the
current truth in one line.*

### The finding

Six places on the landing page promised replies going out on their own:

| Where | What it said |
|---|---|
| Plus card description | "Every channel, with FollowUp **replying for you**." |
| Plus feature list | "**FollowUp replies for you**" |
| Features grid | "**Simple replies go out on their own.**" |
| How it works, step 4 | "…or **let simple ones go out on their own**." |
| FAQ 1 | "Only simple, safe replies **go out on their own**." |
| **Free** card | "You approve every reply before it goes out" — listed as a *Free tier* feature, which tells a reader that **paying removes the approval step**. |

`Business.holdAllForApproval` is `@default(true)` in the schema. `/api/automation/settings`
reads it and **never writes it**, so no business can turn it off. It short-circuits *ahead of*
`Lead.automationTier` in all three send paths (`automation.ts` line 825, `acknowledge.ts` 529,
`sequences.ts` 685) — so even a lead deliberately set to autonomous is held. Production
agreed: **zero outbound messages in 24h across 8 businesses.**

Nothing sends for anyone, on any plan, and there is no switch.

### Why one line and not a rewrite

Three of the four options were rejected *by the founder*, and the reasoning is worth keeping:
turning the hold off would undo a decision he made two days ago (*"don't send any replies
without asking me"*) before a single tester has watched it send anything unsupervised;
rewriting the pitch around approval is a repositioning that touches
[[approved#^A-013|A-013]] and the tier cards, hard to undo mid-beta; and leaving it flagged
accepts the [[rejected#^R-012|#301]] failure mode — *they find out after signing up*.

**Shipped:** the hero note, which every visitor sees, now reads *"Free while in beta. No card.
It follows up for you — nothing sends without your OK."* It replaced *"It stops the moment they
reply"* — a true line, but one already made as promise 1 of the four, where this fact was made
nowhere.

**The wording is the founder's, and it is a genuine correction to mine.** My draft read
*"Nothing sends until you approve it"* — accurate, and it threw the entire pitch away in order
to be accurate. His instruction: *"i want to say like this will follow up on behalf of you and
to build trust mention under your eyes or something."* That keeps the promise (**it follows up
for you**) and makes the supervision the *reason to trust it* rather than an apology for what
it cannot do. **Principle, worth generalising: when a claim is too strong, the fix is to say
what is true about the same promise — not to delete the promise.** I reached for subtraction
and it cost the product its own sentence.

**And the FAQ's first answer**, which is not scope creep: leaving *"only simple, safe replies
go out on their own"* under a hero saying nothing sends would have rebuilt the exact
self-contradiction of #301 on a single page. It now leads with the beta truth, keeps the
money/sensitive guarantee as what automatic sending *will* be, and drops *"you can turn it
fully on for any customer"* — false for the same short-circuit reason.

**Not touched:** the four remaining claims. The founder said keep the pitch; a beta caveat
in the hero governs the page, and rewording all six would have been the repositioning he
declined.

### Tests

Five assertions in `trustCopy.test.ts`, verified by removal in both directions. The important
one is a **tripwire, not a guard**:

```
it("the hold is still on — if not, the copy below is now the wrong copy")
```

It asserts the schema default is still `true`. The day that flips, this test fails and names
the caveat as the thing to delete — because the real risk is these tests passing forever
while the page understates a product that has started sending. Deliberately has no skip.

1581 pass, eslint clean, `npx next build` clean, hero rendered and read at 1440.

### Self-critique

1. **One line is doing a lot of work.** It sits under the CTA in 13px grey, and it has to
   correct four claims further down the page that still say the opposite. A reader who scrolls
   to Pricing without reading the hero note gets the old story. I raised this; the founder's
   call was the caveat, and I think it is right for a beta — but it is a compromise, not a
   clean fix.
2. **"Nothing sends until you approve it" reads as permanent.** It is a beta fact. The words
   "while in beta" were cut because the same sentence already opens with "Free while in beta"
   and saying it twice read badly. The tripwire test is what actually protects this, not the
   copy.
3. **The Free card still implies paying removes approval.** It says "You approve every reply
   before it goes out" as a Free feature. True of Free; currently true of everything. The hero
   line defuses it rather than fixing it, and a reader comparing cards side by side may still
   draw the wrong conclusion. The honest fix is the repositioning that was declined.
4. **Found by auditing claims against code, not by testing the product.** Nobody has run a
   tester through signup and watched what they expect versus what happens. That would have
   found this in ten minutes, and would find things this method cannot.

---

## 2026-09-22 — Permission to send, asked for rather than assumed

**Founder:** *"followup will be sending automatically followups if they have allowed and given
the permission."* Then, on building it: *"lets goo."*

### What was wrong

`Business.holdAllForApproval` was `@default(true)` and `/api/automation/settings` **read it but
never wrote it**. So every account held every message forever with no way out — and the landing
page was selling "FollowUp replies for you" as the $39 tier's headline benefit (see the entry
above). The product's central promise had no switch behind it.

### The shape

**Off unless granted. Granted explicitly. Revoked instantly.**

The default does not move: a fresh account still holds, which is what keeps the hero's *"nothing
sends without your OK"* true on day one. What is new is that an admin can now grant permission,
and the FAQ says where.

**The inversion is the dangerous part, and it drove most of the design.** The stored field is the
*negative* of the decision: `holdAllForApproval` true means "do not send". A misplaced `!`
anywhere in this path does not throw, does not fail typecheck, and does not look wrong in review
— it silently messages **every customer a business has**, signed as that business. So:

- the wire never carries the negative. The API takes and returns `autoSendPermission`, positive,
  and owns the single `!` in each direction;
- the client never computes it, which is why GET returns both forms;
- both directions are asserted at the route, and **verified by flipping each `!` and watching two
  tests fail**.

### Why it is not a Switch

Everything else in that section is a `<Switch>` with an optimistic flip. This is not, twice over:

1. **A switch is for a preference.** This is a decision whose consequence is that strangers
   receive machine-written messages on the business's behalf. It gets a statement of what will
   happen and a second, deliberate press.
2. **No optimistic flip.** The rest of the page flips first and reverts on failure — right for a
   timing preference, wrong here. An owner who sees "sending" must be looking at a server that
   agrees, because the next cron tick acts on the server's answer, not the screen's.

**Turning it off is one press with no confirmation.** Stopping must never be harder than starting.

The confirmation is four facts, not an "are you sure?" — *are you sure* asks for nerve; this asks
them to read what changes. It sits **above** the timing rules, because it decides what all of
them do.

### Also

`recordAudit` writes `automation.autosend.granted` / `.revoked` — named for the decision, not the
field, because the question someone asks after a surprising message is *who turned this on, and
when*. Admin-only and billing-gated, like the rest of the route.

### Tests

Ten in `sendPermission.test.ts`, driven through the real handler — the bug class here lives in
which branch runs and what it writes, which a source assertion cannot see. Four are about what
must **not** grant it: a non-admin, a signed-out request, a locked account, and a non-boolean
(`"true"`, `1`, `"yes"`, `{}` — none may coerce into a yes). One pins that saving an unrelated
setting leaves the hold alone. One pins that a missing business row reads as *not permitted*,
because the safe answer is the one that sends nothing.

1591 pass, eslint clean, tsc clean, `npx next build` clean.

### Self-critique

1. **I have not looked at this panel.** No database in the sandbox, so Settings cannot be
   rendered signed-in. The logic is tested and the markup reuses existing tokens, but the way it
   sits on the screen — three states, one of them an expanding block — is **unverified**. That is
   the same gap I flagged on the empty-state pass three days ago and have still not solved.
2. **Nothing has ever actually sent.** This removes the blocker; it does not prove the thing
   behind it works. The first grant will be the first time FollowUp autonomously messages a real
   person, and it should be the founder watching his own account, not a tester.
3. **No dry run.** An owner grants permission and the next cron tick sends for real. A "show me
   what you would have sent this week" step before the first live send would cost little and
   would let someone build confidence without risking a customer. Not built, and I think it is
   the right next thing.
4. **The four facts are my words, not tested for comprehension.** They read well to someone who
   already knows the product. Whether a first-time owner understands "low-risk" the way the
   risk classifier means it is unknown, and that mismatch is precisely where an unwanted send
   would come from.

---

## 2026-09-22 — "What happens if I turn sending on?"

The permission switch shipped earlier today with no way to see what it would do. An owner
granted it and found out from their customers. This answers the question from the queue they
already have, at the moment they are deciding.

### The claim it must never make

The obvious framing — *"here is what would have been sent"* — is a lie, and the reason is not
visible from outside the code.

**Both schedulers deliberately skip the risk classifier while the hold is on.** `automation.ts`
and `sequences.ts` say so in as many words: *"on an account where nothing sends without review,
it has nothing to decide, so its cost is not worth paying."* So for every lead currently
waiting, **nothing has ever judged whether that draft was safe to send.** The answer does not
exist to report, and a preview that implied otherwise would be the same class of defect as
everything else fixed today: a sentence true-sounding in isolation and false in place.

### What is knowable, and is therefore what it says

The hold *reason* is precise. `automation.ts` builds it as an ordered cascade — a real risk
finding first, then backfilled, then untouched, and only then the approval setting. So:

- reason is one of the three `HOLD_ALL_*` constants → **every other check passed; the setting
  alone stopped it**
- any other reason → **the draft has a problem of its own and waits either way**

That split is the feature. It tells an owner how much of their queue is their own choice and
how much is FollowUp genuinely needing them — without promising what the risk gate will decide,
because nothing knows that yet.

**The sentence:** *"Right now 12 follow-ups are waiting. 9 are waiting only because of this
setting — FollowUp will check those and send what passes. The other 3 need you either way.
Read them first."*

"Will check those and send what passes" is doing careful work: it says the gate runs, and
declines to predict its verdict.

### Decisions worth keeping

- **Its own route, not folded into `/api/automation/settings`.** `getPendingApprovals` scans up
  to 500 audit events; Settings is opened constantly and this answer is wanted once, at the
  decision. Fetched when the confirmation opens, so an owner who never opens it never pays.
- **Exact string matching on the three constants, never a substring.** These are customer-facing
  prose that has been reworded before (all three, 2026-09-20, over a grammar bug). A fuzzy match
  would keep passing while silently counting the wrong leads; an exact match fails loudly.
- **An unrecognised reason counts as "needs you".** A new rule or a reworded constant falls on
  the cautious side, never on "the setting is all that's stopping it".
- **A failed read shows no numbers at all**, rather than a confident zero for a queue it could
  not read.

### Found by rendering, again

Two bugs, neither visible to a test, both caught by putting the four states on screen:

1. **The confirmation block was invisible** — `--ink-soft` used as a background, which is a TEXT
   token. Fixed with `--card-2` and shipped as its own commit.
2. **"None of them are waiting only because of this setting. The other 4 need you either way."**
   There is no *other* when it is none. The counts were right and the sentence was not; the
   clause is now conditional on the first count being non-zero.

That is twice in one day that the render caught what 1605 passing tests could not.

### Tests

Eight in `sendPreview.test.ts`. Three guard the direction that matters — that a draft holding
for its own reason is never counted as setting-only, that an unknown reason falls cautious, and
that the examples never name a lead that waits anyway (they sit under a sentence about what the
setting is holding, so naming one would contradict the line above it).

1605 pass, eslint clean, tsc clean, `npx next build` clean.

### Self-critique

1. **It describes the queue, not the future.** An owner reasonably reads "9 are waiting only
   because of this setting" as "9 will go out". Between now and their next cron tick the queue
   moves, and the gate may hold some of those 9 anyway. The wording is careful; the inference
   is still available to make.
2. **The 500-event scan is inherited, not solved.** A business with a queue older than the scan
   window gets a count quietly missing the stale end of it. `pendingApprovals` already carries
   that limitation and its own comment calls a stale hold "a real bug worth surfacing some
   other way" — still true, still unsurfaced.
3. **The examples are computed and unused.** `getSendPreview` returns three names; the panel
   shows only numbers. I built the data for a sentence I then judged too long for a
   confirmation box. Either the names should earn their place or the field should go.
4. **Still no actual dry run.** This says which holds the setting owns. It does not show the
   owner the messages, side by side, as they would go out. That is the thing I would still
   build next, and the queue link is a weaker substitute.

---

## 2026-09-22 — The approval queue buried the drafts worth reading

### The defect

`getPendingApprovals` sorted by recency alone. On a holding account — which is every account —
that puts the only cards worth reading in a random position.

Nine cards say the same generic sentence: *"Held because your account holds every automated
message for you to approve before it goes out."* Somewhere among them, wherever it happened to
land, is one saying *"Held because the draft quotes a price nobody in this conversation
mentioned — check it before it goes."*

**That one is about to send a made-up number to a customer in the owner's name.** The other nine
need a glance. An owner scanning twelve near-identical cards has no way to tell which is which.

Which is the product's own thesis — *"which customer am I about to lose?"* — failing on the
product's own screen. FollowUp exists to stop a business scanning an undifferentiated list and
missing the one that matters, and its most trust-bearing screen was an undifferentiated list.

The founder's own queue produced the example: 2026-09-20, a lead asked what a consultation cost
and the draft answered *"El costo será de $100"* — a price nobody had mentioned.

### The fix

Drafts that need a judgement sort above drafts the approval setting alone is holding. Recency
stays as the tiebreak inside each group — among drafts that are alike, newest first is still
right.

The predicate is the one built this morning for the permission preview
(`isHeldOnlyByApprovalSetting`), moved to `holdReasons.ts` so both callers share it without a
cycle. **An unrecognised reason counts as needing a human**, so a new rule or a reworded
constant lands at the top rather than buried.

**One quiet line marks the boundary:** *"The rest are waiting only because you asked FollowUp to
check with you first."* Order alone is invisible — a reader cannot distinguish a deliberate sort
from the order things happened to be held in — so the line says what changed underfoot. It
renders only when there is a boundary, and there is no heading above the first group because
"Needs your OK" already names it.

### A test that tested itself

The first draft of the ordering test **reimplemented the comparator inline**, with a comment
claiming the two could not drift. They could: it was a test of the copy, and it would keep
passing while the shipped order drifted away from it. `compareApprovals` is now exported and the
test drives the real thing — **verified by deleting the group check and watching three tests
fail.** Worth remembering as its own lesson: a comment asserting two things agree is not a
mechanism making them agree.

### Tests

Four added (twelve in the file). 1609 pass, eslint clean, tsc clean, `npx next build` clean,
queue rendered with a mixed list.

### Self-critique

1. **Two groups, and the important one is a mixed bag.** "Needs a judgement" holds the
   made-up-price draft, the never-messaged lead, and the ordinary "went quiet 5 days ago —
   your call". The first is a near-miss; the last is routine. A third tier would separate them
   and I did not build one, because the boundary between "check this" and "decide this" is not
   something the hold reason currently distinguishes.
2. **The divider is very quiet** — 12px, grey, between cards. Right for the brand, and it may
   simply not be seen. Unknown until a real owner looks at a real queue.
3. **It reorders; it does not reduce.** Nine routine cards are still nine cards to clear. The
   real fix for a holding account is fewer things needing a human, not a better order among
   them — which is what the permission switch is for, and why these two shipped the same day.
4. **Rendered with invented data.** Five plausible cards I wrote. A real queue has lengths,
   names and reasons I have not seen, and the founder's own screenshot from 2026-09-20 is the
   only real sample this feature has ever been designed against.

---

## 2026-09-22 — The onboarding screen that exists to prevent a betrayal was committing one

Third pass of the same audit: check what the product claims against what the code does. Today
that found the landing page (twice) and the approval queue. This is onboarding.

### The find

`HowItWorks` is the third thing a new tester sees, and it is shown **while asking for permission
to send from their inbox.** Its own file header singles out the third beat:

> *"The third beat is the one that has to be exactly true. The old Connect Gmail screen
> described a read-only product at the moment it asked for send access, and the comment there
> recorded why that mattered: it is the gap between a surprise and a betrayal."*

That beat read:

> "Anything it **isn't certain about** waits for your OK, everything stops the moment they reply,
> and you can **turn sending off** for one person or for everyone."

Both halves stopped being true when `holdAllForApproval` became `@default(true)` on 2026-09-21:

- **"anything it isn't certain about"** tells a reader that some things go out without asking.
  Nothing does. Every draft waits, on every account.
- **"turn sending off"** is backwards — it is already off; the decision a business makes is
  turning it **on**. And **"for one person"** was false too: `holdAll` short-circuits ahead of a
  lead's own `automationTier`, so even a lead set to autonomous is held.

**So the screen written to close the surprise/betrayal gap was opening it, in the exact sentence
written to close it.** A comment declaring a line must be exactly true is not a mechanism keeping
it true — the same lesson as the test that tested its own copy, four hours earlier.

**Now:** *"Every message it writes waits for your OK. When you're ready, you can let it send the
simple ones itself — anything about price still waits for you. It stops the moment they reply."*
True today, true after permission is granted, and it names the choice instead of describing a
switch backwards.

### Tests

Four in `trustCopy.test.ts`, verified by restoring the old string and watching three fail. One
guards the other direction: the stop-on-reply guarantee survives, because losing it while fixing
the false half would be the overcorrection — the same mistake made this morning on the hero,
where the honest version threw the pitch away.

1613 pass, eslint clean, tsc clean, `npx next build` clean, screen rendered at phone width.

### Self-critique

1. **Beat three is now four lines** against two for the others. It is the trust beat and it
   earns the room, but the screen is no longer three even steps and that imbalance is real.
2. **Found by grep, not by walking onboarding.** Nobody has signed up as a new business and read
   these screens in order. The other two beats were checked for false claims and are clean; that
   is not the same as knowing the flow works.
3. **"Anything about price still waits"** is one example standing in for the whole risk gate,
   which also holds sensitive topics, ungrounded specifics and failed checks. The plainest
   example beats an accurate list at this length — but it is an example, and a tester could
   reasonably think price is the only thing held.

---

## 2026-09-23 — Applying an automation mode to leads a business already has

### The gap

Source rules answer "what should a **new** Gmail lead start on". They deliberately never touch
an existing lead — `applySourceRouting` runs once, at creation, "never on a resync/update of an
existing one".

Founder, today: *"if they have 60 or 600 leads, they can't do auto for all the leads, right? We
have to make something that, with just one click, will be auto for all of them."*

He is right, and the gap is worse than inconvenient: a business that switches on source routing
sees a screen full of rules and a lead list that behaves exactly as it did before. The rules
look broken. Nobody opens 600 lead pages to find out they aren't.

### What shipped

`setAutomationTierInBulk` plus `POST /api/leads/bulk-automation`, surfaced as an
**Apply to existing leads** block sitting *below* the rules in Settings → Source routing.

Three design calls worth recording:

1. **It opens by admitting the limitation.** The first line is *"These rules apply to new leads
   only — leads already in FollowUp keep whatever they are on now."* A bulk action that appears
   without explaining why it's needed reads as a second, redundant control. Naming the gap is
   what makes the button obvious.
2. **It reports what it did and did not do.** *"597 leads changed. 3 were left alone — they're
   in a workflow."* An enrolled lead cannot be raised above OFF (the workflow and the silence
   rule would both message the same person), and in bulk that must skip and count rather than
   fail the batch — one enrolled lead among 600 blocking the other 599 makes the feature
   useless, and a silent skip makes it dishonest.
3. **Lowering to OFF skips nothing.** Stopping must never be harder than starting. The
   double-send risk only exists when raising.

`updated` excludes leads already on the target mode, so "600 leads changed" never means "600
leads matched, none moved".

Admin-only, unlike the single-lead route: changing one lead is ordinary work for anyone on the
team; changing all of them is a business-wide decision about what reaches customers, so it sits
with whoever can already grant sending permission. Free-tier accounts are refused AUTONOMOUS
here as well as on the single-lead route, so bulk cannot be the way round the paywall. Audited
with the counts, because "how many, and to what" is the question asked after a customer gets a
message nobody remembers authorising.

### Tests

Six in `bulkAutomation.test.ts`, verified by removal: deleting `sequenceId: null` from the
update fails the skip test; deleting `businessId` from the scope fails the business-scope test.

1619 pass, eslint clean, `npx next build` clean, tsc clean. All four UI states rendered and read
(closed; 597 changed + 3 skipped; nothing to change; singular grammar).

### Self-critique

1. **The API takes a source filter; the UI does not offer one.** `setAutomationTierInBulk`
   accepts `source`, and the founder explicitly asked for source-wise ("like on WhatsApp or
   Gmail"). The UI ships with "every lead" only. That is a real half-delivery — the plumbing is
   there, the control is not, and a business with 600 leads across five channels may well want
   Gmail on Auto and Instagram on Assisted.
2. **The mode labels are still the old ones.** The founder has redefined them — Off = drafting
   only, Assisted = sends the safe ones, Auto = everyone — and his Off is a *behaviour* change,
   not a rename. This block uses today's labels and will need rewording once that lands.
   Shipping the labels ahead of the rename would have been worse; shipping under labels that are
   about to change is still a seam.
3. **Not rendered against real data.** No database here, so the four states were rendered from
   stubbed counts. The grammar and layout are verified; a 600-lead account's actual latency on
   the `count` + `updateMany` pair is not.
4. **No undo.** A misfired "every lead → Auto" is reversed by running "every lead → Off", which
   is honest but loses whatever per-lead choices were there before. Recording the prior tiers to
   offer a real undo was out of scope for today and is the obvious next thing if this gets used
   in anger.

---

## 2026-09-23 — The two surfaces that still described a sending account

Continuing the audit of claims the code stopped supporting when
`holdAllForApproval` became `@default(true)` on 2026-09-21. Two found, both
worse than the earlier ones because both are **unprompted**: the owner did not
go looking, the product came to them.

### 1. The lead's automation badge (`AutomationStatusBadge`)

The badge existed for task #63, after a real lead sat eligible for hours with
nothing visibly happening and the reason only findable in the database. Its
entire purpose is that nobody has to ask "why hasn't this sent".

Since 2026-09-21 it said, on every account, on a lead whose reply was about to
be **written and held**:

> **Following up soon** — Next automation check will pick this up

The badge built to prevent an unexplained non-send was the thing asserting the
send. It is also the app's most-seen claim: compact in every lead list row,
full at the top of every lead detail page.

**The design problem was that both easy answers are wrong.** `holdAllForApproval`
is not a second `masterEnabled`. With the master off nothing happens; with hold
on *everything happens except the send* — the lead is claimed, the reply is
written, it waits. So:

- "Following up soon" promises a send that is not coming.
- "Paused" says nothing is coming, and sends the owner off to fix a setting
  that isn't broken.

The badge had to say the true third thing:

> **Writing a reply for you to approve** — Next automation check drafts this —
> they wrote and haven't heard back. It waits in your approvals until you send it.

Shipped as a flag on the three timing states rather than a new state, so the
ranking above them (a closed deal, a paused lead, no send channel) is untouched
— those mean nothing is written either, and must still outrank this.

Two smaller ones fell out of the same read: `waiting` counted down to a send
("Next check in ~3h" → "Draft ready in ~3h"), and `account_paused` told the
owner to turn on "Auto follow-up on silence" — a half-instruction, since on a
holding account that produces a draft, not a message.

### 2. The weekly digest email

Worse, because it arrives unasked in the owner's inbox. The quiet-week line:

> "Nobody came back this week yet — every lead that wrote in was still answered
> within a minute."

On a holding account **nothing was answered at all**. `holdAllForApproval` stops
the instant acknowledgement too — acknowledge.ts withdrew that message's
exemption deliberately ("the only thing that could reach a stranger with nobody
having read it"). So FollowUp emailed an owner that their leads had been
answered within a minute while those replies sat unsent in that owner's own
queue. And a holding account is exactly where the automated counts are zero, so
this is the line such an account *always* got.

Second defect, true on every account: this report counts automated sends and the
leads who replied to them. **It never counted how many leads wrote in.** That
claim was not something the report knew — it was inferred from an empty list and
happened to read well. Removed rather than reworded.

The digest now leads with what needs the owner, in the subject line too:
*"FollowUp this week: 12 replies are waiting for your OK"* beats *"0 came back,
0 answered for you"* on an account holding twelve drafts.

### Tests

24 new, all verified by removal — restoring the old badge branch fails 2,
dropping the status flag fails 3, restoring the digest's old line fails 4.
`describeAutomationStatus` is exported and asserted directly, following
`describeAckOutcome`: the defect was in the prose, so a test restating the prose
would have passed throughout. 1643 pass, eslint/build/tsc clean.

### Self-critique

1. **Found by reading, not by using.** Nobody has received this digest on a
   holding account. The copy is right; the send path on a real account is
   unproven.
2. **Not rendered.** No database here, so the badge's new states were not seen
   in place. The longest new label — "Writing a reply for you to approve" — is
   materially longer than "Following up soon" and sits in a compact list-row
   pill. I believe it wraps acceptably; I have not watched it.
3. **The digest adds a query per business.** `getPendingApprovals` is an audit
   scan, now run once per business in the weekly cron at concurrency 3. Bounded
   by SCAN_LIMIT and weekly, so acceptable — but it is a real cost added to a
   cron that had none.
4. **Third instance of the same root cause.** Onboarding, the approval queue,
   now the badge and the digest. The pattern is a default flipped in one place
   and prose left standing everywhere else, and it keeps being found one surface
   at a time. A single list of every place the product claims something sends
   would have caught all of them in one pass, and does not exist.

---

## 2026-09-23 — Making "safe to send" a thing FollowUp actually knows

### The founder's ask

> "it should sort according to the sources then scores and let them know what is the
> priority and whom to focus on rather than reading all 600 drafts… for those who need less
> attention he should let them know that we can follow up in one click only if they want and
> they are safe to send… but we need to take care about the restriction of sending mails and
> messages of each source."

A prioritised approval queue: grouped by source, sorted by score, split into *needs you* and
*safe*, with one button for the safe pile and per-channel limits respected.

### The blocker nobody had noticed

**"Safe" did not exist.** `automation.ts` skipped the risk classifier entirely whenever
`holdAllForApproval` was on, with a comment that was correct at the time:

> "The classifier decides whether something is safe to send WITHOUT review. On an account
> where nothing sends without review, it has nothing to decide, so its cost is not worth
> paying."

True while "is this safe" was only ever asked about a message about to go out. It stopped
being true the moment the queue had to answer a second question: *of the drafts waiting for
you, which are routine?*

The consequence was already shipping. Two things built earlier today — the approval queue's
needs-you-first ordering, and the send preview's "held only by your setting" count — both
lean on the hold reason, and a forced-low verdict means a draft that quotes a made-up price
gets a `HOLD_ALL_*` reason like any other. **Both features were sorting and counting against
a verdict that had never been formed.** That is worse than not having them, because it reads
as an answer.

### What shipped

The verdict is now bought for every held draft, and **stored with the draft it judged**
(`Lead.suggestedRiskLevel` / `suggestedRiskReason`, nullable, additive).

Storing it is the whole trick. The cost the old skip was protecting is real — a held draft is
re-examined every hour for as long as it waits, and re-buying a verdict on an unchanged
conversation is the one cost in the product that grows with *time* rather than with leads
(the same reasoning that produced `suggestedDraftedFor`). So: paid once per draft, reused
until the draft changes.

Three cases that a naive version gets wrong, each pinned by a test:

1. **A draft written before this column** is current — so never "regenerated" — but unjudged.
   Keying the write on `regenerated` alone would buy its verdict every hour and throw it away
   every hour. The write is keyed on *did this pass pay for it*, not on *did the draft change*.
2. **A failed check is not stored.** Written down, it would be reused forever, stranding the
   lead on "couldn't check this one" with nothing ever retrying.
3. **An untouched lead is still skipped.** `UNTOUCHED_LEAD_REASON` outranks the approval
   setting in the reason cascade, so that draft is in the *needs you* pile whatever a
   classifier says. Null stays null, and null means unjudged — never "safe".

### Tests

Five new in `automation.test.ts`, verified by removal: restoring the old skip fails 3,
storing only on regeneration fails 1, ignoring the stored verdict fails 1. 1662 pass;
eslint, build and tsc clean.

### Self-critique

1. **This raises the bill and I cannot say by how much.** One classifier call per new draft
   on every holding account — which is every account. Previously zero. The reuse keeps it
   from compounding hourly, but the first pass over a 600-lead back catalogue buys 600
   verdicts at once, and nothing rate-limits that.
2. **Null is load-bearing and easy to misread.** Every consumer must treat "no verdict" as
   *not known to be safe*. Nothing enforces that yet — the first caller that reads
   `suggestedRiskLevel !== "high"` as safe will put unjudged drafts in a one-click send pile.
   The grouping work that follows must add that guard, and it does not exist today.
3. **Only the foundation.** The founder asked for grouping, priority, one-click and per-source
   limits. This is none of those — it is the fact they all depend on. The queue is unchanged
   so far.
4. **No real verdicts seen.** No database and no OpenAI key here, so the storage and reuse are
   proven against mocks. I have not watched the classifier judge one real held draft.

---

## 2026-09-23 — Grouping the approval queue so it answers "who first?"

Step 2 of the founder's 2026-09-23 ask. Step 1 (a real risk verdict per draft) is the entry
above; this is the shape built on it. No UI yet — this is the data layer and its guarantees.

### The idea, in his words

> "sort according to the sources then scores and let them know what is the priority and whom
> to focus on rather than reading all 600 drafts… for those who need less attention he should
> let them know that we can follow up in one click only if they want and they are safe to send"

A flat list answers none of that. Ordered by urgency it still asks an owner to work down 600
rows; ordered by recency, the same in a worse order. What a full queue needs is a *shape*:
these few need you, this is the one to open first, the rest are routine and can go together.

### The decision that carries all the risk

`isSafeToSendInBulk` is the only place in the product that says a message may reach a customer,
in the owner's name, **without a human reading it**. It has one way to fail badly — saying yes
too often — so the bar is narrow, stated once, and guarded twice:

1. The account's approval setting is the *only* thing holding it.
2. The classifier looked at **this** draft and said low.

**The second is not a restatement of the first**, and that is the whole point. Until this
morning the classifier was skipped on every holding account, so each held draft carried a
hardcoded "low" nothing had assessed. Built on the hold reason alone, the one-click pile's
first act would have been to send every unjudged draft in the account — including the one
quoting a price nobody mentioned — because its reason reads "your account holds every
automated message", which is true of all of them.

So **null is not safe**. An unjudged draft is not a safe draft; it is one nobody has looked at.
The self-critique on the entry above flagged that nothing enforced this yet. It does now, in
one function, re-checkable by the send endpoint rather than trusted from a browser.

### Ordering

- A source with anything needing a human outranks one that is purely routine, **however
  large**. Forty safe drafts is not where to look first.
- Among those, the group holding the highest-scoring lead wins — that lead *is* the answer to
  "whom to focus on", so it sits at the top of the top group.
- Ties fall back to size, then name, so the queue does not reshuffle under the cursor between
  renders.
- `summariseGroups` derives "focus on" from the ordered groups rather than re-scanning, so the
  sentence above the queue can never name a lead the list does not show first.

### Design direction for the UI that follows

Per A-006 (the founder's own six-axis taste test): dense, boxed with a real shadow and no
border, status colour doing the work, and `--rust` spent **once** — which here is obvious, it
is the "send the safe ones" button. That is the single thing on the screen an owner should act
on. R-001 also applies: this must not ship as a subtraction pass.

### Tests

18, verified by removal: treating an unjudged draft as safe fails 8, dropping the hold-reason
guard fails 3, ranking groups by size fails 1. 1680 pass; eslint, build and tsc clean.

### Self-critique

1. **No UI, so nothing is proven to a human yet.** Everything above is a pure function with
   good tests. Whether a grouped queue actually *reads* better than a flat one at 600 rows is
   unproven, and is the kind of thing only rendering will show.
2. **The cap and window rules are not here.** The founder was explicit that per-source sending
   limits matter, and `safeToSend` currently describes what is safe, not what is *sendable
   today*. A pile of 90 with a daily cap of 40 will need to say so, and nothing does yet.
3. **Score is doing a lot of load-bearing work.** Groups rank on it and both piles sort on it,
   but on a fresh account most leads are unscored (0), so the tie-break — recency — is in fact
   the common path. The ordering will look much better in tests than on a new account's first
   week.
4. **`UNKNOWN_SOURCE_LABEL` is a guess at wording.** "Added by hand" is right for the
   hand-typed case the founder's database actually had, but a CSV import with no channel
   column lands there too and is not hand-added.

---

## 2026-09-23 — The one-click send, and the rule it deliberately does not go around

Step 4 of the founder's 2026-09-23 ask. The button itself (step 3, the screen) is still to
come; this is the action behind it.

### The hard part was never the sending

> "we can follow up in one click only if they want and they are safe to send… but we need to
> take care about the restriction of sending mails and messages of each source."

A button that sends 90 messages is easy. A button that sends 90 messages without getting the
owner's mailbox suspended, without breaking the rules of the channels it sends through, and
without lying about what it did, is the job.

### The decision worth recording

`sendFollowUpToLead` takes a `humanSend` option. It exists for the one screen where a signed-in
person has a whole message in front of them and taps Send, and it is what lets an Instagram or
Messenger reply go out between 24 hours and 7 days under **Meta's human-agent allowance**.

Passing it here would have made this feature work on every channel. **It is not passed**, and
that is the single most important line in the file.

Nobody has read these messages individually — that is the entire point of the feature — so
telling Meta a human is handling each conversation would be a false claim, made to the one
party that can take the channel away. The refusal that follows is not a limitation to route
around; it IS the per-source restriction the founder asked for. Those conversations stay in the
queue for him to answer personally, which is what Meta's rule actually asks for.

The wider principle: **no channel rule is re-implemented here.** Every window, cap and
suppression already lives in the send path and is tested there. This layer's only job is to
collect what that path refuses and say it out loud, in the path's own words — the closed-window
sentence already tells an owner what they can do about it, and a second copy would drift.

### The other two guards

- **The list is never the caller's.** The screen posts a source at most; the set of drafts is
  re-derived from the queue and each one re-checked with `isSafeToSendInBulk`. A list of lead
  ids posted from a page is a list of leads somebody could edit.
- **A press is bounded**, at the product's own daily automated ceiling — a number already
  derived rather than picked (`sendCaps.ts`). One press should not be able to exceed what a
  whole day of automation may. A truncated press spends itself on the highest-scoring leads and
  reports what is left, rather than quietly doing less than it appeared to.

Route is admin-only and rate-limited to 5 presses per 10 minutes: the per-press ceiling bounds
one press, not a person leaning on the button.

### Tests

13, verified by removal: dropping the safe filter fails 1, claiming the human-agent allowance
fails 1, reading a zero limit as "no limit" fails 1. 1693 pass; eslint, build and tsc clean.

### Self-critique

1. **No screen yet, so the button does not exist.** The endpoint is real and guarded; nothing
   in the product calls it. Step 3 is the remaining work and is the part the founder will
   actually see.
2. **The ceiling is a single number, not a per-channel one.** The founder said "each source",
   and cap-wise this treats all sources alike — it is Meta's window that is per-channel, via
   the send path. A business whose Gmail limit is lower than the assumed one is not modelled.
3. **`sent` counts what the send path accepted, not what a provider delivered.** A message
   accepted and then bounced counts as sent here. That matches the rest of the product, and it
   is still a gap between the number and the truth.
4. **Never run against a real provider.** Every test mocks the send path. The concurrency,
   the partial-failure path and the 300-second ceiling on a few hundred real sends are all
   unproven against anything slow.

---

## 2026-09-23 — The approval queue as a shape, not a list

Step 3, the screen, and the last of the founder's 2026-09-23 ask. Rendered at 1200px and at
390px before shipping.

### What it does

51 held drafts render as **"Needs your OK (3)"**, a line naming the one lead to open first, and
one box saying 48 are routine with a single button. Below that, a section per source, each with
its cards and its own quiet send-all.

The founder's sentence, turned into a layout: sources, then scores, then "whom to focus on",
then one click for the rest.

### Design decisions

**Structure follows A-006 and dodges S-09.** The source is a *heading*, not a box, so the cards
inside stay the only box level. A box per source containing boxes is the card-in-card soup the
brain names — this component has been fixed for exactly that before.

**The accent could not be spent as A-006 describes, and I did not invent one.** Axis 6 ("accent
held back — spent once") assumed the navy-era blue. In the current tokens `--rust` resolves
through `--accent` to `#0a0a0a`, **the same value as `--ink`** — so naming the accent token on
the primary button would claim a distinction the system no longer draws. It uses `--ink`
explicitly, with a comment, and hierarchy is carried by place and weight: the button sits in its
own box above every group under a sentence that explains it, while the per-source buttons are
quiet `--card-2`.

**This is a real inconsistency in the brain and it is flagged, not patched.** A-006's sixth axis
is unexecutable as written. Finalising a colour is a `[TO DECIDE]`, which is the founder's, so
it goes to him rather than into a commit.

**The result matters more than the press.** `SafePileAction` reports what actually happened —
sent, how many remain, and every refusal **by name** with the sentence the send path wrote. A
button that says "Send 43" and quietly sends 31 is how a bulk action loses trust, and the
commonest refusal (a closed Meta window) is the one the owner can personally act on.

### A bug the render caught that the tests did not

`ApprovalItem` was a hand-written subset of `PendingApproval`, re-mapped field by field on the
dashboard. That mapping silently dropped `draftRiskLevel` the moment grouping needed it — and
since the safe pile is built from that field, **every draft would have landed in "needs you"
and the one-click pile would have been permanently empty**, with no error anywhere. 1693 tests
passed while this was true. `ApprovalItem` is now an alias of `PendingApproval`; an alias cannot
drop a field.

The first render showed exactly that failure — "Needs your OK (51)", no pile, no button — though
for a second reason: my preview data used a truncated hold reason. The exact-match predicate
refused it, correctly. Two different faults, one screenshot.

### Verified

Rendered at 1200px and 390px. Phone width measured over CDP rather than eyeballed:
`scrollWidth` 390 against a 390 viewport, **zero elements past the edge**. (An earlier
"overflow" was my own screenshot flag — `--window-size` crops without setting a mobile
viewport.) 1693 tests, eslint, build and tsc clean.

### Self-critique

1. **The safe pile shows a count and one name, not the drafts.** An owner who wants to
   spot-check three of the 31 before pressing cannot, without opening leads one at a time. That
   is a real gap in a feature whose whole premise is trust.
2. **"1 routine draft from Added by hand" reads badly.** The fallback label works as a heading
   and not as a phrase in a sentence.
3. **Never pressed against a real send.** The button, its result line and the refusal list are
   all rendered from stub state; no database and no provider here. The one path that actually
   matters is the one I could not exercise.
4. **Nothing paginates.** 600 drafts means 600 cards in one page at 3 needing attention. The
   grouping makes that survivable rather than solved.

---

## 2026-09-23 — Accent hue deferred, not decided

Raised: A-006's sixth axis ("accent held back — spent once") cannot be executed, because
`--rust` now resolves through `--accent` to `#0a0a0a`, the same value as `--ink`. The approval
queue's primary button therefore reads identically to the secondary ones on the cards.

**Founder:** *"leave for now we will make it stand out later lets just build the basic thing
first."*

**Status: DEFERRED, and still open.** Not approved as monochrome — explicitly parked. The
`--ink` usage in `SafePileAction` carries a comment saying why it is not the accent token, so
whoever resolves this finds the reason rather than a bare colour.

**The principle this confirms** (consistent with R-001's inferred reading): function before
finish. A control that works but does not yet stand out is shippable; polish is a later pass he
will call. Do not spend a turn on visual differentiation he has not asked for.

**To resolve later:** give `--accent` a hue again (which re-enables axis 6 everywhere, not just
here), or record A-006 axis 6 as superseded by the monochrome system. That is a token decision
and therefore his.

---

## 2026-09-23 — Auto becomes a permission, not a setting

**Founder:** *"let's just put 'assisted' by default. Auto should be permitted by the user that
is using followup."*

Assisted was already the default (`Lead.automationTier @default(ASSISTED)`) — nothing to do.
The second half was a real hole.

### What stood in front of Auto before

Auto is the one mode that skips the risk check: a lead on it sends price talk, delivery dates
and tense conversations with nobody reading them. Three things looked like guards, and none was:

1. **A confirmation dialog** on the lead page — client code. The API never hears about it.
2. **A billing-tier check** — Free is Assisted-only. That is pricing, not consent. Paying for
   Pro is not saying "send things nobody has read".
3. **No admin check on the API at all**, so any signed-in teammate could set any lead to Auto
   by calling it directly.

And a fourth path had nothing whatsoever: a `SourceRule.automationTierDefault` is applied when a
lead is **created**, so one rule could put every new lead from a channel onto unreviewed sending
with no human in the loop at any point — the dialog never appears there.

### The rule

`Business.autonomousAllowed`, **false by default for existing accounts as well as new ones**.
Nobody has ever been asked this question, so nobody has answered it, and an unanswered question
is not a yes.

**It gates both ends, which is what makes it a permission rather than a speed bump.** A lead
cannot be put on Auto without it, *and* a lead already on Auto does not send unreviewed without
it. Gating only the first would have left every account that already had Auto leads exactly as
it was — the setting would be decoration for the people it most needs to protect.

Without permission an Auto lead is treated as **Assisted, not Off**: still drafted, still
risk-checked, still queued. Nothing is lost by withholding it, and a safe draft still sends —
which is Assisted working, not a hole.

### A test I got wrong

The first version asserted that an Auto lead on an unpermitted account sends nothing at all.
That was wrong about the **product**, not the code: it would have pinned
Auto-without-permission as equivalent to Off. The real guarantee is that nothing goes out
*unchecked*. Corrected to assert the classifier runs and a risky draft is held.

### Tests

10 new across three files, verified by removal: ignoring the permission in the send path fails
4, treating a missing business row as consent fails 1. 1707 pass; eslint, build, tsc clean.

### Self-critique

1. **The Settings panel is unrendered.** Written to the same pattern as the send-permission
   panel above it (no optimistic flip, quiet secondary style when on), but not screenshotted —
   and I shipped an invisible panel earlier today by exactly this shortcut.
2. **No confirmation before granting.** The send permission has a four-fact confirm block; this
   one is a single button. Arguably the narrower permission deserves the same pause, and it does
   not have one.
3. **The source-rule downgrade is silent.** A rule asking for Auto quietly lands the lead on
   Assisted, and the Settings screen that configures those rules says nothing about it.
4. **Existing Auto leads change behaviour on deploy.** Correct and intended, but it is a real
   behaviour change for anyone mid-flight — invisible today only because `holdAllForApproval` is
   on everywhere.

---

## 2026-09-23 — Turning Auto on means "from now on", not "and everything since"

**Founder:** *"lets get auto working but make sure it activates or sends messages after the user
turns it on."* The word doing the work is **after**.

### The blast

A permission that only gates the future is fine. One that silently gates nothing is a disaster
on the most optimistic day of an account's life.

Every lead that went quiet while Auto was off is **already past its silence threshold**. So the
first hourly tick after the switch finds the entire back catalogue eligible at once. The owner
presses one button meaning "start doing this for me" and a few hundred messages leave in their
name, unread, about conversations that ended weeks ago.

`Business.autonomousAllowedAt` is the line: stamped on grant, cleared on revoke (so granting
again starts a fresh window rather than reaching back). A conversation that moved after it may
send unreviewed; anything older is backlog.

### The mistake I made twice, and it mattered the second time

My first fix downgraded a backlog lead from Auto to **Assisted**. That looks right and is
useless: **Assisted sends the safe ones**, so a low-risk backlog draft goes out anyway and the
guard is decoration.

The first time I made this mistake it was only a wrong test expectation (recorded in the entry
above). The second time it was in the *implementation*, and the tests caught it — the removal
check now pins it explicitly, because it is clearly an easy thing to get wrong.

Backlog is **held outright**, not downgraded. Still drafted, still risk-checked, but it waits —
so the owner sees the size of the back catalogue and releases it deliberately, which is exactly
what the queue's one-click routine pile is for.

### Scope

Only leads the owner actually put on Auto. A lead on Assisted is already behaving as asked, and
a quiet lead is precisely what the silence nudge exists for.

### Tests

4 new, verified by removal: removing the hold term fails 3 (the trap), ignoring the grant time
fails 3. 1711 pass; eslint, build, tsc clean.

### Self-critique

1. **The same blast exists for the OTHER permission and is not fixed.** Turning off
   `holdAllForApproval` — "send on my behalf" — releases every held ASSISTED draft on the same
   next tick, and nothing stamps when that was granted. It is the identical failure with a wider
   blast radius, and this entry only closes the Auto half because that is what was asked for.
   **This is the most important open item in this file.**
2. **"Moved since" is the newest message, not the trigger.** A lead whose last message predates
   the grant but which becomes newly due later still reads as backlog forever, until they write
   again. Cautious in the right direction, but it means some leads never leave the queue on
   their own.
3. **Nothing tells the owner this is happening.** The backlog is held with an ordinary hold
   reason; no copy anywhere says "these are from before you turned it on." The queue will simply
   look fuller than expected.
4. **Never observed end to end.** No database here, so the grant-stamp, the comparison and the
   hold are proven against mocks only.

---

## 2026-09-23 — The same guard for the wider switch

Closes the open item flagged as most important in the entry above. Founder: *"sure."*

### The bigger blast

Turning off `holdAllForApproval` — "send on my behalf" — makes **every draft in the approval
queue** sendable on the next tick. The queue is precisely where a holding account's entire
history accumulates, so this releases weeks of drafts about conversations that ended long ago.

Wider than the Auto version in two ways: it is not limited to leads on Auto, and it is the
switch an owner is most likely to press first.

`Business.autoSendAllowedAt` is the line, stamped on grant and **cleared on revoke** — so
granting again starts a fresh window rather than reaching back and releasing everything held in
between. Held outright, not downgraded, for the reason the Auto version learned the hard way.

### One deliberate asymmetry

Null here does **not** mean "no permission", unlike the autonomous pair.

An account whose hold was lifted before this column existed has no stamp, and reading that as
"everything is backlog" would silently freeze a working account — a worse failure than the one
this guard prevents, and one nobody would notice until customers stopped hearing back. So the
guard applies only where a grant was actually recorded.

Checked against production before deciding: all 9 businesses still hold, so no account is in
that older state today. The asymmetry is protection against a state that cannot currently
occur, which is the right time to add it.

### Tests

4 new. Verified by removal — and the first attempt was an **ineffective mutation**: deleting the
null check left a comparison against null, which is false in JS, so behaviour did not change and
no test failed. Replaced with a mutation that genuinely inverts the rule, which fails 14.
Removing the guard itself fails 1. An existing test also caught the change to the update payload
and now pins the stamp and its clearing. 1715 pass; eslint, build and tsc clean.

### Self-critique

1. **Still nothing tells the owner.** Backlog is held with an ordinary hold reason. After
   granting either permission the queue simply looks fuller than expected, with no sentence
   anywhere saying "these are from before you turned it on". This is now true of both switches
   and is the obvious next piece of work.
2. **Two near-identical mechanisms.** `autonomousBacklog` and `autoSendBacklog` sit side by side
   with subtly different null semantics for good reasons, which is exactly the shape that drifts.
   They should probably be one helper with the difference as a parameter.
3. **"Moved since" is still the newest message.** A lead that becomes newly due later without
   the other side writing reads as backlog indefinitely.
4. **Proven against mocks only.** No database here; the stamp, the comparison and the hold have
   never been watched on a real account.

---

## 2026-09-23 — Telling the owner why the queue did not shrink

Closes the open item from the two entries above. Founder: *"sure."*

### The confusing moment

An owner turns sending on expecting things to start moving, opens the queue, and finds it
**fuller than before** — because everything that piled up while the switch was off is still
there, deliberately. Every one of those drafts carried the generic line, *"your account holds
every automated message for you to approve"*, which by then is no longer true.

With no sentence of its own, the backlog guard reads as the feature not working. The guard is
right and the silence around it was the bug.

### The sentence

> "this one was already waiting before you turned sending on, so FollowUp left it for you rather
> than sending it with everything else"

**One sentence for both switches.** Which of the two held it is not a distinction an owner has
any use for; what they need is that this is old, it is theirs to release, and nothing is broken.

**Below `holdAll` in the cascade.** While the hold is on, *that* is why the draft is waiting, and
the backlog line would be a more specific answer to a question nobody asked. It becomes the true
sentence only once a permission has actually been granted.

**Below every real finding**, like the rest of the cascade. "This was already waiting" on a draft
that quotes a made-up price would bury the thing that matters.

### The part that is load-bearing

The reason is added to `HELD_ONLY_BY_SETTING`, which is what the one-click routine pile is built
from. Leave it out and the entire back catalogue sits in the queue with no way out but one lead
at a time — **the backlog guard becomes a trap instead of a courtesy**, and the "release it
deliberately" story the last two entries rest on quietly stops working.

Both safety guards still apply: a backlog draft the classifier did not clear is not safe, and
being old does not make it safe.

### Tests

5 new, verified by removal: dropping it from the safe set fails 1 (the trap), removing the
sentence fails 1. 1720 pass; eslint, build and tsc clean.

### Self-critique

1. **Still nothing at the top of the queue.** Each card explains itself now, but an owner facing
   48 backlog drafts reads 48 identical sentences rather than one line saying "48 of these are
   from before you turned it on". The summary line is where this really belongs.
2. **Not rendered.** The sentence is asserted through `runAutomationForBusiness`, never seen on
   a card.
3. **Three near-identical mechanisms now.** `autonomousBacklog`, `autoSendBacklog` and this
   shared reason. The consolidation flagged last entry is overdue rather than less needed.
4. **Wordy for a card.** Twenty-three words, where the cards around it run to eight or ten.

---

## 2026-09-23 — Four gaps closed, three of them found by rendering

Founder: *"let skeep fixing all the gaps bro we dont have time i want testing users once the
meta sends appoval."* So: the gaps that stand between a tester and a bad surprise, not the
architectural tidy-ups.

### 1. The summary line the last entry asked for

`summariseGroups` now returns `fromBeforePermission`, said **once above the queue** instead of
48 times down it. Self-critique #1 of the previous entry, closed.

### 2. Granting Auto now asks first

"Let some leads skip the check" was a one-press grant. The send permission beside it makes an
owner read four facts; the *narrower and more dangerous* permission asked nothing. It now opens
the same shape of panel — four facts, "Yes, let those leads skip the check" / "Not yet" — and
names any **channel rule already set to "Handle it all"**, because a source rule applies at lead
creation: granting this does not only affect leads the owner picked one at a time. Revoking
stays one press; a confirmation on the way out is a speed bump in front of the safer answer.

### 3–5. What rendering caught that 1725 passing tests did not

Three real defects, none of which any assertion could see:

- **`•` and `—` as literal text.** Escape sequences work in a JS string literal and
  not in JSX text. The panel shipped its bullets as the characters `•`.
- **The queue contradicting itself.** "2 of these were already waiting" sat under a heading
  reading "Needs your OK (1)" — the count spans both piles. Now "2 of the drafts below".
- **The queue sorted by the alphabet.** Two all-routine source groups of the same size fell
  through to `source.localeCompare`, so "Added by hand" holding a lead scored 40 sat above
  "Gmail" holding one scored 66. Groups now break ties on the best score in the group. The
  founder asked for *"sources then scores"*; this was sources then spelling.

### Tests

4 new, each verified by removal (2 fail on the backlog count, 1 on the ordering). 1725 pass;
eslint, build and tsc clean.

### Self-critique

1. **Rendering found more bugs than the test suite again.** Third time today. The lesson is not
   "write more tests" — it is that a screen nobody has looked at is a guess, and the preview
   harness should be part of the loop rather than something remembered at the end.
2. **The safe pile still cannot be spot-checked.** It shows a count and one name. An owner who
   wants to read three of the 40 before pressing cannot.
3. **Still nothing paginates.** 600 cards render as 600 cards.
4. **Still three near-identical backlog mechanisms.** Flagged twice now, deferred twice.
5. **The source-rule downgrade is still silent.** A rule asking for Auto without permission
   lands the lead on Assisted and says so nowhere in the UI.

---

## 2026-09-23 — A grace period before a bulk send

Prompted by the `apple-design` skill the founder was shown ("agency: keep people in control;
offer forgiveness"). Most of that skill is gesture and spring-motion craft aimed at touch UI and
does not apply to a desktop dashboard — but its forgiveness principle landed on a real hole:
**Send all N** dispatched up to a day's cap of real messages with no way back.

### It is a delay, not an undo, and the copy has to say so

A sent message cannot be recalled from Gmail, WhatsApp, Instagram or SMS. The only honest
version is a window *before* the send. So the label reads **"Sending all 3 in 10s"** —
present tense, about to happen — with an **Undo** button beside it. Calling it "Undo" after a
real send would be a lie the first time someone pressed it.

### Ten seconds, not Gmail's five

Pinned against `research/customers/2026-09-05-icp-pain-and-trust-objections.md`: the owner is
up a ladder, interrupted, on a phone, giving the app ninety seconds. Five seconds assumes
someone at a desk watching the screen. The asymmetry decides it — **a longer window costs
almost nothing**, because nobody is waiting on the result, while a short one costs forty
messages that should not have gone.

### Leaving the page sends

The contestable call, written down rather than left to whichever branch was easier. Cancelling
on leave means an owner who presses Send and shuts the laptop believes forty follow-ups went
out when none did — the exact failure `SafePileAction`'s own docstring forbids. There is a
button on screen that says Undo; someone who wants to cancel presses it. `pagehide` +
`sendBeacon`, because the ICP is on a phone and `beforeunload` routinely never fires there.

### The race, and why it is a gate

On the last millisecond the timer can fire while a finger lands on Undo. Both running means
the messages go **and** the screen says cancelled — the worst outcome available, because the
owner walks away believing nothing was sent. Sending and cancelling now claim the same
one-shot token (`createSendGate`), so exactly one wins. Deliberately not a boolean in a ref
that two call sites check then set: that is the check-then-act shape already fixed once in the
rate limiters (#89).

### Constraints honoured

- **[[rejected#^R-002|R-002]]** — no keyboard shortcut. `Z`-to-undo was part of the rejected
  keyboard model; this is a visible button only.
- **[[rejected#^R-001|R-001]]** named "the undo grace" as a move that *may survive* a richer
  design. This is that, built as addition rather than subtraction.

### Tests

8 new in `undoWindow.test.ts`, verified by removal (`ceil`→`floor` fails 1; removing the gate's
guard fails 2). Rendering then confirmed the states end to end: countdown → Undo → "Stopped —
nothing was sent" → button returns; and a full countdown fires **exactly one** POST, which is
the assertion that matters. 1733 pass; build, tsc, eslint clean.

### Self-critique

1. **Single "Approve & send" has no grace.** Deliberate — the owner just read that one message,
   and a countdown on every single send taxes the common path. But it is an inconsistency, and
   the first person who misclicks a single send will not find it principled.
2. **The countdown is text, not a progress bar.** A depleting bar reads at a glance; "10s"
   has to be read. Chosen for restraint, but this is the weakest part of the design.
3. **Nothing tells the owner leaving will send.** The behaviour is right and undocumented in
   the UI. One line could say it, at the cost of clutter on the calm path.
4. **Overlapping presses are untested.** Two groups counting down at once each have their own
   gate, which should be fine because the server re-reads what is still pending — but I did
   not verify it.

---

## 2026-09-23 — Reading a few before sending forty

The routine pile shipped as a count and one name: *"40 routine drafts from WhatsApp — top is
Tom Alvarez [Send it]"*. That asks an owner to put forty messages into customers' hands, in
their business's name, having read none. The likely response is not trust — it is nobody ever
pressing, and a one-click pile nobody presses is the feature not existing, with extra code.

**"Read a few first"** — closed by default, one press, shows the top 3 as read-only rows.

- **A sample, not a list.** Expanding forty rebuilds the wall the pile exists to knock down.
  Three is enough to see a pattern and few enough to read standing up.
- **Both halves of each row.** The inbound message *and* the draft. "Tuesday works" reads as
  fine or as nonsense depending on what it answers; judging a reply without its question is not
  a spot-check.
- **Read-only.** No per-draft Approve/Edit here — that would turn the sample into a second
  approval queue, and beg what the other 37 are. The decision it serves is the one below it.
- **The caption is computed, not written.** `describeSample` branches on the sample-equals-pile
  case, because "the 3 highest-scoring of 3" is true and reads as though something is withheld.

### And a duplicate control rendering caught

With every routine draft from one source, the whole-queue box and that source's row were the
same button, one above the other, both reading **"Send all 12"**. Two identical controls is not
a choice — it is a question about whether they differ. The whole-queue box now appears only
when more than one source contributes routine drafts.

### Tests

7 new, verified by removal (dropping the equal-size branch fails 2; dropping "The rest go too"
fails 1). 1740 pass; build, tsc, eslint clean. Rendered at 1000px: 3 rows, zero overflow.

### Self-critique

1. **Three is a guess.** Defensible, untested against a real owner.
2. **No way to see more than three** short of opening leads one at a time.
3. **Nothing paginates still.** Unchanged, and now the oldest outstanding gap.

---

## 2026-09-23 — The badge stops promising a follow-up Meta will refuse

Found on the founder's own Instagram lead, in production. 64.5 hours since the lead last
wrote, and the lead page said:

> **Writing a reply for you to approve** — Next automation check drafts this. They wrote and
> haven't heard back. It waits in your approvals until you send it.

Every clause false. Past 24 hours Meta refuses an automated send outright; the manual one needs
an app permission this app does not have yet. The draft was real and had nowhere to go. **He
found out by pressing Send and reading a Facebook developer-docs link.**

This is the third time today the same defect shape has surfaced: *a status asserting something
the machine cannot do.* "Following up soon" on a held account this morning, the queue's
self-contradicting count this afternoon, and now this.

### The new state, and where it ranks

`meta_window_closed` sits directly below `no_send_channel` and **above the workflow branch and
the owner's own "off"**. It is the per-lead form of the same claim — there is no way to reach
this person right now — and it is the only state here that also governs what the **owner** can
do by hand. Everything below it describes what FollowUp does automatically.

Ranked above "off" deliberately: an owner reading *"you turned this off"* learns something they
already knew and can undo whenever they like. An owner reading *"3 more days to reply at all"*
learns something that **expires**. Perishable information wins.

### Read off the newest inbound, which also decides relevance

A lead who wrote on Instagram and then emailed is reachable by email, and the newest inbound
being an email is exactly how that shows up. The reverse — newest inbound on Instagram, email
on file — really is blocked, because **R-003 forbids an email fallback for a shut DM window**.

### Copy

Leads with the clock, names the one route still open, and says nothing about app review, the
Human Agent tag, or how FollowUp talks to Meta. That is our problem, not the owner's.

### Tests

9 new, three boundaries pinned (inside the window, past it, past 7 days). Verified by removal:
never firing fails 5, dropping the channel check fails 1, `ceil` instead of `floor` fails 1.
1754 pass.

Rendering caught the copy — *"for 4 days more"* → *"for 4 more days"* — and `tsc` caught a real
error in my own test that vitest could not see: `"ASSISTED"` where the type is `"assisted"`.
esbuild strips types without checking them, so a test file can be wrong and still pass.

### Self-critique

1. **A workflow-enrolled DM lead still shows "next step in 2d".** The window check sits above
   the workflow branch so the state is right, but the *sequence* will keep scheduling steps
   that cannot send. The badge is honest now; the engine is not.
2. **Nothing warns before the window shuts.** At hour 23 the owner sees an ordinary badge and
   at hour 25 a red one. A nudge at hour 18 is the thing that would actually save the lead.
3. **The 7-day figure assumes Human Agent will be approved.** Today it is not, so the middle
   band is "only in person" — which is true either way, but for a different reason than the
   copy implies.

---

## 2026-09-23 — The four hours nobody was told about

Follows the entry above. Having made the badge honest once a Meta window has shut, the obvious
next question is whether anything warns while it can still be saved. Nothing did.

The arithmetic, none of it a guess:

- `automation.ts` drafts a DM follow-up at **hour 20** (`UNANSWERED_META_DM_MAX_HOURS`)
- Meta shuts the window at **hour 24**
- `holdAllForApproval` defaults to **true**

So on a fresh account the draft lands in the approval queue with **four hours to live**, and
nothing anywhere said so. Miss them and the draft is not late — it is **void**, and the lead
cannot be messaged again until they write first.

`meta_window_closing` fires across exactly that band. Gold, not coral (**A-005** reserves gold
for "going cold", which is precisely this: the one state on the badge that is about to become a
loss and can still be prevented). Coral is for things that have already stopped; using it here
would make the preventable case look identical to the four unpreventable ones beside it.

### Ranked BELOW "off", unlike its sibling

`meta_window_closed` states a fact about reachability that holds however the lead is
configured. This one is a **nudge**. An owner who parked a lead has said they don't want
nudges about it, and gold on a lead they deliberately switched off is how a colour gets
trained into noise.

### It carries `heldForApproval`

Because it changes who must act. On a holding account the draft waits for the owner and dies at
24h. On an account that sends for itself the engine handles it at hour 20 — and the badge must
not order someone to go and do something already in hand.

### Five older assertions superseded, not deleted

Four tests asserted `due_soon` at hour 21, guarding against a badge that said "in 3h" while the
engine was about to send into a shutting window. That intent is intact and sharper: `due_soon`
conveyed urgency and stopped there — it never said the draft would become **unsendable**, which
is the fact that decides whether an owner deals with it now or tomorrow. Marked SUPERSEDED with
the reasoning, per the brain's own rule.

### The removal check that caught my own weak test

Deleting the `direction !== "inbound"` guard left all 15 tests passing. The mutation had
applied — the test was simply weak: its owner-replied case put the reply an hour ago, so the
*time* check rejected it and the direction check was never exercised. Rewritten with the reply
at hour 21, inside the band, where dropping the guard measures the clock from the outbound and
warns about a conversation already answered. It fails now.

**A test that passes for the wrong reason is worse than no test** — second time today.

### Self-critique

1. **The 20-hour figure is inherited, not chosen.** If someone retunes the engine's ceiling the
   warning silently moves with it. Correct, but nothing says so at the call site.
2. **No warning anywhere but the badge.** The owner has to open the lead. A push or a queue
   marker is where this actually belongs.
3. **A workflow-enrolled DM lead still gets no warning** — the workflow branch returns above it,
   same gap as the entry before.

---

## 2026-09-23 — What logging in as a stranger found

The founder created a reviewer account for Meta's App Review and signed in as an outsider for
the first time. Twenty minutes later it had surfaced **three live defects**, none of which were
visible from his own account, and one of which was breaking the product for every user.

### 1. The Settings tabs could not be clicked. For anyone.

Channels, Team, Billing and Advanced were unreachable. Settings was frozen on whichever tab the
server rendered.

The cause was a **hydration mismatch**: `activeTab` was initialised by reading
`window.location` *while rendering*. Server produced one tab, the client's first render produced
another, React stopped patching — and the buttons kept their **native focus behaviour** while
their `onClick` handlers were never bound.

**That combination is the trap.** The page looked completely alive. Buttons highlighted on
click, took focus, responded to hover. Nothing threw. The only visible symptom was that nothing
*happened*, which reads as "the app is slow" or "I clicked wrong" rather than "this is broken".

The lazy initializer looked like the careful choice — read the hash once, not every render —
and that is exactly why it was wrong. **During hydration, "once" still happens on both sides,
and only one of them has a `window`.**

> **Rule: never read `window`, `document`, `localStorage` or `navigator` while rendering.**
> Read them in an effect, after mount. A swept audit of the rest of the app found only one other
> instance, inside a click handler, which is safe.

### 2. A failed OAuth connect was invisible

Instagram's failure renders inside `InstagramConfig` on the **Channels** tab. The OAuth callback
arrives with a query string and **no hash**, so the tab defaulted to Connect. The message was on
screen and unreachable — and with the tabs frozen, doubly so.

Two separate correct-looking decisions composing into silence. A callback now lands on the tab
it belongs to.

### 3. The Instagram Connect button is broken

Meta rejects the long-lived token exchange (HTTP 400, code 100). **Not fixed** — Meta's docs and
API are both unreachable from the build sandbox, and patching an OAuth flow from memory is how
you take the channel down for everyone. Left honest rather than guessed at.

### The lesson worth keeping

**Your own account is the worst place to test a product.** It has data, it has history, it has
every setting already right, and its owner knows which buttons to avoid. Every one of these
three had been live for some time and none had been noticed.

A fresh account on a clean browser is not a nice-to-have before shipping to strangers. It is the
only configuration that matches what a stranger sees.

---

## 2026-09-23 — The oldest gap: 600 cards stop rendering as 600 cards

Named three times across three reviews and never moved — *"600 drafts means 600 cards in one
page"*, then *"600 cards render as 600 cards"*, then *"unchanged, and now the oldest
outstanding gap."* Closed today.

It was never hypothetical. `pendingApprovals.ts` scans up to 500 leads, and on a holding
account `Lead.suggestedRiskLevel` is null for every draft written before the classifier ran.
`isSafeToSendInBulk` calls null unsafe — correctly, that is the whole point of A-023's narrow
bar — so the entire backlog lands in `needsYou`, and every one of them renders a full card
carrying the lead's message and the drafted reply. Server-rendered, then hydrated. The first
tester with a real inbox meets a page that takes seconds to paint.

### Why it is not pagination

Page numbers were the obvious answer and they are wrong here. Nobody visits page 4 of their
approvals. The queue is already ordered — highest score first, inside groups ordered by
urgency — so an owner works from the top, and **the cards they act on leave**. Numbered pages
impose a document's model on a pile that shrinks while you look at it: resolve the third card
on page 2 and every boundary after it shifts.

Instead each source has a visible head and a folded tail:

> **40 more need your OK — next is Tom Vance**  ·  [ Show 3 more ]

Three decisions inside that, each with a reason:

1. **A count, not a set of revealed ids.** This is what makes the pile behave like a queue.
   40 waiting, 3 on screen; approve one and `slice(0, 3)` lands one further down a shorter
   list, so the fourth card rises into its place by itself. A set of revealed ids would leave
   a hole.
2. **Per source, not one budget for the screen.** Every channel keeps a head, so one loud
   source cannot bury the others.
3. **A tail of two or fewer is shown, not folded.** A row saying "2 more" costs about the
   height of the two cards it hides and spends a decision to save nothing. The fold has to
   earn its place.

Explicitly **not** a "show all" button — the pattern `ConversationThread.tsx` uses for thirty
messages. Pressing "show all" on 500 is the original bug with a click in front of it.

The section heading still reports the true total (`43 need you · 312 routine`), so nothing
here hides how much is waiting. It only declines to draw it.

### The number came from a phone, not from taste

Built at five first, and five measured badly. Rendered at 390px — the device
`research/customers/2026-09-05-icp-pain-and-trust-objections.md` records the owner actually
holding, up a ladder, with about ninety seconds:

| | page size 5 | page size 3 |
|---|---|---|
| one card | 509px | 509px |
| whole page | 8.7 screens | 5.9 screens |
| fold row reached at | 3.5 screens down | 2.3 screens down |

The arithmetic was right at five and the screen was unusable. **A cap tuned on a desktop is
not a cap.** Three is also already this screen's number for "enough to judge by"
(`SPOT_CHECK_SAMPLE`), kept as a separate constant so tuning one cannot silently move the
other.

### Tests

12 new, `src/lib/__tests__/queuePaging.test.ts`. Verified by removal: dropping the tolerance
branch fails 4, making the button always promise a full page fails 2. One test walks every
pile size 0–60 and asserts the fold can always be pressed to the end — the real failure mode
of a hand-rolled expander is a size where pressing reveals nothing and the last cards are
unreachable, and that size is one nobody would think to spot-check.

**Mutation testing deleted a line of shipped code.** `visibleCount` opened with an explicit
`if (shown >= total) return total;` clamp. Removing it changed no output on any input, because
`shown >= total` implies `total - shown <= 0 <= QUEUE_TAIL_TOLERANCE` and the branch below had
already returned `total`. A guard no test can distinguish from its absence is not a safety
net; it is a second rule free to drift out of step with the first. One rule, one line.

The boundary tests are written from the constants rather than as literals, so they state the
rule and survive a retune — plus one test asserting the constants' actual values, because
otherwise all of them would keep passing if the page size silently became 40.

1772 tests pass; `next build`, `tsc --noEmit` and eslint clean. Driven over CDP: pressed the
folds three times, counts correct at every step, **zero console errors** (so no hydration
mismatch — the defect that ate the Settings tabs this morning).

### Self-critique

1. **The payload is untouched, and it is the other half of the bug.** All ~500 approvals still
   cross the wire on every dashboard load, each carrying up to 400 characters of the lead's
   message plus the full draft — roughly half a megabyte of RSC stream before a phone paints
   anything. The fold fixes what the browser *draws*, not what it *downloads*. Fixing that
   means grouping on the server and trimming the text from cards that cannot be rendered yet,
   which changes the component's prop shape and touches the safe-pile spot-check that shipped
   hours ago. Named rather than half-done.
2. **Three is measured, not validated.** It came from a real card height on a real viewport,
   which beats the guess that `SPOT_CHECK_SAMPLE`'s three was. It is still not a number any
   owner has reacted to.
3. **Six sources still means eighteen cards.** The cap is per source by design, so the budget
   grows with the channel count. Fine at today's five channels; worth revisiting if a source
   list ever gets long.
4. **The fold row cannot be reached by an owner who only scrolls a little.** On a phone it is
   2.3 screens down. That is the cost of showing three whole cards rather than three
   summaries, and showing whole cards is the point — the owner is there to judge the draft.

---

## 2026-09-23 — Undo on the single send, and the payload fix that wasn't needed

### The one that wasn't real

Tonight's queue-folding entry named the RSC payload as "the other half of the bug" and the
next thing to do. Before building it, the production database was asked how big the problem
actually is. Every account, every held draft:

| Business | held | unjudged (→ needs you) | judged low | avg draft |
|---|---|---|---|---|
| Manoj Thakur's Business | 10 | 10 | 0 | 247 chars |
| FollowUp | 9 | 6 | 2 | 143 chars |
| Vansh Goura's Business | 1 | 1 | 0 | 170 chars |

**Twenty held drafts in the entire database, and the largest single queue is ten.** The
payload today is about fourteen kilobytes. Server-side grouping plus text trimming would have
been real complexity — a changed prop shape, the safe-pile spot-check disturbed — bought for a
load that does not exist and may never. `SCAN_LIMIT` caps it at 500 whatever happens, and the
severe half (500 cards of DOM, server-rendered then hydrated) already shipped.

Not built. The note stays in the brain as the thing to do **if** an account's queue gets large,
not as outstanding work. **Checking the number cost one query and saved an evening.**

### The one that was

The same table says something more useful: 17 of the 20 held drafts are unjudged, so
`isSafeToSendInBulk` correctly refuses them and they land in the needs-you pile. Which means
the way an owner actually sends today is the single **Approve & send** on a card, one at a
time — and that button had no undo. The ten-second grace period built this morning was on the
batch, the path nobody is using yet.

The button that writes to a real customer in the owner's name, on the path people actually
take, had nothing between the tap and the send. It does now: the row is replaced by
**"Sending to Priya in 10s"** and an Undo, same window and same rules as the pile.

### Why a hook and not a copy

The obvious move was to paste the sixty lines across from `SafePileAction`. They are sixty
lines of gate, clock, `pagehide` and unmount handling in which every branch is load-bearing,
and a difference between two copies would surface as messages sent or not sent — never as a
failing test. So the timing and lifecycle moved into `useUndoableSend` and both callers use
it; each brings only its own request and its own idea of "done".

One shape was rejected during the build: letting the caller pass its own `send` function while
the hook kept `url`/`body` for the beacon. That is two descriptions of the same request, free
to drift into a `pagehide` beacon that sends something the button never would. The hook owns
the request; the caller reads the response.

The leaving-the-page-sends rule and its full reasoning moved across intact.

### Verified in a browser, because none of this is unit-testable

The lifecycle *is* the feature — timers, `pagehide`, unmount. Driven over CDP with `fetch` and
`sendBeacon` patched to record rather than send:

- press → `Sending to Priya in 10s`, **nothing requested**
- Undo → `Stopped — nothing was sent.`, **nothing requested**
- let it run out → **exactly one** request, `/api/leads/…/send`, correct body including subject
- the bulk path, refactored underneath, still does all three

Zero console errors. 1772 tests pass; build, tsc, eslint clean.

**The fixture lied once and nearly got away with it.** The first run showed one send removing
two cards and decrementing the routine counts. That looked like a real defect in the fold. It
was my preview data: `make()` built ids as `${source}-${i}` and was called twice with
"Gmail", so `Gmail-0` existed in both piles and resolving it removed both. Product was
correct; the fixture was not. Re-run with unique ids, and the same press showed the thing the
design is actually for — routine counts untouched, three cards still on screen, the fold
going 7 → 6 with "next is" advancing from Tom Bell to Dan Osei. **The fourth card rose into
the empty place by itself**, in a real browser, which no unit test had shown.

Third time this session a check passed or failed for a reason other than the one being
tested. The pattern is consistent enough to name: *when a result is surprising, suspect the
harness before the product.*

### Self-critique

1. **The hook has no unit tests.** Its pure parts (`createSendGate`, `secondsLeft`) are
   covered in `undoWindow.test.ts`; the wiring is covered only by tonight's browser run, which
   is not repeatable in CI. A jsdom harness with fake timers would fix that and was not built.
2. **Ten seconds is inherited, not re-examined.** It was chosen for a batch of forty. For a
   single draft an owner is reading, it may be longer than anyone wants to wait.
3. **The refactor touched shipped send code** to serve a new path. Justified — two copies of
   this logic is worse — but the bulk path's only proof is the same browser run.
4. **A card that resolves mid-countdown is untested.** The unmount flush should send it via
   `keepalive`, and that branch was not exercised, only read.

---

## 2026-09-23 — The rule said Autonomous, the leads went Assisted, and nothing said so

Three paths can put a lead on Auto. Two refuse without the account's permission. One did not.

| Path | Permission check, before today |
|---|---|
| `POST /api/leads/[id]/automation` | 403, with `AUTONOMOUS_NOT_ALLOWED_MESSAGE` |
| `POST /api/leads/bulk-automation` | 403, same sentence |
| **`POST /api/source-rules`** | **none** |

So an owner picked "Autonomous" from a dropdown that offered it, the save succeeded with no
complaint, the Settings row read "Autonomous" indefinitely — and `applySourceRouting` started
every lead that rule touched on **Assisted** instead. The downgrade itself is right: a
permission can be revoked after a rule was legitimately saved, and new leads must not land on
a mode the owner has taken back. What was wrong is that **no third thing in the product knew
both facts.** Not the rule row, not the lead, not the audit trail.

Worse than either refusing or obeying. A product that refuses teaches you something; one that
obeys does what you asked. This one accepted and then quietly disagreed with itself, and the
only way to find out was to notice that leads from a channel you had set to Auto kept arriving
in the approval queue — which is the exact "why hasn't this sent?" question FollowUp exists to
make unnecessary.

`requireAdmin` on that route was never this check and the route's own comment shows the
confusion: it already described the AUTONOMOUS risk and answered it with a role gate. **Who is
asking and whether the account has consented are different questions.** An admin without the
permission is precisely the person who hit this.

### Four moves

1. **The API refuses**, with the same sentence as its two siblings, and writes nothing. A
   saved-but-downgraded rule is the defect.
2. **The dropdown stops offering it** — `SourceRoutingSection` took no props at all and had no
   way to know. `GET` now returns `autonomousAllowed`. The option is **disabled, not removed**:
   an option that vanishes teaches nothing, while one visible and unavailable, with the reason
   under it, says what to do. It stays selectable on a rule already set to it, so the dropdown
   can still show its own value rather than rendering blank.
3. **A stranded rule says so on its own row.** What it is doing now, then why, then where to
   change it — *"Sending without review is switched off for this account, so new Instagram
   leads start on Assisted — they wait for your OK."* Not "invalid rule": the rule is fine, the
   permission is off, and those have different fixes.
4. **The downgrade is audited.** `automation.downgraded`, carrying source, requested, applied
   and reason — the per-lead trail that answers "when did this start" months later, where the
   Settings row answers the standing state.

### The check that mattered most took one query

Production, before writing anything: **eighteen source rules across every account, all
ASSISTED, `autonomousAllowed` false everywhere.** Nobody is stranded today. So this is
preventive, and — the useful half — **no data migration was needed.** Second time tonight that
asking the database first changed what got built.

### Rendering found a defect that was not mine

At 390px the row's `<select>` ran off the right edge of the card. The row pinned it with
`shrink-0` while a `<select>` sizes itself to its longest option ("Leave unclaimed — first to
grab it gets it"), so it simply overflowed — and the chevron was off-screen entirely. It
predates this work. Fixed here because it is the row being changed: the source name holds its
width, the dropdown gives way. Now 33px clear inside the card, chevrons visible for the first
time.

### Tests

15 new across two files. Verified by removal: deleting the permission gate fails 2, gating
every tier instead of just Auto fails 2, dropping `autonomousAllowed` from GET fails 1; on the
routing side, never recording fails 3, recording on every rule fails 3, not downgrading fails
2, auditing before the lead update fails 3. 1787 pass; build, tsc, eslint clean. Rendered at
phone width with a stranded rule: the line appears on that row only, the option is disabled on
the others, no console errors.

**One existing test had its premise changed rather than patched.** `adminGate.test.ts`
asserted an admin *can* save an Autonomous rule — true when the route never asked, false now
without the permission. Updated to grant the permission explicitly, so it remains a test of
the ROLE gate and the two stay independent, instead of being quietly made green.

### Self-critique

1. **The audit event is written but nothing reads it.** The lead page's AI trail may surface
   `automation.downgraded` generically; it was not checked, and no view names this event. The
   trail is for a question nobody can ask through the UI yet.
2. **The stranded-rule line is untested by anyone but me.** It is inferred copy — no owner has
   hit this state, because nobody in production has.
3. **`autonomousAllowed` defaults to `true` on the client** while loading. Optimistic on
   purpose (claiming a restriction that is not there is worse than briefly missing one, and the
   server refuses either way), but it does mean a failed GET leaves Auto offerable in a UI that
   cannot save it.
4. **The fourth path is closed; a fifth is not ruled out.** Three routes were audited because
   three were known. Nothing systematically proves no other writer sets `automationTier`
   directly.

---

## 2026-09-24 — The connected Instagram card names the account, not its number

**Not an approval.** No one has reviewed this; it is recorded so the next session knows why
the card changed and does not re-derive it.

### What changed

`Connected — Instagram account ID 17841427527466039.` became
`Connected as @followupbase.` when Meta supplies a handle. The numeric id stays as the
fallback for any account connected before the handle was stored.

### Why

Found by a browser agent reading the live Settings page, not by an owner complaint: *"Your app
doesn't show a connected Instagram username, only the numeric account ID … So I can't confirm
that the connected account is sahildoes."*

That is the point. An owner cannot check a 17-digit number against the account they meant to
connect, and on 2026-09-24 the wrong-account mix-up happened twice in one afternoon — once a
connected card was read as the reviewer's when it was the founder's own. A handle is
something a person recognises; an id is something only a database does.

It also blocked a recording: the Meta App Review pack (`followup/research/integrations/
2026-09-23-meta-app-review-submission.md` §4, Video A, shot 6) specifies *"the connected
account's username now shown on screen."* The card could not show one.

The handle was never missing — `resolveInstagramUserId` fetched it on every connect and
returned it in one response. It was simply never saved, so it vanished on the next load.

### Rules this follows

- Standing rule: every automated action must let the user answer *"What happened?"* A
  connection you cannot identify fails that on the first question.
- Checked `rejected.md` and `approved.md` first. Nothing covers connected-account display.

### Rendered, and one flaw fixed because of it

Rendered at 390px, both states. **The tick was vertically centred** (`items-center`) on the
sentence, so on the three-line id fallback it floated beside the number rather than beside
"Connected". Pre-existing, but on the line being changed — now `items-start`, with the tick
nudged onto the first line. The sentence is also one span, so the handle cannot be split from
its full stop by the flex row's gap.

### Self-critique

1. **The id fallback is still ugly**, and every account connected before today shows it —
   including the founder's own live connection. Reconnecting populates the handle; nothing
   backfills it. A backfill is one Graph call per connected business and was not done.
2. **A renamed handle goes stale.** It is captured at connect time only. Someone who renames
   their Instagram will see the old name until they reconnect. Acceptable for a display
   string; routing keys on the id, which never changes.
3. **Only Instagram.** The Facebook Messenger card has the same shape and was not checked.

## 2026-09-25 — Email replies thread ^email-replies-thread

**What changed.** `sendFollowUpToLead` (src/lib/sending.ts) now replies into the
customer's newest email thread whenever no thread was passed in. Before, only the instant
acknowledgement threaded; every approved or automated email started a new conversation
under an AI-written subject (daily-path audit 2026-09-25 F3).

**Decided by the founder**, 2026-09-25 ([[approved#^A-020]]). The trade he accepted: Gmail
only keeps a message in a thread when the Subject matches, so for a reply to an existing
email the subject is always `Re: <their subject>`, whatever the Subject box says.

**Fails open.** If Gmail won't return the original's headers, the email still goes out,
fresh, exactly as before. Never a failed send over threading.

**Left for the UI (not done — screens are the founder's):** the composer and the Today
card still show and require a Subject for email leads, including ones that will now reply
in-thread. The honest version shows "Replying to: <their subject>" in place of the box when
a thread exists.

**Weak spots, named.** The newest customer email picks the thread; a lead writing in two
separate threads is answered in the most recent one. Outlook replies via Graph `/reply`,
which quotes the original and cannot carry List-Unsubscribe headers — same as the instant
ack's Outlook path already did.

## 2026-09-25 — A reply to a conversation that has moved on is refused ^stale-send-refused

**What changed.** Approve & send (Today) and Send now (lead page) now tell the server when
the newest message they were showing arrived. If the lead has written since, the send is
refused with: *"Jane wrote again since you opened this. Nothing was sent — read their new
message first."* (daily-path audit 2026-09-25 F7). Founder: "yes, you do it", 2026-09-25.

**No visual change.** One data field in each send, and the sentence lands in the error line
each surface already has. No layout, token or component was touched.

**Why checked against the screen, not the draft.** The server re-drafts as soon as a new
message arrives, so it cannot tell a stale card from an owner who read the new message and
typed a reply. What the owner *saw* is the only honest test: someone who has seen the new
message passes.

**Weak spots, named.** The card does not refresh itself after the refusal; the owner has to
reload to see the new message. The lead page's Send now still has no 10-second undo (the
other half of F7) — that is a component change and was left for the founder's UI pass.

## 2026-09-25 — Alerts outside the app ^alerts-outside-the-app

**What changed.** An owner is now told by email and by a phone/computer notification
(Web Push) when a customer has written and FollowUp's reply is waiting for their OK. Before
this the bell inside FollowUp was the only alert, so it only reached owners who were already
in the app. Founder's brief and approval, 2026-09-25: "yes build both". The goal is to be
told within minutes and approve within five.

**The UI, which is small on purpose (the screens are the founder's).** There is one new
**Alerts** section in Settings → Advanced, directly under Automation, because Automation is
where "replies wait for you" is decided. It uses one existing `box`, the existing `Switch`,
one secondary button in the page's existing bordered style, and the page's existing text
styles. There are no new tokens, colours, fonts or icons. Rows:
- "Email me when a customer is waiting". This is a per-person switch, on by default.
- "Turn on FollowUp notifications on this device", with the line "On iPhone, add FollowUp
  to your Home Screen first." underneath. The line is hidden when FollowUp is already
  opened from the Home Screen. Once the device is on, the row reads "FollowUp notifications
  are on for this device." with a "Turn off" button.
- A row is hidden when its channel has no keys on the server, and the whole section is
  hidden when neither channel has keys. This follows Outlook's precedent: a switch that
  reads "on" while nothing can be sent would be a promise we aren't keeping.
- `/settings#alerts` opens the Advanced tab. Every alert email's footer links there.

**What the owner reads outside the app.** All of it is plain. There are no exclamation
marks and no AI wording. It never includes the draft or the reason it was held, because
an alert that contains the reply invites sending it without reading it. Customer text is
cut to 140 characters (100 on a lock screen).
- Email subject "Jane is waiting for your reply" ("A customer" when all we have is a
  placeholder name). The body says who wrote and on which channel, quotes their message,
  says "FollowUp's reply is ready — open it to send.", links to the lead, and has an
  opt-out footer.
- Push title "Jane is waiting". The body is their line; tapping opens the lead.
- A burst of more than 3 in one minute becomes "12 customers are waiting for your OK" /
  "12 customers are waiting". This is the same threshold as the bell (`holdNotices.ts`).
- After 20 emails in the owner's own day, one "More customers are waiting for your reply"
  email goes out, then no more email until tomorrow. Push continues.

**Rendered** with the real Settings page in a temporary harness route (it was deleted and
isn't committed) and Playwright Chromium, with the APIs mocked, at 1440 (light and dark)
and 390 (off, on, blocked, iPhone Safari tab). Screenshots are in
`followup/research/audit/2026-09-25-alerts-outside-the-app-*.png`. The render caught one
flaw, now fixed: at 390px the long button label wrapped to two centred lines and read as
stray text beside the left-aligned hint. It's now left-aligned. The harness has no Sidebar,
so the sticky tab row overlaps the top of the 390px shots. That comes from the harness,
not from this change.

### Design review (design-review.md), honestly

- ✅ Clarity: two controls, each named by its outcome. No jargon ("push", "subscribe",
  "VAPID" never reach the screen).
- ✅ Consistency: existing Switch, box, button border style and error style. There's one
  primary action per row and no new tokens.
- ✅ Trust: nothing reads "on" unless it can send. Turning off is one press. The email
  says why the owner got it and how to stop it.
- ⚠️ Touch target: the button is about 38px tall, the same as every other bordered button
  on this page, which is below the 44px in `components/buttons.md`. I followed the page
  rather than fixing one button.
- ⚠️ Loading: the section appears after `/api/alerts` answers, so the Feedback section
  below it shifts down once. It's in the Advanced tab and below the fold, so this is minor.
- ⚠️ The iPhone Safari-tab state shows a disabled button with the hint underneath. The
  hint explains it, but a disabled button is still a weak affordance.
- ⚠️ No "sent to <address>" line under the email switch. I dropped it to keep the block
  minimal. An owner with several addresses can't see where alerts go.

### Weak spots, named

1. **Some waiting customers aren't "held" yet, so they don't alert yet.** An alert fires
   only when a reply is actually waiting in Approvals. On a holding account, a customer's
   first message is held within minutes (instant-reply path). A customer writing *again*
   in a conversation the owner already answered gets no held reply until the unanswered
   rule steps in (24 hours by default), so the alert comes then. Changing that is
   automation.ts territory, and another agent is working on the cadence there.
2. **The setting lives under Advanced.** Owners won't go looking there. The founder may
   want a one-time prompt on Today ("Get told when a customer is waiting") pointing here.
   That's a screen change and was left for him.
3. **Email HTML is hand-written with literal colours.** Email clients can't read CSS
   tokens. It's deliberately bare: text, one quote bar, one link.
4. **Delivery timing rests on a one-minute cron.** Expect 1–2 minutes after the reply is
   ready. Vercel doesn't promise exact cron timing.

## 2026-09-25 — The follow-up strategy ^followup-strategy

**Approved by the founder**, 2026-09-25, with one clarification the same day (auto-send
accounts must actually *send* a low-risk reply within five minutes, not just draft it).
Backend only; no screen was touched. Grounded in
`followup/research/product/2026-09-09-followup-cadence-best-practices.md` (§2, changes #1–#5)
and `followup/research/product/2026-09-15-reaching-back-out-to-ignored-leads.md` (§1.2, §5, §7.1).

### What now happens

1. **A new message is ready within five minutes, any hour, every channel.** A new worker
   (`/api/cron/fresh-replies`, every minute) picks up any customer message under an hour old
   that nobody has answered. On a holding account (the default) the drafted reply is put on
   Today and the owner is told ("Maya wrote 3 minutes ago and hasn't heard back — a reply is
   drafted and waiting for your approval."). On an account that sends without asking, a
   low-risk reply goes out; anything the risk check flags still waits. The two-minute DM
   head start is kept (it batches quick DMs and lets a present owner answer first); email
   and SMS wait one minute so the capture request finishes first. Gmail and Outlook syncs
   moved from every 10 minutes to every 2 so an email is *seen* in time.
2. **Drafting and holding are no longer blocked by the send window.** Only sending is. A
   holding account gets reminders, replies and workflow steps on Today at 3am too.
3. **A quiet lead gets four different reminders, then nothing.** Day 3, 7, 14 and 30 after
   the message they went quiet on (or the owner's own Settings silence value as reminder 1,
   if they changed it from 5). Angles: (1) light nudge restating what they asked; (2)
   something new and useful; (3) one easy closing question; (4) a short last message that
   leaves the door open, no question that needs an answer. No apology in any of them. The
   step is *counted from the thread*, so a reminder approved from Today advances it exactly
   like an automatic one. A lead in the owner's own workflow gets none of these.
4. **One welcome back at the dead-lead threshold (45 days), never a second.** It apologises
   only when the customer's own message was the last thing in the thread (we ignored them);
   a lead who went quiet on *us* gets no apology — the research's §7.1 finding was that the
   old hint apologised to exactly the wrong group. Someone who wrote 45+ days ago and was
   never answered now gets the belated-answer steer (they got none before).
5. **Reminders and welcome backs** go out 8:00–20:00 business-local (was 8–18), stop the
   moment the customer writes (including in the seconds while one is being drafted), use the
   channel they last used, and at most one such automatic message goes to a lead per local
   calendar day.

### Weak spots, named

- **Settings now says things that are not true** (the screen is the founder's; not changed):
  "Wait 5 days before nudging a quiet lead" / "nudges a quiet lead after 5 days" — at the
  default the first reminder is day 3; "this never fires again until they've gone quiet for
  the full window once more" — it is four reminders then stop; "Reply for me… if a lead's
  message goes unanswered for this many hours" and "drafts a reply if you haven't answered
  within 24 hours" — it is now within minutes. These need rewording before testers read them.
- **On an auto-send account the owner's "Step in after N hours" no longer holds back a reply
  to a fresh message** (founder's instruction). An owner who set 6 hours to answer first now
  gets ~1–3 minutes. The hours value still governs the hourly safety net.
- **On an auto-send account a brand-new lead's five-minute reply is the instant
  acknowledgement.** The fuller drafted answer still follows the 3-hour first-reply rule —
  sending both within a minute is the "two replies" moment the DM grace period exists to stop.
- **Reminders barely reach Instagram/Messenger** (Meta's 24-hour door shuts before day 3) and
  on WhatsApp past 24 hours the approved template goes instead of the reminder's words.
- The one-per-day rule exempts replies and owner-built workflow steps (their hour-level
  delays exist to land inside Meta's window). It is a per-lead promise for FollowUp's own
  unprompted messages, not a global one.
- A two-minute sync can overlap itself on a long daily deep pass and classify the same new
  thread twice. The hourly silence scan now loads every quiet lead each hour.
- One-time cost after deploy: held reminders and cold-unanswered drafts are rebuilt once,
  because existing drafts carry no kind (`Lead.suggestedDraftKind`).
- The badge reads "due" from the moment a customer writes; for messages that arrived before
  the deploy it can read due up to a few hours before the hourly rule acts.

## 2026-09-25 — Settings says what the follow-up strategy does ^settings-strategy-copy

**Founder:** "yes fix them" — to fixing only the Settings sentences the strategy made untrue.

- Summary: "drafts up to four reminders to a quiet lead, on days 3, 7, 14 and 30" (was "a nudge after 5 days"); "drafts a reply within minutes of a new message" (was "if you haven't answered within 24 hours").
- Field: "First reminder after [3] days", with the calendar and "each one different, then FollowUp stops" under it; the reply field reads "If a reply was missed, check again after [N] hours" — it is only the backstop now.
- The number means what it says: the seeded default moved 5 → 3 (migration `20260925130000_quiet_reminder_default` moves rows still on 5). The special case that read 5 as "day 3" was dropped — it made the field show 5 while the first reminder went on day 3.

**Weak spot:** an owner who deliberately chose 5 before today is moved to 3 with everyone else; there was no way to tell them apart.

## 2026-09-26 — Hero sketching moved to Figma

The founder chose to sketch the new hero in Figma rather than on paper. A board was set up in
his team's drafts: **FollowUp — Hero sketch**, https://www.figma.com/design/DQXZgweQPGuLh9CPUBfAFS.
It holds a "Read me first" brief (the story, the rules every direction keeps, the three questions
from the 2026-09-25 hero research), rough first-screen frames for D1–D5 on the charcoal ground with
the approved headline (A-013) and buyer line (A-014), and blank desktop (1440) and phone (390)
frames with the maximum picture area dashed in. Green (`--sage`) stands in for the one
"answered" colour and is explicitly a placeholder (R-004: build with a placeholder, change one
value when he reacts). Nothing on the board is approved; R-014 stands until he picks.

## 2026-09-26 — How the website redesign is made: the founder directs, Claude builds in Figma

The founder's words: "I will be designing the website with the help of you, and you will be
guiding me on Figma… I will be giving you the directions, and you'll be building it one by one."
So: one section at a time, in the order he names, from his direction — not a full proposal to
react to. The same Figma file now has a **Website** page (empty desktop 1440 and phone 390 home
frames) above the **Hero ideas (reference)** page, a "FollowUp colours" variable collection
(paper, card, line, ink, ink-soft, and `answered` as the one placeholder strong colour) and seven
text styles (Display, serif emphasis, section heading, body, mono label, button). Everything
still goes through the brain: check rejected.md before building what he describes, and say so if
a direction runs into a rejection rather than silently building it.

## 2026-09-26 — Team invites join through their link ^invite-link-copy

**Why (security, not taste):** audit 2026-09-16 H-2. An invite used to join its address to the inviting team the first time that address signed in, silently — a stranger's admin could pre-claim anyone. Joining now needs the invite's own link (`followup/src/lib/inviteToken.ts`).

- Team settings, pending invites: each row gets a small text button **"Copy invite link"** (turns to "Copied" for two seconds), beside the existing cancel ×. Same fallback as the booking-link button when the clipboard is refused.
- Helper line under the invite form: "They join by opening their invite link and signing in with this email. If you have Gmail connected, we'll email the link to them; otherwise copy it from the list above and send it yourself." Replaces "They'll join automatically the next time they sign in", which is no longer true.
- Sign-in page: after an invite link is opened, a quiet note names the team — "Signing in will add you to **{Business}**'s team. Continue with the Google account for the email address the invite was sent to." The name is read server-side from the invite the browser's cookie names, never from the URL, so a crafted link cannot show a fake team; `error=InviteLink` tells an invited person to open their link; `error=InviteInvalid` says the link is no longer valid. Coral for the two errors, ink-soft for the note — the existing error/notice styling on that card.

**Weak spots:** not looked at in a browser inside Settings (needs a signed-in session and a database; the sign-in page states were checked as server-rendered HTML only). The Settings tier picker still promises "14-day free trial" to a business that already had one — since the same audit a returning business pays at checkout, so that line needs its own copy pass (frontend). Not a founder-approved design; logged here so the next session knows why the copy changed.

## 2026-09-26 — Founder: "white background, everything black, close to ElevenLabs" ^light-elevenlabs

**His words:** "Change your theme to white and black rather than black and white. The background
should be white, and everything should be black, the typography and all. Close to ElevenLabs."
Said after pasting the elevenlabs.io homepage ("look how cool this is") and asking to copy "the
typography and everything … as simple as possible and impactful … the best hooks."

**What it reverses, pending his reaction to the build:** R-006 (an all-light marketing page) and
R-010's rule that the page follows the device theme. Not marked superseded yet: both stand
until he approves the light build, and then get `SUPERSEDED (2026-09-26)` pointing here.

**What was built (Figma, "Hero v3 · light", desktop 1440 and phone 390, below Hero v2):**
- Warm off-white ground `#fdfcfc`, black type `#0a0a0a`, warm grey `#57534e` for secondary text.
- The headline set in Public Sans **Light**, 64 desktop / 42 phone, with tight tracking. This is
  the ElevenLabs principle (a thin display weight, set huge and tight) done with the typeface
  already in the system, not their licensed Waldenburg.
- The serif italic emphasis is dropped in this version, which deviates from the A-013 build
  (the wording is unchanged). This is flagged to him, not decided.
- The reply card is the one black object on the page, which makes the "answered" moment the
  highest contrast on screen. The green placeholder accent is not used.
- A "Light" mode was added to the "FollowUp colours" variables.

**Copied from ElevenLabs:** principles only. A tiny, huge, thin headline; very few words per
block; almost no colour; black pill buttons; warm-white calm. **Not copied:** their layout,
font files, logo wall or voice-picker demo.

## 2026-09-26 — The redesign moves from Figma to a Claude Design canvas

Founder: "copy here, we will design in claude design", after asking why we weren't using it.
The four built sections (A-022 hero, "Works with" strip, The gap, How it works, See it working)
were copied into a Claude Design canvas: **FollowUp Landing Page**,
https://claude.ai/artifact/R3b94hcjTh2f5AKaW6qbWx. It has two artboards, desktop 1440 and
phone 390, built as real HTML. The hero's motion runs there: the message drops in, the reply turns
over, on a slow 7-second loop, with none under reduced motion. The See it working tabs can be
clicked. The Figma file stays as the record of earlier versions; new work happens on the canvas.

## 2026-09-26 — The rest of the nine-section plan (A-023) added to the canvas

Founder: "add everything that is stated to get the best conversion rate". Added on both
artboards, following the conversion research (`research/landing-page/2026-09-26-conversion-strategies.md`):

- **Try it** box inside See it working. Paste a message, get an example reply. It is marked
  "EXAMPLE REPLY · WAITS FOR YOUR OK" and shows `[YOUR PRICE]` rather than inventing a price.
  It is a mock-up: a real version would cost AI money per visitor. That's the founder's call, still open.
- **Our promises**: four cards, IT STOPS / IT'S SAFE / IT'S HONEST / IT'S YOURS.
- **Pricing**: "Free while in beta." Free $0, Plus $39 (the one outlined plan), Pro $79,
  using the site's existing feature lists.
- **Questions**: an accordion of six real questions, answered in the site's existing words, plus the
  contact email. Correction made: the Instagram 24-hour answer now says it "writes the reply for
  you to send, or sends it itself if you have allowed that", which matches hold-by-default,
  not "sends automatically".
- **Start free**: the big final button, with the three promises repeated under it.
- **Tester quote slots**: two dashed boxes, one under the hero and one at the end. They stay
  **empty until a real tester agrees**. No invented testimonials.

**Weak spots, named:** the page is long on phone (~10,400px). The FAQ answers are dense for
the grade-5 reading target. The Try-it box sits inside a section that already has tabs, which
may be too much in one place.

## 2026-09-26 — Trims, a different phone, soft washes, pen marks, and three facts

Founder, in one run: "trim those, keep building", then the phone isn't meant to be the same as desktop
(now brand principle 4), then "can we add gradients too in the theme and make it more human made",
then "copy from apple too". All of it is on the canvas (version 6). **Not yet reacted to.**

- **Trims.** The FAQ answers are now one or two short sentences each, still true to the product.
  On desktop, Try it is the fourth tab of See it working instead of a separate box, and "Try it"
  is in the top bar (the research says demos in the top bar get clicked most).
- **Phone, rebuilt to the new rule.** Same words, far fewer pictures:
  - The hero example is compact.
  - The gap's list is cut. The gap's sentence still says it, and "One list" shows it.
  - How it works is a numbered list.
  - See it working is four tabs, one example at a time.
  - The promises are a divider list.
  - Pricing is a Free / Plus / Pro switcher showing one plan at a time (Plus first).
  - The FAQ starts closed.
  - The phone went from about 9,000px to about 6,000px.
- **Gradients, within the old rules.** They are soft apricot, rose-sand and dusty-blue washes on the warm surface, with
  a fine paper grain on top. They appear in exactly two places: behind the hero example and behind the final
  "Start free". The page ground stays one tone (R-010's lesson). They are low-saturation and grained so
  they don't read as the cheap gradients S-02 bans. Proposed values, not final tokens: `.fu-wash-hero`
  and `.fu-wash-end` in the artboards' styles.
- **"Human made", read as: marks a person's hand would make.** This is inferred; he hasn't said what he meant.
  A two-pass pen underline under "follow up" and under "free" in "Start free.", and a loose pen arrow
  from the customer's message to the reply (the arrow fades in with the reply). No handwriting font was
  added, because adding a font needs his OK. No photos of people (R-011).
- **From Apple, the principle only:** one true number, set big, with a short line under it. A slim band
  after "Works with" shows **$0** while in beta, **2 min** to connect, and **1 list** a day of who needs you and why.
  These are all product facts, with no counts or proof invented. It puts price and "the catch" inside the
  first two screens (research 2.4). No Apple layout, type or imagery was reproduced.

**Weak spots, named:**
- The washes could still feel decorative. If he says "too much", the grain and the dusty blue are the
  first things to drop.
- The pen arrow is fixed while the reply animates, so it fades with it.
- The phone frame height is estimated (6,100px), so there may be empty space at the bottom.

## 2026-09-26 — Attio as a reference for data screens; a first FollowUp "People" screen

Founder: "i want ui reference from Attio", then "how clean CRM data can look … spacing, tables, contacts,
inbox, line interface, restraint colors, and how they make complicated data feel light." Typography stays
ours ("we have the good one").

- **Reference filed:** `references/crm/2026-09-26-attio-data-ui.md`. attio.com, Mobbin (paid) and the
  analysis sites were blocked, so it's built from graded written sources, not screenshots. His own
  screenshots would make it stronger.
- **Applied on the canvas** as a new artboard, "App · people · desktop 1440". It's a proposal for the app, not
  the landing page. It shows the ruled table (Name, Channel, Last message, Waiting, State), sorted by who needs
  you first, with Priya's record open beside it. Her record has label → value attributes, including **"Why it's here"**
  (brand principle 3), a quiet conversation timeline, and the held reply as the one black card.
- **Proposed, not decided:** state colours live only in a 7px dot on a white pill. They are muted rust (needs you),
  ochre (going quiet), slate (waiting), sage (reply ready) and greys (checked in, done). These are new colour
  tokens, so they need the founder's OK.
- **Not taken from Attio,** because its user is a desk power user and ours is an owner on a phone:
  custom attributes, keyboard-first features, density for its own sake. On a phone, this table becomes a list.

**Weak spots:** the table is desktop-only so far; the sidebar's "Sources" counts are sample numbers; no
inbox view yet (the conversation lives inside the person's page).

## 2026-09-26 — The inbox: customer conversations only, every channel, one list

After A-024 ("both, build the inbox next"), three artboards were added: **App · inbox · desktop**,
**App · inbox · phone**, and **App · conversation · phone**.

- **What the inbox is, and isn't (PRODUCT_DIRECTION rule 4).** It holds only customer conversations, from
  every connected channel, grouped by who needs you: *Needs you → Reply ready → Everyone else*. It has no folders,
  labels, archive or "compose new email". A general email client is exactly the free-platform ground rule 4
  warns about.
- **Desktop:** three panes (sidebar, conversation list, open conversation). In the list, a row's state
  is only a 7px dot, because the group label already names it. The open conversation shows the customer's
  message, FollowUp's automatic welcome labelled as such, a thin event line ("FollowUp wrote a reply"), and
  the held reply as the one black card with Send / Edit / Don't send. The header shows a true channel limit:
  "Messenger lets you reply here for 23 more hours."
- **Phone (brand principle 4, the phone rule):** the list is its own screen with filter chips and a bottom
  tab bar (Today, Inbox, People, Settings). The conversation is its own screen, with the held reply at the
  bottom and 44px buttons.
- The same people and states as the People screen, so the two read as one product. The sidebar's Inbox
  count is now 8 on both.

**Weak spots:**
- "Reply ready" and "Needs you" both mean "waiting for your OK", which may be one distinction too many. Worth asking.
- The desktop conversation has no link to the person's attributes beyond "Open person".
- There's no empty state ("You're all caught up") yet.

## 2026-09-26 — The hero follows Intercom's sales order (the order only, not the look)

Founder: copy Intercom's *sales hierarchy*, not its visual identity. That hierarchy is: clear proposition → short
explanation → start free trial / view demo → "14-day free trial · no credit card" → social proof →
product demonstration. It is applied to the hero on both artboards (canvas version 10):

1. **Proposition:** A-013's headline, unchanged.
2. **Short explanation:** A-014's buyer line stays as the first sentence. One new sentence follows,
   built from the page's existing claims: "FollowUp reads your email, DMs and website messages, shows you
   who is going quiet, and writes the reply. You decide what gets sent."
3. **Start free + "See it work":** Start free stays the only black button. "View demo" became a quiet
   link with a play mark that jumps to the Try it demo on the page. It is **not** a second conversion, so
   A-023's one goal holds, and so does the research's warning against a second CTA (conversion-strategies §5).
   If the founder wants a full second button, that deviates from A-023 and needs his say.
4. **Risk reversal:** "Free while in beta · No credit card" on one line, then "Nothing sends without your OK
   · Delete everything, any time" on the next. These are A-022's three promises, now set as two short lines.
   No invented trial length.
5. **Social proof:** the tester slot moves directly under the buttons and is shaped like a real quote
   (quote, face, first name · trade · city). It stays **empty until a real tester says yes**. There are no
   logos or counts, because nothing real exists yet (research 2.6, A-010).
6. **Product demonstration:** the message → reply example. On desktop it stays on the right (A-022). On the
   phone it now comes after the proof, in Intercom's order.

**Weak spot:** the empty proof slot sits in the most valuable spot on the page. Until a tester quote exists,
it shows a gap to anyone looking at the design. Getting two or three quotes from testers is now the
highest-value thing the founder can do for the landing page.

## 2026-09-26 — Landing examples in the line style; the Today screen; Duolingo, calmly

"keep building", then, mid-build, "study Duolingo for its progress completion celebration habit loops and
look where we can implement in our product." Canvas version 11.

- **Landing product examples now follow A-024.**
  - The gap's "Today" list, the held-reply example and the "One list" example use hairline rows.
  - A small channel icon sits beside each name, and a white pill with a coloured dot shows each state. The heavy shadows are gone.
  - The hero's message → reply stays as approved (A-022).
- **Today, the app's home** (desktop, phone, and the phone's "all caught up" state), using the Duolingo study
  (`research/ux-patterns/2026-09-26-duolingo-progress-and-completion.md`):
  - A finite list, "4 customers are waiting on you", with a thin progress line: "1 of 5 handled today · When
    the list is empty, you're done for today."
  - Two groups: **Needs you** (Review) and **Ready to send** (Send, or "Send both" for the routine pile only).
  - **This week** leads with a real win, "Tom Reid came back and booked", beside outcome counts (answered,
    came back, booked). There's never a count of messages sent.
  - **All caught up:** a pen-drawn check, "You're all caught up.", the day's line full, and one promise about
    notifications. No confetti, no animation.
- **Not taken from Duolingo:** streaks, XP, leagues, the mascot, and guilt or urgency reminders. These were already
  excluded, and the study adds Duolingo's own cost: in one survey, 62% of users felt guilty after missing a day.

**Weak spots:** the "This week" numbers and Tom's story are sample data; the caught-up screen reuses the hero
wash, so the gradient has now spread into the app (a third place). Ask whether that's wanted.
