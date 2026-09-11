"use client";

import { motion } from "framer-motion";
import styles from "@/app/landing.module.css";

/**
 * The hero headline's two-line treatment: line 1 static at full opacity,
 * line 2 fades letter-by-letter left to right down to near-invisible,
 * closing on a blue period. Each letter's REST opacity is a fixed
 * function of its position (not animated over time) — what animates is
 * only the one-time mount reveal, staggered per letter, settling each
 * letter at its own permanent opacity rather than a uniform fade-in.
 */
export default function FadeHeadline({ line1, line2 }: { line1: string; line2: string }) {
  const chars = line2.split("");
  const restOpacity = (i: number): number => {
    if (i <= 3) return 1;
    return Math.max(0.04, 1 - ((i - 3) / (chars.length - 3)) * 0.96);
  };

  return (
    <h1 className={styles.headline}>
      <motion.span
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: "block", color: "var(--ink)" }}
      >
        {line1}
      </motion.span>
      <span style={{ display: "block" }}>
        {chars.map((ch, i) => {
          const isPeriod = ch === ".";
          const target = restOpacity(i);
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: target }}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.028, ease: "easeOut" }}
              style={{
                display: "inline-block",
                color: isPeriod ? "var(--amber)" : "var(--ink)",
                whiteSpace: "pre",
              }}
            >
              {ch}
            </motion.span>
          );
        })}
      </span>
    </h1>
  );
}
