/**
 * "Since you started" (A-307): the owner's own numbers at the top of Today, from their own records, never the
 * practice customer, and nothing at all until there is something to show.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: { count: vi.fn() },
    booking: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { sinceStartedFor, sinceStartedOrNull } from "@/lib/sinceStarted";

describe("when the line shows", () => {
  it("only once one of the three is above 0", () => {
    expect(sinceStartedOrNull({ answered: 0, booked: 0, won: 0 })).toBeNull();
    expect(sinceStartedOrNull({ answered: 0, booked: 1, won: 0 })).toEqual({ answered: 0, booked: 1, won: 0 });
  });
});

describe("the counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.lead.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prismaMock.booking.count.mockResolvedValue(1);
  });

  it("customers answered, bookings not cancelled, customers won; never the practice customer", async () => {
    expect(await sinceStartedFor("biz1")).toEqual({ answered: 2, booked: 1, won: 1 });
    const [answered, won] = prismaMock.lead.count.mock.calls.map((c) => c[0].where);
    expect(answered.businessId).toBe("biz1");
    expect(answered.OR).toEqual([{ source: null }, { source: { not: "Test lead" } }]);
    expect(answered.conversations).toEqual({ some: { messages: { some: { direction: "outbound" } } } });
    expect(won.stage).toBe("WON");
    expect(won.OR).toEqual([{ source: null }, { source: { not: "Test lead" } }]);
    expect(prismaMock.booking.count.mock.calls[0][0].where).toEqual({ businessId: "biz1", status: "confirmed" });
  });

  it("never breaks Today", async () => {
    prismaMock.booking.count.mockRejectedValueOnce(new Error("pool timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sinceStartedFor("biz1")).toBeNull();
  });
});
