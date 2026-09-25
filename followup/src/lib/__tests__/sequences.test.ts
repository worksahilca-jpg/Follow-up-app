/**
 * Guarantee: a workflow stops the instant the lead replies — nothing is
 * sent on top of a live conversation, and the owner is told.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    sequence: { findUnique: vi.fn(), create: vi.fn() },
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
// Every business in these tests has something connected — the
// "nothing connected, no drafting" gate (src/lib/sendChannels.ts) is
// pinned in its own file.
vi.mock("@/lib/sendChannels", () => ({ hasAnySendChannel: vi.fn(async () => true) }));
vi.mock("@/lib/billing", () => ({
  requireActiveBilling: vi.fn(async () => true),
  // Defaults to "always eligible" so every existing test (all of which run
  // on a "plus"-tier business per the p.business.findUnique default below)
  // is unaffected — the dedicated free-tier describe blocks override these.
  // One gate for every tier since 2026-09-15, not two Free-only helpers.
  checkAiEligibility: vi.fn(async () => ({ ok: true })),
}));
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
import { checkAiEligibility } from "@/lib/billing";
import { runSequencesForBusiness, enrollLead, createSequence, stepDelayHours, MAX_STEP_DELAY_HOURS } from "@/lib/sequences";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const sendWindow = isWithinSendWindow as unknown as ReturnType<typeof vi.fn>;
const nonEmailChannel = detectNonEmailChannel as unknown as ReturnType<typeof vi.fn>;
const composeEmail = composeFollowUpEmail as unknown as ReturnType<typeof vi.fn>;
const draftMessage = generateFollowUpMessage as unknown as ReturnType<typeof vi.fn>;
const sendRisk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;
const aiEligible = checkAiEligibility as unknown as ReturnType<typeof vi.fn>;

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
  aiEligible.mockResolvedValue({ ok: true });
});

describe("workflow stop-on-reply", () => {
  it("unenrolls the lead and notifies the owner when the last message is from the lead", async () => {
    p.lead.findMany.mockResolvedValue([enrolled("inbound")]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(p.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
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

  // A no-channel lead used to just return "skipped" and stay enrolled,
  // so the exact same check re-ran (and re-notified nobody) every single
  // hourly cron tick forever. It must now unenroll and tell a human once,
  // the same as every other dead-end this function has (reply, hold).
  it("unenrolls a no-channel lead instead of leaving it to retry forever", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ email: null })]);
    await runSequencesForBusiness("biz1");
    expect(p.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
    });
  });

  it("notifies the assigned person when a lead has no reachable channel", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ email: null })]);
    await runSequencesForBusiness("biz1");
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user1", leadId: "lead1" }) })
    );
  });
});

// A skip used to fail completely silently — no notification of any kind,
// so a persistently-failing send (e.g. bad credentials) retried hourly
// forever, at real OpenAI cost each time, with nobody ever told.
describe("send-failure notification", () => {
  function enrolledOnEmailStep(overrides: Record<string, unknown> = {}) {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "EMAIL" }] };
    return { ...l, ...overrides };
  }

  it("notifies a human when the send itself fails, without unenrolling the lead", async () => {
    send.mockResolvedValueOnce({ success: false, message: "Twilio rejected the number" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.skipped).toEqual([expect.stringMatching(/Twilio rejected the number/)]);
    expect(p.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user1", leadId: "lead1", message: expect.stringMatching(/Twilio rejected the number/) }) })
    );
    // Left enrolled, unlike the no-channel case — a failed send attempt
    // is plausibly transient and worth retrying, not a dead end.
    expect(p.lead.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sequenceId: null }) }));
  });
});

// A DB error from the "step gone" or "stop on reply" writes used to
// propagate out of the per-lead callback uncaught, aborting
// mapWithConcurrency's shared batch for every OTHER lead still in
// flight — not just the one that actually failed.
describe("one lead's DB error doesn't abort the rest of the batch", () => {
  it("still processes a second lead when the first lead's stop-on-reply write throws", async () => {
    const failing = { ...enrolled("inbound"), id: "lead-fail" };
    const healthy = enrolled("outbound");
    healthy.sequence = { ...healthy.sequence, steps: [{ ...step, action: "EMAIL" }] };
    p.lead.findMany.mockResolvedValue([failing, healthy]);
    p.lead.update.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "lead-fail") throw new Error("connection reset");
      return {};
    });
    const r = await runSequencesForBusiness("biz1");
    // The healthy lead (outbound last message) never hits lead.update at
    // all on this path — its send going through at all proves the batch
    // wasn't aborted by the first lead's thrown error.
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.skipped).toEqual([expect.stringMatching(/connection reset/)]);
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
    // Arity-strict: the call also carries the DM situation (undefined for
    // a workflow step) and the lead's decided language, added 2026-09-19.
    // Asserted loosely because this test is about the hint, not them.
    expect(draftMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining("text message"),
      undefined,
      null
    );
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
/**
 * Business.holdAllForApproval — "hold every follow-up for my approval".
 *
 * Found 2026-09-20 by the security pass. schema.prisma names exactly one
 * exception to this flag (the instant acknowledgement) and automation.ts
 * honoured it; this file never read the column at all. So a tester who
 * enrolled a lead in a workflow got AI-drafted mail sent in their own
 * name on the next cron tick — precisely what the flag exists to prevent,
 * and every beta tester has it on (grantBetaPlan, src/lib/billing.ts).
 *
 * Asserted the way automation.test.ts pins the same flag: by what did NOT
 * reach the customer, not by a code path.
 */
