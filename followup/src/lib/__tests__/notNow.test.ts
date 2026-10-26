import { describe, expect, it } from "vitest";
import { NO_CONVERSATIONS } from "@/lib/noConversations";
import { NOT_NOW_HINT, checkBackDay, notNowIn, notNowQuote, notNowStep, readNotNowPlan } from "@/lib/notNow";

const lastWords = (id: string) => {
  const c = NO_CONVERSATIONS.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c.msgs[c.msgs.length - 1][1];
};

describe("notNowIn (A-329)", () => {
  it("reads timing in the maybe-no conversations", () => {
    for (const id of ["c01", "c02", "c06", "c07", "c08", "c10"]) expect(notNowIn(lastWords(id)), id).toBe(true);
  });

  it("leaves a maybe-no that isn't timing, or that leaves the next move with them", () => {
    // c03 wife not keen, c04 "we'll let you know", c05 not sure at all, c09 "nah I'm good", c11 "I'll reach out when I'm ready".
    for (const id of ["c03", "c04", "c05", "c09", "c11"]) expect(notNowIn(lastWords(id)), id).toBe(false);
  });

  it("never reads a message that wants something now as not now", () => {
    for (const c of NO_CONVERSATIONS.filter((x) => x.expect === "keep")) expect(notNowIn(c.msgs[c.msgs.length - 1][1]), c.id).toBe(false);
    expect(notNowIn("Not now, I'm at work. Call me after 6?")).toBe(false);
    expect(notNowIn("Not right now, but yes later this year")).toBe(false);
  });

  it("reads the common ways of saying it", () => {
    for (const t of ["Not right now, thanks", "We're not ready yet.", "Maybe later", "Let's put it on hold", "Try again after the holidays", "Plus tard, merci", "Ahora no, gracias"]) {
      expect(notNowIn(t), t).toBe(true);
    }
  });
});

describe("checkBackDay", () => {
  const sent = Date.parse("2026-10-26T15:00:00Z");
  it("takes the time they gave", () => {
    const at = checkBackDay("Not right now. Maybe next spring.", sent);
    expect(at).not.toBeNull();
    expect(new Date(at!).getUTCFullYear()).toBe(2027);
  });
  it("is null with no time, or past the six-month window", () => {
    expect(checkBackDay("Not right now.", sent)).toBeNull();
    expect(checkBackDay("Not right now. Maybe next fall.", sent)).toBeNull();
  });
});

describe("notNowStep", () => {
  const sentAt = new Date("2026-10-26T15:00:00Z");
  const base = { noHow: "unsure" as const, sentAt, onPath: null };

  it("by default (and on Stop) writes a warm thanks with no question and starts nothing", () => {
    for (const plan of [null, "stop"] as const) {
      expect(notNowStep({ ...base, plan, text: "Not right now." })).toEqual({ hint: NOT_NOW_HINT.close, notNowAt: undefined, day: null });
    }
  });

  it("on Ask, asks once when, and starts the path", () => {
    expect(notNowStep({ ...base, plan: "ask", text: "Not right now." })).toEqual({ hint: NOT_NOW_HINT.ask, notNowAt: sentAt, day: null });
  });

  it("on Ask, confirms a time they already gave and keeps it for the one check-back", () => {
    const s = notNowStep({ ...base, plan: "ask", text: "Not right now. Maybe next spring." });
    expect(s.hint).toBe(NOT_NOW_HINT.confirm);
    expect(s.notNowAt).toEqual(sentAt);
    expect(s.day).not.toBeNull();
  });

  it("their answer with a time keeps them on the path and sets the day", () => {
    const onPath = new Date("2026-10-20T15:00:00Z");
    const s = notNowStep({ plan: "ask", noHow: null, text: "Probably next spring works.", sentAt, onPath });
    expect(s).toMatchObject({ hint: NOT_NOW_HINT.confirm, notNowAt: onPath });
    expect(s.day).not.toBeNull();
  });

  it("asks only once: a second 'not now' with no time gets a thanks", () => {
    const onPath = new Date("2026-10-20T15:00:00Z");
    expect(notNowStep({ plan: "ask", noHow: "unsure", text: "Not yet.", sentAt, onPath })).toEqual({ hint: NOT_NOW_HINT.close, notNowAt: onPath, day: null });
  });

  it("re-reading the same message is not a second ask", () => {
    expect(notNowStep({ plan: "ask", noHow: "unsure", text: "Not right now.", sentAt, onPath: sentAt }).hint).toBe(NOT_NOW_HINT.ask);
  });

  it("a clear no, or an agent, ends the path", () => {
    const onPath = new Date("2026-10-20T15:00:00Z");
    for (const noHow of ["clear", "agent"] as const) {
      expect(notNowStep({ plan: "ask", noHow, text: "Not interested, thanks.", sentAt, onPath })).toEqual({ hint: null, notNowAt: null, day: null });
    }
  });

  it("anything else ends the path: they're back in a normal conversation", () => {
    const onPath = new Date("2026-10-20T15:00:00Z");
    expect(notNowStep({ plan: "ask", noHow: null, text: "Can we see the house on Main St this weekend?", sentAt, onPath })).toEqual({ hint: null, notNowAt: null, day: null });
  });

  it("leaves everyone else alone", () => {
    expect(notNowStep({ plan: "ask", noHow: null, text: "What's the price?", sentAt, onPath: null })).toEqual({ hint: null, notNowAt: undefined, day: null });
    expect(notNowStep({ plan: "ask", noHow: "unsure", text: "nah I'm good", sentAt, onPath: null })).toEqual({ hint: null, notNowAt: undefined, day: null });
  });
});

describe("helpers", () => {
  it("reads only the two plans", () => {
    expect(readNotNowPlan("ask")).toBe("ask");
    expect(readNotNowPlan("stop")).toBe("stop");
    expect(readNotNowPlan("other")).toBeNull();
    expect(readNotNowPlan(null)).toBeNull();
  });
  it("keeps their words short", () => {
    expect(notNowQuote("  Not   right now.  ")).toBe("Not right now.");
    expect(notNowQuote("x".repeat(500)).length).toBeLessThanOrEqual(240);
  });
});
