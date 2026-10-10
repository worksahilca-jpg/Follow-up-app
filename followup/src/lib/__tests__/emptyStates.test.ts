/**
 * What a tester sees on day one, before anything has happened.
 *
 * Every one of the first ten testers lands on these screens with no leads
 * and, quite possibly, nothing connected. Two things were wrong there, and
 * both are the same defect this codebase keeps finding: a sentence that is
 * true in isolation and misleading in place.
 *
 * ## The dashboard said the account was caught up
 *
 * `headline()` had the leads list in scope and never looked at it. An
 * account two minutes old, with nothing connected and nothing ever
 * captured, was greeted with "Nothing needs your OK right now." — which is
 * what a product says to someone who has been working and is done, printed
 * directly above a box explaining that FollowUp is not watching anything
 * yet. The page contradicted itself in one glance, exactly as Settings did
 * (#301).
 *
 * ## Three screens sent the wrong business to the wrong place
 *
 * Leads, Pipeline and Analytics each said "Connect Gmail in Settings". One
 * source out of eight. A business running on Instagram DMs, WhatsApp or a
 * website form was told to connect an inbox it does not have — the same
 * dead end the founder had already called out in onboarding ("we will help
 * them to connect the sources"), on three screens nobody went back and
 * checked.
 *
 * Source assertions, because the alternative is mounting three pages with
 * their data layers mocked to check the wording of one string.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const app = (...parts: string[]) => readFileSync(join(__dirname, "..", "..", "app", ...parts), "utf8");

const EMPTY_SCREENS: [string, string][] = [
  ["Leads", "(app)/leads/LeadsPageClient.tsx"],
  ["Analytics", "(app)/analytics/page.tsx"],
];

describe("the dashboard on a brand-new account", () => {
  const source = app("(app)", "dashboard", "page.tsx");

  it("does not tell an empty account it is caught up", () => {
    const fn = source.slice(source.indexOf("function headline()"));
    const body = fn.slice(0, fn.indexOf("\n  }"));
    expect(
      body,
      "headline() ignores the leads list again — a new account is told 'nothing needs your OK'"
    ).toMatch(/leads\.length === 0/);
  });

  it("gives a brand-new account a sentence, never a count", () => {
    // Since the redesign (A-220) a working Today leads with one number,
    // "0 customers need you" on a clear day. That number is the calm
    // sentence's successor, so it must stay behind the same check: a brand-new
    // account reads "No customers yet." instead.
    const fn = source.slice(source.indexOf("function headline()"));
    const body = fn.slice(0, fn.indexOf("\n  }"));
    expect(body).toContain('if (leads.length === 0) return "No customers yet.";');
    expect(source).toMatch(/\{sentence \? \(/);
  });

  it("still gives an account that has worked its count", () => {
    // The fix must not overcorrect: an owner with customers and an empty
    // queue has earned "0 customers need you", and losing it would make the
    // line useless in the one case it was written for.
    expect(source).toContain('"customers need you"');
  });
});

describe("an empty screen never names one source out of eight", () => {
  for (const [name, path] of EMPTY_SCREENS) {
    it(`${name} points at sources in general, not at Gmail`, () => {
      const source = app(path);
      // Comments explaining the old wording are allowed; the rendered
      // string is not. Both live copies said exactly this.
      const lines = source.split("\n").filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"));
      expect(
        lines.join("\n"),
        `${name}'s empty state tells every business to connect Gmail again`
      ).not.toMatch(/Connect Gmail in Settings/);
    });

    it(`${name} names more than one way in`, () => {
      const source = app(path);
      expect(source, `${name} lost the list of sources`).toMatch(/website form/i);
    });
  }
});

describe("the Settings inbox panel", () => {
  it("does not claim the dashboard stays empty without an inbox", () => {
    // Same family, found in the same pass. It sits under the Gmail/Outlook
    // panel so naming the inbox is right — but the dashboard fills from any
    // of eight sources, and a business capturing through the website widget
    // was told its working setup produced nothing.
    const source = app("(app)/settings/page.tsx");
    const lines = source.split("\n").filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"));
    expect(lines.join("\n")).not.toMatch(/until then the dashboard stays empty/);
  });
});

describe("what an empty screen still has to do", () => {
  it("Leads keeps both ways forward — add one, or go connect something", () => {
    // An empty state with no action is a dead end, which is worse than a
    // wrongly-named one.
    const source = app("(app)/leads/LeadsPageClient.tsx");
    const block = source.slice(source.indexOf("{leads.length === 0 && ("));
    expect(block.slice(0, 1400)).toContain("Add a customer");
    expect(block.slice(0, 1400)).toContain('href="/settings"');
  });

  it("Leads still tells a filtered-empty list it is only the filter", () => {
    // "No leads yet" on a list that has leads but no matches would be a
    // worse lie than the one being fixed.
    const source = app("(app)/leads/LeadsPageClient.tsx");
    expect(source).toMatch(/filtered\.length === 0 && leads\.length > 0/);
  });

  it("the old Pipeline and Waiting pages land in Customers (A-219)", () => {
    // Pipeline folded into Customers as the stage filter on Everyone, and
    // Waiting as its own group; an old link must not land on an empty page.
    expect(app("(app)/pipeline/page.tsx")).toContain('redirect("/leads?show=all")');
    expect(app("(app)/waiting/page.tsx")).toContain('redirect("/leads?show=waiting")');
  });
});
