import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL } from "@/lib/siteUrl";
import { buildStructuredData } from "@/lib/structuredData";

/** Where the home page's document lives, and the folder its photos and fonts are served from. */
export const HOME_HTML_PATH = join("src", "landing", "home.html");
export const HOME_ASSET_DIR = join("public", "landing");

/**
 * The home page as visitors get it: src/landing/home.html with the two
 * things the document can't know on its own filled in — the public address
 * (canonical and social-card links, see src/lib/siteUrl.ts) and the
 * structured data every other page gets from the root layout.
 */
export function homeHtml(root: string = process.cwd()): string {
  const page = readFileSync(join(root, HOME_HTML_PATH), "utf8");
  // "<" escaped so nothing in the data can close the script tag it sits in.
  const jsonLd = JSON.stringify(buildStructuredData()).replace(/</g, "\\u003c");
  return page.replaceAll("__SITE_URL__", SITE_URL).replace("__JSON_LD__", jsonLd);
}
