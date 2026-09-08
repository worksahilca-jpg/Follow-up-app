"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["var(--rust)", "var(--gold)", "var(--sage)"];
const PARTICLE_COUNT = 12;

/**
 * A small burst of color from wherever it's clicked — wraps the hero
 * mockup's "Send email" chip specifically. That chip is a static demo
 * (it doesn't send anything — this is a screenshot of the product, not
 * the product), so a click there has nothing real to do; this gives it
 * something delightful to do instead. Deliberately not used on the
 * page's actual CTAs, which navigate to /signin — a burst that gets cut
 * off by an instant page change is wasted, not delightful.
 */
export default function SparkleBurst({ children }: { children: React.ReactNode }) {
  const [bursts, setBursts] = useState<number[]>([]);

  function fire() {
    const id = Date.now();
    setBursts((b) => [...b, id]);
    setTimeout(() => setBursts((b) => b.filter((burstId) => burstId !== id)), 650);
  }

  return (
    <span className="relative inline-block cursor-pointer select-none" onClick={fire}>
      {children}
      <AnimatePresence>
        {bursts.map((id) => (
          <span key={id} className="pointer-events-none absolute inset-0" aria-hidden>
            {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
              const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
              const distance = 24 + (i % 3) * 8;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  initial={{ opacity: 1, x: "-50%", y: "-50%", scale: 1 }}
                  animate={{
                    opacity: 0,
                    x: `calc(-50% + ${Math.cos(angle) * distance}px)`,
                    y: `calc(-50% + ${Math.sin(angle) * distance}px)`,
                    scale: 0,
                  }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              );
            })}
          </span>
        ))}
      </AnimatePresence>
    </span>
  );
}
