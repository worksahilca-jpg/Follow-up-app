/**
 * "Let FollowUp reply for you?" (A-217, A-218): the question is asked once.
 *
 * What is being defended: only a signed-in admin can mark it answered (it is
 * business-wide, like the switch it offers); the answer is kept once, never
 * duplicated; the route can't be hammered; and it never turns sending on by
 * itself (the yes goes through /api/automation/settings).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(async () => true),
  tooManyRecentActions: vi.fn(async () => false),
  businessFindUnique: vi.fn(),
  businessUpdate: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: h.getSessionContext, requireAdmin: h.requireAdmin }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: h.tooManyRecentActions }));
vi.mock("@/lib/audit", () => ({ recordAudit: h.recordAudit }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: h.businessFindUnique, update: h.businessUpdate } } }));

import { POST } from "@/app/api/automation/offer/route";
import { REPLY_FOR_ME_OFFER } from "@/lib/replyForMeOffer";

beforeEach(() => {
  vi.clearAllMocks();
  h.getSessionContext.mockResolvedValue({ userId: "user1", businessId: "biz1", email: "owner@shop.test", authTime: 0 });
  h.requireAdmin.mockResolvedValue(true);
  h.tooManyRecentActions.mockResolvedValue(false);
  h.businessFindUnique.mockResolvedValue({ dismissedSetupSteps: ["connect-inbox"] });
});

describe("POST /api/automation/offer", () => {
  it("refuses a stranger with 401 and writes nothing", async () => {
    h.getSessionContext.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
    expect(h.businessUpdate).not.toHaveBeenCalled();
  });

  it("refuses a teammate who isn't an admin with 403", async () => {
    h.requireAdmin.mockResolvedValue(false);
    expect((await POST()).status).toBe(403);
    expect(h.businessUpdate).not.toHaveBeenCalled();
  });

  it("is rate-limited per person", async () => {
    h.tooManyRecentActions.mockResolvedValue(true);
    expect((await POST()).status).toBe(429);
    expect(h.tooManyRecentActions).toHaveBeenCalledWith("biz1", "automation.offer:user1", expect.any(Object));
    expect(h.businessUpdate).not.toHaveBeenCalled();
  });

  it("keeps the answer on the person's own business, next to what was there", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(h.businessFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "biz1" } }));
    expect(h.businessUpdate).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { dismissedSetupSteps: ["connect-inbox", REPLY_FOR_ME_OFFER] },
    });
    expect(h.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ businessId: "biz1" }), "automation.offer.answered");
  });

  it("never writes the answer twice", async () => {
    h.businessFindUnique.mockResolvedValue({ dismissedSetupSteps: [REPLY_FOR_ME_OFFER] });
    expect((await POST()).status).toBe(200);
    expect(h.businessUpdate).not.toHaveBeenCalled();
  });

  it("never touches the permission to send", async () => {
    await POST();
    const data = h.businessUpdate.mock.calls[0]![0].data;
    expect(Object.keys(data)).toEqual(["dismissedSetupSteps"]);
  });
});
