/**
 * What the Meta webhook does when a lead taps one of FollowUp's reply
 * buttons (src/lib/inbound/meta.ts, handleQuickReplyTap).
 *
 * The one guarantee that matters most is the exit chip: a tap on "Not
 * now" must stop every further automatic message and never be answered
 * by a machine (buttons research §5.1, "reset-farming"; §8 handover). The
 * rest pins that a tap is recorded as a tap, is never acknowledged as if
 * the lead had typed, and reaches the owner as one plain line.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, notificationCreate, userFindMany } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  notificationCreate: vi.fn(async () => ({})),
  userFindMany: vi.fn(async () => [{ id: "admin1" }]),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    notification: { create: notificationCreate },
    user: { findMany: userFindMany },
    inboundWebhookEvent: {
      create: async () => ({ id: "evt-test", receivedAt: new Date() }),
      update: async () => ({}),
    },
  },
}));

const { createInboundMessageIfNew, findOrCreateLeadByInstagram } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn(async () => true),
  findOrCreateLeadByInstagram: vi.fn(async () => ({ id: "lead-ig", name: "Aanya", assignedToId: "user1" })),
}));
vi.mock("@/lib/instagram", () => ({
  WEBHOOK_VERIFY_TOKEN: "verify-token",
  validateMetaSignature: () => true,
  createInboundMessageIfNew,
  findOrCreateLeadByInstagram,
  captureDirectReply: vi.fn(async () => {}),
}));
const { findOrCreateLeadByMessenger } = vi.hoisted(() => ({
  findOrCreateLeadByMessenger: vi.fn(async () => ({ id: "lead-fb", name: "Ben", assignedToId: null })),
}));
vi.mock("@/lib/facebook", () => ({ findOrCreateLeadByMessenger, fetchLeadgenLead: vi.fn(), upsertLeadFromLeadgen: vi.fn() }));

const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: true })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
const { suppress, unsuppress } = vi.hoisted(() => ({ suppress: vi.fn(async () => {}), unsuppress: vi.fn(async () => {}) }));
vi.mock("@/lib/suppression", () => ({ suppress, unsuppress }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { scoreAndDraftForLead } = vi.hoisted(() => ({ scoreAndDraftForLead: vi.fn(async () => true) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
const { checkRapidEngagement } = vi.hoisted(() => ({ checkRapidEngagement: vi.fn(async () => {}) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

import { POST } from "@/app/api/instagram/webhook/route";
import { encodeQuickReplyPayload } from "@/lib/quickReplies";

function webhookRequest(payload: unknown) {
  return new NextRequest("https://followupbase.io/api/instagram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=stubbed" },
    body: JSON.stringify(payload),
  });
}

const ANSWER = encodeQuickReplyPayload({ touch: "unanswered", question: "availability_unanswered", answer: "morning", exit: false });
const EXIT = encodeQuickReplyPayload({ touch: "unanswered", question: "interest_last", answer: "not_now", exit: true });

function instagramTap(title: string, payload: string, mid = "mid_tap") {
  return {
    object: "instagram",
    entry: [{ id: "ig-account-1", messaging: [{ sender: { id: "igsid-1" }, recipient: { id: "ig-account-1" }, message: { mid, text: title, quick_reply: { payload } } }] }],
  };
}
function messengerTap(title: string, payload: string, mid = "mid_tap_fb") {
  return {
    object: "page",
    entry: [{ id: "page-1", messaging: [{ sender: { id: "psid-1" }, recipient: { id: "page-1" }, message: { mid, text: title, quick_reply: { payload } } }] }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  businessFindUnique.mockResolvedValue({ id: "biz1" });
  createInboundMessageIfNew.mockResolvedValue(true);
  findOrCreateLeadByInstagram.mockResolvedValue({ id: "lead-ig", name: "Aanya", assignedToId: "user1" });
  findOrCreateLeadByMessenger.mockResolvedValue({ id: "lead-fb", name: "Ben", assignedToId: null });
  userFindMany.mockResolvedValue([{ id: "admin1" }]);
});

describe("an answer chip on Instagram", () => {
  it("records the tap as an inbound message carrying its payload — this is what reopens Meta's window", async () => {
    await POST(webhookRequest(instagramTap("Morning", ANSWER)));
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Morning", expect.any(Date), "mid_tap", ANSWER);
  });

  it("never sends the instant acknowledgement in reply to a button press", async () => {
    await POST(webhookRequest(instagramTap("Morning", ANSWER)));
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("tells the assignee in one line, and hands the lead over for a fresh draft", async () => {
    await POST(webhookRequest(instagramTap("Morning", ANSWER)));
    expect(notificationCreate).toHaveBeenCalledWith({
      data: { userId: "user1", leadId: "lead-ig", message: expect.stringMatching(/Aanya tapped "Morning" on Instagram/) },
    });
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead-ig");
    expect(checkRapidEngagement).toHaveBeenCalledWith("lead-ig");
  });

  it("writes the decoded answer to the audit trail — which message, which question, which answer key", async () => {
    await POST(webhookRequest(instagramTap("Morning", ANSWER)));
    expect(recordAudit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: null },
      "lead.dm_answer",
      expect.objectContaining({ targetId: "lead-ig", meta: { channel: "instagram", touch: "unanswered", question: "availability_unanswered", answer: "morning" } })
    );
  });

  it("never treats a tapped title as an opt-out keyword, even if the chip said 'stop'", async () => {
    await POST(webhookRequest(instagramTap("Stop", ANSWER)));
    expect(suppress).not.toHaveBeenCalled();
  });

  it("does nothing twice when Meta redelivers the tap", async () => {
    createInboundMessageIfNew.mockResolvedValue(false);
    await POST(webhookRequest(instagramTap("Morning", ANSWER)));
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });
});

describe("the exit chip — 'Not now' stops everything", () => {
  it("sends nothing automatic: no acknowledgement, no draft, no engagement check", async () => {
    await POST(webhookRequest(instagramTap("Not now", EXIT)));
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
    expect(checkRapidEngagement).not.toHaveBeenCalled();
  });

  it("still records the tap, so the thread shows it and the engine can read it", async () => {
    await POST(webhookRequest(instagramTap("Not now", EXIT)));
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Not now", expect.any(Date), "mid_tap", EXIT);
  });

  it("tells the owner FollowUp has stopped and that the lead can write again any time", async () => {
    await POST(webhookRequest(instagramTap("Not now", EXIT)));
    expect(notificationCreate).toHaveBeenCalledWith({
      data: { userId: "user1", leadId: "lead-ig", message: 'Aanya tapped "Not now" on Instagram, so FollowUp has stopped. They can write again any time.' },
    });
  });

  it("is audited as an exit", async () => {
    await POST(webhookRequest(instagramTap("Not now", EXIT)));
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: null }, "lead.dm_exit", expect.objectContaining({ targetId: "lead-ig" }));
  });
});

describe("on Messenger", () => {
  it("handles an answer chip the same way, and reaches every admin when nobody is assigned", async () => {
    await POST(webhookRequest(messengerTap("Afternoon", ANSWER)));
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Afternoon", expect.any(Date), "mid_tap_fb", ANSWER);
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(notificationCreate).toHaveBeenCalledWith({
      data: { userId: "admin1", leadId: "lead-fb", message: expect.stringMatching(/Ben tapped "Afternoon" on Messenger/) },
    });
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead-fb");
  });

  it("stops on the exit chip", async () => {
    await POST(webhookRequest(messengerTap("Leave it", EXIT)));
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: null }, "lead.dm_exit", expect.anything());
  });
});

describe("a chip FollowUp did not write", () => {
  it("is treated as an ordinary typed message — acknowledged and scored like any other", async () => {
    await POST(webhookRequest(instagramTap("Book now", "SOME_OTHER_TOOLS_PAYLOAD")));
    // Stored with the foreign payload (it is still what Meta sent) ...
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Book now", expect.any(Date), "mid_tap", "SOME_OTHER_TOOLS_PAYLOAD");
    // ... but not routed as one of ours.
    expect(acknowledgeNewLead).toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalledWith(expect.anything(), "lead.dm_answer", expect.anything());
  });
});
