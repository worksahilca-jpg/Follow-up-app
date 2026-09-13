import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Replaces the stock Next.js favicon with the real brand mark. Solid
// blue fill (matches --rust in globals.css) rather than a stroke-only icon
// on transparent/white — at 16-32px a thin outline reads as a smudge; a
// filled shape holds up. Can't reference the CSS variable directly —
// Satori renders this to a static PNG with no stylesheet — so this has to
// be kept in sync by hand whenever the theme's accent changes (see the
// same note on src/lib/chart-colors.ts). Updated 2026-09-13 alongside
// D-010/A-002's navy/blue reskin — #3b82c4 was already stale (a leftover
// from an even earlier blue period, never updated when the accent moved
// to amber); now matches the real --rust value, #2a5cdb.
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
          backgroundColor: "#2a5cdb",
          borderRadius: "7px",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f6f8fb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#f6f8fb" stroke="none" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