describe("holdAllForApproval (an account that reviews everything)", () => {
  function enrolledOnEmailStep() {
    const l = enrolled("outbound");
    l.sequence = { ...l.sequence, steps: [{ ...step, action: "EMAIL" }] };
    return l;
  }

  beforeEach(() => {
    p.business.findUnique.mockResolvedValue({
      timezone: "America/New_York",
      tier: "plus",
      holdAllForApproval: true,
    });
  });

  // The exact state that used to send: the classifier says this one is
  // perfectly safe. On a hold-everything account that is not the question
  // being asked, and the step must still not go out.
  it("does not send a step the risk check called low", async () => {
    sendRisk.mockResolvedValue({ riskLevel: "low", reason: "" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.held).toBe(1);
    expect(r.advanced).toBe(0);
  });

  // The classifier decides whether something is safe to send WITHOUT
  // review. Where nothing sends without review it has nothing to decide,
  // so its cost is not paid — same skip as runAutomationForBusiness.
  it("does not pay for a risk check it cannot act on", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(sendRisk).not.toHaveBeenCalled();
  });

  // The draft is the point: it is parked where the approval queue reads
  // it, so the owner sends it themselves.
  it("parks the draft for the owner and stops the workflow", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(p.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead1" },
        data: expect.objectContaining({ sequenceId: null, suggestedMessage: expect.any(String) }),
      })
    );
  });

  // "Needs your OK" would read as "this one looked risky", which is
  // untrue and teaches an owner to distrust a setting they chose.
  it("says it is the account setting, not that the message looked risky", async () => {
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    const note = p.notification.create.mock.calls.at(-1)?.[0]?.data?.message ?? "";
    expect(note).toMatch(/holds every follow-up for approval/i);
    expect(note).not.toMatch(/needs your OK/i);
  });

  // With the flag off, nothing about the existing behaviour changes.
  it("still sends normally when the account has not asked to review everything", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "plus", holdAllForApproval: false });
    sendRisk.mockResolvedValue({ riskLevel: "low", reason: "" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep()]);
    await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalled();
  });
});

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
        sequenceStepScheduledAt: null,
        suggestedMessage: "draft",
        suggestedSubject: "Following up",
        // 2026-09-25 (audit F2): a new draft never keeps the previous
        // draft's risk verdict. Here the "high" was this pass's own, but
        // under hold-all it is a placeholder; unjudged is the true state.
        suggestedRiskLevel: null,
        suggestedRiskReason: null,
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

