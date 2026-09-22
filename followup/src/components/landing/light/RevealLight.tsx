"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Reveal for the light-direction marketing pages: a short rise-and-fade the
 * first time a block appears. Framer's `whileInView` (an IntersectionObserver
 * under the hood) for everything below the fold — the template this page
 * follows uses exactly this kind of motion, and framer already ships in the
 * bundle.
 *
 * `mode="mount"` plays the same motion on load, unconditionally. The hero
 * uses it: the first screen is always in view, and gating it on an observer
 * left it blank in any environment where the observer never fires before a
 * capture (a static screenshot, a print, a slow tab). Nothing above the fold
 * ever waits for a scroll event.
 *
 * A reduced-motion visitor gets the content rendered at rest with no
 * animation at all. That is done in CSS — `[data-motion]` under
 * `prefers-reduced-motion: reduce` in globals.css — and NOT by branching on
 * `useReducedMotion()` here, which is what this component used to do.
 *
 * The branch was a hydration bug. `useReducedMotion()` returns false during
 * server rendering, because the server cannot know the visitor's preference.
 * So the server emitted the animated tree (every block at `opacity: 0`,
 * waiting) while a reduced-motion browser rendered the plain one. React
 * threw away the mismatched tree and re-rendered the entire landing page on
 * the client; until that finished, the visitor was looking at the server's
 * HTML, which is a blank page. The people who asked for less movement got
 * the worst version of it.
 *
 * The media query has no server/client split, so the markup below is now
 * identical in every environment.
 */
export default function RevealLight({
  children,
  className,
  delay = 0,
  y = 22,
  mode = "view",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  mode?: "view" | "mount";
}) {
  const transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const, delay };
  if (mode === "mount") {
    return (
      <motion.div data-motion className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={transition}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      data-motion
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
