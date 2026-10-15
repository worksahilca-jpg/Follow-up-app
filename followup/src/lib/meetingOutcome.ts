/**
 * "How did it go?" (A-263, 2026-10-15): the day after a booked call, Today
 * asks the owner one question and one tap ends the conversation the right
 * way. Before this, a meeting left the customer in limbo: FollowUp stopped
 * chasing them (rule 1 of the plan) and the only way to close them was the
 * Won/Lost switch hidden in Details, which nothing reminded the owner to use.
 *
 * Pure: the words and the rules. The database side is meetingOutcomeData.ts.
 */

export type MeetingOutcome = "working" | "deciding" | "not_going" | "didnt_happen";

export const MEETING_OUTCOMES: readonly MeetingOutcome[] = ["working", "deciding", "not_going", "didnt_happen"];

/** The four answers, in the order the card shows them (2×2 on a phone). */
export const MEETING_ANSWERS: readonly { outcome: MeetingOutcome; label: string }[] = [
  { outcome: "working", label: "Working with me" },
  { outcome: "deciding", label: "Still deciding" },
  { outcome: "not_going", label: "Not going ahead" },
  { outcome: "didnt_happen", label: "Didn't happen" },
];

/** A call is asked about for this long after it ended; older ones are let be. */
export const LOOK_BACK_DAYS = 7;

/** Lead.suggestedDraftKind and the hold's trigger for the "one new time" note after a missed call. */
export const MEETING_MISSED_KIND = "meeting_missed";

const DAY = 86_400_000;

export function isMeetingOutcome(v: unknown): v is MeetingOutcome {
  return typeof v === "string" && (MEETING_OUTCOMES as readonly string[]).includes(v);
}

/**
 * The confirmed calls that have ended, within the look-back, with no answer
 * yet, newest first. The end is the start plus the booked length.
 */
export function endedMeetings<T extends { scheduledAt: Date; durationMinutes: number; status: string; outcome: string | null }>(bookings: readonly T[], now: Date): T[] {
  const nowMs = now.getTime();
  return bookings
    .filter((b) => b.status === "confirmed" && b.outcome == null)
    .filter((b) => {
      const end = b.scheduledAt.getTime() + Math.max(0, b.durationMinutes) * 60_000;
      return end <= nowMs && end >= nowMs - LOOK_BACK_DAYS * DAY;
    })
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
}

/** "yesterday at 2:00 PM", "today at 2:00 PM", "on Mon, Oct 12 at 2:00 PM", on the owner's clock. */
export function meetingWhen(at: Date, now: Date, timeZone: string): string {
  const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const days = Math.round((Date.parse(ymd(now)) - Date.parse(ymd(at))) / DAY);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(at);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  return `on ${new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(at)} at ${time}`;
}

/**
 * What the card says once the owner has answered: what FollowUp does now,
 * in one or two plain sentences (the drawing's words). `plan` is the name of
 * the plan that carries on for someone still deciding ("Fast").
 */
export function outcomeWords(outcome: MeetingOutcome, first: string, plan: string): { headline: string; body: string } {
  switch (outcome) {
    case "working":
      return { headline: `${first} is now your client.`, body: `FollowUp stays out of the chat. If ${first} writes, it comes to you.` };
    case "deciding":
      return {
        headline: `${first} is still deciding.`,
        body: `FollowUp sends ${first} a short thank-you tomorrow. Then the ${plan} plan carries on until ${first} books again or says no.`,
      };
    case "not_going":
      return { headline: `${first} isn't going ahead.`, body: `Marked Lost. FollowUp sends nothing more. If ${first} writes again, you'll see it.` };
    case "didnt_happen":
      return { headline: `The call with ${first} didn't happen.`, body: `FollowUp offers ${first} one new time, once, then waits.` };
  }
}

/**
 * The note after a call that didn't happen: no blame, one link to pick a
 * new time from the owner's free hours, held for the owner's OK. A
 * template, not a generated reply, so it can never state a fact about the
 * business; `caller` is the person who was going to take the call.
 */
export function missedNote(first: string, link: string, caller: string | null): string {
  const who = caller ? `${caller} here` : "Hi";
  return `${who}, ${first}. Sorry we missed each other. Pick any time that suits you here and I'll confirm it: ${link}\nIf the day you want isn't there, tell me and I'll make it work.`;
}

export function missedSubject(): string {
  return "A new time that suits you";
}
