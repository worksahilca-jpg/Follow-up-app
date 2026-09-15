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
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: vi.fn(async () => ({ subject: "Checking in", body: "Just checking in on your question." })),
  assessSendRisk: vi.fn(),
}));
vi.mock("@/lib/sender", () => ({ latestInboundText: vi.fn(() => undefined), composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => `Hi,\n\n${body}`) }));
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: vi.fn(async () => ({ success: true })),
  // task #86: automation.ts now passes this explicitly instead of relying
  // on sendFollowUpToLead()'s own email-if-present default.
  detectAutomatedReplyChannel: vi.fn(async () => "email"),
}));
vi.mock("@/lib/billing", () => ({
  requireActiveBilling: vi.fn(async () => true),
  // One gate now, for every tier — not two Free-only helpers. Plus's
  // 1,500/mo and Pro's 10,000/mo were published and unenforced until
  // 2026-09-15, so a paid account had no AI ceiling at all.
  checkAiEligibility: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
// Real send-window logic (real time-of-day, real Intl calls) has no place
// in a deterministic test — defaulted to "always within window" here so
// every existing test's outcome depends only on what it actually sets up;
// the dedicated describe block below overrides this to false to exercise
// the deferral path itself.
vi.mock("@/lib/sendWindow", () => ({ isWithinSendWindow: vi.fn(() => true) }));

import { prisma } from "@/lib/db";
import { assessSendRisk, generateFollowUpMessage } from "@/lib/integrations/openai";
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { recordAudit } from "@/lib/audit";
import { isWithinSendWindow } from "@/lib/sendWindow";
import { checkAiEligibility } from "@/lib/billing";
import { runAutomationForBusiness, DEAD_LEAD_ACTION } from "@/lib/automation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const risk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;
const replyChannel = detectAutomatedReplyChannel as unknown as ReturnType<typeof vi.fn>;
const sendWindow = isWithinSendWindow as unknown as ReturnType<typeof vi.fn>;
const draftMessage = generateFollowUpMessage as unknown as ReturnType<typeof vi.fn>;
const aiEligible = checkAiEligibility as unknown as ReturnType<typeof vi.fn>;

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Young Son",
    businessId: "biz1",
    automationTier: "ASSISTED",
    suggestedMessage: null as string | null,
    // The newest message the cached draft was written against. Null =
    // provenance unknown = treated as stale, which is what a row from
    // before this column looks like.
    suggestedDraftedFor: null as Date | null,
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
  p.user.findMany.mockResolvedValue([{ id: "admin1" }]);
  send.mockResolvedValue({ success: true });
  replyChannel.mockResolvedValue("email");
  sendWindow.mockReturnValue(true);
  aiEligible.mockResolvedValue({ ok: true });
});

function unansweredLead(
  hoursAgo: number,
  lastDirection: "inbound" | "outbound" = "inbound",
  overrides: Record<string, unknown> = {}
) {
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
    ...overrides,
  });
}

