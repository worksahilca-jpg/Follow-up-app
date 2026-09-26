import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { processTwilioInbound } from "@/lib/inbound/twilioMessage";
import { processMetaEnvelope } from "@/lib/inbound/meta";
import { processWhatsAppCloudEnvelope } from "@/lib/inbound/whatsappCloud";
import { processLeadFormSubmission, type LeadFormSubmission } from "@/lib/inbound/leadForm";

/**
 * Persist-first inbound capture.
 *
 * The problem this solves, in the founder's words: "if Twilio crashes I
 * don't want FollowUp to crash as well, and I don't want to lose leads."
 * Every inbound webhook used to parse its payload and then do all the work
 * — find-or-create the lead, write the message, score it, acknowledge it —
 * inside the request. Twilio and Meta both stop retrying the instant they
 * receive a 2xx, and these routes must answer 2xx. So if anything threw
 * partway through, the provider's copy was already gone and nothing on disk
 * recorded that the message had ever arrived. The lead was destroyed, not
 * delayed.
 *
 * The shape now: validate the signature, write the raw payload to
 * InboundWebhookEvent, process from that row, mark it processed or failed.
 * A failure leaves a replayable record instead of a hole.
 *
 * Nothing here weakens de-duplication. Replay is safe only because the
 * downstream writes are already idempotent on Message.externalId
 * (createInboundMessageIfNew) — the guarantee that absorbs Meta's
 * redeliveries absorbs a replay identically.
 */

export type InboundChannel =
  | "sms"
  // Twilio's WhatsApp sender (the earlier path — see src/lib/twilio.ts).
  | "whatsapp"
  // WhatsApp on the owner's own number through Meta's Cloud API
  // (src/app/api/whatsapp/webhook, src/lib/inbound/whatsappCloud.ts).
  | "whatsapp_cloud"
  | "instagram_or_messenger"
  | "webhook_lead"
  | "embed_form";

type RecordArgs = {
  provider: "twilio" | "meta" | "http";
  channel: InboundChannel;
  businessId?: string | null;
  externalId?: string | null;
  // `unknown` rather than Prisma.InputJsonValue so call sites can hand over
  // a plain parsed body without a cast; it has already been through
  // JSON.parse or formData(), so it is JSON by construction.
  payload: unknown;
};

/**
 * Writes the durable row. Call this ONLY after the payload's signature (or,
 * for the two HTTP capture endpoints, its secret/businessId) has been
 * verified — an unverified payload must never be stored as if it were real.
 *
 * Deliberately not wrapped in a try/catch: if this write fails there is no
 * durability to offer, and the caller should surface that as a real error
 * (a 500 Twilio logs, a failed Zap the sender can retry) rather than answer
 * 2xx for a message it is about to lose.
 */
export async function recordInboundWebhookEvent(args: RecordArgs): Promise<{ id: string; receivedAt: Date }> {
  const row = await prisma.inboundWebhookEvent.create({
    data: {
      provider: args.provider,
      channel: args.channel,
      businessId: args.businessId ?? null,
      externalId: args.externalId ?? null,
      payload: args.payload as Prisma.InputJsonValue,
    },
    select: { id: true, receivedAt: true },
  });
  return row;
}

/** Longest error text worth keeping on the row — enough for a stack's first frames, bounded so a pathological error can't bloat the table. */
const MAX_ERROR_LENGTH = 2000;

export async function markInboundEventProcessed(id: string): Promise<void> {
  await prisma.inboundWebhookEvent.update({
    where: { id },
    data: { status: "processed", processedAt: new Date(), attempts: { increment: 1 }, error: null },
  });
}

/**
 * Records WHY processing stopped, on the row itself. Several of these routes
 * used to catch and continue, which left the failure in a server log nobody
 * reads and the lead nowhere at all.
 *
 * Best-effort by design: this runs on the error path, and throwing here
 * would replace a recorded failure with an unrecorded one.
 */
