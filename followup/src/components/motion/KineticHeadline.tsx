"use client";

import { motion } from "framer-motion";

/**
 * A curtain-wipe reveal (clip-path, left to right) for the one headline
 * per page that should announce itself rather than just fade in — the
 * hero's H1. Everything else on the page still uses the quieter FadeIn/
 * RiseIn; this is reserved for the single most important line of copy.
 */
export default function KineticHeadline({
  children,
  className,
  style,
  delay = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
