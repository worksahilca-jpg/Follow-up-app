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

import {
  instagramOAuthAvailable,
  buildInstagramAuthUrl,
  exchangeInstagramAuthCode,
  subscribeInstagramWebhooks,
  instagramDiagnostics,
} from "@/lib/instagram";
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

  // The first live connect (2026-09-19) failed with Meta's redirect_uri
  // sentence. The code sends one string at both ends, so the only useful
  // thing the settings line can add is that string and Meta's numeric
  // code — the owner compares it against the console; nothing secret.
  it("names the redirect address and Meta's code when the exchange is refused for a redirect mismatch", async () => {
    vi.stubEnv("INSTAGRAM_APP_ID", "123");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "shh");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = {
      error_type: "OAuthException",
      code: 400,
      error_message:
        "Error validating verification code. Please make sure your redirect_uri is identical to the one you used in the OAuth dialog request",
    };
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 400 }));
    const result = await exchangeInstagramAuthCode("code", "https://followupbase.io/api/instagram/oauth/callback");
    expect("error" in result).toBe(true);
    const message = (result as { error: string }).error;
    expect(message).toContain("Instagram said: Error validating verification code");
    expect(message).toContain("[400]");
    expect(message).toContain("The address we sent is https://followupbase.io/api/instagram/oauth/callback");
    expect(message).not.toContain("shh");
  });

  it("subscribes the account to the messages field with its own token, and reports Meta's refusal", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    expect(await subscribeInstagramWebhooks("1784", "IGQV-tok")).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.instagram.com/v21.0/1784/subscribed_apps");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("subscribed_fields")).toBe("messages");
    expect(body.get("access_token")).toBe("IGQV-tok");

    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "(#10) Permission denied", code: 10 } }), { status: 403 })
    );
    expect(await subscribeInstagramWebhooks("1784", "IGQV-tok")).toEqual({ ok: false, message: "(#10) Permission denied [10]" });
  });

  it("diagnostics ask Meta who is connected, what is subscribed and whether DMs are readable, without leaking the token", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/me?")) return new Response(JSON.stringify({ id: "1784", username: "followupbase", account_type: "BUSINESS" }));
      if (url.includes("/subscribed_apps")) return new Response(JSON.stringify({ data: [{ id: "app1", subscribed_fields: ["messages"] }] }));
      return new Response(JSON.stringify({ error: { message: "(#10) Permission denied", code: 10 } }), { status: 403 });
    });
    const report = await instagramDiagnostics("1784", "IGQV-secret");
    expect(report.account).toEqual({ ok: true, data: { id: "1784", username: "followupbase", account_type: "BUSINESS" } });
    expect(report.subscription).toEqual({ ok: true, data: { data: [{ id: "app1", subscribed_fields: ["messages"] }] } });
    expect(report.conversations).toEqual({ ok: false, error: "HTTP 403 — (#10) Permission denied [10]" });
    expect(JSON.stringify(report)).not.toContain("IGQV-secret");
    for (const [url] of fetchSpy.mock.calls) expect(String(url)).toContain("access_token=IGQV-secret");
  });

  it("does not add the address hint for an unrelated refusal", async () => {
    vi.stubEnv("INSTAGRAM_APP_ID", "123");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "shh");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = { error: { message: "Invalid platform app", type: "OAuthException", code: 190, error_subcode: 460 } };
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 400 }));
    const result = await exchangeInstagramAuthCode("code", "https://followupbase.io/api/instagram/oauth/callback");
    const message = (result as { error: string }).error;
    expect(message).toContain("Instagram said: Invalid platform app [190/460]");
    expect(message).not.toContain("The address we sent");
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
