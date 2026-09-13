import styles from "@/app/landing-award.module.css";

const CHANNELS = ["Gmail", "Outlook", "Twilio", "Instagram", "WhatsApp"];
const ORBIT_SECONDS = 25;

/**
 * The hero's orbit diagram — channels circling a glowing core, sitting
 * behind HeroMockupAward rather than replacing it. Cut in the original
 * D-008 pass (see landing-award.module.css's header comment) as a
 * several-hundred-line WebGL/fallback machine that duplicated what the
 * mockup already showed; reinstated at the CEO's explicit request on the
 * same day (D-009) as a plain CSS composition instead — no WebGL, no
 * canvas, no new dependency.
 *
 * Each node rides `offset-path` around a flattened ellipse (standing in
 * for a tilted circle) with `offset-rotate: 0deg`, so labels stay upright
 * at every point on the path by construction — a real `perspective` +
 * `rotateX` ring needs each node to counter-rotate against both the
 * ring's tilt and its own position, which is exactly what went wrong the
 * first time this was built (labels went edge-on/skewed). Depth comes
 * from a second, same-duration animation scaling/fading each node —
 * biggest and brightest near the ellipse's bottom edge, smallest and
 * dimmest near the top, standing in for "near" vs. "far" on a tilted
 * ring. Five evenly-spaced negative `animation-delay`s spread the nodes
 * around the path without needing five separate keyframe sets.
 *
 * No per-channel "facts" invented for the labels — the exploration's
 * unvetted copy ("Reads live, replies drafted in seconds") was exactly
 * what D-008 flagged as copy no one asked for. Desktop-only (see the
 * stylesheet) — there's no room for a ring around the mockup once the
 * hero stacks to one column. `aria-hidden` because this repeats
 * information the page already states as text twice (the pill row below
 * it, the channel list in the copy), not a second source of it.
 */
export default function OrbitDiagramAward() {
  return (
    <div className={styles.orbitScene} aria-hidden="true">
      <div className={styles.orbitPath} />
      <div className={styles.orbitCore} />
      {CHANNELS.map((name, i) => {
        const delay = -((ORBIT_SECONDS / CHANNELS.length) * i);
        const rest = `${(100 / CHANNELS.length) * i}%`;
        return (
          <div
            key={name}
            className={styles.orbitNode}
            style={{ animationDelay: `${delay}s`, "--rest": rest } as React.CSSProperties}
          >
            <span className={styles.orbitNodeLabel}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}
