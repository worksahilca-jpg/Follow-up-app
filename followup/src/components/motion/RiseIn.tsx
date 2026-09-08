"use client";

import { motion, type Variants } from "framer-motion";

const variants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/**
 * FadeIn's louder sibling — more travel, a touch of scale, a slower
 * spring — for section headers and the things that should announce
 * themselves on scroll rather than just settle into place. FadeIn stays
 * the default for supporting content (step cards, body copy); this is
 * reserved for the handful of moments per page that should read as an
 * entrance, not a formality.
 */
export default function RiseIn({
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
      viewport={{ once: true, margin: "-100px" }}
      variants={variants}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
