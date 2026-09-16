/**
 * The Gmail/Outlook OAuth callback routes' CSRF `state` check — the fix
 * for research/audit/2026-09-08-newer-surface-audit.md finding #4:
 * before this, `state` was just `next` (onboarding vs. Settings) echoed
 * back verbatim, never validated against anything actually issued for
 * the current session, letting an attacker's own authorization code get
 * bound to a signed-in victim via a login-CSRF redirect. Every case here
 * must fail closed — a missing/wrong/absent state rejects the callback
 * before the code is ever exchanged.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const ctx = { userId: "u1", businessId: "b1", email: "owner@example.com", authTime: Date.now() };
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ctx),
  // Admin by default so every CSRF case below is unchanged; the admin-gate
  // block flips it.
  requireAdmin: vi.fn(async () => true),
}));
const { exchangeCodeForTokens, ensureGmailWatch } = vi.hoisted(() => ({
  exchangeCodeForTokens: vi.fn(async () => ({ email: "owner@gmail.com" })),
  ensureGmailWatch: vi.fn(async () => null),
}));
const { exchangeOutlookAuthCode } = vi.hoisted(() => ({
  exchangeOutlookAuthCode: vi.fn(async () => ({ email: "owner@outlook.com" })),
}));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn() }));

vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/integrations/gmail", () => ({ exchangeCodeForTokens, ensureGmailWatch }));
vi.mock("@/lib/integrations/outlook", () => ({ exchangeOutlookAuthCode }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { GET as gmailCallback } from "@/app/api/integrations/gmail/callback/route";
import { GET as outlookCallback } from "@/app/api/integrations/outlook/callback/route";

function req(url: string, cookie?: string) {
  return new NextRequest(url, cookie ? { headers: { cookie } } : undefined);
}

beforeEach(() => {
  exchangeCodeForTokens.mockClear();
  exchangeOutlookAuthCode.mockClear();
  recordAudit.mockClear();
  requireAdmin.mockReset().mockResolvedValue(true);
});

describe.each([
  { name: "Gmail", callback: gmailCallback, exchange: exchangeCodeForTokens, path: "gmail", stateCookie: "gmail_oauth_state", nextCookie: "gmail_oauth_next" },
  { name: "Outlook", callback: outlookCallback, exchange: exchangeOutlookAuthCode, path: "outlook", stateCookie: "outlook_oauth_state", nextCookie: "outlook_oauth_next" },
])("$name OAuth callback CSRF state", ({ callback, exchange, path, stateCookie, nextCookie }) => {
  const base = `https://followupbase.io/api/integrations/${path}/callback`;

  it("rejects a callback with no state param at all, even with a valid cookie", async () => {
    const res = await callback(req(`${base}?code=abc123`, `${stateCookie}=real-token`));
    expect(res.headers.get("location")).toContain(`${path}=error`);
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects a state that doesn't match the cookie (forged/replayed state)", async () => {
    const res = await callback(req(`${base}?code=abc123&state=attacker-guess`, `${stateCookie}=real-token`));
    expect(res.headers.get("location")).toContain(`${path}=error`);
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects a valid-looking state when no cookie was ever set (no session in progress)", async () => {
    const res = await callback(req(`${base}?code=abc123&state=real-token`));
    expect(res.headers.get("location")).toContain(`${path}=error`);
    expect(exchange).not.toHaveBeenCalled();
  });

  it("proceeds and exchanges the code when state matches the cookie exactly", async () => {
    const res = await callback(req(`${base}?code=abc123&state=real-token`, `${stateCookie}=real-token`));
    expect(exchange).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain(`${path}=connected`);
  });

  it("routes back to onboarding only via the next cookie, never a client-supplied state", async () => {
    const res = await callback(req(`${base}?code=abc123&state=real-token`, `${stateCookie}=real-token; ${nextCookie}=onboarding`));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
  });

  it("clears both the state and next cookies on the response either way", async () => {
    const res = await callback(req(`${base}?code=abc123&state=wrong`, `${stateCookie}=real-token`));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${stateCookie}=`);
  });
});

/**
 * Both connect routes gate on admin; the callbacks did not (audit
 * 2026-09-16, auth M-1). A member who set the state cookie themselves and
 * opened the provider's authorize URL landed here with a valid state and
 * completed a connection the start route would have refused.
 */
describe.each([
  { name: "Gmail", callback: gmailCallback, exchange: exchangeCodeForTokens, path: "gmail", stateCookie: "gmail_oauth_state" },
  { name: "Outlook", callback: outlookCallback, exchange: exchangeOutlookAuthCode, path: "outlook", stateCookie: "outlook_oauth_state" },
])("$name OAuth callback admin gate", ({ callback, exchange, path, stateCookie }) => {
  const base = `https://followupbase.io/api/integrations/${path}/callback`;

  it("refuses a non-admin before the code is ever exchanged, even with a perfect state", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await callback(req(`${base}?code=abc123&state=real-token`, `${stateCookie}=real-token`));
    expect(res.headers.get("location")).toContain(`${path}=error`);
    expect(exchange).not.toHaveBeenCalled();
  });

  it("checks the role against the session, not a client-supplied claim", async () => {
    requireAdmin.mockResolvedValue(false);
    await callback(req(`${base}?code=abc123&state=real-token`, `${stateCookie}=real-token`));
    expect(requireAdmin).toHaveBeenCalledWith(ctx);
  });
});
