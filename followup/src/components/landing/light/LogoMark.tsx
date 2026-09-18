/**
 * The FollowUp symbol, inline. Same master geometry as public/brand/
 * followup-symbol.svg (viewBox 0 0 100.8 120): two forward-leaning forms
 * that read as an abstract F, separated by the channel that stands for the
 * moment between first contact and the follow-up. Monochrome by design; it
 * inherits `currentColor`, so the surface decides whether it is ink on
 * white or white on ink. `height` is the rendered height in px.
 *
 * Built 2026-09-18 from the founder's logo brief (concepts #69 / #71),
 * which supersedes the earlier chevron direction (A-008). See
 * design-brain/decisions/design-decisions.md, 2026-09-18, and
 * public/brand/README.md for the clear-space and usage rules.
 */
export default function LogoMark({ height = 22, className }: { height?: number; className?: string }) {
  const width = Math.round((height * 100.8) / 120 * 100) / 100;
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 100.8 120"
      fill="currentColor"
      role="img"
      aria-label="FollowUp"
    >
      <path d="M16.8 0 100.8 0 89.44 24 35.44 24 22 120 0 120Z" />
      <path d="M49.2 40 95.2 40 77.6 80 43.6 80Z" />
    </svg>
  );
}
