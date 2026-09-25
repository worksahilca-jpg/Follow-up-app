/**
 * A draft is spent once it has gone out (ui-bug-hunt 2026-09-25 B8).
 *
 * Nothing cleared Lead.suggestedMessage on a send, so after an Approve &
 * send on Today the lead page offered the same text again under
 * "AI-suggested follow-up", and a second Send once the 60-second duplicate
 * guard lapsed sent it to the customer twice. An instant ack must never
 * clear it: that is a different message, and the draft is the real reply.
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
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(), sendWhatsApp: vi.fn() }));
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
import { sendInstagramMessage } from "@/lib/instagram";
import { sendFollowUpToLead } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const instagramSend = sendInstagramMessage as unknown as ReturnType<typeof vi.fn>;
const MID = "aWdfZAG1faXRlbToxOklHTWVzc2FnZA";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  p.lead.findUnique.mockResolvedValue({
    id: "lead1",
    businessId: "biz1",
    name: "Sahil",
    email: null,
    phone: "ig:3141592653589793",
    optedOutAt: null,
    crmProvider: null,
    crmId: null,
  });
  p.lead.update.mockResolvedValue({});
  p.conversation.findFirst.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  p.message.updateMany.mockResolvedValue({ count: 1 });
  // Meta's 24-hour window pre-flight: the lead wrote just now.
  p.message.findFirst.mockResolvedValue({ sentAt: new Date() });
  p.followUp.create.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
  instagramSend.mockResolvedValue({ success: true, messageId: MID });
});


const DRAFT = "Yes, Saturday at 11 works. See you then!";
function withDraft(draft: string | null) {
  p.lead.findUnique.mockResolvedValue({
    id: "lead1", businessId: "biz1", name: "Sahil", email: null, phone: "ig:3141592653589793",
    optedOutAt: null, crmProvider: null, crmId: null, suggestedMessage: draft,
  });
}
const leadWrite = () => p.lead.update.mock.calls.map((c: [{ data: Record<string, unknown> }]) => c[0].data).find((d: Record<string, unknown>) => "lastContacted" in d);

describe("a draft is spent once it has gone out", () => {
  it("clears the draft, and its verdict, when it went out as written", async () => {
    withDraft(DRAFT);
    expect((await sendFollowUpToLead("lead1", DRAFT, { channel: "instagram" })).success).toBe(true);
    expect(leadWrite()).toEqual(expect.objectContaining({ suggestedMessage: null, suggestedRiskLevel: null, suggestedRiskReason: null }));
  });

  it("treats re-wrapped whitespace as the same draft", async () => {
    withDraft(DRAFT);
    await sendFollowUpToLead("lead1", "Yes, Saturday at 11 works.\n  See you then!", { channel: "instagram" });
    expect(leadWrite()).toEqual(expect.objectContaining({ suggestedMessage: null }));
  });

  it("clears it when the owner edited it and sent their own version", async () => {
    withDraft(DRAFT);
    await sendFollowUpToLead("lead1", "Saturday 11 is great, bring the paperwork.", { channel: "instagram" });
    expect(leadWrite()).toEqual(expect.objectContaining({ suggestedMessage: null }));
  });

  it("never clears it on an instant acknowledgement — that is a different message", async () => {
    withDraft(DRAFT);
    await sendFollowUpToLead("lead1", "Thanks for reaching out — I'll get back to you shortly.", { channel: "instagram", automated: true, trigger: "instant_ack" });
    expect(leadWrite()).not.toHaveProperty("suggestedMessage");
  });

  it("leaves a lead with no draft alone", async () => {
    withDraft(null);
    await sendFollowUpToLead("lead1", "Typed from scratch.", { channel: "instagram" });
    expect(leadWrite()).not.toHaveProperty("suggestedMessage");
  });
});
