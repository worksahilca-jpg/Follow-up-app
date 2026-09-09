/**
 * task (fourth-pass audit, finding #3): CSV import pre-checked and
 * reported duplicate EMAILs but had no equivalent check for phone
 * numbers, even though Lead also has a unique (businessId, phone)
 * constraint. A phone collision used to be silently dropped by
 * `skipDuplicates: true` at the DB layer with no entry in `created` or
 * `skipped` — indistinguishable from "this file had 0 usable rows."
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany, createManyAndReturn } = vi.hoisted(() => ({
  findMany: vi.fn(),
  createManyAndReturn: vi.fn(async () => []),
}));

vi.mock("@/lib/db", () => ({ prisma: { lead: { findMany, createManyAndReturn } } }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "user1" })) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), BILLING_LOCKED_MESSAGE: "locked" }));
vi.mock("@/lib/assignment", () => ({ makeBatchAssigner: vi.fn(async () => () => null) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => {}) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

function csvRequest(csv: string): NextRequest {
  const form = new FormData();
  form.set("file", new File([csv], "leads.csv", { type: "text/csv" }));
  return new NextRequest("https://followupbase.io/api/leads/import", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  // findMany is called twice — once for existing emails, once for existing phones.
  findMany.mockImplementation(async ({ where }: { where: { email?: unknown; phone?: unknown } }) =>
    "email" in where ? [] : []
  );
  createManyAndReturn.mockResolvedValue([]);
});

describe("POST /api/leads/import — phone duplicate handling", () => {
  it("reports (does not silently drop) a row whose phone collides with an existing lead", async () => {
    findMany.mockImplementation(async ({ where }: { where: { email?: unknown; phone?: unknown } }) =>
      "phone" in where ? [{ phone: "+15551234567" }] : []
    );
    const { POST } = await import("@/app/api/leads/import/route");
    const res = await POST(csvRequest("Name,Phone\nJamie Rivera,+15551234567\n"));
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.skippedSamples[0]).toMatch(/duplicate phone/i);
    expect(createManyAndReturn).not.toHaveBeenCalled(); // nothing left to insert
  });

  it("reports (does not silently drop) two rows in the same file sharing a phone number", async () => {
    const { POST } = await import("@/app/api/leads/import/route");
    const res = await POST(csvRequest("Name,Phone\nJamie Rivera,+15551234567\nSam Rivera,+15551234567\n"));
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(body.skippedSamples[0]).toMatch(/duplicate phone/i);
    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ name: "Jamie Rivera" })] })
    );
  });

  it("still imports a row with a phone number that collides with nothing", async () => {
    const { POST } = await import("@/app/api/leads/import/route");
    const res = await POST(csvRequest("Name,Phone\nJamie Rivera,+15551234567\n"));
    const body = await res.json();
    expect(body.skipped).toBe(0);
    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ phone: "+15551234567" })] })
    );
  });
});
