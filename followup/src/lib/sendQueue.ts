/**
 * The durable retry behind every automated send.
 *
 * Founder's requirement: a provider outage should DELAY a message, not lose
 * it. Until now sendFollowUpToLead() returned { success: false } when the
 * provider call failed and the caller moved on — which for an automated send
 * usually meant the message was never sent at all. One transient Twilio 500,
 * one Gmail rate limit, and a real follow-up to a real customer quietly did
 * not happen.
 *
 * This module holds the queue mechanics only. The sending itself stays in
 * sending.ts (runOutboundRetries there re-enters the same funnel, guards and
 * all) so there is still exactly one place a message can leave from.
 *
 * ---------------------------------------------------------------------
 * The four things this must never get wrong
 * ---------------------------------------------------------------------
 * 1. NEVER SEND TWICE. Two guarantees, because there are two races:
 *      - Two invocations reaching the same queued row: the row is claimed
 *        with an atomic conditional updateMany (WHERE status = 'queued' AND
 *        nextAttemptAt <= now), the same shape as every other claim in this
 *        codebase (Lead.reactivationSentAt, Lead.lastAutomationCheckedAt).
 *        The loser matches zero rows and moves on.
 *      - A CALLER re-sending while a retry is still pending: sequences.ts
 *        leaves a failed step enrolled and re-drafts it on the next hourly
 *        tick, so without a guard the queue and the workflow would both
 *        deliver the same step. hasSendInFlight() below is that guard, and
 *        it is checked inside sendFollowUpToLead for every automated send.
 *    What it cannot fix: a provider that accepted the message and then
 *    reported a failure anyway (a 500 after the message was queued, a socket
 *    that dies after the request landed). That is unresolvable from this
 *    side, and it is bounded rather than eliminated — only the narrow
 *    transient classes retry, only a few times. The commonest half-success —
 *    provider accepted, our own database write failed — is already reported
 *    as a SUCCESS by sending.ts and never reaches this queue.
 *
 * 2. NEVER RETRY A PERMANENT FAILURE. Only isTransientError() (@/lib/
 *    transientError — the deliberately narrow allowlist, reused verbatim,
 *    not widened) puts a row here. A bad number, a disconnected mailbox, an
 *    opt-out, a suppressed address, a tripped daily fuse: all terminal.
 *
 * 3. BOUNDED. maxAttempts total (the inline attempt plus the retries below),
 *    with growing delays. After that the row is `failed` — a terminal state
 *    with the provider's own last error on it, plus a notification to whoever
 *    owns the lead, because a message that never went out is something a
 *    human has to know about rather than something to keep paying to attempt.
 *
 * 4. THE GUARDS STILL WIN. A retry goes back in at the TOP of
 *    sendFollowUpToLead, so opt-out, the daily cap and suppression are all
 *    re-evaluated at send time. A lead who texts STOP between the first
 *    attempt and the retry is not messaged — the row is `canceled` instead.
 */

import { prisma } from "@/lib/db";

/**
 * Delay before each retry, in minutes, indexed by how many attempts have
 * already been made (attempt 1 is the inline one inside sendFollowUpToLead).
 *
 * Shaped around the two outages this actually sees. A provider rate limit
 * clears in seconds-to-minutes, so the first retry is soon enough to be the
 * same conversation. A real outage lasts longer than anyone's patience, so
 * the tail stretches to two hours rather than hammering a provider that is
 * already struggling. Past that (~2h45m of coverage) a follow-up is stale
 * enough that a human should see it rather than have it arrive unannounced.
 */
export const RETRY_BACKOFF_MINUTES = [2, 10, 30, 120];

/** Inline attempt + RETRY_BACKOFF_MINUTES.length retries. */
export const MAX_SEND_ATTEMPTS = RETRY_BACKOFF_MINUTES.length + 1;

/**
 * How long a claimed row may sit in `sending` before it is assumed the
 * invocation holding it died.
 *
 * Generous on purpose: it must be longer than the worst case of one attempt
 * (a provider that takes a full timeout to fail) plus the invocation's own
 * ceiling, or a slow attempt would be declared dead while it is still
 * running — and then the same message could go out twice, which is the one
 * outcome this whole module exists to prevent.
 */
const STALE_LOCK_MS = 30 * 60 * 1000;

export type QueuedSendEnvelope = {
  businessId: string;
  leadId: string;
  channel: string;
  body: string;
  subject?: string;
  emailThreadId?: string;
  emailInReplyTo?: string;
  trigger?: string;
  auditMeta?: Record<string, unknown>;
};

export type ClaimedSend = {
  id: string;
  businessId: string;
  leadId: string;
  channel: string;
  body: string;
  subject: string | null;
  emailThreadId: string | null;
  emailInReplyTo: string | null;
  trigger: string | null;
  auditMeta: unknown;
  attempts: number;
  maxAttempts: number;
};

/** Statuses that mean "this send has not finished happening yet". */
const UNRESOLVED = ["queued", "sending"];

/**
 * Is there already an unfinished outbound send for this lead?
 *
 * The guard that keeps the queue and the callers from both delivering. It is
 * asked inside sendFollowUpToLead for every automated send, and it is a hard
 * refusal rather than a wait: the alternative is two copies of the same
 * follow-up in someone's inbox, in the owner's name, which is the failure
 * this product exists to prevent.
 */
