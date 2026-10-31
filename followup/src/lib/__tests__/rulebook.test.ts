/**
 * The rulebook (src/lib/rulebook.ts) must stay true to the prompts and code it describes: every rule says where it
 * lives in exact words, and those words must still be there; every rule names at least one test case that proves it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { AREAS, RULES, ruleTests, rulebook } from "@/lib/rulebook";

/** A source file as one text: the pieces of a long instruction, split across "…" + "…" lines and comments, joined. */
function joined(file: string): string {
  const src = readFileSync(join(process.cwd(), file), "utf8");
  return src.replace(/["`]\s*\+\s*(?:\/\/[^\n]*\n\s*)*["`]/g, "").replace(/\\"/g, '"');
}

describe("the rulebook", () => {
  it("gives every rule a unique id, a known area, a name and a reason", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(AREAS.map((a) => a.id)).toContain(r.area);
      expect(r.name.length).toBeGreaterThan(10);
      expect(r.why.length).toBeGreaterThan(10);
    }
  });

  it.each(RULES.map((r) => [r.id, r] as const))("%s still lives where it says", (_id, rule) => {
    expect(rule.where.length).toBeGreaterThan(0);
    for (const w of rule.where) expect(joined(w.file), `${w.file} should contain "${w.words}"`).toContain(w.words);
  });

  it.each(RULES.map((r) => [r.id, r] as const))("%s has at least one test that proves it", (_id, rule) => {
    const tests = ruleTests(rule);
    const total = Object.values(tests).reduce((n, names) => n + (names?.length ?? 0), 0);
    expect(total).toBeGreaterThan(0);
  });

  it("has rules in every area, and the page gets the case names worked out", () => {
    for (const a of AREAS) expect(RULES.some((r) => r.area === a.id)).toBe(true);
    const book = rulebook();
    expect(book.find((r) => r.id === "realtor-negotiable")?.tests.conversations).toEqual(["\"Is the price negotiable?\""]);
  });
});
