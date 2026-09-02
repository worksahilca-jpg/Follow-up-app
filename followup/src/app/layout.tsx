import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

// Single font family throughout (weight does the work headings used to
// need a separate serif for) — the clean, restrained look of most modern
// SaaS UI (Linear, Notion, Stripe) rather than an editorial display font.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "FollowUp — Never lose a lead to silence",
  description:
    "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
