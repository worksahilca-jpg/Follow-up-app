import { Plus_Jakarta_Sans, Bricolage_Grotesque, Public_Sans, IBM_Plex_Mono } from "next/font/google";

// Shared across the whole product — /signin and (via the root layout)
// every authenticated app page — so next/font generates exactly one
// font-face instead of a near-duplicate per surface that happens to use
// the same weights. Originally landing/signin-only (see git history:
// components/landing/font.ts); promoted here once the authenticated app
// adopted the same warm editorial system and typeface as those two pages,
// rather than keeping its own separate Inter + Space Grotesk pairing.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

// Award Direction — src/app/page.tsx (the public landing page) only. A
// CEO-approved, page-scoped typeface trio (see
// design-brain/decisions/design-decisions.md, 2026-09-13): Bricolage
// Grotesque for headings, Public Sans for body copy, IBM Plex Mono for
// eyebrow/label text. Scoped via CSS variables inside
// landing-award.module.css's `.root` — never applied to /signin or the
// authenticated app, which keep Plus Jakarta Sans above.
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
