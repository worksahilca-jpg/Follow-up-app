"use client";

import { useEffect } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import styles from "@/app/landing-light.module.css";

/**
 * The hero's product view: one wide dashboard card, the way the reference
 * template shows its product, filled with what FollowUp actually shows an
 * owner — who needs them today, why, and what went out. Numbers are a demo
 * state of the product, the same as the lead names, not claims about any
 * business; nothing here is presented as a customer result.
 *
 * Idle float and a light mouse tilt on one set of motion values (the same
 * technique the previous hero used), and everything sits still for a
 * reduced-motion visitor.
 */
const BARS = [38, 52, 44, 70, 58, 86, 64];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function HeroMockupLight() {
  const reduced = useReducedMotion();
  const idleY = useMotionValue(0);
  const idleRx = useMotionValue(0);
  const mouseRx = useMotionValue(0);
  const mouseRy = useMotionValue(0);
  const springRx = useSpring(mouseRx, { stiffness: 110, damping: 18, mass: 0.6 });
  const springRy = useSpring(mouseRy, { stiffness: 110, damping: 18, mass: 0.6 });

  useAnimationFrame((t) => {
    if (reduced) return;
    const cycle = (t / 1000 / 8) * Math.PI * 2;
    idleY.set(Math.sin(cycle) * -5 - 4);
    idleRx.set(Math.sin(cycle) * -0.6);
  });
  useEffect(() => {
    if (reduced) idleY.set(0);
  }, [reduced, idleY]);

  const rotateX = useTransform([idleRx, springRx], (v) => 3 + Number(v[0]) + Number(v[1]));
  const rotateY = useTransform([springRy], (v) => Number(v[0]));

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    mouseRx.set((e.clientY / window.innerHeight - 0.5) * 4);
    mouseRy.set((e.clientX / window.innerWidth - 0.5) * -6);
  }
  function onLeave() {
    mouseRx.set(0);
    mouseRy.set(0);
  }

  return (
    <div className={styles.scene} onMouseMove={onMove} onMouseLeave={onLeave}>
      <motion.div className={styles.window} style={{ rotateX, rotateY, y: idleY }}>
        <div className={styles.windowBar}>
          <span className={styles.dot} style={{ background: "#e0574a" }} />
          <span className={styles.dot} style={{ background: "#e0a83f" }} />
          <span className={styles.dot} style={{ background: "#5fb256" }} />
          <span className={styles.windowTitle}>FollowUp · Today</span>
        </div>

        <div className={styles.windowBody}>
          {/* Left: the numbers an owner opens the app for */}
          <div className="grid gap-3.5">
            <div className={styles.tiles}>
              <div className={styles.tile}>
                <div className={styles.tileLabel}>Needs you today</div>
                <div className={styles.tileValue}>3</div>
                <span className={`${styles.tileDelta} ${styles.pillCoral}`}>2 about to go cold</span>
              </div>
              <div className={styles.tile}>
                <div className={styles.tileLabel}>Replies this week</div>
                <div className={styles.tileValue}>14</div>
                <span className={`${styles.tileDelta} ${styles.pillSage}`}>+5 vs last week</span>
              </div>
              <div className={styles.tile}>
                <div className={styles.tileLabel}>Rescued this month</div>
                <div className={styles.tileValue}>$8,900</div>
                <span className={`${styles.tileDelta} ${styles.pillSlate}`}>4 leads came back</span>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Replies to follow-ups</span>
                <div className={styles.tabs}>
                  <span className={`${styles.tab} ${styles.tabActive}`}>Week</span>
                  <span className={styles.tab}>Month</span>
                </div>
              </div>
              <div className={styles.bars} aria-hidden="true">
                {BARS.map((h, i) => (
                  <div
                    key={i}
                    className={`${styles.bar} ${i === 5 ? styles.barHot : ""}`}
                    style={{ ["--h" as string]: `${h}%`, ["--d" as string]: `${i * 0.06}s` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between" aria-hidden="true">
                {DAYS.map((d, i) => (
                  <span key={i} className="text-[10px] font-semibold" style={{ color: "var(--ink-faint)", flex: 1, textAlign: "center" }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: who needs you, and why */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Who needs you today</span>
              <span className="text-[11px] font-semibold" style={{ color: "var(--ink-faint)" }}>
                Ranked by risk
              </span>
            </div>
            <div className="mt-2">
              <div className={styles.leadRow}>
                <span className={styles.score}>92</span>
                <div className="min-w-0">
                  <div className={styles.leadName}>Sarah Johnson · $3,500</div>
                  <div className={styles.leadWhy}>Asked about pricing, opened your proposal twice, no reply in 5 days.</div>
                </div>
                <span className={`${styles.pill} ${styles.pillCoral}`}>Needs you</span>
              </div>
              <div className={styles.leadRow}>
                <span className={styles.score}>74</span>
                <div className="min-w-0">
                  <div className={styles.leadName}>Mike Patel</div>
                  <div className={styles.leadWhy}>Requested a proposal 3 days ago. A short check-in is drafted.</div>
                </div>
                <span className={`${styles.pill} ${styles.pillGold}`}>Going cold</span>
              </div>
              <div className={styles.leadRow}>
                <span className={styles.score}>61</span>
                <div className="min-w-0">
                  <div className={styles.leadName}>Priya Shah</div>
                  <div className={styles.leadWhy}>Tapped &ldquo;This week&rdquo; on Instagram. Confirm a time.</div>
                </div>
                <span className={`${styles.pill} ${styles.pillSage}`}>Replied</span>
              </div>
              <div className={styles.leadRow}>
                <span className={styles.score}>45</span>
                <div className="min-w-0">
                  <div className={styles.leadName}>Devon Ruiz</div>
                  <div className={styles.leadWhy}>Waiting on their answer since Tuesday. Nothing to do yet.</div>
                </div>
                <span className={`${styles.pill} ${styles.pillSlate}`}>Waiting</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      <div className={styles.groundShadow} aria-hidden="true" />
    </div>
  );
}
