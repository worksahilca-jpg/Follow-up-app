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
import { Mail, MessageSquare, Phone } from "lucide-react";
import styles from "@/app/landing.module.css";

const BASE_RX = 6;
const BASE_RY = -22;

const LEADS = [
  {
    name: "Priya Nair",
    dot: "var(--amber)",
    meta: "6d quiet · opened ×2",
    note: "Proposal sent, no reply. Point at the spring launch deadline.",
    Icon: Mail,
  },
  {
    name: "Ben Holt",
    dot: "var(--coral)",
    meta: "4d · on you",
    note: "You promised a revised quote. It's Tuesday.",
    Icon: Phone,
  },
  {
    name: "Dana Okafor",
    dot: "var(--blue)",
    meta: "13d quiet",
    note: "Ask about the partner, not the proposal.",
    Icon: MessageSquare,
  },
];

/**
 * The hero's 3D CSS scene. Idle float and mouse parallax are composed
 * from the SAME set of motion values (see the useTransform combinators
 * below) rather than layering a CSS @keyframes animation under a
 * framer-motion transform — two systems both writing `transform` on one
 * element every frame would fight instead of compose. One
 * useAnimationFrame loop drives a slow sine-wave idle drift; mouse
 * position adds a spring-smoothed offset on top, so a mouse move nudges
 * the scene without ever snapping out of its own floating rhythm.
 */
