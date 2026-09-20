/**
 * Every hold reason has to finish one sentence: "Held because ___."
 *
 * ApprovalQueue.tsx renders exactly that, and it is the most-read
 * trust-bearing line in the product — the one sentence telling an owner
 * why a message is sitting in front of them instead of having gone out.
 *
 * On 2026-09-20 it read, to every beta tester:
 *
 *     "Held because Ready to send — this account holds every automated
 *      message for you to approve."
 *
 * A capital letter mid-sentence, and a first clause that contradicts the
 * word before it. The other reasons were being written as standalone
 * sentences too ("Your account holds…", "They went quiet…"), so the seam
 * showed on all of them.
 *
 * These import the REAL strings the schedulers use (src/lib/holdReasons.ts,
 * which exists so this test has something to point at) and the REAL
 * interpolated shapes automation.ts builds. A copy of the strings would
 * pass with the bug back in place, which is not a test.
 *
 * Deliberately not asserting on assessSendRisk's model-written reason —
 * that one is steered by SEND_RISK_SCHEMA's description, which states the
 * same rule to the model, and cannot be pinned by a unit test.
 */
import { describe, it, expect } from "vitest";
import {
  HOLD_ALL_AUTOMATION_REASON,
  HOLD_ALL_SEQUENCE_REASON,
  RISK_CHECK_FAILED_REASON,
  renderHeldBecause,
} from "@/lib/holdReasons";
import { greetingFirstName } from "@/lib/leadName";

/**
 * The two reasons automation.ts builds inline, reproduced from the same
 * inputs it uses. `greetingFirstName` is the real function, and the "||"
 * fallback is the real fallback — a lead FollowUp has no name for (an
 * Instagram DM filed as "Instagram DM") used to fall back to "They",
 * which rendered as "Held because They went quiet".
 */
function unnamedLeadFirstName(): string {
  return greetingFirstName("Instagram DM") || "they";
}

const ALL_REASONS = [
  HOLD_ALL_AUTOMATION_REASON,
  HOLD_ALL_SEQUENCE_REASON,
  RISK_CHECK_FAILED_REASON,
  `${unnamedLeadFirstName()} wrote 5 days ago and never got an answer — this reply is yours to send`,
  `${unnamedLeadFirstName()} went quiet 12 days ago — reaching back out is your call`,
];

describe("a hold reason finishes the sentence ApprovalQueue puts it in", () => {
  it.each(ALL_REASONS)("reads as one sentence: %s", (reason) => {
    const line = renderHeldBecause(reason);
    expect(line).toMatch(/^Held because [a-zA-Z]/);
    expect(line.endsWith(".")).toBe(true);
    // One full stop, at the very end — not a sentence glued onto a clause.
    expect(line.slice(0, -1)).not.toContain(".");
  });

  // The exact shape of the shipped bug: a reason beginning with a
  // capitalised ORDINARY word, which reads as a new sentence starting
  // inside the old one. A proper noun is different — "Held because
  // FollowUp couldn't check this one" is correct English, and so is a
  // lead's real first name. So the rule is "lowercase unless it is a
  // name", and the names we write ourselves are exactly these.
  const PROPER_NOUNS = new Set(["FollowUp", "Google", "Meta", "Instagram", "WhatsApp", "Messenger", "Gmail"]);

  it.each(ALL_REASONS)("does not start a new sentence mid-sentence: %s", (reason) => {
    const firstWord = reason.split(/\s+/)[0];
    if (PROPER_NOUNS.has(firstWord)) return;
    expect(reason[0]).toBe(reason[0].toLowerCase());
  });

  it("puts a real lead's name through unchanged, capital and all", () => {
    const named = greetingFirstName("Priya Raman");
    expect(named).toBe("Priya");
    expect(renderHeldBecause(`${named} went quiet 12 days ago — reaching back out is your call`)).toBe(
      "Held because Priya went quiet 12 days ago — reaching back out is your call."
    );
  });

  it("would have caught the string that shipped", () => {
    const shipped = "Ready to send — this account holds every automated message for you to approve";
    expect(shipped[0]).not.toBe(shipped[0].toLowerCase());
    expect(renderHeldBecause(shipped)).toContain("Held because Ready to send");
  });
});
