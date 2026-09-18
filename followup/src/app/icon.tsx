import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The favicon: the FollowUp symbol (public/brand/followup-favicon.svg — the
// master geometry with wider channels for very small rendering), white on
// the brand's primary dark, #111312. Monochrome by design; no accent colour
// here, so a theme change never leaves the tab icon stale the way the old
// blue one went stale twice. Satori renders this to a static PNG with no
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
        <svg width="16" height="19" viewBox="0 0 98.4 120" fill="#ffffff">
          <path d="M14.4 0 98.4 0 88.28 26 35.28 26 24.0 120 0.0 120Z" />
          <path d="M52.88 46 92.88 46 77.08 86 48.08 86Z" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
