/**
 * Every reply a person sends from FollowUp is read once for what the business
 * tells customers (A-096, src/lib/businessFacts.ts), typed, edited or sent as
 * written, unless the owner unticked "Use <price> next time". FollowUp's own
 * unreviewed sends never are: on the first day live they fed its old
 * invented details back in as facts.
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



const recorded = () => p.followUp.create.mock.calls[0][0].data as { factsCheckedAt: Date | null; ownerFilled: string | null };
function withDraft(draft: string | null) {
  p.lead.findUnique.mockResolvedValue({
    id: "lead1", businessId: "biz1", name: "Sahil", email: null, phone: "ig:3141592653589793",
    optedOutAt: null, crmProvider: null, crmId: null, suggestedMessage: draft,
  });
}

const PERSON = { humanSend: { userId: "u1" } };

describe("which sent replies FollowUp learns from", () => {
  it("learns from a draft a person sent as written", async () => {
    withDraft("We cover Toronto and Mississauga.");
    await sendFollowUpToLead("lead1", "We cover Toronto and Mississauga.", { channel: "instagram", trigger: "manual", ...PERSON });
    expect(recorded().factsCheckedAt).toBeNull();
  });

  it("learns from a reply the owner typed or edited", async () => {
    withDraft(null);
    await sendFollowUpToLead("lead1", "Showings are weekdays after 4.", { channel: "instagram", trigger: "manual", ...PERSON });
    expect(recorded().factsCheckedAt).toBeNull();
  });

  it("keeps what the owner typed into the price blank, so it is known to be theirs", async () => {
    withDraft("My commission is [PRICE], and that covers the photos.");
    await sendFollowUpToLead("lead1", "My commission is 2.5%, and that covers the photos.", { channel: "instagram", trigger: "manual", ...PERSON });
    expect(recorded()).toEqual(expect.objectContaining({ factsCheckedAt: null, ownerFilled: "2.5%" }));
  });

  it("skips a reply when the owner unticked the box", async () => {
    withDraft("My commission is [PRICE].");
    await sendFollowUpToLead("lead1", "My commission is 2%.", { channel: "instagram", trigger: "manual", learnFacts: false, ...PERSON });
    expect(recorded().factsCheckedAt).toBeInstanceOf(Date);
    expect(recorded().ownerFilled).toBeNull();
  });

  it("never reads what FollowUp sent on its own", async () => {
    withDraft("Will this be for a weekday or weekend?");
    await sendFollowUpToLead("lead1", "Will this be for a weekday or weekend?", { channel: "instagram", automated: true, trigger: "unanswered" });
    expect(recorded().factsCheckedAt).toBeInstanceOf(Date);
  });

  it("never reads the unread 'send all' pile, or a human tag on an automated send", async () => {
    withDraft("Thanks, happy to help.");
    await sendFollowUpToLead("lead1", "Thanks, happy to help.", { channel: "instagram", trigger: "manual" });
    expect(recorded().factsCheckedAt).toBeInstanceOf(Date);
    p.followUp.create.mockClear();
    await sendFollowUpToLead("lead1", "Thanks, happy to help.", { channel: "instagram", automated: true, trigger: "unanswered", ...PERSON });
    expect(recorded().factsCheckedAt).toBeInstanceOf(Date);
  });

  it("never reads the fixed acknowledgement or holding message", async () => {
    withDraft(null);
    await sendFollowUpToLead("lead1", "Thanks, we got your message.", { channel: "instagram", trigger: "instant_ack" });
    expect(recorded().factsCheckedAt).toBeInstanceOf(Date);
    p.followUp.create.mockClear();
    await sendFollowUpToLead("lead1", "Back to you within the hour.", { channel: "instagram", trigger: "holding", automated: true });
    expect(recorded().factsCheckedAt).toBeInstanceOf(Date);
  });
});