describe("human-neglect trigger (lead wrote, nobody answered)", () => {
  // Promise.all fires the three lead.findMany calls in a fixed order:
  // the silence query, then the dead-lead-reactivation query (on by
  // default — see DEAD_LEAD_ACTION), then findUnansweredLeads's own
  // query. Every test in this block cares only about the third.
  it("picks up a lead whose last message is inbound and older than the window, and tells the owner when held", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(30)]);
    risk.mockResolvedValue({ riskLevel: "medium", reason: "answers a factual question" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(1);
    expect(r.held).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadId: "lead2", message: expect.stringMatching(/hasn't heard back/) }) })
    );
  });

  // research/product/2026-09-10-ux-simplification.md §0.6: a held draft on
  // an unassigned/pond lead used to notify nobody at all (notifyNeglect
  // just returned early). It now falls back to every admin on the
  // business — the common case is one solo owner, who is that admin.
  it("notifies every admin on the business, not nobody, when the neglected lead is unassigned", async () => {
    p.lead.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unansweredLead(30, "inbound", { assignedToId: null })]);
    risk.mockResolvedValue({ riskLevel: "medium", reason: "answers a factual question" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(p.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: "biz1", role: "ADMIN" } })
    );
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "admin1", leadId: "lead2" }) })
    );
  });

  it("notifies nobody (no admin found) without throwing, when a business somehow has none", async () => {
    p.user.findMany.mockResolvedValue([]);
    p.lead.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unansweredLead(30, "inbound", { assignedToId: null })]);
    risk.mockResolvedValue({ riskLevel: "medium", reason: "answers a factual question" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.held).toBe(1);
    expect(p.notification.create).not.toHaveBeenCalled();
  });

  // Live-test finding (task #63): a cached suggestedMessage can predate the
  // lead's actual most recent inbound message — this lead already has a
  // stale draft sitting from an earlier scoring pass, before its most
  // recent message came in. Reusing that draft verbatim is exactly what
  // shipped a real English reply to a lead whose latest message was in a
  // different language.
  /**
   * The redraft loop, and why it was the most expensive thing in the app.
   *
   * A lead held for approval sends nothing, so lastContacted never moves,
   * so it re-enters the automation window every 20 hours — forever. Until
   * suggestedDraftedFor existed, each of those passes paid for a fresh
   * draft, a fresh localization and a fresh risk check on a conversation
   * that had not changed by a single byte: $0.026/lead/month with no end,
   * the only cost in the product that grew with time rather than with
   * leads (research/product/2026-09-15-ai-cost-per-lead.md §5). Cold leads
   * are held by design, so there was always a standing population of them.
   *
   * The two tests below are the whole fix: same conversation, no redraft;
   * new message, redraft. Removing the stamp check makes the first fail.
   */
  it("does not pay to redraft when nothing has changed since the draft", async () => {
    const l = unansweredLead(30, "inbound", {
      suggestedMessage: "A draft written against this exact conversation",
      suggestedSubject: "Freehold?",
    });
    // Stamped with the conversation's newest message — i.e. current.
    const newest = l.conversations[0].messages[1].sentAt;
    l.suggestedDraftedFor = newest;
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([l]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });

    const r = await runAutomationForBusiness("biz1");
    expect(draftMessage).not.toHaveBeenCalled();
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith(
      "lead2",
      "A draft written against this exact conversation",
      expect.objectContaining({ trigger: "unanswered" })
    );
  });

  // The task #63 guarantee, unchanged: a lead who wrote again — possibly
  // in another language — has a message newer than the stamp, so the
  // cached draft is stale and IS rebuilt. That is the reason the
  // unconditional redraft existed, and it still holds.
  it("still redrafts when the lead has written since the draft was made", async () => {
    const l = unansweredLead(30, "inbound", {
      suggestedMessage: "A stale draft from before the lead's latest message",
    });
    // Stamped an hour BEFORE the newest message — i.e. stale.
    l.suggestedDraftedFor = new Date(l.conversations[0].messages[1].sentAt.getTime() - 3_600_000);
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([l]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });

    const r = await runAutomationForBusiness("biz1");
    expect(draftMessage).toHaveBeenCalled();
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith(
      "lead2",
      expect.not.stringContaining("A stale draft from before the lead's latest message"),
      expect.objectContaining({ trigger: "unanswered" })
    );
  });

  // A draft from before the column existed has no provenance, so it is
  // treated as stale and rebuilt once. That is what makes the deploy
  // self-healing rather than trusting drafts nobody can date.
  it("always drafts fresh for an unanswered lead, even when a stale draft is already cached", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([
      unansweredLead(30, "inbound", { suggestedMessage: "A stale draft from before the lead's latest message" }),
    ]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(draftMessage).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      "lead2",
      expect.not.stringContaining("A stale draft from before the lead's latest message"),
      expect.objectContaining({ trigger: "unanswered" })
    );
  });

  it("tells the owner when it replied for them", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(30)]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ message: expect.stringMatching(/replied for you/) }) })
    );
  });

  it("never treats a lead as neglected once anyone has replied (last message outbound)", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(30, "outbound")]);
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(0);
    expect(r.checked).toBe(0);
  });

  it("waits the full window: an inbound newer than the window is not neglected yet", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(2)]);
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
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([firstReplyLead(4, "instant_ack")]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(1);
  });

  it("applies the same short window when there's no outbound message at all yet, not just an instant-ack one", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([firstReplyLead(4)]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(1);
  });

  it("still waits out the short window for a first-message lead — 1 hour isn't enough", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([firstReplyLead(1, "instant_ack")]);
    const r = await runAutomationForBusiness("biz1");
    expect(r.unanswered).toBe(0);
  });

  it("does NOT shorten the window once a real (non-instant-ack) reply has gone out", async () => {
    // Same 4-hour staleness as the picked-up case above, but the prior
    // outbound message is a real reply (no special trigger) rather than
    // the instant-ack template — this is unansweredLead's own shape, and
    // it must still respect the full 24h default, not the 3h one.
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(4)]);
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

