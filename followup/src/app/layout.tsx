import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FollowUp — Never lose a lead to silence",
  description:
    "FollowUp is the AI teammate that watches your sales conversations and tells you who to follow up with today, why, and what to say.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
