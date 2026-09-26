/**
 * What an API route may say back to the browser about an error it caught.
 *
 * Many routes end in `catch (err) { return { message: err.message } }`.
 * That is deliberate where the error is one of ours — a library that
 * throws "That email couldn't be found in Gmail anymore." wants the owner
 * to read exactly that. It is a leak where the error came from somewhere
 * else: a Prisma error carries the query shape, table and column names and
 * the database host; an OpenAI error carries the organisation id and rate
 * limits; a Stripe or Google error can quote the key it was called with
 * (audit 2026-09-16 L-3, fixed 2026-09-26).
 *
 * So: our own short, single-line messages pass through unchanged; anything
 * that looks like it came from an SDK, a driver or the network is replaced
 * with the route's own fallback, and the original is logged server-side
 * where it is still useful.
 */

const INTERNAL_HINTS =
  /prisma|invocation|\bP\d{4}\b|clientVersion|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|\bSQL\b|relation "|column "|\borg-[A-Za-z0-9]{6,}|api[\s_-]?key|\bsk[-_]|\brk_|\bBearer\b|client[\s_]secret|at \S+ \(/i;

function looksInternal(err: Error): boolean {
  if (err.name.startsWith("PrismaClient")) return true;
  // SDK HTTP errors (OpenAI's APIError, Google's GaxiosError, Stripe's
  // StripeError) carry the upstream response on the object.
  const e = err as unknown as Record<string, unknown>;
  if ("clientVersion" in e || "headers" in e || "request_id" in e || "response" in e || "raw" in e) return true;
  if (err.message.length > 300 || /[\r\n]/.test(err.message)) return true;
  return INTERNAL_HINTS.test(err.message);
}

export function publicErrorMessage(err: unknown, fallback: string, logContext?: string): string {
  if (!(err instanceof Error) || !err.message) return fallback;
  if (looksInternal(err)) {
    console.error(logContext ? `${logContext}:` : "Internal error (not shown to the user):", err);
    return fallback;
  }
  return err.message;
}