// Real cost-exposure bug: a Free-tier business could create a workflow,
// enroll leads past the 20/mo cap (or on a channel Free doesn't cover), and
// have the hourly cron send every one of them at full OpenAI/Twilio/Meta
// cost — neither this cron path nor the two API routes ever called the
// same Free-tier restriction helpers automation.ts and scoring.ts already
// use. Mirrors those files' exact gate.
describe("Free tier restrictions apply to a workflow's EMAIL step (cost-exposure fix)", () => {
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

  it("skips (does not send, does not draft) an EMAIL step for a Free-tier business once the lead is over the monthly cap", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "past this month's 20-lead AI cap on the Free plan" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ source: "CSV import" })]);
    const r = await runSequencesForBusiness("biz1");
    expect(draftMessage).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(r.advanced).toBe(0);
    expect(r.skipped).toEqual([expect.stringMatching(/Free plan/)]);
  });

  it("skips an EMAIL step for a Free-tier business when the lead's channel isn't covered by Free", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "on a channel the Free plan doesn't cover" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ source: "SMS" })]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).not.toHaveBeenCalled();
    expect(r.skipped).toEqual([expect.stringMatching(/Free plan/)]);
  });

  it("leaves the lead enrolled (doesn't unenroll) when skipped for a Free-tier restriction", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "past this month's 20-lead AI cap on the Free plan" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ source: "CSV import" })]);
    await runSequencesForBusiness("biz1");
    expect(p.lead.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sequenceId: null }) }));
  });

  it("still sends normally on a Free-tier business when the lead is within cap and on an allowed channel", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ source: "Gmail" })]);
    const r = await runSequencesForBusiness("biz1");
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.advanced).toBe(1);
  });

  // Was "never gates a Plus/Pro business" until 2026-09-15, which is
  // exactly what left the paid tiers with no AI ceiling at all. They are
  // gated now — against their OWN ceiling (Plus 1,500/mo, Pro 10,000/mo),
  // so a normal paying customer still sails through.
  it("gates a paid business against its own tier, not Free's", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "plus" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ source: "SMS" })]);
    const r = await runSequencesForBusiness("biz1");
    expect(aiEligible).toHaveBeenCalledWith("biz1", expect.anything(), "plus");
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.advanced).toBe(1);
  });

  it("skips a paid lead once its tier's ceiling trips", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "plus" });
    aiEligible.mockResolvedValue({ ok: false, reason: "something may be wrong" });
    p.lead.findMany.mockResolvedValue([enrolledOnEmailStep({ source: "Gmail" })]);
    const r = await runSequencesForBusiness("biz1");
    expect(draftMessage).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(r.advanced).toBe(0);
  });

  it("never gates a CHANGE_STAGE step on the Free-tier restriction — it costs nothing and sends nothing", async () => {
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "on a channel the Free plan doesn't cover" });
    p.lead.findMany.mockResolvedValue([enrolledOnStageStep()]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.advanced).toBe(1);
    expect(p.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ stage: "QUALIFIED" }) }));
  });
});

