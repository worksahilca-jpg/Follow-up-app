/**
 * Guarantees for task #67 (consent record + AI audit trail) inside the
 * one funnel every send path (manual, automated, sequence, the instant
 * acknowledgement) goes through — sendFollowUpToLead(), src/lib/sending.ts:
 *  - Refuses to text/WhatsApp a lead once Lead.optedOutAt is set,
 *    regardless of who's asking — but still allows email to the same
 *    lead, since STOP is the SMS-specific legal mechanism, not a blanket
 *    "never contact."
 *  - Every automated send writes an "ai.send" AuditEvent; a manual send
 *    does not (the route layer already logs "lead.send" for those).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    message: { create: vi.fn() },
    followUp: { create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({
  getGmailStatus: vi.fn(async () => ({ connected: true })),
  sendEmail: vi.fn(async () => ({ success: true, messageId: "m1" })),
}));
vi.mock("@/lib/integrations/outlook", () => ({
  getOutlookStatus: vi.fn(async () => ({ connected: false })),
  sendOutlookEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/twilio", () => ({
  sendSms: vi.fn(async () => ({ success: true, sid: "s1" })),
  sendWhatsApp: vi.fn(async () => ({ success: true, sid: "w1" })),
}));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
vi.mock("@/lib/suppression", () => ({
  isSuppressed: vi.fn(async () => false),
  unsubscribeFooter: () => "\n\n—\nDon't want automated follow-ups like this? https://app/api/unsubscribe?t=tok",
  unsubscribeHeaders: () => ["List-Unsubscribe: <https://app/api/unsubscribe?t=tok>", "List-Unsubscribe-Post: List-Unsubscribe=One-Click"],
}));

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendSms, sendWhatsApp } from "@/lib/twilio";
import { isSuppressed } from "@/lib/suppression";
import { sendEmail } from "@/lib/integrations/gmail";
import { sendFollowUpToLead } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;
const sms = sendSms as unknown as ReturnType<typeof vi.fn>;
const whatsapp = sendWhatsApp as unknown as ReturnType<typeof vi.fn>;
const suppressed = isSuppressed as unknown as ReturnType<typeof vi.fn>;
const gmailSend = sendEmail as unknown as ReturnType<typeof vi.fn>;

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Jamie Rivera",
    email: "jamie@example.com",
    phone: "+15551234567",
    optedOutAt: null,
    crmProvider: null,
    crmId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.conversation.findFirst.mockResolvedValue(null);
  p.conversation.create.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  p.followUp.create.mockResolvedValue({});
  p.lead.update.mockResolvedValue({});
  sms.mockResolvedValue({ success: true, sid: "s1" });
  whatsapp.mockResolvedValue({ success: true, sid: "w1" });
});

describe("sendFollowUpToLead — opt-out enforcement", () => {
  it("refuses to send SMS to an opted-out lead", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Hey, still interested?", { channel: "text" });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/STOP/i);
    expect(sms).not.toHaveBeenCalled();
    expect(p.message.create).not.toHaveBeenCalled();
  });

  it("refuses to send WhatsApp to an opted-out lead", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Hey, still interested?", { channel: "whatsapp" });
    expect(result.success).toBe(false);
    expect(whatsapp).not.toHaveBeenCalled();
  });

  it("still allows email to a lead who opted out of SMS", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Following up on your inquiry", { channel: "email" });
    expect(result.success).toBe(true);
  });

  it("blocks the automated/silence path exactly the same as a manual send, with no audit row for a message that never went out", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: new Date() }));
    const result = await sendFollowUpToLead("lead1", "Just checking in", { channel: "text", automated: true, trigger: "silence" });
    expect(result.success).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it("sends normally once optedOutAt is cleared", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ optedOutAt: null }));
    const result = await sendFollowUpToLead("lead1", "Hey, still interested?", { channel: "text" });
    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });
});

/**
 * The half-failed send. The provider has accepted the message — it is on
 * its way to a real customer's phone or inbox — and only then does the
 * database write fail (a Prisma connection-pool timeout, an ECONNRESET, a
 * deploy cycling Postgres mid-request).
 *
 * This must resolve to "sent", not to a throw, because of what the
 * callers do with a throw:
 *  - automation.ts classifies ECONNRESET/ETIMEDOUT as transient, RELEASES
 *    its lastAutomationCheckedAt claim, and re-drafts and re-sends the
 *    lead on the next hourly tick. lastContacted never updated either, so
 *    the lead is still inside the silence window and qualifies again.
 *  - sequences.ts leaves the lead enrolled on the same sequenceStepIndex
 *    behind only a 5-minute claim lock, which expires long before the
 *    next hourly tick — that step re-sends unconditionally.
 * Either way the customer gets the same message twice, in the owner's
 * name. Losing the Message row is a gap in the thread view; retrying is a
 * duplicate message to a stranger's customer.
 */
