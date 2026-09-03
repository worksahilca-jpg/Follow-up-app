"use client";

import { motion, type Variants } from "framer-motion";

const variants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Wraps static server-rendered content in a quiet, quick fade — a state
 * change on scroll-into-view, not a decorative flourish. Kept fast (well
 * under 150ms) and nearly imperceptible in motion distance on purpose.
 * Kept as a small client leaf rather than converting whole pages to
 * client components — the page around it stays a server component.
 */
export default function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      transition={{ duration: 0.12, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
