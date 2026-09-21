/**
 * Where a connect flow puts you back down (src/lib/oauthReturn.ts).
 *
 * This exists because onboarding now asks "where do your leads come
 * from?" and offers Instagram and Facebook alongside email. Both of those
 * callbacks used to send everyone to /settings unconditionally — which
 * during onboarding does not merely lose the flow, it cannot work at all:
 * the (app) layout redirects a business that has not finished onboarding
 * straight back to /onboarding. The owner would press Connect, authorise
 * Meta, and arrive back at the same step with no message and no sign that
 * anything had happened.
 */
import { describe, it, expect } from "vitest";
import { oauthNextCookie, oauthReturnUrl, OAUTH_COOKIE_OPTS } from "@/lib/oauthReturn";

const BASE = "https://www.followupbase.io";

describe("oauthReturnUrl", () => {
  it("returns to onboarding when that is where Connect was pressed", () => {
    const url = oauthReturnUrl("onboarding", "social", BASE);
    expect(url.pathname).toBe("/onboarding");
  });

  it("returns to Settings by default, on the tab the section lives in", () => {
    const url = oauthReturnUrl(undefined, "social", BASE);
    expect(url.pathname).toBe("/settings");
    // Settings opens the tab the hash names (SECTION_TAB in settings/page.tsx).
    // Without it the outcome renders on a tab nobody is looking at.
    expect(url.hash).toBe("#social");
  });

  it("carries no hash to onboarding, which has no tabs", () => {
    expect(oauthReturnUrl("onboarding", "social", BASE).hash).toBe("");
  });

  /**
   * The cookie is attacker-settable in principle, so this is an allow-list
   * of two known pages rather than a redirect to whatever it says. That is
   * the difference between resuming a flow and an open redirect.
   */
  it("sends anything other than 'onboarding' to Settings, never to itself", () => {
    for (const hostile of [
      "https://evil.example.com",
      "//evil.example.com",
      "/dashboard",
      "onboarding ",
      "ONBOARDING",
      "",
    ]) {
      const url = oauthReturnUrl(hostile, "social", BASE);
      expect(url.origin).toBe(BASE);
      expect(url.pathname).toBe("/settings");
    }
  });

  it("keeps query params the caller adds, so the outcome can be reported", () => {
    const url = oauthReturnUrl("onboarding", "social", BASE);
    url.searchParams.set("instagram", "error");
    url.searchParams.set("message", "Only an admin can connect Instagram");
    expect(url.searchParams.get("instagram")).toBe("error");
    expect(url.toString()).toContain("/onboarding?");
  });
});

describe("the cookie the connect route sets", () => {
  it("is namespaced per provider, so two flows in flight cannot cross", () => {
    expect(oauthNextCookie("ig")).toBe("ig_oauth_next");
    expect(oauthNextCookie("fb")).toBe("fb_oauth_next");
    expect(oauthNextCookie("ig")).not.toBe(oauthNextCookie("fb"));
  });

  it("is httpOnly, secure and short-lived", () => {
    // It rides beside an OAuth state cookie and outlives nothing: a stale
    // `next` would resume a flow the owner abandoned.
    expect(OAUTH_COOKIE_OPTS.httpOnly).toBe(true);
    expect(OAUTH_COOKIE_OPTS.secure).toBe(true);
    expect(OAUTH_COOKIE_OPTS.sameSite).toBe("lax");
    expect(OAUTH_COOKIE_OPTS.maxAge).toBeLessThanOrEqual(600);
  });
});
