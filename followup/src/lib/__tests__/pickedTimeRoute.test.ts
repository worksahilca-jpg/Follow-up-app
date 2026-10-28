/**
 * POST /api/leads/[id]/picked-time (A-242): the owner's three answers to
 * "<name> picked a time". Confirm books through the same createBooking the
 * booking page uses and tells the customer; Another time offers two other
 * free times and tells them; I'll call clears the pick and sends nothing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "user1", businessId: "biz1", email: "owner@example.com", authTime: Date.now() };
const PICKED = new Date("2026-10-30T17:00:00.000Z"); // Friday 1 pm Toronto
const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn(async () => ctx) }));
type SendResult = { success: boolean; message?: string };
const { sendFollowUpToLead } = vi.hoisted(() => ({ sendFollowUpToLead: vi.fn(async (_id: string, _body: string, _opts?: unknown): Promise<SendResult> => ({ success: true })) }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
const { sendRefusal } = vi.hoisted(() => ({ sendRefusal: vi.fn(async (): Promise<string | null> => null) }));
type Booked = { success: true; scheduledAt: string } | { success: false; message: string };
const { createBooking, offerTwoTimes } = vi.hoisted(() => ({
  createBooking: vi.fn(async (_id: string, _iso: string): Promise<Booked> => ({ success: true, scheduledAt: "2026-10-30T17:00:00.000Z" })),
  offerTwoTimes: vi.fn(
    async (_id: string, _now: Date, _tz: string, _opts?: unknown): Promise<{ at: string[]; said: string[] } | null> => ({ at: ["2026-10-31T15:00:00.000Z", "2026-11-02T18:00:00.000Z"], said: ["Saturday at 11 am", "Monday at 1 pm"] })
  ),
}));
type Row = { id: string; name: string; pickedTime: Date | null; offeredTimes: unknown; qualification: unknown; business: { timezone: string } };
const { leadFindFirst, leadUpdate } = vi.hoisted(() => ({
  leadFindFirst: vi.fn(async (): Promise<Row | null> => ({ id: "lead1", name: "Raj Mehta", pickedTime: new Date("2026-10-30T17:00:00.000Z"), offeredTimes: { at: ["2026-10-29T14:00:00.000Z", "2026-10-30T17:00:00.000Z"], said: ["a", "b"] }, qualification: null, business: { timezone: "America/Toronto" } })),
  leadUpdate: vi.fn(async (_args: unknown) => ({})),
}));

vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: vi.fn(async () => "") }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/sendingControl", () => ({ sendRefusal }));
vi.mock("@/lib/booking", () => ({ createBooking, offerTwoTimes }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findFirst: leadFindFirst, update: leadUpdate } } }));

import { POST } from "@/app/api/leads/[id]/picked-time/route";

function post(body: unknown) {
  return POST(
    new NextRequest("https://followupbase.io/api/leads/lead1/picked-time", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "lead1" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sendFollowUpToLead.mockResolvedValue({ success: true });
  sendRefusal.mockResolvedValue(null);
  createBooking.mockResolvedValue({ success: true, scheduledAt: PICKED.toISOString() });
});

describe("confirm", () => {
  it("books the picked time through createBooking, tells the customer, and clears the pick", async () => {
    const res = await post({ action: "confirm" });
    expect(res.status).toBe(200);
    expect(createBooking).toHaveBeenCalledWith("lead1", PICKED.toISOString());
    expect(sendFollowUpToLead).toHaveBeenCalledWith("lead1", "Booked: Friday, Oct 30 at 1 pm. See you then.", { trigger: "manual", humanSend: { userId: "user1" } });
    const data = leadUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.data.pickedTime).toBeNull();
    expect(data.data.suggestedMessage).toBeNull();
    expect(recordAudit).toHaveBeenCalledWith(ctx, "booking.confirm", { targetType: "lead", targetId: "lead1", meta: { scheduledAt: PICKED.toISOString(), sent: true } });
    expect((await res.json()).message).toBe("Booked. FollowUp told Raj.");
  });
  it("names the seller's home in the message when the checklist has it", async () => {
    leadFindFirst.mockResolvedValueOnce({
      id: "lead1", name: "Raj Mehta", pickedTime: PICKED, offeredTimes: null,
      qualification: { v: 2, template: "realtor", items: [{ key: "side", value: "Selling", quote: "we're selling", bucket: "sell" }, { key: "home", value: "42 Elm St, Oakville", quote: "42 Elm St in Oakville" }] },
      business: { timezone: "America/Toronto" },
    });
    await post({ action: "confirm" });
    expect(sendFollowUpToLead.mock.calls[0][1]).toBe("Booked: Friday, Oct 30 at 1 pm, 42 Elm St, Oakville. See you then.");
  });
  it("sends nothing and keeps the pick when the calendar refuses the slot", async () => {
    createBooking.mockResolvedValueOnce({ success: false, message: "That time isn't valid anymore — pick another." });
    const res = await post({ action: "confirm" });
    expect(res.status).toBe(409);
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
  });
  it("still clears the pick when the booking was made but the message didn't send, and says so", async () => {
    sendFollowUpToLead.mockResolvedValueOnce({ success: false, message: "Gmail is disconnected." });
    const res = await post({ action: "confirm" });
    expect(res.status).toBe(200);
    expect((await res.json()).message).toMatch(/^Booked\. The message to Raj didn't send: Gmail is disconnected\./);
    expect(leadUpdate).toHaveBeenCalled();
  });
  it("refuses a teammate who may not send", async () => {
    sendRefusal.mockResolvedValueOnce("Only admins send on this account.");
    const res = await post({ action: "confirm" });
    expect(res.status).toBe(403);
    expect(createBooking).not.toHaveBeenCalled();
  });
});

describe("another time", () => {
  it("offers two other free times, skipping the picked and the offered ones, and stores the new offer", async () => {
    const res = await post({ action: "another" });
    expect(res.status).toBe(200);
    const opts = offerTwoTimes.mock.calls[0][3] as { avoid: string[] };
    expect(opts.avoid).toEqual([PICKED.toISOString(), "2026-10-29T14:00:00.000Z", "2026-10-30T17:00:00.000Z"]);
    expect(sendFollowUpToLead.mock.calls[0][1]).toBe("Sorry, that one doesn't work on my side after all. I can do Saturday at 11 am or Monday at 1 pm. Which works for you?");
    const data = leadUpdate.mock.calls[0][0] as { data: { pickedTime: unknown; offeredTimes: { at: string[]; said: string[] } } };
    expect(data.data.pickedTime).toBeNull();
    expect(data.data.offeredTimes.at).toEqual(["2026-10-31T15:00:00.000Z", "2026-11-02T18:00:00.000Z"]);
    expect((await res.json()).message).toBe("FollowUp offered Raj Saturday at 11 am or Monday at 1 pm.");
  });
  it("says so when the calendar has nothing else free, and sends nothing", async () => {
    offerTwoTimes.mockResolvedValueOnce(null);
    const res = await post({ action: "another" });
    expect(res.status).toBe(409);
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect((await res.json()).message).toMatch(/No other free time/);
  });
});

describe("I'll call instead, and the guards", () => {
  it("clears the pick and sends nothing", async () => {
    const res = await post({ action: "call" });
    expect(res.status).toBe(200);
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
    expect((leadUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data.pickedTime).toBeNull();
    expect(recordAudit).toHaveBeenCalledWith(ctx, "booking.call_instead", { targetType: "lead", targetId: "lead1" });
  });
  it("answers 409 when nothing is picked (already handled)", async () => {
    leadFindFirst.mockResolvedValueOnce({ id: "lead1", name: "Raj Mehta", pickedTime: null, offeredTimes: null, qualification: null, business: { timezone: "America/Toronto" } });
    const res = await post({ action: "confirm" });
    expect(res.status).toBe(409);
  });
  it("answers 404 for another business's customer", async () => {
    leadFindFirst.mockResolvedValueOnce(null);
    expect((await post({ action: "call" })).status).toBe(404);
  });
  it("refuses an unknown action", async () => {
    expect((await post({ action: "book" })).status).toBe(400);
  });
});
