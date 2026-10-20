/**
 * Retry a call that a provider refused with "429 rate limit reached" —
 * and only that.
 *
 * Why this exists: the lead-check eval (src/lib/classifierEval.ts) runs
 * about a hundred cases against the real model, and one run reported 20 of
 * them as errors, every one a 429. Those were not answers the classifier
 * got wrong, they were answers it was never allowed to give, and a report
 * that mixes the two cannot be read. The OpenAI SDK's own two quick
 * retries (half a second to a few seconds) are not enough once a whole
 * batch hits the per-minute limit together.
 *
 * Deliberately narrower than isTransientError (src/lib/transientError.ts):
 * that one also says yes to 5xx and timeouts, which is right for "try the
 * lead again next tick" but wrong for "wait and try again inside this one
 * request". A 429 with code `insufficient_quota` is also refused — the
 * account is out of credit, and no amount of waiting fixes that.
 *
 * A zero-dependency leaf module, so anything can use it without pulling in
 * the OpenAI client or Prisma.
 */

export type RateLimitRetryOptions = {
  /** Retries after the first attempt. The call runs at most maxRetries + 1 times. */
  maxRetries?: number;
  /** First backoff step, doubled each retry. */
  baseDelayMs?: number;
  /** No single wait is longer than this, including one a retry-after asked for. */
  maxDelayMs?: number;
  /** Injected in tests so they never actually wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected in tests so the jitter is predictable. Returns [0, 1). */
  random?: () => number;
  /** Which errors are worth waiting out. isRateLimitError unless given. */
  isRetryable?: (err: unknown) => boolean;
};

export const RATE_LIMIT_RETRY_DEFAULTS = {
  maxRetries: 4,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
} as const;

type ErrorShape = { status?: unknown; code?: unknown; message?: unknown; headers?: unknown; error?: { code?: unknown } };

/** Was this a provider saying "slow down", as opposed to any other failure? */
export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as ErrorShape;
  // Out of credit is a 429 too, and waiting never fixes it.
  if (e.code === "insufficient_quota" || e.error?.code === "insufficient_quota") return false;
  if (e.status === 429) return true;
  if (e.code === "rate_limit_exceeded") return true;
  return typeof e.message === "string" && /\b429\b|rate limit/i.test(e.message);
}

type GoogleErrorShape = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  errors?: Array<{ reason?: unknown }>;
  response?: { status?: unknown; data?: { error?: { status?: unknown; message?: unknown; errors?: Array<{ reason?: unknown }> } } };
};

/**
 * Was this Google (Gmail, Calendar) saying "slow down for a minute", as opposed to any other failure?
 *
 * Why this exists: on 2026-10-18 one Gmail sync logged 28 threads as failed, every one "Quota exceeded for quota
 * metric 'Total Query Cost' and limit 'Units per minute per user'" — a 403 PERMISSION_DENIED whose words never say
 * "rate limit", so isRateLimitError let it through. Google signals the same thing three ways: the reasons
 * rateLimitExceeded / userRateLimitExceeded, a 429 or RESOURCE_EXHAUSTED, or a per-minute (or per-second) quota
 * in the message. A daily quota is not one of them: waiting a minute never fixes it.
 */
export function isGoogleRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as GoogleErrorShape;
  const body = e.response?.data?.error;
  const message = [e.message, body?.message].filter((m): m is string => typeof m === "string").join(" ");
  if (/per day|daily/i.test(message)) return false;
  const reasons = [...(e.errors ?? []), ...(body?.errors ?? [])].map((r) => r?.reason);
  if (reasons.some((r) => r === "dailyLimitExceeded")) return false;
  if (reasons.some((r) => r === "rateLimitExceeded" || r === "userRateLimitExceeded")) return true;
  if ([e.status, e.code, e.response?.status].some((s) => s === 429 || s === "429")) return true;
  if (body?.status === "RESOURCE_EXHAUSTED") return true;
  return /quota exceeded/i.test(message) && /per (minute|second|100 seconds)/i.test(message);
}

function header(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") return null;
  // The OpenAI SDK (v5+) hands back a fetch Headers; older shapes are a plain record.
  const h = headers as { get?: (n: string) => string | null } & Record<string, unknown>;
  if (typeof h.get === "function") return h.get(name);
  const value = h[name] ?? h[name.toLowerCase()];
  return typeof value === "string" ? value : null;
}

/**
 * How long the provider asked us to wait, in milliseconds, or null when it
 * didn't say. Reads `retry-after-ms` (OpenAI's) first, then the standard
 * `retry-after` as either seconds or an HTTP date.
 */
export function retryAfterMs(err: unknown, now: number = Date.now()): number | null {
  if (!err || typeof err !== "object") return null;
  const headers = (err as ErrorShape).headers;

  const ms = header(headers, "retry-after-ms");
  if (ms !== null) {
    const n = Number.parseFloat(ms);
    if (Number.isFinite(n) && n >= 0) return n;
  }

  const after = header(headers, "retry-after");
  if (after === null || !after.trim()) return null;
  const seconds = Number(after.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(after);
  if (Number.isFinite(at)) return Math.max(0, at - now);
  return null;
}

/**
 * The wait before retry number `attempt` (0-based). The provider's own
 * retry-after wins when it gave one; otherwise exponential backoff with
 * "equal jitter" — half the step fixed, half random — so a batch that was
 * refused together does not come back together.
 */
export function rateLimitDelayMs(err: unknown, attempt: number, options: RateLimitRetryOptions = {}): number {
  const base = options.baseDelayMs ?? RATE_LIMIT_RETRY_DEFAULTS.baseDelayMs;
  const cap = options.maxDelayMs ?? RATE_LIMIT_RETRY_DEFAULTS.maxDelayMs;
  const random = options.random ?? Math.random;

  const asked = retryAfterMs(err);
  if (asked !== null) return Math.min(asked, cap);

  const step = Math.min(cap, base * 2 ** attempt);
  return Math.round(step / 2 + random() * (step / 2));
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn`, retrying it after a rate-limit refusal up to `maxRetries`
 * times. Any other error, or a rate limit that outlasts the retries, is
 * thrown to the caller unchanged.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, options: RateLimitRetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? RATE_LIMIT_RETRY_DEFAULTS.maxRetries;
  const sleep = options.sleep ?? realSleep;
  const isRetryable = options.isRetryable ?? isRateLimitError;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isRetryable(err)) throw err;
      await sleep(rateLimitDelayMs(err, attempt, options));
    }
  }
}
