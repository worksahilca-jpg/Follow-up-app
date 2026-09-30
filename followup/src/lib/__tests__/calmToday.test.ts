/**
 * A calm Today (A-046): longest waiting first, the wait said as a fact
 * about the customer, "handled today" counted from the owner's midnight.
 */
import { describe, it, expect, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { auditEvent: { findMany } } }));

import { byLongestWaiting, describeWait, describeWaitClause, startOfLocalDay } from "@/lib/calmToday";
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

  it("names the longest-waiting person in the line above the queue", () => {
    const groups = groupApprovalsBySource([
      a({ leadName: "Grace", source: "Messenger", score: 99, leadLastMessageAt: ago(0.3) }),
      a({ leadName: "Priya", source: "Instagram", score: 20, leadLastMessageAt: ago(5) }),
    ]);
    expect(summariseGroups(groups).focusOn?.leadName).toBe("Priya");
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
