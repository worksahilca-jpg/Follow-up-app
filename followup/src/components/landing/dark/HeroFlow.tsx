"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Mail, Camera, FileText, Phone, MessageCircle } from "lucide-react";
import styles from "@/app/landing-dark.module.css";
import LogoMark from "@/components/landing/light/LogoMark";

/**
 * The hero's moving diagram, full width behind the title (founder,
 * 2026-09-18: "an animated model in the background: leads come in from
 * everywhere, FollowUp in the middle, and FollowUp is doing its job"). The
 * idea he pointed at, not the picture: on the left, the ways a lead shows up;
 * in the middle, FollowUp; on the right, the lead answering. The dots on the
 * wires are the leads arriving; the reply cards slide in one by one as
 * FollowUp's follow-ups land. Names and replies are an example week, not
 * customers. Reduced motion: everything in its final state, nothing moves.
 *
 * Geometry: both side columns are N rows of ROW px with GAP px between, so
 * each wire SVG is a fixed-height box (H) with known row centres. The wires
 * stretch horizontally (preserveAspectRatio none); the dots are zero-length
 * round-capped strokes with non-scaling-stroke, so they stay round.
 */
const ROW = 62;
const GAP = 14;
const N = 5;
const H = ROW * N + GAP * (N - 1);
const centreY = (i: number) => ROW / 2 + i * (ROW + GAP);
const MID = H / 2;

const SOURCES = [
  { title: "New inquiry", via: "via Gmail", Icon: Mail },
  { title: "Direct message", via: "via Instagram", Icon: Camera },
  { title: "Form submission", via: "via your website", Icon: FileText },
  { title: "Missed call", via: "via your phone line", Icon: Phone },
  { title: "New message", via: "via WhatsApp", Icon: MessageCircle },
];

const REPLIES = [
  { initials: "SJ", name: "Sarah Johnson", text: "Thursday works, see you then.", when: "2 min ago" },
  { initials: "MP", name: "Mike Patel", text: "Yes, send the proposal over.", when: "12 min ago" },
  { initials: "PS", name: "Priya Shah", text: "Tapped “This week” on Instagram", when: "26 min ago" },
  { initials: "DR", name: "Devon Ruiz", text: "Gracias, ¿podemos hablar mañana?", when: "1 hr ago" },
  { initials: "AL", name: "Alex Lin", text: "Booked a call for Friday.", when: "2 hr ago" },
];

function Wires({ side, animate }: { side: "in" | "out"; animate: boolean }) {
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
            <animateMotion dur="3.4s" begin={`${i * 0.6 + (side === "out" ? 1.5 : 0)}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1">
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
  const enter = (delay: number, x = 0) =>
    reduced ? {} : { initial: { opacity: 0, x, y: 6 }, animate: { opacity: 1, x: 0, y: 0 }, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const, delay } };

  return (
    <div className={styles.flow}>
      <div
        className={styles.flowGrid}
        role="img"
        aria-label="Leads arrive from Gmail, Instagram, your website form, your phone line and WhatsApp, pass through FollowUp, and answer: Thursday works, send the proposal over, booked a call."
        style={{ ["--flow-h" as string]: `${H}px`, ["--flow-row" as string]: `${ROW}px`, ["--flow-gap" as string]: `${GAP}px` }}
      >
        <div className={styles.flowCol}>
          <div className={styles.flowLabel}>Leads come in from everywhere</div>
          <div className={styles.flowList}>
            {SOURCES.map(({ title, via, Icon }, i) => (
              <motion.div key={title} className={styles.src} {...enter(0.5 + i * 0.12, -12)}>
                <span className={styles.srcIcon}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className={styles.srcText}>
                  <span className={styles.srcName}>{title}</span>
                  <span className={styles.srcVia}>{via}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className={styles.flowWires}>
          <Wires side="in" animate={animate} />
        </div>

        <div className={styles.flowHub}>
          <motion.div className={`${styles.hub} ${animate ? styles.hubPulse : ""}`} {...(reduced ? {} : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const, delay: 0.35 } })}>
            <LogoMark height={46} />
          </motion.div>
          <div className={styles.hubName}>FollowUp</div>
          <div className={styles.hubNote}>reads · scores · follows up</div>
        </div>

        <div className={styles.flowWires}>
          <Wires side="out" animate={animate} />
        </div>

        <div className={styles.flowCol}>
          <div className={styles.flowLabel}>and they answer</div>
          <div className={styles.flowList}>
            {REPLIES.map(({ initials, name, text, when }, i) => (
              <motion.div key={name} className={styles.lead} {...enter(1.6 + i * 0.5, 14)}>
                <span className={styles.avatar}>{initials}</span>
                <span className={styles.leadText}>
                  <span className={styles.leadName}>
                    {name}
                    <span className={styles.leadWhen}>{when}</span>
                  </span>
                  <span className={styles.leadState}>{text}</span>
                </span>
                <span className={styles.leadDot} aria-hidden="true" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
