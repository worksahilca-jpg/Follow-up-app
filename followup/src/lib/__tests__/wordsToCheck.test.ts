/**
 * The words to check, underlined inside the draft (research round 2, #1):
 * the same rules as the hold, returning the words themselves.
 */
import { describe, it, expect } from "vitest";
import { wordsToCheck } from "@/lib/grounding";

describe("words to check", () => {
  it("finds the price and the day nobody wrote, in the order they appear", () => {
    const source = "Hi, what's the asking price for the 3-bed on Oak Ave? Can I see it this weekend?";
    const draft = "Hi Daniel, the asking price is $649,000, and I can show it to you on Saturday at 11.";
    expect(wordsToCheck(draft, source)).toEqual(["649,000", "Saturday", "11"]);
  });

  it("leaves alone what the customer or the business already wrote", () => {
    const source = "Is the 3-bed still $649,000? I'm free Saturday.";
    expect(wordsToCheck("Yes, the 3-bed is $649,000. Saturday works.", source)).toEqual([]);
  });

  it("never asks about the blank the owner fills", () => {
    expect(wordsToCheck("Thanks for asking. [ANSWER: parking] Would you like to see it?", "Is parking included?")).toEqual([]);
    expect(wordsToCheck("It is [PRICE] a month.", "How much is it?")).toEqual([]);
  });

  it("catches a price said in words", () => {
    expect(wordsToCheck("It's fifty dollars for the visit.", "How much is a visit?")).toEqual(["dollars"]);
  });
});
