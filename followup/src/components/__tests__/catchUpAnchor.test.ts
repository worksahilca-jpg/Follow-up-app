/**
 * "Catching up" (CatchUp, A-043) ends with "Show all N messages", an
 * in-page link to the conversation. The redesign in #364 dropped the id it
 * points at, so on every long conversation the link did nothing at all.
 * Read from the source because both halves are markup: the link's target
 * and the element on the page that renders CatchUp.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("CatchUp's 'Show all messages' link", () => {
  it("points at an element that exists on the customer page", () => {
    const target = /href="#([\w-]+)"/.exec(src("components/CatchUp.tsx"))?.[1];
    expect(target).toBeTruthy();
    const page = src("app/(app)/leads/[id]/page.tsx");
    expect(page).toContain("<CatchUp");
    expect(page).toContain(`id="${target}"`);
  });
});
