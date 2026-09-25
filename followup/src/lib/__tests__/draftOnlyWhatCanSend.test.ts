/**
 * No draft for a channel that cannot send (daily-path bug hunt 2026-09-25, F5).
 *
 * The production shape: Gmail dies (Google expires a Testing app's refresh
 * token on day 7), Instagram is still stored. hasAnySendChannel says "yes,
 * something is connected", so:
 *   - the silence rule drafted, risk-checked, held and announced every email
 *     lead every ~20 hours, for a message sendEmail then refused;
 *   - a workflow step on a sending-enabled account drafted, risk-checked,
 *     failed at the send and wrote "couldn't send" on EVERY hourly tick —
 *     the claim lock is five minutes — up to ten rounds a lead a day.
 *
 * Both loops now ask canSendOn for the lead's own channel before any draft.
 * These tests run several passes, the way the cron does, and count what
 * was paid for and what the owner was told. canSendOn's own answers are
 * pinned in canSendOn.test.ts.
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
  assessSendRisk: vi.fn(async () => ({ riskLevel: "low" as const, reason: "" })),
}));
vi.mock("@/lib/sender", () => ({
  latestInboundText: vi.fn(() => undefined),
  composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => `Hi,\n\n${body}`),
}));
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: vi.fn(),
  detectAutomatedReplyChannel: vi.fn(async () => "email"),
  detectNonEmailChannel: vi.fn(async () => null),
  metaWindowFor: vi.fn(async () => ({ hoursSinceLead: 1 })),
}));
vi.mock("@/lib/sendChannels", () => ({ hasAnySendChannel: vi.fn(async () => true), canSendOn: vi.fn() }));
vi.mock("@/lib/billing", () => ({
  requireActiveBilling: vi.fn(async () => true),
  checkAiEligibility: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendWindow", () => ({ isWithinSendWindow: vi.fn(() => true) }));

import { prisma } from "@/lib/db";
import { generateFollowUpMessage, assessSendRisk } from "@/lib/integrations/openai";
import { sendFollowUpToLead, detectAutomatedReplyChannel, detectNonEmailChannel } from "@/lib/sending";
import { canSendOn } from "@/lib/sendChannels";
import { recordAudit } from "@/lib/audit";
import { runAutomationForBusiness } from "@/lib/automation";
import { runSequencesForBusiness } from "@/lib/sequences";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const draft = generateFollowUpMessage as unknown as ReturnType<typeof vi.fn>;
const risk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const replyChannel = detectAutomatedReplyChannel as unknown as ReturnType<typeof vi.fn>;
const nonEmailChannel = detectNonEmailChannel as unknown as ReturnType<typeof vi.fn>;
const canSend = canSendOn as unknown as ReturnType<typeof vi.fn>;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;

/** What the real send says on a business with no inbox (gmail.ts). */
const NO_GMAIL = { success: false, failure: "permanent", message: "No Gmail account is connected for this business." };

/** Gmail gone, everything else still stored. */
function onlyEmailIsDead() {
  canSend.mockImplementation(async (_businessId: string, channel: string) => channel !== "email");
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  p.automation.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) =>
    where.action === "auto_send" ? { enabled: true, triggerDays: 5 } : { enabled: true, triggerHours: 24 }
  );
  p.lead.findMany.mockResolvedValue([]);
  p.lead.update.mockResolvedValue({});
  p.lead.updateMany.mockResolvedValue({ count: 1 }); // every claim is won
  p.notification.create.mockResolvedValue({});
  p.user.findMany.mockResolvedValue([{ id: "admin1" }]);
  // A sending-enabled account: the one where a workflow step used to
  // retry every hour. (A holding account is covered separately below.)
  p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "plus", holdAllForApproval: false });
  draft.mockResolvedValue({ subject: "Checking in", body: "Just checking in on your question." });
  risk.mockResolvedValue({ riskLevel: "low", reason: "" });
  replyChannel.mockResolvedValue("email");
  nonEmailChannel.mockResolvedValue(null);
  send.mockImplementation(async (_leadId: string, _body: string, opts: { channel?: string }) =>
    opts.channel === "email" ? NO_GMAIL : { success: true }
  );
  onlyEmailIsDead();
});

