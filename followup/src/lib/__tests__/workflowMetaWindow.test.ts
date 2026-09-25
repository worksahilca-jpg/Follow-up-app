/**
 * A workflow step on Instagram / Messenger outside Meta's window
 * (security pass 2026-09-25, F8).
 *
 * The case: an "Instagram" source rule enrols an echo lead — someone the
 * OWNER messaged first, so they have never written to the business. Each
 * hourly step drafted and risk-checked with OpenAI, then sendFollowUpToLead
 * refused it ("hasn't messaged you on Instagram yet"), the lead stayed
 * enrolled on the same step, and the owner was told "couldn't send" —
 * every hour, forever. The same for any DM lead whose last message was
 * more than 24 hours before the step came due.
 *
 * The step now asks metaWindowFor — the clock the send itself uses —
 * before drafting, and exits the way the text/WhatsApp "never wrote" case
 * already does: the workflow stops, and the owner is told once.
 *
 * Driven tick by tick like the cron: the lead is due for as long as it is
 * enrolled and drops out of the query the moment it is unenrolled.
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
  assessSendRisk: vi.fn(async () => ({ riskLevel: "low" as const, reason: "" })),
}));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/sender", () => ({ latestInboundText: vi.fn(() => undefined), composeFollowUpEmail: vi.fn(async (_f: string, _b: string, body: string) => body) }));
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: vi.fn(),
  detectNonEmailChannel: vi.fn(),
  metaWindowFor: vi.fn(),
}));
vi.mock("@/lib/sendChannels", () => ({ hasAnySendChannel: vi.fn(async () => true), canSendOn: vi.fn(async () => true) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), checkAiEligibility: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/sendWindow", () => ({ isWithinSendWindow: vi.fn(() => true) }));

import { prisma } from "@/lib/db";
import { generateFollowUpMessage, assessSendRisk } from "@/lib/integrations/openai";
import { sendFollowUpToLead, detectNonEmailChannel, metaWindowFor } from "@/lib/sending";
import { runSequencesForBusiness } from "@/lib/sequences";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const draft = generateFollowUpMessage as unknown as ReturnType<typeof vi.fn>;
const risk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
const send = sendFollowUpToLead as unknown as ReturnType<typeof vi.fn>;
const nonEmailChannel = detectNonEmailChannel as unknown as ReturnType<typeof vi.fn>;
const metaWindow = metaWindowFor as unknown as ReturnType<typeof vi.fn>;

const H = 3_600_000;
const step = { id: "s1", order: 0, delayHours: 0, delayDays: 0, action: "EMAIL", messageHint: null, stageTo: null };

/** An Instagram lead the owner DM'd first: outbound only, no email. */
function echoLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Priya",
    businessId: "biz1",
    assignedToId: "user1",
    email: null,
    phone: "ig:17841400000000001",
    sequenceStepIndex: 0,
    sequenceStepScheduledAt: new Date(Date.now() - 2 * H),
    sequence: { id: "seq1", name: "Instagram day one", active: true, steps: [step, { ...step, id: "s2", order: 1 }] },
    conversations: [
      {
        channel: "instagram",
        messages: [{ id: "m1", direction: "outbound", body: "Hey! Saw your post — are you still looking?", sentAt: new Date(Date.now() - 3 * H), opened: false }],
      },
    ],
    ...overrides,
  };
}

/** Messenger lead who wrote, was answered, and last wrote `hoursAgo` hours ago. */
function messengerLead(hoursAgo: number) {
  return echoLead({
    name: "Sam Okafor",
    phone: "fb:24681357902468135",
    sequenceStepScheduledAt: new Date(Date.now() - (hoursAgo - 1) * H),
    conversations: [
      {
        channel: "messenger",
        messages: [
          { id: "m1", direction: "inbound", body: "Do you deliver to Leeds?", sentAt: new Date(Date.now() - hoursAgo * H), opened: false },
          { id: "m2", direction: "outbound", body: "We do!", sentAt: new Date(Date.now() - (hoursAgo - 1) * H), opened: false },
        ],
      },
    ],
  });
}

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

const notes = () => p.notification.create.mock.calls.map((c: [{ data: { message: string } }]) => c[0].data.message);

