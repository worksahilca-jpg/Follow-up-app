/**
 * POST /api/leads/[id]/booking (A-242, part 2): the owner's side of change
 * and cancel. On the Booked card, Change takes the booked time off and offers
 * two other free times; Cancel takes it off and tells the customer. On the
 * cancelled card, Offer sends two free times and Seen takes the line off
 * Today without a word.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "user1", businessId: "biz1", email: "owner@example.com", authTime: Date.now() };
const SAT = new Date("2026-10-31T15:00:00.000Z"); // Saturday 11 am Toronto
const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn(async () => ctx) }));
type SendResult = { success: boolean; message?: string };
const { sendFollowUpToLead } = vi.hoisted(() => ({ sendFollowUpToLead: vi.fn(async (_id: string, _body: string, _opts?: unknown): Promise<SendResult> => ({ success: true })) }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
const { sendRefusal } = vi.hoisted(() => ({ sendRefusal: vi.fn(async (): Promise<string | null> => null) }));
type Upcoming = { id: string; scheduledAt: Date } | null;
const { cancelBooking, offerTwoTimes, upcomingBookingFor } = vi.hoisted(() => ({
  cancelBooking: vi.fn(async (_id: string, _biz: string, _by: string): Promise<{ id: string; leadId: string; scheduledAt: Date } | null> => ({ id: "b1", leadId: "lead1", scheduledAt: new Date("2026-10-31T15:00:00.000Z") })),
  offerTwoTimes: vi.fn(
    async (_id: string, _now: Date, _tz: string, _opts?: unknown): Promise<{ at: string[]; said: string[] } | null> => ({ at: ["2026-11-01T16:00:00.000Z", "2026-11-02T18:00:00.000Z"], said: ["Sunday at 11 am", "Monday at 1 pm"] })
  ),
  upcomingBookingFor: vi.fn(async (): Promise<Upcoming> => ({ id: "b1", scheduledAt: new Date("2026-10-31T15:00:00.000Z") })),
}));
const { leadFindFirst, leadUpdate, bookingUpdateMany } = vi.hoisted(() => ({
  leadFindFirst: vi.fn(async (): Promise<{ id: string; name: string; business: { timezone: string } } | null> => ({ id: "lead1", name: "Raj Mehta", business: { timezone: "America/Toronto" } })),
  leadUpdate: vi.fn(async (_args: unknown) => ({})),
  bookingUpdateMany: vi.fn(async (_args: unknown) => ({ count: 1 })),
}));

vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: vi.fn(async () => "") }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/sendingControl", () => ({ sendRefusal }));
vi.mock("@/lib/booking", () => ({ cancelBooking, offerTwoTimes, upcomingBookingFor }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findFirst: leadFindFirst, update: leadUpdate }, booking: { updateMany: bookingUpdateMany } } }));

import { POST } from "@/app/api/leads/[id]/booking/route";

function post(body: unknown) {
  return POST(
    new NextRequest("https://followupbase.io/api/leads/lead1/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "lead1" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // The words say "Saturday at 11 am" only within the week: the clock is pinned to the Wednesday before.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T14:00:00.000Z"));
  sendFollowUpToLead.mockResolvedValue({ success: true });
  sendRefusal.mockResolvedValue(null);
  upcomingBookingFor.mockResolvedValue({ id: "b1", scheduledAt: SAT });
  cancelBooking.mockResolvedValue({ id: "b1", leadId: "lead1", scheduledAt: SAT });
  offerTwoTimes.mockResolvedValue({ at: ["2026-11-01T16:00:00.000Z", "2026-11-02T18:00:00.000Z"], said: ["Sunday at 11 am", "Monday at 1 pm"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("change", () => {
  it("cancels the booked time, offers two other free times, and stores the offer", async () => {
    const res = await post({ action: "change" });
    expect(res.status).toBe(200);
    expect(offerTwoTimes).toHaveBeenCalledWith("lead1", expect.any(Date), "America/Toronto", { avoid: [SAT.toISOString()] });
    expect(cancelBooking).toHaveBeenCalledWith("b1", "biz1", "owner");
    const [, body, opts] = sendFollowUpToLead.mock.calls[0] as [string, string, { quickReplies?: unknown }];
    expect(body).toBe("Sorry, something came up on my side and I can't do Saturday at 11 am anymore. I can do Sunday at 11 am or Monday at 1 pm. Which works for you?");
    expect(opts.quickReplies).toBeTruthy();
    const data = leadUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.data.offeredTimes).toMatchObject({ at: ["2026-11-01T16:00:00.000Z", "2026-11-02T18:00:00.000Z"] });
    expect(data.data.pickedTime).toBeNull();
    expect(recordAudit).toHaveBeenCalledWith(ctx, "booking.owner_change", expect.objectContaining({ targetId: "lead1" }));
  });
  it("leaves the booking alone when there is no other free time", async () => {
    offerTwoTimes.mockResolvedValueOnce(null);
    const res = await post({ action: "change" });
    expect(res.status).toBe(409);
    expect(cancelBooking).not.toHaveBeenCalled();
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
  });
  it("says so when nothing is booked", async () => {
    upcomingBookingFor.mockResolvedValueOnce(null);
    const res = await post({ action: "change" });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("Raj has no booked time coming up.");
  });
});

describe("cancel", () => {
  it("cancels the booked time and tells the customer, with no new time offered", async () => {
    const res = await post({ action: "cancel" });
    expect(res.status).toBe(200);
    expect(cancelBooking).toHaveBeenCalledWith("b1", "biz1", "owner");
    expect(offerTwoTimes).not.toHaveBeenCalled();
    expect(sendFollowUpToLead).toHaveBeenCalledWith("lead1", "Sorry, I have to cancel Saturday at 11 am. I'll get back to you about another time.", { trigger: "manual", humanSend: { userId: "user1" } });
    expect((await res.json()).message).toBe("Cancelled. FollowUp told Raj.");
  });
  it("refuses when only admins send", async () => {
    sendRefusal.mockResolvedValueOnce("Only admins send on this account.");
    const res = await post({ action: "cancel" });
    expect(res.status).toBe(403);
    expect(cancelBooking).not.toHaveBeenCalled();
  });
});

describe("after the customer cancelled", () => {
  it("offer sends two free times and takes the line off Today", async () => {
    const res = await post({ action: "offer" });
    expect(res.status).toBe(200);
    const [, body] = sendFollowUpToLead.mock.calls[0] as [string, string];
    expect(body).toBe("If it helps, I can do Sunday at 11 am or Monday at 1 pm. Which works for you?");
    expect(bookingUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ canceledBy: "customer", cancelSeenAt: null }) }));
    const data = leadUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.data.offeredTimes).toMatchObject({ said: ["Sunday at 11 am", "Monday at 1 pm"] });
  });
  it("seen sends nothing and only marks the line as dealt with", async () => {
    const res = await post({ action: "seen" });
    expect(res.status).toBe(200);
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect(bookingUpdateMany).toHaveBeenCalledTimes(1);
    expect((await res.json()).message).toBe("OK. Nothing sent.");
  });
});

it("knows nothing about another business's customer", async () => {
  leadFindFirst.mockResolvedValueOnce(null);
  const res = await post({ action: "cancel" });
  expect(res.status).toBe(404);
});
