/**
 * FollowUp never texts or WhatsApps, on its own, someone who has not
 * written to the business (security pass 2026-09-25 F1).
 *
 * A lead the owner messaged first from their phone (a WhatsApp echo, an
 * owner-only history thread) has only outbound messages. Before this, a
 * WhatsApp source rule could enrol them and FollowUp texted them from the
 * business's Twilio number — a number they had never contacted, on a
 * channel they never used. The owner's own Send stays allowed, and goes
 * out on WhatsApp for a WhatsApp-only contact instead of as an SMS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 0) },
    followUp: { create: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ allowModelTraining: false })) },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({ getGmailStatus: vi.fn(async () => ({ connected: false })), sendEmail: vi.fn() }));
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn(async () => ({ connected: false })), sendOutlookEmail: vi.fn() }));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => ({ success: true, sid: "SM1" })), sendWhatsApp: vi.fn(async () => ({ success: true, sid: "WA1" })) }));
vi.mock("@/lib/whatsappCloud", () => ({ getWhatsAppCloudConnection: vi.fn(async () => null), sendWhatsAppCloud: vi.fn() }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn() }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
}));

import { prisma } from "@/lib/db";
import { sendSms, sendWhatsApp } from "@/lib/twilio";
import { sendFollowUpToLead } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const sms = sendSms as unknown as ReturnType<typeof vi.fn>;
const wa = sendWhatsApp as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  p.lead.findUnique.mockResolvedValue({
    id: "lead1", businessId: "biz1", name: "Sam Lee", email: null, phone: "+15551234567",
    optedOutAt: null, crmProvider: null, crmId: null, suggestedMessage: null,
  });
  p.lead.update.mockResolvedValue({});
  p.conversation.create.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  p.followUp.create.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
  // Default: they have never written.
  p.message.count.mockResolvedValue(0);
  p.message.findFirst.mockResolvedValue(null);
  // Their only thread is WhatsApp (the owner messaged them from the app).
  p.conversation.findFirst.mockImplementation(async (args: { where: { channel?: unknown } }) =>
    args?.where && "channel" in args.where && typeof args.where.channel === "object" ? { channel: "whatsapp" } : { id: "conv1" }
  );
});

describe("never an automatic text to someone who has not written", () => {
  it("refuses an automated SMS", async () => {
    const r = await sendFollowUpToLead("lead1", "Just checking in!", { automated: true, trigger: "sequence", channel: "text" });
    expect(r.success).toBe(false);
    expect(r.failure).toBe("refused");
    expect(r.message).toMatch(/hasn't messaged you yet/);
    expect(sms).not.toHaveBeenCalled();
  });

  it("refuses an automated WhatsApp", async () => {
    const r = await sendFollowUpToLead("lead1", "Just checking in!", { automated: true, trigger: "silence", channel: "whatsapp" });
    expect(r.success).toBe(false);
    expect(wa).not.toHaveBeenCalled();
  });

  it("refuses one with no channel given, whichever phone channel it would pick", async () => {
    const r = await sendFollowUpToLead("lead1", "Just checking in!", { automated: true, trigger: "silence" });
    expect(r.success).toBe(false);
    expect(sms).not.toHaveBeenCalled();
    expect(wa).not.toHaveBeenCalled();
  });

  it("allows it once they have written", async () => {
    p.message.count.mockResolvedValue(1);
    const r = await sendFollowUpToLead("lead1", "Just checking in!", { automated: true, trigger: "sequence", channel: "text" });
    expect(r.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });
});

describe("the owner's own send", () => {
  it("is never blocked by it", async () => {
    const r = await sendFollowUpToLead("lead1", "Hi Sam, the deck is $4,200.", { trigger: "manual", channel: "text" });
    expect(r.success).toBe(true);
    expect(sms).toHaveBeenCalledTimes(1);
  });

  it("goes out on WhatsApp, not SMS, for a contact whose only thread is WhatsApp", async () => {
    const r = await sendFollowUpToLead("lead1", "Hi Sam, the deck is $4,200.", { trigger: "manual" });
    expect(r.success).toBe(true);
    expect(wa).toHaveBeenCalledTimes(1);
    expect(sms).not.toHaveBeenCalled();
  });
});
