/**
 * "Your rules" in Settings (design brain A-041). Each sentence is a claim
 * about what FollowUp does, so each branch is pinned to the setting that
 * makes it true.
 */
import { describe, it, expect } from "vitest";
import { yourRules } from "@/lib/yourRules";

const base = { holdAll: true, paused: false, autonomousAllowed: false, onlyAdminsSend: false };

describe("yourRules", () => {
  it("says every reply waits on a holding account, the default", () => {
    const rules = yourRules(base);
    expect(rules[0]).toBe("Every reply waits for your OK.");
    expect(rules).toContain("Anything about price waits for you.");
    expect(rules).toContain("When a customer answers, check-ins stop.");
    expect(rules).toContain("Anyone on your team can send.");
  });

  it("says simple replies send by themselves once the owner allowed it", () => {
    expect(yourRules({ ...base, holdAll: false })[0]).toBe("Simple replies send by themselves. Everything else waits for your OK.");
  });

  it("says sending is paused, not just held, during a pause", () => {
    expect(yourRules({ ...base, paused: true })[0]).toMatch(/^Sending is paused/);
  });

  it("names the Auto exception to the price rule only when Auto can actually send", () => {
    expect(yourRules({ ...base, holdAll: false, autonomousAllowed: true })).toContain(
      "Anything about price waits for you, except for customers you've set to Auto."
    );
    // Held or paused: nothing sends by itself, so there is no exception.
    expect(yourRules({ ...base, autonomousAllowed: true })).toContain("Anything about price waits for you.");
    expect(yourRules({ ...base, paused: true, autonomousAllowed: true })).toContain("Anything about price waits for you.");
  });

  it("says only admins can send when the team turned that on", () => {
    expect(yourRules({ ...base, onlyAdminsSend: true })).toContain("Only admins can send. Teammates write and edit.");
  });
});
