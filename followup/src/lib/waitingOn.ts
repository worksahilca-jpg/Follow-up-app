import type { BusinessAutomationRules } from "@/lib/automationStatus";
import { dayLabel, nextFor } from "@/lib/comingUp";
import type { Lead } from "@/lib/types";

/**
 * "Waiting on customers" (design brain A-050, the Close study): everyone
 * FollowUp or the owner has answered who hasn't answered back yet. One of
 * the three places a conversation can be, beside "Needs you" and
 * "Handled today", so nobody is in two places or none.
 *
 * In it: not closed, and the newest message is ours. The instant "got your
 * message" doesn't count as an answer (the real reply is still to come, so
 * that customer belongs with Needs you or Coming up), and anyone whose
 * reply is waiting for the owner's OK is left out: they are in Needs you.
 */
export type WaitingItem = { leadId: string; name: string; lastFromYou: string; sentAt: Date; next: string };

function newest(lead: Lead) {
  let best: Lead["conversation"][number] | null = null;
  for (const m of lead.conversation) if (!best || Date.parse(m.date) > Date.parse(best.date)) best = m;
  return best;
}

export function isWaitingOnCustomer(lead: Lead): boolean {
  if (lead.stage === "won" || lead.stage === "lost") return false;
  const last = newest(lead);
  if (!last || last.direction !== "outbound") return false;
  return last.trigger !== "instant_ack";
}

/** When our last message went out, looking back: "Today", "Yesterday", "3 days ago", then a date. */
export function sentLabel(at: Date, now: Date, timeZone: string): string {
  const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const days = Math.round((Date.parse(ymd(now)) - Date.parse(ymd(at))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(at);
}

/** "Omar" out of "Omar Haddad"; the whole name when there is only one word. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * What happens next, in one sentence, always by name (the app can't know
 * anyone's pronouns): "First check-in on Monday, unless Omar writes first."
 */
export function describeNext(lead: Lead, rules: BusinessAutomationRules, now: Date, timeZone: string): string {
  const first = firstName(lead.name);
  const status = lead.automationStatus;
  if (status?.kind === "talked") return `You marked “We talked”. FollowUp waits for ${first}.`;
  const next = rules.canSend ? nextFor(lead, rules, now) : null;
  if (next) {
    const day = dayLabel(next.at, now, timeZone);
    const when = day === "Today" || day === "Tomorrow" ? day.toLowerCase() : `on ${day}`;
    return `${next.what} ${when}${next.unless ? `, unless ${first} writes first` : ""}.`;
  }
  if (status?.kind === "off") return `Follow-ups are off for ${first}.`;
  return `FollowUp won’t write again unless ${first} does.`;
}

export function getWaitingOn(
  leads: Lead[],
  rules: BusinessAutomationRules,
  now: Date,
  timeZone: string,
  exclude: Set<string>
): WaitingItem[] {
  const out: WaitingItem[] = [];
  for (const lead of leads) {
    if (exclude.has(lead.id) || !isWaitingOnCustomer(lead)) continue;
    const last = newest(lead)!;
    out.push({
      leadId: lead.id,
      name: lead.name,
      lastFromYou: last.body.replace(/\s+/g, " ").trim(),
      sentAt: new Date(last.date),
      next: describeNext(lead, rules, now, timeZone),
    });
  }
  // Most recently answered first: the ones most likely to write back soon.
  return out.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

/**
 * How fast customers heard back this week (A-050): the median time from a
 * customer writing to the first real reply after it, whoever sent it. The
 * instant acknowledgement isn't a reply, so it doesn't count. Only turns
 * that started in the window and got a reply are measured; null when none.
 */
export function medianReplyMs(leads: Lead[], since: Date, until: Date = new Date()): number | null {
  const spans: number[] = [];
  for (const lead of leads) {
    const msgs = [...lead.conversation].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    let turnStart: number | null = null;
    for (const m of msgs) {
      const t = Date.parse(m.date);
      if (m.direction === "inbound") {
        if (turnStart === null) turnStart = t;
        continue;
      }
      if (m.trigger === "instant_ack") continue;
      if (turnStart !== null && turnStart >= since.getTime() && turnStart <= until.getTime()) spans.push(t - turnStart);
      turnStart = null;
    }
  }
  if (!spans.length) return null;
  const s = spans.sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
