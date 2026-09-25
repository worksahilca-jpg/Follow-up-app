/**
 * An Instagram send is recorded with Meta's message id (audit 2026-09-24
 * F2), so the poller's read-back of that same message — which upserts on
 * Message.externalId — lands on FollowUp's row instead of beside it.
 *
 * Until 2026-09-25 the Instagram branch of sendFollowUpToLead set no
 * externalId at all; production had two outbound Instagram messages with
 * none. The other half of the race is pinned too: if the read-back (an
 * echo webhook, or a poll tick) stores the message in the milliseconds
 * between Meta's 200 and this write, the row is claimed as FollowUp's
 * rather than the unique violation skipping the record entirely.
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

const send = () => sendFollowUpToLead("lead1", "Yes, Saturday works.", { channel: "instagram" });

describe("recording an Instagram send", () => {
  it("stores Meta's message id as the Message's externalId", async () => {
    expect((await send()).success).toBe(true);
    expect(p.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: "conv1", direction: "outbound", externalId: MID }),
    });
  });

  it("still records a send Meta confirmed without an id, just without one", async () => {
    instagramSend.mockResolvedValue({ success: true });
    expect((await send()).success).toBe(true);
    expect(p.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ externalId: undefined }) });
  });

  it("claims the row the read-back stored first, instead of losing the record", async () => {
    p.message.create.mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const result = await send();
    expect(result.success).toBe(true);
    // Marked as FollowUp's own, with this send's trigger — not left as
    // "sent directly on Instagram, not through FollowUp" — and only if it
    // is this lead's own outbound row.
    expect(p.message.updateMany).toHaveBeenCalledWith({
      where: { externalId: MID, direction: "outbound", conversation: { leadId: "lead1" } },
      data: { source: null, trigger: "manual" },
    });
    // And the rest of the bookkeeping still happens.
    expect(p.followUp.create).toHaveBeenCalledTimes(1);
  });

  // externalId is unique across every tenant. A collision with a row that
  // is not this lead's must never become a write to it.
  it("never claims a row that belongs to a different lead", async () => {
    p.message.create.mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    p.message.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await send();
    // The message went out, so the send is still reported as sent; the
    // record is lost and logged, exactly as before this fix existed.
    expect(result.success).toBe(true);
    expect(p.followUp.create).not.toHaveBeenCalled();
  });

  it("does not turn any other recording failure into a claim", async () => {
    p.message.create.mockRejectedValueOnce(Object.assign(new Error("Timed out fetching a new connection"), { code: "P2024" }));
    const result = await send();
    // The message went out, so the send is still reported as sent.
    expect(result.success).toBe(true);
    expect(p.message.updateMany).not.toHaveBeenCalled();
  });
});
