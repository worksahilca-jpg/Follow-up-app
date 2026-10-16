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
    // scrubs (each one checks its own fuNear inside tick) and calm mode.
    const allowed = ["spy()", "draw()", "go()", "tick()", "navTone()", "requestAnimationFrame(tick)"];
    const loose = scrollListeners().filter((l) => !/near\(\)/.test(l) && !allowed.some((a) => l.includes(a)));
    expect(loose).toEqual([]);
    expect(js).toContain("window.fuNear = function");
  });

  it("never freezes and restarts its motion on each turn of a mouse wheel", () => {
    // A Windows wheel scrolls in notches: pausing the loops while scrolling made them stop and start on every notch,
    // which read as choppy (founder, 2026-10-16, on a Windows laptop). Off-screen parts still rest (is-offscreen).
    expect(css + js).not.toContain("is-scrolling");
  });

  it("calms itself on a computer that can't keep up", () => {
    expect(js).toContain("function calmWhenSlow");
    expect(css + js).toContain("fu-calm");
  });
});

/**
 * The first screen a visitor sees is the one that stays (founder, 2026-10-14: "the landing page choks"). A phone used
 * to paint the page before its scripts ran, then watch it rearrange: the example week swapped for the chat, the bar's
 * logo appearing, Your control swapping versions. Everything the first paint needs is now in the markup and the head.
 */
describe("the home page doesn't jump while it loads", () => {
  it("has all its styles before the page itself", () => {
    // A stylesheet after the content arrives after the first paint, and everything it moves jumps.
    const firstContent = html.indexOf("<header");
    expect(firstContent).toBeGreaterThan(0);
    expect(html.indexOf("<style", firstContent)).toBe(-1);
  });

  it("starts in the state its scripts would put it in at the top of the page", () => {
    expect(html).toMatch(/<header class="nav light">/);
    // The try-it box is written inside the green stage, where a script used to move it.
    expect(html.indexOf('id="fl-try"')).toBeGreaterThan(html.indexOf('id="fl-stage"'));
    // The founder's two Your control choices (v116), on the page rather than picked by a hidden row at load.
    expect(html).toMatch(/<html [^>]*data-ctl="b" data-ds="b"/);
  });

  it("arranges the phone's first screen as soon as the hero is read", () => {
    // A-223: right after the hero, before the rest of the page, so the first paint is already the phone's.
    const heroEnd = html.indexOf("</section>", html.indexOf('id="fl-hero"'));
    const phone = html.indexOf("(function phoneHero()");
    expect(phone).toBeGreaterThan(heroEnd);
    expect(phone).toBeLessThan(html.indexOf('<section id="story"'));
  });
});

/**
 * The page is the design rounds' single file, so styles and scripts for parts that were replaced stayed in it: by
 * 2026-10-14 about half of its styles could never apply. These keep it light.
 */
describe("the home page stays light", () => {
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, " ").replace(/<style\b[\s\S]*?<\/style>/g, " ");
  // Any word in the markup or the scripts could be a class or id; scripts also build "is-" + n and "s" + n.
  const words = new Set((markup + js).match(/[A-Za-z0-9_-]+/g));
  const live = (name: string) => words.has(name) || /^(is-\d+|s\d+)$/.test(name);
  // Every stylesheet, the second one (id="order-preview") included.
  const allCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("keeps no style for something the page no longer has", () => {
    const selectors = [...allCss.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => s && !s.startsWith("@"));
    const dead: string[] = [];
    for (const sel of selectors) {
      for (const one of sel.split(/,(?![^(]*\))/)) {
        // What a selector needs outside :not(), :is() and friends, with quoted values set aside.
        let outside = "", depth = 0;
        for (const c of one.replace(/"[^"]*"|'[^']*'/g, '""')) {
          if (c === "(") depth++;
          else if (c === ")") depth--;
          else if (depth === 0) outside += c;
        }
        const needs = [...outside.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
        if (needs.some((n) => !live(n))) dead.push(one.trim());
      }
    }
    // Only a selector that needs nothing the page has is reported; a list that still matches something stays.
    const deadRules = selectors.filter((sel) => sel.split(/,(?![^(]*\))/).every((one) => dead.includes(one.trim())));
    expect(deadRules).toEqual([]);
  });

  it("stays under 450 KB", () => {
    // 620 KB before the 2026-10-14 clean-up, 415 KB after it.
    expect(html.length).toBeLessThan(450_000);
  });
});

/**
 * Every tap on the home page reaches 44px on a phone (design-review.md; 2026-10-14). The small links and buttons
 * keep how they look: an invisible band centred on each one takes the tap. A change that drops one fails here.
 */
describe("the home page is easy to tap", () => {
  const band = allCssOf(html).match(/([^{}]+)\{\s*content: "";\s*position: absolute;\s*left: 0;\s*right: 0;\s*top: 50%;\s*height: 44px;/);

  it("gives every small link and button a 44px band", () => {
    expect(band).not.toBeNull();
    const selectors = band![1];
    for (const small of [".brand", ".nav-links a", ".s6-replay", ".cb-seg button", ".cb-sw", ".db-l a", ".f5-up"]) {
      expect(selectors).toContain(small);
    }
  });
});

function allCssOf(page: string): string {
  return [...page.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
}
