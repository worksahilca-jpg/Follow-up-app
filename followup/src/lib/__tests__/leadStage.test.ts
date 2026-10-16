/**
 * A close means the same thing wherever it was tapped, and so does taking it back: Results counted "Won 1" this
 * week beside "Won, all time 0" after an Undo (2026-10-16), because the deal stayed won when the customer reopened.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { lead, deal } = vi.hoisted(() => ({
  lead: { findUnique: vi.fn(), update: vi.fn() },
  deal: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { lead, deal } }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { moveLeadStage } from "@/lib/leadStage";

beforeEach(() => {
  vi.clearAllMocks();
  lead.findUnique.mockResolvedValue({ id: "l1", businessId: "b1", stage: "WON", dealValue: 0, nextFollowUp: null });
  lead.update.mockImplementation(async ({ data }: { data: { stage: string } }) => ({ id: "l1", stage: data.stage }));
});

describe("moveLeadStage", () => {
  it("marks the deal won when the customer is won", async () => {
    lead.findUnique.mockResolvedValue({ id: "l1", businessId: "b1", stage: "QUALIFIED", dealValue: 0, nextFollowUp: null });
    deal.findFirst.mockResolvedValue(null);
    await moveLeadStage("b1", "l1", "WON");
    expect(deal.create).toHaveBeenCalledWith({ data: expect.objectContaining({ leadId: "l1", stage: "WON", wonAt: expect.any(Date), lostAt: null }) });
  });

  it("takes the win back when the customer is reopened", async () => {
    await moveLeadStage("b1", "l1", "QUALIFIED");
    expect(deal.updateMany).toHaveBeenCalledWith({
      where: { leadId: "l1", OR: [{ wonAt: { not: null } }, { lostAt: { not: null } }] },
      data: { stage: "QUALIFIED", wonAt: null, lostAt: null },
    });
    expect(deal.create).not.toHaveBeenCalled();
  });

  it("touches nothing for another business's customer", async () => {
    expect(await moveLeadStage("b2", "l1", "QUALIFIED")).toBeNull();
    expect(deal.updateMany).not.toHaveBeenCalled();
    expect(lead.update).not.toHaveBeenCalled();
  });
});
