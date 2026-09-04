import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

// Single font family throughout the authenticated app (weight does the
// work headings used to need a separate serif for) — the clean,
// restrained look of most modern SaaS UI (Linear, Notion, Stripe) rather
// than an editorial display font.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Fraunces is loaded here (once, for every route) but only ever referenced
// via var(--font-fraunces) — and today that's just the public marketing
// page's own headlines. The authenticated app keeps the Inter-only look
// above untouched; this just makes a second, editorial display face
// available where it's asked for.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

// metadataBase makes every relative URL below (the OG image, icons) resolve
// to an absolute one — required for social platforms that fetch the image
// directly rather than rendering it in a browser with a known origin.
const siteUrl = process.env.NEXTAUTH_URL ?? "https://follow-up-app-two.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "FollowUp — Never lose a lead to silence",
  description:
    "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
  openGraph: {
    title: "FollowUp — Never lose a lead to silence",
    description:
      "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
    url: siteUrl,
    siteName: "FollowUp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FollowUp — Never lose a lead to silence",
    description:
      "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
