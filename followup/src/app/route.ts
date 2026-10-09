import { homeHtml } from "@/lib/homePage";

/**
 * The home page (design brain A-204 → A-206, approved by the founder on
 * 2026-10-09): one hand-built document in src/landing/home.html, served
 * as it is, with its photos and fonts in public/landing/ (content-hashed
 * names, cached for a year in next.config.ts).
 *
 * Why a document and not React: the page is the approved design itself,
 * built and reviewed as one file over many rounds, with its own styles and
 * motion. Re-writing it as components would mean re-approving every
 * section; serving the file keeps what the founder saw and what visitors
 * get the same thing.
 *
 * Rendered once at build time and served as a static file. Its "Try it
 * yourself" box calls /api/demo/reply; every limit on that is in
 * src/lib/demoReply.ts.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(homeHtml(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