describe("enrollLead refuses a Free-tier-ineligible lead up front (cost-exposure fix)", () => {
  const sequenceWithSteps = {
    id: "seq1",
    businessId: "biz1",
    steps: [{ id: "s1", order: 0, delayDays: 1, action: "EMAIL", messageHint: null, stageTo: null }],
  };
  const baseLead = { id: "lead1", businessId: "biz1", source: "CSV import", createdAt: new Date("2026-09-10T00:00:00Z") };

  beforeEach(() => {
    p.lead.findUnique.mockResolvedValue(baseLead);
    p.sequence.findUnique.mockResolvedValue(sequenceWithSteps);
  });

  it("enrolls normally on a paid business, which is checked against its own tier", async () => {
    p.business.findUnique.mockResolvedValue({ tier: "plus" });
    const result = await enrollLead("lead1", "biz1", "seq1");
    expect(result).toEqual({ success: true });
    expect(aiEligible).toHaveBeenCalledWith("biz1", expect.anything(), "plus");
    expect(p.lead.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead1" } }));
  });

  // Only Free has an upgrade to sell. Telling a Pro customer to upgrade
  // out of a circuit breaker would be both useless and untrue.
  it("does not tell a paying customer to upgrade when its ceiling trips", async () => {
    p.business.findUnique.mockResolvedValue({ tier: "pro" });
    aiEligible.mockResolvedValue({ ok: false, reason: "something may be wrong" });
    const result = await enrollLead("lead1", "biz1", "seq1");
    expect(result.success).toBe(false);
    expect("message" in result && result.message).not.toMatch(/upgrade/i);
    expect(p.lead.update).not.toHaveBeenCalled();
  });

  it("enrolls normally on a Free-tier business when the lead is within cap and on an allowed channel", async () => {
    p.business.findUnique.mockResolvedValue({ tier: "free" });
    const result = await enrollLead("lead1", "biz1", "seq1");
    expect(result).toEqual({ success: true });
  });

  it("refuses enrollment on a Free-tier business once the lead is over the monthly cap", async () => {
    p.business.findUnique.mockResolvedValue({ tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "past this month's 20-lead AI cap on the Free plan" });
    const result = await enrollLead("lead1", "biz1", "seq1");
    expect(result.success).toBe(false);
    expect(p.lead.update).not.toHaveBeenCalled();
  });

  it("refuses enrollment on a Free-tier business when the lead's channel isn't covered by Free", async () => {
    p.business.findUnique.mockResolvedValue({ tier: "free" });
    aiEligible.mockResolvedValue({ ok: false, reason: "on a channel the Free plan doesn't cover" });
    const result = await enrollLead("lead1", "biz1", "seq1");
    expect(result.success).toBe(false);
    expect(p.lead.update).not.toHaveBeenCalled();
  });
});

/**
 * Workflow steps count in hours (2026-09-16).
 *
 * Meta shuts the Instagram / Messenger door 24 h after the lead's last
 * message. A plan whose smallest unit is one day cannot place a second
 * touch inside that window at all — `delayDays: 1` is already at the
 * boundary. So the scheduler runs on SequenceStep.delayHours, with
 * delayDays kept and read only as a fallback for rows from before the
 * backfill. These pin: the scheduler honours hours; an old row still
 * schedules exactly as it did; a write stores both columns in step; and
 * the bounds moved with the unit rather than silently shrinking to 90 h.
 */
describe("workflow steps in hours", () => {
  const nowPlusHours = (h: number) => Date.now() + h * 3_600_000;
  const closeTo = (actual: Date, expectedMs: number) => Math.abs(actual.getTime() - expectedMs) < 5_000;
  const baseLead = { id: "lead1", businessId: "biz1", source: "CSV import", createdAt: new Date("2026-09-10T00:00:00Z") };

  function sequenceWithFirstStep(step: Record<string, unknown>) {
    return { id: "seq1", businessId: "biz1", steps: [{ id: "s1", order: 0, action: "EMAIL", messageHint: null, stageTo: null, ...step }] };
  }

  beforeEach(() => {
    p.lead.findUnique.mockResolvedValue(baseLead);
    p.business.findUnique.mockResolvedValue({ tier: "plus", timezone: "America/New_York" });
    // A create returns what toSummary needs, built from what was written —
    // so the assertion below reads the stored row shape, not a canned one.
    p.sequence.create.mockImplementation(async ({ data }: { data: { name: string; steps: { create: Record<string, unknown>[] } } }) => ({
      id: "seq-new",
      name: data.name,
      active: true,
      _count: { leads: 0 },
      steps: data.steps.create.map((s, i) => ({ id: `s${i}`, ...s })),
    }));
  });

  it("schedules the first step in hours — 20 lands inside Meta's window, which no whole-day value can", async () => {
    p.sequence.findUnique.mockResolvedValue(sequenceWithFirstStep({ delayHours: 20, delayDays: 0 }));
    await enrollLead("lead1", "biz1", "seq1");
    const dueAt = p.lead.update.mock.calls[0][0].data.sequenceStepDueAt as Date;
    expect(closeTo(dueAt, nowPlusHours(20))).toBe(true);
  });

  it("schedules a row from before the backfill exactly as it always did (delayDays only)", async () => {
    // delayHours null = the column exists but this row predates it.
    p.sequence.findUnique.mockResolvedValue(sequenceWithFirstStep({ delayHours: null, delayDays: 3 }));
    await enrollLead("lead1", "biz1", "seq1");
    const dueAt = p.lead.update.mock.calls[0][0].data.sequenceStepDueAt as Date;
    expect(closeTo(dueAt, nowPlusHours(72))).toBe(true);
  });

  it("prefers delayHours when both are present, so the backfill's floor(hours/24) never wins over the real value", async () => {
    // 30 h stored as delayHours 30 / delayDays 1. Reading days would fire 6 h early.
    p.sequence.findUnique.mockResolvedValue(sequenceWithFirstStep({ delayHours: 30, delayDays: 1 }));
    await enrollLead("lead1", "biz1", "seq1");
    const dueAt = p.lead.update.mock.calls[0][0].data.sequenceStepDueAt as Date;
    expect(closeTo(dueAt, nowPlusHours(30))).toBe(true);
  });

  it("schedules the NEXT step in hours after a step runs", async () => {
    const l: Record<string, unknown> = {
      ...enrolled("outbound"),
      sequence: {
        id: "seq1",
        name: "Instagram day one",
        active: true,
        steps: [
          { ...step, order: 0, action: "EMAIL", delayHours: 3, delayDays: 0 },
          { ...step, id: "s2", order: 1, action: "EMAIL", delayHours: 17, delayDays: 0 }, // 20 h cumulative
        ],
      },
    };
    p.lead.findMany.mockResolvedValue([l]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.advanced).toBe(1);
    const advance = p.lead.update.mock.calls.map((c: [{ data: Record<string, unknown> }]) => c[0].data).find((d: Record<string, unknown>) => d.sequenceStepIndex === 1);
    expect(advance).toBeDefined();
    expect(closeTo(advance!.sequenceStepDueAt as Date, nowPlusHours(17))).toBe(true);
  });

  it("stores both columns in step from one number, so an older reader still sees a sane day count", async () => {
    const r = await createSequence("biz1", "Instagram day one", [{ delayHours: 20, action: "EMAIL" }]);
    expect(r.success).toBe(true);
    const written = p.sequence.create.mock.calls[0][0].data.steps.create[0];
    expect(written).toMatchObject({ order: 0, delayHours: 20, delayDays: 0 });
  });

  it("still accepts a client that only knows days, and converts it", async () => {
    const r = await createSequence("biz1", "Old client", [{ delayDays: 3, action: "EMAIL" }]);
    expect(r.success).toBe(true);
    const written = p.sequence.create.mock.calls[0][0].data.steps.create[0];
    expect(written).toMatchObject({ delayHours: 72, delayDays: 3 });
  });

  it("refuses a step with no wait time at all", async () => {
    const r = await createSequence("biz1", "Broken", [{ action: "EMAIL" }]);
    expect(r).toMatchObject({ success: false, message: expect.stringMatching(/wait time/i) });
    expect(p.sequence.create).not.toHaveBeenCalled();
  });

  it("keeps the 90-day ceiling in the new unit rather than shrinking it to 90 hours", async () => {
    expect(MAX_STEP_DELAY_HOURS).toBe(2160);
    const ok = await createSequence("biz1", "Long", [{ delayHours: 2160, action: "EMAIL" }]);
    expect(ok.success).toBe(true);
    const over = await createSequence("biz1", "Too long", [{ delayHours: 2161, action: "EMAIL" }]);
    expect(over.success).toBe(false);
    const fractional = await createSequence("biz1", "Half hour", [{ delayHours: 20.5, action: "EMAIL" }]);
    expect(fractional.success).toBe(false);
  });

  it("stepDelayHours is the one reconciliation point", () => {
    expect(stepDelayHours({ delayHours: 20, delayDays: 5 })).toBe(20);
    expect(stepDelayHours({ delayHours: null, delayDays: 2 })).toBe(48);
    expect(stepDelayHours({ delayDays: 0 })).toBe(0);
    expect(stepDelayHours({})).toBe(0);
  });
});

/**
 * A send parked for retry is a send (audit 2026-09-16, F1 — Critical).
 *
 * A transient provider failure returns { success: false, queuedRetryAt }
 * and the OutboundSend worker delivers it minutes later. Treating that as
 * "not sent" kept the lead on the same step; the next hourly tick saw the
 * retry's own outbound message as ours-with-no-reply, re-drafted the same
 * step and sent it again — two follow-ups an hour apart in the owner's
 * name. acknowledge.ts already handled this result correctly; this was
 * the one caller that did not.
 */
describe("a queued retry advances the workflow step", () => {
  function twoStepLead() {
    const l: Record<string, unknown> = {
      ...enrolled("outbound"),
      sequence: {
        id: "seq1",
        name: "New lead cadence",
        active: true,
        steps: [
          { ...step, order: 0, action: "EMAIL", delayHours: 0, delayDays: 0 },
          { ...step, id: "s2", order: 1, action: "EMAIL", delayHours: 72, delayDays: 3 },
        ],
      },
    };
    return l;
  }

  it("advances to the next step when the send is queued, and does not raise a 'couldn't send' notification", async () => {
    send.mockResolvedValueOnce({ success: false, failure: "transient", message: "Twilio 503", queuedRetryAt: new Date(Date.now() + 120_000) });
    p.lead.findMany.mockResolvedValue([twoStepLead()]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.advanced).toBe(1);
    expect(r.skipped).toEqual([]);
    expect(p.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sequenceStepIndex: 1 }) }));
    const notes = p.notification.create.mock.calls.map((c: [{ data: { message: string } }]) => c[0].data.message);
    expect(notes.some((m: string) => /couldn't send/i.test(m))).toBe(false);
  });

  it("still leaves the lead on the step and tells the owner when the failure is permanent (no retry queued)", async () => {
    send.mockResolvedValueOnce({ success: false, failure: "permanent", message: "Twilio rejected the number" });
    p.lead.findMany.mockResolvedValue([twoStepLead()]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.advanced).toBe(0);
    expect(r.skipped).toHaveLength(1);
  });
});

