/**
 * Milestone 1 of the founder's assistant brief (2026-10-22): everything FollowUp is taught keeps a status, a version
 * and a history, only an ACTIVE lesson reaches a reply, Undo rolls back instead of deleting, and nothing is lost
 * (src/lib/learning.ts, src/lib/trainingRules.ts, src/lib/training.ts, src/lib/ownerExamples.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => {
  const prisma = {
    trainingRule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    trainingExample: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    trainingConversation: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    ownerExample: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    learningEvent: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  // An interactive transaction runs its callback against the same client, like the real one.
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma };
});
vi.mock("@/lib/db", () => ({ prisma }));

import { canMove, isLive, LEARNING_STATUSES, learningHistory, recordLearningEvent } from "@/lib/learning";
import {
  getTrainingRules,
  listTrainingRules,
  restoreTrainingRule,
  revertTrainingRuleWording,
  rollBackTrainingRule,
  saveTrainingRule,
  updateTrainingRule,
} from "@/lib/trainingRules";
import { deleteConversation, getTrainingExamples, nextToScore, restoreExample, rollBackExample, saveConversation, saveTalkExample } from "@/lib/training";
import { deleteOwnerExample, saveOwnerExample } from "@/lib/ownerExamples";

const events = () => prisma.learningEvent.create.mock.calls.map((c) => c[0].data);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  prisma.learningEvent.create.mockResolvedValue({});
  prisma.ownerExample.findMany.mockResolvedValue([]);
});

describe("the life of a lesson", () => {
  it("knows the brief's seven statuses", () => {
    expect(LEARNING_STATUSES).toEqual(["DRAFT", "AWAITING_APPROVAL", "APPROVED", "TESTING", "ACTIVE", "REJECTED", "ROLLED_BACK"]);
  });

  it("never goes live without approval: no step from a draft or a waiting lesson straight to ACTIVE", () => {
    expect(canMove("DRAFT", "ACTIVE")).toBe(false);
    expect(canMove("AWAITING_APPROVAL", "ACTIVE")).toBe(false);
    expect(canMove("REJECTED", "ACTIVE")).toBe(false);
    expect(canMove("APPROVED", "ACTIVE")).toBe(true);
    expect(canMove("TESTING", "ACTIVE")).toBe(true);
  });

  it("an active lesson can only be rolled back, and a rolled-back one put back", () => {
    for (const to of LEARNING_STATUSES) expect(canMove("ACTIVE", to)).toBe(to === "ROLLED_BACK");
    expect(canMove("ROLLED_BACK", "ACTIVE")).toBe(true);
  });

  it("only ACTIVE is live; anything else, including a status this code doesn't know, is not", () => {
    expect(LEARNING_STATUSES.filter(isLive)).toEqual(["ACTIVE"]);
    expect(isLive("active")).toBe(false);
    expect(isLive(undefined)).toBe(false);
  });

  it("recording history never throws: the change already happened", async () => {
    prisma.learningEvent.create.mockRejectedValueOnce(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordLearningEvent({ kind: "training_rule", targetId: "r1", action: "created" })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("a business's history is read only with that business's id", async () => {
    prisma.learningEvent.findMany.mockResolvedValue([]);
    await learningHistory("owner_example", "x1", "biz1");
    expect(prisma.learningEvent.findMany.mock.calls[0][0].where).toEqual({ kind: "owner_example", targetId: "x1", businessId: "biz1" });
    await learningHistory("training_rule", "r1", null);
    expect(prisma.learningEvent.findMany.mock.calls[1][0].where.businessId).toBeNull();
  });
});

describe("the founder's rules (A-297)", () => {
  it("only active rules reach a reply, and only active ones are listed", async () => {
    prisma.trainingRule.findMany.mockResolvedValue([{ text: "Offer a call early." }]);
    expect(await getTrainingRules("Real estate")).toEqual(["Offer a call early."]);
    expect(prisma.trainingRule.findMany.mock.calls[0][0].where).toEqual({ trade: "Real estate", status: "ACTIVE" });
    await listTrainingRules();
    expect(prisma.trainingRule.findMany.mock.calls[1][0].where).toEqual({ status: "ACTIVE" });
  });

  it("a new rule is active at once, approved by the founder who wrote it, version 1, and recorded with its words", async () => {
    prisma.trainingRule.create.mockResolvedValue({ id: "r1", text: "Ask which listing they saw." });
    await saveTrainingRule({ trade: "Real estate", text: "Ask which listing they saw.", note: "ask which one" }, "founder");
    const data = prisma.trainingRule.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "ACTIVE", version: 1, approvedById: "founder", addedById: "founder" });
    expect(data.approvedAt).toBeInstanceOf(Date);
    expect(events()).toEqual([
      expect.objectContaining({ kind: "training_rule", targetId: "r1", action: "created", toStatus: "ACTIVE", version: 1, trade: "Real estate", businessId: null, byUserId: "founder", after: { text: "Ask which listing they saw." } }),
    ]);
  });

  it("changing the wording keeps the old words, raises the version, and writes both together", async () => {
    prisma.trainingRule.findFirst.mockResolvedValue({ text: "Offer a call early.", version: 2, trade: "Legal" });
    prisma.trainingRule.updateMany.mockResolvedValue({ count: 1 });
    expect(await updateTrainingRule("r1", "Offer a call in the first reply.", "founder")).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.trainingRule.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "r1", status: "ACTIVE", version: 2 },
      data: { text: "Offer a call in the first reply.", version: 3 },
    });
    expect(events()).toEqual([
      expect.objectContaining({ action: "edited", version: 3, before: { text: "Offer a call early." }, after: { text: "Offer a call in the first reply." }, byUserId: "founder" }),
    ]);
  });

  it("a change racing another one changes nothing and records nothing", async () => {
    prisma.trainingRule.findFirst.mockResolvedValue({ text: "Old.", version: 2, trade: "Legal" });
    prisma.trainingRule.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateTrainingRule("r1", "New.")).toBe(false);
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
  });

  it("if the history can't be written, the wording doesn't change either", async () => {
    prisma.trainingRule.findFirst.mockResolvedValue({ text: "Old.", version: 1, trade: "Legal" });
    prisma.trainingRule.updateMany.mockResolvedValue({ count: 1 });
    prisma.learningEvent.create.mockRejectedValueOnce(new Error("down"));
    await expect(updateTrainingRule("r1", "New.")).rejects.toThrow("down");
  });

  it("a rolled-back or missing rule can't be reworded", async () => {
    prisma.trainingRule.findFirst.mockResolvedValue(null);
    expect(await updateTrainingRule("r1", "New.")).toBe(false);
    expect(prisma.trainingRule.updateMany).not.toHaveBeenCalled();
  });

  it("Undo rolls the rule back, kept, and records it; putting it back makes it active again", async () => {
    prisma.trainingRule.findFirst.mockResolvedValueOnce({ trade: "Legal", version: 3 });
    prisma.trainingRule.updateMany.mockResolvedValue({ count: 1 });
    expect(await rollBackTrainingRule("r1", "founder")).toBe(true);
    expect(prisma.trainingRule.updateMany.mock.calls[0][0].where).toEqual({ id: "r1", status: "ACTIVE" });
    expect(prisma.trainingRule.updateMany.mock.calls[0][0].data).toMatchObject({ status: "ROLLED_BACK" });

    prisma.trainingRule.findFirst.mockResolvedValueOnce({ trade: "Legal", version: 3 });
    expect(await restoreTrainingRule("r1", "founder")).toBe(true);
    expect(prisma.trainingRule.updateMany.mock.calls[1][0]).toEqual({ where: { id: "r1", status: "ROLLED_BACK" }, data: { status: "ACTIVE", endedAt: null } });
    expect(events().map((e) => [e.action, e.fromStatus, e.toStatus])).toEqual([
      ["rolled_back", "ACTIVE", "ROLLED_BACK"],
      ["restored", "ROLLED_BACK", "ACTIVE"],
    ]);
  });

  it("revert brings back the words before the latest change, as a new version", async () => {
    prisma.learningEvent.findFirst.mockResolvedValue({ before: { text: "Offer a call early." } });
    prisma.trainingRule.findFirst.mockResolvedValue({ text: "Offer a call in the first reply.", version: 3, trade: "Legal" });
    prisma.trainingRule.updateMany.mockResolvedValue({ count: 1 });
    expect(await revertTrainingRuleWording("r1", "founder")).toBe(true);
    expect(prisma.learningEvent.findFirst.mock.calls[0][0].where).toEqual({ kind: "training_rule", targetId: "r1", businessId: null, action: "edited" });
    expect(prisma.trainingRule.updateMany.mock.calls[0][0].data).toEqual({ text: "Offer a call early.", version: 4 });
  });

  it("revert does nothing for a rule that was never reworded", async () => {
    prisma.learningEvent.findFirst.mockResolvedValue(null);
    expect(await revertTrainingRuleWording("r1")).toBe(false);
    expect(prisma.trainingRule.updateMany).not.toHaveBeenCalled();
  });
});

describe("the founder's examples (A-292, A-294)", () => {
  it("only active examples reach a draft or the scorecard", async () => {
    prisma.trainingExample.findMany.mockResolvedValue([]);
    await getTrainingExamples("Legal", 3);
    expect(prisma.trainingExample.findMany.mock.calls[0][0].where.status).toBe("ACTIVE");
    prisma.trainingExample.findFirst.mockResolvedValue(null);
    await nextToScore();
    expect(prisma.trainingExample.findFirst.mock.calls[0][0].where).toEqual({ verdict: null, status: "ACTIVE" });
  });

  it("a pasted conversation keeps its ticked permission, by whom and when, and is recorded without its words", async () => {
    prisma.trainingConversation.create.mockResolvedValue({ id: "c1" });
    await saveConversation({ trade: "Real estate", channel: "email", raw: "Maya: Hi there\nRavi: Hello Maya, how can I help?", agent: "Ravi" }, "founder");
    const data = prisma.trainingConversation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ source: "pasted", consentById: "founder" });
    expect(data.consentConfirmedAt).toBeInstanceOf(Date);
    expect(data.examples.create[0]).toMatchObject({ status: "ACTIVE", approvedById: "founder" });
    const [event] = events();
    expect(event).toMatchObject({ kind: "training_conversation", targetId: "c1", action: "created", after: { source: "pasted", examples: 1, permissionConfirmed: true } });
    expect(JSON.stringify(event)).not.toMatch(/Hello|Maya|Ravi/);
  });

  it("a practice chat is marked practice, with no permission to keep (nobody's conversation)", async () => {
    prisma.trainingConversation.create.mockResolvedValue({ id: "c2" });
    prisma.trainingExample.create.mockResolvedValue({ id: "e2" });
    await saveTalkExample({ trade: "Legal", channel: "email", context: [], customerSaid: "hi", followUpReply: "Hello!", taught: null }, "founder");
    expect(prisma.trainingConversation.create.mock.calls[0][0].data).toMatchObject({ source: "practice" });
    expect(prisma.trainingConversation.create.mock.calls[0][0].data.consentConfirmedAt).toBeUndefined();
    expect(prisma.trainingExample.create.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", approvedById: "founder" });
    expect(events()).toEqual([expect.objectContaining({ kind: "training_example", targetId: "e2", action: "created", after: { customerSaid: "hi", reply: "Hello!", kept: "good" } })]);
  });

  it("Undo rolls an example back instead of deleting it, and it can be put back", async () => {
    prisma.trainingExample.findFirst.mockResolvedValueOnce({ trade: "Legal" });
    prisma.trainingExample.updateMany.mockResolvedValue({ count: 1 });
    expect(await rollBackExample("e1", "founder")).toBe(true);
    expect(prisma.trainingExample.updateMany.mock.calls[0][0].data).toMatchObject({ status: "ROLLED_BACK" });
    prisma.trainingExample.findFirst.mockResolvedValueOnce({ trade: "Legal" });
    expect(await restoreExample("e1", "founder")).toBe(true);
    expect(prisma.trainingExample.updateMany.mock.calls[1][0].data).toEqual({ status: "ACTIVE", endedAt: null });
  });

  it("removing a whole conversation still deletes it for good, and records only that it happened", async () => {
    prisma.trainingConversation.findUnique.mockResolvedValue({ trade: "Legal", _count: { examples: 4 } });
    prisma.trainingConversation.deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteConversation("c1", "founder")).toBe(true);
    expect(prisma.trainingConversation.deleteMany).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(events()).toEqual([expect.objectContaining({ kind: "training_conversation", action: "removed", after: { examples: 4 } })]);
  });
});

describe("the owner's examples (A-290)", () => {
  it("each one and each Undo is in that business's history, never another's", async () => {
    prisma.ownerExample.create.mockResolvedValue({ id: "x1" });
    await saveOwnerExample("biz1", "u1", { channel: "email", customerSaid: "is it free?", reply: "Happy to explain." });
    prisma.ownerExample.deleteMany.mockResolvedValue({ count: 1 });
    await deleteOwnerExample("biz1", "x1", "u1");
    expect(events().map((e) => [e.businessId, e.kind, e.action])).toEqual([
      ["biz1", "owner_example", "created"],
      ["biz1", "owner_example", "removed"],
    ]);
  });

  it("an Undo with another business's id deletes nothing and records nothing", async () => {
    prisma.ownerExample.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteOwnerExample("biz2", "x1", "u9")).toBe(false);
    expect(prisma.ownerExample.deleteMany).toHaveBeenCalledWith({ where: { businessId: "biz2", id: "x1" } });
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
  });
});
