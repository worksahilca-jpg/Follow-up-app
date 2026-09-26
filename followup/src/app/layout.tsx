import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import SiteAnalytics from "@/components/SiteAnalytics";
import { publicSans, ibmPlexMono } from "@/lib/fonts";

// metadataBase makes every relative URL below (the OG image, icons) resolve
// to an absolute one — required for social platforms that fetch the image
// directly rather than rendering it in a browser with a known origin.
//
// It reads SITE_URL, not NEXTAUTH_URL: the public address of the site and the
// OAuth callback host are different questions that happened to share a
// variable, and the shared fallback pointed at a vercel.app deployment. See
// src/lib/siteUrl.ts.
import { SITE_URL } from "@/lib/siteUrl";
import { buildStructuredData } from "@/lib/structuredData";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // A template, so a page that sets its own title keeps the product name in
  // the result without every page repeating the homepage's whole pitch.
  // `default` is the homepage's own title.
  title: {
    default: "FollowUp — Never lose a lead because you forgot to follow up.",
    template: "%s — FollowUp",
  },
  // Without this, every public page told Google its canonical was whatever
  // host it happened to be served from.
  alternates: { canonical: "/" },
  description:
    "FollowUp watches your inbox, tells you who is going quiet and why, and writes the reply. Only for owners who have leads and don't have time to reply.",
  openGraph: {
    title: "FollowUp — Never lose a lead because you forgot to follow up.",
    description:
      "FollowUp watches your inbox, tells you who is going quiet and why, and writes the reply. Only for owners who have leads and don't have time to reply.",
    url: SITE_URL,
    siteName: "FollowUp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FollowUp — Never lose a lead because you forgot to follow up.",
    description:
      "FollowUp watches your inbox, tells you who is going quiet and why, and writes the reply. Only for owners who have leads and don't have time to reply.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${publicSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Every framer-motion animation in the app — the landing page's
            reveal/parallax/hover motion, the FAQ accordion — reads the
            visitor's OS-level "reduce motion" setting through this one
            provider rather than each component re-checking it. */}
        {/* What this product IS, in the one format an answer engine reads
            as fact rather than prose. Meta tags describe a page; this
            describes the thing. Added after Google's AI Overview called
            FollowUp a door-to-door solar sales tool — see the header of
            src/lib/structuredData.ts for what it actually said and why a
            vacuum was the cause. */}
        <script
          type="application/ld+json"
          // The object is built in our own code from our own constants —
          // no user input reaches it, which is the condition under which
          // this is the documented way to emit JSON-LD in the App Router.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData()) }}
        />
        <MotionConfig reducedMotion="user">
          <AuthProvider>{children}</AuthProvider>
        </MotionConfig>
        <SiteAnalytics />
      </body>
    </html>
  );
}
