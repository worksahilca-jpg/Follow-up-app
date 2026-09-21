/**
 * A hundred notifications is not a hundred times as useful as one.
 *
 * Connecting Gmail pulls up to 100 threads from the last 90 days. Every
 * one is a backfilled thread, so every one is held rather than sent —
 * which is correct, and settled on 2026-09-09 after the alternative
 * answered an 84-day-old supplier thread with a payment commitment in the
 * founder's voice.
 *
 * What was NOT settled is how the owner hears about it. Shipped on
 * 2026-09-21, the hold-time notification wrote one row per lead, so a new
 * tester's first hour with FollowUp would have been a bell showing 90 —
 * and the stale-approval reminder would have done it again the next day.
 *
 * Both halves are tested here, because both directions are failures: a
 * bell that floods teaches the owner to ignore it, and a bell that
 * collapses two leads into "2 leads are waiting" has thrown away the two
 * names that were the whole value.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { notificationCreate, userFindMany } = vi.hoisted(() => ({
  notificationCreate: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: { create: notificationCreate },
    user: { findMany: userFindMany },
  },
}));

import { flushHoldNotices, HOLD_BURST_THRESHOLD, HOLD_SUMMARY_MARKER } from "@/lib/holdNotices";

const notice = (n: number, assignedToId: string | null = "owner1", businessId = "biz1") => ({
  leadId: `lead${n}`,
  businessId,
  assignedToId,
  message: `Lead ${n} — a follow-up is written and waiting for your approval.`,
});

const messagesFor = (userId: string) =>
  notificationCreate.mock.calls.filter((c) => c[0].data.userId === userId).map((c) => c[0].data.message);

beforeEach(() => {
  notificationCreate.mockReset();
  notificationCreate.mockResolvedValue({});
  userFindMany.mockReset();
  userFindMany.mockResolvedValue([{ id: "admin1" }]);
});

describe("a normal day", () => {
  it("names each lead when there are only a few", async () => {
    const written = await flushHoldNotices([notice(1), notice(2)]);
    expect(written).toEqual({ rows: 2, leads: 2 });
    expect(messagesFor("owner1")).toEqual([
      "Lead 1 — a follow-up is written and waiting for your approval.",
      "Lead 2 — a follow-up is written and waiting for your approval.",
    ]);
  });

  it("still names them at exactly the threshold", async () => {
    // The boundary is a decision, not an accident: three names still read
    // as a list an owner can act on.
    const notices = Array.from({ length: HOLD_BURST_THRESHOLD }, (_, i) => notice(i + 1));
    await flushHoldNotices(notices);
    expect(notificationCreate).toHaveBeenCalledTimes(HOLD_BURST_THRESHOLD);
    expect(messagesFor("owner1").every((m) => !m.includes("leads are"))).toBe(true);
  });

  it("writes nothing at all when there is nothing held", async () => {
    expect(await flushHoldNotices([])).toEqual({ rows: 0, leads: 0 });
    expect(notificationCreate).not.toHaveBeenCalled();
  });
});

describe("the burst a fresh inbox connect creates", () => {
  it("collapses to one line once past the threshold", async () => {
    const notices = Array.from({ length: HOLD_BURST_THRESHOLD + 1 }, (_, i) => notice(i + 1));
    const written = await flushHoldNotices(notices);
    // One row, but every lead covered by it — the two counts differ after
    // collapsing, and callers want the second.
    expect(written).toEqual({ rows: 1, leads: HOLD_BURST_THRESHOLD + 1 });
    expect(messagesFor("owner1")).toEqual([
      `${HOLD_BURST_THRESHOLD + 1} leads are ${HOLD_SUMMARY_MARKER}. Open Approvals to read them.`,
    ]);
  });

  it("stays one line at ninety, not ninety", async () => {
    // The actual scenario: a Gmail connect, first automation tick.
    const notices = Array.from({ length: 90 }, (_, i) => notice(i + 1));
    await flushHoldNotices(notices);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(messagesFor("owner1")[0]).toContain("90 leads are");
  });

  it("points at the queue rather than at one arbitrary lead", async () => {
    // leadId null is the point: linking a summary about ninety leads to
    // whichever one happened to be first is worse than linking to the list.
    const notices = Array.from({ length: 10 }, (_, i) => notice(i + 1));
    await flushHoldNotices(notices);
    expect(notificationCreate.mock.calls[0][0].data.leadId).toBeNull();
    expect(notificationCreate.mock.calls[0][0].data.message).toContain("Open Approvals");
  });
});

describe("who gets which form", () => {
  it("decides per person, not per business", async () => {
    // A team where one assignee holds many and another holds one: the
    // second person is owed their lead's name, not a count of one.
    const notices = [
      ...Array.from({ length: 10 }, (_, i) => notice(i + 1, "busy")),
      notice(99, "quiet"),
    ];
    await flushHoldNotices(notices);
    expect(messagesFor("busy")).toEqual([`10 leads are ${HOLD_SUMMARY_MARKER}. Open Approvals to read them.`]);
    expect(messagesFor("quiet")).toEqual(["Lead 99 — a follow-up is written and waiting for your approval."]);
  });

  it("falls back to every admin when a lead is unassigned", async () => {
    userFindMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    await flushHoldNotices([notice(1, null)]);
    expect(notificationCreate.mock.calls.map((c) => c[0].data.userId).sort()).toEqual(["a1", "a2"]);
  });

  it("counts per admin, so each admin sees one summary rather than the pile", async () => {
    userFindMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    const notices = Array.from({ length: 20 }, (_, i) => notice(i + 1, null));
    await flushHoldNotices(notices);
    expect(messagesFor("a1")).toEqual([`20 leads are ${HOLD_SUMMARY_MARKER}. Open Approvals to read them.`]);
    expect(messagesFor("a2")).toEqual([`20 leads are ${HOLD_SUMMARY_MARKER}. Open Approvals to read them.`]);
  });

  it("looks the admins up once, however many unassigned leads there are", async () => {
    // Twenty lookups of the same admin list inside one flush is twenty
    // round trips in a cron that runs beside real sends.
    const notices = Array.from({ length: 20 }, (_, i) => notice(i + 1, null));
    await flushHoldNotices(notices);
    expect(userFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("it never breaks the run it ends", () => {
  it("keeps going when one person's write fails", async () => {
    notificationCreate.mockRejectedValueOnce(new Error("write failed"));
    const written = await flushHoldNotices([notice(1, "u1"), notice(2, "u2")]);
    expect(written).toEqual({ rows: 1, leads: 1 });
  });

  it("skips a lead whose owners cannot be resolved, rather than throwing", async () => {
    userFindMany.mockRejectedValue(new Error("db down"));
    await expect(flushHoldNotices([notice(1, null)])).resolves.toEqual({ rows: 0, leads: 0 });
  });
});


/**
 * A caller that deduplicates on its own marker needs it inside the
 * summary, because a summary carries no leadId to be found by.
 */
describe("the summary wording", () => {
  it("can be overridden by a caller that has to recognise it later", async () => {
    const notices = Array.from({ length: 5 }, (_, i) => notice(i + 1));
    await flushHoldNotices(notices, { summary: (n) => `${n} leads are still waiting for your approval.` });
    expect(messagesFor("owner1")).toEqual(["5 leads are still waiting for your approval."]);
  });

  it("does not use the override for the individually-named case", async () => {
    // Under the threshold the leads are named, and a caller's summary
    // wording has nothing to do with those rows.
    await flushHoldNotices([notice(1)], { summary: () => "SHOULD NOT APPEAR" });
    expect(messagesFor("owner1")).toEqual(["Lead 1 — a follow-up is written and waiting for your approval."]);
  });
});
