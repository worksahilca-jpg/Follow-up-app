/**
 * "Calls to make" on Today and "This week" on the Team page (A-103). A call
 * is owed after "No answer" once it comes due, or to a new customer with a
 * number whom nobody has called or written to. Anyone who answered since,
 * or was reached, is left off. A teammate sees their own and the unassigned.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/sendChannels", () => ({ canSendOn: vi.fn(async () => true) }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince: vi.fn(async () => false) }));
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    business: { findUnique: vi.fn() },
    lead: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    callAttempt: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getCallsToMake, getTeamWeek } from "@/lib/calls";

const NOW = new Date("2026-10-08T22:00:00Z");
const base = { id: "l1", name: "Priya Nair", phone: "(905) 555-0143", source: "Facebook ad", createdAt: new Date("2026-10-07T13:02:00Z"), nextCallAt: null, talkedAt: null, callAttempts: [], conversations: [] };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.business.findUnique.mockResolvedValue({ teamCalls: true });
  prismaMock.lead.findMany.mockResolvedValue([]);
});

describe("calls to make", () => {
  it("is empty on a business that hasn't turned calls on", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ teamCalls: false });
    expect(await getCallsToMake("biz1", "u1", NOW)).toEqual([]);
    expect(prismaMock.lead.findMany).not.toHaveBeenCalled();
  });

  it("shows a teammate their own customers and the unassigned, in their business only", async () => {
    await getCallsToMake("biz1", "u1", NOW);
    for (const [arg] of prismaMock.lead.findMany.mock.calls) {
      expect(arg.where.businessId).toBe("biz1");
      expect(arg.where.OR).toEqual([{ assignedToId: "u1" }, { assignedToId: null }]);
      expect(arg.where.saidNoAt).toBeNull();
    }
  });

  it("lists a new customer nobody has called as the 1st call", async () => {
    prismaMock.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([base]);
    const [c] = await getCallsToMake("biz1", "u1", NOW);
    expect(c).toMatchObject({ leadId: "l1", callNumber: 1, lastTriedAt: null, texted: false });
  });

  it("lists a call that came due, counting the unanswered ones", async () => {
    const tried = new Date("2026-10-07T18:14:00Z");
    prismaMock.lead.findMany.mockResolvedValueOnce([
      {
        ...base,
        nextCallAt: new Date("2026-10-08T18:14:00Z"),
        callAttempts: [{ outcome: "no_answer", createdAt: tried }],
        conversations: [{ messages: [{ direction: "outbound", sentAt: new Date("2026-10-07T18:20:00Z") }] }],
      },
    ]).mockResolvedValueOnce([]);
    const [c] = await getCallsToMake("biz1", "u1", NOW);
    expect(c).toMatchObject({ callNumber: 2, lastTriedAt: tried.toISOString(), texted: true });
  });

  it("leaves off anyone who wrote back since the last call", async () => {
    prismaMock.lead.findMany.mockResolvedValueOnce([
      {
        ...base,
        nextCallAt: new Date("2026-10-08T18:14:00Z"),
        callAttempts: [{ outcome: "no_answer", createdAt: new Date("2026-10-07T18:14:00Z") }],
        conversations: [{ messages: [{ direction: "inbound", sentAt: new Date("2026-10-07T19:00:00Z") }] }],
      },
    ]).mockResolvedValueOnce([]);
    expect(await getCallsToMake("biz1", "u1", NOW)).toEqual([]);
  });

  it("leaves off anyone reached, and anyone without a number to dial", async () => {
    prismaMock.lead.findMany.mockResolvedValueOnce([
      { ...base, id: "a", nextCallAt: new Date("2026-10-08T18:00:00Z"), callAttempts: [{ outcome: "spoke", createdAt: new Date("2026-10-07T18:00:00Z") }] },
      { ...base, id: "b", nextCallAt: new Date("2026-10-08T18:00:00Z"), phone: "ig:1784140000" },
    ]).mockResolvedValueOnce([]);
    expect(await getCallsToMake("biz1", "u1", NOW)).toEqual([]);
  });
});

describe("this week", () => {
  it("counts each person's calls, who they reached and their meetings, and flags only someone calling with none", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "owner", name: "Local Owner", email: "o@x.com" },
      { id: "sam", name: "Sam Patel", email: "s@x.com" },
      { id: "arjun", name: "Arjun Mehta", email: "a@x.com" },
    ]);
    prismaMock.callAttempt.findMany.mockResolvedValue([
      { userId: "sam", outcome: "no_answer" },
      { userId: "sam", outcome: "spoke" },
      { userId: "arjun", outcome: "no_answer" },
    ]);
    prismaMock.booking.findMany.mockResolvedValue([{ lead: { assignedToId: "sam" } }]);
    prismaMock.booking.count.mockResolvedValue(4);
    const week = await getTeamWeek("biz1", "America/Toronto", NOW);
    expect(week).toMatchObject({ calls: 3, spoke: 1, meetings: 1, meetingsLastWeek: 4 });
    const by = Object.fromEntries(week!.people.map((p) => [p.userId, p]));
    expect(by.sam).toMatchObject({ calls: 2, spoke: 1, meetings: 1, behind: false });
    expect(by.arjun).toMatchObject({ calls: 1, meetings: 0, behind: true });
    expect(by.owner).toMatchObject({ calls: 0, behind: false });
    for (const [arg] of prismaMock.callAttempt.findMany.mock.calls) expect(arg.where.businessId).toBe("biz1");
  });

  it("is nothing on a business that hasn't turned calls on", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ teamCalls: false });
    expect(await getTeamWeek("biz1", "America/Toronto", NOW)).toBeNull();
  });
});
