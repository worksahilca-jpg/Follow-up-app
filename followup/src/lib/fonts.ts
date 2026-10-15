import { Public_Sans, IBM_Plex_Mono, Instrument_Serif, Newsreader } from "next/font/google";

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
  // 300 for the landing page's headings (the canvas system, R-019 / A-022:
  // "plain thin headline"). Same family, one more weight.
  weight: ["300", "400", "500", "600", "700"],
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

// Newsreader, for the words you read in the app: the customer's message and
// the reply (A-258). Added 2026-10-15 with the founder's yes ("yes b is
// good") after a drawing of Today in three faces. Titles keep FU Display
// (A-221); buttons, labels and everything else stay Public Sans. Used through
// Tailwind's `font-read`.
//
// One static weight (messages are never bold): the variable file with the
// optical-size axis was 129 KB. Not preloaded: the root layout would otherwise
// push it to every page, the homepage included (A-193 made that page light);
// the browser fetches it only on a page that shows a message.
export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-newsreader",
  preload: false,
});
