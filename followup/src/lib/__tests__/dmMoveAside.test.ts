/**
 * A-239: moving a DM customer back to Filtered out keeps every message, in
 * a row the restore route can rebuild from, and removes the customer, all
 * under the set-aside lock and scoped to the business.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ lead: null as unknown, ops: [] as string[], upsert: vi.fn() }));

vi.mock("@/lib/db", () => {
  const op = (name: string) => vi.fn(async () => { h.ops.push(name); return { count: 1 }; });
  const tx = {
    $executeRaw: vi.fn(async () => { h.ops.push("lock"); return 0; }),
    lead: { findFirst: vi.fn(async () => h.lead), delete: op("lead.delete") },
    filteredEmail: { upsert: vi.fn(async (args: unknown) => { h.ops.push("filteredEmail.upsert"); h.upsert(args); return {}; }) },
    message: { deleteMany: op("message.deleteMany") },
    conversation: { deleteMany: op("conversation.deleteMany") },
    deal: { deleteMany: op("deal.deleteMany") },
    followUp: { deleteMany: op("followUp.deleteMany") },
    task: { deleteMany: op("task.deleteMany") },
    booking: { deleteMany: op("booking.deleteMany") },
    aIInsight: { deleteMany: op("aIInsight.deleteMany") },
    outboundSend: { deleteMany: op("outboundSend.deleteMany") },
    sendClaim: { deleteMany: op("sendClaim.deleteMany") },
  };
  return { prisma: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } };
});

import { prisma } from "@/lib/db";
import { moveDmLeadAside } from "@/lib/inbound/dmContactGate";

beforeEach(() => {
  vi.clearAllMocks();
  h.ops = [];
  h.lead = {
    id: "lead1",
    name: "@friend",
    conversations: [
      {
        id: "conv1",
        messages: [
          { id: "m2", externalId: null, direction: "outbound", body: "Thanks for your message!", sentAt: new Date("2026-10-12T01:02:00Z") },
          { id: "m1", externalId: "mid1", direction: "inbound", body: "Isme bee bhi dal", sentAt: new Date("2026-10-12T01:01:00Z") },
        ],
      },
    ],
  };
});

describe("moveDmLeadAside", () => {
  it("keeps the whole chat in Filtered out, then removes the customer, under the lock", async () => {
    expect(await moveDmLeadAside("biz1", "instagram", "123", "lead1", "Friends chatting.")).toBe(true);
    expect(h.ops[0]).toBe("lock");
    expect(h.ops.indexOf("filteredEmail.upsert")).toBeLessThan(h.ops.indexOf("lead.delete"));
    const args = h.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ businessId_threadId: { businessId: "biz1", threadId: "instagram:123" } });
    expect(args.create).toMatchObject({ businessId: "biz1", provider: "instagram", senderName: "@friend", senderPhone: "ig:123", reason: "Friends chatting." });
    expect(args.create.threadPayload).toEqual({
      phone: "ig:123",
      name: "@friend",
      messages: [
        { id: "mid1", direction: "inbound", body: "Isme bee bhi dal", date: "2026-10-12T01:01:00.000Z" },
        { id: "local:m2", direction: "outbound", body: "Thanks for your message!", date: "2026-10-12T01:02:00.000Z" },
      ],
    });
    expect(vi.mocked(prisma.lead.findFirst).mock.calls[0][0]).toMatchObject({ where: { id: "lead1", businessId: "biz1", phone: "ig:123" } });
  });

  it("does nothing for a customer who isn't there any more", async () => {
    h.lead = null;
    expect(await moveDmLeadAside("biz1", "instagram", "123", "lead1", "Friends chatting.")).toBe(false);
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.ops).not.toContain("lead.delete");
  });
});
