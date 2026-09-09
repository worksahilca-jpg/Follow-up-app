import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { MotionConfig } from "framer-motion";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

// Inter is the body/UI face everywhere — forms, tables, buttons — where
// density and legibility matter more than character.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Space Grotesk is the display face for every heading app-wide (see
// --font-display in globals.css) — a clean, slightly technical geometric
// sans that reads as "confident product" rather than an editorial one.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

// metadataBase makes every relative URL below (the OG image, icons) resolve
// to an absolute one — required for social platforms that fetch the image
// directly rather than rendering it in a browser with a known origin.
const siteUrl = process.env.NEXTAUTH_URL ?? "https://follow-up-app-two.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "FollowUp — catches the lead that went quiet",
  description:
    "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
  openGraph: {
    title: "FollowUp — catches the lead that went quiet",
    description:
      "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
    url: siteUrl,
    siteName: "FollowUp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FollowUp — catches the lead that went quiet",
    description:
      "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Every framer-motion animation in the app — the landing page's
            reveal/parallax/hover motion, the FAQ accordion — reads the
            visitor's OS-level "reduce motion" setting through this one
            provider rather than each component re-checking it. */}
        <MotionConfig reducedMotion="user">
          <AuthProvider>{children}</AuthProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
