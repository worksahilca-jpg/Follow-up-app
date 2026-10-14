/**
 * GET /api/crm/config (src/app/api/crm/config/route.ts), audit 2026-09-27:
 * any team member's Settings load read the whole CrmConnection row, so
 * src/lib/db.ts decrypted the CRM API key just to answer "connected?".
 * The key is now counted, never selected.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = { userId: "u1", businessId: "b1", email: "rep@example.com", authTime: Date.now() };
const { crmFindUnique, crmCount, crmUpdateMany, requireAdmin, recordAudit, loadCrmRecord } = vi.hoisted(() => ({
  crmFindUnique: vi.fn(),
  crmCount: vi.fn(),
  crmUpdateMany: vi.fn(),
  requireAdmin: vi.fn(async () => false),
  recordAudit: vi.fn(),
  loadCrmRecord: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx), requireAdmin }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/db", () => ({ prisma: { crmConnection: { findUnique: crmFindUnique, count: crmCount, updateMany: crmUpdateMany } } }));
vi.mock("@/lib/crm/record", () => ({ loadCrmRecord }));

import { GET, PATCH } from "@/app/api/crm/config/route";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(false);
  crmUpdateMany.mockResolvedValue({ count: 1 });
  loadCrmRecord.mockResolvedValue({ broughtIn: 3, weekCount: 1, items: [] });
  crmFindUnique.mockResolvedValue({ provider: "hubspot", accountLabel: "Acme", lastSyncedAt: null, lastSyncError: null });
});

describe("GET /api/crm/config", () => {
  it("selects only display fields, never the API key", async () => {
    crmCount.mockResolvedValue(1);
    await GET();
    const args = crmFindUnique.mock.calls[0][0] as { where: unknown; select?: Record<string, unknown> };
    expect(args.where).toEqual({ businessId: "b1" });
    expect(args.select).toBeDefined();
    expect(args.select).not.toHaveProperty("apiKey");
  });

  it("says connected from a business-scoped count, and returns no key", async () => {
    crmCount.mockResolvedValue(1);
    const body = await (await GET()).json();
    expect(body.connected).toBe(true);
    expect(body.provider).toBe("hubspot");
    expect(JSON.stringify(body)).not.toMatch(/apiKey/);
    expect((crmCount.mock.calls[0][0] as { where: { businessId: string } }).where.businessId).toBe("b1");
  });

  it("says not connected when no key is saved", async () => {
    crmCount.mockResolvedValue(0);
    crmFindUnique.mockResolvedValue(null);
    const body = await (await GET()).json();
    expect(body.connected).toBe(false);
    expect(body.provider).toBeNull();
  });
});

// A-252: what FollowUp wrote in the CRM carries customers' names and words, so only admins get it.
describe("the record of writes", () => {
  it("goes to an admin of a connected business", async () => {
    requireAdmin.mockResolvedValue(true);
    crmCount.mockResolvedValue(1);
    const body = await (await GET()).json();
    expect(loadCrmRecord).toHaveBeenCalledWith("b1", "hubspot");
    expect(body.record).toEqual({ broughtIn: 3, weekCount: 1, items: [] });
    expect(body.isAdmin).toBe(true);
  });

  it("never goes to a teammate", async () => {
    crmCount.mockResolvedValue(1);
    const body = await (await GET()).json();
    expect(loadCrmRecord).not.toHaveBeenCalled();
    expect(body.record).toBeNull();
  });
});

describe("PATCH /api/crm/config: pause writing there", () => {
  const req = (body: unknown) => new Request("https://followupbase.io/api/crm/config", { method: "PATCH", body: JSON.stringify(body) }) as never;

  it("refuses a teammate", async () => {
    const res = await PATCH(req({ writesPaused: true }));
    expect(res.status).toBe(403);
    expect(crmUpdateMany).not.toHaveBeenCalled();
  });

  it("pauses and resumes for an admin, on record", async () => {
    requireAdmin.mockResolvedValue(true);
    await PATCH(req({ writesPaused: true }));
    expect(crmUpdateMany.mock.calls[0][0].where).toEqual({ businessId: "b1" });
    expect(crmUpdateMany.mock.calls[0][0].data.writesPausedAt).toBeInstanceOf(Date);
    expect(recordAudit).toHaveBeenCalledWith(ctx, "integration.crm.writes_paused");
    await PATCH(req({ writesPaused: false }));
    expect(crmUpdateMany.mock.calls[1][0].data).toEqual({ writesPausedAt: null });
    expect(recordAudit).toHaveBeenCalledWith(ctx, "integration.crm.writes_resumed");
  });

  it("says so when no CRM is connected", async () => {
    requireAdmin.mockResolvedValue(true);
    crmUpdateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(req({ writesPaused: true }));
    expect(res.status).toBe(400);
  });
});
