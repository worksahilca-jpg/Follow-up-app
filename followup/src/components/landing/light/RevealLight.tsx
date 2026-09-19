"use client";

import { motion, useReducedMotion } from "framer-motion";
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
 * animation at all; the `initial` state is never applied, so nothing sits at
 * opacity 0 for them.
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
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  const transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const, delay };
  if (mode === "mount") {
    return (
      <motion.div className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={transition}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
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
