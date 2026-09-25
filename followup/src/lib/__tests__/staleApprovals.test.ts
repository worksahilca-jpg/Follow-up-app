/**
 * One nudge for a lead that has been waiting too long — and only one.
 *
 * Production, 2026-09-21: twenty-three leads in the approval queue, the
 * oldest waiting 175 hours. Telling somebody at the moment of holding
 * shipped separately and does nothing for a notification that was missed
 * — which is the normal case for an owner who opens FollowUp between
 * jobs, on a phone, with ninety seconds.
 *
 * The risk in the other direction is real and is why the "only one" half
 * is tested as hard as the "at least one" half: this runs hourly, and a
 * reminder that repeats every tick teaches the owner to ignore the bell,
 * which costs more than the lead ever would (brand-principles.md #2,
 * calm over urgent).
 *
 * Unlike the hold-time notifications, this IS testable behaviourally —
 * remindStaleApprovals takes a businessId and a clock and touches only
 * Prisma — so it is tested that way.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { pendingApprovals, notificationCount, notificationCreate, userFindMany, leadFindUnique } = vi.hoisted(() => ({
  pendingApprovals: vi.fn(),
  notificationCount: vi.fn(),
  notificationCreate: vi.fn(),
  userFindMany: vi.fn(),
  leadFindUnique: vi.fn(),
}));

vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals: pendingApprovals }));
vi.mock("@/lib/db", () => ({
  prisma: {
    notification: { count: notificationCount, create: notificationCreate },
    user: { findMany: userFindMany },
    lead: { findUnique: leadFindUnique },
    business: { findMany: vi.fn(async () => []) },
  },
}));

import { remindStaleApprovals, STALE_APPROVAL_AFTER_MS, STALE_APPROVAL_MARKER } from "@/lib/staleApprovals";

const NOW = new Date("2026-09-21T18:00:00Z");
const held = (hoursAgo: number, id = "lead1", name = "Harpreet Kaur") => ({
  leadId: id,
  leadName: name,
  riskLevel: "low",
  reason: "held",
  trigger: "silence",
  heldAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000),
  draftSubject: null,
  draftMessage: "draft",
  leadLastMessage: null,
  leadLastMessageChannel: null,
  leadLastMessageAt: null,
});

beforeEach(() => {
  notificationCount.mockResolvedValue(0);
  notificationCreate.mockResolvedValue({});
  userFindMany.mockResolvedValue([{ id: "admin1" }]);
  leadFindUnique.mockResolvedValue({ assignedToId: null });
});

describe("a lead the owner has left waiting", () => {
  it("is reminded about once it has waited a day", async () => {
    pendingApprovals.mockResolvedValue([held(25)]);
    const result = await remindStaleApprovals("biz1", NOW);
    expect(result.reminded).toBe(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate.mock.calls[0][0].data.message).toContain(STALE_APPROVAL_MARKER);
    expect(notificationCreate.mock.calls[0][0].data.leadId).toBe("lead1");
  });

  it("is left alone before then", async () => {
    // 23 hours. The hold-time notification is still the most recent thing
    // the owner heard, and repeating it the same day is nagging.
    pendingApprovals.mockResolvedValue([held(23)]);
    const result = await remindStaleApprovals("biz1", NOW);
    expect(result.reminded).toBe(0);
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("is reminded exactly once, however many times the cron runs", async () => {
    // The whole risk of an hourly job. The second run finds the marker
    // from the first and says nothing.
    pendingApprovals.mockResolvedValue([held(30)]);
    notificationCount.mockResolvedValue(1);
    const result = await remindStaleApprovals("biz1", NOW);
    expect(result.reminded).toBe(0);
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("looks for a previous reminder only since this hold began", async () => {
    // A lead resolved and later held again is a NEW wait, and deserves to
    // be heard about again. Scoping the dedup lookup to `heldAt` is what
    // makes that true.
    pendingApprovals.mockResolvedValue([held(48)]);
    await remindStaleApprovals("biz1", NOW);
    const where = notificationCount.mock.calls[0][0].where;
    // leadId moved into the OR when summaries became possible; the lead is
    // still one of the two shapes the lookup accepts.
    expect(where.OR).toContainEqual({ leadId: "lead1" });
    expect(where.createdAt.gte).toEqual(held(48).heldAt);
  });

  it("counts the days it has actually been waiting", async () => {
    pendingApprovals.mockResolvedValue([held(24 * 7 + 1)]);
    await remindStaleApprovals("biz1", NOW);
    // The real one found in production had waited 175 hours.
    expect(notificationCreate.mock.calls[0][0].data.message).toContain("7 days");
  });

  it("says 'a day', not '1 days'", async () => {
    pendingApprovals.mockResolvedValue([held(26)]);
    await remindStaleApprovals("biz1", NOW);
    const message = notificationCreate.mock.calls[0][0].data.message;
    expect(message).toContain("a day");
    expect(message).not.toContain("1 days");
  });
});

describe("who hears about it", () => {
  it("tells the assignee when there is one", async () => {
    pendingApprovals.mockResolvedValue([held(25)]);
    leadFindUnique.mockResolvedValue({ assignedToId: "vansh" });
    await remindStaleApprovals("biz1", NOW);
    expect(notificationCreate.mock.calls[0][0].data.userId).toBe("vansh");
  });

  it("falls back to every admin when nobody is assigned", async () => {
    // The shared-pool case. An unassigned lead used to notify nobody at
    // all elsewhere in this codebase; the same fallback applies here.
    pendingApprovals.mockResolvedValue([held(25)]);
    userFindMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    await remindStaleApprovals("biz1", NOW);
    expect(notificationCreate.mock.calls.map((c) => c[0].data.userId).sort()).toEqual(["a1", "a2"]);
  });

  it("says nothing rather than throwing when there is nobody to tell", async () => {
    pendingApprovals.mockResolvedValue([held(25)]);
    userFindMany.mockResolvedValue([]);
    const result = await remindStaleApprovals("biz1", NOW);
    expect(result.reminded).toBe(0);
  });
});

describe("it never breaks the send paths it runs beside", () => {
  it("returns zero instead of throwing when the queue cannot be read", async () => {
    // It runs inside the hourly automation cron. A reminder failing must
    // not be able to fail an actual send.
    pendingApprovals.mockRejectedValue(new Error("db down"));
    await expect(remindStaleApprovals("biz1", NOW)).resolves.toEqual({ checked: 0, reminded: 0 });
  });

  it("keeps going when one lead's reminder fails", async () => {
    // Two leads for one admin, so they stay under the collapse threshold
    // and are written individually. The first write fails; the second must
    // still land, and `reminded` must count only the one that did.
    pendingApprovals.mockResolvedValue([held(25, "lead1"), held(25, "lead2", "Robin Patel")]);
    notificationCreate.mockRejectedValueOnce(new Error("write failed"));
    const result = await remindStaleApprovals("biz1", NOW);
    expect(result.reminded).toBe(1);
    expect(notificationCreate).toHaveBeenCalledTimes(2);
  });

  it("does nothing at all when the queue is empty", async () => {
    pendingApprovals.mockResolvedValue([]);
    const result = await remindStaleApprovals("biz1", NOW);
    expect(result).toEqual({ checked: 0, reminded: 0 });
    expect(userFindMany).not.toHaveBeenCalled();
  });
});

describe("the threshold", () => {
  it("is a day", () => {
    // Long enough that the hold-time notification has had its chance,
    // short enough that a lead is not stale by the time anyone hears
    // twice. Pinned because changing it silently changes how loud the
    // product is.
    expect(STALE_APPROVAL_AFTER_MS).toBe(24 * 60 * 60 * 1000);
  });
});


/**
 * The reminder has to stay a reminder once it can be collapsed.
 *
 * A queue past HOLD_BURST_THRESHOLD becomes ONE notification carrying a
 * count and no leadId. The "have we already reminded about this lead?"
 * lookup was written when every reminder carried the lead's id, so on its
 * own it cannot see a summary at all — and a reminder nothing can see is a
 * reminder that gets written again every hour, forever, which is the exact
 * nagging this module's header argues against.
 *
 * Found by reasoning about the batching before shipping it, not by a
 * failing test — which is why these exist now.
 */
