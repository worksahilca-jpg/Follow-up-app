/**
 * "We talked" (design brain A-039, src/lib/talked.ts). The owner spoke with
 * a customer where FollowUp can't see it. Every automatic path must then
 * treat them as answered and stop checking in, until they write again. And
 * everything that describes the lead must say so, instead of counting down
 * to a check-in that is not coming.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { lead: { findFirst: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => true) }));

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { settledByTalk, lastInboundTime } from "@/lib/talked";
import { markTalked } from "@/lib/markTalked";
import { computeAutomationStatus, type AutomationStatusLead, type BusinessAutomationRules } from "@/lib/automationStatus";
import { assessRescue } from "@/lib/rescue";
import { describeAutomationStatus } from "@/components/AutomationStatusBadge";
import type { Lead, Message } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const NOW = new Date("2026-09-26T15:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const msg = (direction: "inbound" | "outbound", h: number): Message => ({ id: `${direction}${h}`, direction, channel: "email", body: "x", date: hoursAgo(h).toISOString() });

beforeEach(() => vi.clearAllMocks());

describe("settledByTalk", () => {
  it("is settled when the talk came after their last message, or they never wrote", () => {
    expect(settledByTalk(hoursAgo(1), hoursAgo(5))).toBe(true);
    expect(settledByTalk(hoursAgo(1), null)).toBe(true);
  });
  it("is not settled when they wrote after the talk, or there was no talk", () => {
    expect(settledByTalk(hoursAgo(5), hoursAgo(1))).toBe(false);
    expect(settledByTalk(null, hoursAgo(1))).toBe(false);
  });
  it("finds their last message whatever shape the messages come in", () => {
    expect(lastInboundTime([{ direction: "inbound", sentAt: hoursAgo(3) }, { direction: "outbound", sentAt: hoursAgo(1) }])).toBe(hoursAgo(3).getTime());
    expect(lastInboundTime([{ direction: "inbound", date: hoursAgo(2).toISOString() }, { direction: "inbound", at: hoursAgo(4).getTime() }])).toBe(hoursAgo(2).getTime());
    expect(lastInboundTime([{ direction: "outbound", sentAt: hoursAgo(1) }])).toBeNull();
  });
});

describe("markTalked", () => {
  it("records the talk on the owner's own lead, with an audit line", async () => {
    p.lead.findFirst.mockResolvedValue({ id: "l1" });
    const r = await markTalked("l1", "biz1", "u1");
    expect(r.success).toBe(true);
    expect(p.lead.findFirst).toHaveBeenCalledWith({ where: { id: "l1", businessId: "biz1" }, select: { id: true } });
    expect(p.lead.update.mock.calls[0][0].data.talkedAt).toBeInstanceOf(Date);
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: "u1" }, "lead.talked", { targetType: "lead", targetId: "l1" });
  });

  it("Undo clears it", async () => {
    p.lead.findFirst.mockResolvedValue({ id: "l1" });
    const r = await markTalked("l1", "biz1", "u1", true);
    expect(r).toEqual({ success: true, talkedAt: null });
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { talkedAt: null } });
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: "u1" }, "lead.talked_undone", { targetType: "lead", targetId: "l1" });
  });

  it("refuses another business's lead and changes nothing", async () => {
    p.lead.findFirst.mockResolvedValue(null);
    expect((await markTalked("l1", "other-biz", "u1")).success).toBe(false);
    expect(p.lead.update).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

describe("what the lead's page says", () => {
  const RULES: BusinessAutomationRules = {
    canSend: true,
    holdAllForApproval: true,
    masterEnabled: true,
    silenceTriggerDays: 3,
    unansweredEnabled: true,
    unansweredHours: 24,
    deadLeadEnabled: true,
    deadLeadDays: 45,
  };
  const statusLead = (over: Partial<AutomationStatusLead>): AutomationStatusLead => ({
    stage: "contacted",
    automationTier: "assisted",
    lastContacted: NOW.toISOString(),
    conversation: [msg("outbound", 40), msg("inbound", 30)],
    sequence: null,
    aiPausedReason: null,
    ...over,
  });

  it("says 'You talked with them' instead of counting down to a reply", () => {
    const s = computeAutomationStatus(statusLead({ talkedAt: hoursAgo(2).toISOString() }), RULES, NOW);
    expect(s).toEqual({ kind: "talked", at: hoursAgo(2).toISOString() });
    const shown = describeAutomationStatus(s as Exclude<typeof s, { kind: "closed" }>);
    expect(shown.label).toBe("You talked with them");
    expect(shown.detail).toMatch(/won't check in until they write again/);
  });

  it("goes back to normal the moment they write again", () => {
    const s = computeAutomationStatus(statusLead({ talkedAt: hoursAgo(35).toISOString() }), RULES, NOW);
    expect(s.kind).not.toBe("talked");
  });

  it("takes them off the at-risk list, until they write again", () => {
    const base: Lead = {
      id: "l1", name: "Grace Kim", company: "", email: "g@x.com", source: "Gmail", stage: "new", dealValue: 0,
      score: 80, reviewed: true, languageRead: null, languageReadAt: null, scoreReason: "", scoreFactors: [], priority: "high",
      lastContacted: hoursAgo(40).toISOString(), nextFollowUp: null, assignedTo: "", notes: "",
      conversation: [msg("outbound", 40), msg("inbound", 30)], suggestedMessage: "", automationTier: "assisted",
    };
    expect(assessRescue(base, NOW).atRisk).toBe(true);
    expect(assessRescue({ ...base, talkedAt: hoursAgo(2).toISOString() }, NOW).atRisk).toBe(false);
    expect(assessRescue({ ...base, talkedAt: hoursAgo(35).toISOString() }, NOW).atRisk).toBe(true);
  });
});
