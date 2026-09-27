/**
 * GET /api/crm/config (src/app/api/crm/config/route.ts), audit 2026-09-27:
 * any team member's Settings load read the whole CrmConnection row, so
 * src/lib/db.ts decrypted the CRM API key just to answer "connected?".
 * The key is now counted, never selected.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = { userId: "u1", businessId: "b1", email: "rep@example.com", authTime: Date.now() };
const { crmFindUnique, crmCount } = vi.hoisted(() => ({ crmFindUnique: vi.fn(), crmCount: vi.fn() }));

vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx), requireAdmin: vi.fn(async () => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { crmConnection: { findUnique: crmFindUnique, count: crmCount } } }));

import { GET } from "@/app/api/crm/config/route";

beforeEach(() => {
  vi.clearAllMocks();
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
