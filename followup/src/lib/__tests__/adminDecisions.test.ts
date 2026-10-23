import { describe, it, expect } from "vitest";
import { buildDecisions, type DecisionFacts } from "@/lib/adminDecisions";
import type { TesterHealth } from "@/lib/testerHealth";

const row = () => ({ email: 0, instagram: 0, messenger: 0 });
const week = { newCustomers: 0, repliesWritten: 0, sentByOwner: 0, sentAutomatically: 0, instantAcks: 0, dismissed: 0, cameBack: 0, accountsActive: 0 };

function tester(name: string, connected: TesterHealth["checks"]["connected"]): TesterHealth {
  const ok = { state: "ok" as const, text: "fine" };
  return {
    id: name, name, email: `${name}@example.com`, business: null, score: 4, opened: "",
    checks: { connected, inbox: ok, drafts: ok, learning: ok, wonBack: ok },
    next: connected.state === "ok" ? null : `Gmail connected: ${connected.text}`,
  };
}

function facts(over: Partial<{ testers: TesterHealth[]; repliesWritten: number; sentByOwner: number; waitingNow: number; selling: number; spam: number }> = {}): DecisionFacts {
  const table = { friend: row(), work: row(), selling: row(), spam: row(), none: row() };
  table.selling.instagram = over.selling ?? 0;
  table.spam.instagram = over.spam ?? 0;
  return {
    health: { testers: over.testers ?? [tester("Ana", { state: "ok", text: "Gmail" })] },
    usage: { thisWeek: { ...week, repliesWritten: over.repliesWritten ?? 0, sentByOwner: over.sentByOwner ?? 0 }, waitingNow: over.waitingNow ?? 0 },
    notCustomer: { days: 30, table },
  };
}

describe("buildDecisions", () => {
  it("is empty when nothing needs the founder", () => {
    expect(buildDecisions(facts())).toEqual([]);
  });

  it("asks for a tester when there are none", () => {
    const d = buildDecisions(facts({ testers: [] }));
    expect(d.map((x) => x.key)).toEqual(["no-testers"]);
    expect(d[0].action.href).toBe("/admin/testers#add");
  });

  it("names the first tester who isn't set up, and counts the rest", () => {
    const d = buildDecisions(
      facts({
        testers: [tester("Ana", { state: "no", text: "Hasn't signed in" }), tester("Ben", { state: "no", text: "No email connected" })],
      }),
    );
    expect(d[0].title).toBe("2 testers are not set up");
    expect(d[0].why).toContain("Ana: Hasn't signed in.");
    expect(d[0].why).toContain("And 1 other.");
  });

  it("flags a week where replies were written but no owner sent one", () => {
    const d = buildDecisions(facts({ repliesWritten: 9, sentByOwner: 0, waitingNow: 22 }));
    expect(d[0].key).toBe("no-send");
    expect(d[0].why).toBe("22 replies are waiting for an OK. Ask a tester what stops them.");
    expect(buildDecisions(facts({ repliesWritten: 9, sentByOwner: 1 }))).toEqual([]);
  });

  it("flags a channel only once sellers and spam reach three", () => {
    expect(buildDecisions(facts({ selling: 1, spam: 1 }))).toEqual([]);
    const d = buildDecisions(facts({ selling: 2, spam: 1 }));
    expect(d[0].title).toBe("3 sellers and spammers got through on Instagram");
    expect(d[0].action.href).toBe("/admin/usage#not-a-customer");
  });

  it("names each kind with lessons waiting for the founder's OK, with its test in a few numbers (A-319)", () => {
    const decisions = buildDecisions({
      ...facts(),
      lessons: [
        { trade: "Real estate", waiting: 3, hasTest: true, test: { status: "done", current: true, passedWithout: 12, passedWith: 13, cases: 20, worse: 0 } },
        { trade: "Legal", waiting: 1, hasTest: false, test: null },
        { trade: "Clinic", waiting: 0, hasTest: false, test: null },
      ],
    });
    expect(decisions).toEqual([
      {
        key: "lessons-Real estate",
        title: "3 changes to Real estate replies wait for your OK",
        why: "Tested: 13 of 20 pass with them, 12 of 20 without. Nothing got worse.",
        action: { label: "Look and decide", href: "/admin/train?tab=talk&kind=Real%20estate" },
      },
      {
        key: "lessons-Legal",
        title: "1 change to Legal replies waits for your OK",
        why: "There's no reply test for this kind yet. Your OK puts it to work.",
        action: { label: "Look and decide", href: "/admin/train?tab=talk&kind=Legal" },
      },
    ]);
  });

  it("a test that no longer covers what is waiting reads as not tested", () => {
    const [d] = buildDecisions({
      ...facts(),
      lessons: [{ trade: "Real estate", waiting: 2, hasTest: true, test: { status: "done", current: false, passedWithout: 12, passedWith: 13, cases: 20, worse: 0 } }],
    });
    expect(d.why).toBe("Not tested yet. Test them on Train before they go in use.");
  });
});
