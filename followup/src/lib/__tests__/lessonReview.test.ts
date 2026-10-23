/**
 * A-319: what waits for the founder's OK on Train, and the gate before it reaches every business of its kind.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => {
  const prisma = {
    trainingRule: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    trainingExample: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    trainingConversation: { findUnique: vi.fn(), deleteMany: vi.fn() },
    lessonTest: { findFirst: vi.fn(), findMany: vi.fn() },
    learningEvent: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma };
});
vi.mock("@/lib/db", () => ({ prisma }));

import { dropWaiting, listWaiting, putToWork, testView, trainWaitingViews, type LessonTestRow } from "@/lib/lessonReview";

const at = (m: number) => new Date(Date.UTC(2026, 9, 23, 12, m));
const events = () => prisma.learningEvent.create.mock.calls.map((c) => c[0].data);

function waitingRule(id = "r1", version = 1, replacesId: string | null = null) {
  return { id, trade: "Real estate", text: "Answer about the home they named first.", version, replacesId, createdAt: at(1) };
}
function waitingExample(id: string, source: string | null, conversationId = "c1", minute = 2) {
  return {
    id,
    trade: "Real estate",
    channel: "instagram",
    conversationId,
    customerSaid: "is the condo on king st still available",
    reply: "Yes, it is! Want to see it this week?",
    verdict: "agent",
    createdAt: at(minute),
    conversation: { source },
  };
}
function test(over: Partial<LessonTestRow> = {}): LessonTestRow {
  return {
    id: "t1",
    trade: "Real estate",
    lessons: ["rule:r1:1"],
    status: "done",
    cases: 20,
    tries: 3,
    passedWithout: 12,
    passedWith: 13,
    better: 1,
    worse: 0,
    blocked: 0,
    targeted: 0,
    results: [],
    error: null,
    createdAt: new Date(),
    finishedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  prisma.learningEvent.create.mockResolvedValue({});
  prisma.trainingRule.findMany.mockResolvedValue([]);
  prisma.trainingExample.findMany.mockResolvedValue([]);
  prisma.trainingRule.updateMany.mockResolvedValue({ count: 1 });
  prisma.trainingExample.updateMany.mockResolvedValue({ count: 1 });
});

describe("listWaiting", () => {
  it("lists the waiting rules and taught answers one by one, and a pasted conversation as one change", async () => {
    prisma.trainingRule.findMany.mockResolvedValueOnce([waitingRule("r1", 2)]);
    prisma.trainingExample.findMany.mockResolvedValueOnce([
      waitingExample("e1", "practice", "c9", 3),
      waitingExample("p1", "pasted", "c1", 4),
      waitingExample("p2", "pasted", "c1", 4),
    ]);
    const items = await listWaiting("Real estate");
    expect(prisma.trainingRule.findMany.mock.calls[0][0].where).toEqual({ status: "TESTING", trade: "Real estate" });
    expect(items.map((w) => [w.key, w.label, w.text])).toEqual([
      ["rule:r1:2", "Rule", "Answer about the home they named first."],
      ["example:e1", "Taught reply", "Yes, it is! Want to see it this week?"],
      ["conversation:c1:2", "Conversation added", "Instagram · 2 examples"],
    ]);
  });

  it("new wording names the words in use it replaces", async () => {
    prisma.trainingRule.findMany
      .mockResolvedValueOnce([waitingRule("r2", 1, "r1")])
      .mockResolvedValueOnce([{ id: "r1", text: "Offer a call early." }]);
    const [item] = await listWaiting("Real estate");
    expect(item).toMatchObject({ label: "New wording", replaces: "Offer a call early." });
  });
});

describe("putToWork", () => {
  it("for a kind with a test, refuses until a test covered exactly what is waiting", async () => {
    prisma.trainingRule.findMany.mockResolvedValue([waitingRule("r1", 2)]);
    prisma.lessonTest.findFirst.mockResolvedValueOnce(null);
    expect(await putToWork("Real estate", "founder")).toEqual({ ok: false, reason: "untested" });
    // Tested at version 1, changed since.
    prisma.lessonTest.findFirst.mockResolvedValueOnce(test({ lessons: ["rule:r1:1"] }));
    expect(await putToWork("Real estate", "founder")).toEqual({ ok: false, reason: "untested" });
    expect(prisma.trainingRule.updateMany).not.toHaveBeenCalled();
  });

  it("refuses when a reply got worse, unless the founder says put them to work anyway", async () => {
    prisma.trainingRule.findMany.mockResolvedValue([waitingRule()]);
    prisma.trainingRule.findFirst.mockResolvedValue({ version: 1, replacesId: null });
    prisma.lessonTest.findFirst.mockResolvedValue(test({ worse: 1 }));
    expect(await putToWork("Real estate", "founder")).toEqual({ ok: false, reason: "worse" });
    expect(await putToWork("Real estate", "founder", { anyway: true })).toEqual({ ok: true, count: 1 });
    expect(events()[0].note).toMatch(/worse on 1, put to work anyway/);
  });

  it("refuses outright when the lessons broke one of FollowUp's own checks, anyway or not (plan step 3)", async () => {
    prisma.trainingRule.findMany.mockResolvedValue([waitingRule()]);
    prisma.lessonTest.findFirst.mockResolvedValue(test({ worse: 1, blocked: 1 }));
    expect(await putToWork("Real estate", "founder")).toEqual({ ok: false, reason: "blocked" });
    expect(await putToWork("Real estate", "founder", { anyway: true })).toEqual({ ok: false, reason: "blocked" });
    expect(prisma.trainingRule.updateMany).not.toHaveBeenCalled();
    // A chance check is never mistaken for a test of the lessons.
    expect(prisma.lessonTest.findFirst.mock.calls[0][0].where).toMatchObject({ trade: "Real estate", kind: "lessons", status: "done" });
  });

  it("puts every waiting lesson in use, approved by the founder, with the test in its history", async () => {
    prisma.trainingRule.findMany.mockResolvedValue([waitingRule()]);
    prisma.trainingExample.findMany.mockResolvedValueOnce([waitingExample("e1", "practice")]).mockResolvedValue([]);
    prisma.trainingRule.findFirst.mockResolvedValue({ version: 1, replacesId: null });
    prisma.lessonTest.findFirst.mockResolvedValue(test({ lessons: ["rule:r1:1", "example:e1"] }));
    expect(await putToWork("Real estate", "founder")).toEqual({ ok: true, count: 2 });
    expect(prisma.trainingRule.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "r1", status: "TESTING" },
      data: { status: "ACTIVE", approvedById: "founder" },
    });
    expect(prisma.trainingExample.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "e1", status: "TESTING" }, data: { status: "ACTIVE" } });
    expect(events().map((e) => [e.kind, e.action, e.fromStatus, e.toStatus, e.after])).toEqual([
      ["training_rule", "approved", "TESTING", "ACTIVE", { tested: "13 of 20" }],
      ["training_example", "approved", "TESTING", "ACTIVE", { tested: "13 of 20" }],
    ]);
    expect(events()[0].note).toBe("Put to work by the founder after test t1: 12 of 20 without, 13 of 20 with (A-319).");
  });

  it("new wording takes over from the rule it replaces, which is rolled back and kept", async () => {
    prisma.trainingRule.findMany.mockResolvedValueOnce([waitingRule("r2", 1, "r1")]).mockResolvedValueOnce([{ id: "r1", text: "Old." }]);
    prisma.trainingRule.findFirst.mockResolvedValue({ version: 1, replacesId: "r1" });
    prisma.lessonTest.findFirst.mockResolvedValue(test({ lessons: ["rule:r2:1"] }));
    expect(await putToWork("Real estate", "founder")).toEqual({ ok: true, count: 1 });
    expect(prisma.trainingRule.updateMany.mock.calls[1][0]).toMatchObject({ where: { id: "r1", status: "ACTIVE" }, data: { status: "ROLLED_BACK" } });
    expect(events().map((e) => [e.targetId, e.action])).toEqual([
      ["r2", "approved"],
      ["r1", "rolled_back"],
    ]);
  });

  it("a kind with no test yet goes in use on the founder's OK alone, and says so in its history", async () => {
    prisma.trainingRule.findMany.mockResolvedValue([{ ...waitingRule(), trade: "Legal" }]);
    prisma.trainingRule.findFirst.mockResolvedValue({ version: 1, replacesId: null });
    expect(await putToWork("Legal", "founder")).toEqual({ ok: true, count: 1 });
    expect(prisma.lessonTest.findFirst).not.toHaveBeenCalled();
    expect(events()[0]).toMatchObject({ after: { tested: null }, note: expect.stringMatching(/no reply test for this kind yet/) });
  });

  it("nothing waiting is nothing to do", async () => {
    expect(await putToWork("Real estate", "founder")).toEqual({ ok: false, reason: "nothing" });
  });
});

describe("dropWaiting", () => {
  it("a rule never goes in use; a pasted conversation is taken out for good", async () => {
    prisma.trainingRule.findFirst.mockResolvedValue({ trade: "Real estate", version: 1 });
    expect(await dropWaiting("rule:r1:1", "founder")).toBe(true);
    expect(prisma.trainingRule.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "r1", status: "TESTING" }, data: { status: "REJECTED" } });

    prisma.trainingExample.count.mockResolvedValue(3);
    prisma.trainingConversation.findUnique.mockResolvedValue({ trade: "Real estate", _count: { examples: 3 } });
    prisma.trainingConversation.deleteMany.mockResolvedValue({ count: 1 });
    expect(await dropWaiting("conversation:c1:3", "founder")).toBe(true);
    expect(prisma.trainingConversation.deleteMany).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("a conversation already in use can't be dropped from here", async () => {
    prisma.trainingExample.count.mockResolvedValue(0);
    expect(await dropWaiting("conversation:c1:3", "founder")).toBe(false);
    expect(prisma.trainingConversation.deleteMany).not.toHaveBeenCalled();
  });
});

describe("what the Train page shows", () => {
  it("a test counts as current only for exactly what is waiting, and a stuck one reads as failed", () => {
    expect(testView(test(), ["rule:r1:1"]).current).toBe(true);
    expect(testView(test(), ["rule:r1:2"]).current).toBe(false);
    const stuck = testView(test({ status: "running", createdAt: new Date(Date.now() - 10 * 60_000) }), ["rule:r1:1"]);
    expect(stuck).toMatchObject({ status: "failed", current: false, error: "The test stopped before it finished. Test again." });
  });

  it("warns which rules in use stop being read when new ones push past the newest 20", async () => {
    prisma.trainingRule.findMany
      .mockResolvedValueOnce([waitingRule("new1"), waitingRule("new2")])
      .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => ({ text: `Rule ${20 - i}` })));
    prisma.lessonTest.findMany.mockResolvedValue([]);
    const views = await trainWaitingViews();
    expect(views["Real estate"]).toMatchObject({ hasTest: true, testSize: 20, dropsOut: ["Rule 1", "Rule 2"] });
  });

  it("carries what blocked, the rule messages and the chance check for the model in use (plan step 3)", async () => {
    prisma.trainingRule.findMany.mockResolvedValue([waitingRule()]);
    prisma.lessonTest.findMany.mockImplementation(async ({ where }: { where: { kind: string; model?: string } }) =>
      where.kind === "chance"
        ? [{ trade: "Real estate", cases: 20, better: 2, worse: 1, createdAt: at(0) }]
        : [test({ worse: 1, blocked: 1, targeted: 3 })]
    );
    const view = (await trainWaitingViews())["Real estate"].test;
    expect(view).toMatchObject({ blocked: 1, targeted: 3, chance: { cases: 20, flips: 3 } });
    const chanceQuery = prisma.lessonTest.findMany.mock.calls.find((c) => c[0].where.kind === "chance")?.[0];
    expect(chanceQuery.where).toMatchObject({ status: "done", model: expect.any(String) });
  });
});
