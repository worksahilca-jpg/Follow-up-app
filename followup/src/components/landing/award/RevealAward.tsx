"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "@/app/landing-award.module.css";
import { registerRevealCheck } from "./reveal-registry";

/**
 * Scroll reveal for the award-direction landing page. See
 * reveal-registry.ts for why this checks bounding-rect position on every
 * scroll/resize rather than depending on IntersectionObserver sampling
 * alone, and landing-award.module.css's `.reveal` rule for the
 * `prefers-reduced-motion` and `@media print, (scripting: none)` fallbacks
 * that force every section visible outright when no check can ever run.
 */
export default function RevealAward({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Lazy initializer (runs during render, not as a side effect) so a
  // reduced-motion visitor is revealed from the first client render
  // rather than via a setState call inside the effect below.
  const [revealed, setRevealed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (revealed) return;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        setRevealed(true);
      }
    };
    return registerRevealCheck(check);
  }, [revealed]);

  return (
    <div
      ref={ref}
      className={`${styles.reveal} ${revealed ? styles.revealIn : ""} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
