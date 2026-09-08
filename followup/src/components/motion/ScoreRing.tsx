"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

/**
 * An animated circular score ring — draws in from 0 to `value` once
 * scrolled into view, the same "tick up instead of sitting there static"
 * treatment CountUp already gives the hero's "21×" stat. This is the
 * product's actual score indicator (see ScoreBadge.tsx, used throughout
 * the real app), not a decorative shape standing in for the product —
 * the number on it is the same lead score a real user would see.
 */
export default function ScoreRing({
  value,
  size = 56,
  strokeWidth = 6,
  color = "var(--coral)",
  trackColor = "var(--coral-soft)",
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  const offset = circumference - (display / 100) * circumference;

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-sm font-semibold" style={{ color }}>
        {display}
      </span>
    </div>
  );
}
