/**
 * The single "is this failure worth trying again" classifier, shared by every
 * retry in the product.
 *
 * It lived in automation.ts, which is fine as long as automation.ts is the
 * only caller. It isn't any more: the outbound send queue (src/lib/sendQueue.ts,
 * driven from src/lib/sending.ts) has to ask the same question, and
 * automation.ts already imports sending.ts — so leaving it there would have
 * made an import cycle, and re-deriving it in the queue would have made two
 * classifiers that drift apart. Same function, same tests, just moved to a
 * leaf module with no dependencies of its own; automation.ts re-exports it so
 * every existing import keeps working.
 */

/**
 * Is this error worth trying again on the next tick, rather than after the
 * full recheck window?
 *
 * Deliberately a narrow allowlist, not a denylist. Everything not listed here
 * keeps the existing behaviour — the lead stays claimed and is reconsidered at
 * the normal recheck — because the cost of getting this wrong in the generous
 * direction is a lead that gets re-drafted every hour forever, paying for an
 * OpenAI call each time to produce a message that can never send.
 *
 * The classes below are the ones that genuinely resolve on their own: provider
 * rate limits, upstream 5xx, and network/timeout failures.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { status?: number; code?: string; message?: string };

  // OpenAI, Google and Twilio all surface an HTTP status on the error.
  if (typeof e.status === "number" && (e.status === 429 || e.status >= 500)) return true;

  // Node/undici network failures.
  if (typeof e.code === "string" && ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(e.code)) {
    return true;
  }

  if (typeof e.message !== "string") return false;
  const m = e.message.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("etimedout") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("service unavailable") ||
    m.includes("temporarily unavailable") ||
    m.includes("overloaded")
  );
}
