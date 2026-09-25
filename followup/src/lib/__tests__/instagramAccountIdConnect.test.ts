/**
 * Both ways of connecting Instagram store the professional-account id
 * beside the app-scoped one, in the same write; disconnect clears it; and
 * the "already connected elsewhere" refusal covers the new unique column
 * as well as the old one (audit 2026-09-24 F1).
 *
 * Same write, because the two ids and the token describe one account:
 * a professional id left over from a previous connection, next to a new
 * account's token, would route the old account's webhooks to this
 * business.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  requireAdmin: vi.fn(async () => true),
}));
const { resolveInstagramUserId, activateInstagramWebhooks, unsubscribeInstagramWebhooks, exchangeInstagramAuthCode } = vi.hoisted(() => ({
  resolveInstagramUserId: vi.fn(),
  activateInstagramWebhooks: vi.fn(async () => ({ ok: true as const })),
  unsubscribeInstagramWebhooks: vi.fn(async () => undefined),
  exchangeInstagramAuthCode: vi.fn(async () => ({ accessToken: "IGQV-long-lived" })),
}));
const { businessUpdate, businessFindUnique, businessFindFirst } = vi.hoisted(() => ({
  businessUpdate: vi.fn(async () => ({})),
  businessFindUnique: vi.fn(async () => null),
  businessFindFirst: vi.fn(async () => null),
}));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/instagram", () => ({
  resolveInstagramUserId,
  activateInstagramWebhooks,
  unsubscribeInstagramWebhooks,
  exchangeInstagramAuthCode,
  instagramOAuthAvailable: () => true,
  WEBHOOK_VERIFY_TOKEN: "verify",
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate, findUnique: businessFindUnique, findFirst: businessFindFirst } } }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { POST as pasteToken, DELETE as disconnect } from "@/app/api/instagram/config/route";
import { GET as oauthCallback } from "@/app/api/instagram/oauth/callback/route";

const APP_SCOPED = "28693476873589439";
const PROFESSIONAL = "17841427527466039";

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
// What Prisma throws when the NEW unique index is the one that refuses.
const accountIdTaken = () =>
  Object.assign(new Error("Unique constraint failed on the fields: (`instagramAccountId`)"), {
    code: "P2002",
    meta: { target: ["instagramAccountId"] },
  });

beforeEach(() => {
  businessUpdate.mockReset().mockResolvedValue({});
  businessFindUnique.mockReset().mockResolvedValue(null);
  businessFindFirst.mockReset().mockResolvedValue(null);
  resolveInstagramUserId.mockReset().mockResolvedValue({ id: APP_SCOPED, accountId: PROFESSIONAL, username: "followupbase" });
  requireAdmin.mockReset().mockResolvedValue(true);
});

describe("pasting a token", () => {
  it("stores the professional-account id in the same write as the app-scoped id and the token", async () => {
    const res = await paste();
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledTimes(1);
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({
        instagramAccessToken: "IGAAT-pasted",
        instagramUserId: APP_SCOPED,
        instagramAccountId: PROFESSIONAL,
      }),
    });
  });

  it("writes null, not a previous account's id, when Meta returns no user_id", async () => {
    resolveInstagramUserId.mockResolvedValue({ id: APP_SCOPED, username: "followupbase" });
    await paste();
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ instagramUserId: APP_SCOPED, instagramAccountId: null }) })
    );
  });

  it("says the account is connected elsewhere when the professional-account id is the one already taken", async () => {
    businessUpdate.mockRejectedValueOnce(accountIdTaken());
    const res = await paste();
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body).toEqual({ success: false, message: expect.stringContaining("already connected to a different FollowUp account") });
    // Nothing downstream ran for a connection that was not saved.
    expect(activateInstagramWebhooks).not.toHaveBeenCalled();
  });
});

describe("connecting with OAuth", () => {
  it("stores the professional-account id in the same write as the app-scoped id and the token", async () => {
    const res = await callback();
    expect(res.headers.get("location")).toContain("instagram=connected");
    expect(businessUpdate).toHaveBeenCalledTimes(1);
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({
        instagramAccessToken: "IGQV-long-lived",
        instagramUserId: APP_SCOPED,
        instagramAccountId: PROFESSIONAL,
      }),
    });
  });

  it("writes null when Meta returns no user_id", async () => {
    resolveInstagramUserId.mockResolvedValue({ id: APP_SCOPED });
    await callback();
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ instagramAccountId: null }) }));
  });

  it("refuses with 'already connected' when the professional-account id is the one already taken", async () => {
    businessUpdate.mockRejectedValueOnce(accountIdTaken());
    const res = await callback();
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("instagram=error");
    expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain("already connected to another FollowUp account");
  });
});

/**
 * pr324-review P5: resolveInstagramUserId retries without `user_id` on ANY
 * 400, so a reconnect of the very same account could come back without the
 * professional id and blank the one webhooks route on.
 */
