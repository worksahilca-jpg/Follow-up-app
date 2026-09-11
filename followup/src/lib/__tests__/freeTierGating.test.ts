/**
 * task: Free tier's two product-level restrictions
 * (research/market/2026-09-11-tier-pricing-recommendation.md §2.2) —
 * which Lead.source values count as an "email or web widget" capture, and
 * whether a given lead is within the first 20 leads its business captured
 * in that lead's own calendar month.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { count } = vi.hoisted(() => ({ count: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { count } } }));

import { isChannelAvailableOnFreeTier, isWithinFreeTierLeadCap, FREE_TIER_LEAD_CAP } from "@/lib/billing";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isChannelAvailableOnFreeTier", () => {
  it.each(["Gmail", "Gmail (spam)", "Outlook", "Website form", "Manual entry", "CSV import", "Test lead"])(
    "allows %s",
    (source) => {
      expect(isChannelAvailableOnFreeTier(source)).toBe(true);
    }
  );

  it.each(["SMS", "Phone call", "WhatsApp", "Instagram", "Facebook Messenger", "Facebook Lead Ad", "Webhook", "Follow Up Boss", "HubSpot"])(
    "disallows %s",
    (source) => {
      expect(isChannelAvailableOnFreeTier(source)).toBe(false);
    }
  );

  it("disallows null/undefined/empty source", () => {
    expect(isChannelAvailableOnFreeTier(null)).toBe(false);
    expect(isChannelAvailableOnFreeTier(undefined)).toBe(false);
    expect(isChannelAvailableOnFreeTier("")).toBe(false);
  });
});

describe("isWithinFreeTierLeadCap", () => {
  it(`is within cap when this lead's rank is exactly ${FREE_TIER_LEAD_CAP}`, async () => {
    count.mockResolvedValue(FREE_TIER_LEAD_CAP);
    const within = await isWithinFreeTierLeadCap("biz1", { id: "l20", createdAt: new Date("2026-09-15T00:00:00Z") });
    expect(within).toBe(true);
  });

  it(`is over cap once this lead's rank passes ${FREE_TIER_LEAD_CAP}`, async () => {
    count.mockResolvedValue(FREE_TIER_LEAD_CAP + 1);
    const within = await isWithinFreeTierLeadCap("biz1", { id: "l21", createdAt: new Date("2026-09-15T00:00:00Z") });
    expect(within).toBe(false);
  });

  it("counts only leads from this lead's own calendar month (UTC), not all-time", async () => {
    const leadCreatedAt = new Date("2026-09-05T12:00:00Z");
    await isWithinFreeTierLeadCap("biz1", { id: "l5", createdAt: leadCreatedAt });
    const where = count.mock.calls[0][0].where;
    expect(where.businessId).toBe("biz1");
    expect(where.createdAt.gte).toEqual(new Date(Date.UTC(2026, 8, 1))); // Sept 1, UTC — month is 0-indexed
  });

  it("breaks createdAt ties by id, so two leads at the exact same millisecond still get a deterministic rank", async () => {
    const sameInstant = new Date("2026-09-05T12:00:00.000Z");
    await isWithinFreeTierLeadCap("biz1", { id: "lead-b", createdAt: sameInstant });
    const where = count.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ createdAt: { lt: sameInstant } }, { createdAt: sameInstant, id: { lte: "lead-b" } }]);
  });
});
