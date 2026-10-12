/**
 * The DM customer-check test (src/lib/dmJudgeEval.ts). It runs against the
 * real model; these prove the harness scores honestly, and that a lost
 * customer is never counted as anything but the worst kind of miss.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/inbound/whatsappHistoryFilter", () => ({ judgeHistoryThread: vi.fn() }));

import { DM_JUDGE_CASES, runDmJudgeEval, type DmJudgeCase } from "@/lib/dmJudgeEval";

describe("DM_JUDGE_CASES", () => {
  it("has both sides, with unique names", () => {
    expect(DM_JUDGE_CASES.filter((c) => c.expectCustomer).length).toBeGreaterThanOrEqual(10);
    expect(DM_JUDGE_CASES.filter((c) => !c.expectCustomer).length).toBeGreaterThanOrEqual(10);
    expect(new Set(DM_JUDGE_CASES.map((c) => c.name)).size).toBe(DM_JUDGE_CASES.length);
  });

  // The live check judges a chat once its newest message has words (the
  // first look, dmContactGate.ts, or a later one, dmRecheck.ts, A-239), so
  // an earlier emoji or "hi" may sit above it.
  it("holds only what the live check judges: the newest message has words, never only a greeting", () => {
    for (const c of DM_JUDGE_CASES) {
      const newest = [...c.lines].reverse().find(([who]) => who === "in")?.[1] ?? "";
      expect(newest.trim().length, c.name).toBeGreaterThan(3);
      expect(/^(hi|hello|hey)[!. ]*$/i.test(newest.trim()), c.name).toBe(false);
    }
  });
});

const friend: DmJudgeCase = { name: "friend", business: { name: "B", industry: "Real estate" }, lines: [["in", "hey bro what's up"]], expectCustomer: false };
const buyer: DmJudgeCase = { name: "buyer", business: { name: "B", industry: "Real estate" }, lines: [["in", "Is the condo still available?"]], expectCustomer: true };

describe("runDmJudgeEval scoring", () => {
  it("counts a customer set aside and a friend let through apart", async () => {
    const judge = vi.fn(async (messages: { body: string }[]) =>
      messages[0].body.startsWith("Is") ? { import: false as const, reason: "Small talk." } : { import: true as const }
    );
    const r = await runDmJudgeEval(judge as never, [friend, buyer]);
    expect(r).toMatchObject({ cases: 2, right: 0, customersSetAside: 1, chatsLetThrough: 1 });
    expect(r.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "buyer", expected: "customer", got: "set aside", reason: "Small talk." }),
        expect.objectContaining({ name: "friend", expected: "set aside", got: "customer" }),
      ])
    );
  });

  it("asks the judge the way the live check does for someone new", async () => {
    const judge = vi.fn(async () => ({ import: true as const }));
    const r = await runDmJudgeEval(judge as never, [buyer]);
    expect(r.right).toBe(1);
    expect(judge).toHaveBeenCalledWith(
      [expect.objectContaining({ direction: "inbound", channel: "instagram", body: "Is the condo still available?" })],
      expect.objectContaining({ phone: expect.stringMatching(/^ig:/) }),
      buyer.business,
      { knownOnAnotherChannel: false },
      { alreadySetAside: false }
    );
  });
});
