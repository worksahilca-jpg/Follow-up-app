/**
 * "Not a customer", and why (A-259): the four answers, what the owner is told
 * FollowUp will do, and when "Set these aside from now on?" is asked.
 */
import { describe, it, expect } from "vitest";
import {
  ASK_AFTER,
  NOT_CUSTOMER_REASONS,
  REASON_LABEL,
  cleanKinds,
  isNotCustomerReason,
  isSetAsideKind,
  shouldAskAlways,
  standingRuleNotice,
  whatFollowUpWillDo,
} from "@/lib/notCustomerReasons";
import { readNotCustomerMeta } from "@/lib/notCustomerStats";

describe("the four answers", () => {
  it("are the drawn ones, in order", () => {
    expect(NOT_CUSTOMER_REASONS.map((r) => REASON_LABEL[r])).toEqual(["A friend or family", "Someone I work with", "Selling me something", "Spam"]);
  });

  it("accepts only those four", () => {
    expect(NOT_CUSTOMER_REASONS.every(isNotCustomerReason)).toBe(true);
    for (const bad of ["", "enemy", null, undefined, 3, "FRIEND"]) expect(isNotCustomerReason(bad)).toBe(false);
  });

  it("asks 'from now on' only about kinds, never about a person", () => {
    expect(isSetAsideKind("selling")).toBe(true);
    expect(isSetAsideKind("spam")).toBe(true);
    expect(isSetAsideKind("friend")).toBe(false);
    expect(isSetAsideKind("work")).toBe(false);
  });
});

describe("what FollowUp will do, said before the owner confirms", () => {
  it("names the person for a friend or a colleague", () => {
    expect(whatFollowUpWillDo("friend", "Karan", null)).toBe("FollowUp won't treat Karan as a customer again, and keeps their messages out of Today.");
    expect(whatFollowUpWillDo("work", "Karan", "karan@example.com")).toMatch(/^FollowUp won't treat Karan/);
  });

  it("says chat or email for selling and spam, and that nothing is deleted", () => {
    expect(whatFollowUpWillDo("selling", "Ana", null)).toBe("FollowUp sets this chat aside and gets better at spotting pitches like it. It never deletes them.");
    expect(whatFollowUpWillDo("spam", "Ana", "x@y.com")).toBe("FollowUp sets this email aside and gets better at spotting spam like it. It never deletes it.");
  });

  it("with no answer, says what happened before A-259", () => {
    expect(whatFollowUpWillDo(null, "Ana", "ana@example.com")).toBe("Future emails from ana@example.com are set aside too.");
    expect(whatFollowUpWillDo(null, "Ana", null)).toBe("If they write again, FollowUp checks again.");
  });
});

describe("Set these aside from now on?", () => {
  it(`comes at the ${ASK_AFTER}rd answer of a kind, once`, () => {
    expect(shouldAskAlways("selling", ASK_AFTER - 1, [])).toBe(false);
    expect(shouldAskAlways("selling", ASK_AFTER, [])).toBe(true);
    expect(shouldAskAlways("spam", ASK_AFTER + 2, [])).toBe(true);
    expect(shouldAskAlways("selling", ASK_AFTER, ["selling"])).toBe(false);
    expect(shouldAskAlways("spam", ASK_AFTER, ["selling"])).toBe(true);
  });

  it("never comes for a friend, a colleague or no answer", () => {
    expect(shouldAskAlways("friend", 10, [])).toBe(false);
    expect(shouldAskAlways("work", 10, [])).toBe(false);
    expect(shouldAskAlways(null, 10, [])).toBe(false);
  });

  it("keeps only known kinds from the stored column, each once", () => {
    expect(cleanKinds(["spam", "selling", "spam", "friend", "x"])).toEqual(["selling", "spam"]);
    expect(cleanKinds(null)).toEqual([]);
    expect(cleanKinds("selling")).toEqual([]);
  });

  it("becomes one fixed sentence for the checker, or nothing", () => {
    expect(standingRuleNotice([])).toBe("");
    const both = standingRuleNotice(["selling", "spam"]);
    expect(both).toContain("anyone selling to the owner");
    expect(both).toContain("spam, scams and bots");
    expect(both).toContain("A person asking about the owner's own service still is.");
  });
});

describe("the founder's counts read the audit log defensively", () => {
  it("reads an answer and a channel", () => {
    expect(readNotCustomerMeta({ reason: "selling", channel: "instagram" })).toEqual({ answer: "selling", channel: "instagram" });
  });

  it("treats rows from before A-259 as email with no answer", () => {
    expect(readNotCustomerMeta({ threads: 2 })).toEqual({ answer: "none", channel: "email" });
    expect(readNotCustomerMeta({ channel: "instagram" })).toEqual({ answer: "none", channel: "instagram" });
    expect(readNotCustomerMeta(null)).toEqual({ answer: "none", channel: "email" });
    expect(readNotCustomerMeta({ reason: "hacked", channel: "sms" })).toEqual({ answer: "none", channel: "email" });
  });
});
