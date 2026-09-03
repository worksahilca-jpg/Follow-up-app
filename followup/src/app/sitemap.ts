import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXTAUTH_URL ?? "https://follow-up-app-two.vercel.app";

// Only the genuinely public, static pages — not auth-gated app routes
// (a crawler can't get past sign-in anyway) or private per-lead/per-business
// links like /book/[leadId] and /embed/[businessId].
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