export async function markInboundEventFailed(id: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}`.trim() : String(err);
  await prisma.inboundWebhookEvent
    .update({
      where: { id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        error: message.slice(0, MAX_ERROR_LENGTH),
      },
    })
    .catch((markErr) => {
      console.error(`[inbound] could not mark event ${id} failed:`, markErr, "original error:", err);
    });
}

/**
 * Runs the processing a stored row implies, and marks the row either way.
 * This is the single path both a live delivery and a replay go through, so
 * there is no second code path that can drift from the first.
 *
 * Never throws: the caller is either a webhook that must answer 2xx or a
 * replay loop that must not abandon the remaining rows. Returns whether the
 * work completed, plus the lead it landed on where the channel knows it
 * (the two HTTP capture endpoints echo it back to their caller).
 */
export async function processInboundEvent(event: {
  id: string;
  channel: string;
  businessId: string | null;
  payload: unknown;
  receivedAt: Date;
}): Promise<{ ok: boolean; leadId?: string }> {
  try {
    const result = await dispatch(event);
    await markInboundEventProcessed(event.id);
    return { ok: true, leadId: result?.leadId };
  } catch (err) {
    console.error(`[inbound] processing failed for ${event.channel} event ${event.id}:`, err);
    await markInboundEventFailed(event.id, err);
    return { ok: false };
  }
}

async function dispatch(event: {
  id: string;
  channel: string;
  businessId: string | null;
  payload: unknown;
  receivedAt: Date;
}): Promise<{ leadId?: string } | void> {
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  switch (event.channel) {
    case "sms":
    case "whatsapp": {
      if (!event.businessId) throw new Error("Twilio inbound event has no businessId to process against.");
      await processTwilioInbound(
        event.businessId,
        event.channel === "whatsapp" ? "whatsapp" : "text",
        payload as Record<string, string>
      );
      return;
    }
    case "instagram_or_messenger": {
      // A signed body that wasn't valid JSON is stored under this key
      // rather than dropped (the route used to log-and-forget it). There is
      // nothing to replay it into, but the bytes are on disk for whoever
      // has to explain the gap.
      if (typeof payload.__unparsedBody === "string") {
        throw new Error("Meta sent a correctly-signed body that wasn't valid JSON; stored verbatim, nothing to process.");
      }
      await processMetaEnvelope(payload as { object?: string; entry?: unknown });
      return;
    }
    case "whatsapp_cloud": {
      if (typeof payload.__unparsedBody === "string") {
        throw new Error("Meta sent a correctly-signed body that wasn't valid JSON; stored verbatim, nothing to process.");
      }
      await processWhatsAppCloudEnvelope(payload as { object?: string; entry?: unknown });
      return;
    }
    case "webhook_lead":
    case "embed_form": {
      if (!event.businessId) throw new Error("Lead capture event has no businessId to process against.");
      return processLeadFormSubmission(
        event.businessId,
        event.channel === "webhook_lead" ? "Webhook" : "Website form",
        payload as unknown as LeadFormSubmission,
        event.id,
        event.receivedAt
      );
    }
    default:
      throw new Error(`Unknown inbound channel "${event.channel}" — no processor for it.`);
  }
}

/**
 * Replays one stored event by id.
 *
 * NOTHING CALLS THIS AUTOMATICALLY TODAY. It is deliberately a function and
 * not a cron or a button: an automatic retry loop over rows whose failure
 * mode is unknown can hammer OpenAI or re-send messages at a rate nobody
 * chose, and a UI for it is out of scope here. Today it is invoked by a
 * human, from a script or a REPL, after looking at why the row failed —
 * which is already the difference between a recoverable incident and a
 * permanently lost lead.
 */
export async function replayInboundWebhookEvent(id: string): Promise<{ replayed: boolean; message?: string }> {
  const event = await prisma.inboundWebhookEvent.findUnique({ where: { id } });
  if (!event) return { replayed: false, message: "No such inbound event." };
  if (event.status === "processed") return { replayed: false, message: "Already processed." };
  const { ok } = await processInboundEvent(event);
  return ok ? { replayed: true } : { replayed: false, message: "Replay failed again — see the row's error." };
}

/**
 * Replays everything still outstanding, oldest first.
 *
 * `pending` rows are included alongside `failed` ones on purpose: a row
 * that is still pending long after receivedAt means the process died mid
 * request (a cold-start timeout, a killed container), which is exactly the
 * failure that leaves no error text anywhere. `olderThanMinutes` keeps this
 * from stealing a request that is legitimately still in flight.
 *
 * Also called by nothing automatically — same reasoning as above.
 */
export async function replayOutstandingInboundEvents(options: {
  businessId?: string;
  limit?: number;
  olderThanMinutes?: number;
} = {}): Promise<{ attempted: number; succeeded: number }> {
  const { businessId, limit = 50, olderThanMinutes = 5 } = options;
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

  const events = await prisma.inboundWebhookEvent.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      receivedAt: { lt: cutoff },
      ...(businessId ? { businessId } : {}),
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  let succeeded = 0;
  for (const event of events) {
    if ((await processInboundEvent(event)).ok) succeeded += 1;
  }
  return { attempted: events.length, succeeded };
}

// Processed rows are kept long enough to investigate "did that lead ever
// reach us?" from a support conversation a couple of weeks later, then
// dropped — they hold raw provider payloads (phone numbers, message text,
// names), so keeping them indefinitely is a liability, not an asset.
const PROCESSED_RETENTION_DAYS = 14;
// Failed and stuck-pending rows are the ones with a lead still trapped in
// them. They are kept far longer so a replay is still possible after
// someone notices, but not forever — a row nobody has replayed in three
// months is not going to be replayed.
const UNPROCESSED_RETENTION_DAYS = 90;

/**
 * Retention. Called hourly from /api/cron/automation.
 *
 * This table is written once per inbound message forever, so it is the
 * highest-volume append-only table in the schema — exactly the
 * unretained-table problem already flagged on ProcessedWebhookEvent
 * ("Not pruned yet", schema.prisma) and in
 * research/product/2026-09-15-cost-to-serve-one-customer.md §2.1. It is
 * given a policy on day one rather than becoming the fourth table on that
 * list.
 */
/**
 * How long a set-aside WhatsApp chat keeps its messages.
 *
 * The WhatsApp history judge sets aside the owner's private chats — family,
 * friends, the bank — and keeps each whole thread (up to 50 messages, plain
 * JSON, not encrypted) in FilteredEmail.threadPayload so "Restore" can bring
 * it back. The schema promised those were "deleted the moment the row is
 * restored or swept"; there was no sweep, so they were kept forever
 * (security pass 2026-09-25 F3, fixed 2026-09-26). After this many days
 * without a new message the messages go; the row stays, so the owner can
 * still see who was set aside, and Restore says plainly that the messages
 * weren't kept.
 */
const SET_ASIDE_THREAD_RETENTION_DAYS = 30;

export async function pruneSetAsideThreads(now: Date = new Date()): Promise<{ cleared: number }> {
  const cutoff = new Date(now.getTime() - SET_ASIDE_THREAD_RETENTION_DAYS * 24 * 60 * 60_000);
  const result = await prisma.filteredEmail.updateMany({
    where: { provider: "whatsapp", threadPayload: { not: Prisma.DbNull }, lastMessageAt: { lt: cutoff } },
    data: { threadPayload: Prisma.DbNull },
  });
  return { cleared: result.count };
}

export async function pruneInboundWebhookEvents(now: Date = new Date()): Promise<{ deleted: number }> {
  const processedCutoff = new Date(now.getTime() - PROCESSED_RETENTION_DAYS * 24 * 60 * 60_000);
  const unprocessedCutoff = new Date(now.getTime() - UNPROCESSED_RETENTION_DAYS * 24 * 60 * 60_000);

  const [processed, unprocessed] = await Promise.all([
    prisma.inboundWebhookEvent.deleteMany({
      where: { status: "processed", receivedAt: { lt: processedCutoff } },
    }),
    prisma.inboundWebhookEvent.deleteMany({
      where: { status: { in: ["pending", "failed"] }, receivedAt: { lt: unprocessedCutoff } },
    }),
  ]);
  return { deleted: processed.count + unprocessed.count };
}
