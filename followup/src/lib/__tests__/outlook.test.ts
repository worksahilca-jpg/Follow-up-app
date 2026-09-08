/**
 * Outlook mirrors the Facebook/Instagram one-click-connect surface
 * (see metaOAuth.test.ts): the "Connect" button only appears once both
 * halves of the credential pair are set, and the auth URL carries the
 * right tenant, scopes, and CSRF state. Also covers the two places a
 * misconfigured or disconnected business must fail closed rather than
 * silently making a network call with no credentials.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { integration: { findFirst } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { outlookOAuthAvailable, buildOutlookAuthUrl, exchangeOutlookAuthCode, sendOutlookEmail } from "@/lib/integrations/outlook";

beforeEach(() => {
  vi.unstubAllEnvs();
  findFirst.mockReset();
  findFirst.mockResolvedValue(null); // no connection, by default
});

describe("Outlook one-click connect", () => {
  it("is unavailable until the client id, secret, and redirect URI are all set", () => {
    expect(outlookOAuthAvailable()).toBe(false);
    vi.stubEnv("MICROSOFT_CLIENT_ID", "abc");
    expect(outlookOAuthAvailable()).toBe(false);
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "shh");
    expect(outlookOAuthAvailable()).toBe(false);
    vi.stubEnv("MICROSOFT_REDIRECT_URI", "https://followupbase.io/api/integrations/outlook/callback");
    expect(outlookOAuthAvailable()).toBe(true);
  });

  it("builds an authorize URL on the common tenant with Mail scopes, the redirect, and CSRF state", () => {
    vi.stubEnv("MICROSOFT_CLIENT_ID", "abc");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "shh");
    vi.stubEnv("MICROSOFT_REDIRECT_URI", "https://followupbase.io/api/integrations/outlook/callback");
    const url = new URL(buildOutlookAuthUrl("onboarding"));
    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(url.pathname).toBe("/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("client_id")).toBe("abc");
    expect(url.searchParams.get("redirect_uri")).toBe("https://followupbase.io/api/integrations/outlook/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("offline_access openid email Mail.Read Mail.Send User.Read");
    expect(url.searchParams.get("state")).toBe("onboarding");
  });

  it("refuses to start a code exchange when not configured, without making a network call", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await expect(exchangeOutlookAuthCode("code", "user1")).rejects.toThrow("Outlook isn't configured.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Outlook sending", () => {
  it("fails safely (no crash, no network call) when the business has no connected Outlook", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await sendOutlookEmail("business1", { to: "lead@example.com", subject: "Hi", body: "Following up" });
    expect(result).toEqual({ success: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { provider: "outlook", status: "connected", user: { businessId: "business1" } } })
    );
  });
});