describe("a queue big enough to collapse", () => {
  const manyHeld = (n: number) =>
    Array.from({ length: n }, (_, i) => held(30, `lead${i + 1}`, `Lead ${i + 1}`));

  it("sends one summary rather than one row per lead", async () => {
    pendingApprovals.mockResolvedValue(manyHeld(20));
    const result = await remindStaleApprovals("biz1", NOW);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate.mock.calls[0][0].data.message).toContain("20 leads are");
    // Every lead was covered by that one row — the count is about leads
    // told about, not rows written.
    expect(result.reminded).toBe(20);
  });

  it("puts the marker in the summary, so it can be recognised later", async () => {
    // Without this the dedup below has nothing to match on.
    pendingApprovals.mockResolvedValue(manyHeld(20));
    await remindStaleApprovals("biz1", NOW);
    expect(notificationCreate.mock.calls[0][0].data.message).toContain(STALE_APPROVAL_MARKER);
    expect(notificationCreate.mock.calls[0][0].data.leadId).toBeNull();
  });

  it("looks for a summary sent to this lead's owners, not just one tagged with its id", async () => {
    // The dedup query must admit the summary's shape: no leadId, matched
    // by recipient instead. Asserted on the query because the count mock
    // is what decides the outcome.
    pendingApprovals.mockResolvedValue(manyHeld(20));
    await remindStaleApprovals("biz1", NOW);
    const where = notificationCount.mock.calls[0][0].where;
    expect(where.OR, "the dedup lookup cannot see a collapsed summary").toBeTruthy();
    expect(where.OR).toContainEqual({ leadId: null, userId: { in: ["admin1"] } });
  });

  it("says nothing on the next run, having already sent the summary", async () => {
    // The whole point. notificationCount answering 1 stands for the
    // summary written an hour ago.
    pendingApprovals.mockResolvedValue(manyHeld(20));
    notificationCount.mockResolvedValue(1);
    const result = await remindStaleApprovals("biz1", NOW);
    expect(result.reminded).toBe(0);
    expect(notificationCreate).not.toHaveBeenCalled();
  });
});
