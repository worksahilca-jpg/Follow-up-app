/**
 * task: getFreeTierStatus() is what the Settings billing tab and the
 * per-lead automation toggle both read to show the same "where does this
 * business stand" numbers — the lead-count-this-month query only runs on
 * Free, since Plus/Pro have no cap to measure against.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, leadCount } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadCount: vi.fn(async () => 0),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique }, lead: { count: leadCount } } }));

const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));

import { getFreeTierStatus } from "@/lib/billing";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
});

describe("getFreeTierStatus", () => {
  it("returns null when there's no session", async () => {
    getSessionContext.mockResolvedValue(null);
    const status = await getFreeTierStatus();
    expect(status).toBeNull();
    expect(businessFindUnique).not.toHaveBeenCalled();
  });

  it("counts this month's leads for a Free-tier business", async () => {
    businessFindUnique.mockResolvedValue({ tier: "free", voiceAddonEnabled: false });
    leadCount.mockResolvedValue(14);
    const status = await getFreeTierStatus();
    expect(status).toEqual({ tier: "free", voiceAddonEnabled: false, leadsUsedThisMonth: 14, holdAllForApproval: false });
    expect(leadCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "biz1" }) }));
  });

  it("never queries the lead count for Plus/Pro — there's no cap to show progress against", async () => {
    businessFindUnique.mockResolvedValue({ tier: "pro", voiceAddonEnabled: true });
    const status = await getFreeTierStatus();
    expect(status).toEqual({ tier: "pro", voiceAddonEnabled: true, leadsUsedThisMonth: 0, holdAllForApproval: false });
    expect(leadCount).not.toHaveBeenCalled();
  });

  // A beta tester is exactly this shape — grantBetaPlan sets tier "pro"
  // and holdAllForApproval together. The lead page reads it from here to
  // stop offering "every reply sends automatically with no review" to an
  // account that reviews everything.
  it("carries holdAllForApproval through, so the UI can stop promising unreviewed sends", async () => {
    businessFindUnique.mockResolvedValue({ tier: "pro", voiceAddonEnabled: false, holdAllForApproval: true });
    const status = await getFreeTierStatus();
    expect(status?.holdAllForApproval).toBe(true);
  });

  it("defaults to free when the business row is somehow missing", async () => {
    businessFindUnique.mockResolvedValue(null);
    const status = await getFreeTierStatus();
    expect(status?.tier).toBe("free");
  });
});
