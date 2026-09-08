"use client";

import { useRef } from "react";
import { motion, useMotionValue, useMotionTemplate, useSpring, useTransform } from "framer-motion";

/**
 * A cursor-tracked 3D tilt plus a soft light that follows the pointer —
 * wraps the hero's product mockup so it reads as something with real
 * presence, not a flat screenshot. Pass the mockup's own classes
 * (rounding, in particular) through `className`; they land on this
 * wrapper too so the glow overlay's `rounded-[inherit]` lines up exactly.
 * Reduced motion is handled globally via <MotionConfig reducedMotion="user">
 * in layout.tsx — the tilt collapses to a flat, static card under it.
 */
export default function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const glowOpacity = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [0, 1], [8, -8]), { stiffness: 220, damping: 24 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-8, 8]), { stiffness: 220, damping: 24 });
  const glowX = useTransform(x, (v) => `${v * 100}%`);
  const glowY = useTransform(y, (v) => `${v * 100}%`);
  const glow = useMotionTemplate`radial-gradient(circle at ${glowX} ${glowY}, color-mix(in srgb, var(--rust) 22%, transparent), transparent 55%)`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  }

  return (
    <motion.div
      ref={ref}
      className={`relative ${className ?? ""}`}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      onMouseMove={handleMove}
      onHoverStart={() => glowOpacity.set(1)}
      onHoverEnd={() => glowOpacity.set(0)}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[inherit] z-10"
        style={{ background: glow, opacity: glowOpacity }}
      />
      {children}
    </motion.div>
  );
}
