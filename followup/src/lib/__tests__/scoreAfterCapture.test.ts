/**
 * A customer's message that is already stored is never lost to an AI outage (src/lib/scoreAfterCapture.ts): the
 * scoring after capture never throws (Oct 30 2026, no credit left: 11 Meta deliveries were marked failed, and the
 * messages after the first in each were never read), and an hourly catch-up scores what was missed, on every channel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { scoreAndDraftForLead, groupBy, findMany } = vi.hoisted(() => ({
  scoreAndDraftForLead: vi.fn(),
  groupBy: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { groupBy, findMany } } }));

import { scoreAndDraftAfterCapture, scoreUnscoredLeadsForAllBusinesses } from "@/lib/scoreAfterCapture";

beforeEach(() => {
  scoreAndDraftForLead.mockReset();
  groupBy.mockReset();
  findMany.mockReset();
});

describe("scoring a stored message", () => {
  it("passes the result through when it works", async () => {
    scoreAndDraftForLead.mockResolvedValue(true);
    expect(await scoreAndDraftAfterCapture("l1")).toBe(true);
  });

  it("never throws when the AI refuses (no credit), so the rest of the delivery still runs", async () => {
    scoreAndDraftForLead.mockRejectedValue(Object.assign(new Error("429 You have no credits remaining"), { status: 429 }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await scoreAndDraftAfterCapture("l1")).toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("the hourly catch-up", () => {
  it("scores only unscored leads with messages from the last week, a few per business, and counts what worked", async () => {
    groupBy.mockResolvedValue([{ businessId: "b1" }, { businessId: "b2" }]);
    findMany.mockImplementation(async ({ where }: { where: { businessId: string } }) =>
      where.businessId === "b1" ? [{ id: "a" }, { id: "b" }] : [{ id: "c" }]
    );
    scoreAndDraftForLead.mockImplementation(async (id: string) => {
      if (id === "b") throw new Error("429 You have no credits remaining");
      return true;
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await scoreUnscoredLeadsForAllBusinesses(5);
    error.mockRestore();

    expect(out).toEqual({ businesses: 2, scored: 2 });
    const where = groupBy.mock.calls[0][0].where;
    expect(where.scoreReason).toBeNull();
    expect(where.conversations).toEqual({ some: { messages: { some: {} } } });
    expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(findMany.mock.calls[0][0]).toMatchObject({ take: 5, orderBy: { createdAt: "asc" } });
  });
});
