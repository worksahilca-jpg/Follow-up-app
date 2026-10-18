import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    business: { findUnique: vi.fn() },
    businessFact: { findMany: vi.fn().mockResolvedValue([]) },
    ownerExample: { findMany: vi.fn() },
    trainingExample: { findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn(), groupBy: vi.fn() },
    trainingConversation: { create: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { draftingContext } from "@/lib/businessFacts";
import { getTrainingExamples, goodExamplesByTrade, saveConversation, saveTalkExample } from "@/lib/training";

const own = (n: number) => Array.from({ length: n }, (_, i) => ({ customerSaid: `c${i}`, reply: `own${i}` }));
const shared = [{ customerSaid: "is it free?", reply: "realtor answer" }];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.businessFact.findMany.mockResolvedValue([]);
  prisma.trainingExample.findMany.mockResolvedValue(shared);
});

describe("draftingContext with examples from the same kind of business (A-292)", () => {
  it("adds them after the owner's own, from this business's kind only", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Real estate" });
    prisma.ownerExample.findMany.mockResolvedValue(own(2));
    const ctx = await draftingContext("b1");
    expect(ctx.examples.map((e) => e.reply)).toEqual(["own0", "own1", "realtor answer"]);
    const q = prisma.trainingExample.findMany.mock.calls[0][0];
    expect(q.take).toBe(3);
    expect(q.where.trade).toBe("Real estate");
  });

  it("works for any kind of business, not only real estate", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Legal" });
    prisma.ownerExample.findMany.mockResolvedValue([]);
    await draftingContext("b1");
    expect(prisma.trainingExample.findMany.mock.calls[0][0].where.trade).toBe("Legal");
  });

  it("leaves room only up to six in all", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Real estate" });
    prisma.ownerExample.findMany.mockResolvedValue(own(5));
    await draftingContext("b1");
    expect(prisma.trainingExample.findMany.mock.calls[0][0].take).toBe(1);
  });

  it("adds none when the business hasn't said what it is", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: null });
    prisma.ownerExample.findMany.mockResolvedValue([]);
    const ctx = await draftingContext("b1");
    expect(ctx.examples).toEqual([]);
    expect(prisma.trainingExample.findMany).not.toHaveBeenCalled();
  });

  it("answers as the kind it is told to, and keeps the example being scored out", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Other" });
    prisma.ownerExample.findMany.mockResolvedValue([]);
    await draftingContext("b1", { excludeTrainingId: "ex9", trade: "Dental / medical clinic" });
    const q = prisma.trainingExample.findMany.mock.calls[0][0];
    expect(q.where.id).toEqual({ not: "ex9" });
    expect(q.where.trade).toBe("Dental / medical clinic");
  });
});

describe("getTrainingExamples", () => {
  it("skips moments where FollowUp's own answer was better", async () => {
    await getTrainingExamples("Legal", 3);
    expect(prisma.trainingExample.findMany.mock.calls[0][0].where.OR).toEqual([{ verdict: null }, { verdict: { not: "followup" } }]);
  });

  it("never throws", async () => {
    prisma.trainingExample.findMany.mockRejectedValue(new Error("down"));
    expect(await getTrainingExamples("Legal", 3)).toEqual([]);
  });
});

describe("saveConversation", () => {
  it("stores only scrubbed text", async () => {
    prisma.trainingConversation.create.mockResolvedValue({ id: "c1" });
    const raw = "Maya Chen: Hi, call me at 416-555-0199\nRavi Patel: Hi Maya, sure. ravi@realty.ca";
    const out = await saveConversation({ trade: "Real estate", channel: "whatsapp", raw, agent: "Ravi Patel" }, "u1");
    expect(out).toEqual({ id: "c1", examples: 1 });
    const stored = JSON.stringify(prisma.trainingConversation.create.mock.calls[0][0]);
    expect(stored).not.toMatch(/Maya|Ravi|555|realty/);
  });

  it("refuses a realtor who isn't in the conversation", async () => {
    await expect(saveConversation({ trade: "Legal", channel: "text", raw: "A: hi\nB: hello", agent: "C" }, null)).rejects.toThrow("agent-not-found");
  });
});

describe("saveTalkExample (Talk to it)", () => {
  beforeEach(() => {
    prisma.trainingConversation.create.mockResolvedValue({ id: "c1" });
    prisma.trainingExample.create.mockResolvedValue({ id: "e1" });
  });

  it("a taught reply is the example, judged Business better, with FollowUp's answer kept", async () => {
    const out = await saveTalkExample(
      { trade: "Legal", channel: "messenger", context: [], customerSaid: "call me 416-555-0199", followUpReply: "Sure.", taught: "Happy to. What's a good time?" },
      "u1"
    );
    expect(out).toEqual({ id: "e1", conversationId: "c1" });
    const data = prisma.trainingExample.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ trade: "Legal", reply: "Happy to. What's a good time?", followUpReply: "Sure.", verdict: "agent" });
    expect(data.customerSaid).not.toContain("555");
  });

  it("a Good answer is kept as Same, in the chat's existing conversation", async () => {
    prisma.trainingConversation.findUnique.mockResolvedValue({ trade: "Legal" });
    await saveTalkExample({ conversationId: "c9", trade: "Legal", channel: "email", context: [], customerSaid: "hi", followUpReply: "Hello!", taught: null }, null);
    expect(prisma.trainingConversation.create).not.toHaveBeenCalled();
    expect(prisma.trainingExample.create.mock.calls[0][0].data).toMatchObject({ conversationId: "c9", reply: "Hello!", verdict: "same" });
  });

  it("starts a new conversation when the chat's one is for another kind of business", async () => {
    prisma.trainingConversation.findUnique.mockResolvedValue({ trade: "Real estate" });
    await saveTalkExample({ conversationId: "c9", trade: "Legal", channel: "email", context: [], customerSaid: "hi", followUpReply: "Hello!", taught: null }, null);
    expect(prisma.trainingConversation.create).toHaveBeenCalled();
  });
});

describe("goodExamplesByTrade", () => {
  it("counts each kind's usable examples, never ones where FollowUp's answer was better", async () => {
    prisma.trainingExample.groupBy.mockResolvedValue([
      { trade: "Real estate", _count: { _all: 12 } },
      { trade: "Legal", _count: { _all: 3 } },
    ]);
    expect(await goodExamplesByTrade()).toEqual({ "Real estate": 12, Legal: 3 });
    expect(prisma.trainingExample.groupBy.mock.calls[0][0].where).toEqual({ OR: [{ verdict: null }, { verdict: { not: "followup" } }] });
  });
});
