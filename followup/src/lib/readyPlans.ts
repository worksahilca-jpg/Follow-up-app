/**
 * Ready follow-up plans (design brain A-044, the Zapier study): pick one,
 * change a day if you want. Each step is a day and a plain line saying
 * what FollowUp writes; `hint` is what steers the draft (the messageHint
 * sequences.ts already passes to the drafting prompt).
 *
 * No hint invents a fact: no times, prices or offers the conversation
 * doesn't contain. The drafting rules hold a draft that tries.
 */
export type ReadyStep = { day: number; label: string; hint: string };
export type ReadyPlan = { id: string; name: string; who: string; steps: ReadyStep[] };

export const READY_PLANS: ReadyPlan[] = [
  {
    id: "after-quote",
    name: "After a quote",
    who: "For someone you've sent a price to.",
    steps: [
      { day: 2, label: "Check they got the quote", hint: "A short, light check that they received the quote and whether anything in it is unclear. No pressure, and no new prices or figures." },
      { day: 5, label: "Answer the question most people ask", hint: "Answer the question a customer usually has at this point about a quote like this one, using only what the conversation already says. End with one easy question." },
      { day: 12, label: "One last, easy check-in", hint: "A last, friendly check-in that makes it easy to say yes, not now, or no. No deadline, nothing that reads as pressure." },
    ],
  },
  {
    id: "after-no-show",
    name: "After a no-show",
    who: "For a missed visit or call.",
    steps: [
      { day: 0, label: "Make rebooking easy", hint: "They missed the visit or call. No blame and no apology from them needed: say it's no problem and ask what time would suit them instead. Don't propose specific times." },
      { day: 2, label: "A friendly nudge to rebook", hint: "A short, friendly nudge to find a new time. One easy question." },
      { day: 7, label: "Leave the door open", hint: "Leave the door open warmly: they can get back in touch whenever suits them. No question that needs an answer." },
    ],
  },
  {
    id: "seasonal",
    name: "Seasonal check-in",
    who: "For past customers, before your busy season.",
    steps: [
      { day: 0, label: "A friendly note and one useful tip", hint: "A friendly note to a past customer ahead of the season, with one practical, general tip related to the work you did for them. No prices, no discount, no invented offer." },
      { day: 14, label: "Offer to book them in", hint: "Offer, plainly, to book them in if they'd like. One easy question." },
    ],
  },
];

/** Cumulative days → the gap-from-previous-step hours sequences.ts runs on. */
export function toStepDelays(days: number[]): number[] {
  const sorted = [...days].map((d) => Math.max(0, Math.round(d)));
  return sorted.map((d, i) => (d - (i === 0 ? 0 : sorted[i - 1])) * 24);
}

/** "Same day", "Day 5". */
export function dayLabel(day: number): string {
  return day === 0 ? "Same day" : `Day ${day}`;
}
