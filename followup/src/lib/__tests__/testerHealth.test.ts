/**
 * "Is it working for them?" (founder, 2026-09-28). The five checks and the
 * score behind the Oct 25 checkpoint: pure logic, driven with plain facts.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/platformAdmin", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/lib/rescued", () => ({ getRescueReport: vi.fn() }));

import { buildTesterHealth, judgeTester, type TesterFacts } from "@/lib/testerHealth";

const NOW = new Date("2026-10-10T15:00:00Z");
const MIN = 60_000;

function tester(over: Partial<TesterFacts> = {}): TesterFacts {
  return {
    id: "t1",
    name: "Priya",
    email: "priya@example.com",
    business: "Priya's Salon",
    signedIn: true,
    inbox: { provider: "gmail", status: "connected", lastSyncedAt: new Date(NOW.getTime() - 4 * MIN) },
    meta: { instagram: true, facebook: false },
    drafts: { sent: 10, asWritten: 7 },
    writeLikeMe: { on: true, kept: 42 },
    wonBack: 2,
    ...over,
  };
}

describe("judgeTester", () => {
  it("passes all five when Gmail is on, the inbox is fresh, drafts land, it learns and a customer came back", () => {
    const h = judgeTester(tester(), NOW);
    expect(h.score).toBe(5);
    expect(h.next).toBeNull();
    expect(h.checks.connected.text).toBe("Gmail, and Instagram");
    expect(h.checks.inbox.text).toBe("Checked 4 min ago");
    expect(h.checks.drafts.text).toBe("7 of 10 as written");
    expect(h.checks.learning.text).toBe("Write like me · 42 replies");
    expect(h.checks.wonBack.text).toBe("2 customers");
  });

  // Gmail first (2026-10-04): the inbox alone counts as connected; Meta is named when on, never required.
  it("counts Gmail alone as connected, and names a Meta channel when it is on", () => {
    expect(judgeTester(tester({ meta: { instagram: false, facebook: false } }), NOW).checks.connected).toEqual({ state: "ok", text: "Gmail" });
    expect(judgeTester(tester({ inbox: null }), NOW).checks.connected).toEqual({ state: "no", text: "No email connected" });
    expect(judgeTester(tester({ inbox: { provider: "gmail", status: "needs_reconnect", lastSyncedAt: null } }), NOW).checks.connected).toEqual({
      state: "no",
      text: "Gmail stopped",
    });
    expect(judgeTester(tester({ signedIn: false }), NOW).checks.connected.text).toBe("Hasn't signed in");
  });

  it("calls an inbox not checked for over half an hour a stall, and a stopped inbox not checked at all", () => {
    expect(judgeTester(tester({ inbox: { provider: "gmail", status: "connected", lastSyncedAt: new Date(NOW.getTime() - 3 * 60 * MIN) } }), NOW).checks.inbox).toEqual({
      state: "no",
      text: "Last checked 3 h ago",
    });
    expect(judgeTester(tester({ inbox: { provider: "gmail", status: "connected", lastSyncedAt: null } }), NOW).checks.inbox.state).toBe("not_yet");
    expect(judgeTester(tester({ inbox: null }), NOW).checks.inbox).toEqual({ state: "no", text: "No inbox to check" });
  });

  it("never passes or fails drafts on fewer than three sends", () => {
    expect(judgeTester(tester({ drafts: { sent: 0, asWritten: 0 } }), NOW).checks.drafts).toEqual({ state: "not_yet", text: "None sent yet" });
    expect(judgeTester(tester({ drafts: { sent: 2, asWritten: 0 } }), NOW).checks.drafts).toEqual({ state: "not_yet", text: "Only 2 sent" });
    expect(judgeTester(tester({ drafts: { sent: 4, asWritten: 2 } }), NOW).checks.drafts.state).toBe("ok");
    expect(judgeTester(tester({ drafts: { sent: 5, asWritten: 2 } }), NOW).checks.drafts).toEqual({ state: "no", text: "2 of 5 as written" });
  });

  it("names the first gap as the thing to help with next", () => {
    const h = judgeTester(tester({ inbox: { provider: "gmail", status: "needs_reconnect", lastSyncedAt: null }, writeLikeMe: { on: false, kept: 0 }, wonBack: 0 }), NOW);
    expect(h.score).toBe(1);
    expect(h.next).toBe("Gmail connected: Gmail stopped");
  });
});

describe("buildTesterHealth", () => {
  it("puts the least working tester first and names the most common gap", () => {
    const report = buildTesterHealth(
      [
        tester({ id: "a", name: "Ana" }),
        tester({ id: "b", name: "Ben", inbox: null, wonBack: 0 }),
        tester({ id: "c", name: "Cy", inbox: null }),
      ],
      NOW
    );
    expect(report.testers.map((t) => t.name)).toEqual(["Ben", "Cy", "Ana"]);
    expect(report.working).toBe(1);
    expect(report.summary).toBe("1 of 3 testers have FollowUp fully working. Most common gap: Gmail not connected (2 of 3).");
  });

  it("says so when there are no testers", () => {
    expect(buildTesterHealth([], NOW)).toEqual({ testers: [], working: 0, summary: "No testers yet." });
  });
});
