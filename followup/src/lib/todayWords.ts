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

/** "a, b and c". */
function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The day in one sentence under the greeting (A-266, 2026-10-16; was a box with a count, a bar and a line, A-250):
 * "4 people are waiting for your reply. Start with Karan." Calls to make and booked calls join it when there are
 * any ("…, and you have 2 calls to make and 1 booked call at 3:00 PM."); a kind with none is left out, never said as
 * a zero. A call to look back on (A-263) is a row below, and is only said here when it is all there is.
 */
export function daySentence(n: {
  people: number;
  calls: number;
  booked: number;
  /** The next booked call's time today, "3:00 PM", or null when none is still to come. */
  nextBookedAt: string | null;
  lookBack?: number;
  startWith: string | null;
}): string {
  const extra: string[] = [];
  if (n.calls > 0) extra.push(`${n.calls} ${n.calls === 1 ? "call" : "calls"} to make`);
  if (n.booked === 1) extra.push(`1 booked call${n.nextBookedAt ? ` at ${n.nextBookedAt}` : ""}`);
  if (n.booked > 1) extra.push(`${n.booked} booked calls${n.nextBookedAt ? `, the next at ${n.nextBookedAt}` : ""}`);
  const waiting = n.people > 0 ? `${n.people === 1 ? "1 person is" : `${n.people} people are`} waiting for your reply` : null;
  let said: string;
  if (waiting && extra.length > 0) said = `${waiting}, and you have ${andList(extra)}.`;
  else if (waiting) said = `${waiting}.`;
  else if (extra.length > 0) said = `You have ${andList(extra)} today.`;
  else if (n.lookBack && n.lookBack > 0) said = `You have ${n.lookBack === 1 ? "a call" : `${n.lookBack} calls`} to look back on.`;
  else return "Nothing needs you right now.";
  said = said.charAt(0).toUpperCase() + said.slice(1);
  return n.startWith ? `${said} Start with ${n.startWith}.` : said;
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

/**
 * The owner's own next thing, said when their replies are done (A-283, after Todoist's "Upcoming" and Granola's next
 * meeting): "Next: your call with Raj at 3:00 PM." or "… tomorrow at 10:00 AM." Only a booked call counts, because it
 * is the one thing with a time the owner must keep; FollowUp's own check-ins have their own line.
 */
export function nextForYouLine(next: { name: string; time: string; tomorrow: boolean } | null): string | null {
  if (!next) return null;
  const first = next.name.trim().split(/\s+/)[0] || next.name;
  return `Next: your call with ${first} ${next.tomorrow ? "tomorrow " : ""}at ${next.time}.`;
}
