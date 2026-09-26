"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Page-view counts for the whole site, landing page and app alike, so the
 * founder can see how many people arrive, how many reach sign-in, and which
 * screens get used (founder's call, 2026-09-26: "I want a page … where I can
 * see the analytics of this product"). Vercel Web Analytics sets no cookies
 * and stores no personal data.
 *
 * Two things are kept out on purpose:
 * - query strings, which can carry an OAuth result, an error code or an
 *   email address; only the path is sent;
 * - /admin, the founder's own screens, which would only count him.
 */
export function redact(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith("/admin")) return null;
  return { ...event, url: url.origin + url.pathname };
}

export default function SiteAnalytics() {
  return <Analytics beforeSend={redact} />;
}
