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
        <svg width="14" height="21" viewBox="0 0 79.52 120" fill="#ffffff">
          <path d="M79.52 0 L74.07 30.28 C71.97 41.97 65.24 50.36 54.29 54.96 L14.9 71.5 L20.35 41.23 C22.45 29.54 29.18 21.14 40.13 16.55 Z" />
          <path d="M46.53 68.52 L42.61 90.32 C41.09 98.73 36.25 104.78 28.36 108.09 L0 120 L3.92 98.2 C5.44 89.78 10.28 83.74 18.17 80.43 Z" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
