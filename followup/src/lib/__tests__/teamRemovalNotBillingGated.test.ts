/**
 * Removing a teammate takes access away, so it must work whatever the
 * card is doing (security hunt 2026-09-30).
 *
 * DELETE /api/team/members/[id] was behind requireActiveBilling. A Plus or
 * Pro business whose card failed (past_due / unpaid) could not remove
 * anyone — while the person being removed kept reading every customer,
 * because reads are not billing-gated. Same principle the codebase already
 * applies to pausing ("stopping must never be harder than starting"),
 * export and erasure.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionContext, requireActiveBilling, removeMember, updateMemberRole } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireActiveBilling: vi.fn(),
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling, billingLockedMessage: vi.fn(async () => "Billing is locked.") }));
vi.mock("@/lib/team", () => ({ removeMember, updateMemberRole }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { DELETE, PATCH } from "@/app/api/team/members/[id]/route";

const params = { params: Promise.resolve({ id: "user-bob" }) };

beforeEach(() => {
  getSessionContext.mockResolvedValue({ userId: "user-admin", businessId: "biz1", email: "a@x.com", authTime: Date.now() });
  requireActiveBilling.mockResolvedValue(false); // card failed: past_due on Plus
  removeMember.mockResolvedValue({ success: true });
  updateMemberRole.mockResolvedValue({ success: true });
});

describe("team member removal while billing is lapsed", () => {
  it("still removes the member", async () => {
    const res = await DELETE(new NextRequest("https://followupbase.io/api/team/members/user-bob", { method: "DELETE" }), params);
    expect(res.status).toBe(200);
    // Admin check lives in removeMember, which still runs with the caller's own ids.
    expect(removeMember).toHaveBeenCalledWith("user-bob", "biz1", "user-admin");
  });

  it("still requires sign-in", async () => {
    getSessionContext.mockResolvedValue(null);
    const res = await DELETE(new NextRequest("https://followupbase.io/api/team/members/user-bob", { method: "DELETE" }), params);
    expect(res.status).toBe(401);
    expect(removeMember).not.toHaveBeenCalled();
  });

  it("leaves role changes behind the billing gate as before", async () => {
    const req = new NextRequest("https://followupbase.io/api/team/members/user-bob", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "ADMIN" }),
    });
    const res = await PATCH(req, params);
    expect(res.status).toBe(402);
    expect(updateMemberRole).not.toHaveBeenCalled();
  });
});
