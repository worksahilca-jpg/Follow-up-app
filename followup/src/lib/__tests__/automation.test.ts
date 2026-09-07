/**
 * Guarantees of the silence automation (src/lib/automation.ts): an
 * Assisted lead is never auto-sent unless the risk gate says "low"; a
 * failed risk check fails closed; OFF/won/lost leads are never eligible;
 * every considered lead is stamped so it isn't re-assessed hourly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    automation: { findFirst: vi.fn() },
    lead: { findMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: vi.fn(async () => "Just checking in on your question."),
  assessSendRisk: vi.fn(),
}));
vi.mock("@/lib/sender", () => ({ composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => `Hi,\n\n${body}`) }));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));

import { prisma } from "@/lib/db";
import { assessSendRisk } from "@/lib/integrations/openai";
import { sendFollowUpToLead } from "@/lib/sending";
import { runAutomationForBusiness } from "@/lib/automation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const risk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Young Son",
    businessId: "biz1",
    automationTier: "ASSISTED",
    suggestedMessage: null,
    conversations: [{ channel: "email", messages: [{ id: "m1", direction: "inbound", body: "Is the roof original?", sentAt: new Date(), opened: false }] }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  p.automation.findFirst.mockResolvedValue({ enabled: true, triggerDays: 5 });
  p.lead.update.mockResolvedValue({});
  send.mockResolvedValue({ success: true });
});

describe("silence automation risk gate", () => {
  it("holds an Assisted lead for approval when risk is not low, and saves the draft", async () => {
    p.lead.findMany.mockResolvedValue([lead()]);
    risk.mockResolvedValue({ riskLevel: "medium", reason: "asserts a fact not in the thread" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(r.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(p.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ suggestedMessage: expect.any(String) }) }));
  });

  it("sends an Assisted lead only when risk is low", async () => {
    p.lead.findMany.mockResolvedValue([lead()]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), { automated: true });
  });

  it("fails closed: a risk check that throws holds the lead", async () => {
    p.lead.findMany.mockResolvedValue([lead()]);
    risk.mockRejectedValue(new Error("OpenAI down"));
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("Autonomous leads skip the gate (opt-in per lead, by design)", async () => {
    p.lead.findMany.mockResolvedValue([lead({ automationTier: "AUTONOMOUS" })]);
    const r = await runAutomationForBusiness("biz1");
    expect(risk).not.toHaveBeenCalled();
    expect(r.sent).toBe(1);
  });

  it("only ever asks for leads that are not OFF, not won/lost, past the silence window, and not rechecked recently", async () => {
    p.lead.findMany.mockResolvedValue([]);
    await runAutomationForBusiness("biz1");
    const where = p.lead.findMany.mock.calls[0][0].where;
    expect(where.automationTier).toEqual({ not: "OFF" });
    expect(where.stage).toEqual({ notIn: ["WON", "LOST"] });
    expect(where.lastContacted.lte).toBeInstanceOf(Date);
    expect(where.OR).toEqual([{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: expect.any(Date) } }]);
  });

  it("stamps every considered lead so an hourly run does not re-assess it", async () => {
    p.lead.findMany.mockResolvedValue([lead()]);
    risk.mockResolvedValue({ riskLevel: "high", reason: "quotes a price" });
    await runAutomationForBusiness("biz1");
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { lastAutomationCheckedAt: expect.any(Date) } });
  });

  it("does nothing at all when the master switch is off", async () => {
    p.automation.findFirst.mockResolvedValue({ enabled: false, triggerDays: 5 });
    const r = await runAutomationForBusiness("biz1");
    expect(r.checked).toBe(0);
    expect(p.lead.findMany).not.toHaveBeenCalled();
  });
});
