import { createHash } from "crypto";
import { prisma } from "@/lib/db";

/**
 * One caller owns one send.
 *
 * ## What was wrong
 *
 * sendFollowUpToLead already refused a send whose exact body had gone to
 * the same lead within the last minute. It did it by counting recent
 * outbound Message rows and then deciding — and a count is a photograph of
 * a moment that has already passed by the time anything acts on it. Two
 * requests arriving together both count zero, and both send.
 *
 * That is the exact shape of the failure it was written for. From the
 * comment that guard carries: a real lead received the identical
 * 409-character follow-up twice on 2026-09-20 — two Gmail message ids, one
 * body, two genuinely delivered emails. Every plausible cause is a race:
 * a double-tap on Send (the disabled-button state in Approvals is
 * client-side only), a second tab, an impatient retry on a slow network.
 * A check-then-act guard cannot stop a race with itself, however short the
 * window is.
 *
 * ## Why a row and not a lock
 *
 * src/lib/rateLimit.ts solves its own check-then-act problem with
 * `pg_advisory_xact_lock` inside a transaction, which is the right tool
 * when the protected work is more database. Here the protected work is a
 * network call to Gmail, Twilio or Meta — holding a transaction open
 * across it would pin a pooled connection for the length of a provider's
 * worst day.
 *
 * So the claim is a row with a unique index on (leadId, bodyHash). The
 * first caller inserts it and owns the send; the second gets a constraint
 * violation from Postgres and is refused. The decision is made by the
 * database at the moment of writing, not by a read from a moment earlier,
 * which is the whole difference.
 *
 * ## Why the claim expires rather than being deleted on success
 *
 * A claim is not "this was sent" — Message rows are that. It is "someone
 * is sending this right now, and for a short grace period afterwards".
 * Keeping it for the window is what makes the guard cover the sequential
 * double-tap too (two clicks a second apart, the first already finished),
 * so this one mechanism replaces the count entirely rather than sitting
 * beside it.
 *
 * A stale claim is re-taken rather than blocking forever: the conditional
 * `updateMany` below only succeeds if the existing claim is older than the
 * window, and Postgres evaluates that predicate under a row lock, so two
 * callers racing to re-take the same stale claim still produce exactly one
 * winner.
 *
 * ## Deliberately narrow
 *
 * Sixty seconds, on the exact body. Long enough for a double-click, a
 * retry and a second tab; short enough that a genuine "sorry, resending
 * that" minutes later still goes out. A guard that blocks a legitimate
 * resend would be its own bug.
 *
 * The honest limit, unchanged from the earlier guard: the two production
 * sends were 3h45m apart, and nothing here would have stopped that. What
 * produced that gap could not be determined from the data. This closes the
 * race; it does not explain that pair.
 */
export const SEND_CLAIM_WINDOW_MS = 60_000;

/** SHA-256 hex of the exact body. Keeps the unique index small and stops
 *  the table holding a second copy of what someone wrote. */
export function sendBodyHash(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export type SendClaimResult =
  | { won: true; bodyHash: string }
  | { won: false; bodyHash: string };

/**
 * Take the claim for (lead, body), or report that someone else holds it.
 *
 * Never throws for the ordinary contested case — a lost race is a return
 * value, not an error. A genuine database failure does propagate: refusing
 * to send because the database is unreachable is better than sending
 * without the guard.
 */
export async function claimSend(
  leadId: string,
  body: string,
  windowMs: number = SEND_CLAIM_WINDOW_MS
): Promise<SendClaimResult> {
  const bodyHash = sendBodyHash(body);

  try {
    await prisma.sendClaim.create({ data: { leadId, bodyHash } });
    return { won: true, bodyHash };
  } catch (err) {
    // P2002 is Prisma's unique-constraint violation: a claim already
    // exists. Anything else is a real failure and belongs to the caller.
    if (!isUniqueViolation(err)) throw err;
  }

  // A claim exists. It is ours to re-take only if its window has passed —
  // and the predicate is part of the write, so two callers arriving on the
  // same stale claim still yield one winner.
  const retaken = await prisma.sendClaim.updateMany({
    where: { leadId, bodyHash, claimedAt: { lt: new Date(Date.now() - windowMs) } },
    data: { claimedAt: new Date() },
  });

  return { won: retaken.count === 1, bodyHash };
}

/**
 * Give the claim back after a send that did not happen.
 *
 * A provider failure delivered nothing, so a retry must not be blocked by
 * the bookkeeping of the attempt that failed. Best-effort on purpose: a
 * failed release leaves a claim that expires on its own within the window,
 * which is a delay, while a throw here would replace a send failure the
 * caller knows how to classify with one it does not.
 */
export async function releaseSendClaim(leadId: string, bodyHash: string): Promise<void> {
  try {
    await prisma.sendClaim.deleteMany({ where: { leadId, bodyHash } });
  } catch {
    // Intentionally swallowed — see above.
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
