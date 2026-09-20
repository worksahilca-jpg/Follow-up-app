/**
 * Every way a Facebook Page gets connected has to subscribe it.
 *
 * Found 2026-09-20. All three connect paths — the OAuth callback when the
 * person manages one Page, the picker when they manage several, and a
 * pasted Page token — saved the token and stopped. Meta only delivers a
 * Page's Messenger DMs and Lead Ads to an app listed under that Page's
 * own subscribed_apps, so every Page connected through any of them was
 * silent, while Settings showed a green "Connected" tick claiming that
 * DMs and lead forms "become leads automatically". Instagram and
 * WhatsApp both made the equivalent call; Facebook never did.
 *
 * These are route-level on purpose. A unit test on the helper would have
 * passed happily while no route called it, which is precisely the bug.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  requireAdmin: vi.fn(async () => true),
}));
// Typed explicitly: an untyped vi.fn() infers its narrowest return
// ({ ok: true }), and every mockResolvedValue of a refusal below then
// fails to typecheck. Same trap betaPlan.test.ts documents.
type SubscribeResult = { ok: true } | { ok: false; message: string };
const { activateFacebookPageWebhooks, exchangeFacebookAuthCode, resolveFacebookPage, facebookOAuthAvailable } = vi.hoisted(() => ({
  activateFacebookPageWebhooks: vi.fn<(businessId: string, pageId: string, token: string) => Promise<SubscribeResult>>(
    async () => ({ ok: true })
  ),
  exchangeFacebookAuthCode: vi.fn(async () => ({ pages: [{ id: "90210", name: "Acme Cleaning", accessToken: "EAAG-page" }] })),
  resolveFacebookPage: vi.fn(async () => ({ id: "90210", name: "Acme Cleaning" })),
  facebookOAuthAvailable: vi.fn(() => true),
}));
// Typed for the same reason: an untyped vi.fn() gives mock.calls the
// empty tuple type, which tsc rejects on indexing.
type BusinessUpdateArgs = { where: { id: string }; data: Record<string, unknown> };
const { businessUpdate } = vi.hoisted(() => ({
  businessUpdate: vi.fn<(args: BusinessUpdateArgs) => Promise<unknown>>(async () => ({})),
}));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/facebook", () => ({
  activateFacebookPageWebhooks,
  exchangeFacebookAuthCode,
  resolveFacebookPage,
  facebookOAuthAvailable,
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate, findUnique: vi.fn(async () => null) } } }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/instagram", () => ({ WEBHOOK_VERIFY_TOKEN: "verify-tok" }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/crypto", () => ({
  encryptSecret: (s: string) => s,
  decryptSecret: (s: string) => s,
}));

import { GET as oauthCallback } from "@/app/api/facebook/oauth/callback/route";
import { POST as selectPage } from "@/app/api/facebook/oauth/select-page/route";
import { POST as saveToken } from "@/app/api/facebook/config/route";

const json = (url: string, body: unknown, cookie?: string) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  activateFacebookPageWebhooks.mockClear().mockResolvedValue({ ok: true });
  businessUpdate.mockClear();
  requireAdmin.mockReset().mockResolvedValue(true);
});

describe("connecting a Page through OAuth, when the person manages exactly one", () => {
  const base = "https://followupbase.io/api/facebook/oauth/callback";

  it("subscribes that Page to its webhooks", async () => {
    await oauthCallback(new NextRequest(`${base}?code=AQ1&state=tok`, { headers: { cookie: "fb_oauth_state=tok" } }));
    expect(activateFacebookPageWebhooks).toHaveBeenCalledWith("b1", "90210", "EAAG-page");
  });

  // The token is worth keeping even when the subscription fails: the
  // Page is still readable, the owner can still send from it, and the
  // retry in Settings needs the token to exist.
  it("keeps the connection when Meta refuses the subscription", async () => {
    activateFacebookPageWebhooks.mockResolvedValue({ ok: false, message: "(#200) Requires pages_manage_metadata permission" });
    const res = await oauthCallback(
      new NextRequest(`${base}?code=AQ1&state=tok`, { headers: { cookie: "fb_oauth_state=tok" } })
    );
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facebookPageId: "90210" }) })
    );
    expect(res.headers.get("location")).not.toContain("facebook=error");
  });

  // Saved only on a confirmed success, so "connected" and "receiving"
  // can never be read as the same fact.
  it("does not record a confirmation it never got", async () => {
    activateFacebookPageWebhooks.mockResolvedValue({ ok: false, message: "nope" });
    await oauthCallback(new NextRequest(`${base}?code=AQ1&state=tok`, { headers: { cookie: "fb_oauth_state=tok" } }));
    expect(businessUpdate.mock.calls[0][0].data.facebookWebhookSubscribedAt).toBeNull();
  });
});

describe("connecting a Page through the picker, when the person manages several", () => {
  const pages = JSON.stringify([{ id: "90210", name: "Acme Cleaning", accessToken: "EAAG-page" }]);

  it("subscribes the chosen Page", async () => {
    await selectPage(
      json("https://followupbase.io/api/facebook/oauth/select-page", { pageId: "90210" }, `fb_pending_pages=${pages}`)
    );
    expect(activateFacebookPageWebhooks).toHaveBeenCalledWith("b1", "90210", "EAAG-page");
  });
});

describe("connecting a Page with a pasted token", () => {
  it("subscribes it too — a pasted token has the same permissions as an OAuth one", async () => {
    await saveToken(json("https://followupbase.io/api/facebook/config", { accessToken: "EAAG-pasted" }));
    expect(activateFacebookPageWebhooks).toHaveBeenCalledWith("b1", "90210", "EAAG-pasted");
  });

  it("tells the caller whether the Page is actually receiving, not just connected", async () => {
    activateFacebookPageWebhooks.mockResolvedValue({ ok: false, message: "nope" });
    const res = await saveToken(json("https://followupbase.io/api/facebook/config", { accessToken: "EAAG-pasted" }));
    const body = (await res.json()) as { success: boolean; receiving: boolean };
    expect(body.success).toBe(true);
    expect(body.receiving).toBe(false);
  });
});