// research/market/2026-09-11-tier-pricing-recommendation.md §2.2: Free
// tier's AI-processing pause (@/lib/billing) has to apply here too, not
// just at initial capture — otherwise a lead scoring.ts never scored would
// still get drafted (or worse, auto-sent) the moment it went silent.
describe("Free tier AI-processing pause", () => {
  it("skips a Free-tier lead past the monthly lead cap, without drafting or risk-checking it", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "past this month's 20-lead AI cap on the Free plan" });
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    const r = await runAutomationForBusiness("biz1");
    expect(draftMessage).not.toHaveBeenCalled();
    expect(risk).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
    expect(r.held).toBe(0);
    expect(r.skipped[0]).toMatch(/Free plan/);
  });

  it("skips a Free-tier lead whose channel isn't included in Free, even if it's within the lead cap", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "on a channel the Free plan doesn't cover" });
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    const r = await runAutomationForBusiness("biz1");
    expect(draftMessage).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(r.skipped[0]).toMatch(/Free plan/);
  });

  it("still processes a Free-tier lead that's within cap and on an eligible channel, same as any other tier", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.sent).toBe(1);
  });

  it("forces the risk check even for a lead stuck on AUTONOMOUS from before a downgrade to Free", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(risk).toHaveBeenCalled();
    expect(r.sent).toBe(1);
  });

  // Was the opposite assertion until 2026-09-15: the gate ran for Free
  // only, which is precisely what left the paid tiers unbounded. A Plus
  // account is checked against Plus's own ceiling, not Free's, so this
  // costs a normal customer nothing.
  it("checks the paid tiers too, against their own ceiling", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "pro" });
    p.lead.findMany.mockResolvedValueOnce([lead({ automationTier: "AUTONOMOUS" })]).mockResolvedValueOnce([]);
    await runAutomationForBusiness("biz1");
    expect(aiEligible).toHaveBeenCalledWith("biz1", expect.anything(), "pro");
  });

  it("skips a paid lead once its tier's ceiling trips, without drafting it", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "plus" });
    aiEligible.mockResolvedValue({ ok: false, reason: "something may be wrong" });
    p.lead.findMany.mockResolvedValueOnce([lead()]).mockResolvedValueOnce([]);
    const r = await runAutomationForBusiness("biz1");
    expect(draftMessage).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
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

