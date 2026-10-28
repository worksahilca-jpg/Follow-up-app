import { clockTime, dayOffset } from "@/lib/todayWords";

/**
 * Today that shows FollowUp working (A-336, after R-144 "it is working good but doesn't feel like working"): the
 * pure part. What FollowUp did since the owner last looked, said as rows with names, times and the words it sent;
 * the one sentence at the top; who it is waiting on. Only what the records hold, so it can never claim work that
 * didn't happen. The data comes from src/lib/todayWorkData.ts.
 */

const DAY = 86_400_000;
/** The longest "since you last looked" window: a week. */
export const WINDOW_DAYS = 7;
/** How many "FollowUp did" rows Today shows; the rest are one tap away on Activity. */
export const DID_SHOWN = 4;
const EXCERPT = 90;

/**
 * Where "FollowUp did" starts: the owner's last visit before today, or the start of today when there was none (a
 * new account, or the first visit of the day on a one-day-old account), never more than a week back. `prevOpen` is
 * the newest app open before today's start (src/lib/appOpens.ts records one per person per local day).
 */
export function sinceWindow(prevOpen: Date | null, dayStart: Date, now: Date): { since: Date; sinceLook: boolean } {
  const floor = new Date(now.getTime() - WINDOW_DAYS * DAY);
  if (!prevOpen) return { since: dayStart, sinceLook: false };
  if (prevOpen.getTime() < floor.getTime()) return { since: floor, sinceLook: true };
  return { since: prevOpen, sinceLook: true };
}

/** The small words beside the label: "since 9:40 PM", "since Saturday", "this week", "today". */
export function sinceLabel(since: Date, sinceLook: boolean, now: Date, timeZone: string): string {
  if (!sinceLook) return "today";
  const days = -dayOffset(since, now, timeZone);
  if (days <= 0) return "today";
  if (days === 1) return `since ${clockTime(since, timeZone)}`;
  if (days >= WINDOW_DAYS) return "this week";
  return `since ${new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(since)}`;
}

/** A message FollowUp or the owner sent through FollowUp. */
export type SentRecord = {
  id: string;
  leadId: string;
  leadName: string;
  message: string | null;
  sentAt: Date;
  automated: boolean;
  /** instant_ack | unanswered | silence | sequence | manual (FollowUp.trigger). */
  trigger: string | null;
};
export type BookedRecord = { id: string; leadId: string; leadName: string; scheduledAt: Date; createdAt: Date };
export type CaughtRecord = { id: string; name: string; source: string | null; createdAt: Date };

/** One row of "FollowUp did": who, what, the words it sent, when. */
export type DidRow = {
  id: string;
  leadId: string;
  /** The customer's name, for the face. */
  person: string;
  title: string;
  sub: string | null;
  /** "8:12 AM" today, "Yesterday", "Saturday". */
  when: string;
  at: Date;
};

function first(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return `“${flat.length > EXCERPT ? `${flat.slice(0, EXCERPT).trimEnd()}…` : flat}”`;
}

/** "8:12 AM" for today, "Yesterday" or the weekday before that. */
export function whenShort(at: Date, now: Date, timeZone: string): string {
  const days = -dayOffset(at, now, timeZone);
  if (days <= 0) return clockTime(at, timeZone);
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(at);
}

/** What a send was, in the owner's words: the trigger says whether it was an answer or a check-in. */
export function sendTitle(s: Pick<SentRecord, "automated" | "trigger" | "leadName">): string {
  const who = first(s.leadName);
  if (!s.automated) return `Sent your reply to ${who}`;
  switch (s.trigger) {
    case "instant_ack":
    case "unanswered":
      return `Answered ${who}`;
    case "silence":
    case "sequence":
      return `Checked in with ${who}`;
    default:
      return `Wrote to ${who}`;
  }
}

/** The source as the owner knows it: "Instagram", "your website form", "Gmail". */
function sourceWords(source: string | null): string | null {
  if (!source) return null;
  const s = source.trim();
  if (!s) return null;
  if (/^web/i.test(s) || /form/i.test(s)) return "your website form";
  if (/lead ?ads?/i.test(s) || /facebook/i.test(s)) return "Facebook";
  return s;
}

/**
 * The rows, newest first, from everything FollowUp did in the window: messages sent (its own and the owner's through
 * it), calls booked, new customers caught. `sayWhen` turns a booked time into "Saturday at 11 am".
 */
