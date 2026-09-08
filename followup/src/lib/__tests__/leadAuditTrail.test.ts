/**
 * task #85 (second-pass audit): getLeadAuditTrail() used to hard-cap at 25
 * events with no way for the UI to know there was more. It now returns the
 * total count alongside the capped list so LeadTrustPanel can say "showing
 * the 25 most recent of N" instead of silently implying completeness.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditEvent: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { getLeadAuditTrail } from "@/lib/leads-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const session = getSessionContext as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  session.mockResolvedValue({ businessId: "biz1", userId: "user1" });
  p.auditEvent.findMany.mockResolvedValue([]);
  p.auditEvent.count.mockResolvedValue(0);
});

describe("getLeadAuditTrail", () => {
  it("reports totalCount equal to events.length when nothing is truncated", async () => {
    const rows = [{ id: "e1", action: "lead.send", createdAt: new Date(), meta: null }];
    p.auditEvent.findMany.mockResolvedValue(rows);
    p.auditEvent.count.mockResolvedValue(1);
    const trail = await getLeadAuditTrail("lead1");
    expect(trail.events).toHaveLength(1);
    expect(trail.totalCount).toBe(1);
  });

  it("reports a totalCount higher than the capped list when a lead has more than 25 events", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}`, action: "ai.hold", createdAt: new Date(), meta: null }));
    p.auditEvent.findMany.mockResolvedValue(rows);
    p.auditEvent.count.mockResolvedValue(40); // the lead actually has 40 rows on record
    const trail = await getLeadAuditTrail("lead1");
    expect(trail.events).toHaveLength(25);
    expect(trail.totalCount).toBe(40); // the UI can now tell 25-of-40 apart from exactly-25
  });

  it("scopes both the list and the count to the caller's business and this lead", async () => {
    await getLeadAuditTrail("lead1");
    const expectedWhere = { businessId: "biz1", targetType: "lead", targetId: "lead1" };
    expect(p.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(p.auditEvent.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("returns an empty trail with no queries when there is no session", async () => {
    session.mockResolvedValue(null);
    const trail = await getLeadAuditTrail("lead1");
    expect(trail).toEqual({ events: [], totalCount: 0 });
    expect(p.auditEvent.findMany).not.toHaveBeenCalled();
  });
});
