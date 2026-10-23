/**
 * Plan step 4 (A-321): a round of "Mark replies" keeps 60 replies with what the checker found, and the page never
 * sees the checker's reading of a reply the founder hasn't marked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, replyEval } = vi.hoisted(() => ({
  prisma: {
    checkerRound: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    checkerReply: { createMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
  replyEval: { runReplyTries: vi.fn(), tradeLessons: vi.fn(), REPLY_CASES: [{ name: "a" }, { name: "b" }] },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/replyEval", () => replyEval);
vi.mock("@/lib/integrations/openaiClient", () => ({ MODEL: "test-model" }));

import { markReply, markView, startRound } from "@/lib/checkerRounds";

const ok = (reply: string, problems: string[] = [], hard: string[] = []) => ({ reply, problems, hard, detail: "" });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.checkerRound.findFirst.mockResolvedValue(null);
  prisma.checkerRound.create.mockResolvedValue({ id: "r1" });
  prisma.checkerRound.update.mockResolvedValue({});
  prisma.checkerReply.createMany.mockResolvedValue({ count: 0 });
  replyEval.tradeLessons.mockResolvedValue({ examples: [], rules: [] });
  replyEval.runReplyTries.mockResolvedValue([
    { name: "a", said: "a?", tries: [ok("a1", ["unanswered"]), ok("a2"), ok("a3")] },
    { name: "b", said: "b?", tries: [ok("b1"), ok("b2", ["pressure"], ["pressure"]), ok("b3")] },
  ]);
});

describe("startRound", () => {
  it("writes three replies to every message with the lessons in use and keeps what the checker found", async () => {
    expect(await startRound("Real estate", "founder")).toEqual({ ok: true, id: "r1", replies: 6 });
    expect(prisma.checkerRound.create.mock.calls[0][0].data).toEqual({ trade: "Real estate", model: "test-model", byUserId: "founder" });
    expect(replyEval.runReplyTries.mock.calls[0][1]).toMatchObject({ tries: 3 });
    const rows = prisma.checkerReply.createMany.mock.calls[0][0].data;
    // Every message once, then every message again, so the same customer isn't read twice in a row.
    expect(rows.map((r: { reply: string }) => r.reply)).toEqual(["a1", "b1", "a2", "b2", "a3", "b3"]);
    expect(rows[3]).toMatchObject({ roundId: "r1", position: 3, caseName: "b", said: "b?", checker: ["pressure"], hard: ["pressure"] });
    expect(prisma.checkerRound.update.mock.calls[0][0].data).toMatchObject({ status: "ready" });
  });

  it("works only for kinds with test messages, and one round at a time", async () => {
    expect(await startRound("Legal", "founder")).toEqual({ ok: false, reason: "no_test" });
    prisma.checkerRound.findFirst.mockResolvedValueOnce({ id: "busy" });
    expect(await startRound("Real estate", "founder")).toEqual({ ok: false, reason: "running" });
    expect(replyEval.runReplyTries).not.toHaveBeenCalled();
  });

  it("isn't kept when too many replies couldn't be written", async () => {
    const lost = { reply: "", problems: [], hard: [], detail: "", error: "429" };
    replyEval.runReplyTries.mockResolvedValue(Array.from({ length: 4 }, (_, i) => ({ name: `c${i}`, said: "?", tries: [lost, lost, ok("x")] })));
    expect(await startRound("Real estate", "founder")).toMatchObject({ ok: false, reason: "failed" });
    expect(prisma.checkerReply.createMany).not.toHaveBeenCalled();
    expect(prisma.checkerRound.update.mock.calls[0][0].data).toMatchObject({ status: "failed" });
  });
});

describe("markReply", () => {
  it("keeps what's wrong only on 'fix', and only the checks the page offers", async () => {
    prisma.checkerReply.updateMany.mockResolvedValue({ count: 1 });
    expect(await markReply("x1", "fix", ["invented", "other", "invented", "made-up"])).toBe(true);
    expect(prisma.checkerReply.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "x1", round: { status: "ready" } },
      data: { verdict: "fix", marked: ["invented", "other"] },
    });
    await markReply("x2", "send", ["invented"]);
    expect(prisma.checkerReply.updateMany.mock.calls[1][0].data).toMatchObject({ verdict: "send", marked: [] });
  });
});

describe("markView", () => {
  it("shows the next unmarked reply without what the checker found", async () => {
    prisma.checkerRound.findFirst.mockResolvedValueOnce({ id: "r1", status: "ready", error: null, createdAt: new Date() });
    prisma.checkerRound.findFirst.mockResolvedValueOnce({ id: "r1", _count: { replies: 60 } });
    prisma.checkerReply.findFirst.mockResolvedValue({ id: "x12", said: "Is it still available?", reply: "Yes, it is." });
    prisma.checkerReply.count.mockResolvedValue(11);
    const view = await markView("Real estate");
    expect(view).toEqual({ state: "marking", reply: { id: "x12", said: "Is it still available?", reply: "Yes, it is." }, number: 12, total: 60 });
    expect(prisma.checkerReply.findFirst.mock.calls[0][0].select).toEqual({ id: true, said: true, reply: true });
  });

  it("shows the results once everything is marked: agreement, each check, and where you disagreed", async () => {
    prisma.checkerRound.findFirst.mockResolvedValueOnce({ id: "r1", status: "ready", error: null, createdAt: new Date() });
    prisma.checkerRound.findFirst.mockResolvedValueOnce(null);
    prisma.checkerReply.findMany.mockResolvedValue([
      { id: "x1", said: "a?", reply: "a1", verdict: "send", marked: [], checker: [], markedAt: new Date("2026-10-23T20:12:00Z") },
      { id: "x2", said: "b?", reply: "b1", verdict: "fix", marked: ["unanswered"], checker: [], markedAt: new Date("2026-10-23T20:13:00Z") },
    ]);
    const view = await markView("Real estate");
    expect(view).toMatchObject({ state: "results", marked: 2, agreement: { judged: 2, agreed: 1 }, lastMarkedAt: "2026-10-23T20:13:00.000Z" });
    if (view.state !== "results") throw new Error("expected results");
    expect(view.disagreements).toEqual([
      { id: "x2", said: "b?", reply: "b1", you: "You wouldn't send it: didn't answer their question.", checker: "The checker found nothing wrong." },
    ]);
    // Marks count for the model they were made on.
    expect(prisma.checkerReply.findMany.mock.calls[0][0].where).toMatchObject({ round: { trade: "Real estate", model: "test-model" } });
  });

  it("starts with nothing marked, and says when the last round stopped", async () => {
    prisma.checkerRound.findFirst.mockResolvedValueOnce({ id: "r1", status: "failed", error: "FollowUp couldn't write 9 of the 60 replies. Try again.", createdAt: new Date() });
    prisma.checkerRound.findFirst.mockResolvedValueOnce(null);
    prisma.checkerReply.findMany.mockResolvedValue([]);
    expect(await markView("Real estate")).toEqual({ state: "start", error: "FollowUp couldn't write 9 of the 60 replies. Try again." });
  });

  it("says the replies are being written while a round is", async () => {
    prisma.checkerRound.findFirst.mockResolvedValueOnce({ id: "r1", status: "writing", error: null, createdAt: new Date() });
    expect(await markView("Real estate")).toEqual({ state: "writing" });
  });
});