export default function HeroMockup() {
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
    idleY.set(Math.sin(cycle) * -8 - 8);
    idleRx.set(Math.sin(cycle) * -1.2);
    idleRy.set(Math.cos(cycle) * 1.8);
  });

  useEffect(() => {
    if (!reducedMotion) return;
    idleY.set(-8);
  }, [reducedMotion, idleY]);

  const y = idleY;
  const rotateX = useTransform([idleRx, springMouseRx], (v) => BASE_RX + Number(v[0]) + Number(v[1]));
  const rotateY = useTransform([idleRy, springMouseRy], (v) => BASE_RY + Number(v[0]) + Number(v[1]));
  // The draft/context cards lean a touch opposite the main window's tilt
  // — separate depth planes reacting distinctly, not one flat sheet.
  const cardCounter = useTransform(springMouseRy, (v) => Number(v) * -0.7);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion) return;
    const relY = e.clientY / window.innerHeight - 0.5;
    const relX = e.clientX / window.innerWidth - 0.5;
    mouseRx.set(relY * 10);
    mouseRy.set(relX * -16);
  }
  function handleMouseLeave() {
    mouseRx.set(0);
    mouseRy.set(0);
  }

  return (
    <div className={styles.scene} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <motion.div className={styles.mockupWrap} style={{ rotateX, rotateY, y, position: "relative" }}>
        {/* Back context card — pushed behind on Z. The static 3D placement
            (translateZ/rotateX/rotateY) stays on this outer div's CSS
            class; the dynamic counter-parallax offset lives on the inner
            motion.div as its own nested transform, so the two never
            overwrite the same `transform` property. */}
        <div className={styles.backCard}>
          <motion.div style={{ padding: "14px 16px", x: cardCounter }}>
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "rgba(24,20,15,0.06)", color: "var(--ink-soft)" }}
            >
              16 days quiet
            </span>
            <p className="mt-2 text-sm font-bold" style={{ color: "var(--ink)" }}>
              Leila Haddad
            </p>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              Haddad Law
            </p>
            <p className="mt-2 text-xs font-semibold" style={{ color: "var(--amber)" }}>
              Watch this week →
            </p>
          </motion.div>
        </div>

        {/* Main app window */}
        <div className={styles.appWindow}>
          <div className={styles.sheen} />
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
              FollowUp · Daily Brief
            </p>
          </div>

          <div className="flex" style={{ minHeight: 340 }}>
            {/* Sidebar */}
            <div
              className="w-[132px] shrink-0 px-3 py-4 flex flex-col justify-between"
              style={{ borderRight: "1px solid rgba(24,20,15,0.07)" }}
            >
              <div className="space-y-0.5 text-[12px]">
                <SideItem label="Today" badge="5" active />
                <SideItem label="All threads" />
                <SideItem label="Snoozed" />
                <SideItem label="Insights" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] mb-3" style={{ color: "var(--ink-soft)" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#5fb256" }} />
                  Gmail connected
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative h-5 w-5 rounded-full" style={{ background: "rgba(24,20,15,0.1)" }}>
                    <span
                      className="absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full border border-white"
                      style={{ background: "#5fb256" }}
                    />
                  </span>
                  <span className="text-[11px] font-medium">Sahil</span>
                </div>
              </div>
            </div>

            {/* Main panel */}
            <div className="flex-1 px-4 py-4">
              <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Tuesday, Sep 8 — Good morning
              </p>
              <p className="text-[15px] font-extrabold mt-1 leading-snug" style={{ color: "var(--ink)" }}>
                <span style={{ color: "var(--amber)" }}>5 conversations</span> need attention
              </p>
              <div
                className="mt-2.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                style={{ background: "var(--amber-soft)", color: "#96631c" }}
              >
                2 people haven&apos;t heard from you in 6+ days
              </div>

              <div className="mt-3 space-y-2">
                {LEADS.map((lead) => (
                  <div
                    key={lead.name}
                    className={styles.leadCard}
                    style={{
                      borderLeftColor: lead.dot,
                      background: "rgba(24,20,15,0.02)",
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${styles.pulseDot}`} style={{ background: lead.dot }} />
                        <span className="text-[12px] font-bold" style={{ color: "var(--ink)" }}>
                          {lead.name}
                        </span>
                      </div>
                      <lead.Icon className="h-3 w-3" style={{ color: "var(--ink-faint)" }} />
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                      {lead.meta}
                    </p>
                    <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--ink)" }}>
                      {lead.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating draft card — pulled forward on Z via the outer div's
            static CSS transform, its own independent float rhythm via
            CSS margin-top (a different property, so it coexists fine
            with the static transform), and the dynamic counter-parallax
            offset isolated to the inner motion.div — same
            static/dynamic split as the back card above. */}
        <div className={styles.draftCard}>
          <motion.div className="px-3.5 pt-3.5 pb-3" style={{ x: cardCounter }}>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${styles.pulseDot}`} style={{ background: "var(--amber)" }} />
              <span className="text-[9px] font-bold tracking-wide" style={{ color: "var(--amber)" }}>
                DRAFT READY FOR PRIYA
              </span>
            </div>
            <p className="text-[11px] font-bold mt-2" style={{ color: "var(--ink)" }}>
              Re: Brand video — spring launch
            </p>
            <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Wanted to check in on the proposal — if the{" "}
              <span style={{ color: "var(--amber)", fontWeight: 600 }}>spring launch</span> is still the
              target, we&apos;d need…
            </p>
            <div className="flex gap-1.5 mt-2.5">
              <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "var(--ink)", color: "#f3f0ea" }}>
                Send now
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ border: "1px solid rgba(24,20,15,0.15)", color: "var(--ink-soft)" }}
              >
                Edit
              </span>
            </div>
          </motion.div>
        </div>

        <div className={styles.groundShadow} />
      </motion.div>
    </div>
  );
}

function SideItem({ label, badge, active }: { label: string; badge?: string; active?: boolean }) {
  return (
    <div
      className="flex items-center justify-between rounded-md px-2 py-1.5"
      style={{
        background: active ? "rgba(232,162,58,0.16)" : "transparent",
        color: active ? "#96631c" : "var(--ink-soft)",
        fontWeight: active ? 700 : 500,
      }}
    >
      <span>{label}</span>
      {badge && (
        <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: "var(--amber)", color: "#fff" }}>
          {badge}
        </span>
      )}
    </div>
  );
}
