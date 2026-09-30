/**
 * A newly connected Instagram account starts the poller fresh (audit
 * 2026-09-24 F6).
 *
 * Only the poller writes instagramSyncedAt, and nothing cleared it. So a
 * business that disconnected account A and later connected account B had
 * B polled from A's old cursor — floored at 24 hours, which bypasses the
 * 15-minute first-run lookback (src/lib/instagramPoll.ts). Up to a day of
 * B's DMs were imported as brand-new leads, each scored and drafted and
 * acknowledged as though it had just arrived.
 *
 * Reconnecting the SAME account keeps the cursor: that is a token swap,
 * and resetting it would open a gap between the last tick and the reconnect.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  requireAdmin: vi.fn(async () => true),
}));
const { resolveInstagramUserId } = vi.hoisted(() => ({ resolveInstagramUserId: vi.fn() }));
const { businessUpdate, businessFindUnique, businessFindFirst } = vi.hoisted(() => ({
  businessUpdate: vi.fn(async () => ({})),
  businessFindUnique: vi.fn(async (): Promise<unknown> => null),
  businessFindFirst: vi.fn(async () => null),
}));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/instagram", () => ({
  resolveInstagramUserId,
  activateInstagramWebhooks: vi.fn(async () => ({ ok: true as const })),
  unsubscribeInstagramWebhooks: vi.fn(async () => undefined),
  exchangeInstagramAuthCode: vi.fn(async () => ({ accessToken: "IGQV-long-lived" })),
  instagramOAuthAvailable: () => true,
  WEBHOOK_VERIFY_TOKEN: "verify",
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate, findUnique: businessFindUnique, findFirst: businessFindFirst } } }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { POST as pasteToken, DELETE as disconnect } from "@/app/api/instagram/config/route";
import { GET as oauthCallback } from "@/app/api/instagram/oauth/callback/route";

const ACCOUNT_A = { instagramUserId: "2869000000000001", instagramAccountId: "17841400000000001", instagramAccessToken: "IGQV-a" };
const ACCOUNT_B = { id: "2869000000000002", accountId: "17841400000000002", username: "account_b" };

const paste = () =>
  pasteToken(
    new NextRequest("https://followupbase.io/api/instagram/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "IGAAT-pasted" }),
    })
  );
const callback = () =>
  oauthCallback(
    new NextRequest("https://followupbase.io/api/instagram/oauth/callback?code=AQ1&state=tok", {
      headers: { cookie: "ig_oauth_state=tok" },
    })
  );

/** The data object of the one business.update the connect made. */
const written = () => (businessUpdate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;

beforeEach(() => {
  businessUpdate.mockReset().mockResolvedValue({});
  businessFindUnique.mockReset().mockResolvedValue(ACCOUNT_A);
  businessFindFirst.mockReset().mockResolvedValue(null);
  resolveInstagramUserId.mockReset().mockResolvedValue(ACCOUNT_B);
});

describe("connecting a different Instagram account", () => {
  it("clears the poll cursor when a pasted token is for another account", async () => {
    expect((await paste()).status).toBe(200);
    expect(written()).toEqual(expect.objectContaining({ instagramUserId: ACCOUNT_B.id, instagramSyncedAt: null }));
  });

  it("clears the poll cursor when OAuth connects another account", async () => {
    expect((await callback()).headers.get("location")).toContain("instagram=connected");
    expect(written()).toEqual(expect.objectContaining({ instagramUserId: ACCOUNT_B.id, instagramSyncedAt: null }));
  });

  it("clears it on a business that had no account connected before, too", async () => {
    businessFindUnique.mockResolvedValue({ instagramUserId: null, instagramAccountId: null });
    await paste();
    expect(written()).toEqual(expect.objectContaining({ instagramSyncedAt: null }));
  });
});

describe("reconnecting the same account", () => {
  it("keeps the cursor, so the minutes between the last poll and the reconnect are still read", async () => {
    resolveInstagramUserId.mockResolvedValue({ id: ACCOUNT_A.instagramUserId, accountId: ACCOUNT_A.instagramAccountId, username: "account_a" });
    await paste();
    expect(written()).not.toHaveProperty("instagramSyncedAt");
  });
});

describe("disconnecting", () => {
  it("clears the poll cursor with the ids, so the next account starts fresh", async () => {
    await disconnect();
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({ instagramUserId: null, instagramSyncedAt: null }),
    });
  });
});
