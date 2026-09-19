import { Public_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

// The app-wide typefaces — Public Sans (headings and body, headings set
// tighter and heavier) and IBM Plex Mono (eyebrows/labels/mono meta text).
// Loaded once here via next/font/google (not a <link> tag) so every
// consumer — the root layout, the landing page's own scoped wrapper —
// shares one font-face instead of a near-duplicate per surface.
//
// Bricolage Grotesque (the navy era's display face, D-010/A-002) was
// retired on 2026-09-19 when the app moved onto the landing page's
// charcoal monochrome system, which sets its headings in Public Sans.
// Plus Jakarta Sans, Space Grotesk and Inter were retired before that.
export const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  weight: ["400", "500", "600", "700"],
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

// Instrument Serif, italic only, used for exactly one emphasised word in a
// marketing headline ("…the one that *went quiet.*") — never for body text,
// never inside the authenticated app's data views. Added 2026-09-18 with the
// founder's explicit yes ("Yes, add it") as part of the light-direction
// landing page; see design-brain/decisions/design-decisions.md, 2026-09-18.
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["italic"],
  variable: "--font-instrument-serif",
});