describe("reconnecting the same account when Meta leaves out user_id", () => {
  const stored = { instagramUserId: APP_SCOPED, instagramAccountId: PROFESSIONAL };

  it("keeps the stored professional-account id on a pasted token", async () => {
    businessFindUnique.mockResolvedValue(stored as never);
    resolveInstagramUserId.mockResolvedValue({ id: APP_SCOPED, username: "followupbase" });
    const res = await paste();
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ instagramUserId: APP_SCOPED, instagramAccountId: PROFESSIONAL }) })
    );
  });

  it("keeps it through OAuth too", async () => {
    businessFindUnique.mockResolvedValue(stored as never);
    resolveInstagramUserId.mockResolvedValue({ id: APP_SCOPED });
    await callback();
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ instagramAccountId: PROFESSIONAL }) }));
  });

  it("still writes null when it is a DIFFERENT account with no user_id", async () => {
    businessFindUnique.mockResolvedValue(stored as never);
    resolveInstagramUserId.mockResolvedValue({ id: "29999999999999999" });
    await paste();
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ instagramUserId: "29999999999999999", instagramAccountId: null }) })
    );
  });

  it("takes Meta's user_id over the stored one when Meta does return it", async () => {
    businessFindUnique.mockResolvedValue({ instagramUserId: APP_SCOPED, instagramAccountId: "17841400000000009" } as never);
    await paste();
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ instagramAccountId: PROFESSIONAL }) }));
  });
});

/**
 * pr324-review P4: each id column is unique on its own, so an account id
 * sitting in the OTHER column of another business clashed with nothing and
 * the same account could be saved twice.
 */
describe("an account another business holds in the other id column", () => {
  it("is refused on paste before anything is written", async () => {
    businessFindFirst.mockResolvedValue({ id: "b2" } as never);
    const res = await paste();
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.message).toContain("already connected to a different FollowUp account");
    expect(businessUpdate).not.toHaveBeenCalled();
    expect(activateInstagramWebhooks).not.toHaveBeenCalled();
  });

  it("is refused through OAuth before anything is written", async () => {
    businessFindFirst.mockResolvedValue({ id: "b2" } as never);
    const res = await callback();
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("instagram=error");
    expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain("already connected to another FollowUp account");
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("checks both ids in both columns, and never counts this business", async () => {
    await paste();
    expect(businessFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: "b1" },
          OR: [{ instagramUserId: { in: [APP_SCOPED, PROFESSIONAL] } }, { instagramAccountId: { in: [APP_SCOPED, PROFESSIONAL] } }],
        },
      })
    );
  });
});

describe("disconnecting", () => {
  it("clears the professional-account id with the rest of the connection", async () => {
    businessFindUnique.mockResolvedValue({ instagramUserId: APP_SCOPED, instagramAccessToken: "IGQV-tok" } as never);
    await disconnect();
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({ instagramAccessToken: null, instagramUserId: null, instagramAccountId: null }),
    });
  });
});
