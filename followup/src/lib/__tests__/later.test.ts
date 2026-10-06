/**
 * "Later" (A-046): set a waiting reply aside until 2pm or 9am tomorrow in
 * the owner's time zone; it comes straight back if the customer writes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditEvent: { findMany: vi.fn() },
    lead: { findMany: vi.fn(), updateMany: vi.fn() },
    message: { findMany: vi.fn() },
    business: { findUnique: vi.fn() },
    ownerHabit: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { laterTime, laterTodayAvailable } from "@/lib/later";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { POST } from "@/app/api/leads/[id]/later/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const TZ = "America/Toronto";
const MORNING = new Date("2026-09-26T14:00:00Z"); // 10:00 in Toronto
const EVENING = new Date("2026-09-26T21:00:00Z"); // 17:00 in Toronto

describe("the two times", () => {
  it("is 2pm today and 9am tomorrow, in the owner's time zone", () => {
    expect(laterTime("later_today", MORNING, TZ).toISOString()).toBe("2026-09-26T18:00:00.000Z");
    expect(laterTime("tomorrow_morning", MORNING, TZ).toISOString()).toBe("2026-09-27T13:00:00.000Z");
  });

  // The days the clocks change. Counting hours from local midnight put
  // these an hour out: 3pm / 10am in March, 1pm / 8am in November.
  it("is still 2pm and 9am on the days the clocks change", () => {
    // Sunday 2026-03-08, clocks go forward at 2am (EST → EDT).
    expect(laterTime("later_today", new Date("2026-03-08T14:00:00Z"), TZ).toISOString()).toBe("2026-03-08T18:00:00.000Z");
    // Set on the Saturday: tomorrow 9am is 9am EDT.
    expect(laterTime("tomorrow_morning", new Date("2026-03-07T20:00:00Z"), TZ).toISOString()).toBe("2026-03-08T13:00:00.000Z");
    // Sunday 2026-11-01, clocks go back at 2am (EDT → EST).
    expect(laterTime("later_today", new Date("2026-11-01T15:00:00Z"), TZ).toISOString()).toBe("2026-11-01T19:00:00.000Z");
    expect(laterTime("tomorrow_morning", new Date("2026-10-31T20:00:00Z"), TZ).toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  it("uses the owner's calendar day, not UTC's, late in the evening", () => {
    // 21:30 Toronto on 2026-09-26 is already the 27th in UTC.
    const lateEvening = new Date("2026-09-27T01:30:00Z");
    expect(laterTime("tomorrow_morning", lateEvening, TZ).toISOString()).toBe("2026-09-27T13:00:00.000Z");
    expect(laterTime("tomorrow_morning", lateEvening, "America/Vancouver").toISOString()).toBe("2026-09-27T16:00:00.000Z");
  });

  it("only offers later today while 2pm is still at least half an hour away", () => {
    expect(laterTodayAvailable(MORNING, TZ)).toBe(true);
    expect(laterTodayAvailable(EVENING, TZ)).toBe(false);
  });
});

describe("a card set aside", () => {
  const hold = { id: "e1", businessId: "b", action: "ai.hold", targetType: "lead", targetId: "l1", meta: { trigger: "unanswered", reason: "price" }, createdAt: new Date("2026-09-26T12:00:00Z") };
  const inbound = (at: string) => [{ channel: "email", messages: [{ body: "hi", sentAt: new Date(at) }] }];
  beforeEach(() => {
    p.auditEvent.findMany.mockResolvedValue([hold]);
    p.message.findMany.mockResolvedValue([]);
  });

  it("is marked until its time, and still counted", async () => {
    p.lead.findMany.mockResolvedValue([
      { id: "l1", name: "Priya", suggestedMessage: "x", laterUntil: new Date("2026-09-26T18:00:00Z"), laterSetAt: new Date("2026-09-26T13:00:00Z"), conversations: inbound("2026-09-26T11:00:00Z") },
    ]);
    const [a] = await getPendingApprovals("b", MORNING);
    expect(a.laterUntil?.toISOString()).toBe("2026-09-26T18:00:00.000Z");
  });

  it("comes straight back when the customer writes after it was set aside", async () => {
    p.lead.findMany.mockResolvedValue([
      { id: "l1", name: "Priya", suggestedMessage: "x", laterUntil: new Date("2026-09-26T18:00:00Z"), laterSetAt: new Date("2026-09-26T13:00:00Z"), conversations: inbound("2026-09-26T13:30:00Z") },
    ]);
    expect((await getPendingApprovals("b", MORNING))[0].laterUntil).toBeNull();
  });

  it("comes back by itself once the time has passed", async () => {
    p.lead.findMany.mockResolvedValue([
      { id: "l1", name: "Priya", suggestedMessage: "x", laterUntil: new Date("2026-09-26T13:30:00Z"), laterSetAt: new Date("2026-09-26T13:00:00Z"), conversations: inbound("2026-09-26T11:00:00Z") },
    ]);
    expect((await getPendingApprovals("b", MORNING))[0].laterUntil).toBeNull();
  });
});

describe("POST /api/leads/[id]/later", () => {
  const call = (body: unknown) =>
    POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "l1" }) });
  beforeEach(() => {
    vi.mocked(getSessionContext).mockResolvedValue({ businessId: "b", userId: "u" } as never);
    p.business.findUnique.mockResolvedValue({ timezone: TZ });
    p.lead.updateMany.mockResolvedValue({ count: 1 });
  });

  it("sets it aside within this business only", async () => {
    const res = await call({ when: "tomorrow_morning" });
    expect(res.status).toBe(200);
    expect(p.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "l1", businessId: "b" } }));
  });

  it("clears it on Undo", async () => {
    await call({ when: "clear" });
    expect(p.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { laterUntil: null, laterSetAt: null } }));
  });

  it("refuses a lead from another business", async () => {
    p.lead.updateMany.mockResolvedValue({ count: 0 });
    expect((await call({ when: "tomorrow_morning" })).status).toBe(404);
  });

  it("refuses anything but the offered choices", async () => {
    expect((await call({ when: "next_year" })).status).toBe(400);
  });
});
