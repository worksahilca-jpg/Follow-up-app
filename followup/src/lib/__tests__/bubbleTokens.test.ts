/**
 * The chat bubbles are one theme in two places (A-261): the app's
 * conversation (globals.css) and the landing page's chat demo
 * (src/landing/home.html). A change to one must be made in the other, so
 * this reads both and fails when they drift.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const token = (css: string, name: string): string => {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`--${name} is not declared`);
  return m[1].toLowerCase();
};
const long = (hex: string) => (hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex);

describe("chat bubble colours", () => {
  const app = read("src/app/globals.css");
  const landing = read("src/landing/home.html");

  it("are the same in the app and on the landing page", () => {
    for (const name of ["bubble-them", "bubble-you", "on-bubble-you"]) {
      expect(long(token(landing, name)), name).toBe(long(token(app, name)));
    }
  });

  it("the landing's demo bubbles use the tokens, not loose hex values", () => {
    expect(landing).toMatch(/\.m6\.is-her p \{[^}]*var\(--bubble-them/);
    expect(landing).toMatch(/\.m6\.is-ours p \{[^}]*var\(--bubble-you/);
  });

  it("yours is never pure black (R-119) and never the customer's colour (R-120)", () => {
    expect(token(app, "bubble-you")).not.toBe("#000000");
    expect(token(app, "bubble-you")).not.toBe("#0a0a0a");
    expect(token(app, "bubble-you")).not.toBe(token(app, "bubble-them"));
  });
});
