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
    lead: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    notification: { create: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: vi.fn(async () => ({ subject: "Checking in", body: "Just checking in on your question." })),
  assessSendRisk: vi.fn(),
}));
vi.mock("@/lib/sender", () => ({ composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => `Hi,\n\n${body}`) }));
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: vi.fn(async () => ({ success: true })),
  // task #86: automation.ts now passes this explicitly instead of relying
  // on sendFollowUpToLead()'s own email-if-present default.
  detectAutomatedReplyChannel: vi.fn(async () => "email"),
}));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
// Real send-window logic (real time-of-day, real Intl calls) has no place
// in a deterministic test — defaulted to "always within window" here so
// every existing test's outcome depends only on what it actually sets up;
// the dedicated describe block below overrides this to false to exercise
// the deferral path itself.
vi.mock("@/lib/sendWindow", () => ({ isWithinSendWindow: vi.fn(() => true) }));

import { prisma } from "@/lib/db";
import { assessSendRisk } from "@/lib/integrations/openai";
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { recordAudit } from "@/lib/audit";
import { isWithinSendWindow } from "@/lib/sendWindow";
import { runAutomationForBusiness } from "@/lib/automation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const risk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;
const replyChannel = detectAutomatedReplyChannel as unknown as ReturnType<typeof vi.fn>;
const sendWindow = isWithinSendWindow as unknown as ReturnType<typeof vi.fn>;

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Young Son",
    businessId: "biz1",
    automationTier: "ASSISTED",
    suggestedMessage: null,
    conversations: [{ channel: "email", messages: [{ id: "m1", direction: "inbound", body: "Is the roof original?", sentAt: new Date(), opened: false }] }],
    followUps: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  // First call: the "auto_send" master row; second: the unanswered-reply rule.
  p.automation.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
    where.action === "auto_send" ? { enabled: true, triggerDays: 5 } : { enabled: true, triggerHours: 24 }
  );
  // First findMany is the silence query, second the unanswered query.
  p.lead.findMany.mockResolvedValue([]);
  p.lead.update.mockResolvedValue({});
  p.lead.updateMany.mockResolvedValue({ count: 1 }); // claim succeeds by default
  p.notification.create.mockResolvedValue({});
  p.business.findUnique.mockResolvedValue({ timezone: "America/New_York" });
  send.mockResolvedValue({ success: true });
  replyChannel.mockResolvedValue("email");
  sendWindow.mockReturnValue(true);
});

function unansweredLead(hoursAgo: number, lastDirection: "inbound" | "outbound" = "inbound") {
  return lead({
    id: "lead2",
    name: "Harpreet",
    assignedToId: "user1",
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "a", direction: "outbound", body: "Here is the listing.", sentAt: new Date(Date.now() - (hoursAgo + 5) * 3_600_000), opened: false },
          { id: "b", direction: lastDirection, body: "Is it freehold?", sentAt: new Date(Date.now() - hoursAgo * 3_600_000), opened: false },
        ],
      },
    ],
    // "Here is the listing." is a real reply, not the instant-ack —
    // this lead keeps the normal (longer) unanswered-reply window.
    followUps: [{ trigger: "manual" }],
  });
}

describe("human-neglect trigger (lead wrote, nobody answered)", () => {
  it("picks up a lead whose last message is inbound and older than the window, and tells the owner when held", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(30)]);
    risk.mockResolvedValue({ riskLevel: "medium", reason: "answers a factual question" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(1);
    expect(r.held).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadId: "lead2", message: expect.stringMatching(/hasn't heard back/) }) })
    );
  });

  it("tells the owner when it replied for them", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(30)]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ message: expect.stringMatching(/replied for you/) }) })
    );
  });

  it("never treats a lead as neglected once anyone has replied (last message outbound)", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(30, "outbound")]);
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(0);
    expect(r.checked).toBe(0);
  });

  it("waits the full window: an inbound newer than the window is not neglected yet", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(2)]);
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(0);
  });

  // Task from research/product/2026-09-09-followup-cadence-best-practices.md
  // §1: a lead whose only outbound message is the instant-ack template
  // (never a real reply) gets the much shorter UNANSWERED_FIRST_REPLY_HOURS
  // window instead of waiting out the full business-configured one.
  function firstReplyLead(hoursAgo: number, outboundTrigger?: "instant_ack") {
    return lead({
      id: "lead3",
      name: "Priya",
      assignedToId: "user1",
      conversations: [
        {
          channel: "email",
          messages: [
            ...(outboundTrigger
              ? [{ id: "a", direction: "outbound", body: "Thanks for reaching out...", sentAt: new Date(Date.now() - (hoursAgo + 1) * 3_600_000), opened: false }]
              : []),
            { id: "b", direction: "inbound", body: "What's the price?", sentAt: new Date(Date.now() - hoursAgo * 3_600_000), opened: false },
          ],
        },
      ],
      // The instant-ack's own FollowUp row is what marks it non-substantive
      // — see the comment above findUnansweredLeads's hasSubstantiveFollowUp
      // check; Message itself carries no such marker.
      followUps: outboundTrigger ? [{ trigger: outboundTrigger }] : [],
    });
  }

  it("picks up a first-message lead past only the short window, even though it's well inside the normal 24h one", async () => {
    // 4 hours: past UNANSWERED_FIRST_REPLY_HOURS (3) but nowhere near the
    // business's 24h default — the old flat-24h behavior would have missed
    // this entirely for another 20 hours.
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([firstReplyLead(4, "instant_ack")]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(1);
  });

  it("applies the same short window when there's no outbound message at all yet, not just an instant-ack one", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([firstReplyLead(4)]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(1);
  });

  it("still waits out the short window for a first-message lead — 1 hour isn't enough", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([firstReplyLead(1, "instant_ack")]);
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(0);
  });

  it("does NOT shorten the window once a real (non-instant-ack) reply has gone out", async () => {
    // Same 4-hour staleness as the picked-up case above, but the prior
    // outbound message is a real reply (no special trigger) rather than
    // the instant-ack template — this is unansweredLead's own shape, and
    // it must still respect the full 24h default, not the 3h one.
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(4)]);
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(0);
  });

  it("is skipped entirely when the business turned the rule off", async () => {
    p.automation.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "auto_send" ? { enabled: true, triggerDays: 5 } : { enabled: false, triggerHours: 24 }
    );
    await runAutomationForBusiness("biz1");
    expect(p.lead.findMany).toHaveBeenCalledTimes(1); // only the silence query ran
  });
});

