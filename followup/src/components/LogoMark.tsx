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
 *
 * It lived at `landing/light/LogoMark` until 2026-09-20, and that path is
 * most of why this is being written: it read as a landing-page asset, so
 * the authenticated app never used it. The sidebar, onboarding, the
 * booking page, the embed widget, Terms and Privacy all drew lucide's
 * `Compass` instead — a stock icon, in the accent blue, on every screen
 * the owner sees daily and on two that their own customers see. The
 * founder's words: "logos are different everywhere."
 *
 * There is one logo. It lives here, at the top level, because every
 * surface uses it.
 *
 * Colour comes from `currentColor` and the brand is monochrome — ink on
 * light, white on dark, and per public/brand/README.md no blue, no
 * gradient, no shadow. Do not pass it an accent colour.
 */
/**
 * Below 24px the master geometry's channel — 4.5% of the height — is under
 * a pixel and closes, and the channel is the one part of this mark that
 * public/brand/README.md says must never close: "at any size the gap stays
 * visible." So small sizes get the wider-channel drawing, the same one
 * src/app/icon.tsx renders into the favicon, chosen automatically rather
 * than left to each caller to remember.
 */
const SMALL_SIZE_PX = 24;

const MASTER = {
  viewBox: "0 0 77.7 120",
  ratio: 77.7 / 120,
  paths: [
    "M77.7 0 L74.68 16.75 C70.08 42.32 62.94 51.22 38.99 61.28 L8.31 74.17 L11.33 57.42 C15.93 31.85 23.07 22.94 47.02 12.88 Z",
    "M41.65 66.03 L37.83 87.27 C35.21 101.85 31.14 106.92 17.49 112.66 L0 120 L3.82 98.76 C6.45 84.19 10.51 79.11 24.17 73.38 Z",
  ],
};

const SMALL = {
  viewBox: "0 0 76.77 120",
  ratio: 76.77 / 120,
  paths: [
    "M76.77 0 L73.12 20.29 C69.27 41.68 63.3 49.13 43.26 57.55 L9.78 71.61 L13.43 51.32 C17.29 29.93 23.26 22.48 43.3 14.06 Z",
    "M41.97 67.16 L38 89.21 C35.69 102.04 32.11 106.51 20.08 111.56 L0 120 L3.97 97.95 C6.28 85.12 9.86 80.64 21.89 75.59 Z",
  ],
};

export default function LogoMark({ height = 22, className }: { height?: number; className?: string }) {
  const art = height < SMALL_SIZE_PX ? SMALL : MASTER;
  const width = Math.round(height * art.ratio * 100) / 100;
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={art.viewBox}
      fill="currentColor"
      role="img"
      aria-label="FollowUp"
    >
      {art.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
