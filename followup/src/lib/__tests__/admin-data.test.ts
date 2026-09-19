/**
 * getPlatformAdminData() (src/lib/admin-data.ts) — the cross-tenant query
 * layer behind /admin. Two things matter here:
 *  1. It re-checks requirePlatformAdmin() itself (defense in depth — see
 *     the same pattern in getAnalytics()) and runs NO queries at all if
 *     that check fails, rather than fetching first and discarding results.
 *  2. The aggregation logic itself: active-vs-dormant is a union across
 *     three independent signals (leads, Gmail/Outlook Integration rows,
 *     Instagram/Facebook fields on Business), and the revenue estimate
 *     only counts businesses whose subscription is actually active/trialing
 *     right now, not every business that merely has a stale paid tier.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any;

const { requirePlatformAdmin } = vi.hoisted(() => ({ requirePlatformAdmin: vi.fn(async () => {}) }));
vi.mock("@/lib/platformAdmin", () => ({ requirePlatformAdmin }));

const { businessCount, businessFindMany, businessGroupBy, leadCount, leadGroupBy, userFindMany } = vi.hoisted(() => ({
  businessCount: vi.fn(async (args?: Args) => {
    if (!args?.where) return 5; // totalBusinesses
    if (args.where.tier === "plus") return 2; // payingPlusCount — active/trialing only
    if (args.where.tier === "pro") return 1; // payingProCount — active/trialing only
    return 0;
  }),
  businessFindMany: vi.fn(async (args: Args) => {
    if (args?.orderBy) {
      // recentBusinesses
      return [
        { id: "biz1", name: "Acme", createdAt: new Date("2026-01-05"), tier: "pro" },
        { id: "biz2", name: "Beta", createdAt: new Date("2026-01-01"), tier: "free" },
      ];
    }
    if (args?.where?.OR) {
      // metaConnectedBusinesses — platform-wide Instagram/Facebook, for active/dormant
      return [{ id: "biz-meta-1" }];
    }
    if (args?.where?.id?.in) {
      // recentMetaBusinesses — scoped to the recent-signups page only
      return [{ id: "biz1", instagramUserId: "ig1", facebookPageId: null }];
    }
    // businessCreatedAts — select-only, no where/orderBy
    return [{ createdAt: new Date("2026-01-05") }, { createdAt: new Date("2026-01-01") }];
  }),
  businessGroupBy: vi.fn(async () => [
    { tier: "free", _count: { _all: 3 } },
    { tier: "pro", _count: { _all: 1 } },
  ]),
  leadCount: vi.fn(async () => 42),
  leadGroupBy: vi.fn(async (args: Args) => {
    if (args.by[0] === "source") {
      return [
        { source: "Gmail", _count: { _all: 10 } },
        { source: "Website form", _count: { _all: 5 } },
      ];
    }
    if (args.where) {
      // recentLeadCounts — scoped to the recent-signups page
      return [{ businessId: "biz1", _count: { _all: 7 } }];
    }
    // leadBusinessGroups — platform-wide, for active/dormant
    return [{ businessId: "biz1" }, { businessId: "biz3" }];
  }),
  userFindMany: vi.fn(async (args: Args) => {
    if (args.distinct) {
      // integratedUserRows — platform-wide Gmail/Outlook, for active/dormant
      return [{ businessId: "biz2" }];
    }
    // recentIntegratedUsers — scoped to the recent-signups page
    return [{ businessId: "biz1", integrations: [{ provider: "gmail" }] }];
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { count: businessCount, findMany: businessFindMany, groupBy: businessGroupBy },
    lead: { count: leadCount, groupBy: leadGroupBy },
    user: { findMany: userFindMany },
    // The beta list (2026-09-19): empty here; its own shape is trivial.
    accessRequest: { findMany: async () => [] },
  },
}));

import { getPlatformAdminData } from "@/lib/admin-data";

beforeEach(() => {
  requirePlatformAdmin.mockClear();
  requirePlatformAdmin.mockImplementation(async () => {});
  businessCount.mockClear();
});

describe("getPlatformAdminData", () => {
  it("re-checks platform-admin access itself and runs no queries if that fails", async () => {
    requirePlatformAdmin.mockImplementation(async () => {
      throw new Error("NEXT_NOT_FOUND");
    });
    await expect(getPlatformAdminData()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(businessCount).not.toHaveBeenCalled();
  });

  it("counts total businesses and total leads platform-wide with no businessId filter", async () => {
    const data = await getPlatformAdminData();
    expect(data.totalBusinesses).toBe(5);
    expect(data.totalLeadsPlatformWide).toBe(42);
  });

  it("unions leads, Gmail/Outlook integrations, and Instagram/Facebook into active-vs-dormant", async () => {
    const data = await getPlatformAdminData();
    // Active: biz1 + biz3 (have leads), biz2 (has a connected Integration),
    // biz-meta-1 (has Instagram/Facebook) — 4 distinct businesses.
    expect(data.activeBusinessCount).toBe(4);
    expect(data.dormantBusinessCount).toBe(1); // 5 total - 4 active
  });

  it("estimates revenue from active/trialing paid subscriptions only, at each tier's list price", async () => {
    const data = await getPlatformAdminData();
    // 2 Plus @ $39 + 1 Pro @ $79 — NOT the raw tier-count breakdown (which
    // includes canceled/past_due businesses with a stale paid tier).
    expect(data.estimatedMonthlyRevenueUsd).toBe(2 * 39 + 1 * 79);
  });

  it("reports tier breakdown for all three tiers, defaulting an absent one to zero", async () => {
    const data = await getPlatformAdminData();
    expect(data.tierBreakdown).toEqual([
      { tier: "free", label: "Free", count: 3 },
      { tier: "plus", label: "Plus", count: 0 },
      { tier: "pro", label: "Pro", count: 1 },
    ]);
  });

  it("sorts channel breakdown by volume, descending", async () => {
    const data = await getPlatformAdminData();
    expect(data.channelBreakdown).toEqual([
      { source: "Gmail", count: 10 },
      { source: "Website form", count: 5 },
    ]);
  });

  it("builds recent signups with per-business lead count and connected channels merged from both Integration and Business fields", async () => {
    const data = await getPlatformAdminData();
    expect(data.recentSignups).toHaveLength(2);
    const acme = data.recentSignups.find((b) => b.id === "biz1")!;
    expect(acme.leadCount).toBe(7);
    expect(acme.connectedChannels).toEqual(["gmail", "instagram"]);
    const beta = data.recentSignups.find((b) => b.id === "biz2")!;
    expect(beta.leadCount).toBe(0);
    expect(beta.connectedChannels).toEqual([]);
  });
});
