import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXTAUTH_URL ?? "https://follow-up-app-two.vercel.app";

// Only the actually-public, actually-indexable pages get crawled. Everything
// under (app) requires sign-in anyway (a crawler would just hit a redirect),
// and /book/[leadId] + /embed/[businessId] are per-lead/per-business private
// links, not content meant to show up in search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/leads",
        "/pipeline",
        "/settings",
        "/analytics",
        "/workflows",
        "/onboarding",
        "/signin",
        "/book/",
        "/embed/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
