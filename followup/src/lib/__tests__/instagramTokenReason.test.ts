/**
 * The paste-a-token path has to say WHY Meta refused.
 *
 * 2026-09-24. A token generated from Meta's own "Generate access tokens"
 * panel was refused, and Settings said "That token didn't work — double-check
 * you copied the whole thing." The clipboard was fine. The advice was wrong,
 * and it was wrong in the most expensive way available: it sent the owner
 * back to re-copy a valid token instead of at the actual cause, on the one
 * screen people reach for precisely BECAUSE the OAuth button already failed
 * them.
 *
 * `resolveInstagramUserId` returned a bare `null`, so the route had nothing
 * truer to say. The OAuth path in the same file learned this twice already
 * (2026-09-19 on the short-lived exchange, 2026-09-23 on the long-lived one)
 * and both now carry Meta's sentence. This was the last surface still
 * failing blind.
 *
 * What these tests pin: Meta's reason reaches the owner, a valid token still
 * connects, and the token itself never appears in a refusal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  requireAdmin: vi.fn(async () => true),
}));
const { resolveInstagramUserId, activateInstagramWebhooks, unsubscribeInstagramWebhooks } = vi.hoisted(() => ({
  resolveInstagramUserId: vi.fn(),
  activateInstagramWebhooks: vi.fn(async () => ({ ok: true as const })),
  unsubscribeInstagramWebhooks: vi.fn(async () => undefined),
}));
const { businessUpdate, businessFindUnique } = vi.hoisted(() => ({
  businessUpdate: vi.fn(async () => ({})),
  businessFindUnique: vi.fn(async () => null),
}));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/instagram", () => ({
  resolveInstagramUserId,
  activateInstagramWebhooks,
  unsubscribeInstagramWebhooks,
  instagramOAuthAvailable: () => true,
  WEBHOOK_VERIFY_TOKEN: "verify",
}));
vi.mock("@/lib/db", () => ({
  prisma: { business: { update: businessUpdate, findUnique: businessFindUnique } },
}));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { POST } from "@/app/api/instagram/config/route";

const TOKEN = "IGQVJseKretTokenValue123";

const post = (accessToken: string) =>
  new NextRequest("https://followupbase.io/api/instagram/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

beforeEach(() => {
  businessUpdate.mockClear();
  resolveInstagramUserId.mockReset();
  requireAdmin.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe("pasting an Instagram access token", () => {
  it("tells the owner what Meta actually said, instead of blaming the clipboard", async () => {
    resolveInstagramUserId.mockResolvedValue({
      error: "https://graph.instagram.com/v21.0/me: 400 Unsupported request [100]",
    });

    const res = await POST(post(TOKEN));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    // Meta's own words, verbatim — the host, the status and the code are
    // each the thing that distinguishes one cause from another.
    expect(body.message).toContain("graph.instagram.com/v21.0/me");
    expect(body.message).toContain("400");
    expect(body.message).toContain("[100]");
    // And the advice that was actively misleading is gone.
    expect(body.message).not.toContain("copied the whole thing");
    // Nothing was saved on a refusal.
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("never echoes the token back in a refusal", async () => {
    resolveInstagramUserId.mockResolvedValue({ error: "some Meta reason" });
    const body = await (await POST(post(TOKEN))).json();
    expect(body.message).not.toContain(TOKEN);
  });

  it("still connects when the token is good", async () => {
    resolveInstagramUserId.mockResolvedValue({ id: "17841427527466039", username: "followupbase" });

    const res = await POST(post(TOKEN));
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
        data: expect.objectContaining({ instagramUserId: "17841427527466039" }),
      })
    );
  });

  it("does not treat an unreachable Meta as a bad token", async () => {
    resolveInstagramUserId.mockResolvedValue({
      error: "Couldn't reach https://graph.instagram.com/v21.0 at all.",
    });
    const body = await (await POST(post(TOKEN))).json();
    expect(body.message).toContain("Couldn't reach");
    expect(body.message).not.toContain("copied the whole thing");
  });
});
