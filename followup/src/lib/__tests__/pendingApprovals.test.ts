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
    message: { findMany: vi.fn() },
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
  p.message.findMany.mockResolvedValue([]);
});

describe("getPendingApprovals — a lead already answered leaves the queue", () => {
  // 2026-09-25 audit F1: "Send all routine" writes no per-lead audit row,
  // so every lead it sent stayed held and the next press re-sent the same
  // drafts. The queue now asks the message table instead.
  it("drops a held lead that has been sent something since the hold", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead()]);
    p.message.findMany.mockResolvedValue([
      { sentAt: new Date("2026-09-10T12:05:00Z"), conversation: { leadId: "lead1" } },
    ]);
    expect(await getPendingApprovals("biz1")).toEqual([]);
  });

  it("keeps a held lead whose only outbound message predates the hold", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead()]);
    p.message.findMany.mockResolvedValue([
      { sentAt: new Date("2026-09-10T11:00:00Z"), conversation: { leadId: "lead1" } },
    ]);
    expect(await getPendingApprovals("biz1")).toHaveLength(1);
  });

  // Found live 2026-09-25: "This was a lead" holds a draft, then records the
  // override a few ms later. With the override as the newest event, the
  // draft left the queue and the owner was never alerted.
  it("never lets the restore override or the acknowledgement stand in for a decision", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead()]);
    await getPendingApprovals("biz1");
    const asked = p.auditEvent.findMany.mock.calls[0][0].where.action.in as string[];
    expect(asked).toContain("ai.hold");
    expect(asked).not.toContain("lead.classification_overridden");
  });

  // Daily-path sweep 2026-09-25 #6: a denylist let every new kind of lead
  // event hide a hold. Only decisions are asked for now.
  it("does not let a DM tap, an opt-in or a quiet-lead verdict hide a hold", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead()]);
    await getPendingApprovals("biz1");
    const asked = p.auditEvent.findMany.mock.calls[0][0].where.action.in as string[];
    for (const noise of ["lead.dm_answer", "lead.opt_in", "ai.quiet_outcome_classified", "lead.classification_overridden"]) {
      expect(asked, `${noise} can hide a held draft again`).not.toContain(noise);
    }
  });

  it("keeps a hold when the only newer event is the acknowledgement", async () => {
    // The acknowledgement is an "ai.send" with trigger instant_ack in meta.
    p.auditEvent.findMany.mockResolvedValue([
      event({ id: "ack", action: "ai.send", meta: { trigger: "instant_ack" }, createdAt: new Date("2026-09-10T12:00:01Z") }),
      event(),
    ]);
    p.lead.findMany.mockResolvedValue([lead()]);
    expect(await getPendingApprovals("biz1")).toHaveLength(1);
  });

  it("drops a hold when a real send is newer", async () => {
    p.auditEvent.findMany.mockResolvedValue([
      event({ id: "sent", action: "ai.send", meta: { trigger: "silence" }, createdAt: new Date("2026-09-10T12:10:00Z") }),
      event(),
    ]);
    p.lead.findMany.mockResolvedValue([lead()]);
    expect(await getPendingApprovals("biz1")).toEqual([]);
  });

  it("drops a hold when the customer opted out after it", async () => {
    p.auditEvent.findMany.mockResolvedValue([
      event({ id: "stop", action: "lead.opt_out", meta: null, createdAt: new Date("2026-09-10T13:00:00Z") }),
      event(),
    ]);
    p.lead.findMany.mockResolvedValue([lead()]);
    expect(await getPendingApprovals("biz1")).toEqual([]);
  });

  it("does not count the instant acknowledgement as an answer", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead()]);
    await getPendingApprovals("biz1");
    expect(p.message.findMany.mock.calls[0][0].where.OR).toEqual([{ trigger: null }, { trigger: { not: "instant_ack" } }]);
  });

  it("only asks about this business's leads, and only outbound messages after the oldest hold", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead()]);
    await getPendingApprovals("biz1");
    const where = p.message.findMany.mock.calls[0][0].where;
    expect(where.direction).toBe("outbound");
    expect(where.sentAt).toEqual({ gt: new Date("2026-09-10T12:00:00Z") });
    expect(where.conversation).toEqual({ leadId: { in: ["lead1"] }, lead: { businessId: "biz1" } });
  });
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
        leadLastMessage: null,
        leadLastMessageChannel: null,
        leadLastMessageAt: null,
      },
    ]);
  });

  it("attaches the lead's own most recent inbound message, so a reviewer sees what the draft is replying to", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([
      lead({
        conversations: [
          { channel: "email", messages: [{ body: "What's the price on the Maple St place?", sentAt: new Date("2026-09-10T11:00:00Z") }] },
        ],
      }),
    ]);
    const result = await getPendingApprovals("biz1");
    expect(result[0].leadLastMessage).toBe("What's the price on the Maple St place?");
    expect(result[0].leadLastMessageChannel).toBe("email");
  });

  it("picks the most recent inbound message across multiple conversations/channels, not just the first one", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([
      lead({
        conversations: [
          { channel: "email", messages: [{ body: "Older email question", sentAt: new Date("2026-09-09T09:00:00Z") }] },
          { channel: "text", messages: [{ body: "Newer text follow-up", sentAt: new Date("2026-09-10T15:00:00Z") }] },
        ],
      }),
    ]);
    const result = await getPendingApprovals("biz1");
    expect(result[0].leadLastMessage).toBe("Newer text follow-up");
    expect(result[0].leadLastMessageChannel).toBe("text");
    // Sent back with Approve & send so a draft the lead has since answered is refused (F7).
    expect(result[0].leadLastMessageAt).toBe("2026-09-10T15:00:00.000Z");
  });

  it("truncates a very long inbound message rather than shipping the whole body to the dashboard", async () => {
    const longBody = "x".repeat(500);
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([
      lead({ conversations: [{ channel: "email", messages: [{ body: longBody, sentAt: new Date() }] }] }),
    ]);
    const result = await getPendingApprovals("biz1");
    expect(result[0].leadLastMessage?.length).toBeLessThan(longBody.length);
    expect(result[0].leadLastMessage?.endsWith("…")).toBe(true);
  });

  it("leaves leadLastMessage null when the lead has conversations but no inbound message at all", async () => {
    p.auditEvent.findMany.mockResolvedValue([event()]);
    p.lead.findMany.mockResolvedValue([lead({ conversations: [{ channel: "email", messages: [] }] })]);
    const result = await getPendingApprovals("biz1");
    expect(result[0].leadLastMessage).toBeNull();
    expect(result[0].leadLastMessageChannel).toBeNull();
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
