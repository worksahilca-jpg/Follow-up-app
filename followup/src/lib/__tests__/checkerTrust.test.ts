/**
 * Plan step 4, "Check the checker" (A-321): which of FollowUp's checks agree with the founder well enough to count
 * against a lesson, and which become advice only.
 */
import { describe, it, expect } from "vitest";
import { advisoryChecks, agreement, checkTrust, trustLine, withAdvice, type MarkedReply } from "@/lib/checkerTrust";

const send = (checker: string[] = []): MarkedReply => ({ verdict: "send", marked: [], checker });
const fix = (marked: string[], checker: string[] = []): MarkedReply => ({ verdict: "fix", marked, checker });
const times = (n: number, r: MarkedReply) => Array.from({ length: n }, () => r);
const trustOf = (replies: MarkedReply[], check: string) => checkTrust(replies).find((t) => t.check === check)!;

describe("checkTrust", () => {
  it("trusts a check that catches 8 in 10 of what the founder flags and rarely flags what they'd send", () => {
    const replies = [...times(8, fix(["invented"], ["invented"])), ...times(2, fix(["invented"])), ...times(20, send())];
    expect(trustOf(replies, "invented")).toEqual({ check: "invented", flagged: 10, caught: 8, missed: 2, falseAlarms: 0, status: "trusted" });
  });

  it("makes a check that misses too much advice only", () => {
    const replies = [...times(3, fix(["unanswered"], ["unanswered"])), ...times(3, fix(["unanswered"])), ...times(20, send())];
    expect(trustOf(replies, "unanswered").status).toBe("advice");
  });

  it("makes a check that flags too many good replies advice only, even before it has 5 flags to judge", () => {
    // The drawing's "could have gone to anyone": 4 flagged, 2 caught, 9 of the founder's good replies flagged.
    const replies = [...times(2, fix(["generic"], ["generic"])), ...times(2, fix(["generic"])), ...times(9, send(["generic"])), ...times(30, send())];
    expect(trustOf(replies, "generic")).toMatchObject({ flagged: 4, caught: 2, falseAlarms: 9, status: "advice" });
  });

  it("is too few to tell under 5 flags, and then keeps counting as before", () => {
    const replies = [...times(3, fix(["pressure"], ["pressure"])), ...times(20, send())];
    expect(trustOf(replies, "pressure").status).toBe("too_few");
    expect(advisoryChecks(replies)).toEqual([]);
  });

  it("doesn't judge false alarms on fewer than 10 replies the founder would send", () => {
    const replies = [...times(5, fix(["brag"], ["brag"])), send(["brag"]), send()];
    expect(trustOf(replies, "brag").status).toBe("trusted");
  });

  it("leaves skipped and unmarked replies out", () => {
    const replies: MarkedReply[] = [{ verdict: "skip", marked: [], checker: ["invented"] }, { verdict: null, marked: [], checker: ["invented"] }, send()];
    expect(trustOf(replies, "invented")).toMatchObject({ flagged: 0, falseAlarms: 0 });
    expect(agreement(replies)).toEqual({ judged: 1, agreed: 1 });
  });
});

describe("agreement", () => {
  it("counts the replies where the founder and the checker said the same: send it, or don't", () => {
    const replies = [send(), send(["generic"]), fix(["invented"], ["unanswered"]), fix(["other"])];
    expect(agreement(replies)).toEqual({ judged: 4, agreed: 2 });
  });
});

describe("trustLine", () => {
  it("says each check in one plain sentence", () => {
    expect(trustLine({ check: "invented", flagged: 6, caught: 5, missed: 1, falseAlarms: 1, status: "trusted" })).toBe(
      "You flagged 6. The checker caught 5 and missed 1. It flagged 1 you were fine with."
    );
    expect(trustLine({ check: "pressure", flagged: 3, caught: 3, missed: 0, falseAlarms: 0, status: "too_few" })).toBe(
      "You flagged 3. The checker caught all 3. It flagged none you were fine with."
    );
    expect(trustLine({ check: "language", flagged: 0, caught: 0, missed: 0, falseAlarms: 0, status: "too_few" })).toBe(
      "You flagged none, and neither did the checker."
    );
    expect(trustLine({ check: "brag", flagged: 1, caught: 0, missed: 1, falseAlarms: 2, status: "too_few" })).toBe(
      "You flagged 1. The checker missed it. It flagged 2 you were fine with."
    );
  });
});

describe("withAdvice", () => {
  it("moves an advice-only check's finding out of the problems, and keeps it", () => {
    expect(withAdvice({ reply: "x", problems: ["generic", "unanswered"], hard: [] }, new Set(["generic"]))).toEqual({
      reply: "x",
      problems: ["unanswered"],
      hard: [],
      advice: ["generic"],
    });
  });

  it("never sets aside what code decided", () => {
    const t = { reply: "x", problems: ["pressure"], hard: ["pressure"] };
    expect(withAdvice(t, new Set(["pressure"]))).toBe(t);
  });
});
