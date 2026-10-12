/**
 * A-239 on the live path: a message with words from someone already let in
 * is judged again before anything answers it. A friend's joke goes to
 * Filtered out with no acknowledgement, no draft and no alert; a real
 * customer carries on exactly as before. Nothing without words is judged.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
// Everyone in this file is already a customer, so the new-sender
// "is this a customer?" check (src/lib/inbound/dmContactGate.ts, covered
// in dmContactGate.test.ts) stays out of the way of what is tested here.
vi.mock("@/lib/inbound/dmContactGate", () => ({
  isDmLead: vi.fn(async () => true),
  judgeNewDmContact: vi.fn(async () => ({ admit: true, prior: [] })),
  dmContextLoader: () => async () => ({ classifier: undefined, aiAllowed: true }),
  writeDmThread: vi.fn(async () => {}),
  takeDmSetAside: vi.fn(async () => {}),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    // The persist-first durability row the webhook writes before processing
    // (see @/lib/inboundEvents) — stubbed, not the subject here.
    inboundWebhookEvent: {
      create: async () => ({ id: "evt-test", receivedAt: new Date() }),
      update: async () => ({}),
    },
  },
}));

// Explicitly typed so their recorded call arguments stay inspectable —
// an untyped vi.fn() infers `mock.calls` as an empty tuple.
type CreateInboundMessageIfNew = (
  conversationId: string,
  body: string,
  sentAt: Date,
  externalId?: string
) => Promise<boolean>;
type CaptureDirectReply = (
  leadId: string,
  channel: string,
  body: string,
  source: string,
  externalId: string | undefined,
  sentAt: Date
) => Promise<void>;
const { createInboundMessageIfNew, findOrCreateLeadByInstagram, captureDirectReply } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn<CreateInboundMessageIfNew>(async () => true),
  findOrCreateLeadByInstagram: vi.fn(async () => ({ id: "lead1" })),
  captureDirectReply: vi.fn<CaptureDirectReply>(async () => {}),
}));
vi.mock("@/lib/instagram", () => ({
  WEBHOOK_VERIFY_TOKEN: "verify-token",
  // Authenticity itself is covered end-to-end in metaWebhookSignature.test.ts;
  // this file is about what happens to a payload once it's trusted.
  validateMetaSignature: () => true,
  createInboundMessageIfNew,
  findOrCreateLeadByInstagram,
  captureDirectReply,
}));

const { findOrCreateLeadByMessenger } = vi.hoisted(() => ({
  findOrCreateLeadByMessenger: vi.fn(async () => ({ id: "lead2" })),
}));
vi.mock("@/lib/facebook", () => ({
  findOrCreateLeadByMessenger,
  fetchLeadgenLead: vi.fn(),
  upsertLeadFromLeadgen: vi.fn(),
}));

const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: true })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

const { scoreAndDraftForLead } = vi.hoisted(() => ({ scoreAndDraftForLead: vi.fn(async () => true) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));

vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

const { recheckDmLead } = vi.hoisted(() => ({ recheckDmLead: vi.fn() }));
vi.mock("@/lib/inbound/dmRecheck", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inbound/dmRecheck")>()),
  recheckDmLead,
}));

import { POST } from "@/app/api/instagram/webhook/route";

function webhookRequest(payload: unknown) {
  return new NextRequest("https://followupbase.io/api/instagram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=stubbed" },
    body: JSON.stringify(payload),
  });
}

function instagramEvent(message: unknown) {
  return {
    object: "instagram",
    entry: [{ id: "ig-account-1", messaging: [{ sender: { id: "sender-1" }, recipient: { id: "ig-account-1" }, message }] }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  businessFindUnique.mockResolvedValue({ id: "biz1" });
  createInboundMessageIfNew.mockResolvedValue(true);
  findOrCreateLeadByInstagram.mockResolvedValue({ id: "lead1" });
  findOrCreateLeadByMessenger.mockResolvedValue({ id: "lead2" });
});

describe("an existing Instagram chat, judged again on each message with words", () => {
  it("a friend's joke is set aside before anything answers it", async () => {
    recheckDmLead.mockResolvedValue("set_aside");
    await POST(webhookRequest(instagramEvent({ mid: "mid_joke", text: "Isme bee bhi dal" })));
    expect(recheckDmLead).toHaveBeenCalledWith("biz1", "lead1", expect.anything());
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("a real customer carries on as before", async () => {
    recheckDmLead.mockResolvedValue("kept");
    await POST(webhookRequest(instagramEvent({ mid: "mid_q", text: "Is the condo on King St still available?" })));
    expect(acknowledgeNewLead).toHaveBeenCalled();
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead1");
  });

  it("an emoji or a photo isn't judged", async () => {
    await POST(webhookRequest(instagramEvent({ mid: "mid_emoji", text: "😍" })));
    await POST(webhookRequest(instagramEvent({ mid: "mid_img", attachments: [{ type: "image" }] })));
    expect(recheckDmLead).not.toHaveBeenCalled();
  });
});
