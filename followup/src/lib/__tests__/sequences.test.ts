/**
 * Guarantee: a workflow stops the instant the lead replies — nothing is
 * sent on top of a live conversation, and the owner is told.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    notification: { create: vi.fn() },
    business: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: vi.fn(async () => ({ subject: "Following up", body: "draft" })),
  // Defaults to "safe to send" so every existing test's EMAIL step keeps
  // sending exactly as before; the dedicated describe block below
  // overrides this to exercise the hold path itself.
  assessSendRisk: vi.fn(async () => ({ riskLevel: "low" as const, reason: "" })),
}));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/sender", () => ({ latestInboundText: vi.fn(() => undefined), composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => body) }));
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: vi.fn(async () => ({ success: true })),
  // Defaults to "nothing to fall back to" so every existing test's EMAIL
  // step keeps sending by email exactly as before; the dedicated describe
  // block below overrides this to exercise the escalation itself.
  detectNonEmailChannel: vi.fn(async () => null),
}));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
// Real send-window logic has no place in a deterministic test — defaulted
// to "always within window" so every existing test's outcome depends only
// on what it actually sets up; sendWindow.test.ts covers the real logic.
vi.mock("@/lib/sendWindow", () => ({ isWithinSendWindow: vi.fn(() => true) }));

import { prisma } from "@/lib/db";
import { sendFollowUpToLead, detectNonEmailChannel } from "@/lib/sending";
import { composeFollowUpEmail } from "@/lib/sender";
import { generateFollowUpMessage, assessSendRisk } from "@/lib/integrations/openai";
import { recordAudit } from "@/lib/audit";
import { isWithinSendWindow } from "@/lib/sendWindow";
import { runSequencesForBusiness } from "@/lib/sequences";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const sendWindow = isWithinSendWindow as unknown as ReturnType<typeof vi.fn>;
const nonEmailChannel = detectNonEmailChannel as unknown as ReturnType<typeof vi.fn>;
const composeEmail = composeFollowUpEmail as unknown as ReturnType<typeof vi.fn>;
const draftMessage = generateFollowUpMessage as unknown as ReturnType<typeof vi.fn>;
const sendRisk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;

const step = { id: "s1", order: 0, delayDays: 0, action: "SEND_EMAIL", messageHint: null, stageTo: null as string | null };
function enrolled(lastDirection: "inbound" | "outbound") {
  return {
    id: "lead1",
    name: "Young Son",
    businessId: "biz1",
    assignedToId: "user1",
    email: "young@example.com",
    sequenceStepIndex: 0,
    sequence: { id: "seq1", name: "New lead cadence", active: true, steps: [step] },
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "m1", direction: "outbound", body: "Hi", sentAt: new Date(Date.now() - 2 * 86400_000), opened: false },
          { id: "m2", direction: lastDirection, body: "Reply", sentAt: new Date(Date.now() - 60_000), opened: false },
        ],
      },
    ],
  };
}

beforeEach(() => {
  p.lead.update.mockResolvedValue({});
  p.lead.updateMany.mockResolvedValue({ count: 1 }); // claim succeeds by default
  p.notification.create.mockResolvedValue({});
  p.business.findUnique.mockResolvedValue({ timezone: "America/New_York" });
  p.user.findMany.mockResolvedValue([{ id: "admin1" }]);
  sendWindow.mockReturnValue(true);
  nonEmailChannel.mockResolvedValue(null);
  sendRisk.mockResolvedValue({ riskLevel: "low", reason: "" });
});

describe("workflow stop-on-reply", () => {
  it("unenrolls the lead and notifies the owner when the last message is from the lead", async () => {
    p.lead.findMany.mockResolvedValue([enrolled("inbound")]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(p.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null },
    });
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user1", leadId: "lead1" }) })
    );
  });

  it("does not stop when the last message was ours (no reply yet)", async () => {
    p.lead.findMany.mockResolvedValue([enrolled("outbound")]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(0);
  });

  it("never runs an inactive workflow", async () => {
    const l = enrolled("outbound");
    l.sequence.active = false;
    p.lead.findMany.mockResolvedValue([l]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.checked).toBe(1);
  });
});

// task #84 (second-pass audit): a manual "run now" click racing the hourly
// cron, or two overlapping cron ticks, both see the same due lead from the
// plain SELECT above — only the run that wins the atomic claim may act.
describe("concurrent-run claim (task #84)", () => {
  function enrolledOnEmailStep() {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "EMAIL" }] };
    return l;
  }

  it("skips a lead another concurrent run already claimed, instead of sending its step twice", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    p.lead.updateMany.mockResolvedValueOnce({ count: 0 }); // lost the race
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.advanced).toBe(0);
    expect(r.skipped).toEqual([]); // claimed-away is not a failure
  });

  it("still advances the step when this run wins the claim", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    p.lead.updateMany.mockResolvedValueOnce({ count: 1 }); // won the race
    await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

// task #86 (third-pass audit): an "EMAIL" step is an explicit, understood
// choice in the workflow builder — it must never silently fall through to
// texting/DMing a lead on top of an active email conversation.
describe("EMAIL step channel handling (task #86)", () => {
  function enrolledOnEmailStep(overrides: Record<string, unknown> = {}) {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "EMAIL" }] };
    return { ...l, ...overrides };
  }

  it("always passes channel: email explicitly for an EMAIL step", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "email" }));
  });

  it("skips (does not send anything) for a lead with neither an email nor a phone number", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ email: null })]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.advanced).toBe(0);
    expect(r.skipped).toEqual([expect.stringMatching(/no email or phone number on file/)]);
  });
});

// research/product/2026-09-09-followup-cadence-best-practices.md §4,
// recommendation #4: an EMAIL step escalates to whatever non-email
// channel the lead is actually reachable on instead of skipping a
// no-email lead outright, or repeating an email that isn't landing.
describe("channel-switching within a workflow (research rec #4)", () => {
  function enrolledOnStep(stepIndex: number, overrides: Record<string, unknown> = {}) {
    const l = enrolled("outbound");
    l.sequenceStepIndex = stepIndex;
    l.sequence = {
      ...l.sequence,
      steps: [
        { ...step, order: 0, action: "EMAIL" },
        { ...step, order: 1, action: "EMAIL" },
      ],
    };
    return { ...l, ...overrides };
  }

  it("falls back to text instead of skipping when the lead has no email but does have a phone", async () => {
    nonEmailChannel.mockResolvedValue("text");
    p.lead.findMany.mockResolvedValue([enrolledOnStep(0, { email: null, phone: "+15551234567" })]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "text", subject: undefined }));
    expect(r.advanced).toBe(1);
  });

  it("never even asks for a fallback channel on the first EMAIL step of a lead that has an email", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnStep(0, { phone: "+15551234567" })]);
    await runSequencesForBusiness("biz1");
    expect(nonEmailChannel).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "email" }));
  });

  it("escalates to the lead's non-email channel on a later step, once an earlier EMAIL step already ran", async () => {
    nonEmailChannel.mockResolvedValue("whatsapp");
    // Still has an email — escalation isn't about the lead lacking one,
    // it's that step 0 already tried it and (per the stop-on-reply gate
    // above) got no reply since.
    p.lead.findMany.mockResolvedValue([enrolledOnStep(1, { phone: "+15551234567" })]);
    const r = await runSequencesForBusiness("biz1");
    expect(nonEmailChannel).toHaveBeenCalledWith(expect.objectContaining({ id: "lead1" }));
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "whatsapp", subject: undefined }));
    expect(r.advanced).toBe(1);
  });

  it("stays on email for a later step when the lead has no phone to escalate to", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnStep(1)]); // email only, no phone at all
    await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "email" }));
  });

  it("skips composeFollowUpEmail's greeting/sign-off wrapper when escalating off email", async () => {
    nonEmailChannel.mockResolvedValue("text");
    p.lead.findMany.mockResolvedValue([enrolledOnStep(1, { phone: "+15551234567" })]);
    await runSequencesForBusiness("biz1");
    expect(composeEmail).not.toHaveBeenCalled();
  });

  it("tells the AI it's drafting a text, not an email, when escalating", async () => {
    nonEmailChannel.mockResolvedValue("text");
    p.lead.findMany.mockResolvedValue([enrolledOnStep(1, { phone: "+15551234567" })]);
    await runSequencesForBusiness("biz1");
    expect(draftMessage).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining("text message"));
  });
});

// research/product/2026-09-09-followup-cadence-best-practices.md §5,
// recommendation #5: an EMAIL step due outside the business's local send
// window (e.g. 3am) is deferred to the next hourly cron tick instead of
// firing immediately. CHANGE_STAGE steps never contact the lead, so they
// always run on schedule regardless of the hour.
describe("send-window gate (src/lib/sendWindow.ts)", () => {
  function enrolledOnEmailStep(overrides: Record<string, unknown> = {}) {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "EMAIL" }] };
    return { ...l, ...overrides };
  }

  function enrolledOnStageStep() {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "CHANGE_STAGE", stageTo: "QUALIFIED" }] };
    return l;
  }

  it("defers an EMAIL step instead of sending when outside the send window", async () => {
    sendWindow.mockReturnValue(false);
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.advanced).toBe(0);
    expect(r.deferred).toBe(1);
  });

  it("never attempts to draft when deferring", async () => {
    sendWindow.mockReturnValue(false);
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
  });

  it("does not gate a CHANGE_STAGE step on the send window — it never contacts the lead", async () => {
    sendWindow.mockReturnValue(false);
    p.lead.findMany.mockResolvedValue([enrolledOnStageStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.advanced).toBe(1);
    expect(r.deferred).toBe(0);
    expect(p.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ stage: "QUALIFIED" }) }));
  });

  it("looks up the send window against the business's own configured timezone", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "Asia/Kolkata" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(sendWindow).toHaveBeenCalledWith(expect.any(Date), "Asia/Kolkata");
  });

  it("still sends normally once back inside the window", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.deferred).toBe(0);
  });
});

// Every other automated-send path (automation.ts's silence rule,
// acknowledge.ts's instant ack) gates its draft on a risk check before
// sending unreviewed; this workflow path didn't — a real gap found
// auditing this file, since a workflow step drafts fresh, real AI content
// per lead just like those other paths do.
describe("risk-gated hold (a workflow step's draft isn't automatically safe)", () => {
  function enrolledOnEmailStep(overrides: Record<string, unknown> = {}) {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "EMAIL" }] };
    return { ...l, ...overrides };
  }

  it("holds instead of sending when the risk check comes back anything but low", async () => {
    sendRisk.mockResolvedValue({ riskLevel: "high", reason: "Mentions a specific discount." });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.held).toBe(1);
    expect(r.heldReasons).toEqual(["Young Son: Mentions a specific discount."]);
    expect(r.advanced).toBe(0);
  });

  it("unenrolls the lead and saves the draft for manual approval on a hold", async () => {
    sendRisk.mockResolvedValue({ riskLevel: "medium", reason: "Touches pricing." });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(p.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: {
        sequenceId: null,
        sequenceStepIndex: 0,
        sequenceStepDueAt: null,
        suggestedMessage: "draft",
        suggestedSubject: "Following up",
      },
    });
  });

  it("records an ai.hold audit event and notifies the assigned person", async () => {
    sendRisk.mockResolvedValue({ riskLevel: "high", reason: "Sounds like a promise." });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(audit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: null },
      "ai.hold",
      expect.objectContaining({
        targetType: "lead",
        targetId: "lead1",
        meta: expect.objectContaining({ riskLevel: "high", trigger: "sequence", sequenceName: "New lead cadence" }),
      })
    );
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user1", leadId: "lead1" }) })
    );
  });

  it("notifies every admin instead when the lead is unassigned", async () => {
    sendRisk.mockResolvedValue({ riskLevel: "high", reason: "risky" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ assignedToId: null })]);
    await runSequencesForBusiness("biz1");
    expect(p.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "biz1", role: "ADMIN" } }));
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "admin1", leadId: "lead1" }) })
    );
  });

  it("holds when the risk check itself throws, rather than guessing it's safe", async () => {
    sendRisk.mockRejectedValue(new Error("OpenAI is down"));
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.held).toBe(1);
  });

  it("still sends normally when the risk check comes back low, exactly as before", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.held).toBe(0);
    expect(r.advanced).toBe(1);
  });
});
