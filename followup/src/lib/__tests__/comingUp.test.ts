/**
 * "Coming up" (A-046): who FollowUp writes to next, from the same rules the
 * engine uses, days only, each person once.
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { getComingUp, dayLabel, groupByDay } from "@/lib/comingUp";
import type { BusinessAutomationRules } from "@/lib/automationStatus";
import type { Lead } from "@/lib/types";

const NOW = new Date("2026-09-26T16:00:00Z"); // Saturday noon in Toronto
const DAY = 86_400_000;
const rules: BusinessAutomationRules = {
  canSend: true, holdAllForApproval: true, masterEnabled: true, silenceTriggerDays: 3,
  unansweredEnabled: true, unansweredHours: 24, deadLeadEnabled: true, deadLeadDays: 45,
};
function lead(id: string, over: Partial<Lead>): Lead {
  return { id, name: id, lastContacted: NOW.toISOString(), conversation: [], automationStatus: { kind: "sent" }, ...over } as unknown as Lead;
}
const out = (daysAgo: number) => ({ id: "m", direction: "outbound", channel: "email", body: "x", date: new Date(NOW.getTime() - daysAgo * DAY).toISOString() });

describe("getComingUp", () => {
  it("dates a quiet customer's next check-in from the engine's own calendar", () => {
    // We wrote 2 days ago: the first check-in is on day 3, so tomorrow.
    const l = lead("Leila", { conversation: [out(2)] as Lead["conversation"], lastContacted: new Date(NOW.getTime() - 2 * DAY).toISOString() });
    const [item] = getComingUp([l], rules, NOW, new Set());
    expect(item.what).toBe("First check-in");
    expect(item.at.getTime()).toBe(NOW.getTime() + DAY);
  });

  it("names the step of a follow-up plan", () => {
    const l = lead("Dana", { automationStatus: { kind: "workflow", sequenceName: "After a quote", dueInDays: 2 } });
    expect(getComingUp([l], rules, NOW, new Set())[0].what).toBe("Next step of “After a quote”");
  });

  it("leaves out anyone already waiting for your OK", () => {
    const l = lead("Priya", { automationStatus: { kind: "workflow", sequenceName: "P", dueInDays: 1 } });
    expect(getComingUp([l], rules, NOW, new Set(["Priya"]))).toEqual([]);
  });

  it("says nothing for a lead that is stopped, or when nothing can send", () => {
    const off = lead("Off", { automationStatus: { kind: "off" } });
    expect(getComingUp([off], rules, NOW, new Set())).toEqual([]);
    const plan = lead("Plan", { automationStatus: { kind: "workflow", sequenceName: "P", dueInDays: 1 } });
    expect(getComingUp([plan], { ...rules, canSend: false }, NOW, new Set())).toEqual([]);
  });

  it("only looks a week ahead, soonest first", () => {
    const a = lead("Later", { automationStatus: { kind: "workflow", sequenceName: "P", dueInDays: 5 } });
    const b = lead("Sooner", { automationStatus: { kind: "workflow", sequenceName: "P", dueInDays: 1 } });
    const c = lead("TooFar", { automationStatus: { kind: "workflow", sequenceName: "P", dueInDays: 9 } });
    expect(getComingUp([a, b, c], rules, NOW, new Set()).map((i) => i.name)).toEqual(["Sooner", "Later"]);
  });
});

describe("day labels, in the owner's time zone", () => {
  it("says Tomorrow, then the weekday", () => {
    const tz = "America/Toronto";
    expect(dayLabel(new Date(NOW.getTime() + DAY), NOW, tz)).toBe("Tomorrow");
    expect(dayLabel(new Date(NOW.getTime() + 3 * DAY), NOW, tz)).toBe("Tuesday");
  });

  it("groups items under their day", () => {
    const items = [
      { leadId: "1", name: "A", at: new Date(NOW.getTime() + DAY), what: "x" },
      { leadId: "2", name: "B", at: new Date(NOW.getTime() + DAY + 3600_000), what: "x" },
      { leadId: "3", name: "C", at: new Date(NOW.getTime() + 3 * DAY), what: "x" },
    ];
    expect(groupByDay(items, NOW, "America/Toronto").map((g) => [g.day, g.items.length])).toEqual([["Tomorrow", 2], ["Tuesday", 1]]);
  });
});
