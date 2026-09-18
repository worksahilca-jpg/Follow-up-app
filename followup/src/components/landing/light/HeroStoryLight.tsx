"use client";

import { motion, useReducedMotion } from "framer-motion";
import styles from "@/app/landing-light.module.css";

/**
 * The hero's visual: not a dashboard (founder, 2026-09-18: "remove this
 * dashboard kind of thing, let's cook something else") but the one story the
 * product exists for, told as the thread it actually happens in. A lead
 * writes, the owner answers, five days of nothing, FollowUp asks one short
 * question with reply buttons, the lead comes back. The sequence plays once
 * on load, in order, so a visitor reads it the way it happened. Every line is
 * a demo state of the product; none of it is a claim about a customer.
 */
const EASE = [0.16, 1, 0.3, 1] as const;

export default function HeroStoryLight() {
  const reduced = useReducedMotion();
  const step = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.55, ease: EASE, delay: 0.5 + i * 0.55 },
        };

  return (
    <div className={styles.story}>
      <div className={styles.thread}>
        <div className={styles.threadBar}>
          <span className={styles.threadAvatar} aria-hidden="true">
            SJ
          </span>
          <div className="min-w-0">
            <div className={styles.threadName}>Sarah Johnson</div>
            <div className={styles.threadMeta}>Instagram · asked about a two-bed clean</div>
          </div>
          <span className={`${styles.pill} ${styles.pillSage} ${styles.threadState}`}>Replied</span>
        </div>

        <div className={styles.threadBody}>
          <motion.div className={`${styles.bubble} ${styles.bubbleLead}`} {...step(0)}>
            Hi! How much for a two-bed clean, ideally Saturday?
            <span className={styles.bubbleWhen}>Tue 9:12</span>
          </motion.div>

          <motion.div className={`${styles.bubble} ${styles.bubbleOwner}`} {...step(1)}>
            Around $180 depending on the state of it. I can hold Saturday 10am if that works?
            <span className={styles.bubbleWhen}>Tue 9:40 · you</span>
          </motion.div>

          <motion.div className={styles.quiet} {...step(2)}>
            <span className={styles.quietLine} aria-hidden="true" />
            <span className={`${styles.pill} ${styles.pillGold}`}>5 days, nothing</span>
            <span className={styles.quietLine} aria-hidden="true" />
          </motion.div>

          <motion.div className={`${styles.bubble} ${styles.bubbleOwner} ${styles.bubbleAuto}`} {...step(3)}>
            <span className={styles.bubbleTag}>Sent by FollowUp</span>
            Still want Saturday, or is a weekday easier?
            <div className={styles.chips} aria-hidden="true">
              <span className={styles.chipBtn}>Saturday</span>
              <span className={styles.chipBtn}>Weekday</span>
              <span className={styles.chipBtn}>Not now</span>
            </div>
            <span className={styles.bubbleWhen}>Sun 11:05</span>
          </motion.div>

          <motion.div className={`${styles.bubble} ${styles.bubbleLead}`} {...step(4)}>
            Saturday works! 10 is fine.
            <span className={styles.bubbleWhen}>Sun 11:09</span>
          </motion.div>
        </div>
      </div>

      <motion.p className={styles.storyCaption} {...step(5)}>
        One short question, sent when the thread went quiet. No dashboard needed.
      </motion.p>
    </div>
  );
}
