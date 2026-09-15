/**
 * Regression: POST /api/source-rules had no role gate, so a SALES-role user
 * could rewrite the whole business's per-source automation defaults.
 *
 * A source rule is not per-lead work: applySourceRouting() applies it to
 * EVERY future lead from that channel the moment it is created, including
 * setting automationTier to AUTONOMOUS — unreviewed sending — for all of
 * them, or enrolling them all in a workflow. That is the same class of
 * account-level decision requireAdmin() already guards on POST
 * /api/automation/settings, which sits in the same Settings screen.
 *
 * GET stays open: a rep should still be able to see what the rules are.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { sourceRuleUpsert, sourceRuleFindMany, sequenceFindMany, sequenceFindUnique } = vi.hoisted(() => ({
  sourceRuleUpsert: vi.fn(async () => ({})),
  sourceRuleFindMany: vi.fn(async () => []),
  sequenceFindMany: vi.fn(async () => []),
  sequenceFindUnique: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    sourceRule: { upsert: sourceRuleUpsert, findMany: sourceRuleFindMany },
    sequence: { findMany: sequenceFindMany, findUnique: sequenceFindUnique },
  },
}));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

const { requireActiveBilling } = vi.hoisted(() => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling, billingLockedMessage: async () => "locked" }));

import { GET, POST } from "@/app/api/source-rules/route";

function request(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "rep@acme.com" });
  requireAdmin.mockResolvedValue(true);
  requireActiveBilling.mockResolvedValue(true);
});

describe("POST /api/source-rules — role gate", () => {
  it("refuses a SALES user and writes nothing", async () => {
    requireAdmin.mockResolvedValue(false);

    const res = await POST(request({ source: "Website form", automationTierDefault: "AUTONOMOUS" }));

    expect(res.status).toBe(403);
    expect(sourceRuleUpsert).not.toHaveBeenCalled();
  });

  it("lets an admin save a rule", async () => {
    const res = await POST(request({ source: "Website form", automationTierDefault: "AUTONOMOUS" }));

    expect(res.status).toBe(200);
    expect(sourceRuleUpsert).toHaveBeenCalledTimes(1);
  });

  it("leaves GET readable by a SALES user", async () => {
    requireAdmin.mockResolvedValue(false);

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