export function didRows(
  input: { sent: SentRecord[]; booked: BookedRecord[]; caught: CaughtRecord[] },
  since: Date,
  now: Date,
  timeZone: string,
  sayWhen: (at: Date) => string,
): DidRow[] {
  const rows: DidRow[] = [];
  for (const s of input.sent) {
    if (s.sentAt < since) continue;
    rows.push({
      id: `sent-${s.id}`,
      leadId: s.leadId,
      person: s.leadName,
      title: sendTitle(s),
      sub: s.message ? excerpt(s.message) || null : null,
      when: whenShort(s.sentAt, now, timeZone),
      at: s.sentAt,
    });
  }
  for (const b of input.booked) {
    if (b.createdAt < since) continue;
    rows.push({
      id: `booked-${b.id}`,
      leadId: b.leadId,
      person: b.leadName,
      title: `Booked a call with ${first(b.leadName)}, ${sayWhen(b.scheduledAt)}`,
      sub: null,
      when: whenShort(b.createdAt, now, timeZone),
      at: b.createdAt,
    });
  }
  for (const c of input.caught) {
    if (c.createdAt < since) continue;
    const from = sourceWords(c.source);
    rows.push({
      id: `caught-${c.id}`,
      leadId: c.id,
      person: c.name,
      title: from ? `New customer from ${from}: ${c.name}` : `New customer: ${c.name}`,
      sub: null,
      when: whenShort(c.createdAt, now, timeZone),
      at: c.createdAt,
    });
  }
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** "a, b and c". */
function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The one sentence under the greeting, as FollowUp's report: "Since you last looked, FollowUp answered 4 people, caught
 * 2 new customers, booked 1 call and wrote 16 replies for your OK." A part that is zero is left out. With nothing done
 * and replies waiting: "FollowUp has 16 replies waiting for your OK." Null when there is nothing to report at all.
 */
export function workSentence(n: { sinceLook: boolean; answered: number; caught: number; booked: number; forOk: number }): string | null {
  const did: string[] = [];
  if (n.answered > 0) did.push(`answered ${plural(n.answered, "person", "people")}`);
  if (n.caught > 0) did.push(`caught ${plural(n.caught, "new customer", "new customers")}`);
  if (n.booked > 0) did.push(`booked ${plural(n.booked, "call", "calls")}`);
  if (did.length === 0) {
    return n.forOk > 0 ? `FollowUp has ${plural(n.forOk, "reply", "replies")} waiting for your OK.` : null;
  }
  if (n.forOk > 0) did.push(`wrote ${plural(n.forOk, "reply", "replies")} for your OK`);
  return `${n.sinceLook ? "Since you last looked" : "Today"}, FollowUp ${andList(did)}.`;
}

/** Someone FollowUp wrote to and is waiting on. */
export type WaitingOn = { leadId: string; name: string; sentAt: Date };

/** "2 h", "yesterday", "3 days": how long since the message they haven't answered. */
export function waitWords(sentAt: Date, now: Date, timeZone: string): string {
  const days = -dayOffset(sentAt, now, timeZone);
  if (days <= 0) {
    const h = Math.max(1, Math.floor((now.getTime() - sentAt.getTime()) / 3_600_000));
    return h < 1 ? "just now" : `${h} h`;
  }
  if (days === 1) return "yesterday";
  return `${days} days`;
}

/**
 * "FollowUp is on it" › waiting: the title and the one line under it. `nextCheckIn` is what FollowUp does if the first
 * of them stays quiet, from the plan ("tomorrow", "on Thursday"), or null when nothing is planned.
 */
export function waitingWords(
  waiting: WaitingOn[],
  now: Date,
  timeZone: string,
  nextCheckIn: { name: string; when: string } | null,
): { title: string; sub: string } | null {
  if (waiting.length === 0) return null;
  const title = `Waiting on ${plural(waiting.length, "reply", "replies")}`;
  const named = waiting.slice(0, 3).map((w) => `${first(w.name)} (${waitWords(w.sentAt, now, timeZone)})`);
  const rest = waiting.length - named.length;
  let sub = `${named.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}.`;
  if (nextCheckIn) sub += ` If ${first(nextCheckIn.name)} stays quiet, FollowUp checks in ${nextCheckIn.when}.`;
  return { title, sub };
}

/** "Priya tomorrow · Omar Thursday · Lena Friday" from the coming-up groups; null when nothing is planned. */
export function checkInsWords(groups: { day: string; items: { leadId: string; name: string }[] }[]): { title: string; sub: string; total: number } | null {
  const seen = new Set<string>();
  const parts: string[] = [];
  let total = 0;
  for (const g of groups) {
    for (const it of g.items) {
      if (seen.has(it.leadId)) continue;
      seen.add(it.leadId);
      total += 1;
      if (parts.length < 3) parts.push(`${first(it.name)} ${g.day === "Today" ? "later today" : g.day === "Tomorrow" ? "tomorrow" : g.day}`);
    }
  }
  if (total === 0) return null;
  return { title: total === 1 ? "1 check-in coming up" : `${total} check-ins coming up`, sub: parts.join(" · "), total };
}

/** "Watching Gmail and Instagram": the connected places, in the owner's words. */
export function watchingWords(channels: string[]): string | null {
  const names = channels.filter(Boolean);
  if (names.length === 0) return null;
  return `Watching ${andList(names)}`;
}
