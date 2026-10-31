/**
 * A pasted real conversation is cleaned before it is kept as a test (src/lib/realChatText.ts): names, emails, phone
 * numbers, postal codes, links and @handles out; prices, dates and the words of the chat in.
 */
import { describe, expect, it } from "vitest";
import { cleanChat, endsRight, parseChat, scrub, splitList, stepForDays } from "@/lib/realChatText";

describe("cleaning a real chat", () => {
  const names = { customer: ["Priya", "Priya Shah"], business: ["Raj", "Raj Homes"] };

  it("replaces the names given, whole words only, in any case", () => {
    expect(scrub("Hi Priya Shah, it's Raj from Raj Homes. Rajesh says hi. PRIYA?", names)).toBe("Hi Sam, it's Alex from Alex. Rajesh says hi. Sam?");
  });

  it("takes out emails, links, handles, postal codes and phone numbers", () => {
    const out = scrub("Email me at priya.s@gmail.com or call 416-555-0199 / +1 (647) 555 0123. See www.example.com and @priyahomes. M5V 2T6", names);
    expect(out).toBe("Email me at [email] or call [phone] / [phone]. See [link] and [handle]. [postal code]");
  });

  it("keeps prices, dates and times", () => {
    const text = "It's listed at $1,149,000, maybe 900k after the open house on 12/14 at 2:30.";
    expect(scrub(text, names)).toBe(text);
  });

  it("reads one message per prefixed line, carrying on lines with no prefix", () => {
    const { lines, error } = parseChat("Customer: Is the condo still available?\nwe love the view\n\nMe: Hi! Yes it is.\nCustomer: What are the fees?");
    expect(error).toBeUndefined();
    expect(lines).toEqual([
      { who: "in", text: "Is the condo still available?\nwe love the view" },
      { who: "out", text: "Hi! Yes it is." },
      { who: "in", text: "What are the fees?" },
    ]);
  });

  it("refuses a chat with no prefix, no customer, or too much", () => {
    expect(parseChat("Hello there").error).toBeTruthy();
    expect(parseChat("Me: hi").error).toBeTruthy();
    expect(parseChat(Array.from({ length: 41 }, () => "Customer: hi").join("\n")).error).toBeTruthy();
  });

  it("checks the chat ends where the task starts", () => {
    const lines = [{ who: "in" as const }, { who: "out" as const }];
    expect(endsRight(lines, { kind: "followup", daysQuiet: 3 })).toBeNull();
    expect(endsRight(lines, { kind: "reply" })).toBeTruthy();
    expect(endsRight([{ who: "in" }], { kind: "stop", shouldStop: true })).toBeNull();
  });

  it("dates the chat for a follow-up, and picks the plan's step for the quiet days", () => {
    const kept = cleanChat([{ who: "in", text: "Hi I'm Priya" }, { who: "out", text: "Hi!" }], names, { kind: "followup", daysQuiet: 7 });
    expect(kept).toEqual([
      { who: "in", text: "Hi I'm Sam", daysAgo: 7 },
      { who: "out", text: "Hi!", daysAgo: 7 },
    ]);
    expect(stepForDays(1)).toEqual({ step: 0, angle: "open" });
    expect(stepForDays(3)).toEqual({ step: 1, angle: "new" });
    expect(stepForDays(7)).toEqual({ step: 2, angle: "step" });
    expect(stepForDays(30)).toEqual({ step: 4, angle: "close" });
  });

  it("splits list fields by line or comma", () => {
    expect(splitList("a 2 bed, near the subway\nunder 700k")).toEqual(["a 2 bed", "near the subway", "under 700k"]);
  });
});
