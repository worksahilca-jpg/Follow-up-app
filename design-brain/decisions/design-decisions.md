# Design decisions log

The chronological record of **every design decision that matters**, whether or not the
founder was in the room.

`approved.md` and `rejected.md` record the founder's verdicts. This file records the
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

## D-001 — The design brain precedes the design work
**Date:** 2026-09-12
**Decided by:** Founder
**Status:** active
**Context:** FollowUp already ships a real application with a working token system built
ad hoc, alongside a strong product-direction document (`followup/PRODUCT_DIRECTION.md`)
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

## D-002 — Document the shipping system as provisional rather than redesigning it
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

## D-003 — Two files added beyond the specified structure
**Date:** 2026-09-12
**Decided by:** Claude (autonomous)
**Status:** active
**Context:** The brief specifies an exact folder tree, and separately requires
documentation for border radius, shadows, elevation, grid, and badges. Those don't map to
any file in the specified tree.
**Decision:** Added `brand/surfaces.md` (radius, borders, shadows, elevation) and
`components/badges.md` (badges, pills, score and priority indicators). Grid and
breakpoints went into `brand/spacing.md`, which they naturally belong to.
**Reasoning:** The alternative was scattering elevation rules across unrelated files or
omitting them. Two clearly-named files beat both.
**Trade-off accepted:** The tree differs slightly from the brief. Flagged explicitly
rather than done silently.
**Revisit when:** The founder prefers a different organization.

## D-004 — The shipping app has drifted toward the aesthetic the brief rejects
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

**Why this matters:** these map directly onto standing rejections S-02 (cheap gradients),
S-07 (unnecessary 3D), S-08 (random animation), S-12 (decoration that doesn't improve
usability), S-13 (AI gimmicks — sparkles), and S-15 (startup-template aesthetics).

**What is *not* being claimed:** that this work is bad or careless. It is the opposite —
every animation is gated behind `prefers-reduced-motion`, every color comes from the
palette, and each primitive carries a thoughtful comment defending its own restraint. The
craft is good. The drift happened anyway, one defensible commit at a time, because no
file existed that said "not this." That is exactly the failure the design brain prevents,
and finding it on day one is evidence the brain is worth having.

**Decision:** **None taken.** Documented in `brand/visual-direction.md` and
`brand/motion.md`, flagged to the founder, and deliberately not acted on. Ripping
decoration out of a shipped product is a product decision with real cost, and the brief
was explicit that this pass builds the design brain and does not change the UI.

**Trade-off accepted:** The design brain currently documents a product that contradicts it
in places. That inconsistency is visible and uncomfortable, which is correct — an accurate
description of a gap is more useful than a tidy document that hides it.

**Revisit when:** The founder decides whether to run a decoration audit. Until then,
**new** work follows the brain; existing decoration stays until it is explicitly reviewed.

## D-005 — Fix the measured contrast failures; do not touch the accent hue
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
`brand/color-system.md`) — fixing contrast must not quietly settle it. Option 2 is
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

## D-006 — First research pass: read the repo's own research through a design lens
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

## D-007 — "Review": giving the approve-a-draft moment a place of its own
**Date:** 2026-09-12
**Decided by:** Claude (proposed) — **awaiting founder approval, not yet implemented**
**Status:** proposed
**Context:** Research (D-006) put this ahead of the dashboard as the product's most important
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

**Deliberately excluded:** bulk "approve all" (it is the blast-tool affordance, and S-13's
sibling); the sparkle icon and "AI-suggested follow-up" heading the current composer uses
(S-13, and it feeds the exact fear in Finding 2); a confidence percentage (false precision);
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

## D-008 — "Award Direction": a second, page-scoped visual system for the public landing page
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
  S-03 rejection (excessive glassmorphism), and the CEO's override only named S-07 (3D),
  S-08 (ambient animation), and S-13 (sparkle). The mockup card here is opaque white, same
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

**Deliberately excluded (do not re-propose on this page):** the WebGL orbit diagram and its
flat-CSS fallback (see above — S-07 exception used for the hero mockup's parallax/float
only, not spent on a second 3D-ish diagram); frost particles, cursor-glow, drifting
background rings, animated gradient mesh, spinning conic-gradient borders (S-08 exception
used for the hero word-reveal, hover states, and the FAQ accordion only); the ✦ sparkle
badge icon and any other sparkle/AI-gimmick iconography elsewhere on the page (S-13 — the
CEO's override was for the hero badge specifically, not a blanket pass for this page); a
headline word-rotor cycling through synonyms ("went quiet" / "went cold" / "ghosted you") —
present in the exploration but read as decorative wordplay rather than the "explains a
sequence" motion the word-by-word reveal and FAQ accordion are; the fabricated testimonial,
under any label.

**Revisit when:** The CEO reviews the live page, or a future session is asked to unify `/`
and `/signin` onto one marketing visual system.
