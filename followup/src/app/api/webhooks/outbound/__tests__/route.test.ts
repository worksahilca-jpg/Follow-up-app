/**
 * task: the outbound webhook decides where a copy of every lead event is
 * POSTed, and that payload carries the lead's name, email, phone and deal
 * value (src/lib/outboundWebhook.ts). Until the 2026-09-15 bug hunt
 * (research/audit/2026-09-15-bug-hunt.md, finding 1) this endpoint checked
 * only that the caller was signed in — and team invites default to SALES
 * (prisma/schema.prisma) — so any teammate could redirect the whole book to
 * a server they controlled, with nothing written to the audit log.
 *
 * These tests pin the gate itself, not the SSRF checks around it (those are
 * covered in src/lib/__tests__/ssrf.test.ts): a non-admin must never be able
 * to set, clear, or test-fire the URL, and an admin doing it must leave an
 * audit record.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, businessUpdate } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  businessUpdate: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique, update: businessUpdate } } }));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "user1", email: "owner@acme.com" })),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

const { assertSafeWebhookUrl } = vi.hoisted(() => ({
  assertSafeWebhookUrl: vi.fn(async (u: string) => new URL(u)),
}));
vi.mock("@/lib/ssrf", () => ({
  assertSafeWebhookUrl,
  UnsafeWebhookUrlError: class extends Error {},
}));

import { POST, PUT } from "@/app/api/webhooks/outbound/route";

function postRequest(body: unknown) {
  return new Request("https://followupbase.io/api/webhooks/outbound", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  requireAdmin.mockResolvedValue(true);
  businessFindUnique.mockResolvedValue({ outboundWebhookUrl: "https://hooks.zapier.com/abc" });
  assertSafeWebhookUrl.mockImplementation(async (u: string) => new URL(u));
});

describe("POST /api/webhooks/outbound — admin gate", () => {
  it("refuses a non-admin and does not touch the saved URL", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await POST(postRequest({ url: "https://attacker.example/collect" }));
    expect(res.status).toBe(403);
    expect(businessUpdate).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("refuses a non-admin trying to CLEAR the URL too", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await POST(postRequest({ url: null }));
    expect(res.status).toBe(403);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("refuses when nobody is signed in", async () => {
    getSessionContext.mockResolvedValue(null as never);
    const res = await POST(postRequest({ url: "https://hooks.zapier.com/abc" }));
    expect(res.status).toBe(401);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("lets an admin set it, and writes an audit record", async () => {
    const res = await POST(postRequest({ url: "https://hooks.zapier.com/abc" }));
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { outboundWebhookUrl: "https://hooks.zapier.com/abc" } })
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      "integration.outbound_webhook.update",
      expect.anything()
    );
  });

  it("audits the host only — a webhook URL's path routinely carries a secret", async () => {
    await POST(postRequest({ url: "https://hooks.zapier.com/hooks/catch/123/s3cr3t-token" }));
    const meta = recordAudit.mock.calls[0][2] as { meta?: Record<string, unknown> };
    expect(meta.meta).toEqual({ host: "hooks.zapier.com" });
    expect(JSON.stringify(meta)).not.toContain("s3cr3t-token");
  });

  it("lets an admin clear it, and audits that too", async () => {
    const res = await POST(postRequest({ url: null }));
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { outboundWebhookUrl: null } })
    );
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "integration.outbound_webhook.clear");
  });
});

describe("PUT /api/webhooks/outbound — test-fire is gated the same way", () => {
  it("refuses a non-admin before it reaches the saved URL", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await PUT();
    expect(res.status).toBe(403);
    // Never got as far as reading (or fetching) the URL — this handler is
    // otherwise a reachability oracle for whatever is saved.
    expect(businessFindUnique).not.toHaveBeenCalled();
    expect(assertSafeWebhookUrl).not.toHaveBeenCalled();
  });
});