describe("sendFollowUpToLead — a send the provider already accepted is never reported as failed", () => {
  beforeEach(() => {
    p.lead.findUnique.mockResolvedValue(lead());
  });

  it("returns success when the conversation/message write fails after the provider accepted", async () => {
    p.conversation.create.mockRejectedValue(new Error("Timed out fetching a new connection from the connection pool"));

    const result = await sendFollowUpToLead("lead1", "Following up on your inquiry", {
      channel: "email",
      automated: true,
      trigger: "silence",
    });

    expect(result.success).toBe(true);
  });

  it("returns success when the FollowUp write fails after the provider accepted", async () => {
    p.followUp.create.mockRejectedValue(Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }));

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      channel: "text",
      automated: true,
      trigger: "sequence",
    });

    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  it("returns success when the lastContacted write fails after the provider accepted", async () => {
    p.lead.update.mockRejectedValue(Object.assign(new Error("connection terminated"), { code: "ECONNRESET" }));

    const result = await sendFollowUpToLead("lead1", "Still interested?", { channel: "text" });

    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  // lastContacted is the one field that takes the lead back out of every
  // re-eligibility window, so on a flaky database it gets the first and
  // best chance of landing.
  it("writes lastContacted before the conversation/message bookkeeping", async () => {
    await sendFollowUpToLead("lead1", "Following up", { channel: "email" });

    expect(p.lead.update.mock.invocationCallOrder[0]).toBeLessThan(p.message.create.mock.invocationCallOrder[0]);
  });

  // The counterpart guarantee: a provider that did NOT accept must still
  // fail loudly, or the caller would advance a sequence step nothing was
  // sent for.
  it("still reports failure when the provider itself rejects the message", async () => {
    sms.mockResolvedValue({ success: false, message: "Twilio rejected this message." });

    const result = await sendFollowUpToLead("lead1", "Still interested?", { channel: "text" });

    expect(result.success).toBe(false);
    expect(p.message.create).not.toHaveBeenCalled();
  });
});

describe("sendFollowUpToLead — AI audit trail", () => {
  beforeEach(() => {
    p.lead.findUnique.mockResolvedValue(lead());
  });

  it("records an ai.send audit event for an automated send", async () => {
    const result = await sendFollowUpToLead("lead1", "Just checking in", { channel: "email", automated: true, trigger: "unanswered" });
    expect(result.success).toBe(true);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.send",
      expect.objectContaining({ targetId: "lead1", meta: expect.objectContaining({ trigger: "unanswered" }) })
    );
  });

  it("does not record an ai.send audit event for a manual send", async () => {
    const result = await sendFollowUpToLead("lead1", "Following up", { channel: "email" });
    expect(result.success).toBe(true);
    expect(audit).not.toHaveBeenCalled();
  });

  // task #63 follow-up: a caller-specific decision (the instant ack's
  // generated-vs-fallback choice, src/lib/acknowledge.ts) is merged into
  // this same event via extraAuditMeta — not logged as its own action —
  // so a lead never ends up with two audit rows for one send.
  it("merges extraAuditMeta into the same ai.send event, alongside the standard fields", async () => {
    const result = await sendFollowUpToLead("lead1", "Thanks for reaching out", {
      channel: "email",
      automated: true,
      trigger: "instant_ack",
      extraAuditMeta: { source: "fallback", reason: "risk medium: states availability", localized: true },
    });
    expect(result.success).toBe(true);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz1" }),
      "ai.send",
      expect.objectContaining({
        targetId: "lead1",
        meta: {
          channel: "email",
          trigger: "instant_ack",
          length: "Thanks for reaching out".length,
          source: "fallback",
          reason: "risk medium: states availability",
          localized: true,
        },
      })
    );
  });
});

