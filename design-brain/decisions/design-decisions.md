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
