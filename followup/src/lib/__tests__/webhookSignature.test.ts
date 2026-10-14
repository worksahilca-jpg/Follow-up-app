/**
 * Signed lead events (A-252): the app receiving FollowUp's events can check
 * each one came from FollowUp, unchanged, and recently.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: h.findUnique, updateMany: h.updateMany } } }));
vi.mock("@/lib/ssrf", () => ({ postJsonToTenantUrl: h.post }));

import { newWebhookSecret, signatureHeader, verifySignature, SIGNATURE_HEADER } from "@/lib/webhookSignature";
import { notifyLeadEvent } from "@/lib/outboundWebhook";

const secret = "whsec_test_secret";
const body = JSON.stringify({ event: "lead.created", leadId: "lead1", name: "Nadia Khan" });
const now = Date.parse("2026-10-14T18:00:00Z");

describe("the signature", () => {
  it("checks out for the exact body, with the same secret, made just now", () => {
    expect(verifySignature(secret, body, signatureHeader(secret, body, now), now + 2_000)).toBe(true);
  });

  it("fails when the body was changed on the way", () => {
    const header = signatureHeader(secret, body, now);
    expect(verifySignature(secret, body.replace("Nadia", "Mallory"), header, now)).toBe(false);
  });

  it("fails with another secret, and with no header at all", () => {
    expect(verifySignature("whsec_other", body, signatureHeader(secret, body, now), now)).toBe(false);
    expect(verifySignature(secret, body, null, now)).toBe(false);
    expect(verifySignature(secret, body, "garbage", now)).toBe(false);
  });

  it("fails for an old event replayed later (over five minutes)", () => {
    const header = signatureHeader(secret, body, now);
    expect(verifySignature(secret, body, header, now + 4 * 60_000)).toBe(true);
    expect(verifySignature(secret, body, header, now + 6 * 60_000)).toBe(false);
  });

  it("makes a different, long secret each time", () => {
    const a = newWebhookSecret();
    expect(a).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    expect(newWebhookSecret()).not.toBe(a);
  });
});

describe("notifyLeadEvent", () => {
  const lead = { id: "lead1", name: "Nadia Khan", email: "n@example.com", phone: null, source: "Web", stage: "NEW", dealValue: 0, createdAt: new Date(now) } as const;

  beforeEach(() => {
    vi.resetAllMocks();
    h.post.mockResolvedValue({ status: 200 });
    h.updateMany.mockResolvedValue({ count: 1 });
  });

  it("signs every event with the business's secret, over the exact body sent", async () => {
    h.findUnique.mockResolvedValue({ outboundWebhookUrl: "https://hooks.zapier.com/abc", outboundWebhookSecret: secret });
    await notifyLeadEvent("biz1", "lead.created", lead as never);
    const [url, payload, opts] = h.post.mock.calls[0];
    expect(url).toBe("https://hooks.zapier.com/abc");
    const sent = JSON.stringify(payload);
    const headers = opts.headersFor(sent);
    expect(headers["X-FollowUp-Event"]).toBe("lead.created");
    expect(headers["X-FollowUp-Delivery"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(verifySignature(secret, sent, headers[SIGNATURE_HEADER])).toBe(true);
  });

  it("makes the secret on the first event for a link saved before events were signed", async () => {
    h.findUnique.mockResolvedValue({ outboundWebhookUrl: "https://hooks.zapier.com/abc", outboundWebhookSecret: null });
    await notifyLeadEvent("biz1", "lead.created", lead as never);
    const made = h.updateMany.mock.calls[0][0].data.outboundWebhookSecret;
    const sent = JSON.stringify(h.post.mock.calls[0][1]);
    expect(verifySignature(made, sent, h.post.mock.calls[0][2].headersFor(sent)[SIGNATURE_HEADER])).toBe(true);
  });

  it("sends nothing, and makes no secret, when no link is saved", async () => {
    h.findUnique.mockResolvedValue({ outboundWebhookUrl: null, outboundWebhookSecret: null });
    await notifyLeadEvent("biz1", "lead.created", lead as never);
    expect(h.post).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});
