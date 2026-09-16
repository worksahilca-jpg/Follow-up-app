/**
 * The Instagram OAuth callback's admin gate (audit 2026-09-16, Meta surface
 * #2). The start route refused non-admins; the callback took any session.
 * A member could set the ig_oauth_state cookie in devtools, open the
 * authorize URL with the public app id, and overwrite the business's
 * Instagram connection with their own account.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "member@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  requireAdmin: vi.fn(async () => true),
}));
const { exchangeInstagramAuthCode, resolveInstagramUserId } = vi.hoisted(() => ({
  exchangeInstagramAuthCode: vi.fn(async () => ({ accessToken: "IGQV-long-lived" })),
  resolveInstagramUserId: vi.fn(async () => ({ id: "1784", username: "acme" })),
}));
const { businessUpdate } = vi.hoisted(() => ({ businessUpdate: vi.fn(async () => ({})) }));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/instagram", () => ({ exchangeInstagramAuthCode, resolveInstagramUserId }));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate } } }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { GET } from "@/app/api/instagram/oauth/callback/route";

const base = "https://followupbase.io/api/instagram/oauth/callback";
const req = (url: string, cookie?: string) => new NextRequest(url, cookie ? { headers: { cookie } } : undefined);

beforeEach(() => {
  exchangeInstagramAuthCode.mockClear();
  businessUpdate.mockClear();
  requireAdmin.mockReset().mockResolvedValue(true);
});

describe("Instagram OAuth callback admin gate", () => {
  it("refuses a non-admin before exchanging the code or touching the business", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await GET(req(`${base}?code=AQ1&state=tok`, "ig_oauth_state=tok"));
    expect(res.headers.get("location")).toContain("instagram=error");
    expect(exchangeInstagramAuthCode).not.toHaveBeenCalled();
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("still completes for an admin with a matching state", async () => {
    const res = await GET(req(`${base}?code=AQ1&state=tok`, "ig_oauth_state=tok"));
    expect(exchangeInstagramAuthCode).toHaveBeenCalled();
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "b1" } }));
    expect(res.headers.get("location")).not.toContain("instagram=error");
  });
});
