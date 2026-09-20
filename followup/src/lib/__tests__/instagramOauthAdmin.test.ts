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
const { exchangeInstagramAuthCode, resolveInstagramUserId, activateInstagramWebhooks } = vi.hoisted(() => ({
  exchangeInstagramAuthCode: vi.fn(async () => ({ accessToken: "IGQV-long-lived" })),
  resolveInstagramUserId: vi.fn(async () => ({ id: "1784", username: "acme" })),
  // Renamed 2026-09-20: the callback now calls the wrapper that also
  // RECORDS the outcome (activateInstagramWebhooks). Not a behaviour
  // change to this file's subject — the admin gate is unchanged.
  activateInstagramWebhooks: vi.fn(async () => ({ ok: true as const })),
}));
const { businessUpdate } = vi.hoisted(() => ({ businessUpdate: vi.fn(async () => ({})) }));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/instagram", () => ({ exchangeInstagramAuthCode, resolveInstagramUserId, activateInstagramWebhooks }));
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

  // 2026-09-19: an account connected without this got no webhook for a
  // real DM. The subscription runs on the connected account with its own
  // token, and a refusal never undoes the connection.
  it("subscribes the connected account to message webhooks, and keeps the connection if Meta refuses", async () => {
    await GET(req(`${base}?code=AQ1&state=tok`, "ig_oauth_state=tok"));
    // Carries the businessId now, since the wrapper writes the result.
    expect(activateInstagramWebhooks).toHaveBeenCalledWith("b1", "1784", "IGQV-long-lived");

    activateInstagramWebhooks.mockResolvedValueOnce({ ok: false, message: "(#10) Permission denied" } as never);
    const res = await GET(req(`${base}?code=AQ1&state=tok`, "ig_oauth_state=tok"));
    expect(businessUpdate).toHaveBeenCalledTimes(2);
    expect(res.headers.get("location")).toContain("instagram=connected");
  });
});
