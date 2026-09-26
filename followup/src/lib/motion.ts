/**
 * The app's motion, in one place (design brain A-048, the Framer study).
 * The same four speeds as the CSS tokens in globals.css (--motion-fast,
 * --motion-move, --motion-exit), for framer-motion. Transform and opacity
 * only; one thing moves at a time; nothing moves on its own.
 *
 * Reduced motion is handled once, by <MotionConfig reducedMotion="user">
 * in the root layout: transforms and layout motion are skipped there and
 * the change simply happens.
 */
export const MOTION = {
  fast: 0.15,
  move: 0.22,
  exit: 0.12,
  easeOut: [0.22, 1, 0.36, 1] as [number, number, number, number],
  easeIn: [0.4, 0, 1, 1] as [number, number, number, number],
  // The list closing up after a card leaves: settles in about 220 ms,
  // without overshoot.
  layout: { type: "spring" as const, stiffness: 500, damping: 42 },
};

/** How long a card's result ("Sent to Priya") stays before the list closes up. */
export const RESULT_HOLD_MS = 700;

/** Entering from where it was tapped, and leaving the same way, faster. */
export const OPEN_IN_PLACE = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: { duration: MOTION.move, ease: MOTION.easeOut } },
  exit: { opacity: 0, y: -4, transition: { duration: MOTION.exit, ease: MOTION.easeIn } },
};
