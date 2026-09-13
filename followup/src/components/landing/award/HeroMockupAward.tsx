"use client";

import { useEffect } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import styles from "@/app/landing-award.module.css";

const BASE_RX = 6;
const BASE_RY = -18;

/**
 * The hero's product mockup — the one piece of visual weight this page
 * carries on its own (see design-decisions.md: replaces the design
 * exploration's WebGL orbit diagram, which added no comprehension value
 * over this card). Opaque white card, no backdrop-blur glass — the
 * exploration's glassy translucent treatment would have reintroduced the
 * "excessive glassmorphism" standing rejection this page wasn't granted
 * an exception to. Idle float + mouse parallax composed from one set of
 * motion values (same technique as the shipping HeroMockup.tsx) so a
 * CSS @keyframes animation never fights framer-motion's per-frame writes
 * on the same transform.
 */
export default function HeroMockupAward() {
  const reducedMotion = useReducedMotion();

  const idleY = useMotionValue(0);
  const idleRx = useMotionValue(0);
  const idleRy = useMotionValue(0);
  const mouseRx = useMotionValue(0);
  const mouseRy = useMotionValue(0);
  const springMouseRx = useSpring(mouseRx, { stiffness: 110, damping: 18, mass: 0.6 });
  const springMouseRy = useSpring(mouseRy, { stiffness: 110, damping: 18, mass: 0.6 });

  useAnimationFrame((t) => {
    if (reducedMotion) return;
    const s = t / 1000;
    const cycle = (s / 7) * Math.PI * 2;
    idleY.set(Math.sin(cycle) * -7 - 6);
    idleRx.set(Math.sin(cycle) * -1.2);
    idleRy.set(Math.cos(cycle) * 1.6);
  });

  useEffect(() => {
    if (!reducedMotion) return;
    idleY.set(-6);
  }, [reducedMotion, idleY]);

  const rotateX = useTransform([idleRx, springMouseRx], (v) => BASE_RX + Number(v[0]) + Number(v[1]));
  const rotateY = useTransform([idleRy, springMouseRy], (v) => BASE_RY + Number(v[0]) + Number(v[1]));

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion) return;
    const relY = e.clientY / window.innerHeight - 0.5;
    const relX = e.clientX / window.innerWidth - 0.5;
    mouseRx.set(relY * 8);
    mouseRy.set(relX * -14);
  }
  function handleMouseLeave() {
    mouseRx.set(0);
    mouseRy.set(0);
  }

  return (
    <div className={styles.scene} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <motion.div className={styles.mockupWrap} style={{ rotateX, rotateY, y: idleY, position: "relative" }}>
        {/* Back card — Mike Patel, the deprioritized second lead */}
        <div className={styles.backCard}>
          <div style={{ padding: "13px 15px" }}>
            <div className="flex items-center justify-between">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10.5px] font-bold"
                style={{ background: "var(--card-2)", color: "var(--ink-soft)" }}
              >
                68
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ background: "var(--card-2)", color: "var(--ink-soft)" }}
              >
                Warm
              </span>
            </div>
            <p className="mt-2 text-[12.5px] font-bold" style={{ color: "var(--ink)" }}>
              Mike Patel
            </p>
            <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--ink-faint)" }}>
              Requested a proposal 3 days ago
            </p>
          </div>
        </div>

        {/* Main app window */}
        <div className={styles.appWindow}>
          <div className={styles.titlebar}>
            <div className="flex gap-1.5">
              <span className={styles.trafficDot} style={{ background: "#e0574a" }} />
              <span className={styles.trafficDot} style={{ background: "#e0a83f" }} />
              <span className={styles.trafficDot} style={{ background: "#5fb256" }} />
            </div>
            <p
              className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold"
              style={{ color: "var(--ink-soft)" }}
            >
              FollowUp
            </p>
          </div>

          <div className="flex" style={{ minHeight: 300 }}>
            {/* Sidebar */}
            <div
              className="w-[122px] shrink-0 px-2.5 py-3.5 flex flex-col justify-between"
              style={{ borderRight: "1px solid var(--line)" }}
            >
              <div>
                <div className={`${styles.sideItem} ${styles.sideItemActive}`}>
                  <span>Today</span>
                  <span
                    className="rounded-full px-1.5 text-[9.5px] font-extrabold"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                  >
                    2
                  </span>
                </div>
                <div className={styles.sideItem}>All threads</div>
                <div className={styles.sideItem}>Snoozed</div>
                <div className={styles.sideItem}>Insights</div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ink-soft)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
                Gmail connected
              </div>
            </div>

            {/* Main panel */}
            <div className="flex-1 px-4 py-3.5">
              <p className="text-[11px] font-bold" style={{ color: "var(--ink-soft)" }}>
                Today&apos;s follow-ups
              </p>

              <div className={styles.leadCard} style={{ marginTop: 10 }}>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${styles.pulseDot}`}
                    style={{ background: "var(--accent-soft)", color: "var(--accent-deep)" }}
                  >
                    92
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                        Sarah Johnson
                      </span>
                      <span className="text-[12px] font-bold shrink-0" style={{ color: "var(--ink)" }}>
                        $3,500
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                        ABC Marketing
                      </span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ background: "var(--coral)", color: "#fff" }}
                      >
                        Hot lead
                      </span>
                    </div>
                    <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--ink-soft)" }}>
                      Asked about pricing, opened your proposal twice, no reply in 5 days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating draft card — Sarah's drafted reply */}
        <div className={styles.draftCard}>
          <div className="px-3.5 pt-3.5 pb-3">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${styles.pulseDot}`} style={{ background: "var(--accent)" }} />
              <span className="text-[9px] font-extrabold tracking-wide" style={{ color: "var(--accent-deep)" }}>
                DRAFT READY FOR SARAH
              </span>
            </div>
            <p className="text-[11.5px] font-bold mt-2" style={{ color: "var(--ink)" }}>
              Re: Your proposal
            </p>
            <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Wanted to check in — I know you&apos;ve had a look at the numbers a couple of times.
              Happy to walk through anything that&apos;s unclear…
            </p>
            <div className="flex gap-1.5 mt-2.5">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              >
                Send email
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ border: "1px solid var(--line-strong)", color: "var(--ink-soft)" }}
              >
                Snooze
              </span>
            </div>
          </div>
        </div>

        <div className={styles.groundShadow} />
      </motion.div>
    </div>
  );
}
