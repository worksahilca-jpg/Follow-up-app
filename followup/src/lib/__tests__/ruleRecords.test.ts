/**
 * "This week: wrote · sent · waiting" under each rule in Settings (A-044).
 * The rule is read off the hold, because an approved draft goes out as a
 * "manual" send; a send that resolved a hold is counted once.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { auditFindMany, followUpFindMany, pending } = vi.hoisted(() => ({
  auditFindMany: vi.fn(),
  followUpFindMany: vi.fn(),
  pending: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { auditEvent: { findMany: auditFindMany }, followUp: { findMany: followUpFindMany } } }));
vi.mock("@/lib/automation", () => ({ DEAD_LEAD_ACTION: "dead_lead_reactivation" }));
vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals: pending }));

import { getRuleRecords } from "@/lib/ruleRecords";

const NOW = new Date("2026-09-26T12:00:00Z");
const at = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

beforeEach(() => {
  vi.clearAllMocks();
  pending.mockResolvedValue([]);
});

describe("getRuleRecords", () => {
  it("counts a held draft as written, and as sent once anything went to that customer after it", async () => {
    auditFindMany.mockResolvedValue([
      { targetId: "L1", createdAt: at(50), meta: { trigger: "silence" } },
      { targetId: "L2", createdAt: at(40), meta: { trigger: "silence" } },
      { targetId: "L3", createdAt: at(30), meta: { trigger: "unanswered" } },
    ]);
    followUpFindMany
      .mockResolvedValueOnce([]) // automated sends
      .mockResolvedValueOnce([{ id: "f1", leadId: "L1", sentAt: at(45) }]); // later sends to held customers
    pending.mockResolvedValue([{ trigger: "silence" }, { trigger: "unanswered" }]);

    const r = await getRuleRecords("biz", NOW);
    expect(r.silence).toEqual({ wrote: 2, sent: 1, waiting: 1 });
    expect(r.unanswered).toEqual({ wrote: 1, sent: 0, waiting: 1 });
    expect(r.instant_ack).toEqual({ wrote: 0, sent: 0, waiting: 0 });
  });

  it("counts a message a rule sent by itself as written and sent", async () => {
    auditFindMany.mockResolvedValue([]);
    followUpFindMany.mockResolvedValueOnce([
      { id: "a1", leadId: "L9", trigger: "instant_ack", sentAt: at(3) },
      { id: "a2", leadId: "L8", trigger: "dead_lead_reactivation", sentAt: at(5) },
    ]);
    const r = await getRuleRecords("biz", NOW);
    expect(r.instant_ack).toEqual({ wrote: 1, sent: 1, waiting: 0 });
    expect(r.dead_lead_reactivation).toEqual({ wrote: 1, sent: 1, waiting: 0 });
  });

  it("does not count one send twice when it resolved a hold", async () => {
    auditFindMany.mockResolvedValue([{ targetId: "L1", createdAt: at(20), meta: { trigger: "silence" } }]);
    followUpFindMany
      .mockResolvedValueOnce([{ id: "f1", leadId: "L1", trigger: "silence", sentAt: at(10) }])
      .mockResolvedValueOnce([{ id: "f1", leadId: "L1", sentAt: at(10) }]);
    expect((await getRuleRecords("biz", NOW)).silence).toEqual({ wrote: 1, sent: 1, waiting: 0 });
  });

  it("gives a send to the latest hold before it, not an earlier one", async () => {
    auditFindMany.mockResolvedValue([
      { targetId: "L1", createdAt: at(60), meta: { trigger: "silence" } },
      { targetId: "L1", createdAt: at(30), meta: { trigger: "silence" } },
    ]);
    followUpFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "f1", leadId: "L1", sentAt: at(10) }]);
    expect((await getRuleRecords("biz", NOW)).silence).toEqual({ wrote: 2, sent: 1, waiting: 0 });
  });

  it("ignores holds from paths that aren't one of the four rules", async () => {
    auditFindMany.mockResolvedValue([
      { targetId: "L1", createdAt: at(10), meta: { trigger: "dm_handoff" } },
      { targetId: "L2", createdAt: at(10), meta: { trigger: "sequence" } },
    ]);
    followUpFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await getRuleRecords("biz", NOW);
    expect(Object.values(r).every((x) => x.wrote === 0)).toBe(true);
  });

  it("only looks at the last seven days", async () => {
    auditFindMany.mockResolvedValue([]);
    followUpFindMany.mockResolvedValueOnce([]);
    await getRuleRecords("biz", NOW);
    const since = new Date(NOW.getTime() - 7 * 24 * 3_600_000);
    expect(auditFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: since } }) }));
  });
});
