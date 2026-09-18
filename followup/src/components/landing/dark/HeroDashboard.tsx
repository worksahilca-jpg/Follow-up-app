"use client";

import { motion, useReducedMotion } from "framer-motion";
import styles from "@/app/landing-dark.module.css";
import CountUp from "@/components/motion/CountUp";

/**
 * The template's hero device, faithfully: one wide app-window card with
 * three stat tiles (value + green delta badge), a bar chart with tabs, and
 * a side panel with a line chart and a legend. Every number is a demo state
 * of FollowUp's own dashboard for one imaginary week, labelled as such by
 * the card title; none is a claim about a customer (standing rule).
 */
const BARS = [38, 52, 44, 70, 62, 86, 58, 74, 92, 66, 80, 100];
const LINE = "M0 78 C 30 72, 50 66, 80 60 S 130 50, 160 42 S 210 36, 240 24 S 280 18, 300 10";

export default function HeroDashboard() {
  const reduced = useReducedMotion();
  const anim = reduced
    ? {}
    : { initial: { opacity: 0, y: 28, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay: 0.35 } };

  return (
    <motion.div className={styles.dash} {...anim}>
      <div className={styles.dashCard} aria-label="Example of the FollowUp dashboard for one week">
        <div className={styles.chrome} aria-hidden="true">
          <span className={styles.chromeDots}>
            <span />
            <span />
            <span />
          </span>
          <span className={styles.chromeUrl}>app.followup · Dashboard</span>
        </div>
        <div className={styles.dashBody}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <div className={styles.tileLabel}>Leads brought back</div>
            <div className={styles.tileRow}>
              <span className={styles.tileValue}>
                <CountUp to={23} />
              </span>
              <span className={styles.delta}>+64%</span>
            </div>
          </div>
          <div className={styles.tile}>
            <div className={styles.tileLabel}>Replies sent for you</div>
            <div className={styles.tileRow}>
              <span className={styles.tileValue}>
                <CountUp to={148} />
              </span>
              <span className={styles.delta}>+31%</span>
            </div>
          </div>
          <div className={styles.tile}>
            <div className={styles.tileLabel}>Average first response</div>
            <div className={styles.tileRow}>
              <span className={styles.tileValue}>
                <CountUp to={4} suffix=" min" />
              </span>
              <span className={`${styles.delta} ${styles.deltaDown}`}>from 31 hrs</span>
            </div>
          </div>
        </div>

        <div className={styles.panels}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span>Conversations followed up</span>
              <span className={styles.tabs} aria-hidden="true">
                <span className={styles.tab}>Daily</span>
                <span className={`${styles.tab} ${styles.tabOn}`}>Weekly</span>
                <span className={styles.tab}>Monthly</span>
              </span>
            </div>
            <div className={styles.bars} aria-hidden="true">
              {BARS.map((h, i) => (
                <span key={i} className={`${styles.bar} ${i % 4 === 1 ? styles.barMuted : ""}`} style={{ ["--h" as string]: `${h}%`, ["--d" as string]: `${0.5 + i * 0.05}s` }} />
              ))}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span>Where the week&apos;s leads came from</span>
            </div>
            <svg viewBox="0 0 300 90" width="100%" height="90" aria-hidden="true" style={{ marginTop: 14 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b2ce0" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#5b2ce0" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className={styles.lineArea} d={`${LINE} L300 90 L0 90 Z`} />
              <path className={styles.linePath} d={LINE} />
            </svg>
            <div className={styles.legend}>
              {[
                ["Instagram", "41", styles.dot],
                ["Gmail", "37", styles.dotGreen],
                ["Website form", "22", styles.dotAmber],
                ["WhatsApp", "12", styles.dotMuted],
              ].map(([k, v, cls]) => (
                <div key={k} className={styles.legendRow}>
                  <span className={styles.legendKey}>
                    <span className={cls} />
                    {k}
                  </span>
                  <span className={styles.legendVal}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.miniRow}>
          {[
            ["Waiting on you", "3"],
            ["Going cold today", "5"],
            ["Booked this week", "9"],
          ].map(([k, v]) => (
            <div key={k} className={styles.mini}>
              <span>{k}</span>
              <span className={styles.miniVal}>{v}</span>
            </div>
          ))}
        </div>
        </div>
      </div>
    </motion.div>
  );
}
