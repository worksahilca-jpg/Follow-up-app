import { describe, expect, it } from "vitest";
import {
  baseName,
  caseOutcomes,
  compareWithBefore,
  estimateRunMicros,
  FIRST_ESTIMATE_MICROS,
  flakyOnVersion,
  kindOf,
  pickCases,
  priceWords,
  readRunAsk,
  runToShow,
  steadyVerdict,
  type RunSummary,
} from "@/lib/testRunMath";

const run = (over: Partial<RunSummary>): RunSummary => ({
  id: "r",
  createdAt: "2026-10-31T08:00:00.000Z",
  test: "conversations",
  kind: "full",
  recheckOf: null,
  version: "abc1234",
  cases: 3,
  passed: 3,
  errors: 0,
  ran: ["A", "B", "C"],
  failed: [],
  costMicros: 300_000,
  ...over,
});

describe("what a Run button asks for", () => {
  it("is every case when nothing is named", () => {
    const ask = readRunAsk(null);
    expect(ask).toEqual({ only: null, repeat: 1, recheckOf: null });
    expect(kindOf(ask as never)).toBe("full");
  });

  it("names cases once each, and a recheck needs the run it checks", () => {
    expect(readRunAsk({ only: ["A", "A", "B"] })).toEqual({ only: ["A", "B"], repeat: 1, recheckOf: null });
    expect(readRunAsk({ only: ["A"], repeat: 2 })).toHaveProperty("error");
    expect(kindOf(readRunAsk({ only: ["A"], repeat: 2, recheckOf: "r1" }) as never)).toBe("recheck");
  });

  it("refuses anything odd rather than guessing: each run is paid calls", () => {
    expect(readRunAsk({ only: [] })).toHaveProperty("error");
    expect(readRunAsk({ only: "A" })).toHaveProperty("error");
    expect(readRunAsk({ only: [3] })).toHaveProperty("error");
    expect(readRunAsk({ repeat: 2 })).toHaveProperty("error");
    expect(readRunAsk({ only: ["A"], repeat: 5, recheckOf: "r" })).toHaveProperty("error");
    expect(readRunAsk({ only: Array.from({ length: 301 }, (_, i) => `c${i}`) })).toHaveProperty("error");
  });
});

describe("picking the cases", () => {
  const all = [{ name: "A" }, { name: "B" }, { name: "C" }];

  it("runs only the named ones, skipping a name that no longer exists", () => {
    expect(pickCases(all, { only: ["B", "Gone"], repeat: 1, recheckOf: null })).toEqual([{ name: "B" }]);
    expect(pickCases(all, { only: ["Gone"], repeat: 1, recheckOf: null })).toHaveProperty("error");
  });

  it("gives each try of a recheck its own name, so results can't mix", () => {
    const tries = pickCases(all, { only: ["B"], repeat: 2, recheckOf: "r" }) as { name: string }[];
    expect(tries.map((c) => c.name)).toEqual(["B · try 1", "B · try 2"]);
    expect(tries.map((c) => baseName(c.name))).toEqual(["B", "B"]);
  });
});

describe("pass or fail per case", () => {
  it("reads the conversation test's chats, and a chat that couldn't run counts as not passed", () => {
    const result = { chats: [{ name: "A", problems: [] }, { name: "B", problems: ["repeated"] }, { name: "C", problems: [], error: "429" }] };
    expect(caseOutcomes("conversations", result, ["A", "B", "C", "D"])).toEqual([
      { name: "A", ok: true },
      { name: "B", ok: false },
      { name: "C", ok: false },
      { name: "D", ok: false },
    ]);
  });

  it("reads every other test's failures by case name (qualifying lists one per item)", () => {
    const result = { failures: [{ name: "B", item: "timing" }, { name: "B", item: "money" }] };
    expect(caseOutcomes("qualifying", result, ["A", "B"])).toEqual([
      { name: "A", ok: true },
      { name: "B", ok: false },
    ]);
  });
});

describe("the price before a run", () => {
  it("uses the last whole run's price per case", () => {
    const runs = [run({ costMicros: 3_000_000, cases: 30 })];
    expect(estimateRunMicros("conversations", runs, 30, 4)).toBe(400_000);
    expect(estimateRunMicros("conversations", runs, 30, 4, 2)).toBe(800_000);
  });

  it("uses the first estimate before any run is saved", () => {
    expect(estimateRunMicros("conversations", [], 44, 44)).toBe(FIRST_ESTIMATE_MICROS.conversations);
  });

  it("says it plainly", () => {
    expect(priceWords(2_704_000)).toBe("about $2.70");
    expect(priceWords(4_000)).toBe("under 1¢");
  });
});

describe("compared with the run before", () => {
  it("names what started passing and what started failing, on the cases both ran", () => {
    const before = run({ id: "b", createdAt: "2026-10-30T20:00:00.000Z", failed: ["A", "B"], passed: 1 });
    const now = run({ id: "n", failed: ["C"], passed: 2 });
    expect(compareWithBefore(now, [now, before])).toMatchObject({ nowPassing: ["A", "B"], nowFailing: ["C"] });
  });

  it("compares a rerun of the failures with the run that failed them", () => {
    const before = run({ id: "b", createdAt: "2026-10-30T20:00:00.000Z", failed: ["A", "B"] });
    const only = run({ id: "o", kind: "only", cases: 2, ran: ["A", "B"], failed: ["B"], passed: 1 });
    expect(compareWithBefore(only, [only, before])).toMatchObject({ nowPassing: ["A"], nowFailing: [] });
  });

  it("has nothing to compare for the first run", () => {
    expect(compareWithBefore(run({}), [run({})])).toBeNull();
  });
});

describe("the 2-of-3 rule (a failure checked twice more)", () => {
  it("passes a case that passed both extra times, and fails one that failed again", () => {
    const recheck = run({
      kind: "recheck",
      recheckOf: "r0",
      ran: ["A · try 1", "A · try 2", "B · try 1", "B · try 2", "C · try 1", "C · try 2"],
      failed: ["B · try 1", "C · try 1", "C · try 2"],
    });
    expect(steadyVerdict(recheck)).toEqual({ stillFailing: ["B", "C"], passedOnRetry: ["A"], flaky: ["B"] });
  });

  it("never shows a recheck as the run on the page; it's shown with the run it checked", () => {
    const full = run({ id: "f", createdAt: "2026-10-31T07:00:00.000Z" });
    const recheck = run({ id: "x", kind: "recheck", recheckOf: "f" });
    expect(runToShow([recheck, full])?.id).toBe("f");
  });
});

describe("flaky on a version", () => {
  it("is a case that both passed and failed on the same version, for free", () => {
    const runs = [run({ failed: ["A"] }), run({ id: "2", failed: [] }), run({ id: "3", version: "old", failed: ["B"] })];
    expect(flakyOnVersion(runs, "abc1234")).toEqual(["A"]);
    expect(flakyOnVersion(runs, null)).toEqual([]);
  });
});
