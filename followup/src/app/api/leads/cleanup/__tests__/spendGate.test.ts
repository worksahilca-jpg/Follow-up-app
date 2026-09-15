/**
 * Regression: POST /api/leads/cleanup spends one OpenAI call per Gmail lead
 * the business has, with no ceiling on how many that is, on the platform's
 * shared key.
 *
 * Two holes it had:
 *  - it gated on requireActiveBilling(), which admits Free tier by design,
 *    so a $0 account could classify its entire back catalogue — exactly the
 *    spend Free's 20-leads-a-month AI cap exists to prevent. Its twin,
 *    POST /api/reactivation/classify, already uses the paid-only gate for
 *    this precise reason.
 *  - it was the only AI-spending route in the app with no rate limit at
 *    all, so the whole backlog could be re-run as fast as it returned.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, leadFindMany, leadCount } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadFindMany: vi.fn(async () => []),
  // Backs the "remaining" figure the response now reports, since a run is
  // capped at CLEANUP_BATCH_SIZE leads rather than taking the whole backlog.
  leadCount: vi.fn(async () => 0),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    lead: { findMany: leadFindMany, count: leadCount },
  },
}));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

const { classifyAsProspect } = vi.hoisted(() => ({ classifyAsProspect: vi.fn() }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect }));

vi.mock("@/lib/leads-admin", () => ({ deleteLeadCascade: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { POST } from "@/app/api/leads/cleanup/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key-placeholder");
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  leadFindMany.mockResolvedValue([]);
});

describe("POST /api/leads/cleanup — spend gates", () => {
  it("refuses a Free-tier business with no paid subscription", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: null, tier: "free" });

    const res = await POST();

    expect(res.status).toBe(402);
    expect(leadFindMany).not.toHaveBeenCalled();
    expect(classifyAsProspect).not.toHaveBeenCalled();
  });

  it("lets a paying business through", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "plus" });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(leadFindMany).toHaveBeenCalled();
  });

  it("rate limits repeated runs before reading a single lead", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "plus" });
    tooManyRecentActions.mockResolvedValue(true);

    const res = await POST();

    expect(res.status).toBe(429);
    expect(tooManyRecentActions).toHaveBeenCalledWith("biz1", "leads.cleanup", { windowMinutes: 60, max: 2 });
    expect(leadFindMany).not.toHaveBeenCalled();
  });

  it("still refuses a non-admin", async () => {
    requireAdmin.mockResolvedValue(false);

    const res = await POST();

    expect(res.status).toBe(403);
  });
});
