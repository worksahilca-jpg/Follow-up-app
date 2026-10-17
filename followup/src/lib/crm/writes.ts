import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import { readStageWrite } from "@/lib/crm/stages";

/**
 * Every write FollowUp makes in the owner's CRM, on record (A-252): a note
 * after each reply it sends, the ready card. Before this a write was one
 * call, and a CRM that was down or slow lost it silently. Now each write is
 * a CrmWrite row: tried at once, and if the CRM doesn't take it, tried again
 * by the crm-sync cron (every 10 minutes) after a growing wait, until it
 * lands or runs out of tries. The owner sees the list in Settings ("What
 * FollowUp wrote in Follow Up Boss").
 *
 * Never throws: a CRM hiccup can never fail the send or the reply step that
 * asked for the write.
 */

export type CrmWriteKind = "note" | "stage";
export type CrmWriteStatus = "trying" | "done" | "waiting" | "failed";

/** The waits before each next try: 5 min, 15 min, 1 h, 6 h. After the last, it stops. */
export const RETRY_AFTER_MINUTES = [5, 15, 60, 360];
/** The first try, then one after each wait. */
export const MAX_ATTEMPTS = RETRY_AFTER_MINUTES.length + 1;
/**
 * A try that is still "trying" this long after it started was cut short (the
 * server stopped mid-call). The cron tries it again. Long enough that a slow
 * CRM finishes first; the calls themselves give up after 15 seconds.
 */
export const STUCK_MINUTES = 15;
/** How long the record is kept. */
export const KEEP_DAYS = 30;
/** Retries per cron run, so a long outage can't use up the run's time. */
const RETRIES_PER_RUN = 25;

const MINUTE = 60_000;

export interface CrmWriteInput {
  businessId: string;
  leadId: string;
  provider: string;
  crmId: string;
  kind: CrmWriteKind;
  text: string;
}

type Conn = { provider: string; apiKey: string | null; writesPausedAt: Date | null } | null;

/** Connected to this same CRM, with a key. A CRM the owner has since left gets nothing. */
function connectedTo(conn: Conn, provider: string): conn is { provider: string; apiKey: string; writesPausedAt: Date | null } {
  return !!conn?.apiKey && conn.provider === provider;
}

async function attempt(apiKey: string, provider: string, crmId: string, kind: CrmWriteKind, text: string): Promise<{ ok: boolean; message?: string }> {
  if (!isCrmProvider(provider)) return { ok: false, message: "Unknown CRM." };
  try {
    switch (kind) {
      case "note":
        return await CRM_PROVIDERS[provider].client.pushNote(apiKey, crmId, text);
      case "stage": {
        // A booked customer moved to the owner's chosen stage (A-275, src/lib/crm/stages.ts).
        const w = readStageWrite(text);
        if (!w) return { ok: false, message: "The stage move was unreadable." };
        return await CRM_PROVIDERS[provider].client.moveToStage(apiKey, crmId, w.stageId, w.name);
      }
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "The write failed." };
  }
}

/** What a try that didn't land leaves behind: another try later, or the end. */
function afterFailure(attempts: number, message: string | undefined, now: Date) {
  const lastError = (message || "The CRM didn't take it.").slice(0, 500);
  if (attempts >= MAX_ATTEMPTS) return { status: "failed" as const, lastError, nextTryAt: null };
  return { status: "waiting" as const, lastError, nextTryAt: new Date(now.getTime() + RETRY_AFTER_MINUTES[attempts - 1] * MINUTE) };
}

/**
 * Writes once, on record. "skipped" when there's nothing to write to: not
 * connected to that CRM any more, or writing is paused there.
 */
