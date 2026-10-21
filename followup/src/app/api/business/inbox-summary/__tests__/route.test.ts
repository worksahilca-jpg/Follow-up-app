/** "Got it" on "Your last 90 days" (A-306): admin only, and the card stays gone. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { prismaMock } = vi.hoisted(() => ({ prismaMock: { business: { update: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  prismaMock.business.update.mockResolvedValue({});
});

describe("Got it", () => {
  it("marks it seen for this business", async () => {
    expect((await POST()).status).toBe(200);
    const call = prismaMock.business.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "biz1" });
    expect(call.data.inboxSummarySeenAt).toBeInstanceOf(Date);
  });

  it("only an admin, signed in", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await POST()).status).toBe(403);
    getSessionContext.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });
});
