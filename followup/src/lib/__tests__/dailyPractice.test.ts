/**
 * One practice reply a day (A-330): a made-up customer for this kind of business, a different one each day, behind
 * the daily question's gate (A-101).
 */
import { describe, it, expect } from "vitest";
import { practiceDue, practiceFor, practiceMessages } from "@/lib/dailyPractice";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-27T19:00:00Z");
const TRADES = ["Real estate", "Mortgage brokerage", "Home services (contractor, cleaning, etc.)", "Dental / medical clinic", "Marketing agency"];

describe("practice messages", () => {
  it("gives every kind of business its own list, and anything else the general one", () => {
    for (const trade of TRADES) expect(practiceMessages(trade).length).toBeGreaterThanOrEqual(5);
    expect(practiceMessages("real_estate")).toBe(practiceMessages("Real estate"));
    expect(practiceMessages("Bakery")).toEqual(practiceMessages(null));
    expect(practiceMessages(null)[0].text).toBe("Hi, how much do you charge?");
  });

  it("keeps every customer short, first name only, with no address or price to mistake for a real one", () => {
    for (const trade of [...TRADES, null]) {
      for (const m of practiceMessages(trade)) {
        expect(m.name).toMatch(/^[A-Z][a-z]+$/);
        expect(m.text.length).toBeLessThanOrEqual(140);
        expect(m.text).not.toMatch(/\d+\s+\w+\s+(St|Street|Ave|Avenue|Rd|Road)\b/);
        // A price for a home or a job, not a household income ("$120k").
        expect(m.text).not.toMatch(/\$\s?\d[\d,]*(?![\d,k])/);
      }
    }
  });

  it("shows a different customer each day, and the whole list before any comes back", () => {
    const list = practiceMessages("Real estate");
    const seen = Array.from({ length: list.length }, (_, i) => practiceFor("Real estate", "biz1", new Date(NOW.getTime() + i * DAY)).text);
    expect(new Set(seen).size).toBe(list.length);
    expect(practiceFor("Real estate", "biz1", new Date(NOW.getTime() + list.length * DAY)).text).toBe(seen[0]);
  });

  it("shows the same customer all day, so a reload shows the same card", () => {
    const morning = new Date("2026-10-27T01:00:00Z");
    const evening = new Date("2026-10-27T23:00:00Z");
    expect(practiceFor("Real estate", "biz1", morning)).toEqual(practiceFor("Real estate", "biz1", evening));
  });

  it("doesn't give every business the same customer on the same day", () => {
    const today = new Set(["biz1", "biz2", "biz3", "biz4", "biz5"].map((id) => practiceFor("Real estate", id, NOW).text));
    expect(today.size).toBeGreaterThan(1);
  });
});

describe("when the card may show (the daily question's gate)", () => {
  const old = new Date(NOW.getTime() - 3 * DAY);

  it("never in the first hour after setup", () => {
    expect(practiceDue({ createdAt: new Date(NOW.getTime() - 30 * 60_000), questionAfter: null }, NOW)).toBe(false);
    expect(practiceDue({ createdAt: old, questionAfter: null }, NOW)).toBe(true);
  });

  it("not again the same day once a card was answered or set aside", () => {
    expect(practiceDue({ createdAt: old, questionAfter: new Date(NOW.getTime() + 60_000) }, NOW)).toBe(false);
    expect(practiceDue({ createdAt: old, questionAfter: new Date(NOW.getTime() - 60_000) }, NOW)).toBe(true);
  });
});