/**
 * Email unsubscribe. `optedOutAt` above is the SMS/WhatsApp STOP mechanism;
 * this is the email equivalent, which did not exist at all until now — no
 * link, no header, no list.
 *
 * The line it draws is deliberate: it stops AUTOMATED mail and nothing
 * else. Someone who clicks unsubscribe on an automated nudge has not asked
 * their builder to stop answering their questions, and the copy on the link
 * says exactly that. These tests pin both halves, because either one
 * failing alone is a real harm — silently mailing someone who opted out, or
 * silently severing a live conversation.
 */
describe("email unsubscribe", () => {
  beforeEach(() => {
    suppressed.mockResolvedValue(false);
  });

  it("refuses a REACTIVATION email once the address is suppressed", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Still interested?", {
      automated: true,
      trigger: "dead_lead_reactivation",
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unsubscribed from automated follow-ups/i);
    expect(gmailSend).not.toHaveBeenCalled();
  });

  // The narrowing that makes the product honest. An unsubscribe is an
  // opt-out from a MAILING. A reply to someone who wrote yesterday is not a
  // mailing, and treating it as one would stop a business answering a
  // customer who is mid-conversation with them.
  it("still sends an ordinary automated REPLY to a suppressed address", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    p.conversation.findFirst.mockResolvedValue({ id: "c1" });
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Following up on your question.", {
      automated: true,
      trigger: "unanswered",
    });

    expect(result.success).toBe(true);
    expect(gmailSend).toHaveBeenCalled();
  });

  // The other half. A human replying to their own customer must still get
  // through, or the product stops doing its job in the name of consent.
  it("still lets a HUMAN reply to the same person", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    p.conversation.findFirst.mockResolvedValue({ id: "c1" });
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Yes — Tuesday works.", { automated: false });

    expect(result.success).toBe(true);
    expect(gmailSend).toHaveBeenCalled();
  });

  // Founder's call, 2026-09-15: no unsubscribe line and no
  // List-Unsubscribe header on ANY message, including the cold batch.
  // Every message goes to someone who contacted the business first, and the
  // draft is required to say so — an "unsubscribe" line would misdescribe
  // an overdue reply as a mailing. This pins the absence, so it can't drift
  // back in unnoticed.
  it("puts no unsubscribe line or header on anything, batch included", async () => {
    for (const options of [
      { automated: false } as const,
      { automated: true, trigger: "unanswered" } as const,
      { automated: true, trigger: "dead_lead_reactivation" } as const,
    ]) {
      gmailSend.mockClear();
      p.lead.findUnique.mockResolvedValue(lead());
      p.conversation.findFirst.mockResolvedValue({ id: "c1" });

      await sendFollowUpToLead("lead1", "You asked about the refit — sorry we never came back.", options);

      const sent = gmailSend.mock.calls.at(-1)![1] as { body: string; extraHeaders?: string[] };
      expect(sent.body).not.toMatch(/unsubscribe/i);
      expect(sent.extraHeaders).toBeUndefined();
    }
  });

  it("never blocks a text because of an EMAIL unsubscribe", async () => {
    p.lead.findUnique.mockResolvedValue(lead({ email: null, phone: "+15551234567" }));
    p.conversation.findFirst.mockResolvedValue({ id: "c1" });
    suppressed.mockResolvedValue(true);

    const result = await sendFollowUpToLead("lead1", "Quick update.", {
      automated: true,
      channel: "text",
      trigger: "dead_lead_reactivation",
    });

    expect(result.success).toBe(true);
    expect(sms).toHaveBeenCalled();
  });
});
