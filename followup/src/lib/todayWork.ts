import { clockTime, dayOffset } from "@/lib/todayWords";
import { META_DM_CHANNELS, META_DM_WINDOW_HOURS, UNANSWERED_META_DM_MAX_HOURS } from "@/lib/metaWindow";

/**
 * Today (A-336, then A-337 from the research): the pure part. The owner's heading; what FollowUp did since the owner
 * last looked, said as rows with names, times and the words it sent; FollowUp's one sentence; what it does next; and
 * when it last checked. Only what the records hold, so it can never claim work that didn't happen. The data comes
 * from src/lib/todayWorkData.ts.
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

/** Someone's own words on one line, in quotes and cut short: a waiting row on Today (A-337). Null when there are none. */
export function quoteWords(text: string | null | undefined): string | null {
  return text ? excerpt(text) || null : null;
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
 * When someone started waiting, as the owner says it (A-337): "9:14 AM" today, "yesterday", "Mon" this week, "Sep 25"
 * before that. The card says "waiting since Sep 25"; a row says "since 9:14 AM". A date, never a ticking "ago".
 */
export function sinceWords(at: Date, now: Date, timeZone: string): string {
  const days = -dayOffset(at, now, timeZone);
  if (days <= 0) return clockTime(at, timeZone);
  if (days === 1) return "yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(at);
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(at);
}

/**
 * The heading of Today (A-337): the owner's part, first and the only loud thing. The replies FollowUp wrote for their
 * OK come first; with none, their other decisions; with nothing at all, a calm line that says what FollowUp keeps doing.
 */
export function ownerHeading(n: { replies: number; others: number; handled: number; holdAll: boolean; sendLocked?: boolean }): { title: string; sub: string } {
  if (n.replies > 0) {
    // The task in one plain sentence (R-113, A-338). A teammate who can't send is told who does.
    const one = n.replies === 1;
    const sub = n.sendLocked
      ? `FollowUp wrote ${one ? "it" : "them"}. An admin on your team sends ${one ? "it" : "them"}.`
      : one
        ? "FollowUp wrote it. Read it, then press Send."
        : "FollowUp wrote them. Read each one, then press Send.";
    return { title: one ? "1 reply needs your OK" : `${n.replies} replies need your OK`, sub };
  }
  if (n.others > 0) return { title: `${n.others} ${n.others === 1 ? "thing needs" : "things need"} you`, sub: "No replies to send right now." };
  if (n.handled > 0) {
    return { title: "You're done for today", sub: `You handled ${plural(n.handled, "person", "people")} today. FollowUp keeps watching, and will tell you when someone writes.` };
  }
  return {
    title: "You're all caught up",
    sub: n.holdAll
      ? "Every reply FollowUp writes shows up here first. Nothing goes out until you send it."
      : "Anything FollowUp isn't sure about will show up here before it sends.",
  };
}

/**
 * FollowUp's sentence at the top of its panel (A-337): what it did on its own while the owner was away, zeros left out.
 * With nothing of its own, the replies it sent for the owner; with nothing at all, a plain "Nothing new" and the week.
 * `since` is sinceLabel(): "today", "since 9:40 PM", "since Saturday", "this week".
 */
export function panelSentence(n: { sinceLook: boolean; since: string; answered: number; booked: number; caught: number; yourSends: number; weekAnswered: number }): string {
  const did: string[] = [];
  if (n.answered > 0) did.push(`answered ${plural(n.answered, "person", "people")}`);
  if (n.booked > 0) did.push(`booked ${plural(n.booked, "call", "calls")}`);
  if (n.caught > 0) did.push(`caught ${plural(n.caught, "new customer", "new customers")}`);
  if (did.length > 0) return `${n.sinceLook ? "While you were away" : "Today"}, FollowUp ${andList(did)}.`;
  const when = n.since.charAt(0).toUpperCase() + n.since.slice(1);
  if (n.yourSends > 0) return `${when}, FollowUp sent ${plural(n.yourSends, "reply", "replies")} for you.`;
  const week = n.weekAnswered > 0 && n.since !== "this week" ? ` This week, ${plural(n.weekAnswered, "customer", "customers")} got an answer.` : "";
  return `Nothing new ${n.since}.${week}`;
}

/**
 * The last line of FollowUp's panel (A-337): what it watches and when it last looked, as a plain fact, no dot and no
 * ticking clock. Only Gmail reports a time. Instagram is read every few minutes, so a Gmail check within the hour is
 * true of both; an older one is said as Gmail's alone (the reconnect notice says what to do).
 */
export function checkedLine(names: string[], gmailCheckedAt: Date | null, now: Date, timeZone: string): string | null {
  const list = names.filter(Boolean);
  if (list.length === 0) return null;
  if (gmailCheckedAt && list.includes("Gmail")) {
    if (now.getTime() - gmailCheckedAt.getTime() < 60 * 60 * 1000) return `Checked ${andList(list)} at ${clockTime(gmailCheckedAt, timeZone)}.`;
    const words = sinceWords(gmailCheckedAt, now, timeZone);
    const when = /\d:\d\d/.test(words) ? `at ${words}` : words === "yesterday" ? "yesterday" : `on ${words}`;
    const others = list.filter((n) => n !== "Gmail");
    return `Gmail last checked ${when}.${others.length > 0 ? ` Watching ${andList(others)}.` : ""}`;
  }
  return `Watching ${andList(list)}.`;
}

/**
 * Instagram and Messenger's deadline, only near the end (A-028, A-338): the hours left in Meta's 24-hour reply window,
 * from 20 hours after they wrote until it shuts. Null for any other app, before then, and after it has shut (the
 * customer's page says what can still go out). Rounded down, so it never offers an hour that has gone.
 */
export function replyWindowLeft(channel: string | null | undefined, wroteAt: Date | null, now: Date): number | null {
  if (!channel || !META_DM_CHANNELS.has(channel) || !wroteAt) return null;
  const hoursSince = (now.getTime() - wroteAt.getTime()) / 3_600_000;
  if (hoursSince < UNANSWERED_META_DM_MAX_HOURS || hoursSince >= META_DM_WINDOW_HOURS) return null;
  return Math.max(0, Math.floor(META_DM_WINDOW_HOURS - hoursSince));
}

/** "3 h left to reply"; "Under 1 h left to reply" in the last hour. */
export function windowWords(hoursLeft: number | null): string | null {
  if (hoursLeft === null) return null;
  return hoursLeft < 1 ? "Under 1 h left to reply" : `${hoursLeft} h left to reply`;
}

/** Something FollowUp will do next, or a call the owner has coming (A-337's "Coming up"). */
export type ComingRow = { key: string; person: string; title: string; sub: string | null; when: string; href: string; at: Date };

/** "Later today", "Tomorrow", "Thursday", "Mon, Oct 5": days only for FollowUp's own steps (it runs hourly). */
function dayWord(at: Date, now: Date, timeZone: string): string {
  const days = dayOffset(at, now, timeZone);
  if (days <= 0) return "Later today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(at);
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(at);
}

/** A planned step in the owner's words: "Checks in with Priya", "Replies to Ethan", "Thanks Raj after your call". */
function stepTitle(what: string, who: string): string {
  if (what === "A reply to their message") return `Replies to ${who}`;
  if (what === "Thank-you after your call") return `Thanks ${who} after your call`;
  if (what === "Check-in they asked for") return `Checks in with ${who}, as they asked`;
  if (what.startsWith("Welcome back")) return `Welcome-back note to ${who}`;
  if (what.startsWith("Next step of")) return `${what} for ${who}`;
  return `Checks in with ${who}`;
}

/**
 * "Coming up" in FollowUp's panel (A-337): its planned steps (from the coming-up plan, each person once) and the
 * owner's booked calls after today, soonest first. A step that only happens if they stay quiet says so.
 */
export function comingUpRows(
  steps: { leadId: string; name: string; at: Date; what: string; unless: boolean }[],
  calls: { id: string; leadId: string; name: string; at: Date }[],
  now: Date,
  timeZone: string,
  /** A booked time the way FollowUp's rows say it: "Saturday at 11 am" (bookingTimes.sayTime, A-338). */
  sayWhen: (at: Date) => string,
): ComingRow[] {
  const rows: ComingRow[] = [];
  const seen = new Set<string>();
  for (const s of steps) {
    if (seen.has(s.leadId)) continue;
    seen.add(s.leadId);
    const who = first(s.name);
    const step = /check-in/i.test(s.what) && !/they asked/i.test(s.what) ? s.what : null;
    const quiet = s.unless ? `if ${who} stays quiet` : null;
    const sub = step && quiet ? `${step}, ${quiet}` : step ?? (quiet ? quiet.charAt(0).toUpperCase() + quiet.slice(1) : null);
    rows.push({ key: `step-${s.leadId}`, person: s.name, title: stepTitle(s.what, who), sub, when: dayWord(s.at, now, timeZone), href: `/leads/${s.leadId}`, at: s.at });
  }
  for (const c of calls) {
    const said = sayWhen(c.at);
    rows.push({ key: `call-${c.id}`, person: c.name, title: `Your call with ${first(c.name)}`, sub: null, when: said.charAt(0).toUpperCase() + said.slice(1), href: "/calls", at: c.at });
  }
  return rows.sort((a, b) => a.at.getTime() - b.at.getTime());
}
