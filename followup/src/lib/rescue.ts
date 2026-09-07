import type { Lead, Message } from "@/lib/types";

/**
 * Rescue score — "how likely is this lead to be lost if nobody acts, and
 * how much is that worth acting on." PRODUCT_DIRECTION.md, main goal
 * point 2: the number nobody else in the category has (see
 * research/market/2026-09-07-lead-rescue-gap-and-strategy.md, question 5).
 *
 * Deterministic and cheap — no model call — so it can run on every page
 * load over every lead. Three ingredients, in priority order:
 *
 *  1. NEGLECT. The lead wrote last and nobody answered: the worst case,
 *     weighted by how long they've been waiting (20 → 60 over 24h).
 *     Otherwise, we wrote last and they've gone quiet: weighted by days
 *     of silence (0 → 40 over ~13 days). A conversation that's alive
 *     (replied within a day) contributes nothing.
 *  2. INTENT. The AI lead score (0–100) already reflects buying signals;
 *     it contributes up to 30 points.
 *  3. RECOVERABILITY. The colder the trail, the less a rescue is worth:
 *     nothing inbound for 3 weeks costs 10 points, 6 weeks costs 20.
 *
 * Won/lost leads score 0. `atRisk` is score ≥ 50 — the dashboard's
 * "act on these now" cut.
 */
export interface RescueAssessment {
  score: number; // 0–100
  atRisk: boolean;
  reason: string; // one plain sentence the owner can act on
  waitingHours: number | null; // hours the lead has been waiting for an answer, if they wrote last
  silentDays: number | null; // days since our last message with no reply, if we wrote last
}

const AT_RISK_THRESHOLD = 50;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function assessRescue(lead: Lead, now: Date = new Date()): RescueAssessment {
  if (lead.stage === "won" || lead.stage === "lost") {
    return { score: 0, atRisk: false, reason: "Closed.", waitingHours: null, silentDays: null };
  }

  const messages = [...lead.conversation].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last: Message | undefined = messages[messages.length - 1];
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");

  let neglect = 0;
  let waitingHours: number | null = null;
  let silentDays: number | null = null;
  let reason: string;

  if (last?.direction === "inbound") {
    waitingHours = Math.max(0, (now.getTime() - new Date(last.date).getTime()) / HOUR);
    // 0 for the first hour (a reply may be seconds away), then 20 + ~1.7/h, capped at 60 by 24h.
    neglect = waitingHours < 1 ? 0 : clamp(20 + ((waitingHours - 1) / 23) * 40, 20, 60);
    reason =
      waitingHours < 1
        ? `${lead.name.split(" ")[0]} just wrote — reply now.`
        : `${lead.name.split(" ")[0]} wrote ${formatHours(waitingHours)} ago and is still waiting for an answer.`;
  } else {
    const since = last ? new Date(last.date) : new Date(lead.lastContacted);
    silentDays = Math.max(0, (now.getTime() - since.getTime()) / DAY);
    // Nothing for the first two days; then ~3.6/day up to 40 by day 13.
    neglect = silentDays < 2 ? 0 : clamp(((silentDays - 2) / 11) * 40, 0, 40);
    reason =
      silentDays < 2
        ? "Conversation is live."
        : `No reply for ${Math.floor(silentDays)} day${Math.floor(silentDays) === 1 ? "" : "s"} since your last message.`;
  }

  const intent = clamp(lead.score, 0, 100) * 0.3;

  let recover = 0;
  if (lastInbound) {
    const daysSinceInbound = (now.getTime() - new Date(lastInbound.date).getTime()) / DAY;
    if (daysSinceInbound > 42) recover = -20;
    else if (daysSinceInbound > 21) recover = -10;
  } else {
    // Never heard from them at all (manual/CSV lead) — weakest trail.
    recover = -10;
  }

  const score = Math.round(clamp(neglect + intent + recover, 0, 100));
  if (score >= AT_RISK_THRESHOLD && lead.priority === "high") reason += " High intent.";
  return { score, atRisk: score >= AT_RISK_THRESHOLD, reason, waitingHours, silentDays };
}

function formatHours(h: number): string {
  if (h < 48) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)} days`;
}

/** Leads worth acting on right now, most urgent first. */
export function getAtRiskLeads(leads: Lead[], now: Date = new Date()): Array<Lead & { rescue: RescueAssessment }> {
  return leads
    .map((lead) => ({ ...lead, rescue: assessRescue(lead, now) }))
    .filter((l) => l.rescue.atRisk)
    .sort((a, b) => b.rescue.score - a.rescue.score);
}
