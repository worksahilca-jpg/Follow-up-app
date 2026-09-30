/**
 * The rate-limit retry (src/lib/rateLimitRetry.ts). Every test injects its
 * own sleep and randomness, so nothing waits and nothing is left to chance.
 */
import { describe, it, expect, vi } from "vitest";
import { isRateLimitError, rateLimitDelayMs, retryAfterMs, withRateLimitRetry } from "@/lib/rateLimitRetry";

/** Shaped like the OpenAI SDK's RateLimitError: status 429, a fetch Headers. */
const rateLimited = (headers: Record<string, string> = {}) =>
  Object.assign(new Error("429 Rate limit reached for gpt-4o-mini"), { status: 429, headers: new Headers(headers) });

describe("isRateLimitError", () => {
  it("knows a 429 by its status, its code, or its words", () => {
    expect(isRateLimitError(rateLimited())).toBe(true);
    expect(isRateLimitError({ code: "rate_limit_exceeded" })).toBe(true);
    expect(isRateLimitError(new Error("Rate limit reached for requests"))).toBe(true);
  });

  it("does not wait on an account that is out of credit, which is a 429 too", () => {
    expect(isRateLimitError(Object.assign(rateLimited(), { code: "insufficient_quota" }))).toBe(false);
    expect(isRateLimitError(Object.assign(rateLimited(), { error: { code: "insufficient_quota" } }))).toBe(false);
  });

  it("leaves every other failure alone", () => {
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError(new Error("OpenAI returned no content"))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError("429")).toBe(false);
  });
});

describe("retryAfterMs", () => {
  it("reads retry-after-ms first, then retry-after in seconds", () => {
    expect(retryAfterMs(rateLimited({ "retry-after-ms": "1500", "retry-after": "9" }))).toBe(1500);
    expect(retryAfterMs(rateLimited({ "retry-after": "2" }))).toBe(2000);
  });

  it("reads retry-after as an HTTP date", () => {
    const now = Date.parse("2026-09-30T12:00:00Z");
    expect(retryAfterMs(rateLimited({ "retry-after": "Wed, 30 Sep 2026 12:00:05 GMT" }), now)).toBe(5000);
  });

  it("reads a plain-object header map too", () => {
    expect(retryAfterMs({ status: 429, headers: { "retry-after": "3" } })).toBe(3000);
  });

  it("is null when the provider said nothing usable", () => {
    expect(retryAfterMs(rateLimited())).toBeNull();
    expect(retryAfterMs(rateLimited({ "retry-after": "soon" }))).toBeNull();
    expect(retryAfterMs(new Error("x"))).toBeNull();
  });
});

describe("rateLimitDelayMs", () => {
  it("doubles each retry, with half of each step jittered", () => {
    const opts = { baseDelayMs: 1000, maxDelayMs: 60_000 };
    expect(rateLimitDelayMs(rateLimited(), 0, { ...opts, random: () => 0 })).toBe(500);
    expect(rateLimitDelayMs(rateLimited(), 0, { ...opts, random: () => 0.999999 })).toBe(1000);
    expect(rateLimitDelayMs(rateLimited(), 3, { ...opts, random: () => 0 })).toBe(4000);
    expect(rateLimitDelayMs(rateLimited(), 3, { ...opts, random: () => 0.999999 })).toBe(8000);
  });

  it("never waits longer than the cap, even when asked to", () => {
    expect(rateLimitDelayMs(rateLimited(), 20, { baseDelayMs: 1000, maxDelayMs: 30_000, random: () => 0.999999 })).toBe(30_000);
    expect(rateLimitDelayMs(rateLimited({ "retry-after": "600" }), 0, { maxDelayMs: 30_000 })).toBe(30_000);
  });

  it("uses the provider's retry-after as given, without jitter", () => {
    expect(rateLimitDelayMs(rateLimited({ "retry-after": "4" }), 0, { random: () => 0 })).toBe(4000);
  });
});

describe("withRateLimitRetry", () => {
  it("returns the answer that follows a 429, having waited once", async () => {
    const fn = vi.fn().mockRejectedValueOnce(rateLimited()).mockResolvedValueOnce("ok");
    const sleep = vi.fn(async () => {});
    await expect(withRateLimitRetry(fn, { sleep, random: () => 0.5 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries and throws the provider's own error", async () => {
    const err = rateLimited();
    const fn = vi.fn().mockRejectedValue(err);
    const sleep = vi.fn(async () => {});
    await expect(withRateLimitRetry(fn, { sleep, maxRetries: 2 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry anything that is not a rate limit", async () => {
    const err = Object.assign(new Error("Bad request"), { status: 400 });
    const fn = vi.fn().mockRejectedValue(err);
    const sleep = vi.fn(async () => {});
    await expect(withRateLimitRetry(fn, { sleep })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
