import type { PendingApproval } from "@/lib/pendingApprovals";
import { SCORE_HIGH } from "@/lib/scoreThresholds";

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

/**
 * Today's order (A-230, founder 2026-10-11: "Yes, build it"): the customer you would lose soonest on top.
 *  1. ready — they asked for a time or a price, or FollowUp rates them likely to buy (score 70+);
 *  2. new — wrote in the last day;
 *  3. older — waiting a day or more;
 *  4. checkin — FollowUp's check-in on someone quiet (nobody is waiting on an answer).
 * A fresh, ready customer cools within hours; someone who wrote two weeks ago won't cool much more by tomorrow.
 * Inside each tier the longest wait still goes first, so nobody new waits long either.
 */
export type TodayTier = "ready" | "new" | "older" | "checkin";
const TIER_RANK: Record<TodayTier, number> = { ready: 0, new: 1, older: 2, checkin: 3 };
/** A customer is "new" for a day after their last message. */
export const NEW_FOR_MS = 24 * 60 * 60_000;

type Tierable = Pick<PendingApproval, "trigger" | "leadLastMessageAt" | "score" | "riskTopic">;

/** Why a ready customer is on top, in the owner's words, or null for everyone else. */
export function readyReason(a: Tierable): string | null {
  if (!isWaitingOnReply(a)) return null;
  if (a.riskTopic === "date") return "Wants to book";
  if (a.riskTopic === "price") return "Asked the price";
  if (a.score >= SCORE_HIGH) return "Likely to book";
  return null;
}

export function todayTier(a: Tierable, now: Date): TodayTier {
  if (!isWaitingOnReply(a)) return "checkin";
  if (readyReason(a)) return "ready";
  const wrote = since(a);
  return wrote !== null && now.getTime() - wrote < NEW_FOR_MS ? "new" : "older";
}

/**
 * Today's order (A-230). The tier is worked out on the server and carried on the item (`tier`), so the server's
 * and the browser's orders can't disagree; without one it is worked out against `now`.
 */
export function byTodayOrder(now: Date = new Date()) {
  return (a: PendingApproval & { tier?: TodayTier }, b: PendingApproval & { tier?: TodayTier }): number => {
    const ta = TIER_RANK[a.tier ?? todayTier(a, now)];
    const tb = TIER_RANK[b.tier ?? todayTier(b, now)];
    if (ta !== tb) return ta - tb;
    return byLongestWaiting(a, b);
  };
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
