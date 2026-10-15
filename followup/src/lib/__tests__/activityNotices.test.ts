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
