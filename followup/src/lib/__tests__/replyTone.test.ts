/**
 * salesPressure (src/lib/replyTone.ts): the check behind A-247's "never a
 * salesperson, never a bot". The bad replies are the trust research's own
 * examples (reports/Realtor replies that win trust.md); the good ones must
 * pass untouched, because a false hold costs the owner a tap on every
 * reply that was fine.
 */
import { describe, it, expect } from "vitest";
import { salesPressure } from "@/lib/replyTone";
import { checkDmDraftShape, inventedSpecific } from "@/lib/dmDrafts";
import { checkAckShape } from "@/lib/acknowledge";
import { UNGROUNDED_DRAFT_REASONS } from "@/lib/holdReasons";
import type { Message } from "@/lib/types";

describe("salesPressure: the research's bad replies are caught", () => {
  it.each([
    "This one won't last! There's tons of interest, so if you're serious you need to book today.",
    "Homes in Leslieville are selling fast, so act now.",
    "Don't miss out on this one.",
    "It's a limited-time chance and only a few left at this price.",
    "Have you given up on buying?",
    "You need to move quickly before it's gone.",
    "I'll get you top dollar for it.",
    "Don't worry, you'll win the next one.",
    "There's been a lot of interest in this one.",
  ])("pressure: %s", (text) => {
    expect(salesPressure(text)).toBe("pressure");
  });

  it.each([
    "I'm a top-producing agent in the Junction.",
    "I'm the Junction's #1 agent.",
    "As an award-winning realtor, I can help.",
    "I'm the best agent in Etobicoke for condos.",
    "I'm your local Junction expert.",
    "I'm in the top 1% of agents in Toronto.",
  ])("brag: %s", (text) => {
    expect(salesPressure(text)).toBe("brag");
  });
});

describe("salesPressure: ordinary, helpful replies pass", () => {
  it.each([
    "Yes, the 2-bed on Logan is still available. Would you like to see it this week?",
    "Three in a row is exhausting, I'm sorry. Would a short call suit you, or would you rather start here by text?",
    "No hurry at all. Is the school the main thing for you?",
    "I'll hurry up and check the fees for you.",
    "I'm not a tax expert, so I'd ask your accountant about that one.",
    "I work in the Junction a lot. Are you looking at freehold or condos?",
    "Thanks for letting me know, Jason. Good luck with the search.",
    "Is unit #1 the one with the terrace?",
    "Here are the top 3 things to check on a semi that age.",
  ])("%s", (text) => {
    expect(salesPressure(text)).toBeNull();
  });
});

describe("salesPressure: grounded only by the owner's own words", () => {
  it("allows a deadline the business itself wrote, never one the customer wrote", () => {
    const draft = "Offers are reviewed Tuesday and it won't last long, so I wanted you to have that early.";
    expect(salesPressure(draft, { said: "Offers Tuesday. This one won't last." })).toBeNull();
    expect(salesPressure(draft)).toBe("pressure");
  });

  it("a ranking the owner stored as a fact is theirs to state; the facts never ground pressure", () => {
    expect(salesPressure("I'm a top-producing agent with RE/MAX.", { facts: "Award: top-producing agent, RE/MAX Hall of Fame 2025" })).toBeNull();
    expect(salesPressure("Act now, it won't last.", { facts: "Never say: act now, it won't last" })).toBe("pressure");
  });

  it("treats curly and straight apostrophes the same", () => {
    expect(salesPressure("This one won’t last.")).toBe("pressure");
    expect(salesPressure("This one won’t last.", { said: "this one won't last" })).toBeNull();
  });
});

const msg = (direction: "inbound" | "outbound", body: string): Message => ({
  id: `${direction}-${body.length}`,
  direction,
  channel: "instagram",
  body,
  date: "2026-10-14T12:00:00.000Z",
  opened: false,
});

describe("the checks that run before an unreviewed send", () => {
  it("a pushy DM fails its check, so it is retried and then held with a plain reason", () => {
    const r = checkDmDraftShape(
      { body: "This semi won't last, so if you're serious you should see it soon. Which day suits you best?", buttons: [] },
      "Can I see the Danforth semi?",
      "en",
      ""
    );
    expect(r).toEqual({ ok: false, rule: "pressure" });
    expect(UNGROUNDED_DRAFT_REASONS.pressure).toMatch(/rushes them/);
  });

  it("a bragging email is held, unless the owner's facts say it", () => {
    const conversation = [msg("inbound", "Thinking of buying in the Junction. Do you know the area?")];
    const text = "Yes, I'm an award-winning agent and I know the Junction well. Are you looking at freehold or condos?";
    expect(inventedSpecific(text, conversation, "en")).toBe("brag");
    expect(inventedSpecific(text, conversation, "en", "Awards: award-winning agent, TRREB 2025")).toBeNull();
    expect(UNGROUNDED_DRAFT_REASONS.brag).toMatch(/ranking or title/);
  });

  it("the instant first reply falls back to the fixed line rather than push", () => {
    expect(checkAckShape("Got it, this one won't last so I'll be quick and come back shortly.", "Is the condo on King available?", "Sam")).toEqual({ ok: false, rule: "pressure" });
    expect(checkAckShape("Got it, I'll find out about the condo on King and come back to you shortly.", "Is the condo on King available?", "Sam")).toEqual({ ok: true });
  });
});
