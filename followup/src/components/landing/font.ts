import { Plus_Jakarta_Sans } from "next/font/google";

// Shared by every page on the editorial marketing surface (the landing
// page and /signin) so next/font generates exactly one font-face for it
// instead of a near-duplicate per page that happens to use the same
// weights. Loaded here rather than in the root layout so it stays scoped
// to this surface's own class tree (see each page's `plusJakarta.variable`
// usage) — the authenticated app keeps Inter/Space Grotesk from
// layout.tsx untouched.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});
