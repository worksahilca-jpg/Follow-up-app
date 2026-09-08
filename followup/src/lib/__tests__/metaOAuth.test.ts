/**
 * The one-click connect buttons only appear when both halves of a
 * credential pair are configured, and the auth URLs carry the right
 * scopes/state — get either wrong and a business either never sees the
 * button or gets sent to Meta with the wrong permissions requested.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { instagramOAuthAvailable, buildInstagramAuthUrl, exchangeInstagramAuthCode } from "@/lib/instagram";
import { facebookOAuthAvailable, buildFacebookAuthUrl, exchangeFacebookAuthCode } from "@/lib/facebook";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("Instagram one-click connect", () => {
  it("is unavailable until both the app id and secret are set", () => {
    expect(instagramOAuthAvailable()).toBe(false);
    vi.stubEnv("INSTAGRAM_APP_ID", "123");
    expect(instagramOAuthAvailable()).toBe(false);
    vi.stubEnv("INSTAGRAM_APP_SECRET", "shh");
    expect(instagramOAuthAvailable()).toBe(true);
  });

  it("builds an authorize URL with the messaging scopes, the redirect, and the CSRF state", () => {
    vi.stubEnv("INSTAGRAM_APP_ID", "123");
    const url = new URL(buildInstagramAuthUrl("https://followupbase.io/api/instagram/oauth/callback", "nonce1"));
    expect(url.hostname).toBe("www.instagram.com");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://followupbase.io/api/instagram/oauth/callback");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_manage_messages");
    expect(url.searchParams.get("state")).toBe("nonce1");
  });

  it("refuses to start an exchange when not configured, without making a network call", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await exchangeInstagramAuthCode("code", "https://followupbase.io/callback");
    expect(result).toEqual({ error: "Instagram sign-in isn't configured yet." });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Facebook one-click connect", () => {
  it("is unavailable until both the app id and secret are set", () => {
    expect(facebookOAuthAvailable()).toBe(false);
    vi.stubEnv("FACEBOOK_APP_ID", "456");
    expect(facebookOAuthAvailable()).toBe(false);
    vi.stubEnv("FACEBOOK_APP_SECRET", "shh");
    expect(facebookOAuthAvailable()).toBe(true);
  });

  it("builds an authorize URL with the Page + Lead Ads scopes", () => {
    vi.stubEnv("FACEBOOK_APP_ID", "456");
    const url = new URL(buildFacebookAuthUrl("https://followupbase.io/api/facebook/oauth/callback", "nonce2"));
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("scope")).toBe("pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,leads_retrieval");
    expect(url.searchParams.get("state")).toBe("nonce2");
  });

  it("refuses to start an exchange when not configured, without making a network call", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await exchangeFacebookAuthCode("code", "https://followupbase.io/callback");
    expect(result).toEqual({ error: "Facebook sign-in isn't configured yet." });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
