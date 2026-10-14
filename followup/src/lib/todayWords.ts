/**
 * Today's plain sentences (A-243, A-244; after R-113 "how do i get to know
 * what to do" and R-114 "Today is the gist of everything"). Today is the
 * owner's whole day: what to do first, what is left, how far through they
 * are, and tomorrow. Each line says what it is in words.
 */

/** "Ivy, Aman and 2 more": who comes after, by first name, two at most. */
export function whoIsNext(names: string[]): string | null {
  const firsts = names.map((n) => n.trim().split(/\s+/)[0] || n);
  if (firsts.length === 0) return null;
  if (firsts.length === 1) return firsts[0];
  if (firsts.length === 2) return `${firsts[0]} and ${firsts[1]}`;
  return `${firsts[0]}, ${firsts[1]} and ${firsts.length - 2} more`;
}

/** What to do, in one sentence above the customer. Nothing when nobody is waiting. */
export function todaysInstruction(waiting: number, firstName: string | null): string | null {
  if (!firstName || waiting < 1) return null;
  if (waiting === 1) return `Reply to ${firstName}, then you're done.`;
  return `Reply to them one at a time. Start with ${firstName}.`;
}

/** The hour on the owner's own clock, 0–23. */
function hourIn(now: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(h) % 24;
}

/** "Good morning, Priya." on the owner's own clock; no name, no comma. */
export function greeting(now: Date, timeZone: string, name: string | null | undefined): string {
  const h = hourIn(now, timeZone);
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}.` : `${part}.`;
}

/** The line under the greeting: who to start with, or that the day is clear. */
export function dayLine(startWith: string | null, anythingToDo: boolean): string {
  if (startWith) return `Here is your day. Start with ${startWith}.`;
  return anythingToDo ? "Here is your day." : "Nothing needs you right now.";
}

/**
 * What the day is made of, in one line under its count (A-250): "4 replies to
 * send · 2 calls to make · 1 booked call at 3:00 PM". A kind with none is left
 * out rather than said as a zero; with replies only, the line still says there
 * are no calls or bookings, so the owner knows without looking (R-114: "How
 * many calls do I need to do?"). `nextBookedAt` is the next booked call's time
 * today on the owner's clock, or null when none is still to come.
 */
export function dayParts(n: { replies: number; calls: number; booked: number; nextBookedAt: string | null }): string | null {
  const parts: string[] = [];
  if (n.replies > 0) parts.push(`${n.replies} ${n.replies === 1 ? "reply" : "replies"} to send`);
  if (n.calls > 0) parts.push(`${n.calls} ${n.calls === 1 ? "call" : "calls"} to make`);
  if (n.booked === 1) parts.push(`1 booked call${n.nextBookedAt ? ` at ${n.nextBookedAt}` : ""}`);
  if (n.booked > 1) parts.push(`${n.booked} booked calls${n.nextBookedAt ? `, the next at ${n.nextBookedAt}` : ""}`);
  if (parts.length === 0) return null;
  if (n.calls === 0 && n.booked === 0) return `${parts[0]}. No calls or bookings today.`;
  return parts.join(" · ");
}

/** "3 of 11 done today": nothing to show when there is nothing at all in the day. */
export function dayProgress(done: number, toGo: number): { done: number; total: number; toGo: number; pct: number } | null {
  const d = Math.max(0, done);
  const left = Math.max(0, toGo);
  const total = d + left;
  if (total === 0) return null;
  return { done: d, total, toGo: left, pct: Math.round((d / total) * 100) };
}

/** Which of the owner's days a time falls on: 0 today, 1 tomorrow, anything else is neither. */
export function dayOffset(at: Date, now: Date, timeZone: string): number {
  const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return Math.round((Date.parse(ymd(at)) - Date.parse(ymd(now))) / 86_400_000);
}

/** "6:30 PM" on the owner's own clock. */
export function clockTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(at);
}

/** "Done today": what happened, one plain line each. Only what is true; nothing when nothing happened. */
export function doneLines(input: { handled: number; wroteFor: number; booked: { name: string; when: string }[] }): string[] {
  const lines: string[] = [];
  if (input.handled > 0) lines.push(`You handled ${input.handled} ${input.handled === 1 ? "customer" : "customers"}.`);
  if (input.wroteFor > 0) lines.push(`FollowUp wrote to ${input.wroteFor} ${input.wroteFor === 1 ? "customer" : "customers"} for you.`);
  for (const b of input.booked) lines.push(`${b.name} booked a call for ${b.when}.`);
  return lines;
}
