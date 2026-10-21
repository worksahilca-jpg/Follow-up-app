/**
 * "Your last 90 days" (A-306): what Today says once after the first inbox read. Every number from the owner's own
 * records, and words that never claim more than they show.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    business: { findUnique: vi.fn() },
    integration: { findFirst: vi.fn() },
    lead: { findMany: vi.fn() },
    filteredEmail: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { inboxSummaryWords, summarizeInbox } from "@/lib/inboxSummary";
import { inboxSummaryFor } from "@/lib/inboxSummaryData";

const now = new Date("2026-10-21T15:00:00Z");
const D = 86_400_000;
const ago = (days: number) => new Date(now.getTime() - days * D);

describe("the numbers", () => {
  it("counts who wrote, and of them who is on Today's waiting list and how long the oldest has waited", () => {
    const waiting = [
      { leadId: "a", lastWroteAt: ago(30).toISOString() },
      { leadId: "b", lastWroteAt: ago(2) },
      // On Today but didn't write in the window (an older customer, the practice one): not part of this card.
      { leadId: "z", lastWroteAt: ago(200).toISOString() },
      { leadId: "c", lastWroteAt: null },
    ];
    expect(summarizeInbox(["a", "b", "c", "d", "e"], waiting, 12, now)).toEqual({ wrote: 5, missed: 3, oldestDays: 30, setAside: 12 });
  });

  it("matches Today exactly: someone not on the waiting list (won, later, still being checked) isn't counted", () => {
    expect(summarizeInbox(["a", "b"], [], 0, now)).toEqual({ wrote: 2, missed: 0, oldestDays: 0, setAside: 0 });
  });
});

describe("the words", () => {
  it("as drawn", () => {
    expect(inboxSummaryWords({ wrote: 23, missed: 17, oldestDays: 30, setAside: 184 })).toEqual({
      heading: "23 people wrote to you. 17 didn't get a reply.",
      line: "Each one has a reply ready below. The oldest has waited 30 days.",
      setAside: "184 newsletters, receipts and other emails were set aside.",
    });
  });

  it("nobody waiting: says only what Today shows, never that the owner answered everyone", () => {
    const w = inboxSummaryWords({ wrote: 23, missed: 0, oldestDays: 0, setAside: 0 });
    expect(w.heading).toBe("23 people wrote to you. Nobody is waiting for a reply.");
    expect(w.line).toBe("From now on, FollowUp writes the reply the moment they write.");
    expect(w.setAside).toBeNull();
  });

  it("one person, under a day; one of several, one day", () => {
    expect(inboxSummaryWords({ wrote: 1, missed: 1, oldestDays: 0, setAside: 1 })).toEqual({
      heading: "1 person wrote to you. They didn't get a reply.",
      line: "Their reply is ready below.",
      setAside: "1 email that wasn't from a customer was set aside.",
    });
    expect(inboxSummaryWords({ wrote: 5, missed: 1, oldestDays: 1, setAside: 0 })).toEqual({
      heading: "5 people wrote to you. 1 didn't get a reply.",
      line: "Their reply is ready below. They have waited 1 day.",
      setAside: null,
    });
  });
});

describe("when Today shows it", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.business.findUnique.mockResolvedValue({ inboxSummarySeenAt: null });
    prismaMock.integration.findFirst.mockResolvedValue({ provider: "gmail" });
    prismaMock.lead.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    prismaMock.filteredEmail.count.mockResolvedValue(7);
  });

  it("after the first full read, with Today's waiting list for who didn't get a reply", async () => {
    const r = await inboxSummaryFor("biz1", [{ leadId: "a", lastWroteAt: ago(9).toISOString() }], now);
    expect(r).toEqual({ provider: "gmail", summary: { wrote: 2, missed: 1, oldestDays: 9, setAside: 7 } });
    const where = prismaMock.integration.findFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { provider: "gmail", deepSyncedAt: { not: null } },
      { provider: "outlook", lastSyncedAt: { not: null } },
    ]);
    expect(where.connectedAt.gte.getTime()).toBe(now.getTime() - 14 * D);
    // The practice customer is never counted; a customer with no source is.
    expect(prismaMock.lead.findMany.mock.calls[0][0].where.OR).toEqual([{ source: null }, { source: { not: "Test lead" } }]);
  });

  it("never after Got it, before the first read, or when nobody wrote", async () => {
    prismaMock.business.findUnique.mockResolvedValueOnce({ inboxSummarySeenAt: ago(1) });
    expect(await inboxSummaryFor("biz1", [], now)).toBeNull();
    prismaMock.integration.findFirst.mockResolvedValueOnce(null);
    expect(await inboxSummaryFor("biz1", [], now)).toBeNull();
    prismaMock.lead.findMany.mockResolvedValueOnce([]);
    expect(await inboxSummaryFor("biz1", [], now)).toBeNull();
  });

  it("never breaks Today", async () => {
    prismaMock.lead.findMany.mockRejectedValueOnce(new Error("pool timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await inboxSummaryFor("biz1", [], now)).toBeNull();
  });
});
