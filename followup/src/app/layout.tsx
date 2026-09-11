import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { manrope } from "@/lib/fonts";

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
    <html lang="en" className={`h-full antialiased ${manrope.variable}`}>
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