describe("silence automation risk gate", () => {
  it("holds an Assisted lead for approval when risk is not low, and saves the draft", async () => {
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "medium", reason: "asserts a fact not in the thread" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(r.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(p.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ suggestedMessage: expect.any(String), suggestedSubject: expect.any(String) }) })
    );
    // task #67: a held-not-sent decision is still a real AI decision —
    // Rule 3's risk gate — so it lands in the audit trail too, not just a
    // string in this run's own summary.
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.hold",
      expect.objectContaining({ targetId: "lead1", meta: expect.objectContaining({ riskLevel: "medium" }) })
    );
  });

  it("sends an Assisted lead only when risk is low", async () => {
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), { automated: true, trigger: "silence", subject: expect.any(String), channel: "email" });
  });

  it("fails closed: a risk check that throws holds the lead", async () => {
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    risk.mockRejectedValue(new Error("OpenAI down"));
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("Autonomous leads skip the gate (opt-in per lead, by design)", async () => {
    p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
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
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "high", reason: "quotes a price" });
    await runAutomationForBusiness("biz1");
    expect(p.lead.updateMany).toHaveBeenCalledWith({
      where: { id: "lead1", OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: expect.any(Date) } }] },
      data: { lastAutomationCheckedAt: expect.any(Date) },
    });
  });

  it("does nothing at all when the master switch is off", async () => {
    p.automation.findFirst.mockResolvedValue({ enabled: false, triggerDays: 5 });
    const r = await runAutomationForBusiness("biz1");
    expect(r.checked).toBe(0);
    expect(p.lead.findMany).not.toHaveBeenCalled();
  });

  // task #84 (second-pass audit): a manual "Run automation check now" click
  // racing the hourly cron, or two overlapping cron ticks, both see the
  // same lead as eligible from the plain SELECT above — only one of them
  // may actually win the atomic claim and act on it.
  describe("concurrent-run claim (task #84)", () => {
    it("skips a lead another concurrent run already claimed, instead of sending twice", async () => {
      p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
      p.lead.updateMany.mockResolvedValueOnce({ count: 0 }); // lost the race
      const r = await runAutomationForBusiness("biz1");
      expect(send).not.toHaveBeenCalled();
      expect(r.sent).toBe(0);
      expect(r.held).toBe(0);
      expect(r.skipped).toEqual([]); // claimed-away is not a failure
    });

    it("still sends when this run wins the claim", async () => {
      p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
      p.lead.updateMany.mockResolvedValueOnce({ count: 1 }); // won the race
      const r = await runAutomationForBusiness("biz1");
      expect(send).toHaveBeenCalledTimes(1);
      expect(r.sent).toBe(1);
    });
  });

  // task #86 (third-pass audit): this used to rely on sendFollowUpToLead()'s
  // own "email if the lead has one" default, which ignored what channel the
  // lead is actually engaging on.
  it("passes the lead's actual engaged channel explicitly, not sendFollowUpToLead's own default", async () => {
    p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
    replyChannel.mockResolvedValue("text"); // this lead only ever texted, despite having an email on file
    await runAutomationForBusiness("biz1");
    expect(replyChannel).toHaveBeenCalledWith(expect.objectContaining({ id: "lead1" }));
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "text" }));
  });
});

// research/product/2026-09-09-followup-cadence-best-practices.md §5,
// recommendation #5: an automated send eligible outside typical waking
// hours (a lead due at 3am local to the business) is deferred to the next
// hourly cron tick instead of firing immediately.
describe("send-window gate (src/lib/sendWindow.ts)", () => {
  it("defers instead of sending when outside the business's local send window, and releases the claim", async () => {
    sendWindow.mockReturnValue(false);
    p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
    const r = await runAutomationForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
    expect(r.held).toBe(0);
    expect(r.deferred).toBe(1);
    // Released, not left stamped — so the next hourly tick (not a 20h
    // recheckCutoff wait) reconsiders this lead once it's daytime.
    expect(p.lead.updateMany).toHaveBeenLastCalledWith({ where: { id: "lead1" }, data: { lastAutomationCheckedAt: null } });
  });

  it("never even attempts to draft or risk-check a deferred lead", async () => {
    sendWindow.mockReturnValue(false);
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    await runAutomationForBusiness("biz1");
    expect(risk).not.toHaveBeenCalled();
  });

  it("looks up the send window against the business's own configured timezone", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "Asia/Kolkata" });
    p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
    await runAutomationForBusiness("biz1");
    expect(sendWindow).toHaveBeenCalledWith(expect.any(Date), "Asia/Kolkata");
  });

  it("still sends normally once back inside the window", async () => {
    p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
    const r = await runAutomationForBusiness("biz1");
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.deferred).toBe(0);
  });
});