export async function hasSendInFlight(leadId: string): Promise<boolean> {
  const existing = await prisma.outboundSend.findFirst({
    where: { leadId, status: { in: UNRESOLVED } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Parks a send that failed transiently. Returns the row id, or null if it
 * could not be written (a queue that cannot be written to must never make the
 * caller think the message is safe).
 */
export async function queueSendForRetry(
  envelope: QueuedSendEnvelope,
  lastError: string
): Promise<{ id: string; nextAttemptAt: Date } | null> {
  const nextAttemptAt = new Date(Date.now() + RETRY_BACKOFF_MINUTES[0] * 60_000);
  try {
    const row = await prisma.outboundSend.create({
      data: {
        businessId: envelope.businessId,
        leadId: envelope.leadId,
        channel: envelope.channel,
        body: envelope.body,
        subject: envelope.subject ?? null,
        emailThreadId: envelope.emailThreadId ?? null,
        emailInReplyTo: envelope.emailInReplyTo ?? null,
        trigger: envelope.trigger ?? null,
        auditMeta: envelope.auditMeta ? (envelope.auditMeta as object) : undefined,
        status: "queued",
        attempts: 1,
        maxAttempts: MAX_SEND_ATTEMPTS,
        nextAttemptAt,
        lastError,
      },
      select: { id: true, nextAttemptAt: true },
    });
    return row;
  } catch (err) {
    console.error(`Could not queue a retry for lead ${envelope.leadId} on ${envelope.channel}:`, err);
    return null;
  }
}

/**
 * Takes the next due row, atomically.
 *
 * Two statements rather than one because Prisma's updateMany cannot return
 * the rows it touched — but the CLAIM is still a single conditional UPDATE,
 * which is what matters: `status: "queued"` is in the WHERE, so of two
 * invocations that read the same candidate, exactly one update matches a row
 * and the other gets count 0 and skips it.
 *
 * `attempts` increments as part of the claim, not after the attempt. If this
 * invocation is killed mid-send the count is already spent, which is the
 * conservative direction: a retry budget that under-counts would let one
 * message be attempted forever.
 */
export async function claimNextDueSend(now = new Date()): Promise<ClaimedSend | null> {
  // Walk candidates rather than taking only the first: losing one claim race
  // must not end the invocation, or a single contended row would stall the
  // whole queue.
  const candidates = await prisma.outboundSend.findMany({
    where: { status: "queued", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: 10,
    select: { id: true },
  });

  for (const candidate of candidates) {
    const claim = await prisma.outboundSend.updateMany({
      where: { id: candidate.id, status: "queued", nextAttemptAt: { lte: now } },
      data: { status: "sending", lockedAt: now, attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue; // another invocation got there first

    const row = await prisma.outboundSend.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        businessId: true,
        leadId: true,
        channel: true,
        body: true,
        subject: true,
        emailThreadId: true,
        emailInReplyTo: true,
        trigger: true,
        auditMeta: true,
        attempts: true,
        maxAttempts: true,
      },
    });
    if (row) return row;
  }
  return null;
}

/** The message left. */
export async function markSendDelivered(id: string): Promise<void> {
  await prisma.outboundSend.updateMany({
    where: { id },
    data: { status: "sent", resolvedAt: new Date(), lockedAt: null, lastError: null },
  });
}

/**
 * The attempt failed and there is budget left — back to `queued` with a
 * longer delay. Returns false when the budget is spent, so the caller retires
 * the row instead.
 */
export async function rescheduleSend(row: ClaimedSend, lastError: string): Promise<Date | null> {
  const delayMinutes = RETRY_BACKOFF_MINUTES[row.attempts - 1];
  if (row.attempts >= row.maxAttempts || delayMinutes === undefined) return null;

  const nextAttemptAt = new Date(Date.now() + delayMinutes * 60_000);
  await prisma.outboundSend.updateMany({
    where: { id: row.id },
    data: { status: "queued", nextAttemptAt, lockedAt: null, lastError },
  });
  return nextAttemptAt;
}

/**
 * Terminal. `failed` is "this message did not go out and something is wrong";
 * `canceled` is "this message correctly did not go out" (the lead opted out,
 * the address was suppressed, the daily fuse tripped between attempts).
 * Keeping them apart is the difference between an owner reading an incident
 * and an owner reading the product working.
 */
export async function retireSend(
  id: string,
  status: "failed" | "canceled",
  lastError: string
): Promise<void> {
  await prisma.outboundSend.updateMany({
    where: { id },
    data: { status, resolvedAt: new Date(), lockedAt: null, lastError },
  });
}

/**
 * Rows whose invocation was killed while the provider call was in flight.
 *
 * They are retired, NOT retried. Whether that message left is genuinely
 * unknown from here, and "we might have already sent it" has to resolve to
 * "don't send it again" — the same call reactivationSend.ts makes about its
 * own claim. The cost is a message that may be lost; the alternative cost is
 * a customer getting the same follow-up twice in the owner's name.
 *
 * Returns the retired rows so the caller can tell a human about each one.
 */
export async function reapStaleSends(now = new Date()): Promise<{ id: string; leadId: string; businessId: string; channel: string }[]> {
  const cutoff = new Date(now.getTime() - STALE_LOCK_MS);
  const stale = await prisma.outboundSend.findMany({
    where: { status: "sending", lockedAt: { lt: cutoff } },
    select: { id: true, leadId: true, businessId: true, channel: true },
    take: 50,
  });

  for (const row of stale) {
    // Conditional on still being `sending`: if the invocation that held this
    // row is somehow alive after all and finishes first, its own write wins
    // and this one matches nothing.
    await prisma.outboundSend.updateMany({
      where: { id: row.id, status: "sending" },
      data: {
        status: "failed",
        resolvedAt: now,
        lastError:
          "The attempt was interrupted before it finished. FollowUp can't tell whether this message was delivered, so it deliberately didn't try again — sending it twice would be worse.",
      },
    });
  }
  return stale;
}
