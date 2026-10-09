/**
 * The home page is one hand-built document (src/landing/home.html, served by
 * src/app/route.ts). Nothing type-checks it, so these tests do the checks a
 * component would get for free: every link goes somewhere real, every photo
 * and font it asks for exists, and the two values filled in at build time
 * are filled in.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_ASSET_DIR, HOME_HTML_PATH, homeHtml } from "@/lib/homePage";
import { SITE_URL } from "@/lib/siteUrl";

const root = join(__dirname, "..", "..", "..");
const raw = () => readFileSync(join(root, HOME_HTML_PATH), "utf8");

describe("the home page document", () => {
  it("fills in the public address and the structured data", () => {
    const html = homeHtml(root);
    expect(html).not.toMatch(/__[A-Z_]+__/);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/">`);
    expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/opengraph-image">`);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(ld, "no structured data").toBeTruthy();
    expect(() => JSON.parse(ld![1])).not.toThrow();
  });

  it("is a whole document a phone can read", () => {
    const html = raw();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toMatch(/<html lang="en"/);
    expect(html).toMatch(/<meta name="viewport" content="width=device-width,initial-scale=1/);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]+">/);
  });

  it("finds every photo and font it asks for", () => {
    const wanted = new Set([...raw().matchAll(/\/landing\/([a-f0-9]{12}\.(?:jpg|png|webp|woff2))/g)].map((m) => m[1]));
    expect(wanted.size).toBeGreaterThan(0);
    for (const file of wanted) {
      expect(existsSync(join(root, HOME_ASSET_DIR, file)), `public/landing/${file} is missing`).toBe(true);
    }
  });

  it("keeps photos and fonts out of the document itself", () => {
    // Embedded, they made the page 2.7 MB and could never be cached. A few
    // thumbnails of a couple of kilobytes stay inline; nothing bigger.
    expect(raw()).not.toMatch(/data:(image\/(jpeg|png|webp)|font\/woff2);base64,[A-Za-z0-9+/=]{4000}/);
    expect(raw().length).toBeLessThan(1_000_000);
  });

  it("links only to places that exist", () => {
    const html = raw();
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      if (href.startsWith("mailto:")) continue;
      if (href.startsWith("#")) {
        expect(href, "a link with nowhere to go").not.toBe("#");
        expect(ids.has(href.slice(1)), `${href} points at nothing on the page`).toBe(true);
        continue;
      }
      expect(href, `${href} leaves the site`).toMatch(/^\/[a-z]/);
      const route = href.replace(/[#?].*$/, "");
      expect(existsSync(join(root, "src", "app", route, "page.tsx")), `${href} is not a page`).toBe(true);
    }
  });

  it("asks FollowUp's own endpoint for the demo, and nothing outside the site", () => {
    const html = raw();
    expect(html).toContain("fetch('/api/demo/reply'");
    expect(existsSync(join(root, "src", "app", "api", "demo", "reply", "route.ts"))).toBe(true);
    // The preview it was built from ran inside a claude.ai artifact; nothing of that may remain.
    expect(html).not.toMatch(/window\.claude/);
    // Scripts load from this site only (the CSP would block anything else).
    for (const m of html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)) expect(m[1]).toMatch(/^\//);
  });
});
