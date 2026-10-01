/**
 * The on-demand AI features count towards the plan's monthly allowance
 * (founder, 2026-09-30). Rewrite, "Catching up" and voicemail transcription
 * checked billing only, so a Free business past its monthly leads could
 * keep using them on the platform's OpenAI key.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    business: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { leadAiRefusal } from "@/lib/billing";
import { FREE_TIER_LEAD_CAP } from "@/lib/pricing";

const lead = (tier: string | null, source = "Gmail") => ({ id: "l1", createdAt: new Date("2026-09-15T12:00:00Z"), source, business: { tier } });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.business.findUnique.mockResolvedValue({ subscriptionStatus: null });
});

describe("leadAiRefusal", () => {
  it("lets a Free lead inside the monthly allowance through", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(lead("free"));
    prismaMock.lead.count.mockResolvedValue(0);
    expect(await leadAiRefusal("biz1", "l1")).toBeNull();
  });

  it("refuses a Free lead past the monthly allowance, and says why", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(lead("free"));
    prismaMock.lead.count.mockResolvedValue(FREE_TIER_LEAD_CAP + 5);
    const refusal = await leadAiRefusal("biz1", "l1");
    expect(refusal?.ok).toBe(false);
    expect(refusal?.ownerMessage).toContain(`${FREE_TIER_LEAD_CAP} leads a month`);
  });

  it("refuses a lead that isn't this business's", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    expect(await leadAiRefusal("biz1", "someone-elses")).not.toBeNull();
    expect(prismaMock.lead.findFirst.mock.calls[0][0].where).toEqual({ id: "someone-elses", businessId: "biz1" });
  });

  it("lets a paying business through", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ subscriptionStatus: "active" });
    prismaMock.lead.findFirst.mockResolvedValue(lead("pro"));
    prismaMock.lead.count.mockResolvedValue(12);
    expect(await leadAiRefusal("biz1", "l1")).toBeNull();
  });
});
