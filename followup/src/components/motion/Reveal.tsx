"use client";

import { motion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

/**
 * A staggered entrance for a group of sibling elements — the hero's
 * headline/copy/CTAs revealing as one orchestrated beat on page load
 * (`on="mount"`) instead of popping in all at once, and the same cascade
 * replayed for content below the fold on scroll-into-view (`on="view"`,
 * the default), like the team-pipeline mock rows. Pairs with RevealItem,
 * which must wrap each direct child that should take part in the stagger.
 *
 * Reduced motion is handled once, globally, via <MotionConfig
 * reducedMotion="user"> in layout.tsx — every framer-motion animation in
 * the app (this one included) collapses to an instant, distance-free
 * transition under prefers-reduced-motion without needing a guard here.
 */
export function RevealGroup({
  children,
  className,
  on = "view",
}: {
  children: React.ReactNode;
  className?: string;
  on?: "mount" | "view";
}) {
  const trigger =
    on === "view"
      ? { whileInView: "visible" as const, viewport: { once: true, margin: "-80px" } }
      : { animate: "visible" as const };

  return (
    <motion.div className={className} initial="hidden" variants={container} {...trigger}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
