import { Bricolage_Grotesque, Public_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

// The app-wide typeface trio — Bricolage Grotesque (display/headings),
// Public Sans (body), IBM Plex Mono (eyebrows/labels/mono meta text).
// Originally a page-scoped exception for the landing page's "Award
// Direction" system only (see design-brain/decisions/design-decisions.md
// D-008); promoted to the whole product in D-010/A-002, 2026-09-13, when
// the authenticated app and /signin moved to match the landing page's
// navy/blue system rather than the other way around. Loaded once here via
// next/font/google (not a <link> tag) so every consumer — the root layout,
// the landing page's own scoped wrapper — shares one font-face instead of
// a near-duplicate per surface.
//
// Plus Jakarta Sans (the previous app-wide typeface, and before that Space
// Grotesk + Inter) has been retired — no page imports it anymore.
export const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["500", "600", "700", "800"],
});

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
