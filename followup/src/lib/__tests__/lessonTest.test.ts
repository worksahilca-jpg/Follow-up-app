/**
 * A-319: "Test them" writes the kind's test replies without and with the waiting lessons, and keeps what it found.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, replyEval, review } = vi.hoisted(() => ({
  prisma: { lessonTest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } },
  replyEval: { runReplyTries: vi.fn(), tradeLessons: vi.fn() },
  review: { listWaiting: vi.fn(), TEST_STALE_MS: 6 * 60_000 },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/replyEval", () => replyEval);
vi.mock("@/lib/lessonReview", () => review);
vi.mock("@/lib/integrations/openaiClient", () => ({ MODEL: "test-model" }));

import { runLessonTest } from "@/lib/lessonTest";
import { lessonStatusWhere } from "@/lib/learning";

const tries = (...ok: boolean[]) => ok.map((p) => ({ reply: p ? "good" : "bad", problems: p ? [] : ["unanswered"], detail: "" }));

beforeEach(() => {
  vi.clearAllMocks();
  review.listWaiting.mockResolvedValue([{ key: "rule:r1:1" }, { key: "example:e1" }]);
  prisma.lessonTest.findFirst.mockResolvedValue(null);
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
    prisma.lessonTest.findFirst.mockResolvedValueOnce({ id: "t0" });
    expect(await runLessonTest("Real estate", "founder")).toEqual({ ok: false, reason: "running" });
    expect(prisma.lessonTest.create).not.toHaveBeenCalled();
  });
});
