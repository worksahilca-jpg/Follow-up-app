/**
 * Testers who sent replies before and have stalled since (founder,
 * 2026-10-14: "Yes, add it", A-249). The morning email named only testers
 * short of a first reply, so a tester who sent one and then left 17
 * customers waiting with Gmail disconnected never showed up in it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, getPendingApprovals } = vi.hoisted(() => ({
  getPendingApprovals: vi.fn(),
  prismaMock: {
    accessRequest: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    followUp: { findFirst: vi.fn() },
    integration: { findMany: vi.fn() },
    auditEvent: { findFirst: vi.fn() },
    signIn: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/platformAdmin", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/lib/pendingApprovals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pendingApprovals")>()),
  getPendingApprovals,
}));

import { findStopped, stoppedReason, type StoppedFacts } from "@/lib/activation";
import { loadStopped } from "@/lib/activation-data";

const facts = (over: Partial<StoppedFacts>): StoppedFacts => ({
  id: "t1",
  name: "Asha",
  email: "asha@example.com",
  business: "Asha Homes",
  waiting: 0,
  oldestWaitDays: null,
  inboxDisconnected: false,
  quietDays: null,
  ...over,
});

describe("what the email says about a stalled tester", () => {
  it("says how many replies wait and for how long, the inbox, and when they last looked", () => {
    expect(stoppedReason(facts({ waiting: 17, oldestWaitDays: 9, inboxDisconnected: true, quietDays: 9 }))).toBe(
      "17 replies are waiting for an OK, the oldest for 9 days. Gmail or Outlook is disconnected. Last opened FollowUp 9 days ago."
    );
    expect(stoppedReason(facts({ waiting: 1, oldestWaitDays: 1, quietDays: 1 }))).toBe(
      "1 reply is waiting for an OK, the oldest for 1 day. Last opened FollowUp 1 day ago."
    );
  });

  it("says a recent open plainly, and leaves out what isn't on record", () => {
    expect(stoppedReason(facts({ inboxDisconnected: true, quietDays: 0 }))).toBe("Gmail or Outlook is disconnected. Opened FollowUp in the last day.");
    expect(stoppedReason(facts({ inboxDisconnected: true }))).toBe("Gmail or Outlook is disconnected.");
  });

  it("lists only testers with something to nudge about, most replies waiting first", () => {
    const out = findStopped([
      facts({ id: "fine", quietDays: 0 }),
      facts({ id: "inbox", inboxDisconnected: true, quietDays: 4 }),
      facts({ id: "many", waiting: 17, oldestWaitDays: 9, quietDays: 9 }),
      facts({ id: "few", waiting: 2, oldestWaitDays: 3, quietDays: 2 }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["many", "few", "inbox"]);
    expect(out[0]).toMatchObject({ name: "Asha", email: "asha@example.com", business: "Asha Homes", quietDays: 9 });
  });
});

describe("reading stalled testers", () => {
  const now = new Date("2026-10-15T13:07:00Z");
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  const tester = (id: string, name: string, business: string | null) => ({
    id,
    name,
    email: `${name.toLowerCase()}@example.com`,
    business,
    decidedAt: ago(24 * 30),
    createdAt: ago(24 * 31),
  });
  const byBusiness = <T>(rows: Record<string, T>, fallback: T) => (args: { where: { businessId?: string; user?: { businessId: string } } }) =>
    Promise.resolve(rows[args.where.businessId ?? args.where.user?.businessId ?? ""] ?? fallback);

  beforeEach(() => {
    prismaMock.accessRequest.findMany.mockResolvedValue([
      tester("t1", "Asha", "Asha Homes"),
      tester("t2", "Ben", null),
      tester("t3", "Cy", null),
      tester("t4", "Di", "Di Co"),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { email: "asha@example.com", businessId: "b1", createdAt: ago(24 * 30) },
      { email: "ben@example.com", businessId: "b2", createdAt: ago(24 * 30) },
      { email: "di@example.com", businessId: "b4", createdAt: ago(24 * 30) },
    ]);
    // Ben never sent a first reply: the stuck list covers him.
    prismaMock.followUp.findFirst.mockImplementation((args: { where: { lead: { businessId: string } } }) =>
      Promise.resolve(args.where.lead.businessId === "b2" ? null : { id: "f1" })
    );
    prismaMock.integration.findMany.mockImplementation(byBusiness({ b1: [{ status: "needs_reconnect" }], b4: [{ status: "connected" }] }, []));
    prismaMock.auditEvent.findFirst.mockImplementation(byBusiness({ b1: { createdAt: ago(24 * 9 + 2) }, b4: { createdAt: ago(1) } }, null));
    prismaMock.signIn.findFirst.mockImplementation(byBusiness({ b1: { createdAt: ago(24 * 20) } }, null));
    getPendingApprovals.mockReset().mockImplementation((businessId: string) =>
      Promise.resolve(
        businessId === "b1"
          ? [
              { heldAt: ago(24 * 3), laterUntil: null, source: "Gmail" },
              { heldAt: ago(12), laterUntil: null, source: "Gmail" }, // not two days yet
              { heldAt: ago(24 * 5), laterUntil: new Date(now.getTime() + 3_600_000), source: "Gmail" }, // set aside with Later
              { heldAt: ago(24 * 6), laterUntil: null, source: "Test lead" }, // a practice customer
              { heldAt: ago(24 * 2), laterUntil: null, source: "Instagram" }, // exactly two days
            ]
          : [{ heldAt: ago(1), laterUntil: null, source: "Gmail" }]
      )
    );
  });

  it("names a tester past their first reply with replies waiting two days or more, or the inbox disconnected", async () => {
    expect(await loadStopped(now)).toEqual([
      {
        id: "t1",
        name: "Asha",
        email: "asha@example.com",
        business: "Asha Homes",
        reason: "2 replies are waiting for an OK, the oldest for 3 days. Gmail or Outlook is disconnected. Last opened FollowUp 9 days ago.",
        quietDays: 9,
      },
    ]);
  });

  it("reads Today's own queue, and only for testers who sent a first reply", async () => {
    await loadStopped(now);
    expect(getPendingApprovals.mock.calls.map((c) => c[0]).sort()).toEqual(["b1", "b4"]);
    expect(prismaMock.followUp.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "sent", lead: { businessId: "b1" } }) })
    );
  });
});
