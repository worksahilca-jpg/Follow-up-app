/**
 * The home page stays smooth on an ordinary laptop (design brain A-224; founder,
 * 2026-10-10: "i want permanent soloution"). Each check is a cause of scroll lag
 * that was found and fixed; a change that brings one back fails here instead of
 * reaching visitors.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_HTML_PATH } from "@/lib/homePage";

const root = join(__dirname, "..", "..", "..");
const html = readFileSync(join(root, HOME_HTML_PATH), "utf8");
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

/** Each scroll listener, from `addEventListener('scroll'` to its `{ passive: true })`. */
function scrollListeners(): string[] {
  const out: string[] = [];
  let at = js.indexOf("addEventListener('scroll'");
  while (at > -1) {
    const end = js.indexOf("{ passive: true })", at);
    out.push(js.slice(at, end > -1 ? end : at + 400));
    at = js.indexOf("addEventListener('scroll'", at + 1);
  }
  return out;
}

describe("the home page stays smooth", () => {
  it("never fades with a filter: every filter is one more drawing pass, every frame", () => {
    const fades = [...css.matchAll(/(?<![-\w])filter:\s*([^;}]+)/g)].map((m) => m[1]).filter((v) => /opacity\(/.test(v));
    expect(fades).toEqual([]);
  });

  it("never blends a layer into the page under it", () => {
    expect(css).not.toMatch(/mix-blend-mode:\s*(?!\s|normal)/);
  });

  it("adds no new frosted glass without raising this number on purpose", () => {
    const frosted = [...css.matchAll(/(?<![-\w])backdrop-filter:\s*(?!\s|none)[^;}]+/g)];
    expect(frosted.length).toBeLessThanOrEqual(17);
  });

  it("measures the page on scroll only where it shows", () => {
    // Each part's scroll effect waits for fuNear() before it measures. The few that don't are cheap
    // and named here: the bar's highlight and tone, the reading thread, play-once triggers, the older
    // scrubs (each one checks its own fuNear inside tick), the pause-while-scrolling flag and calm mode.
    const allowed = ["spy()", "draw()", "go()", "tick()", "navTone()", "is-scrolling", "requestAnimationFrame(tick)"];
    const loose = scrollListeners().filter((l) => !/near\(\)/.test(l) && !allowed.some((a) => l.includes(a)));
    expect(loose).toEqual([]);
    expect(js).toContain("window.fuNear = function");
  });

  it("calms itself on a computer that can't keep up", () => {
    expect(js).toContain("function calmWhenSlow");
    expect(css + js).toContain("fu-calm");
  });
});
