/**
 * The FollowUp symbol, inline. Same master geometry as public/brand/
 * followup-symbol.svg (viewBox 0 0 81.79 120): two leaves, leaning
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
  const width = Math.round((height * 81.79) / 120 * 100) / 100;
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 81.79 120"
      fill="currentColor"
      role="img"
      aria-label="FollowUp"
    >
      <path d="M81.79 0 L77.02 26.51 C74.21 42.13 65.22 53.34 50.59 59.48 L14.22 74.76 L19 48.25 C21.81 32.63 30.79 21.42 45.42 15.28 Z" />
      <path d="M47.3 67.67 L43.96 86.23 C41.99 97.16 35.7 105.01 25.46 109.31 L0 120 L3.34 101.44 C5.31 90.51 11.6 82.66 21.84 78.36 Z" />
    </svg>
  );
}
