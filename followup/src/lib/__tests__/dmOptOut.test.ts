/**
 * "Stop." — on Instagram and on Messenger, end to end through the real
 * webhook route.
 *
 * The gap this covers: isOptOutMessage had exactly ONE caller in the whole
 * codebase (src/lib/inbound/twilioMessage.ts), so SMS and WhatsApp honoured
 * STOP and the two channels this product is launching on honoured nothing.
 * A lead could DM "stop", get a cheerful automated acknowledgement back,
 * and keep receiving follow-ups — while the business believed FollowUp
 * honoured opt-outs, because it does over SMS. A silent failure is worse
 * than no mechanism: it removes the reason to look.
 *
 * What is pinned here, per channel:
 *  1. the opt-out is RECORDED, against the platform user id and the right
 *     channel (Suppression, not Lead.optedOutAt — see src/lib/suppression.ts);
 *  2. nothing cheerful is sent back in reply to it;
 *  3. START undoes it, the same way it does over SMS;
 *  4. an ordinary sentence containing the word "stop" does none of this.
 *
 * The outbound half of the guarantee — that a suppressed lead can't be
 * messaged by any path, automated or manual — lives in sendingAudit.test.ts,
 * because that is the funnel every send goes through.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    inboundWebhookEvent: {
      create: async () => ({ id: "evt-test", receivedAt: new Date() }),
      update: async () => ({}),
    },
  },
}));

const { createInboundMessageIfNew, findOrCreateLeadByInstagram } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn(async () => true),
  findOrCreateLeadByInstagram: vi.fn(async () => ({ id: "lead-ig" })),
}));
vi.mock("@/lib/instagram", () => ({
  WEBHOOK_VERIFY_TOKEN: "verify-token",
  // Signature handling is covered in metaWebhookSignature.test.ts; this
  // file is about what happens to a payload once it is trusted.
  validateMetaSignature: () => true,
  createInboundMessageIfNew,
  findOrCreateLeadByInstagram,
  captureDirectReply: vi.fn(async () => {}),
}));

const { findOrCreateLeadByMessenger } = vi.hoisted(() => ({
  findOrCreateLeadByMessenger: vi.fn(async () => ({ id: "lead-fb" })),
}));
vi.mock("@/lib/facebook", () => ({
  findOrCreateLeadByMessenger,
  fetchLeadgenLead: vi.fn(),
  upsertLeadFromLeadgen: vi.fn(),
}));

const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: true })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

// suppress/unsuppress are the consent record itself — stubbed so the call
// arguments (which are the whole point: business, platform id, channel) are
// inspectable without a database.
const { suppress, unsuppress } = vi.hoisted(() => ({
  suppress: vi.fn(async () => {}),
  unsuppress: vi.fn(async () => {}),
}));
vi.mock("@/lib/suppression", () => ({ suppress, unsuppress }));

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

const { scoreAndDraftForLead } = vi.hoisted(() => ({ scoreAndDraftForLead: vi.fn(async () => true) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
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

const IGSID = "17841400000000001";
const PSID = "9988776655";

function instagramDm(text: string, mid = "mid_1") {
  return {
    object: "instagram",
    entry: [
      {
        id: "ig-account-1",
        messaging: [{ sender: { id: IGSID }, recipient: { id: "ig-account-1" }, message: { mid, text } }],
      },
    ],
  };
}

function messengerDm(text: string, mid = "mid_2") {
  return {
    object: "page",
    entry: [
      {
        id: "page-1",
        messaging: [{ sender: { id: PSID }, recipient: { id: "page-1" }, message: { mid, text } }],
      },
    ],
  };
}

beforeEach(() => {
  businessFindUnique.mockResolvedValue({ id: "biz1" });
  createInboundMessageIfNew.mockResolvedValue(true);
  findOrCreateLeadByInstagram.mockResolvedValue({ id: "lead-ig" });
  findOrCreateLeadByMessenger.mockResolvedValue({ id: "lead-fb" });
  acknowledgeNewLead.mockResolvedValue({ sent: true });
  scoreAndDraftForLead.mockResolvedValue(true);
});

describe("Instagram DM opt-out", () => {
  it("records the opt-out against the IGSID on the instagram channel", async () => {
    const res = await POST(webhookRequest(instagramDm("STOP")));

    expect(res.status).toBe(200);
    expect(suppress).toHaveBeenCalledWith("biz1", IGSID, "keyword", "instagram");
    expect(unsuppress).not.toHaveBeenCalled();
  });

  // The worst possible moment to be cheerful.
  it("sends no instant acknowledgement in reply to a STOP", async () => {
    await POST(webhookRequest(instagramDm("stop")));

    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("still records the message itself — the opt-out has to be visible in the thread", async () => {
    await POST(webhookRequest(instagramDm("Stop")));

    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Stop", expect.any(Date), "mid_1", undefined);
  });

  it("writes the same audit action the SMS path writes", async () => {
    await POST(webhookRequest(instagramDm("unsubscribe")));

    expect(recordAudit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: null },
      "lead.opt_out",
      expect.objectContaining({ targetType: "lead", targetId: "lead-ig", meta: { channel: "instagram", via: "keyword" } })
    );
  });

  it("opts them back IN on START, and acknowledges that message normally", async () => {
    await POST(webhookRequest(instagramDm("start")));

    expect(unsuppress).toHaveBeenCalledWith("biz1", IGSID, "instagram");
    expect(suppress).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: null },
      "lead.opt_in",
      expect.objectContaining({ meta: { channel: "instagram", via: "keyword" } })
    );
    expect(acknowledgeNewLead).toHaveBeenCalled();
  });

  // Whole-body matching, not a substring search — this sentence is an
  // ordinary thing for a customer to write and must stay a normal lead.
  it("leaves an ordinary sentence containing 'stop' completely alone", async () => {
    await POST(webhookRequest(instagramDm("can you stop by the office tomorrow?")));

    expect(suppress).not.toHaveBeenCalled();
    expect(unsuppress).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
  });

  // An attachment-only DM gets a placeholder body FollowUp wrote itself
  // (see messageContent in src/lib/inbound/meta.ts). Consent must never be
  // decided by our own text — only by what the lead typed.
  it("never opts anyone out on the strength of a placeholder body", async () => {
    await POST(
      webhookRequest({
        object: "instagram",
        entry: [
          {
            id: "ig-account-1",
            messaging: [
              {
                sender: { id: IGSID },
                recipient: { id: "ig-account-1" },
                message: { mid: "mid_att", attachments: [{ type: "image" }] },
              },
            ],
          },
        ],
      })
    );

    expect(suppress).not.toHaveBeenCalled();
  });
});

describe("Messenger DM opt-out", () => {
  it("records the opt-out against the PSID on the messenger channel", async () => {
    const res = await POST(webhookRequest(messengerDm("STOP")));

    expect(res.status).toBe(200);
    expect(suppress).toHaveBeenCalledWith("biz1", PSID, "keyword", "messenger");
  });

  it("sends no instant acknowledgement in reply to a STOP", async () => {
    await POST(webhookRequest(messengerDm("quit")));

    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("opts them back IN on UNSTOP", async () => {
    await POST(webhookRequest(messengerDm("UNSTOP")));

    expect(unsuppress).toHaveBeenCalledWith("biz1", PSID, "messenger");
    expect(acknowledgeNewLead).toHaveBeenCalled();
  });

  it("leaves an ordinary sentence containing 'cancel' alone", async () => {
    await POST(webhookRequest(messengerDm("do I need to cancel my old quote first?")));

    expect(suppress).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
  });
});
