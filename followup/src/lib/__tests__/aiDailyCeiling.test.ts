/** Security review H2 (2026-10-05): a looping conversation can't run the AI without end. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, updateMany, tooManyRecentActions, scoreLead } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  tooManyRecentActions: vi.fn(),
  scoreLead: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique, updateMany, update: vi.fn() } } }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: (...a: unknown[]) => tooManyRecentActions(...a) }));
vi.mock("@/lib/billing", () => ({ checkAiEligibility: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/integrations/openai", () => ({ scoreLead: (...a: unknown[]) => scoreLead(...a), generateFollowUpMessage: vi.fn() }));

import { scoreAndDraftForLead, AI_RUNS_PER_LEAD_PER_DAY, AI_RUNS_PER_BUSINESS_PER_DAY } from "@/lib/scoring";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test";
  findUnique.mockResolvedValue({ id: "l1", businessId: "b1", name: "Sam", conversations: [], business: { tier: "pro", name: "B" } });
});

describe("scoreAndDraftForLead daily ceilings", () => {
  it("stops before any AI call when one customer's daily ceiling is hit, and tells the owner", async () => {
    tooManyRecentActions.mockResolvedValueOnce(true);
    expect(await scoreAndDraftForLead("l1")).toBe(false);
    expect(tooManyRecentActions).toHaveBeenCalledWith("b1", "ai.run:l1", AI_RUNS_PER_LEAD_PER_DAY);
    expect(scoreLead).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { aiPausedReason: expect.stringContaining("paused") } }));
  });

  it("stops when the business's daily ceiling is hit", async () => {
    tooManyRecentActions.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await scoreAndDraftForLead("l1")).toBe(false);
    expect(tooManyRecentActions).toHaveBeenLastCalledWith("b1", "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY);
    expect(scoreLead).not.toHaveBeenCalled();
  });

  it("keeps the ceilings far above a real conversation", () => {
    expect(AI_RUNS_PER_LEAD_PER_DAY.max).toBeGreaterThanOrEqual(30);
    expect(AI_RUNS_PER_BUSINESS_PER_DAY.max).toBeGreaterThanOrEqual(500);
  });
});
