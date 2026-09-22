/**
 * The landing page went blank for people who asked for less movement.
 *
 * `RevealLight` and `HeroFlow` both called `useReducedMotion()` and branched
 * on it — returning a plain `<div>` with no animation for a reduced-motion
 * visitor, and a `motion.div` parked at `opacity: 0` for everyone else. The
 * comment on RevealLight described the intent exactly right: "nothing sits at
 * opacity 0 for them."
 *
 * It was true only after hydration. The server cannot know a visitor's motion
 * preference, so `useReducedMotion()` returns false there — the server emitted
 * the animated tree for EVERY visitor, then a reduced-motion browser rendered
 * the plain one. React reported a hydration mismatch and threw away the whole
 * landing subtree to re-render it on the client. Until that finished, what the
 * visitor was looking at was the server's HTML: every block at `opacity: 0`.
 *
 * So the people who asked for less movement were the ones served a blank page,
 * and the slower their device, the longer it stayed blank. Confirmed by
 * driving a real reduced-motion Chromium against the dev server: "Hydration
 * failed because the server rendered HTML didn't match the client", naming the
 * RevealLight wrappers and the HeroFlow source cards.
 *
 * Fixed 2026-09-22 by moving the whole concern into CSS. A media query has no
 * server/client split: the markup is identical everywhere, and the browser
 * resolves the preference itself. After the fix the same reduced-motion run
 * reports zero hydration errors and the page renders at rest.
 *
 * These are source assertions because the defect is invisible to a render
 * test — both trees are individually valid, and only the DIFFERENCE between
 * them is the bug.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (...parts: string[]) => readFileSync(join(__dirname, "..", "..", ...parts), "utf8");

// Comments here legitimately discuss the hook — that is where the reason
// lives — so every comment form comes out before matching.
const code = (...parts: string[]) =>
  src(...parts)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const MOTION_COMPONENTS: [string, string[]][] = [
  ["RevealLight", ["components", "landing", "light", "RevealLight.tsx"]],
  ["HeroFlow", ["components", "landing", "dark", "HeroFlow.tsx"]],
];

describe("motion preference is never read during render", () => {
  for (const [name, path] of MOTION_COMPONENTS) {
    it(`${name} does not branch on useReducedMotion`, () => {
      expect(
        code(...path),
        `${name} reads the motion preference during render again — the server cannot know it, ` +
          `so this renders a different tree on the server than in a reduced-motion browser and the ` +
          `page blanks until React re-renders it`
      ).not.toMatch(/useReducedMotion/);
    });

    it(`${name} marks its animated elements for the CSS to neutralise`, () => {
      // Dropping the hook without the marker would be worse than the bug:
      // a reduced-motion visitor would get the full animation.
      expect(code(...path), `${name} has no data-motion marker, so reduced motion is not honoured at all`).toMatch(
        /data-motion/
      );
    });
  }
});

describe("the CSS that replaces the branch", () => {
  const globals = () => src("app", "globals.css");

  it("neutralises entrance motion under prefers-reduced-motion", () => {
    const css = globals();
    const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(start, "globals.css no longer has a reduced-motion block").toBeGreaterThan(-1);
    const block = css.slice(start, start + 1200);
    expect(block, "[data-motion] is no longer neutralised — animated blocks stay at opacity 0").toMatch(
      /\[data-motion\]/
    );
    expect(block, "the decorative SMIL tokens are no longer hidden").toMatch(/\[data-motion-token\]/);
  });

  it("keeps !important, which is what beats framer-motion's inline style", () => {
    // framer writes opacity/transform inline. Without !important the rule
    // loses silently and the bug comes back looking fixed.
    const css = globals();
    const start = css.indexOf("[data-motion]");
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule, "the [data-motion] rule lost !important and no longer overrides framer's inline style").toMatch(
      /opacity:\s*1\s*!important/
    );
    expect(rule).toMatch(/transform:\s*none\s*!important/);
  });
});
