/** POST /api/account/sign-out-everywhere (A-041): stamps the person's own revocation time, and records it. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { sessionCtx, userUpdate, audit } = vi.hoisted(() => ({ sessionCtx: vi.fn(), userUpdate: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext: sessionCtx }));
vi.mock("@/lib/db", () => ({ prisma: { user: { update: userUpdate } } }));
vi.mock("@/lib/audit", () => ({ recordAudit: audit }));

import { POST } from "@/app/api/account/sign-out-everywhere/route";

beforeEach(() => vi.clearAllMocks());

describe("sign out everywhere", () => {
  it("revokes the signed-in person's sessions, not anyone else's", async () => {
    sessionCtx.mockResolvedValue({ userId: "u1", businessId: "biz" });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { sessionsRevokedAt: expect.any(Date) } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }), "account.signed_out_everywhere");
  });

  it("needs a signed-in person", async () => {
    sessionCtx.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
