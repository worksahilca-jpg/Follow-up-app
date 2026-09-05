"use client";

import { motion } from "framer-motion";

/**
 * A small hover lift + shadow for otherwise-static bordered cards (the
 * How-it-works / Who-it's-for / Why-not-a-CRM step cards) — the one piece
 * of the page you can point a cursor at with nothing responding today.
 * Shadow is a literal rgba, matching the boxShadow convention already used
 * on the hero mockups, rather than a token — a hover shadow isn't part of
 * the accent system, just depth.
 */
export default function HoverLift({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -4, boxShadow: "0 16px 32px -16px rgba(0,0,0,0.18)" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
