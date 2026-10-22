/**
 * The owner's own numbers from the setup call (the pilot's "before FollowUp"): the founder alone saves them, from
 * this site, and all three empty clears them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const { business } = vi.hoisted(() => ({ business: { updateMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: { business } }));
const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));
const { isPlatformAdmin } = vi.hoisted(() => ({ isPlatformAdmin: vi.fn() }));
vi.mock("@/lib/platformAdmin", () => ({ isPlatformAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { POST } from "../route";

const req = (body: unknown, site = "same-origin") =>
  new NextRequest("http://localhost/api/admin/pilot-baseline", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "sec-fetch-site": site },
  });
const numbers = { businessId: "biz9", inquiriesPerMonth: 60, appointmentsPerMonth: 8, hoursPerWeek: 6 };

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "founderBiz", userId: "u1", email: "founder@example.com" });
  isPlatformAdmin.mockReturnValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  business.updateMany.mockResolvedValue({ count: 1 });
});

describe("saving", () => {
  it("keeps the three numbers on that business", async () => {
    const res = await POST(req(numbers));
    expect(res.status).toBe(200);
    expect(business.updateMany).toHaveBeenCalledWith({
      where: { id: "biz9" },
      data: { pilotBaseline: { inquiriesPerMonth: 60, appointmentsPerMonth: 8, hoursPerWeek: 6 } },
    });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "admin.pilot_baseline", {
      targetType: "business",
      targetId: "biz9",
      meta: { cleared: false },
    });
  });

  it("clears it when all three are empty", async () => {
    await POST(req({ businessId: "biz9", inquiriesPerMonth: null, appointmentsPerMonth: null, hoursPerWeek: null }));
    expect(business.updateMany.mock.calls[0][0].data).toEqual({ pilotBaseline: Prisma.DbNull });
  });

  it("refuses numbers that can't be right", async () => {
    expect((await POST(req({ ...numbers, hoursPerWeek: 200 }))).status).toBe(400);
    expect((await POST(req({ ...numbers, inquiriesPerMonth: -3 }))).status).toBe(400);
    expect(business.updateMany).not.toHaveBeenCalled();
  });

  it("says when the business is gone", async () => {
    business.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await POST(req(numbers))).status).toBe(404);
  });
});

describe("who", () => {
  it("is the founder's alone, from this site", async () => {
    getSessionContext.mockResolvedValueOnce(null);
    expect((await POST(req(numbers))).status).toBe(404);
    isPlatformAdmin.mockReturnValueOnce(false);
    expect((await POST(req(numbers))).status).toBe(404);
    expect((await POST(req(numbers, "cross-site"))).status).toBe(403);
    tooManyRecentActions.mockResolvedValueOnce(true);
    expect((await POST(req(numbers))).status).toBe(429);
    expect(business.updateMany).not.toHaveBeenCalled();
  });
});
