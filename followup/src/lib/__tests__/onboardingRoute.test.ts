/**
 * task (sixth-pass audit, finding #3): POST /api/onboarding had no role
 * check (any signed-in team member, not just an admin, could rewrite the
 * business's own profile at any time), and always wrote a full
 * { name, industry, teamSize } record built from `?? ""`/`?? null`
 * defaults — a partial call (e.g. just { name }) silently reset the
 * other two fields to empty/null instead of leaving them alone.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { update } = vi.hoisted(() => ({
  update: vi.fn(async (query: unknown) => {
    void query;
    return {};
  }),
}));

vi.mock("@/lib/db", () => ({ prisma: { business: { update } } }));
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "user1" })),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://followupbase.io/api/onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1" });
  requireAdmin.mockResolvedValue(true);
});

describe("POST /api/onboarding — role check", () => {
  it("rejects a non-admin team member", async () => {
    requireAdmin.mockResolvedValue(false);
    const { POST } = await import("@/app/api/onboarding/route");
    const res = await POST(jsonRequest({ name: "New Name" }));
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("POST /api/onboarding — partial update no longer wipes other fields", () => {
  it("patches only the fields present in the request, leaving the rest untouched", async () => {
    const { POST } = await import("@/app/api/onboarding/route");
    const res = await POST(jsonRequest({ name: "Riverside Realty Group" }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { name: "Riverside Realty Group" } });
    // Specifically: industry/teamSize must never appear in this call's
    // data object at all — not even as null — since they weren't sent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (update.mock.calls[0]![0] as any).data;
    expect(data).not.toHaveProperty("industry");
    expect(data).not.toHaveProperty("teamSize");
  });

  it("still updates all three fields together when all three are sent (the real onboarding wizard's call shape)", async () => {
    const { POST } = await import("@/app/api/onboarding/route");
    await POST(jsonRequest({ name: "Acme Plumbing", industry: "Home services", teamSize: 4 }));
    expect(update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { name: "Acme Plumbing", industry: "Home services", teamSize: 4 },
    });
  });

  it("rejects an explicitly empty name", async () => {
    const { POST } = await import("@/app/api/onboarding/route");
    const res = await POST(jsonRequest({ name: "" }));
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("still handles finish:true as its own, unrelated update", async () => {
    const { POST } = await import("@/app/api/onboarding/route");
    const res = await POST(jsonRequest({ finish: true }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { onboarded: true } });
  });
});