/**
 * Stop-on-reply means "replied since the workflow last acted" (audit
 * 2026-09-16, F4). Before Lead.sequenceStepScheduledAt existed, any inbound
 * being the newest message stopped the workflow — so a lead enrolled while
 * their last message was already unanswered (every lead at the moment of
 * capture) was cancelled at step 0 with a "replied mid-sequence" note,
 * before a single step had run.
 */
describe("stop-on-reply only counts a reply since the step was scheduled", () => {
  const H = 3_600_000;
  function enrolledWithInbound(inboundHoursAgo: number, scheduledHoursAgo: number | null) {
    const l: Record<string, unknown> = {
      ...enrolled("outbound"),
      sequenceStepScheduledAt: scheduledHoursAgo == null ? null : new Date(Date.now() - scheduledHoursAgo * H),
      sequence: { id: "seq1", name: "New lead cadence", active: true, steps: [{ ...step, action: "EMAIL", delayHours: 0, delayDays: 0 }] },
      conversations: [
        {
          channel: "email",
          messages: [{ id: "m1", direction: "inbound", body: "Is it still available?", sentAt: new Date(Date.now() - inboundHoursAgo * H), opened: false }],
        },
      ],
    };
    return l;
  }

  it("runs step 0 for a lead enrolled AFTER their unanswered message — the capture case", async () => {
    // Lead wrote 5h ago; enrolled 1h ago. That message is what the plan is for.
    p.lead.findMany.mockResolvedValue([enrolledWithInbound(5, 1)]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("still stops when the lead writes AFTER the step was scheduled", async () => {
    p.lead.findMany.mockResolvedValue([enrolledWithInbound(0.5, 1)]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(p.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequenceId: null, sequenceStepScheduledAt: null }) })
    );
  });

  it("keeps the old rule for a row from before the column (null stamp): errs towards stopping", async () => {
    p.lead.findMany.mockResolvedValue([enrolledWithInbound(5, null)]);
    const r = await runSequencesForBusiness("biz1");
    expect(r.pausedForReply).toBe(1);
  });

  it("stamps the schedule time on enrolment and again on every advance", async () => {
    p.lead.findUnique.mockResolvedValue({ id: "lead1", businessId: "biz1", source: "CSV import", createdAt: new Date("2026-09-10T00:00:00Z") });
    p.sequence.findUnique.mockResolvedValue({ id: "seq1", businessId: "biz1", steps: [{ id: "s1", order: 0, action: "EMAIL", messageHint: null, stageTo: null, delayHours: 3, delayDays: 0 }] });
    p.business.findUnique.mockResolvedValue({ tier: "plus", timezone: "America/New_York" });
    await enrollLead("lead1", "biz1", "seq1");
    const enrol = p.lead.update.mock.calls[0][0].data;
    expect(enrol.sequenceStepScheduledAt).toBeInstanceOf(Date);
    expect(Math.abs(enrol.sequenceStepScheduledAt.getTime() - Date.now())).toBeLessThan(5_000);
  });
});
