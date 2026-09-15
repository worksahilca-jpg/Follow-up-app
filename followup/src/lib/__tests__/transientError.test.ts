/**
 * Which automation failures get an early retry, and — more importantly —
 * which ones must not.
 *
 * Background (backlog B-001): the per-lead catch in automation.ts returned
 * `skipped` without releasing the atomic claim, so a lead that threw stayed
 * claimed for the full 20-hour recheck window while its badge went on saying
 * "Following up soon". One OpenAI 429 took a lead out of the running for the
 * rest of the day, silently.
 *
 * The fix releases the claim — but only for errors that actually resolve on
 * their own. Releasing on EVERY error would be worse than the bug it fixes: a
 * permanently-failing lead would be re-drafted hourly forever, paying for an
 * OpenAI call each time to produce a message that can never send. That is what
 * the "must NOT" cases below protect.
 */
import { describe, it, expect } from "vitest";
import { isTransientError } from "@/lib/automation";

describe("isTransientError", () => {
  it("retries a provider rate limit", () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError(new Error("Rate limit reached for gpt-4o"))).toBe(true);
  });

  it("retries an upstream 5xx", () => {
    expect(isTransientError({ status: 500 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError(new Error("Service Unavailable"))).toBe(true);
    expect(isTransientError(new Error("The server is overloaded"))).toBe(true);
  });

  it("retries a network or timeout failure", () => {
    expect(isTransientError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError({ code: "UND_ERR_CONNECT_TIMEOUT" })).toBe(true);
    expect(isTransientError(new Error("socket hang up"))).toBe(true);
    expect(isTransientError(new Error("Request timed out"))).toBe(true);
  });

  it("does NOT retry a permanent failure", () => {
    // Each of these would fail again identically on the next tick. Releasing
    // the claim for them means re-drafting this lead every hour, forever.
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 401 })).toBe(false);
    expect(isTransientError({ status: 403 })).toBe(false);
    expect(isTransientError({ status: 404 })).toBe(false);
    expect(isTransientError(new Error("Invalid recipient address"))).toBe(false);
    expect(isTransientError(new Error("Unsupported channel for this lead"))).toBe(false);
    expect(isTransientError(new Error("invalid_grant"))).toBe(false);
  });

  it("is safe on the shapes a catch block actually receives", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError({})).toBe(false);
    expect(isTransientError("timeout")).toBe(false); // a bare string has no .message
  });
});
