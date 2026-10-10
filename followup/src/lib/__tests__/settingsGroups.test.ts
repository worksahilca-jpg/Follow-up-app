/**
 * Settings' side list (A-212, A-213) must never lose a page: every page in
 * the Settings screen belongs to a group, so a link like /settings#billing
 * lands in a group that shows it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SETTINGS_GROUPS, groupOfPage } from "@/lib/settingsGroups";

const source = readFileSync(join(__dirname, "..", "..", "app", "(app)", "settings", "page.tsx"), "utf8");
const pagesBlock = source.slice(source.indexOf("const PAGES"), source.indexOf("/** Old section id"));
const pages = [...pagesBlock.matchAll(/^\s{2}([a-z]+): \{ title:/gm)].map((m) => m[1]);

describe("Settings' side list", () => {
  it("reads the pages from the Settings screen", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it("puts every page in a group, except the feedback form", () => {
    for (const page of pages) {
      if (page === "feedback") continue;
      expect(groupOfPage(page), `${page} has no group`).not.toBeNull();
    }
  });

  it("only uses groups the side list shows", () => {
    for (const page of pages) {
      const g = groupOfPage(page);
      if (g) expect(SETTINGS_GROUPS).toContain(g);
    }
  });
});
