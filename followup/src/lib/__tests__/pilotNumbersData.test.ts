/**
 * The pilot loader: every count is one business's own records, never the practice customer, and one business that
 * can't be read never hides the others.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    business: { findMany: vi.fn() },
    followUp: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    auditEvent: { groupBy: vi.fn() },
    filteredEmail: { count: vi.fn() },
    booking: { findMany: vi.fn() },
    integration: { findFirst: vi.fn() },
    message: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getPilotNumbers } from "@/lib/pilotNumbersData";

const now = new Date("2026-10-22T12:00:00Z");
const REAL = { OR: [{ source: null }, { source: { not: "Test lead" } }] };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.business.findMany.mockResolvedValue([
    { id: "biz1", name: "One", industry: "Real estate", pilotBaseline: { inquiriesPerMonth: 40 } },
    { id: "biz2", name: "Two", industry: null, pilotBaseline: null },
  ]);
  prismaMock.followUp.findMany.mockResolvedValue([{ automated: true, draftEdited: null, trigger: "instant_ack", repliedAt: now }]);
  prismaMock.lead.findMany.mockResolvedValue([{ qualification: null, stage: "WON", bookings: [] }]);
  prismaMock.auditEvent.groupBy.mockResolvedValue([{ action: "lead.not_customer", _count: { _all: 1 } }]);
  prismaMock.filteredEmail.count.mockResolvedValue(3);
  prismaMock.booking.findMany.mockResolvedValue([]);
  prismaMock.integration.findFirst.mockResolvedValue({ connectedAt: new Date("2026-10-01T00:00:00Z") });
  prismaMock.message.findMany.mockResolvedValue([
    { direction: "inbound", sentAt: new Date("2026-09-20T08:00:00Z"), conversation: { leadId: "a" } },
  ]);
});

describe("getPilotNumbers", () => {
  it("counts each business's own records, never the practice customer", async () => {
    const r = await getPilotNumbers(now);
    expect(r.businesses.map((b) => b.id)).toEqual(["biz1", "biz2"]);
    const first = r.businesses[0];
    expect(first.calls).toMatchObject({ letIn: 2, setAside: 1, keptOut: 3 });
    expect(first.replies.onItsOwn).toBe(1);
    expect(first.answering?.before.wrote).toBe(1);
    expect(first.baseline).toEqual({ inquiriesPerMonth: 40, appointmentsPerMonth: null, hoursPerWeek: null });

    expect(prismaMock.followUp.findMany.mock.calls[0][0].where.lead).toEqual({ businessId: "biz1", ...REAL });
    expect(prismaMock.lead.findMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz1", ...REAL });
    expect(prismaMock.auditEvent.groupBy.mock.calls[0][0].where.businessId).toBe("biz1");
    expect(prismaMock.filteredEmail.count.mock.calls[0][0].where.businessId).toBe("biz1");
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz1", lead: REAL });
    expect(prismaMock.integration.findFirst.mock.calls[0][0].where.user).toEqual({ businessId: "biz1" });
    expect(prismaMock.message.findMany.mock.calls[0][0].where.conversation).toEqual({ lead: { businessId: "biz1", ...REAL } });
    expect(prismaMock.followUp.findMany.mock.calls[1][0].where.lead.businessId).toBe("biz2");
  });

  it("has no before-and-since without anything connected", async () => {
    prismaMock.integration.findFirst.mockResolvedValue(null);
    const r = await getPilotNumbers(now);
    expect(r.businesses[0].answering).toBeNull();
    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
  });

  it("leaves out a business that can't be read, and keeps the rest", async () => {
    prismaMock.followUp.findMany.mockRejectedValueOnce(new Error("pool timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await getPilotNumbers(now);
    expect(r.businesses.map((b) => b.id)).toEqual(["biz2"]);
  });
});
