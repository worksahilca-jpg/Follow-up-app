import { Plus_Jakarta_Sans } from "next/font/google";

// Shared across the whole product — the landing page, /signin, and (via
// the root layout) every authenticated app page — so next/font generates
// exactly one font-face instead of a near-duplicate per surface that
// happens to use the same weights. Originally landing/signin-only (see
// git history: components/landing/font.ts); promoted here once the
// authenticated app adopted the same warm editorial system and typeface
// as those two pages, rather than keeping its own separate Inter +
// Space Grotesk pairing.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});
