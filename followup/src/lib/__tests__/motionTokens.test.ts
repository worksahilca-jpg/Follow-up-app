import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOTION, RESULT_HOLD_MS } from "@/lib/motion";

// Design brain A-048 (the Framer study): four speeds, and reduced motion
// holds everything still.
const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

describe("motion tokens", () => {
  it("defines the CSS speeds the components use", () => {
    expect(css).toMatch(/--motion-fast:\s*150ms/);
    expect(css).toMatch(/--motion-move:\s*220ms/);
    expect(css).toMatch(/--motion-exit:\s*120ms/);
  });

  it("keeps the framer side on the same numbers", () => {
    expect(MOTION.fast).toBe(0.15);
    expect(MOTION.move).toBe(0.22);
    expect(MOTION.exit).toBe(0.12);
  });

  it("says what happened for long enough to read, and no longer", () => {
    expect(RESULT_HOLD_MS).toBeGreaterThanOrEqual(500);
    expect(RESULT_HOLD_MS).toBeLessThanOrEqual(1000);
  });
});

describe("reduced motion", () => {
  const blocks = css.split("@media (prefers-reduced-motion: reduce)").slice(1).join("\n");

  it("holds the undo line still (the seconds still count)", () => {
    expect(blocks).toMatch(/\.undo-line\s*\{\s*animation:\s*none;/);
  });

  it("opens disclosures without animating", () => {
    expect(blocks).toMatch(/details\.open-in-place::details-content\s*\{\s*transition:\s*none;/);
  });
});
