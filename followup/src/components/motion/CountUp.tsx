"use client";

import { useEffect, useState } from "react";
import { animate } from "framer-motion";

/**
 * Ticks a number up from 0 on mount instead of rendering it static — used
 * once, on the hero's "21×" conversion stat, so the page's one cited proof
 * point gets a beat of its own instead of sitting inert next to an
 * animated headline around it. Respects reduced motion globally via
 * <MotionConfig reducedMotion="user"> in layout.tsx (framer-motion's
 * `animate()` honors that same setting), which is why there's no
 * additional guard here.
 */
export default function CountUp({
  to,
  suffix = "",
  duration = 1.1,
  className,
  style,
}: {
  to: number;
  suffix?: string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, duration]);

  return (
    <span className={className} style={style}>
      {value}
      {suffix}
    </span>
  );
}
