/**
 * POST /api/automation/pause (A-041): anyone on the team may pause, since
 * it only ever holds messages; only an admin may resume, since resuming
 * lets FollowUp send on the business's behalf again.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { sessionCtx, admin, billing, pause, resume, audit } = vi.hoisted(() => ({
  sessionCtx: vi.fn(),
  admin: vi.fn(),
  billing: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionContext: sessionCtx, requireAdmin: admin }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: billing, billingLockedMessage: async () => "Billing is locked." }));
vi.mock("@/lib/sendingControl", () => ({ pauseSending: pause, resumeSending: resume }));
vi.mock("@/lib/audit", () => ({ recordAudit: audit }));

import { POST } from "@/app/api/automation/pause/route";
import { NextRequest } from "next/server";

const post = (body: unknown) =>
  POST(new NextRequest("https://followupbase.io/api/automation/pause", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  sessionCtx.mockResolvedValue({ userId: "u", businessId: "biz" });
  admin.mockResolvedValue(false);
  billing.mockResolvedValue(true);
  pause.mockResolvedValue({ ok: true });
  resume.mockResolvedValue({ ok: true });
});

describe("pause and resume", () => {
  it("lets a teammate pause, with no billing check, and records it", async () => {
    billing.mockResolvedValue(false);
    const res = await post({ paused: true });
    expect(res.status).toBe(200);
    expect(pause).toHaveBeenCalledWith("biz");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ businessId: "biz" }), "sending.paused");
  });

  it("refuses a teammate's resume", async () => {
    const res = await post({ paused: false });
    expect(res.status).toBe(403);
    expect(resume).not.toHaveBeenCalled();
  });

  it("lets an admin resume on an active account", async () => {
    admin.mockResolvedValue(true);
    const res = await post({ paused: false });
    expect(res.status).toBe(200);
    expect(resume).toHaveBeenCalledWith("biz");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ businessId: "biz" }), "sending.resumed");
  });

  it("won't resume a lapsed account", async () => {
    admin.mockResolvedValue(true);
    billing.mockResolvedValue(false);
    const res = await post({ paused: false });
    expect(res.status).toBe(402);
    expect(resume).not.toHaveBeenCalled();
  });

  it("passes on the refusal when there is nothing to pause", async () => {
    pause.mockResolvedValue({ ok: false, status: 409, message: "Nothing sends by itself right now, so there's nothing to pause." });
    const res = await post({ paused: true });
    expect(res.status).toBe(409);
    expect(audit).not.toHaveBeenCalled();
  });

  it("needs a signed-in person", async () => {
    sessionCtx.mockResolvedValue(null);
    expect((await post({ paused: true })).status).toBe(401);
  });
});
