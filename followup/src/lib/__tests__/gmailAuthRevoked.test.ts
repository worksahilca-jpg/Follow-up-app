/**
 * A revoked Gmail grant must stop reporting as a healthy connection.
 *
 * `invalid_grant` is Google saying the stored refresh token is dead — the
 * owner removed FollowUp's access, changed their password, the token went
 * unused for six months, or (while the OAuth app is in Testing mode) the
 * seven-day test-token expiry fired. It never recovers on its own.
 *
 * Before this, nothing detected it. The Integration row stayed
 * `status: "connected"`, so Settings said Connected, the dashboard said
 * "watching your inbox", and the ten-minute cron re-failed forever. The owner
 * believed leads were being captured while they were being missed — which is
 * the worst possible shape for a failure in a product whose entire promise is
 * that nothing gets missed.
 *
 * A real production error on 2026-09-15 01:09 UTC is what surfaced it.
 */
import { describe, it, expect } from "vitest";
import { isAuthRevoked } from "@/lib/integrations/gmail";

describe("isAuthRevoked", () => {
  // googleapis puts this in different places depending on which call failed,
  // so the detector checks all of them rather than assuming one shape.
  it("detects invalid_grant on the error message", () => {
    expect(isAuthRevoked(new Error("invalid_grant"))).toBe(true);
    expect(
      isAuthRevoked(new Error("Error refreshing access token: invalid_grant (Token has been expired or revoked.)"))
    ).toBe(true);
  });

  it("detects invalid_grant nested in a googleapis response payload", () => {
    expect(isAuthRevoked({ response: { data: { error: "invalid_grant" } } })).toBe(true);
  });

  it("does NOT fire on failures that are worth retrying", () => {
    // These come back in ten minutes and usually succeed. Treating one of
    // them as a revoked grant would disconnect a working inbox and make the
    // owner re-authorise for nothing.
    expect(isAuthRevoked(new Error("Rate Limit Exceeded"))).toBe(false);
    expect(isAuthRevoked(new Error("ETIMEDOUT"))).toBe(false);
    expect(isAuthRevoked(new Error("Backend Error"))).toBe(false);
    expect(isAuthRevoked({ response: { data: { error: "invalid_request" } } })).toBe(false);
  });

  it("is safe on the shapes a catch block actually receives", () => {
    expect(isAuthRevoked(null)).toBe(false);
    expect(isAuthRevoked(undefined)).toBe(false);
    expect(isAuthRevoked("invalid_grant")).toBe(false); // a bare string has no .message
    expect(isAuthRevoked({})).toBe(false);
  });
});
