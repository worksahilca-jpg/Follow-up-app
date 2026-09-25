/**
 * An Instagram account that is connected but receiving nothing has to
 * say so.
 *
 * Found 2026-09-20, one day after the identical bug in Facebook (#282).
 * Both Instagram connect paths DID call subscribed_apps — unlike
 * Facebook, which never called it at all — but neither stored the
 * answer. A refusal was written into an audit row's meta field and
 * nowhere else, so Settings kept showing "Connected — real DMs will
 * become leads automatically" on an account Meta had declined to send
 * anything for. The connection looked identical whether it worked or not.
 *
 * WhatsApp is deliberately absent from this file: both of its connect
 * paths return 400 and save nothing when the subscription fails
 * (src/app/api/whatsapp/{connect,config}/route.ts), so it can never
 * reach this state and needs no column.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  requireAdmin: vi.fn(async () => true),
}));

// Typed explicitly: an untyped vi.fn() infers its narrowest return
// ({ ok: true }) and every refusal below then fails to typecheck.
type SubscribeResult = { ok: true } | { ok: false; message: string };
const { activateInstagramWebhooks, exchangeInstagramAuthCode, resolveInstagramUserId } = vi.hoisted(() => ({
  activateInstagramWebhooks: vi.fn<(b: string, id: string, t: string) => Promise<SubscribeResult>>(async () => ({ ok: true })),
  exchangeInstagramAuthCode: vi.fn(async () => ({ accessToken: "IGQV-long-lived" })),
  resolveInstagramUserId: vi.fn(async () => ({ id: "1784", username: "acme" })),
}));

type BusinessUpdateArgs = { where: { id: string }; data: Record<string, unknown> };
const { businessUpdate } = vi.hoisted(() => ({
  businessUpdate: vi.fn<(args: BusinessUpdateArgs) => Promise<unknown>>(async () => ({})),
}));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/instagram", () => ({
  activateInstagramWebhooks,
  exchangeInstagramAuthCode,
  resolveInstagramUserId,
  instagramOAuthAvailable: () => true,
  WEBHOOK_VERIFY_TOKEN: "verify-tok",
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate, findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null) } } }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { GET as oauthCallback } from "@/app/api/instagram/oauth/callback/route";
import { POST as saveToken } from "@/app/api/instagram/config/route";

const base = "https://followupbase.io/api/instagram/oauth/callback";

beforeEach(() => {
  activateInstagramWebhooks.mockClear().mockResolvedValue({ ok: true });
  businessUpdate.mockClear();
  requireAdmin.mockReset().mockResolvedValue(true);
});

describe("connecting Instagram through OAuth", () => {
  it("subscribes the account and records it against this business", async () => {
    await oauthCallback(new NextRequest(`${base}?code=AQ1&state=tok`, { headers: { cookie: "ig_oauth_state=tok" } }));
    expect(activateInstagramWebhooks).toHaveBeenCalledWith("b1", "1784", "IGQV-long-lived");
  });

  // The token is worth keeping even when the subscription fails: the
  // account is still readable, and the retry needs the token to exist.
  it("keeps the connection when Meta refuses", async () => {
    activateInstagramWebhooks.mockResolvedValue({ ok: false, message: "(#10) Permission denied" });
    const res = await oauthCallback(
      new NextRequest(`${base}?code=AQ1&state=tok`, { headers: { cookie: "ig_oauth_state=tok" } })
    );
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ instagramUserId: "1784" }) })
    );
    expect(res.headers.get("location")).not.toContain("instagram=error");
  });

  // Saved only on a confirmed success, so "connected" and "receiving"
  // can never be read as the same fact — and a previous account's
  // confirmation can never carry over to a new one.
  it("does not record a confirmation it never got", async () => {
    activateInstagramWebhooks.mockResolvedValue({ ok: false, message: "nope" });
    await oauthCallback(new NextRequest(`${base}?code=AQ1&state=tok`, { headers: { cookie: "ig_oauth_state=tok" } }));
    expect(businessUpdate.mock.calls[0][0].data.instagramWebhookSubscribedAt).toBeNull();
  });
});

describe("connecting Instagram with a pasted token", () => {
  const post = () =>
    saveToken(
      new NextRequest("https://followupbase.io/api/instagram/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: "IGQV-pasted" }),
      })
    );

  it("subscribes it too — a pasted token has the same permissions", async () => {
    await post();
    expect(activateInstagramWebhooks).toHaveBeenCalledWith("b1", "1784", "IGQV-pasted");
  });

  it("tells the caller whether the account is actually receiving, not just connected", async () => {
    activateInstagramWebhooks.mockResolvedValue({ ok: false, message: "nope" });
    const body = (await (await post()).json()) as { success: boolean; receiving: boolean };
    expect(body.success).toBe(true);
    expect(body.receiving).toBe(false);
  });
});
