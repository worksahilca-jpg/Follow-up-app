import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Replaces the stock Next.js favicon with the real brand mark. Solid
// blue fill (matches --rust in globals.css) rather than a stroke-only icon
// on transparent/white — at 16-32px a thin outline reads as a smudge; a
// filled shape holds up. Can't reference the CSS variable directly —
// Satori renders this to a static PNG with no stylesheet — so this has to
// be kept in sync by hand whenever the theme's accent changes (see the
// same note on src/lib/chart-colors.ts).
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
          backgroundColor: "#3b82c4",
          borderRadius: "7px",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f8f9fb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="#f8f9fb" stroke="none" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