// research/product/2026-09-09-followup-cadence-best-practices.md §3: a lead
// gone genuinely cold (45+ days by default) gets a distinct reactivation
// campaign — its own AI-prompt framing and its own `trigger` value — rather
// than a longer version of the same silence trigger.
describe("dead-lead reactivation (DEAD_LEAD_ACTION)", () => {
  function coldLead(daysAgo: number, overrides: Record<string, unknown> = {}) {
    return lead({
      id: "lead4",
      name: "Marcus",
      suggestedMessage: "A stale cached draft from before this lead went cold",
      suggestedSubject: "Old subject",
      lastContacted: new Date(Date.now() - daysAgo * 86_400_000),
      createdAt: new Date(Date.now() - daysAgo * 86_400_000),
      ...overrides,
    });
  }

  it("always drafts fresh instead of reusing a cached suggestedMessage", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([coldLead(60)]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.reactivated).toBe(1);
    expect(r.checked).toBe(1);
    expect(draftMessage).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Marcus" }),
      [],
      expect.stringContaining("gone genuinely cold")
    );
  });

  /**
   * The guarantee this block exists for, added 2026-09-15 on the founder's
   * call after a trust audit.
   *
   * Reactivation is the one automation that reaches BACKWARDS — it messages
   * someone who went quiet 45+ days ago. On a business's first sync that
   * means the imported back catalogue, up to six months of threads, all
   * eligible at once, all going out in the owner's name. A "low risk"
   * verdict is a judgement about one message's wording; it says nothing
   * about whether the owner wanted last spring contacted on their behalf.
   *
   * So a cold lead is offered, never assumed: drafted, held, and put in the
   * approval queue with its reason. If this test ever goes red because
   * something started auto-sending reactivations again, that is the
   * regression, not the test.
   */
  it("never auto-sends a reactivation, even when the risk classifier says low", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([coldLead(60)]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");

    expect(send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
    expect(r.held).toBe(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.hold",
      expect.objectContaining({ meta: expect.objectContaining({ trigger: DEAD_LEAD_ACTION }) })
    );
  });

  it("gives a low-risk reactivation hold a real reason instead of an empty one", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([coldLead(60)]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");

    // The approval card renders "Held because {reason}" — an empty reason
    // ships "Held because ." to the owner on the one screen whose whole job
    // is explaining why FollowUp stopped and asked.
    expect(r.heldReasons[0]).toContain("went quiet");
    expect(r.heldReasons[0]).toContain("60 days ago");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.hold",
      expect.objectContaining({ meta: expect.objectContaining({ reason: expect.stringContaining("went quiet") }) })
    );
  });

  it("still lets a lead the owner explicitly set to AUTONOMOUS send without review", async () => {
    // The per-lead opt-in is a deliberate act by the owner, so it outranks
    // the batch default — otherwise "autonomous" would silently stop
    // meaning autonomous for exactly the leads it was turned on for.
    p.lead.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([coldLead(60, { automationTier: "AUTONOMOUS" })])
      .mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");

    expect(send).toHaveBeenCalledWith("lead4", expect.any(String), expect.objectContaining({ trigger: DEAD_LEAD_ACTION }));
    expect(r.sent).toBe(1);
  });

  it("overwrites the stale cached draft (not just skips redrafting) when held for approval", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([coldLead(60)]).mockResolvedValueOnce([]);
    risk.mockResolvedValue({ riskLevel: "medium", reason: "mentions a price" });
    await runAutomationForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = p.lead.update.mock.calls.find((c: any) => c[0].where.id === "lead4");
    expect(call).toBeDefined();
    expect(call[0].data.suggestedMessage).not.toBe("A stale cached draft from before this lead went cold");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.hold",
      expect.objectContaining({ meta: expect.objectContaining({ trigger: DEAD_LEAD_ACTION }) })
    );
  });

  it("gives the human-neglect framing priority over reactivation for a lead that qualifies as both", async () => {
    const both = coldLead(60, {
      id: "lead5",
      assignedToId: "user1",
      conversations: [
        {
          channel: "email",
          messages: [{ id: "z", direction: "inbound", body: "Still interested?", sentAt: new Date(Date.now() - 60 * 86_400_000), opened: false }],
        },
      ],
    });
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([both]).mockResolvedValueOnce([both]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });
    const r = await runAutomationForBusiness("biz1");
    expect(r.checked).toBe(1); // counted once — never a double-send
    expect(r.unanswered).toBe(1);
    expect(r.reactivated).toBe(0); // the more urgent framing won, not reactivation
    // The framing is now observable on the hold, not on a send — this lead
    // is 60 days cold, so it waits for a human either way (see the test
    // directly below). This assertion used to read `expect(send)
    // .toHaveBeenCalledWith(... trigger: "unanswered")`, which quietly
    // encoded the bug that test documents as correct behaviour.
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.hold",
      expect.objectContaining({ meta: expect.objectContaining({ trigger: "unanswered" }) })
    );
  });

  /**
   * The hole the framing merge opened, and the reason it was invisible.
   *
   * `deadIds` deliberately subtracts the unanswered set so a lead that is
   * both cold AND unanswered gets the better wording and only one message.
   * But `isDeadLead` was ALSO what the mandatory human hold keyed on — so
   * choosing the kinder framing switched the approval requirement off, and
   * a low-risk verdict sent the message.
   *
   * The lead this let through is the worst one to get wrong: someone who
   * wrote in, was never answered, and has been waiting 45+ days. On a
   * business's first sync the imported back catalogue is full of exactly
   * that shape, so it fired within the first hourly tick after signup —
   * and src/lib/reactivation.ts classifies that same population as
   * COLD_UNANSWERED and refuses to bulk-message them at all.
   *
   * If this test ever goes red, a cold lead is being auto-sent to again.
   */
  it("holds a cold lead that is ALSO unanswered, instead of auto-sending on a low-risk verdict", async () => {
    const coldAndUnanswered = coldLead(60, {
      id: "lead6",
      name: "Priya Raman",
      assignedToId: "user1",
      conversations: [
        {
          channel: "email",
          messages: [
            {
              id: "z",
              direction: "inbound",
              body: "Are you still taking bookings for the spring?",
              sentAt: new Date(Date.now() - 60 * 86_400_000),
              opened: false,
            },
          ],
        },
      ],
    });
    // Present in BOTH buckets — which is exactly what makes isDeadLead
    // false for it, since deadIds subtracts the unanswered set.
    p.lead.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([coldAndUnanswered])
      .mockResolvedValueOnce([coldAndUnanswered]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });

    const r = await runAutomationForBusiness("biz1");

    expect(send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
    expect(r.held).toBe(1);

    // And the owner is actually told, on the neglect path.
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: "lead6", message: expect.stringMatching(/waiting for your approval/) }),
      })
    );
  });

  // A lead who WROTE and never got an answer is a different fact about the
  // business than one who simply drifted away, and the approval card must
  // not describe it as the latter. It also must not be the empty string —
  // risk.reason is "" on a low verdict, which renders "Held because .".
  it("explains a cold-and-unanswered hold as never having been answered, not as having gone quiet", async () => {
    const coldAndUnanswered = coldLead(60, {
      id: "lead6",
      name: "Priya Raman",
      assignedToId: "user1",
      conversations: [
        {
          channel: "email",
          messages: [
            { id: "z", direction: "inbound", body: "Are you still taking bookings?", sentAt: new Date(Date.now() - 60 * 86_400_000), opened: false },
          ],
        },
      ],
    });
    p.lead.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([coldAndUnanswered])
      .mockResolvedValueOnce([coldAndUnanswered]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });

    const r = await runAutomationForBusiness("biz1");

    expect(r.heldReasons[0]).toContain("Priya");
    expect(r.heldReasons[0]).toContain("never got an answer");
    expect(r.heldReasons[0]).not.toContain("went quiet");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.hold",
      expect.objectContaining({ meta: expect.objectContaining({ reason: expect.stringContaining("never got an answer") }) })
    );
  });

  // The per-lead opt-in still outranks the batch default on this path too,
  // exactly as it does for a plain cold lead — otherwise "autonomous"
  // would silently stop meaning autonomous for the leads it was set on.
  it("still lets an AUTONOMOUS cold-and-unanswered lead send without review", async () => {
    const both = coldLead(60, {
      id: "lead7",
      automationTier: "AUTONOMOUS",
      assignedToId: "user1",
      conversations: [
        {
          channel: "email",
          messages: [
            { id: "z", direction: "inbound", body: "Still interested?", sentAt: new Date(Date.now() - 60 * 86_400_000), opened: false },
          ],
        },
      ],
    });
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([both]).mockResolvedValueOnce([both]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });

    const r = await runAutomationForBusiness("biz1");

    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith("lead7", expect.any(String), expect.objectContaining({ trigger: "unanswered" }));
  });

  // The counterpart: an unanswered lead that is NOT cold is the ordinary
  // human-neglect case and must keep auto-sending on a low-risk verdict.
  // Widening the hold to every unanswered lead would break the product's
  // main promise, so this pins the boundary at the dead-lead threshold.
  it("still auto-sends a recent unanswered lead that is not cold", async () => {
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([unansweredLead(30)]);
    risk.mockResolvedValue({ riskLevel: "low", reason: "" });

    const r = await runAutomationForBusiness("biz1");

    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith("lead2", expect.any(String), expect.objectContaining({ trigger: "unanswered" }));
  });

  it("never queries for dead leads at all when the rule is turned off", async () => {
    p.automation.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "auto_send"
        ? { enabled: true, triggerDays: 5 }
        : where.action === DEAD_LEAD_ACTION
          ? { enabled: false, triggerDays: 45 }
          : { enabled: true, triggerHours: 24 }
    );
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // silent, then unanswered — no third call
    const r = await runAutomationForBusiness("biz1");
    expect(r.reactivated).toBe(0);
    expect(p.lead.findMany).toHaveBeenCalledTimes(2);
  });

  it("respects a business-configured dead-lead day threshold instead of the 45-day default", async () => {
    p.automation.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "auto_send"
        ? { enabled: true, triggerDays: 5 }
        : where.action === DEAD_LEAD_ACTION
          ? { enabled: true, triggerDays: 90 }
          : { enabled: true, triggerHours: 24 }
    );
    p.lead.findMany.mockResolvedValue([]);
    await runAutomationForBusiness("biz1");
    const deadLeadsCall = p.lead.findMany.mock.calls[1][0];
    const cutoff = deadLeadsCall.where.lastContacted.lte as Date;
    const daysAgo = Math.round((Date.now() - cutoff.getTime()) / 86_400_000);
    expect(daysAgo).toBe(90);
  });
});
