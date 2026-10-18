import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    business: { findUnique: vi.fn() },
    businessFact: { findMany: vi.fn().mockResolvedValue([]) },
    ownerExample: { findMany: vi.fn() },
    trainingExample: { findMany: vi.fn(), updateMany: vi.fn() },
    trainingConversation: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { draftingContext } from "@/lib/businessFacts";
import { getTrainingExamples, saveConversation } from "@/lib/training";

const own = (n: number) => Array.from({ length: n }, (_, i) => ({ customerSaid: `c${i}`, reply: `own${i}` }));
const shared = [{ customerSaid: "is it free?", reply: "realtor answer" }];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.businessFact.findMany.mockResolvedValue([]);
  prisma.trainingExample.findMany.mockResolvedValue(shared);
});

describe("draftingContext with realtors' examples (A-292)", () => {
  it("adds them after the owner's own, for a real estate business", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Real estate" });
    prisma.ownerExample.findMany.mockResolvedValue(own(2));
    const ctx = await draftingContext("b1");
    expect(ctx.examples.map((e) => e.reply)).toEqual(["own0", "own1", "realtor answer"]);
    expect(prisma.trainingExample.findMany.mock.calls[0][0].take).toBe(3);
  });

  it("leaves room only up to six in all", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Real estate" });
    prisma.ownerExample.findMany.mockResolvedValue(own(5));
    await draftingContext("b1");
    expect(prisma.trainingExample.findMany.mock.calls[0][0].take).toBe(1);
  });

  it("never adds them for another trade", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Plumbing" });
    prisma.ownerExample.findMany.mockResolvedValue([]);
    const ctx = await draftingContext("b1");
    expect(ctx.examples).toEqual([]);
    expect(prisma.trainingExample.findMany).not.toHaveBeenCalled();
  });

  it("keeps the example being scored out of its own prompt", async () => {
    prisma.business.findUnique.mockResolvedValue({ industry: "Real estate" });
    prisma.ownerExample.findMany.mockResolvedValue([]);
    await draftingContext("b1", { excludeTrainingId: "ex9" });
    expect(prisma.trainingExample.findMany.mock.calls[0][0].where.id).toEqual({ not: "ex9" });
  });
});

describe("getTrainingExamples", () => {
  it("skips moments where FollowUp's own answer was better", async () => {
    await getTrainingExamples(3);
    expect(prisma.trainingExample.findMany.mock.calls[0][0].where.OR).toEqual([{ verdict: null }, { verdict: { not: "followup" } }]);
  });

  it("never throws", async () => {
    prisma.trainingExample.findMany.mockRejectedValue(new Error("down"));
    expect(await getTrainingExamples(3)).toEqual([]);
  });
});

describe("saveConversation", () => {
  it("stores only scrubbed text", async () => {
    prisma.trainingConversation.create.mockResolvedValue({ id: "c1" });
    const raw = "Maya Chen: Hi, call me at 416-555-0199\nRavi Patel: Hi Maya, sure. ravi@realty.ca";
    const out = await saveConversation({ channel: "whatsapp", raw, agent: "Ravi Patel" }, "u1");
    expect(out).toEqual({ id: "c1", examples: 1 });
    const stored = JSON.stringify(prisma.trainingConversation.create.mock.calls[0][0]);
    expect(stored).not.toMatch(/Maya|Ravi|555|realty/);
  });

  it("refuses a realtor who isn't in the conversation", async () => {
    await expect(saveConversation({ channel: "text", raw: "A: hi\nB: hello", agent: "C" }, null)).rejects.toThrow("agent-not-found");
  });
});
