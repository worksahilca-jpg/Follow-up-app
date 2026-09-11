/**
 * /api/business/booking-source — the toggle between FollowUp's own
 * calendar and the business's real Google Calendar as the source of
 * truth for booking availability (Business.bookingCalendarSource).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/session", () => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/integrations/gmail", () => ({
  getGmailStatus: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { GET, POST } from "@/app/api/business/booking-source/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const session = getSessionContext as unknown as ReturnType<typeof vi.fn>;
const admin = requireAdmin as unknown as ReturnType<typeof vi.fn>;
const gmail = getGmailStatus as unknown as ReturnType<typeof vi.fn>;

function postRequest(body: unknown) {
  return new Request("http://localhost/api/business/booking-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ businessId: "biz1", userId: "user1" });
  admin.mockResolvedValue(true);
});

describe("GET", () => {
  it("returns the current source plus whether Gmail is connected", async () => {
    p.business.findUnique.mockResolvedValue({ bookingCalendarSource: "google" });
    gmail.mockResolvedValue({ connected: true });

    const res = await GET();
    const data = await res.json();

    expect(data).toEqual({ success: true, bookingCalendarSource: "google", gmailConnected: true });
  });

  it("requires a signed-in session", async () => {
    session.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST", () => {
  it("switches to FollowUp's own calendar without needing Gmail connected", async () => {
    gmail.mockResolvedValue({ connected: false });
    p.business.update.mockResolvedValue({});

    const res = await POST(postRequest({ bookingCalendarSource: "followup" }));
    const data = await res.json();

    expect(data).toEqual({ success: true, bookingCalendarSource: "followup" });
    expect(p.business.update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { bookingCalendarSource: "followup" } });
  });

  it("refuses 'google' when Gmail isn't connected", async () => {
    gmail.mockResolvedValue({ connected: false });

    const res = await POST(postRequest({ bookingCalendarSource: "google" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(p.business.update).not.toHaveBeenCalled();
  });

  it("allows 'google' once Gmail is connected", async () => {
    gmail.mockResolvedValue({ connected: true });
    p.business.update.mockResolvedValue({});

    const res = await POST(postRequest({ bookingCalendarSource: "google" }));
    const data = await res.json();

    expect(data.success).toBe(true);
  });

  it("requires admin", async () => {
    admin.mockResolvedValue(false);
    const res = await POST(postRequest({ bookingCalendarSource: "followup" }));
    expect(res.status).toBe(403);
  });

  it("rejects an invalid source value", async () => {
    const res = await POST(postRequest({ bookingCalendarSource: "outlook" }));
    expect(res.status).toBe(400);
  });
});
