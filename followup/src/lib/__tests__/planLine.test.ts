/**
 * A quiet Today ends with the plan (research round 2, #2): who FollowUp
 * writes to next, and when, so there is nothing left to keep in mind.
 */
import { describe, it, expect } from "vitest";
import { planLine, type ComingUpItem } from "@/lib/comingUp";

const item = (leadId: string, name: string, what = "First check-in"): ComingUpItem => ({ leadId, name, at: new Date(), what, unless: true });

describe("the plan line", () => {
  it("names the first two people and their day", () => {
    expect(
      planLine([
        { day: "Thursday", items: [item("a", "Priya Sharma")] },
        { day: "Saturday", items: [item("b", "Noah Patel"), item("c", "Emma Li")] },
      ])
    ).toBe("Next: FollowUp checks on Priya on Thursday, and on Noah on Saturday.");
  });

  it("says today and tomorrow the way people do, and a reply as a reply", () => {
    expect(planLine([{ day: "Tomorrow", items: [item("a", "Priya")] }])).toBe("Next: FollowUp checks on Priya tomorrow.");
    expect(planLine([{ day: "Today", items: [item("a", "Priya", "A reply to their message")] }])).toBe(
      "Next: FollowUp replies to Priya later today."
    );
  });

  it("is nothing when nothing is planned", () => {
    expect(planLine([])).toBeNull();
  });
});
