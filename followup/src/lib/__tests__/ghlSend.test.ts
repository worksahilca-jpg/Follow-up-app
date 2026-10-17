/**
 * GHL 2 (founder, 2026-10-16): a customer who wrote to the owner's GoHighLevel is answered through GoHighLevel, the
 * way they wrote, and the reply is recorded in that same conversation. Never from Twilio or Gmail instead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 1) },
    followUp: { create: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ allowModelTraining: false })) },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
    crmConnection: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({ getGmailStatus: vi.fn(async () => ({ connected: true })), sendEmail: vi.fn() }));
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn(async () => ({ connected: false })), sendOutlookEmail: vi.fn() }));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(), sendWhatsApp: vi.fn() }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn() }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn() }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => true) }));
vi.mock("@/lib/crm/notes", () => ({ pushCrmNote: vi.fn(async () => {}) }));
vi.mock("@/lib/crm/ghlThreads", () => ({ ghlReplyRoute: vi.fn(), isGhlConversationKey: (id: string | null) => !!id && id.startsWith("ghl:") }));
vi.mock("@/lib/crm/gohighlevel", () => ({
  sendGhlMessage: vi.fn(),
  isGhlChannel: (c: string) => ["text", "email", "messenger", "instagram", "whatsapp"].includes(c),
}));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
}));

import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/integrations/gmail";
import { pushCrmNote } from "@/lib/crm/notes";
import { ghlReplyRoute } from "@/lib/crm/ghlThreads";
import { sendGhlMessage } from "@/lib/crm/gohighlevel";
import { sendFollowUpToLead } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const route = ghlReplyRoute as unknown as ReturnType<typeof vi.fn>;
const ghlSend = sendGhlMessage as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  p.lead.findUnique.mockResolvedValue({
    id: "lead1",
    businessId: "biz1",
    name: "Nadia Khan",
    email: "nadia@example.com",
    phone: "+14165550199",
    optedOutAt: null,
    crmProvider: "gohighlevel",
    crmId: "contact9",
  });
  p.lead.update.mockResolvedValue({});
  p.conversation.findFirst.mockResolvedValue({ id: "other-conv" });
  p.message.create.mockResolvedValue({});
  p.message.findFirst.mockResolvedValue(null);
  p.followUp.create.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
  p.crmConnection.findUnique.mockResolvedValue({ provider: "gohighlevel", apiKey: "loc123ABC|pit-0000-1111-2222" });
  route.mockResolvedValue({ channel: "text", conversationId: "ghl-conv" });
  ghlSend.mockResolvedValue({ success: true, messageId: "ghlmsg1" });
});

describe("a customer who wrote to GoHighLevel", () => {
  it("is answered by text through GoHighLevel, even with an email on file", async () => {
    const result = await sendFollowUpToLead("lead1", "Saturday at 11 works.");
    expect(result.success).toBe(true);
    expect(ghlSend).toHaveBeenCalledWith("loc123ABC|pit-0000-1111-2222", expect.objectContaining({ channel: "text", contactId: "contact9", body: "Saturday at 11 works." }));
    expect(sendSms).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("records the reply in the GoHighLevel conversation, with GoHighLevel's message id", async () => {
    await sendFollowUpToLead("lead1", "Saturday at 11 works.");
    expect(p.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: "ghl-conv", direction: "outbound", externalId: "ghlmsg1" }),
    });
  });

  it("adds no note in GoHighLevel: the reply is already in the conversation there", async () => {
    await sendFollowUpToLead("lead1", "Saturday at 11 works.");
    expect(pushCrmNote).not.toHaveBeenCalled();
  });

  it("is not sent another way when GoHighLevel is no longer connected", async () => {
    p.crmConnection.findUnique.mockResolvedValue(null);
    const result = await sendFollowUpToLead("lead1", "Saturday at 11 works.");
    expect(result).toMatchObject({ success: false, failure: "refused" });
    expect(result.message).toContain("GoHighLevel");
    expect(sendSms).not.toHaveBeenCalled();
    expect(ghlSend).not.toHaveBeenCalled();
  });

  it("tells a bad moment (a 503) from a refusal, so only the first is tried again", async () => {
    ghlSend.mockResolvedValue({ success: false, status: 503, message: "GoHighLevel didn't send it (503)." });
    const result = await sendFollowUpToLead("lead1", "Saturday at 11 works.");
    expect(result).toMatchObject({ success: false, failure: "transient" });
  });

  it("still never texts someone who said STOP", async () => {
    p.lead.findUnique.mockResolvedValue({ ...(await p.lead.findUnique()), optedOutAt: new Date() });
    const result = await sendFollowUpToLead("lead1", "Saturday at 11 works.");
    expect(result).toMatchObject({ success: false, failure: "refused" });
    expect(ghlSend).not.toHaveBeenCalled();
  });
});

describe("everyone else", () => {
  it("is answered exactly as before", async () => {
    route.mockResolvedValue(null);
    p.lead.findUnique.mockResolvedValue({ ...(await p.lead.findUnique()), crmProvider: null, crmId: null });
    const send = sendEmail as unknown as ReturnType<typeof vi.fn>;
    send.mockResolvedValue({ success: true, messageId: "gm1" });
    const result = await sendFollowUpToLead("lead1", "Saturday at 11 works.");
    expect(result.success).toBe(true);
    expect(send).toHaveBeenCalled();
    expect(ghlSend).not.toHaveBeenCalled();
  });
});

describe("a customer who wrote to GoHighLevel on Instagram", () => {
  it("is answered on Instagram, through GoHighLevel, not by text or email", async () => {
    route.mockResolvedValue({ channel: "instagram", conversationId: "ghl-ig" });
    // Meta's window: they wrote just now.
    p.message.findFirst.mockResolvedValue({ sentAt: new Date() });
    const result = await sendFollowUpToLead("lead1", "Yes, it's still available.");
    expect(result.success).toBe(true);
    expect(ghlSend).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ channel: "instagram", contactId: "contact9" }));
    expect(sendSms).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
