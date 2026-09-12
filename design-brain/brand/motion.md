# Motion

**Principle: motion explains change. It does not decorate.** Every animation in FollowUp
must answer "where did this come from / where did it go / what just happened." If it
can't, it's ornament, and ornament is against the brand.

---

## Current state — audited 2026-09-12

`followup/src/components/motion/` contains eleven primitives: `AuroraBackground`,
`CountUp`, `FadeIn`, `HoverLift`, `KineticHeadline`, `ParallaxDots`, `Reveal`, `RiseIn`,
`ScoreRing`, `SparkleBurst`, `TiltCard`. `globals.css` additionally defines an aurora
drift animation, a `.btn-shine` diagonal sweep, and an animated `.text-gradient-accent`
shimmer.

**What is actually used inside the authenticated app (`src/app/(app)/**`):**

| Primitive | Used in | Assessment |
|---|---|---|
| `AuroraBackground` | dashboard | **Decoration.** A blurred, drifting gradient wash behind the greeting. Against S-02, S-08, S-12 |
| `Reveal` | dashboard, leads, pipeline | **Decoration.** Scroll/mount-triggered reveals inside the product — explicitly banned below |
| `FadeIn` | dashboard, leads | Borderline. A fade on first paint is mild, but it delays content for no informational gain |
| `CountUp` | dashboard, leads, pipeline, StatCard | **Questionable.** An animated counter on a lead metric is a small dopamine device against "calm over urgent" — and it is animating numbers that can represent leads going cold |

**Unused (dead code):** `SparkleBurst`, `TiltCard`, `KineticHeadline`, `HoverLift`,
`ParallaxDots`, `RiseIn`, `ScoreRing`. Not rendering anywhere is good. `SparkleBurst` and
`TiltCard` existing at all is worth noting — sparkles are S-13 (AI gimmicks) and 3D tilt
is S-07, so they should not be reached for when a future screen wants "some polish."

**Credit where due:** every one of these is gated behind `prefers-reduced-motion`, uses
only palette colors, and is genuinely well built. The problem is not craft — it is that
they are ornament, and ornament is what the brand rejects.

**`[TO DECIDE]` — retire the decorative motion from the authenticated app** (aurora on the
dashboard, `Reveal` across three pages, `CountUp` on anxiety metrics), and delete the
unused primitives so they aren't reached for later. Marketing pages are a separate
question with more latitude. **This is the founder's decision to make** — flagged here
rather than acted on.

## Rules

1. **Duration: short.** 120–200ms for most UI transitions. 200–300ms for something
   entering or leaving the screen. Over 300ms inside a product feels slow, not luxurious.
   The app's global 150ms transition on interactive elements is a good default — keep it.
2. **Easing:** ease-out for entrances (fast start, gentle settle), ease-in for exits,
   ease-in-out for things that move without appearing. Never linear except for
   indeterminate loops (spinners, progress).
3. **Animate transforms and opacity only.** Animating layout properties (width, height,
   top) causes jank. If layout must animate, use a technique that doesn't reflow.
4. **Motion has a source and a destination.** A panel slides from the edge it's anchored
   to. A modal scales from the center it will occupy. Things don't appear from nowhere or
   drift in from arbitrary directions.
5. **Nothing moves on its own.** No auto-playing carousels, no idle animations, no
   attention-seeking pulses. Motion is a response to a user action or to real data
   arriving.
6. **One thing moves at a time.** Simultaneous animation on multiple elements reads as
   chaos. Stagger only for lists, subtly (≤30ms between items, ≤5 items), or not at all.
7. **`prefers-reduced-motion` is honored everywhere, not as an afterthought.** Under
   reduced motion, transitions become instant or a plain opacity fade. **No exceptions —
   including on marketing pages.** This is an accessibility requirement (vestibular
   disorders), not a preference.
8. **Never animate to communicate AI activity.** No shimmer, no typing dots, no pulsing
   "thinking" state. (Principle 3.) A plain "Drafting…" label is better.
9. **Loading is not an animation opportunity.** Skeletons match the shape of real content
   and don't shimmer aggressively. See `components/states.md`.

## Where motion earns its place

- **Entering/leaving overlays** — modal, drawer, dropdown, toast. Establishes layering.
- **State transitions on a control** — a toggle moving, a checkbox filling. Confirms the
  input registered.
- **Optimistic updates** — the moment a lead moves stage or a message sends, the change
  is visible instantly. This is the highest-value motion in the product because it makes
  the app feel fast even when the network isn't.
- **List reordering** — when a lead moves up a priority queue, moving it there is far
  clearer than having it teleport.
- **Attention, sparingly and only for real events** — a new escalation arriving while the
  user is looking at the screen may animate in once. It does not pulse afterward.

## Where motion is banned

- Dashboard load (staggered card reveals inside the app)
- Scroll-triggered reveals inside the product
- Parallax anywhere in the product
- Hover lift on cards (`HoverLift` — currently unused inside the app; keep it that way)
- Any animation on a number that represents something stressful
- Spinner-as-personality, loading animations with character
- Page transitions between app routes

## Open decisions

- `[TO DECIDE]` Named duration/easing tokens (`--motion-fast`, `--ease-out`) instead of
  inline values.
- `[TO DECIDE]` Retiring the decorative motion listed above from the authenticated app.
- `[TO DECIDE]` Whether `CountUp` stays on lead metrics.
- ~~Whether `prefers-reduced-motion` is honored~~ — **verified 2026-09-12: yes**, every
  decorative animation in `globals.css` is gated behind it. Keep that standard.
