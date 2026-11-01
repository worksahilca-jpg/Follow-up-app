/**
 * Template leftovers never reach a customer (src/lib/strayPlaceholder.ts): "[Your Name]", "{first_name}" and
 * "<insert date>" are caught by plain rules, while FollowUp's own blanks and ordinary text are left alone.
 */
import { describe, expect, it } from "vitest";
import { strayPlaceholder, strayPlaceholderReason } from "@/lib/strayPlaceholder";
import { plainHoldReason } from "@/lib/holdReasons";

describe("template leftovers", () => {
  it.each([
    ["Thanks for reaching out! Best, [Your Name]", "[Your Name]"],
    ["Happy to help, [Agent Name] here.", "[Agent Name]"],
    ["I can show it on [date] at [time].", "[date]"],
    ["Here's my calendar: [Calendar Link]", "[Calendar Link]"],
    ["The home at [Property Address] is still available.", "[Property Address]"],
    ["Hi {first_name}, thanks for your message.", "{first_name}"],
    ["Hi {{ contact.first_name }}!", "{{ contact.first_name }}"],
    ["We could meet on <insert date>.", "<insert date>"],
    ["Call me at [phone number] any time.", "[phone number]"],
    ["Talk soon,\n[Brokerage Name]", "[Brokerage Name]"],
  ])("catches %j", (text, token) => {
    expect(strayPlaceholder(text)).toBe(token);
  });

  it.each([
    "Thanks! The price is [PRICE] and it includes parking.",
    "Parking is [ANSWER: parking] for this unit.",
    "Sounds good, see you Saturday at 2.",
    "He said it was 'great [sic]' which made me laugh <3",
    "Use the side door (the one by the garage).",
    "All the photos are on [my website](https://example.com/listing).",
    "",
  ])("leaves %j alone", (text) => {
    expect(strayPlaceholder(text)).toBeNull();
  });

  it("handles nothing at all", () => {
    expect(strayPlaceholder(null)).toBeNull();
    expect(strayPlaceholder(undefined)).toBeNull();
  });
});

describe("what the owner reads on Today", () => {
  it("says what to change, even when the leftover names a topic", () => {
    for (const token of ["[Your Name]", "[booking link]", "[amount]"]) {
      expect(plainHoldReason(strayPlaceholderReason(token), { firstName: "Elena", topic: "other" })).toBe(`Change "${token}" to the real words, then send.`);
    }
  });
});
