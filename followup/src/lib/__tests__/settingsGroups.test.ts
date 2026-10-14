/**
 * Settings' five groups (A-220: the phone's home rows and the desk's side
 * list) must never lose a page: every page in the Settings screen belongs to
 * a group, so a link like /settings#billing lands in a group that shows it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GROUP_PAGE, GROUP_SLUG, PARENT_PAGE, SETTINGS_GROUPS, groupOfPage, groupOfSlug } from "@/lib/settingsGroups";

const source = readFileSync(join(__dirname, "..", "..", "app", "(app)", "settings", "page.tsx"), "utf8");
const pagesBlock = source.slice(source.indexOf("const PAGES"), source.indexOf("/** Old section id"));
const pages = [...pagesBlock.matchAll(/^\s{2}([a-z]+): \{ title:/gm)].map((m) => m[1]);

describe("Settings' side list", () => {
  it("reads the pages from the Settings screen", () => {
    // Ten since A-253 (where customers write and how replies go out became one page each).
    expect(pages.length).toBeGreaterThanOrEqual(8);
    expect(pages).toContain("connections");
    expect(pages).toContain("replies");
  });

  it("puts every page in a group", () => {
    for (const page of pages) expect(groupOfPage(page), `${page} has no group`).not.toBeNull();
  });

  it("has no second feedback box: Help is the one place (A-219)", () => {
    expect(pages).not.toContain("feedback");
  });

  it("opens a one-page group straight onto a page that exists, in that group", () => {
    for (const [g, page] of Object.entries(GROUP_PAGE)) {
      expect(pages).toContain(page);
      expect(groupOfPage(page!)).toBe(g);
    }
  });

  it("gives every list group an address the Back button can return to", () => {
    for (const g of SETTINGS_GROUPS) {
      if (GROUP_PAGE[g]) expect(groupOfSlug(GROUP_SLUG[g])).toBeNull();
      else expect(groupOfSlug(GROUP_SLUG[g])).toBe(g);
    }
  });

  it("only uses groups the side list shows", () => {
    for (const page of pages) {
      const g = groupOfPage(page);
      if (g) expect(SETTINGS_GROUPS).toContain(g);
    }
  });

  // A-253 made two groups one page each. Links already out in the world (setup steps, the
  // sign-in and alert emails, Meta and Google coming back) still name the old sections.
  it("lands every old address on a page that exists", () => {
    const block = source.slice(source.indexOf("const ALIASES"), source.indexOf("/** Old section id"));
    const aliases = [...block.matchAll(/^\s{2}"?([a-z-]+)"?: "([a-z]+)",$/gm)];
    expect(aliases.length).toBeGreaterThanOrEqual(8);
    for (const [, from, to] of aliases) expect(pages, `#${from} → ${to}`).toContain(to);
    for (const old of ["integrations", "website-widget", "social", "whatsapp", "crm", "email"]) {
      expect(aliases.map((a) => a[1]), `#${old} no longer opens anything`).toContain(old);
    }
  });

  it("steps a page opened from another page back to that page, in the same group", () => {
    for (const [child, parent] of Object.entries(PARENT_PAGE)) {
      expect(pages).toContain(child);
      expect(pages).toContain(parent);
      expect(groupOfPage(child)).toBe(groupOfPage(parent));
    }
  });
});