export async function writeToCrm(input: CrmWriteInput, now: Date = new Date()): Promise<"done" | "waiting" | "skipped"> {
  try {
    if (!isCrmProvider(input.provider) || !input.crmId || !input.text.trim()) return "skipped";
    const conn: Conn = await prisma.crmConnection.findUnique({
      where: { businessId: input.businessId },
      select: { provider: true, apiKey: true, writesPausedAt: true },
    });
    if (!connectedTo(conn, input.provider) || conn.writesPausedAt) return "skipped";

    const row = await prisma.crmWrite.create({
      data: {
        businessId: input.businessId,
        leadId: input.leadId,
        provider: input.provider,
        crmId: input.crmId,
        kind: input.kind,
        text: input.text,
        status: "trying",
        attempts: 1,
        // If this try is cut short, the cron picks it up once this passes.
        nextTryAt: new Date(now.getTime() + STUCK_MINUTES * MINUTE),
      },
      select: { id: true },
    });
    const result = await attempt(conn.apiKey, input.provider, input.crmId, input.kind, input.text);
    if (result.ok) {
      await prisma.crmWrite.update({ where: { id: row.id }, data: { status: "done", doneAt: new Date(), nextTryAt: null, lastError: null } });
      return "done";
    }
    const next = afterFailure(1, result.message, now);
    await prisma.crmWrite.update({ where: { id: row.id }, data: next });
    console.error(`CRM write ${row.id} for business ${input.businessId} didn't land (${next.status}): ${next.lastError}`);
    return "waiting";
  } catch (err) {
    console.error(`CRM write errored for business ${input.businessId}:`, err);
    return "skipped";
  }
}

/**
 * The cron's pass over writes that didn't land: each one whose wait is over
 * (or whose try was cut short) is tried again. A write whose business left
 * that CRM ends as failed; one whose business paused writing waits an hour
 * more without using up a try.
 */
export async function retryCrmWrites(now: Date = new Date()): Promise<{ tried: number; done: number; failed: number }> {
  const due = await prisma.crmWrite.findMany({
    where: { status: { in: ["waiting", "trying"] }, nextTryAt: { lte: now } },
    orderBy: { nextTryAt: "asc" },
    take: RETRIES_PER_RUN,
    select: { id: true, businessId: true, provider: true, crmId: true, kind: true, text: true, status: true, attempts: true, nextTryAt: true },
  });
  let tried = 0;
  let done = 0;
  let failed = 0;
  for (const w of due) {
    try {
      const conn: Conn = await prisma.crmConnection.findUnique({
        where: { businessId: w.businessId },
        select: { provider: true, apiKey: true, writesPausedAt: true },
      });
      if (!connectedTo(conn, w.provider)) {
        await prisma.crmWrite.update({
          where: { id: w.id },
          data: { status: "failed", nextTryAt: null, lastError: "No longer connected to this CRM." },
        });
        failed++;
        continue;
      }
      if (conn.writesPausedAt) {
        await prisma.crmWrite.update({ where: { id: w.id }, data: { status: "waiting", nextTryAt: new Date(now.getTime() + 60 * MINUTE) } });
        continue;
      }
      if (w.attempts >= MAX_ATTEMPTS) {
        await prisma.crmWrite.update({ where: { id: w.id }, data: { status: "failed", nextTryAt: null } });
        failed++;
        continue;
      }
      // Claimed only if nobody else took it since it was read: two cron runs
      // that overlap never write the same note twice.
      const attempts = w.attempts + 1;
      const claimed = await prisma.crmWrite.updateMany({
        where: { id: w.id, status: w.status, nextTryAt: w.nextTryAt },
        data: { status: "trying", attempts, nextTryAt: new Date(now.getTime() + STUCK_MINUTES * MINUTE) },
      });
      if (claimed.count !== 1) continue;
      tried++;
      const result = await attempt(conn.apiKey, w.provider, w.crmId, w.kind as CrmWriteKind, w.text);
      if (result.ok) {
        await prisma.crmWrite.update({ where: { id: w.id }, data: { status: "done", doneAt: new Date(), nextTryAt: null } });
        done++;
      } else {
        const next = afterFailure(attempts, result.message, now);
        await prisma.crmWrite.update({ where: { id: w.id }, data: next });
        if (next.status === "failed") failed++;
      }
    } catch (err) {
      console.error(`CRM write retry errored for ${w.id}:`, err);
    }
  }
  return { tried, done, failed };
}

/** The record keeps 30 days. Older rows go, with the words they held. */
export async function pruneCrmWrites(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * MINUTE);
  const r = await prisma.crmWrite.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return r.count;
}
