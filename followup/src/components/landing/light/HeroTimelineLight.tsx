"use client";

import { motion, useReducedMotion } from "framer-motion";
import styles from "@/app/landing-light.module.css";

/**
 * The hero's visual, third take. Not a dashboard (R-005) and not a staged
 * chat with a named lead (R-007: "the Sarah Johnson example is looking
 * awkward"). Three quiet lines that tell the only story the product exists
 * for: a lead asked, the thread went quiet, FollowUp asked one question and
 * the lead came back. No avatars, no bubbles, no pretend screenshot. The
 * rows appear one after another on load so the silence in the middle is
 * felt, not just read. Every line is a demo state; none is a claim about a
 * customer.
 */
const EASE = [0.16, 1, 0.3, 1] as const;

const ROWS = [
  { when: "Tue", text: "A lead asks about a two-bed clean, ideally Saturday.", tone: "lead" },
  { when: "Tue", text: "You reply with a price and hold the slot.", tone: "you" },
  { when: "5 days", text: "Nothing.", tone: "quiet" },
  { when: "Sun", text: "FollowUp asks one question: still want Saturday, or is a weekday easier?", tone: "auto" },
  { when: "Sun", text: "“Saturday works.”", tone: "lead" },
] as const;

export default function HeroTimelineLight() {
  const reduced = useReducedMotion();
  const step = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: EASE, delay: 0.6 + i * 0.5 },
        };

  return (
    <div className={styles.story}>
      <div className={`${styles.tl} ${styles.light}`} role="list" aria-label="How a follow-up happens">
        {ROWS.map((r, i) => (
          <motion.div
            key={i}
            role="listitem"
            className={`${styles.tlRow} ${r.tone === "quiet" ? styles.tlQuiet : ""} ${r.tone === "auto" ? styles.tlAuto : ""}`}
            {...step(i)}
          >
            <span className={styles.tlWhen}>{r.when}</span>
            <span className={styles.tlDot} aria-hidden="true" />
            <span className={styles.tlText}>
              {r.tone === "auto" && <span className={styles.tlTag}>FollowUp</span>}
              {r.text}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
