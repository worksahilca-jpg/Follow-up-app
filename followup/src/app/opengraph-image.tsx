import { ImageResponse } from "next/og";

export const alt = "FollowUp — Never lose a lead because you forgot to follow up.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card a link to followupbase.io shows on WhatsApp, iMessage, Slack,
// LinkedIn. Rendered via Satori, which needs display:flex on every
// container (no block layout). Same charcoal ground, white ink and grey
// secondary as the landing page's dark theme (landing-dark.module.css) —
// a share card is seen next to other people's, so it always shows the
// brand's own ground rather than following a device theme. The mark is
// the two-leaf symbol from public/brand/followup-symbol.svg, same path
// data as components/landing/light/LogoMark.tsx.
// Satori draws with whatever fonts it is handed; with none, headings come
// out in a thin default face. Public Sans is fetched from Google Fonts at
// build time (this route is prerendered) and handed to Satori; if the fetch
// fails the image still renders, just in the default face.
async function loadPublicSans(weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    // No browser user-agent on purpose: Google then serves a TrueType file,
    // which Satori can read (it cannot read woff2).
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Public+Sans:wght@${weight}`, {
      headers: { "User-Agent": "curl/8" },
    }).then((r) => r.text());
    const url = css.match(/src: url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [bold, regular] = await Promise.all([loadPublicSans(700), loadPublicSans(400)]);
  const fonts = [
    bold ? { name: "Public Sans", data: bold, weight: 700 as const, style: "normal" as const } : null,
    regular ? { name: "Public Sans", data: regular, weight: 400 as const, style: "normal" as const } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

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
          backgroundColor: "#1e1e20",
          color: "#ffffff",
          fontFamily: "Public Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <svg width="28" height="43" viewBox="0 0 77.7 120" fill="#ffffff">
            <path d="M77.7 0 L74.68 16.75 C70.08 42.32 62.94 51.22 38.99 61.28 L8.31 74.17 L11.33 57.42 C15.93 31.85 23.07 22.94 47.02 12.88 Z" />
            <path d="M41.65 66.03 L37.83 87.27 C35.21 101.85 31.14 106.92 17.49 112.66 L0 120 L3.82 98.76 C6.45 84.19 10.51 79.11 24.17 73.38 Z" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>FollowUp</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "980px" }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
            }}
          >
            Never lose a lead because you forgot to follow up.
          </span>
          <span style={{ fontSize: 28, color: "#9ca3af", marginTop: "28px", lineHeight: 1.4 }}>
            Only for owners who have leads and don&apos;t have time to reply.
          </span>
        </div>
      </div>
    ),
    // An empty fonts list would override next/og's default face and fail
    // the render; only pass it when at least one font loaded.
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) }
  );
}
