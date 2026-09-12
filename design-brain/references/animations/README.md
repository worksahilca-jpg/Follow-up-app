# References — Animations

Motion, transitions, micro-interactions, loading behavior, state change.

## What to look for here

- **What the motion explains.** Good motion is a sentence about causality: this came from
  there; that replaced this; your action registered.
- **Duration and restraint.** Time the animations if you can — the best UI motion is
  faster than people assume (often under 200ms).
- **Optimistic feedback** — the interaction feeling instant even when the network isn't.
- **Loading that isn't a spinner** — skeletons, progressive reveal, staged content.
- **Reduced-motion handling**, which almost nothing documents and which we require.

## The FollowUp-specific question

FollowUp's motion budget is deliberately small (see `brand/motion.md`). References here
are mostly useful for **what to leave out**. The motion that genuinely earns its place in
our product is narrow: overlays entering/leaving, control state changes, optimistic
updates, and list reordering when priority changes.

## Anti-patterns to notice and name

Scroll-jacking; parallax; staggered dashboard reveals on every load; animated numbers on
stressful metrics; loading animations with personality; shimmer as "AI is thinking";
anything that delays the user to look impressive.
