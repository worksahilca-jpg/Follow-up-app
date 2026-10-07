import { quietReminderPlan, reactivationAlreadySent, type TimelineMessage } from "@/lib/automation";
import type { BusinessAutomationRules } from "@/lib/automationStatus";
import type { Lead } from "@/lib/types";

/**
 * "Coming up" (design brain A-046, the Todoist study): who FollowUp will
 * write to next, and on what day, so the owner never has to remember it.
 *
 * Read from each lead's automation status (the same rules the engine
 * uses), plus the one thing that status leaves out: a quiet lead's next
 * check-in reads "sent" there, with no date. That date comes from the
 * engine's own quietReminderPlan, so this list and what actually goes out
 * cannot disagree.
 *
 * Days only, never a time: the engine runs hourly and only between 8am and
 * 8pm, so an hour would be a promise it doesn't make.
 */
export type ComingUpItem = {
  leadId: string;
  name: string;
  at: Date;
  what: string;
  // A check-in or plan step: it only happens if the customer stays quiet,
  // so the screen says "unless Priya writes first" (A-050, the Close study).
  unless: boolean;
};

const DAY = 86_400_000;
const ORDINAL = ["First", "Second", "Third", "Last"];

function timeline(lead: Lead): TimelineMessage[] {
  return lead.conversation.map((m) => ({
    direction: m.direction,
    at: new Date(m.date).getTime(),
    trigger: m.trigger ?? null,
    quickReplyPayload: m.quickReplyPayload ?? null,
  }));
}

/** What FollowUp will do next for this customer, and when; null when nothing is planned. */
export function nextFor(lead: Lead, rules: BusinessAutomationRules, now: Date): { at: Date; what: string; unless: boolean } | null {
  const status = lead.automationStatus;
  if (!status) return null;
  switch (status.kind) {
    case "workflow":
      return { at: new Date(now.getTime() + status.dueInDays * DAY), what: `Next step of “${status.sequenceName}”`, unless: true };
    case "waiting":
      // The reply, the check-ins and the welcome back all run inside
      // runAutomationForBusiness, which does nothing while the master
      // switch is off. A workflow (above) does not sit behind it.
      if (!rules.masterEnabled) return null;
      return status.etaHours !== null ? { at: new Date(now.getTime() + status.etaHours * 3_600_000), what: "A reply to their message", unless: false } : null;
    case "sent": {
      if (!rules.masterEnabled) return null;
      const t = timeline(lead);
      const lastContacted = new Date(lead.lastContacted).getTime();
      const plan = quietReminderPlan(t, lastContacted, rules.silenceTriggerDays, rules.deadLeadDays);
      if (plan?.dueAt) return { at: plan.dueAt, what: `${ORDINAL[Math.min(plan.step, ORDINAL.length - 1)]} check-in`, unless: true };
      if (rules.deadLeadEnabled && !reactivationAlreadySent(t, rules.deadLeadDays)) {
        return { at: new Date(lastContacted + rules.deadLeadDays * DAY), what: `Welcome back, after ${rules.deadLeadDays} quiet days`, unless: true };
      }
      return null;
    }
    default:
      // Due now (it will be in "Needs your OK" shortly), or stopped for a
      // reason the lead page explains: nothing to promise here.
      return null;
  }
}

export function getComingUp(
  leads: Lead[],
  rules: BusinessAutomationRules,
  now: Date,
  exclude: Set<string>,
  horizonDays = 7
): ComingUpItem[] {
  // Nothing can go out at all: the "can't send" notice says so instead.
  if (!rules.canSend) return [];
  const until = now.getTime() + horizonDays * DAY;
  const out: ComingUpItem[] = [];
  for (const lead of leads) {
    if (exclude.has(lead.id)) continue;
    const next = nextFor(lead, rules, now);
    if (!next) continue;
    const t = next.at.getTime();
    if (t <= now.getTime() || t > until) continue;
    out.push({ leadId: lead.id, name: lead.name, at: next.at, what: next.what, unless: next.unless });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** "Today", "Tomorrow", "Thursday", or "Mon, Oct 5" beyond a week — in the owner's own time zone. */
export function dayLabel(at: Date, now: Date, timeZone: string): string {
  const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const days = Math.round((Date.parse(ymd(at)) - Date.parse(ymd(now))) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(at);
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(at);
}

/** The items grouped under their day, in order. */
export function groupByDay(items: ComingUpItem[], now: Date, timeZone: string): { day: string; items: ComingUpItem[] }[] {
  const groups: { day: string; items: ComingUpItem[] }[] = [];
  for (const it of items) {
    const day = dayLabel(it.at, now, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(it);
    else groups.push({ day, items: [it] });
  }
  return groups;
}

/**
 * The plan, in one sentence, for a quiet Today (research round 2, #2):
 * "Next: FollowUp checks on Priya on Thursday, and on Noah on Saturday."
 * Making a plan for an unfinished goal quiets it as much as finishing does
 * (Masicampo & Baumeister 2011), so the owner can stop thinking about who
 * still needs a nudge. The first two people only; null when nothing is planned.
 */
export function planLine(groups: { day: string; items: ComingUpItem[] }[]): string | null {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const g of groups) {
    for (const it of g.items) {
      if (seen.has(it.leadId) || parts.length >= 2) continue;
      seen.add(it.leadId);
      const who = it.name.trim().split(/\s+/)[0] || it.name;
      const when = g.day === "Today" ? "later today" : g.day === "Tomorrow" ? "tomorrow" : `on ${g.day}`;
      const verb = it.what === "A reply to their message" ? "replies to" : "checks on";
      parts.push(parts.length === 0 ? `FollowUp ${verb} ${who} ${when}` : `${verb === "replies to" ? "replies to" : "on"} ${who} ${when}`);
    }
  }
  if (parts.length === 0) return null;
  return `Next: ${parts.join(", and ")}.`;
}
