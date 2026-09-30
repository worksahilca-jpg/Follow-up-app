/**
 * An Outlook reply still goes out after the owner files the customer's email.
 *
 * FollowUp answers an Outlook customer with Graph's
 * POST /me/messages/{id}/reply, using the message id stored when the email
 * was synced. Graph's default message ids are not stable: an id changes
 * when the message moves to another folder
 * (https://learn.microsoft.com/en-us/graph/outlook-immutable-id), which is
 * what Archive, a rule or dragging it to a folder all do. The stored id then
 * answers 404, and the send failed: every Approve & send to that customer
 * said "Outlook didn't confirm this message sent", and an automated
 * follow-up was retired as a permanent failure.
 *
 * Gmail's reply already falls back to a fresh email when the customer's
 * message can't be read (getGmailReplyHeaders); Outlook now does the same.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { integration: { findFirst: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { sendOutlookEmail } from "@/lib/integrations/outlook";

let calls: { url: string; body: unknown }[] = [];

function fakeGraph(replyStatus: number) {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes("/reply")) return new Response(replyStatus === 404 ? JSON.stringify({ error: { code: "ErrorItemNotFound" } }) : null, { status: replyStatus });
    if (url.endsWith("/me/sendMail")) return new Response(null, { status: 202 });
    return new Response("unexpected", { status: 500 });
  });
}

const params = { to: "jane@example.com", subject: "Following up on your inquiry, Jane", body: "Hi Jane, Tuesday at 10 works.", replyToMessageId: "AAMk-old-id" };

beforeEach(() => {
  calls = [];
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    accessToken: "access",
    refreshToken: "refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    accountEmail: "info@samsplumbing.ca",
    user: { email: "sam.smith@gmail.com" },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("replying to an Outlook customer", () => {
  it("replies in the thread when the stored message is still there", async () => {
    fakeGraph(202);
    expect(await sendOutlookEmail("biz1", params)).toEqual({ success: true });
    expect(calls.map((c) => c.url)).toEqual(["https://graph.microsoft.com/v1.0/me/messages/AAMk-old-id/reply"]);
  });

  it("sends a fresh email to the customer when that message has moved (404)", async () => {
    fakeGraph(404);
    const result = await sendOutlookEmail("biz1", params);

    expect(result).toEqual({ success: true });
    expect(calls.map((c) => c.url)).toEqual([
      "https://graph.microsoft.com/v1.0/me/messages/AAMk-old-id/reply",
      "https://graph.microsoft.com/v1.0/me/sendMail",
    ]);
    expect(calls[1].body).toEqual({
      message: {
        subject: "Following up on your inquiry, Jane",
        body: { contentType: "Text", content: "Hi Jane, Tuesday at 10 works." },
        toRecipients: [{ emailAddress: { address: "jane@example.com" } }],
      },
    });
  });

  it("any other refusal is still a failure, with Graph's status, and nothing else is sent", async () => {
    for (const status of [400, 403, 429, 503]) {
      calls = [];
      vi.restoreAllMocks();
      fakeGraph(status);
      expect(await sendOutlookEmail("biz1", params)).toEqual({ success: false, status });
      expect(calls).toHaveLength(1);
    }
  });
});
