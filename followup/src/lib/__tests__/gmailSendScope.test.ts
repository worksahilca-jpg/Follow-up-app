/** Sentry FOLLOW-UP-APP-1 (2026-10-05): a Gmail connected without the send permission. */
import { describe, it, expect } from "vitest";
import { isMissingScopeError } from "@/lib/integrations/gmail";

describe("isMissingScopeError", () => {
  it("recognises Google's missing-permission errors", () => {
    expect(isMissingScopeError(new Error("Request had insufficient authentication scopes."))).toBe(true);
    expect(isMissingScopeError({ message: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" })).toBe(true);
    expect(isMissingScopeError({ code: 403, message: "Forbidden", errors: [{ reason: "insufficientPermissions" }] })).toBe(true);
  });
  it("leaves other failures alone", () => {
    expect(isMissingScopeError(new Error("invalid_grant"))).toBe(false);
    expect(isMissingScopeError({ code: 403, message: "Rate limit", errors: [{ reason: "rateLimitExceeded" }] })).toBe(false);
    expect(isMissingScopeError(null)).toBe(false);
  });
});