beforeEach(() => {
  p.lead.updateMany.mockResolvedValue({ count: 1 });
  p.notification.create.mockResolvedValue({});
  p.user.findMany.mockResolvedValue([{ id: "admin1" }]);
  // "Hold everything" off — the finding's precondition, and the account
  // where the draft went all the way to a refused send every hour.
  p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", tier: "plus", holdAllForApproval: false });
  draft.mockResolvedValue({ subject: "Following up", body: "draft" });
  risk.mockResolvedValue({ riskLevel: "low", reason: "" });
  nonEmailChannel.mockImplementation(async (lead: { phone: string }) => (lead.phone.startsWith("fb:") ? "messenger" : "instagram"));
  // What the real send says for these two cases (sending.ts).
  send.mockImplementation(async () => ({ success: false, failure: "refused", message: "Priya hasn't messaged you on Instagram yet, so Meta doesn't allow a message to them there. They'll need to write first." }));
});

describe("an Instagram echo lead in a workflow", () => {
  beforeEach(() => metaWindow.mockResolvedValue({ hoursSinceLead: null }));

  it("is never drafted or risk-checked, hour after hour", async () => {
    await hourlyTicks(echoLead(), 3);
    expect(metaWindow).toHaveBeenCalledWith("lead1", "instagram");
    expect(draft).not.toHaveBeenCalled();
    expect(risk).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("stops the workflow and tells the owner once — not every hour", async () => {
    const { results, stillEnrolled } = await hourlyTicks(echoLead(), 3);
    expect(stillEnrolled()).toBe(false);
    expect(p.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { sequenceId: null, sequenceStepIndex: 0, sequenceStepDueAt: null, sequenceStepScheduledAt: null },
    });
    expect(notes()).toHaveLength(1);
    expect(notes()[0]).toMatch(/"Instagram day one" stopped for Priya/);
    expect(notes()[0]).toMatch(/haven't messaged you on Instagram/);
    expect(notes()[0]).not.toMatch(/couldn't send/);
    expect(results[0].skipped).toEqual([expect.stringMatching(/never written on Instagram/)]);
    expect(results[1].checked).toBe(0);
  });
});

describe("a DM lead whose 24-hour window closed before the step came due", () => {
  it("stops once, told why, with no draft", async () => {
    metaWindow.mockResolvedValue({ hoursSinceLead: 30 });
    const { stillEnrolled } = await hourlyTicks(messengerLead(30), 3);
    expect(metaWindow).toHaveBeenCalledWith("lead1", "messenger");
    expect(draft).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(stillEnrolled()).toBe(false);
    expect(notes()).toEqual([expect.stringMatching(/Meta's 24-hour window on Messenger has closed/)]);
  });

  it("still runs the step inside the window, exactly as before", async () => {
    metaWindow.mockResolvedValue({ hoursSinceLead: 5 });
    send.mockResolvedValue({ success: true });
    const { results } = await hourlyTicks(messengerLead(5), 1);
    expect(draft).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("lead1", expect.any(String), expect.objectContaining({ channel: "messenger" }));
    expect(results[0].advanced).toBe(1);
    expect(notes()).toEqual([]);
  });

  it("draws the line where the send does: 24 hours still goes, a minute past does not", async () => {
    send.mockResolvedValue({ success: true });
    metaWindow.mockResolvedValue({ hoursSinceLead: 24 });
    await hourlyTicks(messengerLead(24), 1);
    expect(draft).toHaveBeenCalledTimes(1);

    draft.mockClear();
    metaWindow.mockResolvedValue({ hoursSinceLead: 24 + 1 / 60 });
    await hourlyTicks(messengerLead(25), 1);
    expect(draft).not.toHaveBeenCalled();
  });
});

describe("channels without Meta's window", () => {
  it("never asks for it on an email step", async () => {
    send.mockResolvedValue({ success: true });
    await hourlyTicks(
      echoLead({
        email: "priya@example.com",
        phone: null,
        conversations: [{ channel: "email", messages: [{ id: "m1", direction: "inbound", body: "Hi", sentAt: new Date(Date.now() - 3 * H), opened: false }] }],
      }),
      1
    );
    expect(metaWindow).not.toHaveBeenCalled();
    expect(draft).toHaveBeenCalledTimes(1);
  });
});
