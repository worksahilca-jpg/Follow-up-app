/**
 * A Messenger send is recorded with Meta's message id, as an Instagram one
 * already is (instagramSendExternalId.test.ts).
 *
 * Pages are now subscribed to message_echoes (without it an owner's reply
 * from the Page inbox never reached FollowUp, see facebook.ts), and that
 * field echoes FollowUp's own sends as well. The echo is stored by
 * captureDirectReply, which upserts on the message id. sendMessengerMessage
 * threw the id away and the Messenger branch of sendFollowUpToLead set no
 * externalId, so each of FollowUp's own Messenger messages would have
 * appeared twice, the copy labelled "sent directly on Messenger".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { p } = vi.hoisted(() => ({
  p: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    sendClaim: { create: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })), deleteMany: vi.fn() },
    message: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 0) },
    followUp: { create: vi.fn() },
    business: { findUnique: vi.fn() },
    outboundSend: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: p }));
vi.mock("@/lib/integrations/gmail", () => ({ getGmailStatus: vi.fn(async () => ({ connected: false })), sendEmail: vi.fn() }));
vi.mock("@/lib/integrations/outlook", () => ({ getOutlookStatus: vi.fn(async () => ({ connected: false })), sendOutlookEmail: vi.fn() }));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn(), sendWhatsApp: vi.fn() }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage: vi.fn() }));
vi.mock("@/lib/crm", () => ({ CRM_PROVIDERS: {}, isCrmProvider: vi.fn(() => false) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/sendCaps", () => ({ checkSendCap: vi.fn(async () => ({ allowed: true, used: 0, cap: 50 })) }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/suppression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppression")>()),
  isSuppressed: vi.fn(async () => false),
}));

import { sendMessengerMessage } from "@/lib/facebook";
import { sendFollowUpToLead } from "@/lib/sending";

const MID = "m_AbC123-messenger-mid";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ recipient_id: "psid-1", message_id: MID }) });
  p.business.findUnique.mockResolvedValue({ allowModelTraining: false, facebookPageId: "page-1", facebookPageAccessToken: "page-fake-token" });
  p.lead.findUnique.mockResolvedValue({
    id: "lead1",
    businessId: "biz1",
    name: "Priya",
    email: null,
    phone: "fb:psid-1",
    optedOutAt: null,
    crmProvider: null,
    crmId: null,
  });
  p.lead.update.mockResolvedValue({});
  p.conversation.findFirst.mockResolvedValue({ id: "conv1" });
  p.message.create.mockResolvedValue({});
  // Meta's 24-hour window pre-flight: the lead wrote just now.
  p.message.findFirst.mockResolvedValue({ sentAt: new Date() });
  p.followUp.create.mockResolvedValue({});
  p.outboundSend.findFirst.mockResolvedValue(null);
});

afterEach(() => vi.unstubAllGlobals());

describe("a Messenger send", () => {
  it("returns Meta's message id", async () => {
    expect(await sendMessengerMessage("biz1", "psid-1", "Yes, Saturday works.")).toEqual({ success: true, messageId: MID });
  });

  it("is still a success when Meta's 200 has no readable id", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("no body"); } });
    expect(await sendMessengerMessage("biz1", "psid-1", "Yes, Saturday works.")).toEqual({ success: true });
  });

  it("is recorded under that id, so the Page's echo of it lands on the same row", async () => {
    const result = await sendFollowUpToLead("lead1", "Yes, Saturday works.", { channel: "messenger" });
    expect(result.success).toBe(true);
    expect(p.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: "conv1", direction: "outbound", externalId: MID }),
    });
  });
});
