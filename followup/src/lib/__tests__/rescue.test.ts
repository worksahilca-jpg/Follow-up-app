/**
 * The rescue score ranks what an owner is about to lose. These pin its
 * shape: neglect of a waiting lead outranks silence, intent adds, a cold
 * trail subtracts, closed leads never surface.
 */
import { describe, it, expect } from "vitest";
import { assessRescue, getAtRiskLeads } from "@/lib/rescue";
import type { Lead, Message } from "@/lib/types";

const NOW = new Date("2026-09-07T12:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function msg(direction: Message["direction"], hoursAgo: number): Message {
  return { id: `${direction}-${hoursAgo}`, direction, channel: "email", body: "…", date: h(hoursAgo) };
}
function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "l1", name: "Young Son", company: "", email: "y@x.com", source: "Gmail", stage: "new", dealValue: 0,
    score: 50, scoreReason: "asked about the roof", scoreFactors: [], priority: "medium",
    lastContacted: h(30), nextFollowUp: null, assignedTo: "", notes: "", conversation: [], suggestedMessage: "",
    automationTier: "assisted", ...over,
  };
}

describe("rescue score", () => {
  it("a lead waiting 30h for an answer is at risk; the same lead we answered is not", () => {
    const waiting = assessRescue(lead({ conversation: [msg("outbound", 40), msg("inbound", 30)] }), NOW);
    expect(waiting.atRisk).toBe(true);
    expect(waiting.waitingHours).toBeCloseTo(30, 0);
    expect(waiting.reason).toMatch(/still waiting for an answer/);

    const answered = assessRescue(lead({ conversation: [msg("inbound", 30), msg("outbound", 29)] }), NOW);
    expect(answered.atRisk).toBe(false);
    expect(answered.waitingHours).toBeNull();
  });

  it("a lead who wrote minutes ago is not yet 'neglected'", () => {
    const r = assessRescue(lead({ conversation: [msg("inbound", 0.2)] }), NOW);
    expect(r.atRisk).toBe(false);
    expect(r.reason).toMatch(/just wrote/);
  });

  it("neglect outranks silence at equal intent", () => {
    const neglected = assessRescue(lead({ conversation: [msg("outbound", 60), msg("inbound", 30)] }), NOW).score;
    const silent = assessRescue(lead({ conversation: [msg("inbound", 60), msg("outbound", 30)] }), NOW).score;
    expect(neglected).toBeGreaterThan(silent);
  });

  it("silence grows with days and a live conversation scores nothing for neglect", () => {
    const live = assessRescue(lead({ score: 0, conversation: [msg("inbound", 30), msg("outbound", 20)] }), NOW);
    expect(live.score).toBe(0);
    const nineDays = assessRescue(lead({ score: 0, conversation: [msg("inbound", 300), msg("outbound", 9 * 24)] }), NOW);
    expect(nineDays.silentDays).toBeCloseTo(9, 0);
    expect(nineDays.score).toBeGreaterThan(20);
  });

  it("intent adds up to 30 points", () => {
    const low = assessRescue(lead({ score: 0, conversation: [msg("inbound", 30)] }), NOW).score;
    const high = assessRescue(lead({ score: 100, conversation: [msg("inbound", 30)] }), NOW).score;
    expect(high - low).toBe(30);
  });

  it("a cold trail is less recoverable", () => {
    const recent = assessRescue(lead({ conversation: [msg("inbound", 30)] }), NOW).score;
    const stale = assessRescue(lead({ conversation: [msg("inbound", 50 * 24)] }), NOW).score;
    expect(stale).toBeLessThan(recent);
  });

  it("won and lost leads never surface", () => {
    expect(assessRescue(lead({ stage: "won", conversation: [msg("inbound", 100)] }), NOW).score).toBe(0);
    expect(getAtRiskLeads([lead({ stage: "lost", conversation: [msg("inbound", 100)] })], NOW)).toHaveLength(0);
  });

  it("getAtRiskLeads returns only at-risk leads, most urgent first", () => {
    const list = getAtRiskLeads(
      [
        lead({ id: "a", conversation: [msg("inbound", 20)] }),
        lead({ id: "b", conversation: [msg("inbound", 40)] }),
        lead({ id: "c", conversation: [msg("inbound", 30), msg("outbound", 1)] }),
      ],
      NOW
    );
    expect(list.map((l) => l.id)).toEqual(["b", "a"]);
  });
});
