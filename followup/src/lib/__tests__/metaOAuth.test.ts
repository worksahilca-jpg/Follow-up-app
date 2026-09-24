/**
 * The one-click connect buttons only appear when both halves of a
 * credential pair are configured, and the auth URLs carry the right
 * scopes/state — get either wrong and a business either never sees the
 * button or gets sent to Meta with the wrong permissions requested.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import {
  facebookOAuthAvailable,
  buildFacebookAuthUrl,
  exchangeFacebookAuthCode,
  subscribeFacebookPageWebhooks,
} from "@/lib/facebook";

beforeEach(() => {
  vi.unstubAllEnvs();
});

// This file spies on global.fetch and on console in almost every test and
// never put them back. That was survivable while it was small — each new
// spy replaced the last — but it leaks a mocked fetch out of the file, and
// adding the long-lived-exchange tests below was enough to make two
// unrelated suites fail when the whole suite runs, while both still passed
// on their own. A spy that outlives its file is a test that fails somewhere
// it was never written about.
afterEach(() => {
  vi.restoreAllMocks();
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

  /**
   * The long-lived exchange, and the refusal that stopped the first live
   * connect.
   *
   * 2026-09-23, a brand-new demo account: the short-lived exchange
   * succeeded — so code, secret and redirect URI were all correct — and
   * then the LAST step returned "Unsupported request - method type: get".
   * That is Meta saying the path does not accept GET, which the
   * Instagram-Login endpoint does, so the likeliest reading is that this
   * app is registered on the Facebook-Login family instead.
   *
   * It could not be confirmed: Meta's docs are unreachable from the
   * sandbox, the Vercel log connector returns 403 for this project, and a
   * hand-built request proves nothing because a fabricated token fails
   * auth (190) before the path is evaluated. So both are tried, and these
   * pin the order and the reporting — one real connect then answers it.
   */
  describe("extending a short-lived token to a long-lived one", () => {
    const shortLivedOk = () => new Response(JSON.stringify({ access_token: "IGQV-short" }), { status: 200 });

    beforeEach(() => {
      vi.stubEnv("INSTAGRAM_APP_ID", "123");
      vi.stubEnv("INSTAGRAM_APP_SECRET", "shh");
    });

    it("tries Instagram first and stops there when it works", async () => {
      // The path that already works for the founder's own account must be
      // byte-for-byte unchanged, and must not make a second call.
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(shortLivedOk())
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "IGQV-long" }), { status: 200 }));

      expect(await exchangeInstagramAuthCode("code", "https://followupbase.io/cb")).toEqual({ accessToken: "IGQV-long" });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [second, init] = fetchSpy.mock.calls[1] as [string, RequestInit | undefined];
      expect(String(second)).toContain("graph.instagram.com/access_token");
      expect(String(second)).toContain("grant_type=ig_exchange_token");
      // GET: no init at all, so the documented path is byte-for-byte what
      // it always was for any account this already works for.
      expect(init).toBeUndefined();
    });

    it("retries the same address with POST when Meta refuses GET", async () => {
      // Meta's own words, verbatim, from the 2026-09-23 connect: the
      // address is right and the METHOD is wrong. The Facebook fallback
      // that used to sit here was disproved on 2026-09-24 by code 101
      // ("Error validating application") — Graph does not recognise this
      // app id at all, so it is not a Facebook-Login app. POST is what is
      // left.
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const refusal = new Response(
        JSON.stringify({ error: { message: "Unsupported request - method type: get", code: 100 } }),
        { status: 400 }
      );
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(shortLivedOk())
        .mockResolvedValueOnce(refusal)
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "IGQV-long" }), { status: 200 }));

      expect(await exchangeInstagramAuthCode("code", "https://followupbase.io/cb")).toEqual({ accessToken: "IGQV-long" });

      const [url, init] = fetchSpy.mock.calls[2] as [string, RequestInit];
      expect(String(url)).toBe("https://graph.instagram.com/access_token");
      expect(init.method).toBe("POST");
      // Same parameters as the GET, built once, so the two attempts can
      // never drift into asking Meta for different things.
      const body = new URLSearchParams(String(init.body));
      expect(body.get("grant_type")).toBe("ig_exchange_token");
      expect(body.get("access_token")).toBe("IGQV-short");
      expect(body.get("client_secret")).toBe("shh");
      // And the secret must not also be in the URL on the POST.
      expect(String(url)).not.toContain("shh");
    });

    it("names both hosts and both reasons when neither works", async () => {
      // The owner is the only route these reasons have to anyone who can
      // act on them — the log connector is 403 for this project. Detail
      // is correct HERE, on the connect path, and never on the send path
      // (see ownerFacingMetaError in metaGraph.ts).
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(shortLivedOk())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: "Unsupported request - method type: get", code: 100 } }), { status: 400 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } }), { status: 400 })
        );

      const message = (await exchangeInstagramAuthCode("code", "https://followupbase.io/cb")) as { error: string };
      expect(message.error).toContain("graph.instagram.com GET: 400 Unsupported request - method type: get");
      expect(message.error).toContain("graph.instagram.com POST: 400 Invalid OAuth access token");
      // The secret is in both request URLs and must be in neither answer.
      expect(message.error).not.toContain("shh");
    });

    it("keeps the app secret out of every failure it reports", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const deny = () => new Response(JSON.stringify({ error: { message: "nope", code: 1 } }), { status: 400 });
      vi.spyOn(global, "fetch").mockResolvedValueOnce(shortLivedOk()).mockResolvedValueOnce(deny()).mockResolvedValueOnce(deny());
      const result = (await exchangeInstagramAuthCode("code", "https://followupbase.io/cb")) as { error: string };
      expect(result.error).not.toContain("shh");
      expect(result.error).not.toContain("IGQV-short");
    });

    it("treats a 200 with no token as a failure rather than connecting with undefined", async () => {
      // Without this the caller stores `undefined` as the access token and
      // Settings reports a connected account that can never send.
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(shortLivedOk())
        .mockResolvedValueOnce(new Response(JSON.stringify({ expires_in: 5183944 }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ expires_in: 5183944 }), { status: 200 }));
      const result = await exchangeInstagramAuthCode("code", "https://followupbase.io/cb");
      expect("error" in result).toBe(true);
      expect((result as { error: string }).error).toContain("200 but no access_token");
    });
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

  /**
   * The call that was missing entirely until 2026-09-20. Instagram and
   * WhatsApp both subscribed the account they connected; Facebook saved
   * the Page's token and stopped, so every connected Page was silent —
   * no Messenger DM, no Lead Ad, and a green tick in Settings saying
   * otherwise.
   */
  it("subscribes the Page to BOTH messages and leadgen with the Page's own token", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    expect(await subscribeFacebookPageWebhooks("90210", "EAAG-page-tok")).toEqual({ ok: true });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/90210/subscribed_apps");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(String(init.body));
    // Messenger DMs and Lead Ads are both of what this channel promises;
    // subscribing to one and not the other half-connects it silently.
    expect(body.get("subscribed_fields")).toBe("messages,leadgen");
    expect(body.get("access_token")).toBe("EAAG-page-tok");
  });

  it("reports Meta's own refusal rather than a generic failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "(#200) Requires pages_manage_metadata permission", code: 200 } }), {
        status: 403,
      })
    );
    // The sentence names the missing permission, which is the thing the
    // owner (or Sahil) can act on; "couldn't subscribe" names nothing.
    expect(await subscribeFacebookPageWebhooks("90210", "EAAG-page-tok")).toEqual({
      ok: false,
      message: "(#200) Requires pages_manage_metadata permission",
    });
  });
});
