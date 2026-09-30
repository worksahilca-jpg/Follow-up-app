/**
 * The lead webhook link (founder, 2026-09-30): anyone holding it can add
 * leads to the account, so only admins see it. A solo owner is their
 * account's admin, so it stays theirs; a teammate only learns it's set.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique, update: vi.fn() } } }));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "user1", email: "owner@acme.com" })),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/reauth", () => ({ requireRecentAuth: vi.fn(() => null) }));
vi.mock("@/lib/siteUrl", () => ({ inboundBaseUrl: () => "https://followupbase.io" }));

import { GET } from "@/app/api/webhooks/config/route";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(true);
  businessFindUnique.mockResolvedValue({ webhookSecret: "s3cret" });
});

describe("GET /api/webhooks/config — admins only", () => {
  it("shows an admin the link", async () => {
    expect(await (await GET()).json()).toEqual({ success: true, webhookUrl: "https://followupbase.io/api/webhooks/lead/s3cret" });
  });

  it("never shows a teammate the link, only that one is set", async () => {
    requireAdmin.mockResolvedValue(false);
    const body = await (await GET()).json();
    expect(body).toEqual({ success: true, webhookUrl: null, set: true, adminOnly: true });
    expect(JSON.stringify(body)).not.toContain("s3cret");
  });

  it("tells a teammate when nothing is set up", async () => {
    requireAdmin.mockResolvedValue(false);
    businessFindUnique.mockResolvedValue({ webhookSecret: null });
    expect(await (await GET()).json()).toEqual({ success: true, webhookUrl: null, set: false, adminOnly: true });
  });
});
