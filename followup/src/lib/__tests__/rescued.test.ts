/**
 * The "what FollowUp saved you" report must never flatter itself: only
 * replies to messages FollowUp sent on its own count, each lead counts
 * once, and money is split into in-play vs closed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { followUp: { findMany: vi.fn() }, booking: { count: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { getRescueReport, renderRescueDigest } from "@/lib/rescued";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const h = (hours: number) => new Date(Date.now() - hours * 3_600_000);

function sentRow(leadId: string, over: Record<string, unknown> = {}) {
  return {
    leadId,
    trigger: "unanswered",
    sentAt: h(50),
    repliedAt: h(40),
    lead: { id: leadId, name: `Lead ${leadId}`, dealValue: 1000, stage: "NEW" },
    ...over,
  };
}

beforeEach(() => {
  p.booking.count.mockResolvedValue(0);
});

describe("rescue report", () => {
  it("only asks for automated sends — manual replies are the owner's own work", async () => {
    p.followUp.findMany.mockResolvedValue([]);
    await getRescueReport("biz1", 7);
    expect(p.followUp.findMany.mock.calls[0][0].where).toMatchObject({ automated: true, status: "sent" });
  });

  it("counts a lead once even if several automated messages got replies", async () => {
    p.followUp.findMany.mockResolvedValue([sentRow("a"), sentRow("a", { trigger: "silence" }), sentRow("b", { repliedAt: null })]);
    const r = await getRescueReport("biz1", 7);
    expect(r.answeredForYou).toBe(3);
    expect(r.rescued).toBe(1);
    expect(r.leads[0]).toMatchObject({ id: "a", repliedAfterHours: 10 });
  });

  it("splits value into in-play and closed, and counts bookings for rescued leads only", async () => {
    p.followUp.findMany.mockResolvedValue([
      sentRow("a", { lead: { id: "a", name: "A", dealValue: 5000, stage: "WON" } }),
      sentRow("b", { lead: { id: "b", name: "B", dealValue: 2000, stage: "QUALIFIED" } }),
      sentRow("c", { lead: { id: "c", name: "C", dealValue: 900, stage: "LOST" } }),
    ]);
    p.booking.count.mockResolvedValue(2);
    const r = await getRescueReport("biz1", 7);
    expect(r.won).toBe(1);
    expect(r.wonValue).toBe(5000);
    expect(r.valueInPlay).toBe(2000);
    expect(r.booked).toBe(2);
    expect(p.booking.count.mock.calls[0][0].where.leadId.in.sort()).toEqual(["a", "b", "c"]);
  });

  it("renders a digest an owner can read in ten seconds", async () => {
    p.followUp.findMany.mockResolvedValue([sentRow("a")]);
    const r = await getRescueReport("biz1", 7);
    const text = renderRescueDigest("MJ Homes", r, "https://followupbase.io");
    expect(text).toContain("Conversations won back: 1");
    expect(text).toContain("Lead a — replied when you hadn't, replied 10h later");
    expect(text).toContain("https://followupbase.io/dashboard");
  });
});
