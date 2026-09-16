/**
 * What sendInstagramMessage / sendMessengerMessage put on the wire once
 * reply buttons exist (src/lib/instagram.ts, src/lib/facebook.ts): the
 * documented request shape, a pinned Graph version, Meta's limits enforced
 * before the call, and Meta's own error code/subcode kept on a failure
 * instead of thrown away (api-facts §D1–D3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { sendInstagramMessage } from "@/lib/instagram";
import { sendMessengerMessage } from "@/lib/facebook";

const fetchMock = vi.fn();
const chips = [
  { title: "Morning", payload: "fu1;unanswered;availability_unanswered;morning;a" },
  { title: "Afternoon", payload: "fu1;unanswered;availability_unanswered;afternoon;a" },
];

function okResponse() {
  return { ok: true, status: 200, json: async () => ({ message_id: "m1" }) };
}
function errorResponse(status: number, error: Record<string, unknown>) {
  return { ok: false, status, json: async () => ({ error }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockResolvedValue(okResponse());
  businessFindUnique.mockResolvedValue({
    instagramAccessToken: "ig-fake-token",
    instagramUserId: "17841400000000001",
    facebookPageId: "page-1",
    facebookPageAccessToken: "page-fake-token",
  });
});

function sentBody(): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe("Instagram", () => {
  it("posts to the pinned version and the stored IG user id, not an unversioned /me", async () => {
    await sendInstagramMessage("biz1", "igsid-1", "Morning or afternoon?", { quickReplies: chips });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/graph\.instagram\.com\/v\d+\.\d+\/17841400000000001\/messages\?/);
  });

  it("falls back to /me/messages for a business connected before the id was stored", async () => {
    businessFindUnique.mockResolvedValue({ instagramAccessToken: "ig-fake-token", instagramUserId: null });
    await sendInstagramMessage("biz1", "igsid-1", "Morning or afternoon?");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v\d+\.\d+\/me\/messages\?/);
  });

  it("sends the chips in Meta's exact shape beside the text", async () => {
    await sendInstagramMessage("biz1", "igsid-1", "Morning or afternoon?", { quickReplies: chips });
    expect(sentBody()).toEqual({
      recipient: { id: "igsid-1" },
      message: {
        text: "Morning or afternoon?",
        quick_replies: [
          { content_type: "text", title: "Morning", payload: chips[0].payload },
          { content_type: "text", title: "Afternoon", payload: chips[1].payload },
        ],
      },
    });
  });

  it("sends plain text with no quick_replies key at all when there are no chips", async () => {
    await sendInstagramMessage("biz1", "igsid-1", "Back to you shortly.");
    expect(sentBody()).toEqual({ recipient: { id: "igsid-1" }, message: { text: "Back to you shortly." } });
  });

  it("refuses a 21-character title before touching the network", async () => {
    const result = await sendInstagramMessage("biz1", "igsid-1", "Which?", { quickReplies: [{ title: "a".repeat(21), payload: "p" }] });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/longer than 20/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps Meta's code and subcode on a rejection — the closed-window pair is the first thing a live run has to see", async () => {
    fetchMock.mockResolvedValue(errorResponse(400, { message: "This message is sent outside of allowed window.", code: 10, error_subcode: 2018278 }));
    const result = await sendInstagramMessage("biz1", "igsid-1", "Still there?");
    expect(result).toEqual({ success: false, message: "This message is sent outside of allowed window.", status: 400, code: 10, subcode: 2018278 });
  });

  it("still returns a usable failure when Meta's error body is not JSON", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("not json"); } });
    const result = await sendInstagramMessage("biz1", "igsid-1", "Still there?");
    expect(result).toEqual({ success: false, message: "Instagram rejected this message.", status: 502, code: undefined, subcode: undefined });
  });
});

describe("Messenger", () => {
  it("sends the chips beside the text and keeps messaging_type RESPONSE — the in-window shape", async () => {
    await sendMessengerMessage("biz1", "psid-1", "Morning or afternoon?", { quickReplies: chips });
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/page-1\/messages\?/);
    expect(sentBody()).toEqual({
      recipient: { id: "psid-1" },
      messaging_type: "RESPONSE",
      message: {
        text: "Morning or afternoon?",
        quick_replies: [
          { content_type: "text", title: "Morning", payload: chips[0].payload },
          { content_type: "text", title: "Afternoon", payload: chips[1].payload },
        ],
      },
    });
  });

  it("never sends a message tag from this path", async () => {
    await sendMessengerMessage("biz1", "psid-1", "Morning or afternoon?", { quickReplies: chips });
    expect(sentBody()).not.toHaveProperty("tag");
  });

  it("refuses two chips with the same title before touching the network", async () => {
    const result = await sendMessengerMessage("biz1", "psid-1", "Which?", { quickReplies: [{ title: "Yes", payload: "p" }, { title: "yes", payload: "q" }] });
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps Meta's code and subcode on a rejection", async () => {
    fetchMock.mockResolvedValue(errorResponse(400, { message: "(#100) Unsupported message tag", code: 100 }));
    const result = await sendMessengerMessage("biz1", "psid-1", "Still there?");
    expect(result).toEqual({ success: false, message: "(#100) Unsupported message tag", status: 400, code: 100, subcode: undefined });
  });
});
