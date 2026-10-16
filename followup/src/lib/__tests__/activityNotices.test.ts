import { describe, expect, it } from "vitest";
import { noticeType } from "@/lib/activity";
import { HOLD_SUMMARY_MARKER } from "@/lib/holdNotices";

// Activity took the bell's place (A-256): its lines are sorted by what they say.
describe("noticeType", () => {
  it("reads a stopped plan", () => {
    expect(noticeType(`Dana Park replied mid-sequence — "New buyer" stopped so you can take it from here.`)).toBe("sequence_paused");
  });

  it("reads a customer writing back and forth right now", () => {
    expect(noticeType("Dana Park is actively replying right now — a good moment to jump in.")).toBe("rapid_engagement");
  });

  it("makes everything else a notice for the owner", () => {
    expect(noticeType("FollowUp lost access to your Outlook inbox, so new emails there aren't being picked up.")).toBe("notice");
    expect(noticeType("Dana Park replied to a workflow message (3h later) — they're back. Jump in.")).toBe("notice");
  });
});

describe("what Activity leaves to Today", () => {
  // The feed skips notifications containing this phrase: each is a reply Today already shows.
  it("matches the bell's 'reply is waiting' lines", () => {
    for (const line of [
      "Dana Park messaged on Instagram — a reply is written and waiting for your approval.",
      "Dana — a follow-up is written and waiting for your approval.",
    ]) {
      expect(line).toContain(HOLD_SUMMARY_MARKER);
    }
  });
});

describe("whose notices Activity shows", () => {
  it("asks only for the viewer's own, in their business, without Today's duplicates", async () => {
    const { vi } = await import("vitest");
    const findMany = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/db", () => ({
      prisma: {
        followUp: { findMany: vi.fn().mockResolvedValue([]) },
        notification: { findMany },
        lead: { findMany: vi.fn().mockResolvedValue([]) },
        auditEvent: { findMany: vi.fn().mockResolvedValue([]) },
      },
    }));
    vi.resetModules();
    const { getActivityFeed } = await import("@/lib/activity");
    await getActivityFeed("biz-1", "user-7");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-7", user: { businessId: "biz-1" }, NOT: { message: { contains: HOLD_SUMMARY_MARKER } } },
      }),
    );
    vi.doUnmock("@/lib/db");
  });
});

describe("held replies on Activity (2026-10-16)", () => {
  const at = (iso: string) => new Date(iso);
  const hold = (id: string, targetId: string, reason: string, iso: string) => ({ id, targetId, meta: { reason }, createdAt: at(iso) });

  it("shows the same customer and reason once a day, the newest one", async () => {
    const { collapseRepeatHolds } = await import("@/lib/activity");
    const kept = collapseRepeatHolds([
      hold("d4", "daniel", "the call didn't happen, so this offers a new time with your booking link", "2026-10-15T12:18:00Z"),
      hold("d3", "daniel", "the call didn't happen, so this offers a new time with your booking link", "2026-10-15T12:13:00Z"),
      hold("d2", "daniel", "the call didn't happen, so this offers a new time with your booking link.", "2026-10-15T12:13:00Z"),
      hold("o1", "omar", "the customer asked about price — check the reply before it goes", "2026-10-15T12:05:00Z"),
      hold("d1", "daniel", "the call didn't happen, so this offers a new time with your booking link", "2026-10-15T12:00:00Z"),
      hold("d0", "daniel", "the call didn't happen, so this offers a new time with your booking link", "2026-10-13T09:00:00Z"),
    ]);
    expect(kept.map((h) => h.id)).toEqual(["d4", "o1", "d0"]);
  });

  it("keeps a different reason for the same customer", async () => {
    const { collapseRepeatHolds } = await import("@/lib/activity");
    const kept = collapseRepeatHolds([
      hold("a", "raj", "Why Raj: it's in Erin Mills and under $900k", "2026-10-15T10:00:00Z"),
      hold("b", "raj", "the customer asked about price — check the reply before it goes", "2026-10-15T09:00:00Z"),
    ]);
    expect(kept).toHaveLength(2);
  });

  it("says why in the reply card's words, never 'Because Why now:'", async () => {
    const { heldDetail } = await import("@/lib/activity");
    const { HOLD_ALL_AUTOMATION_REASON } = await import("@/lib/holdReasons");
    expect(heldDetail("Why now: it's October, when Raj said his lease ends", "Raj Malhotra")).toBe("Why now: it's October, when Raj said his lease ends.");
    expect(heldDetail("the call didn't happen, so this offers a new time with your booking link", "Daniel Okafor")).toBe(
      "The call didn't happen. This offers Daniel a new time from your free hours."
    );
    expect(heldDetail("FollowUp added your booking link because Omar said yes to meeting. Omar picks a time from your free hours", "Omar Haddad")).toBe(
      "FollowUp added your booking link because Omar said yes to meeting. Omar picks a time from your free hours."
    );
    expect(heldDetail("the customer asked about price — check the reply before it goes", "Karan Mehta")).toBe("Check the price before it goes.");
    expect(heldDetail(HOLD_ALL_AUTOMATION_REASON, "Lucía Fernández")).toBe("Every reply waits for your OK.");
    expect(heldDetail("", "Lucía Fernández")).toBeNull();
    for (const r of ["Why now: x", "the call didn't happen, so this offers a new time with your booking link"]) {
      expect(heldDetail(r, "Raj")).not.toMatch(/^Because/);
    }
  });
});
