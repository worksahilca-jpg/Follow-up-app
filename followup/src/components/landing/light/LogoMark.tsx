/**
 * The FollowUp symbol, inline. Same master geometry as public/brand/
 * followup-symbol.svg (viewBox 0 0 77.7 120): two leaves, leaning
 * parallelograms with the acute corners sharp and the obtuse corners
 * rounded. The upper leaf is the first contact, the smaller lower leaf tucked
 * under it is the follow-through, and the channel between them is the gap
 * FollowUp closes. Monochrome by design; it inherits `currentColor`, so the
 * surface decides whether it is ink on white or white on ink. `height` is
 * the rendered height in px.
 *
 * Built 2026-09-18 from concepts #69 and #71 of the founder's exploration
 * sheet ("I want the logo to be 69 and 71"), which supersedes the earlier
 * F-with-a-stem drawing. See design-brain/decisions/design-decisions.md,
 * 2026-09-18, and public/brand/README.md for clear space and usage.
 */
export default function LogoMark({ height = 22, className }: { height?: number; className?: string }) {
  const width = Math.round((height * 77.7) / 120 * 100) / 100;
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 77.7 120"
      fill="currentColor"
      role="img"
      aria-label="FollowUp"
    >
      <path d="M77.7 0 L74.68 16.75 C70.08 42.32 62.94 51.22 38.99 61.28 L8.31 74.17 L11.33 57.42 C15.93 31.85 23.07 22.94 47.02 12.88 Z" />
      <path d="M41.65 66.03 L37.83 87.27 C35.21 101.85 31.14 106.92 17.49 112.66 L0 120 L3.82 98.76 C6.45 84.19 10.51 79.11 24.17 73.38 Z" />
    </svg>
  );
}
