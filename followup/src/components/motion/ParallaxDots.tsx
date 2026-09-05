"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * The hero's dot-grid background layer, given a faint vertical drift as
 * the page scrolls past it — a quiet nod to the "signal grid" idea (see
 * the comment on this layer in page.tsx) instead of a static image sitting
 * behind otherwise-moving content. Kept small (40px over the section's
 * full scroll range) so it reads as ambient, not a parallax gimmick.
 */
export default function ParallaxDots({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return <motion.div ref={ref} aria-hidden className={className} style={{ ...style, y }} />;
}
