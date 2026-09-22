"use client";

import { motion } from "framer-motion";
import { Mail, Camera, FileText, Phone, MessageCircle } from "lucide-react";
import styles from "@/app/landing-dark.module.css";
import LogoMark from "@/components/LogoMark";

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

/**
 * `soon` marks a source FollowUp can read but cannot be connected to yet.
 * The phone line is the only one: the voice agent is built and the inbound
 * routes are live, but a North American number has to clear a carrier
 * registration first (see @/lib/pricing CARRIER_CHANNELS_AVAILABLE), so no
 * business can point one here today. Showing it unmarked was a promise —
 * the founder's call on 2026-09-22 was to keep it and label it, not to
 * hide it. The FAQ ("Can it answer my phone?") carries the real answer.
 */
const SOURCES = [
  { title: "New inquiry", via: "via Gmail", Icon: Mail, soon: false },
  { title: "Direct message", via: "via Instagram", Icon: Camera, soon: false },
  { title: "Form submission", via: "via your website", Icon: FileText, soon: false },
  { title: "Missed call", via: "via your phone line", Icon: Phone, soon: true },
  { title: "New message", via: "via WhatsApp", Icon: MessageCircle, soon: false },
];

const REPLIES = [
  { initials: "SJ", name: "Sarah Johnson", text: "Thursday works, see you then.", when: "2 min ago" },
  { initials: "MP", name: "Mike Patel", text: "Yes, send the proposal over.", when: "12 min ago" },
  { initials: "PS", name: "Priya Shah", text: "Tapped “This week” on Instagram", when: "26 min ago" },
  { initials: "DR", name: "Devon Ruiz", text: "Gracias, ¿podemos hablar mañana?", when: "1 hr ago" },
  { initials: "AL", name: "Alex Lin", text: "Booked a call for Friday.", when: "2 hr ago" },
];

function Wires({ side }: { side: "in" | "out" }) {
  const paths = Array.from({ length: N }, (_, i) => {
    const y = centreY(i);
    return side === "in" ? `M0 ${y} C 55 ${y}, 45 ${MID}, 100 ${MID}` : `M0 ${MID} C 55 ${MID}, 45 ${y}, 100 ${y}`;
  });
  return (
    <svg className={styles.wire} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={`l${i}`} id={`wire-${side}-${i}`} d={d} className={styles.wireLine} />
      ))}
      {paths.map((d, i) => (
          <path key={`t${i}`} data-motion-token d="M0 0 h0.01" className={side === "in" ? styles.token : styles.tokenWarm}>
            <animateMotion dur="3.4s" begin={`${i * 0.6 + (side === "out" ? 1.5 : 0)}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1">
              <mpath href={`#wire-${side}-${i}`} />
            </animateMotion>
          </path>
        ))}
    </svg>
  );
}

/**
 * Entrance, on the founder's note ("make this come in from everywhere"):
 * each source card starts far off in its own direction, above, beside,
 * below, slightly turned, and settles into the column; the FollowUp tile
 * lands first; each reply then bursts out of the tile and travels to its
 * place on the right. One pass on mount; the dots keep running after.
 */
const FROM: { x: number; y: number; r: number }[] = [
  { x: -180, y: -190, r: -7 },
  { x: -300, y: -60, r: 5 },
  { x: -240, y: 70, r: -4 },
  { x: -150, y: 200, r: 6 },
  { x: -60, y: 280, r: -5 },
];
const SPRING = { type: "spring", stiffness: 120, damping: 18, mass: 0.9 } as const;

export default function HeroFlow() {
  const fromEverywhere = (i: number) => ({
    initial: { opacity: 0, x: FROM[i].x, y: FROM[i].y, rotate: FROM[i].r, scale: 0.9 },
    animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
    transition: { ...SPRING, delay: 0.35 + i * 0.16, opacity: { duration: 0.4, delay: 0.35 + i * 0.16 } },
  });
  // replies start where the tile is (about 340px to the left of the reply
  // column on desktop, and above it on phones) and travel out
  const outOfTile = (i: number) => ({
    initial: { opacity: 0, x: -340, y: MID - centreY(i), scale: 0.6 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: { ...SPRING, stiffness: 110, delay: 1.7 + i * 0.4, opacity: { duration: 0.35, delay: 1.7 + i * 0.4 } },
  });

  return (
    <div className={styles.flow}>
      <div
        className={styles.flowGrid}
        role="img"
        aria-label="Leads arrive from Gmail, Instagram, your website form, WhatsApp, and — coming soon — your phone line, pass through FollowUp, and answer: Thursday works, send the proposal over, booked a call."
        style={{ ["--flow-h" as string]: `${H}px`, ["--flow-row" as string]: `${ROW}px`, ["--flow-gap" as string]: `${GAP}px` }}
      >
        <div className={styles.flowCol}>
          <div className={styles.flowLabel}>Leads come in from everywhere</div>
          <div className={styles.flowList}>
            {SOURCES.map(({ title, via, Icon, soon }, i) => (
              <motion.div key={title} data-motion className={styles.src} {...fromEverywhere(i)}>
                <span className={styles.srcIcon}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className={styles.srcText}>
                  <span className={styles.srcName}>{title}</span>
                  <span className={styles.srcVia}>{via}</span>
                </span>
                {soon && <span className={`${styles.pill} ${styles.pillMuted} ${styles.srcSoon}`}>Soon</span>}
              </motion.div>
            ))}
          </div>
        </div>

        <div className={styles.flowWires}>
          <Wires side="in" />
        </div>

        <div className={styles.flowHub}>
          <motion.div data-motion className={`${styles.hub} ${styles.hubPulse}`} initial={{ opacity: 0, scale: 0.7, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...SPRING, delay: 0.15 }}>
            <LogoMark height={46} />
          </motion.div>
          <div className={styles.hubName}>FollowUp</div>
          <div className={styles.hubNote}>reads · scores · follows up</div>
        </div>

        <div className={styles.flowWires}>
          <Wires side="out" />
        </div>

        <div className={styles.flowCol}>
          <div className={styles.flowLabel}>and they answer</div>
          <div className={styles.flowList}>
            {REPLIES.map(({ initials, name, text, when }, i) => (
              <motion.div key={name} data-motion className={styles.lead} {...outOfTile(i)}>
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
