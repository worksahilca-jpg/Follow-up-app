/**
 * An email reply goes out as a reply (daily-path audit 2026-09-25 F3;
 * the founder's call, 2026-09-25: "reply in the same thread, like hitting
 * Reply").
 *
 * Only the instant acknowledgement ever threaded. Every Approve & send and
 * every automated follow-up started a brand-new email under an AI-written
 * subject, so the customer got a stranger's email with no history, and
 * their answer to it opened a second conversation. Gmail keeps a sent
 * message in a thread only with the threadId, In-Reply-To/References and a
 * matching Subject — all three are asserted here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 1) },
    followUp: { create: vi.fn(), findFirst: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ allowModelTraining: false })) },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({
  getGmailStatus: vi.fn(async () => ({ connected: true })),
  sendEmail: vi.fn(),
  getGmailReplyHeaders: vi.fn(),
}));
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn(async () => ({ connected: false })), sendOutlookEmail: vi.fn() }));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(), sendWhatsApp: vi.fn() }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn() }));
vi.mock("@/lib/facebook", () => ({ sendMessengerMessage: vi.fn() }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
}));

import { prisma } from "@/lib/db";
import { sendEmail, getGmailReplyHeaders } from "@/lib/integrations/gmail";
import { sendOutlookEmail } from "@/lib/integrations/outlook";
import { sendFollowUpToLead, replySubject } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const gmailSend = sendEmail as unknown as ReturnType<typeof vi.fn>;
const readHeaders = getGmailReplyHeaders as unknown as ReturnType<typeof vi.fn>;
const outlookSend = sendOutlookEmail as unknown as ReturnType<typeof vi.fn>;

const THREAD = "18f2a9c0d1e2f3a4";
const GMAIL_MSG = "18f2a9c0d1e2f3b7";
const RFC_ID = "<CAF=abc123@mail.gmail.com>";

// The customer's newest email, as emailReplyTarget asks for it. Any other
// message.findFirst (there are none on this path today) gets nothing.
function customerEmail(found: { externalId: string; conversation: { externalId: string | null } } | null) {
  p.message.findFirst.mockImplementation(async (args: { where?: { conversation?: { channel?: string } } }) =>
    args?.where?.conversation?.channel === "email" ? found : null
  );
}
const sent = () => gmailSend.mock.calls[0]?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  p.lead.findUnique.mockResolvedValue({
    id: "lead1", businessId: "biz1", name: "Jane Doe", email: "jane@example.com", phone: null,
    optedOutAt: null, crmProvider: null, crmId: null, suggestedMessage: null,
  });
  p.lead.update.mockResolvedValue({});
  p.conversation.findFirst.mockResolvedValue({ id: "conv1", emailProvider: "gmail" });
  p.message.create.mockResolvedValue({});
  p.message.updateMany.mockResolvedValue({ count: 1 });
  p.followUp.create.mockResolvedValue({});
  // No automated message to this lead yet today — the one-per-day rule
  // for reminders (sendFollowUpToLead, 2026-09-25) lets these through.
  p.followUp.findFirst.mockResolvedValue(null);
  p.outboundSend.findFirst.mockResolvedValue(null);
  gmailSend.mockResolvedValue({ success: true, messageId: "sent1" });
  outlookSend.mockResolvedValue({ success: true });
  customerEmail({ externalId: GMAIL_MSG, conversation: { externalId: THREAD } });
  readHeaders.mockResolvedValue({ messageIdHeader: RFC_ID, subject: "Kitchen reno quote?" });
});

describe("Approve & send on an email lead", () => {
  it("replies in the customer's own thread, under their subject", async () => {
    const result = await sendFollowUpToLead("lead1", "Happy to quote — Tuesday at 3?", { trigger: "manual", subject: "Quick question about your kitchen project" });
    expect(result.success).toBe(true);
    expect(readHeaders).toHaveBeenCalledWith("biz1", GMAIL_MSG);
    expect(sent()).toEqual(expect.objectContaining({
      threadId: THREAD,
      inReplyTo: RFC_ID,
      subject: "Re: Kitchen reno quote?",
    }));
  });

  it("does the same for an automated follow-up", async () => {
    await sendFollowUpToLead("lead1", "Just checking in on the quote.", { trigger: "silence", automated: true, channel: "email" });
    expect(sent()).toEqual(expect.objectContaining({ threadId: THREAD, inReplyTo: RFC_ID, subject: "Re: Kitchen reno quote?" }));
  });

  it("never stacks Re: on a subject that already has one", async () => {
    readHeaders.mockResolvedValue({ messageIdHeader: RFC_ID, subject: "RE: Re: Kitchen reno quote?" });
    await sendFollowUpToLead("lead1", "Tuesday works.", { trigger: "manual" });
    expect(sent().subject).toBe("Re: Kitchen reno quote?");
  });

  it("sends a fresh email, as before, when the lead has no email thread (a form or CSV lead)", async () => {
    customerEmail(null);
    await sendFollowUpToLead("lead1", "Hi Jane, following up.", { trigger: "manual", subject: "Your enquiry" });
    expect(readHeaders).not.toHaveBeenCalled();
    expect(sent()).toEqual(expect.objectContaining({ subject: "Your enquiry", threadId: undefined, inReplyTo: undefined }));
  });

  it("still sends, as a fresh email, when Gmail won't give the headers back", async () => {
    readHeaders.mockResolvedValue(null);
    const result = await sendFollowUpToLead("lead1", "Hi Jane, following up.", { trigger: "manual", subject: "Your enquiry" });
    expect(result.success).toBe(true);
    expect(sent()).toEqual(expect.objectContaining({ subject: "Your enquiry", threadId: undefined, inReplyTo: undefined }));
  });

  it("leaves a caller's own thread alone (the instant acknowledgement already knows it)", async () => {
    await sendFollowUpToLead("lead1", "Thanks — got it.", {
      trigger: "instant_ack", automated: true, channel: "email", subject: "Re: Hello", emailThreadId: "ackThread", emailInReplyTo: "<ack@x>",
    });
    expect(readHeaders).not.toHaveBeenCalled();
    expect(sent()).toEqual(expect.objectContaining({ threadId: "ackThread", inReplyTo: "<ack@x>", subject: "Re: Hello" }));
  });

  it("replies through Outlook's own reply on an Outlook thread", async () => {
    p.conversation.findFirst.mockResolvedValue({ id: "conv1", emailProvider: "outlook" });
    customerEmail({ externalId: "AAMkAGraphId=", conversation: { externalId: "AAQkConv=" } });
    await sendFollowUpToLead("lead1", "Tuesday works.", { trigger: "manual" });
    expect(outlookSend).toHaveBeenCalledWith("biz1", expect.objectContaining({ replyToMessageId: "AAMkAGraphId=" }));
    expect(gmailSend).not.toHaveBeenCalled();
  });
});

describe("replySubject", () => {
  it("prefixes Re: once and strips reply/forward stacks in any case", () => {
    expect(replySubject("Hello")).toBe("Re: Hello");
    expect(replySubject("Re: Hello")).toBe("Re: Hello");
    expect(replySubject("FW: re:  Hello")).toBe("Re: Hello");
  });
  it("has nothing to offer for an empty subject", () => {
    expect(replySubject("   ")).toBeNull();
    expect(replySubject("Re:")).toBeNull();
  });
});
