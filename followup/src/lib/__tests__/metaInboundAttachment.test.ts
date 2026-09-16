/**
 * POST /api/instagram/webhook — an Instagram DM or Messenger message whose
 * only content is an ATTACHMENT must not be silently dropped.
 *
 * Both inbound paths in this route read `event.message.text` and
 * `continue`d the moment it was missing. A DM containing only a photo, a
 * voice note, or a shared post/reel has no `text` field at all, so the
 * whole event was skipped: no Lead row, no Message, no acknowledgement,
 * nothing anywhere in the app. "Here's a picture of my roof" is an
 * entirely ordinary first contact for the trades and realtor businesses
 * this product is built for, and every one of them vanished.
 *
 * The acknowledgement is still given only the lead's OWN words — the
 * placeholder body is FollowUp's own text, and letting a generated reply
 * answer it would be a machine replying to a message nobody sent.
 *
 * Genuinely contentless events (read receipts, delivery receipts,
 * reactions) must still be skipped — they are not lead messages.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
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

describe("Instagram DM with an attachment and no text", () => {
  it("creates the lead and records a real message instead of skipping the event", async () => {
    const res = await POST(webhookRequest(instagramEvent({ mid: "mid_img", attachments: [{ type: "image" }] })));

    expect(res.status).toBe(200);
    expect(findOrCreateLeadByInstagram).toHaveBeenCalledWith("biz1", "sender-1");
    expect(createInboundMessageIfNew).toHaveBeenCalledTimes(1);
    const [, body, , externalId] = createInboundMessageIfNew.mock.calls[0] ?? [];
    expect(body).toMatch(/image/i);
    // Still idempotent on Meta's message id — redeliveries are the norm.
    expect(externalId).toBe("mid_img");
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead1");
  });

  it("acknowledges with EMPTY inboundText so no reply is generated against a placeholder", async () => {
    await POST(webhookRequest(instagramEvent({ mid: "mid_voice", attachments: [{ type: "audio" }] })));

    expect(acknowledgeNewLead).toHaveBeenCalledWith(
      "lead1",
      expect.objectContaining({ channel: "instagram", inboundText: "" })
    );
  });

  it("names every distinct attachment type when several arrive at once", async () => {
    await POST(
      webhookRequest(instagramEvent({ mid: "mid_multi", attachments: [{ type: "image" }, { type: "video" }] }))
    );

    expect(createInboundMessageIfNew.mock.calls[0]?.[1]).toMatch(/2 image\/video attachments/i);
  });

  it("still skips a contentless event — a read receipt or reaction is not a lead message", async () => {
    await POST(webhookRequest({ object: "instagram", entry: [{ id: "ig-account-1", messaging: [{ sender: { id: "sender-1" }, read: { mid: "mid_x" } }] }] }));

    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("passes real typed text through unchanged, trimmed", async () => {
    await POST(webhookRequest(instagramEvent({ mid: "mid_text", text: "  do you do emergency callouts?  " })));

    expect(createInboundMessageIfNew).toHaveBeenCalledWith(
      "conv1",
      "do you do emergency callouts?",
      expect.any(Date),
      "mid_text",
      // No quick-reply payload: typed, not tapped.
      undefined
    );
    expect(acknowledgeNewLead).toHaveBeenCalledWith(
      "lead1",
      expect.objectContaining({ inboundText: "do you do emergency callouts?" })
    );
  });

  it("records an attachment-only ECHO (Meta's own AI answering with an image) rather than dropping it", async () => {
    await POST(
      webhookRequest({
        object: "instagram",
        entry: [
          {
            id: "ig-account-1",
            messaging: [
              {
                sender: { id: "ig-account-1" },
                recipient: { id: "sender-1" },
                timestamp: 1_700_000_000_000,
                message: { mid: "mid_echo", is_echo: true, attachments: [{ type: "image" }] },
              },
            ],
          },
        ],
      })
    );

    expect(captureDirectReply).toHaveBeenCalledTimes(1);
    expect(captureDirectReply.mock.calls[0]?.[2]).toMatch(/image/i);
  });
});

describe("Messenger message with an attachment and no text", () => {
  it("creates the lead and records a real message instead of skipping the event", async () => {
    const res = await POST(
      webhookRequest({
        object: "page",
        entry: [
          {
            id: "page-1",
            messaging: [
              { sender: { id: "fb-user-1" }, recipient: { id: "page-1" }, message: { mid: "mid_fb", attachments: [{ type: "image" }] } },
            ],
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    expect(findOrCreateLeadByMessenger).toHaveBeenCalledWith("biz1", "fb-user-1");
    expect(createInboundMessageIfNew.mock.calls[0]?.[1]).toMatch(/image/i);
    expect(acknowledgeNewLead).toHaveBeenCalledWith(
      "lead2",
      expect.objectContaining({ channel: "messenger", inboundText: "" })
    );
  });
});

describe("malformed but authentic payload", () => {
  it("answers 200 rather than throwing a 500 Meta would retry forever", async () => {
    const req = new NextRequest("https://followupbase.io/api/instagram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=stubbed" },
      body: "{not json",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
  });
});
