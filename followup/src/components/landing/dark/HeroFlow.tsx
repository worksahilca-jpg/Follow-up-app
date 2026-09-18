"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Mail, Inbox, Camera, MessageSquare, MessageCircle } from "lucide-react";
import styles from "@/app/landing-dark.module.css";
import LogoMark from "@/components/landing/light/LogoMark";

/**
 * The hero illustration, replacing the app-dashboard card the founder turned
 * down twice (R-005, R-009). It draws what FollowUp does, not what it looks
 * like: leads arrive from the channels on the left, pass through FollowUp in
 * the middle, and come out on the right warmed up, each with the plain-words
 * state it reached. The dots travel the wires on a loop; the warmth bars fill
 * once. Names and states are an example week, not customers.
 *
 * Geometry: both side columns are five rows of ROW px with GAP px between,
 * so each wire SVG is a fixed-height box (H) and the row centres are known.
 * The wires stretch horizontally (preserveAspectRatio none); the dots are
 * zero-length round-capped strokes with non-scaling-stroke, so they stay
 * round however the box is stretched.
 */
const ROW = 56;
const GAP = 12;
const N = 5;
const H = ROW * N + GAP * (N - 1);
const centreY = (i: number) => ROW / 2 + i * (ROW + GAP);
const MID = H / 2;

const SOURCES = [
  { name: "Gmail", note: "3 new", Icon: Mail },
  { name: "Outlook", note: "1 new", Icon: Inbox },
  { name: "Instagram", note: "4 DMs", Icon: Camera },
  { name: "Messenger", note: "2 DMs", Icon: MessageSquare },
  { name: "WhatsApp", note: "2 new", Icon: MessageCircle },
];

const LEADS = [
  { initials: "SJ", name: "Sarah Johnson", state: "Replied · wants Thursday", warmth: 1 },
  { initials: "MP", name: "Mike Patel", state: "Follow-up sent, on topic", warmth: 0.72 },
  { initials: "PS", name: "Priya Shah", state: "Tapped “This week” on Instagram", warmth: 0.86 },
  { initials: "DR", name: "Devon Ruiz", state: "Acknowledged in Spanish", warmth: 0.5 },
  { initials: "AL", name: "Alex Lin", state: "Booked a call", warmth: 1 },
];

function Wires({ side, animate }: { side: "in" | "out"; animate: boolean }) {
  // "in": five rows on the left converge on the hub at the right edge.
  // "out": the hub at the left edge fans out to five rows on the right.
  const paths = Array.from({ length: N }, (_, i) => {
    const y = centreY(i);
    return side === "in" ? `M0 ${y} C 55 ${y}, 45 ${MID}, 100 ${MID}` : `M0 ${MID} C 55 ${MID}, 45 ${y}, 100 ${y}`;
  });
  return (
    <svg className={styles.wire} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={`l${i}`} id={`wire-${side}-${i}`} d={d} className={styles.wireLine} />
      ))}
      {animate &&
        paths.map((d, i) => (
          <path key={`t${i}`} d="M0 0 h0.01" className={side === "in" ? styles.token : styles.tokenWarm}>
            <animateMotion dur="3.2s" begin={`${i * 0.55 + (side === "out" ? 1.4 : 0)}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1">
              <mpath href={`#wire-${side}-${i}`} />
            </animateMotion>
          </path>
        ))}
    </svg>
  );
}

export default function HeroFlow() {
  const reduced = useReducedMotion();
  const animate = !reduced;
  const anim = reduced
    ? {}
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay: 0.35 } };

  return (
    <motion.div className={styles.flow} {...anim}>
      <div
        className={styles.flowGrid}
        role="img"
        aria-label="Leads from Gmail, Outlook, Instagram, Messenger and WhatsApp flow into FollowUp and come out followed up: replied, booked, or acknowledged in their language."
        style={{ ["--flow-h" as string]: `${H}px`, ["--flow-row" as string]: `${ROW}px`, ["--flow-gap" as string]: `${GAP}px` }}
      >
        <div className={styles.flowCol}>
          <div className={styles.flowLabel}>Leads come in from</div>
          <div className={styles.flowList}>
            {SOURCES.map(({ name, note, Icon }) => (
              <div key={name} className={styles.src}>
                <span className={styles.srcIcon}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className={styles.srcName}>{name}</span>
                <span className={styles.srcNote}>{note}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.flowWires}>
          <Wires side="in" animate={animate} />
        </div>

        <div className={styles.flowHub}>
          <div className={`${styles.hub} ${animate ? styles.hubPulse : ""}`}>
            <LogoMark height={40} />
          </div>
          <div className={styles.hubName}>FollowUp</div>
          <div className={styles.hubNote}>catches · scores · follows up</div>
        </div>

        <div className={styles.flowWires}>
          <Wires side="out" animate={animate} />
        </div>

        <div className={styles.flowCol}>
          <div className={styles.flowLabel}>and come out warm</div>
          <div className={styles.flowList}>
            {LEADS.map(({ initials, name, state, warmth }, i) => (
              <div key={name} className={styles.lead}>
                <span className={styles.avatar}>{initials}</span>
                <span className={styles.leadText}>
                  <span className={styles.leadName}>{name}</span>
                  <span className={styles.leadState}>{state}</span>
                </span>
                <span className={styles.warm} aria-hidden="true">
                  <span className={styles.warmFill} style={{ ["--w" as string]: `${warmth * 100}%`, ["--d" as string]: `${1.6 + i * 0.55}s` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