// ---------------------------------------------------------------------------
// The silence rule (src/lib/automation.ts)
// ---------------------------------------------------------------------------

function emailLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Young Son",
    businessId: "biz1",
    assignedToId: "user1",
    email: "young@example.com",
    phone: null,
    automationTier: "ASSISTED",
    suggestedMessage: null as string | null,
    suggestedDraftedFor: null as Date | null,
    conversations: [
      {
        channel: "email",
        // A quiet lead — they asked, we answered, nothing since — so the
        // silence rule's first reminder is due (2026-09-25 cadence).
        messages: [
          { id: "m1", direction: "inbound", body: "Is the roof original?", sentAt: new Date(Date.now() - 6 * 86_400_000), opened: false },
          { id: "m2", direction: "outbound", body: "It is, yes.", sentAt: new Date(Date.now() - 5 * 86_400_000), opened: false },
        ],
      },
    ],
    followUps: [],
    ...overrides,
  };
}

/** One automation pass that finds `lead` in the silence query only. */
async function silencePass(lead: unknown) {
  p.lead.findMany.mockResolvedValueOnce([lead]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  return runAutomationForBusiness("biz1");
}

describe("the silence rule never drafts for a channel that cannot send", () => {
  it("writes nothing, checks nothing and tells nobody about an email lead once the inbox is gone — pass after pass", async () => {
    for (let pass = 0; pass < 3; pass++) {
      const r = await silencePass(emailLead());
      expect(r.held).toBe(0);
      expect(r.skipped).toEqual([expect.stringMatching(/nothing connected can send on email/)]);
    }
    expect(canSend).toHaveBeenCalledWith("biz1", "email");
    expect(draft).not.toHaveBeenCalled();
    expect(risk).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(p.notification.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalledWith(expect.anything(), "ai.hold", expect.anything());
    // No draft stored on the lead for Approvals to offer and then fail.
    expect(p.lead.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ suggestedMessage: expect.anything() }) }));
  });

  // Same exit as the closed Meta window: the claim is kept, so the lead is
  // looked at again on the normal ~20-hour cadence, not every hour.
  it("keeps the claim instead of releasing it for the next hourly tick", async () => {
    await silencePass(emailLead());
    expect(p.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { lastAutomationCheckedAt: expect.any(Date) } }));
    expect(p.lead.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { lastAutomationCheckedAt: null } }));
  });

  it("asks about the lead's own channel: an Instagram lead still drafts while only Gmail is dead", async () => {
    replyChannel.mockResolvedValue("instagram");
    const igLead = emailLead({
      email: null,
      phone: "ig:17841400000000001",
      conversations: [
        {
          channel: "instagram",
          messages: [{ id: "m1", direction: "inbound", body: "Still available?", sentAt: new Date(Date.now() - 4 * 3_600_000), opened: false }],
        },
      ],
    });
    // Reached through the unanswered rule: a DM lead is only ever inside
    // Meta's 24-hour window while their own message is the newest one, and
    // a quiet lead's first reminder is days away (2026-09-25 cadence). Same
    // per-lead channel check either way — that is what this pins.
    p.lead.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([igLead]);
    await runAutomationForBusiness("biz1");
    expect(canSend).toHaveBeenCalledWith("biz1", "instagram");
    expect(draft).toHaveBeenCalled();
  });

  // The counterpart: with the inbox connected nothing about the rule changes.
  it("drafts and sends exactly as before once the inbox is reconnected", async () => {
    canSend.mockResolvedValue(true);
    send.mockResolvedValue({ success: true });
    const r = await silencePass(emailLead());
    expect(draft).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "email" }));
    expect(r.sent).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A workflow step (src/lib/sequences.ts)
// ---------------------------------------------------------------------------

const emailStep = { id: "s1", order: 0, delayHours: 0, delayDays: 0, action: "EMAIL", messageHint: null, stageTo: null };

function enrolledEmailLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Young Son",
    businessId: "biz1",
    assignedToId: "user1",
    email: "young@example.com",
    phone: null,
    sequenceStepIndex: 0,
    sequenceStepScheduledAt: new Date(Date.now() - 2 * 86_400_000),
    sequence: { id: "seq1", name: "New lead cadence", active: true, steps: [emailStep] },
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "m1", direction: "inbound", body: "Is the roof original?", sentAt: new Date(Date.now() - 3 * 86_400_000), opened: false },
          { id: "m2", direction: "outbound", body: "It is, yes.", sentAt: new Date(Date.now() - 2.5 * 86_400_000), opened: false },
        ],
      },
    ],
    ...overrides,
  };
}

/**
 * The cron, hour after hour: the lead stays due for as long as it stays
 * enrolled, and drops out of the query the moment it is unenrolled —
 * which is what makes "was the owner told every hour?" answerable.
 */
async function hourlyTicks(lead: Record<string, unknown>, ticks: number) {
  let enrolled = true;
  p.lead.findMany.mockImplementation(async () => (enrolled ? [lead] : []));
  p.lead.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    if (data.sequenceId === null) enrolled = false;
    return {};
  });
  const results = [];
  for (let i = 0; i < ticks; i++) results.push(await runSequencesForBusiness("biz1"));
  return { results, stillEnrolled: () => enrolled };
}

describe("a workflow step never drafts for a channel that cannot send", () => {
  it("pays for no draft and no risk check, and writes no hourly 'couldn't send' — tick after tick", async () => {
    const { results, stillEnrolled } = await hourlyTicks(enrolledEmailLead(), 3);
    expect(canSend).toHaveBeenCalledWith("biz1", "email");
    expect(draft).not.toHaveBeenCalled();
    expect(risk).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(p.notification.create).not.toHaveBeenCalled();
    for (const r of results) {
      expect(r.advanced).toBe(0);
      expect(r.skipped).toEqual([expect.stringMatching(/nothing connected can send on email — step paused/)]);
    }
    // Paused, not stopped: reconnecting is the fix, and a Gmail token
    // expiring must not cancel every workflow on the account.
    expect(stillEnrolled()).toBe(true);
  });

  it("runs the same step on the first tick after the inbox is reconnected", async () => {
    const lead = enrolledEmailLead();
    const { stillEnrolled } = await hourlyTicks(lead, 1);
    expect(draft).not.toHaveBeenCalled();

    canSend.mockResolvedValue(true);
    send.mockResolvedValue({ success: true });
    const r = await runSequencesForBusiness("biz1");
    expect(draft).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "email" }));
    expect(r.completed).toBe(1);
    expect(stillEnrolled()).toBe(false); // finished, not stuck
  });

  // On a holding account the old path drafted once, held it and stopped
  // the workflow — putting a draft in Approvals that could not be sent.
  it("does not park an unsendable draft in Approvals on a holding account either", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "plus", holdAllForApproval: true });
    const { results, stillEnrolled } = await hourlyTicks(enrolledEmailLead(), 2);
    expect(draft).not.toHaveBeenCalled();
    expect(results.every((r) => r.held === 0)).toBe(true);
    expect(p.notification.create).not.toHaveBeenCalled();
    expect(stillEnrolled()).toBe(true);
  });

  it("checks the channel the step would really use: an escalation to text is judged on text", async () => {
    nonEmailChannel.mockResolvedValue("text");
    canSend.mockImplementation(async (_b: string, channel: string) => channel !== "text");
    await hourlyTicks(enrolledEmailLead({ email: null, phone: "+15551234567" }), 1);
    expect(canSend).toHaveBeenCalledWith("biz1", "text");
    expect(draft).not.toHaveBeenCalled();
  });

  it("leaves a step whose channel is connected exactly as it was", async () => {
    canSend.mockResolvedValue(true);
    send.mockResolvedValue({ success: true });
    const { results } = await hourlyTicks(enrolledEmailLead(), 1);
    expect(draft).toHaveBeenCalledTimes(1);
    expect(results[0].advanced).toBe(1);
  });
});
