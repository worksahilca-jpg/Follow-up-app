/**
 * task: a lead cycled through WON -> another stage -> WON again used to
 * insert a second Deal row every time, since the route always created
 * one rather than checking for an existing deal first — this covers the
 * fix (update the lead's existing Deal instead of duplicating it).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { leadFindUnique, leadUpdate, dealFindFirst, dealCreate, dealUpdate } = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  leadUpdate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "lead1", stage: data.stage })),
  dealFindFirst: vi.fn(async (): Promise<{ id: string; leadId: string; stage: string; createdAt: Date } | null> => null),
  dealCreate: vi.fn(async () => ({})),
  dealUpdate: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: leadFindUnique, update: leadUpdate },
    deal: { findFirst: dealFindFirst, create: dealCreate, update: dealUpdate },
  },
}));

const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => {}) }));

import { POST } from "@/app/api/leads/[id]/stage/route";

function postRequest(stage: string) {
  return new Request("http://localhost/api/leads/lead1/stage", {
    method: "POST",
    body: JSON.stringify({ stage }),
  }) as unknown as Parameters<typeof POST>[0];
}

const params = Promise.resolve({ id: "lead1" });

function lead(overrides: Record<string, unknown> = {}) {
  return { id: "lead1", businessId: "biz1", stage: "NEGOTIATION", dealValue: 50000, nextFollowUp: new Date(), ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  leadFindUnique.mockResolvedValue(lead());
  dealFindFirst.mockResolvedValue(null);
});

describe("POST /api/leads/[id]/stage — Deal record", () => {
  it("creates a Deal when moving to WON and none exists yet", async () => {
    const res = await POST(postRequest("WON"), { params });
    expect(res.status).toBe(200);
    expect(dealCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadId: "lead1", stage: "WON", value: 50000, lostAt: null }),
    });
    expect(dealUpdate).not.toHaveBeenCalled();
  });

  it("creates a Deal when moving to LOST and none exists yet", async () => {
    const res = await POST(postRequest("LOST"), { params });
    expect(res.status).toBe(200);
    expect(dealCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadId: "lead1", stage: "LOST", wonAt: null }),
    });
  });

  it("updates the existing Deal instead of creating a duplicate — the actual bug", async () => {
    dealFindFirst.mockResolvedValue({ id: "deal1", leadId: "lead1", stage: "WON", createdAt: new Date() });
    const res = await POST(postRequest("WON"), { params });
    expect(res.status).toBe(200);
    expect(dealUpdate).toHaveBeenCalledWith({ where: { id: "deal1" }, data: expect.objectContaining({ stage: "WON" }) });
    expect(dealCreate).not.toHaveBeenCalled();
  });

  it("never touches the Deal table for a non-closing stage", async () => {
    const res = await POST(postRequest("QUALIFIED"), { params });
    expect(res.status).toBe(200);
    expect(dealFindFirst).not.toHaveBeenCalled();
    expect(dealCreate).not.toHaveBeenCalled();
    expect(dealUpdate).not.toHaveBeenCalled();
  });

  it("404s for a lead belonging to another business", async () => {
    leadFindUnique.mockResolvedValue(lead({ businessId: "other-biz" }));
    const res = await POST(postRequest("WON"), { params });
    expect(res.status).toBe(404);
    expect(dealCreate).not.toHaveBeenCalled();
  });
});
