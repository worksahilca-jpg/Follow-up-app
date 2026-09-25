/**
 * DELETE /api/leads/[id] — the one irreversible per-lead action. Ownership
 * is checked in the route, and the tenant is also handed to
 * deleteLeadCascade so its own last-line check runs right before the rows
 * go (audit 2026-09-16 L-2, fixed 2026-09-26).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "user1", businessId: "biz1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
const { deleteLeadCascade } = vi.hoisted(() => ({ deleteLeadCascade: vi.fn(async () => {}) }));
const { leadFindUnique } = vi.hoisted(() => ({ leadFindUnique: vi.fn() }));

vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/leads-admin", () => ({ deleteLeadCascade }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: leadFindUnique } } }));

import { DELETE } from "@/app/api/leads/[id]/route";

function del(id: string) {
  return DELETE(new NextRequest(`https://followupbase.io/api/leads/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue(ctx);
});

describe("DELETE /api/leads/[id]", () => {
  it("passes the caller's business to the cascade, so its own tenant check runs", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead1", businessId: "biz1" });
    const res = await del("lead1");
    expect(res.status).toBe(200);
    expect(deleteLeadCascade).toHaveBeenCalledWith("lead1", "biz1");
  });

  it("404s another business's lead and deletes nothing", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead9", businessId: "other-biz" });
    const res = await del("lead9");
    expect(res.status).toBe(404);
    expect(deleteLeadCascade).not.toHaveBeenCalled();
  });

  it("401s without a session", async () => {
    getSessionContext.mockResolvedValue(null);
    const res = await del("lead1");
    expect(res.status).toBe(401);
    expect(leadFindUnique).not.toHaveBeenCalled();
  });
});
