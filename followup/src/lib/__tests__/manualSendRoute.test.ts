/**
 * POST /api/leads/[id]/send is the one place a signed-in person has the
 * whole message in front of them and taps Send for it — so it is the one
 * caller allowed to hand sendFollowUpToLead a `humanSend` with the acting
 * user's id, which is what lets an Instagram/Messenger reply go out
 * between 24 hours and 7 days under Meta's human-agent tag (api-facts
 * §B5: human-sent, one tap per message, a real user on the record). The
 * audit row must carry the tag beside that user.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "user1", businessId: "biz1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn(async () => ctx) }));
type Result = { success: boolean; message?: string; failure?: string; messagingTag?: "HUMAN_AGENT" };
const { sendFollowUpToLead } = vi.hoisted(() => ({ sendFollowUpToLead: vi.fn(async (): Promise<Result> => ({ success: true })) }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => {}) }));

vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: vi.fn(async () => "") }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
const { messageFindFirst } = vi.hoisted(() => ({ messageFindFirst: vi.fn(async (): Promise<{ sentAt: Date } | null> => null) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findFirst: vi.fn(async () => ({ id: "lead1" })), findUnique: vi.fn(async () => ({ name: "Jane Doe" })) },
    message: { findFirst: messageFindFirst },
  },
}));

import { POST } from "@/app/api/leads/[id]/send/route";

function post(body: unknown) {
  return POST(
    new NextRequest("https://followupbase.io/api/leads/lead1/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "lead1" }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sendFollowUpToLead.mockResolvedValue({ success: true });
  messageFindFirst.mockResolvedValue(null);
});

describe("the manual send route", () => {
  it("hands the send engine the acting user, as a manual, non-automated send", async () => {
    await post({ message: "Here's the quote you asked for." });
    expect(sendFollowUpToLead).toHaveBeenCalledWith("lead1", "Here's the quote you asked for.", { trigger: "manual", subject: undefined, humanSend: { userId: "user1" } });
    const options = (sendFollowUpToLead.mock.calls[0] as unknown as [string, string, Record<string, unknown>])[2];
    expect(options.automated).toBeUndefined();
  });

  it("records the human-agent tag in the audit trail beside the person who sent it", async () => {
    sendFollowUpToLead.mockResolvedValue({ success: true, messagingTag: "HUMAN_AGENT" });
    const res = await post({ message: "Here's the quote you asked for." });
    expect(res.status).toBe(200);
    expect(recordAudit).toHaveBeenCalledWith(ctx, "lead.send", { targetType: "lead", targetId: "lead1", meta: { length: 31, messagingTag: "HUMAN_AGENT" } });
  });

  it("records a plain in-window send without a tag", async () => {
    await post({ message: "Yes, Saturday works." });
    expect(recordAudit).toHaveBeenCalledWith(ctx, "lead.send", { targetType: "lead", targetId: "lead1", meta: { length: 20 } });
  });

  it("returns the engine's own sentence when the window has closed, so the owner reads why", async () => {
    sendFollowUpToLead.mockResolvedValue({ success: false, failure: "refused", message: "Aanya last wrote on Instagram more than 7 days ago — Meta doesn't allow a business to message them now." });
    const res = await post({ message: "Still there?" });
    expect(res.status).toBe(500);
    expect((await res.json()).message).toMatch(/more than 7 days ago/);
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

/**
 * Daily-path audit 2026-09-25 F7: the lead wrote again after the owner
 * opened the card or the lead page. What was on screen answers a
 * conversation that has moved on, so nothing is sent.
 */
describe("a send against a conversation that has moved on", () => {
  const SEEN = "2026-09-25T13:00:00.000Z";

  it("is refused with a 409 and nothing is sent when the lead wrote after what was on screen", async () => {
    messageFindFirst.mockResolvedValue({ sentAt: new Date("2026-09-25T13:20:00.000Z") });
    const res = await post({ message: "Tuesday at 3 works.", seenInboundAt: SEEN });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body).toEqual(expect.objectContaining({ success: false, stale: true, message: expect.stringContaining("Jane wrote again") }));
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect(messageFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { direction: "inbound", sentAt: { gt: new Date(SEEN) }, conversation: { leadId: "lead1" } },
    }));
  });

  it("goes through when nothing newer has arrived", async () => {
    const res = await post({ message: "Tuesday at 3 works.", seenInboundAt: SEEN });
    expect(res.status).toBe(200);
    expect(sendFollowUpToLead).toHaveBeenCalled();
  });

  it("behaves exactly as before when the caller doesn't say what it saw", async () => {
    messageFindFirst.mockResolvedValue({ sentAt: new Date() });
    const res = await post({ message: "Tuesday at 3 works." });
    expect(res.status).toBe(200);
    expect(messageFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a malformed timestamp instead of guessing", async () => {
    const res = await post({ message: "Tuesday at 3 works.", seenInboundAt: "yesterday" });
    expect(res.status).toBe(400);
    expect(sendFollowUpToLead).not.toHaveBeenCalled();
  });
});
