/**
 * FollowUp's call (founder, 2026-10-22): where a customer stands and the one next step, worked out by FollowUp alone.
 * The owner is never asked to grade it.
 */
import { describe, it, expect } from "vitest";
import { afterReply, CALLS_SHOWN_FROM, readyFacts, readyNext, readyOutcome, tallyCalls, TIER_WORD, todayCall } from "@/lib/followUpCall";
import type { Qualification } from "@/lib/qualification";

const buyer = (extra: Qualification["items"] = []): Qualification => ({
  v: 2,
  template: "realtor",
  tier: "ready",
  items: [
    { key: "side", value: "Buying", quote: "we're pre-approved", bucket: "buy" },
    { key: "timing", value: "Before March", quote: "before March", bucket: "soon" },
    { key: "financing", value: "Pre-approved up to $900k", quote: "pre-approved up to $900k", bucket: "sorted" },
    ...extra,
  ],
});
const seller: Qualification = {
  v: 2,
  template: "realtor",
  tier: "ready",
  items: [
    { key: "side", value: "Selling", quote: "selling our place", bucket: "sell" },
    { key: "home", value: "18 Birch Cres", quote: "18 Birch Cres" },
    { key: "timing", value: "In two months", quote: "in the next couple of months", bucket: "soon" },
    { key: "why", value: "Downsizing", quote: "too big now" },
  ],
};
const plan = (over: Partial<{ title: string; sentence: string; status: string; staying: boolean; waitingFor: string | null }> = {}) => ({
  title: "On the Fast plan",
  sentence: "It starts once Priya has had your reply.",
  status: "after your reply",
  staying: false,
  waitingFor: null,
  ...over,
});

describe("the owner's next step for a Ready customer", () => {
  it("a buyer who asked to see a home: call today, or reply with a time when there is no number", () => {
    const q = buyer([{ key: "viewing", value: "Asked to see it Saturday", quote: "Could we see it this Saturday?" }]);
    expect(readyNext(readyFacts(q, "Raj", true))).toBe("call Raj today to set up the showing.");
    expect(readyNext(readyFacts(q, "Raj", false))).toBe("reply to Raj with a time for the showing.");
  });

  it("a buyer ready to look, with no home named yet", () => {
    expect(readyNext(readyFacts(buyer(), "Raj", true))).toBe("call Raj today. Raj is ready to start viewing.");
    expect(readyNext(readyFacts(buyer(), "Raj", false))).toBe("offer Raj a time to see homes.");
  });

  it("a seller: a visit to their home, by name", () => {
    expect(readyNext(readyFacts(seller, "Linda", true))).toBe("call Linda today to book a visit to 18 Birch Cres.");
    expect(readyNext(readyFacts(seller, "Linda", false))).toBe("reply to Linda with a time to visit 18 Birch Cres.");
  });

  it("already booked through the booking link: nothing to chase", () => {
    const q = buyer([{ key: "viewing", value: "Sat, Oct 24, 11:00 AM", quote: "", source: "booking" }]);
    expect(readyNext(readyFacts(q, "Raj", true))).toBe("the showing is booked. Nothing to do before it.");
  });
});

describe("what comes after the reply, from the plan the engine sends by", () => {
  it("on a plan: FollowUp follows up, and says whether each message waits for the owner", () => {
    expect(afterReply(plan(), "Priya", false)).toBe("Then FollowUp follows up on the Fast plan. Nothing more for you to do.");
    expect(afterReply(plan({ title: "On the Long plan" }), "Tom", true)).toBe("Then FollowUp follows up on the Long plan. Each one waits for your OK.");
    expect(afterReply(plan({ title: "On your own plan" }), "Tom", false)).toBe("Then FollowUp follows up on your own plan. Nothing more for you to do.");
  });

  it("never promises a message that won't go: a paused plan says why", () => {
    expect(afterReply(plan({ status: "paused", sentence: "Paused: check-ins are switched off in Settings." }), "Priya", false)).toBe(
      "Paused: check-ins are switched off in Settings."
    );
  });

  it("a day they asked for, staying in touch, a special plan, and no plan at all", () => {
    expect(afterReply(plan({ waitingFor: "Mar 1" }), "Priya", false)).toBe("Then FollowUp waits until Mar 1, as Priya asked, and follows up from there. Nothing more for you to do.");
    expect(afterReply(plan({ title: "Staying in touch", staying: true }), "Priya", true)).toBe("Then FollowUp keeps in touch with Priya when you have something new. Each one waits for your OK.");
    expect(afterReply(plan({ title: "On a special plan", sentence: "“Open house” runs instead of the usual plan." }), "Priya", false)).toBe(
      "“Open house” runs instead of the usual plan."
    );
    expect(afterReply(null, "Priya", false)).toBeNull();
  });
});

describe("Today's line under the open person", () => {
  it("Ready: send this, then the owner's step", () => {
    const q = buyer([{ key: "viewing", value: "Asked to see it Saturday", quote: "Could we see it this Saturday?" }]);
    expect(todayCall("ready", { first: "Raj", ready: readyFacts(q, "Raj", true), plan: plan(), holdAll: false })).toBe(
      "Send this, then call Raj today to set up the showing."
    );
  });

  it("Warm and Later: send this, then what FollowUp does on its own", () => {
    expect(todayCall("warm", { first: "Priya", ready: null, plan: plan(), holdAll: false })).toBe(
      "Send this. Then FollowUp follows up on the Fast plan. Nothing more for you to do."
    );
    expect(todayCall("later", { first: "Tom", ready: null, plan: null, holdAll: false })).toBeNull();
  });

  it("has an agent: FollowUp stops", () => {
    expect(todayCall("agent", { first: "Sam", ready: null, plan: null, holdAll: false })).toBe("Sam already has an agent. After this, FollowUp stops following up.");
  });

  it("the words on the tags", () => {
    expect(Object.values(TIER_WORD)).toEqual(["Ready", "Warm", "Later", "Has an agent"]);
  });
});

describe("what FollowUp's calls came to (Results)", () => {
  it("counts each call once, and the Ready ones that booked or bought", () => {
    const t = tallyCalls([
      { tier: "ready", booked: true, won: false },
      { tier: "ready", booked: false, won: true },
      { tier: "ready", booked: false, won: false },
      { tier: "warm", booked: true, won: false },
      { tier: "later", booked: false, won: false },
      { tier: "agent", booked: false, won: false },
      { tier: null, booked: true, won: false },
    ]);
    expect(t).toEqual({ sorted: 6, ready: 3, warm: 1, later: 1, agent: 1, readyBooked: 2 });
    expect(readyOutcome(t)).toBe("2 of your 3 Ready customers booked a time with you.");
  });

  it("says one Ready customer and none plainly", () => {
    expect(readyOutcome({ sorted: 5, ready: 1, warm: 4, later: 0, agent: 0, readyBooked: 1 })).toBe("Your Ready customer booked a time with you.");
    expect(readyOutcome({ sorted: 5, ready: 1, warm: 4, later: 0, agent: 0, readyBooked: 0 })).toBe("Your Ready customer hasn't booked yet.");
    expect(readyOutcome({ sorted: 5, ready: 0, warm: 5, later: 0, agent: 0, readyBooked: 0 })).toBe("Nobody was Ready yet. FollowUp tells you the moment someone is.");
  });

  it("waits for five sorted customers before showing anything", () => {
    expect(CALLS_SHOWN_FROM).toBe(5);
  });
});
