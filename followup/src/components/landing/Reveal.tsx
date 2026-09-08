"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-triggered section reveal — framer-motion's viewport detection
 * standing in for a hand-rolled IntersectionObserver (same mechanism,
 * far fewer lines, and it already respects MotionConfig's
 * reducedMotion="user" set at the root layout). Fires once per section,
 * never re-triggers on scroll-back.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
