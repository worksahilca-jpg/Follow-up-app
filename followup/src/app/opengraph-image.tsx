import { ImageResponse } from "next/og";

export const alt = "FollowUp — Never lose a lead because you forgot to follow up.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rendered via Satori, which requires every container to explicitly set
// display:flex (there's no block layout) — matches the same tokens/colors
// as the real light theme (src/app/globals.css) rather than reinventing a
// palette just for this image.
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#18181b", letterSpacing: "-0.02em" }}>
            FollowUp
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "920px" }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#18181b",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
            }}
          >
            Never lose a lead because you forgot to follow up.
          </span>
          <span style={{ fontSize: 26, color: "#71717a", marginTop: "28px", lineHeight: 1.4 }}>
            The AI teammate that tells you exactly who to contact today, why, and what to say.
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
