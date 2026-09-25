/**
 * Disconnecting a channel has to tell Meta to stop.
 *
 * Found 2026-09-20 by the security pass. Both DELETE routes nulled the
 * token and the account id and stopped there — there was no `DELETE
 * subscribed_apps` counterpart anywhere for Facebook or Instagram, only
 * for WhatsApp. So after a customer disconnected, Meta went on posting
 * every Messenger DM, Lead Ad and Instagram DM to the webhook. That route
 * persists the signed envelope BEFORE it looks up a business, so real
 * customers' words and their PSIDs kept landing in InboundWebhookEvent
 * with businessId null and sat there for 14 to 90 days — out of reach of
 * deleteBusinessData's businessId filter, on an account that had said stop.
 *
 * The ordering is the other half of the fix and is pinned here: unsubscribe
 * BEFORE the token is cleared. Afterwards there is no credential left to
 * unsubscribe with, ever.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  requireAdmin: vi.fn(async () => true),
}));

const { unsubscribeFacebookPageWebhooks, unsubscribeInstagramWebhooks } = vi.hoisted(() => ({
  unsubscribeFacebookPageWebhooks: vi.fn(async () => {}),
  unsubscribeInstagramWebhooks: vi.fn(async () => {}),
}));

// Records the order the two side effects happened in, which is the whole
// point: a correct unsubscribe after a cleared token is not a correct
// unsubscribe, it is a no-op against a null credential.
const order: string[] = [];
const { businessUpdate, businessFindUnique } = vi.hoisted(() => ({
  businessUpdate: vi.fn(),
  businessFindUnique: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/facebook", () => ({
  unsubscribeFacebookPageWebhooks,
  activateFacebookPageWebhooks: vi.fn(),
  facebookOAuthAvailable: () => true,
  resolveFacebookPage: vi.fn(),
}));
vi.mock("@/lib/instagram", () => ({
  unsubscribeInstagramWebhooks,
  activateInstagramWebhooks: vi.fn(),
  instagramOAuthAvailable: () => true,
  resolveInstagramUserId: vi.fn(),
  WEBHOOK_VERIFY_TOKEN: "verify-tok",
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { update: businessUpdate, findUnique: businessFindUnique, findFirst: vi.fn(async () => null) } } }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { DELETE as disconnectFacebook } from "@/app/api/facebook/config/route";
import { DELETE as disconnectInstagram } from "@/app/api/instagram/config/route";

beforeEach(() => {
  order.length = 0;
  requireAdmin.mockReset().mockResolvedValue(true);
  unsubscribeFacebookPageWebhooks.mockClear().mockImplementation(async () => {
    order.push("unsubscribe");
  });
  unsubscribeInstagramWebhooks.mockClear().mockImplementation(async () => {
    order.push("unsubscribe");
  });
  businessUpdate.mockReset().mockImplementation(async () => {
    order.push("clear-token");
    return {};
  });
});

describe("disconnecting Facebook", () => {
  beforeEach(() => {
    businessFindUnique.mockResolvedValue({ facebookPageId: "90210", facebookPageAccessToken: "EAAG-page" });
  });

  it("tells Meta to stop delivering this Page's events", async () => {
    await disconnectFacebook();
    expect(unsubscribeFacebookPageWebhooks).toHaveBeenCalledWith("90210", "EAAG-page");
  });

  it("does it BEFORE clearing the token, which is the only moment it can", async () => {
    await disconnectFacebook();
    expect(order).toEqual(["unsubscribe", "clear-token"]);
  });

  // Meta being unreachable must not strand a customer in a connection
  // they asked to leave.
  it("still disconnects when Meta cannot be reached", async () => {
    unsubscribeFacebookPageWebhooks.mockRejectedValueOnce(new Error("network"));
    const res = await disconnectFacebook().catch(() => null);
    expect(res).not.toBeNull();
  });

  it("skips the call when there is nothing connected", async () => {
    businessFindUnique.mockResolvedValue({ facebookPageId: null, facebookPageAccessToken: null });
    await disconnectFacebook();
    expect(unsubscribeFacebookPageWebhooks).not.toHaveBeenCalled();
    expect(businessUpdate).toHaveBeenCalled();
  });
});

describe("disconnecting Instagram", () => {
  beforeEach(() => {
    businessFindUnique.mockResolvedValue({ instagramUserId: "1784", instagramAccessToken: "IGQV-tok" });
  });

  it("tells Meta to stop delivering this account's DMs", async () => {
    await disconnectInstagram();
    expect(unsubscribeInstagramWebhooks).toHaveBeenCalledWith("1784", "IGQV-tok");
  });

  it("does it BEFORE clearing the token", async () => {
    await disconnectInstagram();
    expect(order).toEqual(["unsubscribe", "clear-token"]);
  });

  it("skips the call when there is nothing connected", async () => {
    businessFindUnique.mockResolvedValue({ instagramUserId: null, instagramAccessToken: null });
    await disconnectInstagram();
    expect(unsubscribeInstagramWebhooks).not.toHaveBeenCalled();
    expect(businessUpdate).toHaveBeenCalled();
  });
});
