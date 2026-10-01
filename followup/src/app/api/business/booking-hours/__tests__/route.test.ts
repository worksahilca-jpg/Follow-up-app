/**
 * /api/business/booking-hours — when customers can book, and the
 * business's time zone (A-078).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/session", () => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { GET, POST } from "@/app/api/business/booking-hours/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const session = getSessionContext as unknown as ReturnType<typeof vi.fn>;
const admin = requireAdmin as unknown as ReturnType<typeof vi.fn>;

function postRequest(body: unknown) {
  return new Request("http://localhost/api/business/booking-hours", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const good = { days: [1, 2, 3, 4, 5, 6, 0], startMinute: 600, endMinute: 1260, timezone: "America/Vancouver" };

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ businessId: "biz1", userId: "user1" });
  admin.mockResolvedValue(true);
  p.business.update.mockResolvedValue({});
});

describe("GET", () => {
  it("returns the saved hours and time zone", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/Toronto", bookingDays: [6, 1], bookingStartMinute: 600, bookingEndMinute: 900 });
    const data = await (await GET()).json();
    expect(data).toEqual({ success: true, timezone: "America/Toronto", days: [1, 6], startMinute: 600, endMinute: 900 });
  });

  it("requires a signed-in session", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});

describe("POST", () => {
  it("saves days (sorted), hours and time zone", async () => {
    const res = await POST(postRequest(good));
    const data = await res.json();
    expect(data).toEqual({ success: true, timezone: "America/Vancouver", days: [0, 1, 2, 3, 4, 5, 6], startMinute: 600, endMinute: 1260 });
    expect(p.business.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { timezone: "America/Vancouver", bookingDays: [0, 1, 2, 3, 4, 5, 6], bookingStartMinute: 600, bookingEndMinute: 1260 },
    });
  });

  it("refuses no days, an end before the start, and a time off the half hour", async () => {
    for (const body of [
      { ...good, days: [] },
      { ...good, startMinute: 900, endMinute: 600 },
      { ...good, startMinute: 605 },
    ]) {
      const res = await POST(postRequest(body));
      expect(res.status).toBe(400);
    }
    expect(p.business.update).not.toHaveBeenCalled();
  });

  it("refuses a time zone Intl doesn't know", async () => {
    const res = await POST(postRequest({ ...good, timezone: "Mars/Olympus_Mons" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/time zone/i);
    expect(p.business.update).not.toHaveBeenCalled();
  });

  it("requires admin", async () => {
    admin.mockResolvedValue(false);
    expect((await POST(postRequest(good))).status).toBe(403);
  });
});
