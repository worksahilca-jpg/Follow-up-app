/**
 * A-319: "Test them" writes the kind's test replies without and with the waiting lessons, and keeps what it found.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, replyEval, review, ruleMessages, rounds } = vi.hoisted(() => ({
  prisma: { lessonTest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }, trainingRule: { findMany: vi.fn() } },
  replyEval: { runReplyTries: vi.fn(), tradeLessons: vi.fn(), REPLY_CASES: [{ name: "a" }, { name: "b" }] },
  review: { listWaiting: vi.fn(), TEST_STALE_MS: 6 * 60_000 },
  ruleMessages: { targetedCases: vi.fn() },
  rounds: { advisoryFor: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/replyEval", () => replyEval);
vi.mock("@/lib/lessonReview", () => review);
vi.mock("@/lib/ruleTestMessages", () => ruleMessages);
vi.mock("@/lib/checkerRounds", () => rounds);
vi.mock("@/lib/integrations/openaiClient", () => ({ MODEL: "test-model" }));

import { runLessonTest } from "@/lib/lessonTest";
import { lessonStatusWhere } from "@/lib/learning";

const tries = (...ok: boolean[]) => ok.map((p) => ({ reply: p ? "good" : "bad", problems: p ? [] : ["unanswered"], detail: "" }));

beforeEach(() => {
  vi.clearAllMocks();
  review.listWaiting.mockResolvedValue([{ key: "rule:r1:1", kind: "rule", id: "r1" }, { key: "example:e1", kind: "example", id: "e1" }]);
  prisma.trainingRule.findMany.mockResolvedValue([{ id: "r1", text: "Say when the owner will confirm.", version: 1, testMessages: null }]);
  ruleMessages.targetedCases.mockResolvedValue([]);
  rounds.advisoryFor.mockResolvedValue([]);
  // No test running, and a chance check from this month on this model: most tests run without one.
  prisma.lessonTest.findFirst.mockImplementation(async ({ where }: { where: { kind?: string } }) => (where.kind === "chance" ? { id: "c0" } : null));
  prisma.lessonTest.create.mockResolvedValue({ id: "t1" });
  prisma.lessonTest.update.mockResolvedValue({});
  // Each half reads the kind's lessons as a live draft would; inside the "with" half the waiting ones count too.
  replyEval.tradeLessons.mockImplementation(async (trade: string) => ({ examples: [], rules: [JSON.stringify(lessonStatusWhere(trade))] }));
  replyEval.runReplyTries.mockImplementation(async (lessons: { rules: string[] }) =>
    lessons.rules[0] === '"ACTIVE"'
      ? [{ name: "a", said: "a?", tries: tries(false, false, false) }, { name: "b", said: "b?", tries: tries(true, true, true) }]
      : [{ name: "a", said: "a?", tries: tries(true, true, true) }, { name: "b", said: "b?", tries: tries(true, true, true) }]
  );
});

describe("runLessonTest", () => {
  // Plan step 4 (A-321): a check the founder found wrong too often on Mark replies is advice only. What it found stays
  // on the reply, but the message doesn't fail for it.
  it("sets advice-only checks aside, keeps what they found, and keeps which ones they were", async () => {
    rounds.advisoryFor.mockResolvedValue(["unanswered"]);
    expect(await runLessonTest("Real estate", "founder")).toEqual({ ok: true, id: "t1" });
    expect(rounds.advisoryFor).toHaveBeenCalledWith("Real estate");
    const data = prisma.lessonTest.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "done", passedWithout: 2, passedWith: 2, better: 0, worse: 0, advisory: ["unanswered"] });
    expect(data.results[0].without[0]).toMatchObject({ reply: "bad", problems: [], advice: ["unanswered"] });
  });

  it("never sets aside a problem code decided", async () => {
    rounds.advisoryFor.mockResolvedValue(["pressure"]);
    replyEval.runReplyTries.mockResolvedValue([
      { name: "a", said: "a?", tries: [{ reply: "Book today!", problems: ["pressure"], hard: ["pressure"], detail: "" }, ...tries(true, true)] },
    ]);
    await runLessonTest("Real estate", "founder");
    const data = prisma.lessonTest.update.mock.calls[0][0].data;
    expect(data.results[0].without[0]).toMatchObject({ problems: ["pressure"] });
    expect(data.results[0].without[0].advice).toBeUndefined();
  });

  it("writes the replies without and with the waiting lessons, three times each, and keeps the comparison", async () => {
    expect(await runLessonTest("Real estate", "founder")).toEqual({ ok: true, id: "t1" });
    expect(prisma.lessonTest.create.mock.calls[0][0].data).toMatchObject({
      trade: "Real estate",
      lessons: ["rule:r1:1", "example:e1"],
      status: "running",
      tries: 3,
      model: "test-model",
      byUserId: "founder",
    });
    expect(replyEval.runReplyTries.mock.calls.map((c) => c[0].rules[0])).toEqual(['"ACTIVE"', '{"in":["ACTIVE","TESTING"]}']);
    expect(replyEval.runReplyTries.mock.calls[0][1]).toMatchObject({ tries: 3 });
    const data = prisma.lessonTest.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "done", cases: 2, passedWithout: 1, passedWith: 2, better: 1, worse: 0 });
    expect(data.results[0]).toMatchObject({ name: "a", said: "a?", without: [{ reply: "bad", problems: ["unanswered"] }, {}, {}] });
  });

  it("a reply that couldn't be written fails the whole test: it must never make a lesson look harmless", async () => {
    replyEval.runReplyTries.mockResolvedValue([{ name: "a", said: "a?", tries: [{ reply: "", problems: [], detail: "", error: "429" }, ...tries(true, true)] }]);
    const result = await runLessonTest("Real estate", "founder");
    expect(result).toMatchObject({ ok: false, reason: "failed", message: "FollowUp couldn't write 2 of the 6 replies. Test again." });
    expect(prisma.lessonTest.update.mock.calls[0][0].data).toMatchObject({ status: "failed" });
  });

  it("a crash mid-test is kept as failed, never left running", async () => {
    replyEval.runReplyTries.mockRejectedValue(new Error("down"));
    expect(await runLessonTest("Real estate", "founder")).toMatchObject({ ok: false, reason: "failed" });
    expect(prisma.lessonTest.update.mock.calls[0][0].data).toMatchObject({ status: "failed", error: "The test stopped before it finished. Test again." });
  });

  it("runs only for a kind with test messages, with something waiting, and one at a time", async () => {
    expect(await runLessonTest("Legal", "founder")).toEqual({ ok: false, reason: "no_test" });
    review.listWaiting.mockResolvedValueOnce([]);
    expect(await runLessonTest("Real estate", "founder")).toEqual({ ok: false, reason: "nothing" });
    prisma.lessonTest.findFirst.mockResolvedValue({ id: "t0" });
    expect(await runLessonTest("Real estate", "founder")).toEqual({ ok: false, reason: "running" });
    expect(prisma.lessonTest.create).not.toHaveBeenCalled();
  });

  it("answers the messages written for each waiting rule too, both ways, and counts them apart from the 20", async () => {
    const forRule = { name: "“Say when the owner will confirm.” · message 1", lines: [["in", "Is Sunday open?"]], asks: [], rule: "Say when the owner will confirm." };
    ruleMessages.targetedCases.mockResolvedValue([forRule]);
    replyEval.runReplyTries.mockImplementation(async (lessons: { rules: string[] }) => [
      { name: "a", said: "a?", tries: tries(true, true, true) },
      { name: "b", said: "b?", tries: tries(true, true, true) },
      { name: forRule.name, said: "Is Sunday open?", rule: forRule.rule, tries: lessons.rules[0] === '"ACTIVE"' ? tries(false, false, false) : tries(true, true, true) },
    ]);
    await runLessonTest("Real estate", "founder");
    expect(ruleMessages.targetedCases.mock.calls[0]).toEqual(["Real estate", [{ id: "r1", text: "Say when the owner will confirm.", version: 1, testMessages: null }]]);
    expect(replyEval.runReplyTries.mock.calls[0][1].cases).toEqual([{ name: "a" }, { name: "b" }, forRule]);
    const data = prisma.lessonTest.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ cases: 2, passedWithout: 2, passedWith: 2, better: 1, worse: 0, targeted: 1, blocked: 0 });
    expect(data.results[2]).toMatchObject({ rule: "Say when the owner will confirm." });
  });

  it("keeps a code check the lessons broke as blocked", async () => {
    const broken = [0, 1, 2].map(() => ({ reply: "Two? Questions?", problems: ["shape"], hard: ["shape"], detail: "" }));
    replyEval.runReplyTries.mockImplementation(async (lessons: { rules: string[] }) => [
      { name: "a", said: "a?", tries: lessons.rules[0] === '"ACTIVE"' ? tries(true, true, true) : broken },
      { name: "b", said: "b?", tries: tries(true, true, true) },
    ]);
    await runLessonTest("Real estate", "founder");
    expect(prisma.lessonTest.update.mock.calls[0][0].data).toMatchObject({ worse: 1, blocked: 1 });
  });

  it("runs a chance check alongside when this kind has none on the model in use, and keeps how many messages moved", async () => {
    prisma.lessonTest.findFirst.mockResolvedValue(null);
    let n = 0;
    replyEval.runReplyTries.mockImplementation(async (lessons: { rules: string[] }) => {
      if (lessons.rules[0] !== '"ACTIVE"') return [{ name: "a", said: "a?", tries: tries(true, true, true) }, { name: "b", said: "b?", tries: tries(true, true, true) }];
      n += 1;
      // The first run without the lessons fails "a"; the second, with nothing changed, passes it: one message moved.
      return [{ name: "a", said: "a?", tries: tries(n !== 1, true, true) }, { name: "b", said: "b?", tries: tries(true, true, true) }];
    });
    await runLessonTest("Real estate", "founder");
    expect(replyEval.runReplyTries).toHaveBeenCalledTimes(3);
    expect(replyEval.runReplyTries.mock.calls[2][1].cases).toEqual([{ name: "a" }, { name: "b" }]);
    const chanceRow = prisma.lessonTest.create.mock.calls.find((c) => c[0].data.kind === "chance")?.[0].data;
    expect(chanceRow).toMatchObject({ trade: "Real estate", kind: "chance", status: "done", cases: 2, better: 1, worse: 0, model: "test-model" });
  });

  it("skips the chance check when there's a recent one, and never keeps one that lost a reply", async () => {
    await runLessonTest("Real estate", "founder");
    expect(replyEval.runReplyTries).toHaveBeenCalledTimes(2);
    prisma.lessonTest.findFirst.mockResolvedValue(null);
    vi.clearAllMocks();
    prisma.lessonTest.create.mockResolvedValue({ id: "t1" });
    prisma.lessonTest.update.mockResolvedValue({});
    review.listWaiting.mockResolvedValue([{ key: "example:e1", kind: "example", id: "e1" }]);
    ruleMessages.targetedCases.mockResolvedValue([]);
    replyEval.tradeLessons.mockResolvedValue({ examples: [], rules: [] });
    replyEval.runReplyTries
      .mockResolvedValueOnce([{ name: "a", said: "a?", tries: tries(true) }])
      .mockResolvedValueOnce([{ name: "a", said: "a?", tries: tries(true) }])
      .mockResolvedValueOnce([{ name: "a", said: "a?", tries: [{ reply: "", problems: [], detail: "", error: "429" }] }]);
    await runLessonTest("Real estate", "founder");
    expect(prisma.lessonTest.create.mock.calls.some((c) => c[0].data.kind === "chance")).toBe(false);
  });
});
