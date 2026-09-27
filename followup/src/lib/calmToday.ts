import type { PendingApproval } from "@/lib/pendingApprovals";

/**
 * A calm Today (design brain A-046, the Todoist study): the order is the
 * priority, and how long someone has waited is said as a fact about the
 * customer ("Waiting 5 h"), never as a judgement about the owner.
 *
 * Pure, so the server works the words out once and the client renders
 * them as given (a relative time computed on both sides can disagree by a
 * minute and break hydration).
 */

/** The rules that answer someone who wrote. Everything else is a check-in on someone quiet. */
const ANSWERING = new Set(["unanswered", "instant_ack", "dm_handoff"]);

export function isWaitingOnReply(a: Pick<PendingApproval, "trigger">): boolean {
  return ANSWERING.has(a.trigger);
}

function since(a: Pick<PendingApproval, "leadLastMessageAt">): number | null {
  return a.leadLastMessageAt ? new Date(a.leadLastMessageAt).getTime() : null;
}

/**
 * Longest waiting first (A-046). Someone waiting on an answer comes before
 * a check-in on someone quiet; within each, the earliest message first.
 * Score, then the newest hold, only break ties, so the order is stable.
 *
 * This replaces score-first ordering inside each source (founder,
 * 2026-09-23). The source grouping from that instruction stays.
 */
export function byLongestWaiting(a: PendingApproval, b: PendingApproval): number {
  const aw = isWaitingOnReply(a);
  const bw = isWaitingOnReply(b);
  if (aw !== bw) return aw ? -1 : 1;
  const as = since(a);
  const bs = since(b);
  if (as !== bs) {
    if (as === null) return 1;
    if (bs === null) return -1;
    return as - bs;
  }
  if (a.score !== b.score) return b.score - a.score;
  return b.heldAt.getTime() - a.heldAt.getTime();
}

function span(ms: number, long = false): string {
  const min = Math.max(1, Math.floor(ms / 60_000));
  if (min < 60) return long ? `${min} ${min === 1 ? "minute" : "minutes"}` : `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return long ? `${h} ${h === 1 ? "hour" : "hours"}` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"}`;
}

/** "Waiting 5 h" for someone who wrote, "Quiet 6 days" for a check-in. Null with no message on record. */
export function describeWait(a: Pick<PendingApproval, "trigger" | "leadLastMessageAt">, now: Date): string | null {
  const s = since(a);
  if (s === null) return null;
  const gap = span(now.getTime() - s);
  return isWaitingOnReply(a) ? `Waiting ${gap}` : `Quiet ${gap}`;
}

/** The same fact as a clause for the line above the queue: "who has waited 5 hours". */
export function describeWaitClause(a: Pick<PendingApproval, "trigger" | "leadLastMessageAt">, now: Date): string | null {
  const s = since(a);
  if (s === null) return null;
  const gap = span(now.getTime() - s, true);
  return isWaitingOnReply(a) ? `who has waited ${gap}` : `who has been quiet ${gap}`;
}

/**
 * Midnight in the business's own time zone, as an instant. "Handled
 * today" means the owner's today, not UTC's.
 */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const intoDay = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - intoDay);
}
