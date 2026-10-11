/**
 * A calm Today (A-046): longest waiting first, the wait said as a fact
 * about the customer, "handled today" counted from the owner's midnight.
 */
import { describe, it, expect, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { auditEvent: { findMany } } }));

import { byLongestWaiting, byTodayOrder, describeWait, describeWaitClause, readyReason, startOfLocalDay, todayTier } from "@/lib/calmToday";
import { countHandledToday } from "@/lib/handledToday";
import { groupApprovalsBySource, summariseGroups } from "@/lib/approvalGroups";
import type { PendingApproval } from "@/lib/pendingApprovals";

const NOW = new Date("2026-09-26T18:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
let seq = 0;
function a(over: Partial<PendingApproval> = {}): PendingApproval {
  seq += 1;
  return {
    leadId: `l${seq}`, leadName: `Lead ${seq}`, source: "Gmail", score: 50, draftRiskLevel: null, riskLevel: "low",
    reason: "the reply mentions a price", trigger: "unanswered", heldAt: new Date("2026-09-26T10:00:00Z"),
    draftSubject: null, draftMessage: "…", leadLastMessage: "hi", leadLastMessageChannel: "email", leadLastMessageAt: null, laterUntil: null, customerToldAt: null,
    ...over,
  };
}

describe("longest waiting first", () => {
  it("puts the customer who wrote earliest first", () => {
    const list = [a({ leadName: "Recent", leadLastMessageAt: ago(1) }), a({ leadName: "Oldest", leadLastMessageAt: ago(5) })];
    expect(list.sort(byLongestWaiting).map((x) => x.leadName)).toEqual(["Oldest", "Recent"]);
  });

  it("puts someone waiting on an answer before a check-in on someone quiet", () => {
    const list = [a({ leadName: "Quiet", trigger: "silence", leadLastMessageAt: ago(200) }), a({ leadName: "Waiting", leadLastMessageAt: ago(2) })];
    expect(list.sort(byLongestWaiting).map((x) => x.leadName)).toEqual(["Waiting", "Quiet"]);
  });

  it("falls back to score when there is no message time", () => {
    const list = [a({ leadName: "Low", score: 10 }), a({ leadName: "High", score: 90 })];
    expect(list.sort(byLongestWaiting).map((x) => x.leadName)).toEqual(["High", "Low"]);
  });

  // SUPERSEDED by A-230 (2026-10-11): this used to name Priya, the longest wait. A customer ready to buy now comes
  // first; among the rest the longest wait still leads (see "Today's order" below).
  it("names the ready customer in the line above the queue, ahead of a longer wait", () => {
    const groups = groupApprovalsBySource([
      a({ leadName: "Grace", source: "Messenger", score: 99, leadLastMessageAt: ago(0.3) }),
      a({ leadName: "Priya", source: "Instagram", score: 20, leadLastMessageAt: ago(5) }),
    ]);
    expect(summariseGroups(groups).focusOn?.leadName).toBe("Grace");
  });
});

describe("Today's order (A-230): the customer you'd lose soonest on top", () => {
  const order = (list: PendingApproval[]) => [...list].sort(byTodayOrder(NOW)).map((x) => x.leadName);

  it("puts a fresh customer who wants to book above someone who has waited 16 days", () => {
    expect(
      order([
        a({ leadName: "Lucia", score: 30, leadLastMessageAt: ago(16 * 24) }),
        a({ leadName: "Raj", score: 40, riskTopic: "date", leadLastMessageAt: ago(0.1) }),
      ])
    ).toEqual(["Raj", "Lucia"]);
  });

  it("goes ready, then new (last 24 hours), then older, then check-ins; the longest wait first inside each", () => {
    expect(
      order([
        a({ leadName: "CheckIn", trigger: "silence", leadLastMessageAt: ago(300) }),
        a({ leadName: "Older2", leadLastMessageAt: ago(30) }),
        a({ leadName: "New1h", leadLastMessageAt: ago(1) }),
        a({ leadName: "Older9d", leadLastMessageAt: ago(9 * 24) }),
        a({ leadName: "Price", riskTopic: "price", leadLastMessageAt: ago(2) }),
        a({ leadName: "New20h", leadLastMessageAt: ago(20) }),
        a({ leadName: "Hot", score: 85, leadLastMessageAt: ago(40) }),
      ])
    ).toEqual(["Hot", "Price", "New20h", "New1h", "Older9d", "Older2", "CheckIn"]);
  });

  it("says why a ready customer is on top, and nothing for anyone else", () => {
    expect(readyReason(a({ riskTopic: "date" }))).toBe("Wants to book");
    expect(readyReason(a({ riskTopic: "price" }))).toBe("Asked the price");
    expect(readyReason(a({ score: 70 }))).toBe("Likely to book");
    expect(readyReason(a({ score: 69 }))).toBeNull();
    // A check-in on someone quiet is never "ready": nobody is waiting on an answer.
    expect(readyReason(a({ trigger: "silence", score: 95 }))).toBeNull();
  });

  it("keeps a just-browsing customer below a real buyer, but on the list", () => {
    expect(todayTier(a({ score: 15, leadLastMessageAt: ago(0.2) }), NOW)).toBe("new");
    expect(todayTier(a({ score: 15, leadLastMessageAt: ago(25) }), NOW)).toBe("older");
    expect(todayTier(a({ score: 15, leadLastMessageAt: null }), NOW)).toBe("older");
  });

  it("orders by the tier the server worked out when the item carries one", () => {
    const fresh = { ...a({ leadName: "SaidNew", leadLastMessageAt: ago(30) }), tier: "new" as const };
    const ready = { ...a({ leadName: "SaidReady", leadLastMessageAt: ago(1) }), tier: "ready" as const };
    expect([fresh, ready].sort(byTodayOrder(NOW)).map((x) => x.leadName)).toEqual(["SaidReady", "SaidNew"]);
  });
});

describe("the wait, in words", () => {
  it("says Waiting for someone who wrote and Quiet for a check-in", () => {
    expect(describeWait(a({ leadLastMessageAt: ago(5) }), NOW)).toBe("Waiting 5 h");
    expect(describeWait(a({ trigger: "silence", leadLastMessageAt: ago(6 * 24) }), NOW)).toBe("Quiet 6 days");
    expect(describeWait(a({ leadLastMessageAt: ago(0.34) }), NOW)).toBe("Waiting 20 min");
  });

  it("uses no pronoun in the Start-with clause", () => {
    expect(describeWaitClause(a({ leadLastMessageAt: ago(5) }), NOW)).toBe("who has waited 5 hours");
    expect(describeWaitClause(a({ trigger: "silence", leadLastMessageAt: ago(24) }), NOW)).toBe("who has been quiet 1 day");
  });

  it("says nothing when there is no message on record", () => {
    expect(describeWait(a(), NOW)).toBeNull();
  });
});

describe("the owner's midnight", () => {
  it("is midnight where the business is, not in UTC", () => {
    // 18:00 UTC is 14:00 in Toronto (EDT), so midnight there was 04:00 UTC.
    expect(startOfLocalDay(NOW, "America/Toronto").toISOString()).toBe("2026-09-26T04:00:00.000Z");
    expect(startOfLocalDay(NOW, "UTC").toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });
});

describe("handled today", () => {
  it("counts each person once, plus what Send all routine sent", async () => {
    findMany.mockResolvedValueOnce([{ targetId: "l1" }, { targetId: "l2" }]).mockResolvedValueOnce([{ meta: { sent: 3 } }, { meta: {} }]);
    expect(await countHandledToday("biz", new Date("2026-09-26T04:00:00Z"))).toBe(5);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ distinct: ["targetId"] }));
  });

  // "I replied" on a lead-site card (b018, A-075) takes the person off Today
  // exactly like "We talked" does, and the count went up by one on screen —
  // then dropped back on the next load, because the event it writes was not
  // one this count read.
  it("counts a lead-site customer the owner marked I replied", async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await countHandledToday("biz", new Date("2026-09-26T04:00:00Z"));
    expect(findMany.mock.calls.at(-2)![0].where.action.in).toEqual(expect.arrayContaining(["lead.talked", "lead.replied_on_site"]));
  });
});
