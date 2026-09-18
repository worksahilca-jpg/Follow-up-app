import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The favicon: the FollowUp symbol (public/brand/followup-favicon.svg — the
// two-leaf master geometry with a wider channel for very small rendering),
// white on the brand's primary dark, #111312. Monochrome by design; no accent
// colour here, so a theme change never leaves the tab icon stale the way the
// old blue one went stale twice. Satori renders this to a static PNG with no
// stylesheet, hence the literal colours.
export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111312",
          borderRadius: "7px",
        }}
      >
        <svg width="14" height="22" viewBox="0 0 76.77 120" fill="#ffffff">
          <path d="M76.77 0 L73.12 20.29 C69.27 41.68 63.3 49.13 43.26 57.55 L9.78 71.61 L13.43 51.32 C17.29 29.93 23.26 22.48 43.3 14.06 Z" />
          <path d="M41.97 67.16 L38 89.21 C35.69 102.04 32.11 106.51 20.08 111.56 L0 120 L3.97 97.95 C6.28 85.12 9.86 80.64 21.89 75.59 Z" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
