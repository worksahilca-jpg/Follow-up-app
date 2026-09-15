/**
 * The missed-call text-back is the one outbound message in this product
 * that does NOT go through sendFollowUpToLead() — src/app/api/twilio/
 * voice/[secret] calls sendSms() directly — so it is the one path that
 * never inherited that funnel's TCPA/CTIA opt-out hard stop.
 *
 * The scenario these tests pin down is a real one and it is illegal, not
 * merely rude: a lead replies STOP to a follow-up text (Lead.optedOutAt
 * is set by the SMS webhook), then a week later phones the business and
 * hangs up before anyone picks up. Every other send path refuses them.
 * This one texted them anyway.
 *
 * The guard lives inside claimMissedCallTextBack()'s conditional
 * updateMany rather than in the route, so consent is checked atomically
 * with the cooldown claim — a second concurrent call can't slip a text
 * out between a separate read and the claim.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { updateMany } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

import { claimMissedCallTextBack } from "@/lib/twilio";

beforeEach(() => {
  updateMany.mockReset();
});

describe("claimMissedCallTextBack", () => {
  it("refuses to claim a text-back for a lead who replied STOP", async () => {
    // The opt-out is expressed as part of the WHERE, so an opted-out lead
    // simply matches no row and the route never reaches sendSms().
    updateMany.mockImplementation(async (args: { where: Record<string, unknown> }) =>
      args.where.optedOutAt === null ? { count: 0 } : { count: 1 }
    );

    const claimed = await claimMissedCallTextBack("lead-opted-out", 30);

    expect(claimed).toBe(false);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "lead-opted-out", optedOutAt: null }) })
    );
  });

  it("still claims a text-back for a lead who has not opted out", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(claimMissedCallTextBack("lead-1", 30)).resolves.toBe(true);
  });

  it("keeps the repeat-call cooldown alongside the consent check", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(claimMissedCallTextBack("lead-1", 30)).resolves.toBe(false);

    const where = updateMany.mock.calls[0][0].where as {
      OR: [{ lastMissedCallTextAt: null }, { lastMissedCallTextAt: { lt: Date } }];
    };
    expect(where.OR[0]).toEqual({ lastMissedCallTextAt: null });
    expect(where.OR[1].lastMissedCallTextAt.lt).toBeInstanceOf(Date);
  });
});
