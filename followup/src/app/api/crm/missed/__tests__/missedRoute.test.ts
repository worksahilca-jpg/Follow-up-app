/**
 * /api/crm/missed ("Missed by your CRM", A-315): admins only, rate-limited, every action the signed-in business's
 * own, and the audit keeps counts, never names.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn<(ctx: unknown, action: string, details: { meta?: unknown }) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { addMissedToCrm, setAutoAdd } = vi.hoisted(() => ({ addMissedToCrm: vi.fn(), setAutoAdd: vi.fn() }));
vi.mock("@/lib/missedByCrmData", () => ({ addMissedToCrm, setAutoAdd }));

import { POST } from "../route";

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/crm/missed", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  addMissedToCrm.mockResolvedValue({ added: 2, failed: [] });
  setAutoAdd.mockResolvedValue(true);
});

describe("who can", () => {
  it("needs a signed-in admin", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await POST(post({ action: "add_all" }))).status).toBe(401);
    getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
    requireAdmin.mockResolvedValue(false);
    expect((await POST(post({ action: "add_all" }))).status).toBe(403);
    expect(addMissedToCrm).not.toHaveBeenCalled();
  });

  it("stops a stuck button or a script", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    expect((await POST(post({ action: "add_all" }))).status).toBe(429);
    expect(tooManyRecentActions).toHaveBeenCalledWith("biz1", "crm.missed", { windowMinutes: 60, max: 60 });
  });

  it("refuses anything that isn't one of the three actions, or too many at once", async () => {
    expect((await POST(post({ action: "delete" }))).status).toBe(400);
    expect((await POST(post({ action: "add", ids: [] }))).status).toBe(400);
    expect((await POST(post({ action: "add", ids: Array.from({ length: 26 }, (_, i) => `l${i}`) }))).status).toBe(400);
    expect(addMissedToCrm).not.toHaveBeenCalled();
  });
});

describe("adding", () => {
  it("adds everyone missing for the signed-in business, and audits counts only", async () => {
    const res = await POST(post({ action: "add_all" }));
    expect(await res.json()).toEqual({ success: true, added: 2, failed: [] });
    expect(addMissedToCrm).toHaveBeenCalledWith("biz1", "all");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "integration.crm.add_missed", { meta: { added: 2, failed: 0, all: true } });
  });

  it("adds the ones tapped", async () => {
    addMissedToCrm.mockResolvedValue({ added: 0, failed: [{ id: "l1", message: "Follow Up Boss didn't take them. Try again in a minute." }] });
    const body = await (await POST(post({ action: "add", ids: ["l1"] }))).json();
    expect(addMissedToCrm).toHaveBeenCalledWith("biz1", ["l1"]);
    expect(body.failed).toEqual([{ id: "l1", message: "Follow Up Boss didn't take them. Try again in a minute." }]);
  });

  it("says why nothing could be added", async () => {
    addMissedToCrm.mockResolvedValue({ error: "No CRM is connected." });
    const res = await POST(post({ action: "add_all" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("No CRM is connected.");
  });
});

describe("by themselves", () => {
  it("turns it on or off", async () => {
    expect(await (await POST(post({ action: "auto", on: false }))).json()).toEqual({ success: true, autoAdd: false });
    expect(setAutoAdd).toHaveBeenCalledWith("biz1", false);
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "integration.crm.auto_add", { meta: { on: false } });
  });

  it("needs a CRM", async () => {
    setAutoAdd.mockResolvedValue(false);
    expect((await POST(post({ action: "auto", on: true }))).status).toBe(400);
  });
});
