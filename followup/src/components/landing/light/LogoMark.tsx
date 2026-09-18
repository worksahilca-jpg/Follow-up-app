import styles from "@/app/landing-light.module.css";

/**
 * The forward chevron — the logo direction the founder chose on 2026-09-18
 * (design-brain/decisions/approved.md A-008). A first drawing, not the final
 * mark: single stroke, rounded joins, sitting in a dark rounded square so it
 * reads at 16px. Wordmark pairing, exact stroke weight and the app-icon crop
 * are the next round and are deliberately not decided here.
 */
export default function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span className={styles.mark} style={{ width: size, height: size, borderRadius: Math.round(size * 0.31) }} aria-hidden="true">
      <svg width={Math.round(size * 0.54)} height={Math.round(size * 0.54)} viewBox="0 0 24 24" fill="none">
        <path d="M8 4.5 L15.5 12 L8 19.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
