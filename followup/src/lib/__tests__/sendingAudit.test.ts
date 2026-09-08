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

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendSms, sendWhatsApp } from "@/lib/twilio";
import { sendFollowUpToLead } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const audit = recordAudit as unknown as ReturnType<typeof vi.fn>;
const sms = sendSms as unknown as ReturnType<typeof vi.fn>;
const whatsapp = sendWhatsApp as unknown as ReturnType<typeof vi.fn>;

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
});
