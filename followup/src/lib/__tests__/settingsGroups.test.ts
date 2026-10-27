/**
 * Settings' five groups (A-220: the phone's home rows and the desk's side
 * list) must never lose a page: every page in the Settings screen belongs to
 * a group, so a link like /settings#billing lands in a group that shows it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GROUP_PAGE, GROUP_SLUG, PAGE_SECTIONS, PARENT_PAGE, SETTINGS_GROUPS, groupOfPage, groupOfSlug, pageForId } from "@/lib/settingsGroups";

const source = readFileSync(join(__dirname, "..", "..", "app", "(app)", "settings", "SettingsClient.tsx"), "utf8");
const pagesStart = source.indexOf("const PAGES");
const pagesBlock = source.slice(pagesStart, source.indexOf("\n};\n", pagesStart));
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
    for (const old of ["integrations", "website-widget", "website", "social", "whatsapp", "crm", "email", "write", "automation", "pause"]) {
      const page = pageForId(old);
      expect(page, `#${old} no longer opens anything`).not.toBeNull();
      expect(pages, `#${old} → ${page}`).toContain(page);
    }
  });

  // The page's titles and the tree's sections (lib/settingsGroups.ts, A-257) name the same pages.
  it("knows the sections of every page the screen shows", () => {
    expect(Object.keys(PAGE_SECTIONS).sort()).toEqual([...pages].sort());
  });

  it("steps a page opened from another page back to that page, in the same group", () => {
    for (const [child, parent] of Object.entries(PARENT_PAGE)) {
      expect(pages).toContain(child);
      expect(pages).toContain(parent);
      expect(groupOfPage(child)).toBe(groupOfPage(parent));
    }
  });
});
