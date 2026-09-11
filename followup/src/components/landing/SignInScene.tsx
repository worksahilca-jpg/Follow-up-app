"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect } from "react";
import styles from "@/app/landing.module.css";

/**
 * The purely decorative backdrop behind the sign-in card — what makes the
 * page feel like part of the same editorial, 3D-mockup landing system
 * (HeroMockup.tsx) instead of the flat, unstyled screen it used to be.
 * The sign-in card itself never moves (it holds the one thing a visitor
 * has to click precisely); depth and motion live entirely here, behind it:
 * the same aurora-blob wash globals.css already defines, recolored to
 * this page's blue/coral palette, plus two small floating chips on
 * their own Z planes reacting to mouse position — the same idle-float +
 * mouse-parallax technique as HeroMockup, just simpler (no nested content,
 * no counter-parallax layer) since this is chrome, not a hero illustration.
 */
export default function SignInScene() {
  const reducedMotion = useReducedMotion();

  const idleY = useMotionValue(0);
  const mouseRx = useMotionValue(0);
  const mouseRy = useMotionValue(0);
  const springMouseRx = useSpring(mouseRx, { stiffness: 90, damping: 16, mass: 0.6 });
  const springMouseRy = useSpring(mouseRy, { stiffness: 90, damping: 16, mass: 0.6 });

  useAnimationFrame((t) => {
    if (reducedMotion) return;
    const cycle = (t / 1000 / 8) * Math.PI * 2;
    idleY.set(Math.sin(cycle) * -10);
  });

  useEffect(() => {
    if (!reducedMotion) return;
    idleY.set(0);
  }, [reducedMotion, idleY]);

  const rotateX = useTransform(springMouseRx, (v) => v);
  const rotateY = useTransform(springMouseRy, (v) => v);
  // The back chip drifts opposite the front one — two depth planes
  // reacting distinctly to the same mouse move, not one flat sheet.
  const rotateYBack = useTransform(springMouseRy, (v) => v * -0.6);
  const idleYFront = useTransform(idleY, (v) => v * -1);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion) return;
    const relY = e.clientY / window.innerHeight - 0.5;
    const relX = e.clientX / window.innerWidth - 0.5;
    mouseRx.set(relY * 8);
    mouseRy.set(relX * -12);
  }
  function handleMouseLeave() {
    mouseRx.set(0);
    mouseRy.set(0);
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1400 }}
    >
      {/* Aurora wash — same mechanism as AuroraBackground.tsx (dashboard),
          recolored to this page's own palette instead of the app's blue
          --rust/--gold/--sage so the two design systems never mix. Kept
          much fainter than that component's own defaults (opacity here,
          on top of the class's own 0.5): the landing page's hero carries
          its depth through the mockup illustration and grid texture alone
          with no color wash at all, so full-strength blobs behind a small
          sign-in card would read louder than the system they're matching. */}
      <div className="aurora-blob aurora-blob-a" style={{ top: "6%", left: "2%", width: "34%", height: "42%", backgroundColor: "var(--amber)", opacity: 0.28 }} />
      <div className="aurora-blob aurora-blob-b" style={{ bottom: "4%", right: "0%", width: "32%", height: "40%", backgroundColor: "var(--blue)", opacity: 0.24 }} />

      {/* Back chip — pushed behind on Z, drifts opposite the front one.
          Hidden below sm: at narrow widths its percentage position lands
          right under the brand mark in the header, overlapping it — these
          two chips only have room to breathe once the card has real
          margin around it. */}
      <motion.div
        className={`hidden sm:block ${styles.signinChip}`}
        style={{
          top: "30%",
          left: "14%",
          width: 168,
          padding: "12px 14px",
          y: idleY,
          rotateX,
          rotateY: rotateYBack,
          translateZ: -60,
          opacity: 0.85,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--amber-soft)", color: "#1e3a8a" }}>
            92
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold truncate" style={{ color: "var(--ink)" }}>
              Sarah Johnson
            </p>
            <p className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
              Hot lead
            </p>
          </div>
        </div>
      </motion.div>

      {/* Front chip — pulled forward on Z, drifts with the mouse. Same
          narrow-viewport hiding as the back chip above. */}
      <motion.div
        className={`hidden sm:block ${styles.signinChip}`}
        style={{
          bottom: "22%",
          right: "10%",
          width: 190,
          padding: "12px 14px",
          y: idleYFront,
          rotateX,
          rotateY,
          translateZ: 40,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${styles.pulseDot}`} style={{ background: "var(--amber)" }} />
          <span className="text-[9px] font-bold tracking-wide" style={{ color: "var(--amber)" }}>
            DRAFT READY
          </span>
        </div>
        <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--ink)" }}>
          &ldquo;Following up on your question about&hellip;&rdquo;
        </p>
      </motion.div>
    </div>
  );
}
