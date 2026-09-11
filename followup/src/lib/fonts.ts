import { Manrope } from "next/font/google";

// Shared across the whole product — the landing page, /signin, and (via
// the root layout) every authenticated app page — so next/font generates
// exactly one font-face instead of a near-duplicate per surface that
// happens to use the same weights. Switched from Plus Jakarta Sans to
// Manrope for the "clean corporate SaaS" rebrand — a geometric, highly
// legible sans that reads as professional software rather than an
// editorial/marketing typeface, while still carrying a real 800 weight
// for the landing page's giant display numerals (.priceGiant, .headline).
export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});
