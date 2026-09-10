/**
 * The approval queue (src/lib/pendingApprovals.ts) —
 * research/product/2026-09-10-ux-simplification.md §0.6 and §8 item #1:
 * a lead is "pending" exactly when its most recent AuditEvent is
 * "ai.hold" — a later ai.send/lead.send/ai.hold_dismissed event for the
 * same lead means it's resolved and drops out, with no separate flag to
 * keep in sync.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditEvent: { findMany: vi.fn() },
    lead: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getPendingApprovals, dismissHold } from "@/lib/pendingApprovals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    businessId: "biz1",
    action: "ai.hold",
    targetType: "lead",
    targetId: "lead1",
    meta: { riskLevel: "medium", reason: "mentions a price", trigger: "silence" },
    createdAt: new Date("2026-09-10T12:00:00Z"),
    ...overrides,
  };
}

function lead(overrides: Record<string, unknown> = {}) {
  return { id: "lead1", name: "Priya Raman", suggestedSubject: "Re: quote", suggestedMessage: "Here is the quote.", ...overrides };
}

beforeEach(() => {
  p.auditEvent.findMany.mockResolvedValue([]);
  p.lead.findMany.mockResolvedValue([]);
  p.lead.findFirst.mockResolvedValue(null);
});

describe("getPendingApprovals", () => {
  it("surfaces a lead whose latest event is still ai.hold, with the held draft attached", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead()]);
    const result = await getPendingApprovals("biz1");
    expect(result).toEqual([
      {
        leadId: "lead1",
        leadName: "Priya Raman",
        riskLevel: "medium",
        reason: "mentions a price",
        trigger: "silence",
        heldAt: event().createdAt,
        draftSubject: "Re: quote",
        draftMessage: "Here is the quote.",
      },
    ]);
  });

  it("excludes a lead whose latest event is a later send, not a hold", async () => {
    // distinct-by-targetId + orderBy desc means only the SEND event (the
    // real latest one) comes back for a resolved lead — the query itself
    // is what enforces "most recent," so the fixture reflects that.
    p.auditEvent.findMany.mockResolvedValue([event({ id: "e2", action: "ai.send", createdAt: new Date("2026-09-10T13:00:00Z") })]);
    const result = await getPendingApprovals("biz1");
    expect(result).toEqual([]);
  });

  it("excludes a lead whose latest event is ai.hold_dismissed (declined via 'Don't send')", async () => {
    p.auditEvent.findMany.mockResolvedValue([event({ id: "e3", action: "ai.hold_dismissed", meta: null })]);
    const result = await getPendingApprovals("biz1");
    expect(result).toEqual([]);
  });

  it("skips a held lead with no cached draft to show", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead({ suggestedMessage: null })]);
    const result = await getPendingApprovals("biz1");
    expect(result).toEqual([]);
  });

  it("returns multiple pending approvals sorted newest-held first", async () => {
    p.auditEvent.findMany.mockResolvedValue([
      event({ id: "e1", targetId: "lead1", createdAt: new Date("2026-09-10T10:00:00Z") }),
      event({ id: "e2", targetId: "lead2", createdAt: new Date("2026-09-10T14:00:00Z") }),
    ]);
    p.lead.findMany.mockResolvedValue([lead({ id: "lead1" }), lead({ id: "lead2", name: "Dan Whitmore" })]);
    const result = await getPendingApprovals("biz1");
    expect(result.map((r) => r.leadId)).toEqual(["lead2", "lead1"]);
  });

  it("defaults riskLevel/reason/trigger when meta is missing or malformed", async () => {
    p.auditEvent.findMany.mockResolvedValue([event({ meta: null })]);
    p.lead.findMany.mockResolvedValue([lead()]);
    const result = await getPendingApprovals("biz1");
    expect(result[0]).toMatchObject({ riskLevel: "medium", reason: "", trigger: "silence" });
  });

  it("returns nothing when there are no held leads at all", async () => {
    p.auditEvent.findMany.mockResolvedValue([event({ action: "lead.send" })]);
    const result = await getPendingApprovals("biz1");
    expect(result).toEqual([]);
    expect(p.lead.findMany).not.toHaveBeenCalled(); // no held events — no need to even look up leads
  });
});

describe("dismissHold", () => {
  it("records ai.hold_dismissed for a lead the business actually owns", async () => {
    p.lead.findFirst.mockResolvedValue({ id: "lead1" });
    const result = await dismissHold("lead1", "biz1", "user1");
    expect(result).toEqual({ success: true });
    expect(audit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: "user1" },
      "ai.hold_dismissed",
      expect.objectContaining({ targetType: "lead", targetId: "lead1" })
    );
  });

  it("refuses a lead that doesn't belong to this business, without writing an audit event", async () => {
    p.lead.findFirst.mockResolvedValue(null);
    const result = await dismissHold("lead1", "biz1", "user1");
    expect(result).toEqual({ success: false, message: "Lead not found." });
    expect(audit).not.toHaveBeenCalled();
  });
});
