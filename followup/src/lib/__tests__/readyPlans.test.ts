/** Ready follow-up plans (A-044): days in, the engine's step gaps out, and no invented facts. */
import { describe, it, expect } from "vitest";
import { READY_PLANS, toStepDelays, dayLabel } from "@/lib/readyPlans";

describe("ready plans", () => {
  it("turns cumulative days into the gaps the engine runs on", () => {
    expect(toStepDelays([2, 5, 12])).toEqual([48, 72, 168]);
    expect(toStepDelays([0, 2, 7])).toEqual([0, 48, 120]);
  });

  it("keeps every plan's days in order", () => {
    for (const p of READY_PLANS) {
      const days = p.steps.map((s) => s.day);
      expect(days, p.name).toEqual([...days].sort((a, b) => a - b));
      expect(new Set(days).size, p.name).toBe(days.length);
    }
  });

  it("never steers a draft toward a price, a time or an offer it would have to invent", () => {
    for (const p of READY_PLANS) {
      for (const s of p.steps) {
        expect(s.hint, `${p.name}: ${s.label}`).not.toMatch(/\$|\d+%|\bat \d|\b\d{1,2}(am|pm)\b/i);
      }
    }
  });

  it("reads the first day as Same day", () => {
    expect(dayLabel(0)).toBe("Same day");
    expect(dayLabel(5)).toBe("Day 5");
  });
});
