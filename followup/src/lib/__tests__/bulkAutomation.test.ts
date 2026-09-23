/**
 * Setting the automation mode on every lead at once.
 *
 * Founder, 2026-09-23: "if they have 60 or 600 leads, they can't do auto
 * for all the leads, right? We have to make something that, with just
 * one click, will be auto for all of them […] or we can do it
 * source-wise, like on WhatsApp or Gmail."
 *
 * Source rules already answer the second half — they decide what a NEW
 * lead starts on. What they deliberately do not do is touch a lead that
 * already exists (`applySourceRouting` runs once at creation, "never on
 * a resync/update of an existing one"). So a business with 600 leads
 * gets a rule that fixes tomorrow and changes nothing today, and nobody
 * opens 600 lead pages. This is the catch-up.
 *
 * ## What these tests are really about
 *
 * A bulk action is the place where a guard stops being a per-row
 * inconvenience and becomes the whole blast radius. `POST
 * /api/leads/[id]/automation` refuses three things one lead at a time,
 * and a bulk path that quietly skipped them would be a way AROUND them:
 *
 *   - a lead enrolled in a workflow must not be raised above OFF, or the
 *     workflow and the silence rule both message the same person;
 *   - AUTONOMOUS needs Plus or Pro;
 *   - everything is scoped to one business.
 *
 * The enrolled case has a bulk-specific answer: skip and count, never
 * fail the batch. One enrolled lead among 600 blocking the other 599
 * would make the feature useless, and a silent skip would make it
 * dishonest — so the count comes back and the caller says it out loud.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { updateMany, count } = vi.hoisted(() => ({ updateMany: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { updateMany, count } } }));

import { setAutomationTierInBulk } from "@/lib/bulkAutomation";

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 0 });
  count.mockResolvedValue(0);
});

describe("raising leads to a sending mode", () => {
  it("skips leads enrolled in a workflow instead of failing the batch", async () => {
    count.mockResolvedValue(3);
    updateMany.mockResolvedValue({ count: 597 });

    const result = await setAutomationTierInBulk({ businessId: "biz_1", tier: "ASSISTED" });

    expect(result).toEqual({ updated: 597, skippedInWorkflow: 3 });
    // The update itself must exclude them — counting them and then
    // updating them anyway would be the worst of both.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sequenceId: null }) })
    );
  });

  it("never reaches outside the business", async () => {
    // A missing scope on a single-lead update is one wrong row. Here it
    // is somebody else's entire lead list.
    await setAutomationTierInBulk({ businessId: "biz_1", tier: "ASSISTED" });
    for (const call of [...updateMany.mock.calls, ...count.mock.calls]) {
      expect(call[0].where.businessId, "a bulk query ran without a business scope").toBe("biz_1");
    }
  });

  it("narrows to one source when asked", async () => {
    await setAutomationTierInBulk({ businessId: "biz_1", tier: "ASSISTED", source: "Gmail" });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ source: "Gmail" }) })
    );
  });

  it("touches every source when none is given", async () => {
    await setAutomationTierInBulk({ businessId: "biz_1", tier: "ASSISTED", source: null });
    expect(updateMany.mock.calls[0][0].where).not.toHaveProperty("source");
  });

  it("counts only leads that actually changed", async () => {
    // "Updated 600" on a business where 600 were already on that mode
    // reads as work done. The exclusion keeps the number honest.
    await setAutomationTierInBulk({ businessId: "biz_1", tier: "ASSISTED" });
    expect(updateMany.mock.calls[0][0].where.automationTier).toEqual({ not: "ASSISTED" });
  });
});

describe("lowering leads to OFF", () => {
  it("applies to enrolled leads too, and skips nothing", async () => {
    // Stopping must never be harder than starting. The double-send risk
    // that justifies skipping enrolled leads exists only when RAISING
    // one; turning automation down cannot cause a send.
    updateMany.mockResolvedValue({ count: 600 });

    const result = await setAutomationTierInBulk({ businessId: "biz_1", tier: "OFF" });

    expect(result).toEqual({ updated: 600, skippedInWorkflow: 0 });
    expect(count, "OFF should not need to count enrolled leads at all").not.toHaveBeenCalled();
    expect(updateMany.mock.calls[0][0].where).not.toHaveProperty("sequenceId");
  });
});
