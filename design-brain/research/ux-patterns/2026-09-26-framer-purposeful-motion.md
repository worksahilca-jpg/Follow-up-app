# Framer: purposeful motion, transitions that explain a change of state

**Date:** 2026-09-26 · **Asked by:** Sahil · **Status:** STUDIED, proposals pending approval

**Question:** How do Framer (the design tool) and Framer Motion (now "Motion", the React library FollowUp already
ships) make motion *explain* what changed, instead of decorating? Where in FollowUp does a state change happen
today with nothing to explain it?

Sources are at the end. motion.dev and framer.com are blocked from this environment, so the Framer material comes
from search results and from how the library already behaves in our code. These are principles only. Nothing here
copies a Framer screen.

---

## What Framer teaches

- **Motion lives between two states, not on one.** In Framer you draw a component's *variants* (states), then set a
  transition between them. "Magic Motion" matches the same element in both states and moves it from one to the
  other. The animation is never a thing by itself. It's how one state becomes the next.
- **Layout animation (FLIP).** When a list changes, each item animates from where it *was* to where it *is*, using
  transforms only. Nothing is choreographed by hand: the layout change *is* the animation.
- **Exit before removal (AnimatePresence).** Something that leaves gets to show *that* it left before it disappears.
  Without it, a removed item simply vanishes and the list jumps.
- **Shared element (layoutId).** One thing moving between two places shows it's the *same* thing: a draft becoming the
  sent message, a card becoming its detail.
- **Springs, interruptible.** A spring picks up from wherever the element is, so a second tap mid-animation doesn't
  snap or restart.
- **Reduced motion is one switch.** `MotionConfig reducedMotion="user"` turns transforms and layout motion off and
  keeps opacity. FollowUp already sets this in `layout.tsx`.

Material's motion system and NN/g say the same thing in their own words. Transitions build a "coherent spatial
model": this came from there, that replaced this. The best UI animation is brief and sits at the point of focus. It's
feedback for a change of state, not attention-seeking.

### The principles underneath

- **P1:** Animate the *change*, never the arrival. If nothing changed state, nothing moves.
- **P2:** Leave, then close up. A thing that's done should visibly go, and the next thing should visibly take its
  place.
- **P3:** The same object keeps its identity. If it's one thing in two places, it travels.
- **P4:** Time you can see. When a window is closing (like undo), show it shrinking, not only as a number.
- **P5:** Short and quiet. 150–250 ms, ease-out, transforms and opacity only, and nothing moves on its own.

---

## Where FollowUp stands (checked on main, 2026-09-26)

**The rulebook is already right.** `brand/motion.md` says motion explains change or doesn't exist. It bans load
staggers, scroll reveals and page transitions inside the app, and names the moments that earn motion. S-08 says the
same. This study doesn't need new rules. It finds where the rules aren't met yet.

**Where a state change happens with nothing to explain it:**
1. **Today, after Send, Don't send or Later.**
   - The card is filtered out of the list (`resolved`, `ApprovalQueue.tsx`) and vanishes. Everything below jumps up
     at once.
   - The owner does this forty times in a sitting, and each time loses their place for a moment.
2. **The 10-second undo shows only as text** ("Sending to Priya in 7s"). The number changes, but nothing shows how
   much of the window is left at a glance.
3. **Opening things in place** snaps open with no sense of where they came from: "See an example" on a rule, the Later
   menu, "Every step, with times", and the Coming up list.
4. **Decorative motion still in the app**, which `motion.md` already flags `[TO DECIDE]`:
   - `FadeIn` on Today's sections at load.
   - `RevealGroup` stagger and `CountUp` numbers on Pipeline.
   - Unused `SparkleBurst` and `TiltCard` (S-13, S-07) are still in the codebase.
5. **No motion tokens.** Durations and easings are written inline, one by one. This is also flagged `[TO DECIDE]`.

---

## Proposals (ranked)

1. **Today: a card leaves, then the list closes up (P2).**
   - After Send (once the undo window ends), Don't send or Later, the card collapses into a one-line result, for
     example "Sent to Priya".
   - That line fades, and the cards below slide up into its place. About 200 ms each, layout animation.
   - The handled line updates. The number doesn't count up; it just changes.
   - This is the highest-value motion in the product: it's the action repeated most.
2. **The undo window you can see (P4).** A thin line under "Sending to Priya in 7s · Undo" shrinks over the 10
   seconds. It's linear, because it's time. It stops the moment Undo is pressed. It shows how long you have without
   reading.
3. **Open where you tapped (P1, P3).** "See an example", the Later menu and "Every step" grow from their trigger:
   height and opacity, 180 ms. A menu comes from its button, not from nowhere.
4. **Retire decoration inside the app (P1, P5).** This decides motion.md's open `[TO DECIDE]`:
   - Remove the load fades on Today.
   - Remove Pipeline's stagger and counting numbers.
   - Delete the unused sparkle and tilt primitives.
   - It changes nothing about the landing page (A-022/A-023 hero motion stays).
5. **Motion tokens (P5).**
   - `--motion-fast` 150 ms (controls), `--motion-move` 220 ms (things entering, leaving, closing up), `--ease-out`,
     and one spring for layout.
   - Finalizing tokens is `[TO DECIDE]`, so this is a proposal for Sahil.

**Not proposed:**
- Page transitions between routes (banned in motion.md).
- Animated numbers.
- A "thinking" shimmer while a draft is written (S-13, motion rule 8).
- A draft flying into the thread as a shared element. It's tempting (P3), but the thread and Today are different
  pages, and the rule bans route transitions.
- Animating a new customer's card in live. Today doesn't update itself yet, so this has nothing to hang on.

**Guardrails:**
- `reducedMotion="user"` stays global: under reduced motion, the close-up is instant and the undo line doesn't move
  (the seconds still count).
- Nothing moves on its own, and one thing moves at a time.
- No new dependency. framer-motion is already installed.

**Rejected-list check:** clean.
- S-08 (random animation): every proposal animates a change the user caused.
- R-007/R-008 were about the landing page's scroll motion. Nothing here touches it.
- R-015: the phone gets no more content, and motion adds none.
- No streaks or celebrations (A-031, A-038).

---

## Sources

- Framer Academy: [Animated component interactions](https://www.framer.com/academy/lessons/framer-animations-component-interactions),
  [Animate between variants on scroll](https://www.framer.com/academy/lessons/framer-animations-scroll-variants)
- Motion (formerly Framer Motion): [Layout animations](https://motion.dev/docs/react-layout-animations),
  [AnimatePresence](https://motion.dev/docs/react-animate-presence), [Reorder](https://motion.dev/docs/react-reorder)
- Maxime Heckel: [Everything about Framer Motion layout animations](https://blog.maximeheckel.com/posts/framer-motion-layout-animations/)
- Material Design: [The motion system](https://m2.material.io/design/motion/the-motion-system.html),
  [Applying transitions](https://m3.material.io/styles/motion/transitions/applying-transitions)
- NN/g: [Animation for attention and comprehension](https://www.nngroup.com/articles/animation-usability/),
  [The role of animation and motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/),
  [Animation duration](https://www.nngroup.com/articles/animation-duration/)
