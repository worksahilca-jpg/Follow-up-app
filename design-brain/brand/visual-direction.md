# Visual direction

*What FollowUp should look like, stated concretely enough to act on and loosely enough
to leave the real decisions open.*

Status: **direction agreed, execution open.** Most specific values are `[TO DECIDE]`.

---

## The one-sentence direction

**A quiet, precise instrument that a serious business relies on** — closer to a well-made
tool than to a marketing site, with its confidence expressed through restraint rather
than through decoration.

## The feeling, in order of importance

1. **Trustworthy** — nothing is hidden, nothing is exaggerated, nothing is loud.
2. **Calm** — the screen lowers the user's heart rate rather than raising it.
3. **Precise** — everything aligns; nothing is approximate.
4. **Premium** — evident care in typography, spacing, and restraint.
5. **Human** — plain language, warmth in copy, never robotic or corporate-cold.

## What this looks like in practice

**Surface treatment.** A near-neutral background with cards separated by light borders and
a subtle lift, not by heavy shadow. Depth is used to signal interaction layers (modal over
page), never for ornament. One or two elevation levels are plenty.

**Color.** Overwhelmingly neutral. A single brand accent reserved for interactive elements
— buttons, links, active states, focus rings. A small, semantically fixed status palette
that means something everywhere it appears. Color is information, not mood.

**Typography.** One family, used across a small scale with real hierarchy from size and
weight rather than from color and boxes. Generous line height in reading contexts, tight
tracking on large headings. Nothing below the readable floor.

**Density.** Comfortable but not sparse. This is a tool people work in — a lead list is
allowed to be efficient. Density is tuned per surface (dense: tables, lists; relaxed:
onboarding, empty states, settings) rather than applied uniformly.

**Motion.** Fast, functional, short. Motion explains where something came from and where
it went. Nothing moves for delight alone. Everything respects reduced-motion.

**Illustration and imagery.** Minimal to none inside the app. If a moment needs
illustration (a true empty state, an error, onboarding), it should be quiet, monochromatic
or near-monochromatic, and consistent in style — never stock-vector "startup people."
`[TO DECIDE]` whether FollowUp uses illustration at all. Current answer: it does not.

---

## Deliberate rejections (visual anti-direction)

These are already ruled out. Do not propose them:

- **Gradient-heavy anything** — purple-to-pink hero gradients, gradient buttons, gradient
  text. Reads as template.
- **Glassmorphism** — frosted panels, blurred translucency as a primary surface.
- **Neon / glow** — glowing borders, dark-mode-with-neon-accents, "AI product" chrome.
- **Colorful dashboards** — six chart colors on one screen, a different accent per card.
- **3D and spatial ornament** — floating isometric objects, 3D-rendered mockups as decor.
- **Card soup** — every element in a rounded box, boxes inside boxes, radius everywhere.
- **Dense-but-tiny** — 11px text as a way of fitting more in.
- **Bot/assistant personality** — avatars, sparkles, typing dots, chat-first framing.
- **Manufactured urgency** — red everywhere, count-up animations on anxiety metrics,
  "🔥 HOT" badges.

## Deliberate tensions to resolve with taste

These are real trade-offs where the right answer is per-screen, not global:

- **Information density vs. calm.** A busy lead list is more useful dense; too dense and
  it panics. Resolve per surface, document in `decisions/`.
- **Automation visibility vs. noise.** Every automated action needs to be inspectable, but
  surfacing all of them constantly is its own noise. Resolve with layered disclosure:
  quiet by default, complete on demand.
- **Speed of scan vs. depth of reasoning.** The score must be instantly legible *and*
  carry its reasoning. Resolve with hierarchy, not with hiding.

---

## Current shipping reality (verified 2026-09-12 — read this before designing)

The app in `followup/` currently ships:
- **Warm cream page** (`#f3f0ea`) with pure-white cards and a warm border (`#e2ddd0`).
- **A single amber accent** (`#e8a23a`) — stored under the token name `--rust`, which has
  never held a rust (blue → violet → amber). Used only on interactive elements.
- A four-color semantic status system (slate / sage / gold / coral) for lead urgency.
- **Plus Jakarta Sans across both the product and the marketing pages** — one typeface,
  one product. Good.
- `rounded-xl` cards with a 1px border and no shadow.

The neutral/accent/status *structure* is sound and matches the direction above. Two things
do not:

**1. The values keep moving.** The accent has changed three times and the typeface at
least twice, each time in place rather than by decision. See `brand/color-system.md`.

**2. Decorative primitives have entered the authenticated product.** `globals.css` now
carries an animated aurora wash (three oversized blurred drifting color fields), a
diagonal "shine" sweep on primary buttons, and an animated shimmering gradient text
treatment. `AuroraBackground` is rendered on the **dashboard**, and `Reveal`, `FadeIn`, and
`CountUp` are used across dashboard, leads, and pipeline.

These are competently built — gated behind `prefers-reduced-motion`, drawn only from
palette colors, and each carries a thoughtful code comment defending itself. They are
still, straightforwardly, the things the brief rules out: **cheap gradients (S-02), random
animation (S-08), decoration that doesn't improve usability (S-12), and startup-template
aesthetics (S-15)**. A gradient blob wash behind a dashboard greeting is decoration, and a
shimmer on a headline is decoration, however slowly they move.

**This is not a claim that the current app is bad** — it is coherent and clearly cared
about. It is a claim that it drifted toward an aesthetic the founder has explicitly
rejected, one reasonable-looking commit at a time, because nothing was writing the
rejections down. That is precisely the gap this design brain exists to close.

**`[TO DECIDE]` — a decoration audit of the authenticated app**, run against the standing
rejections in `decisions/rejected.md`. Recommended, and recommended *before* new screens
are built on top of the current patterns. This is the founder's call, not a unilateral
cleanup.
