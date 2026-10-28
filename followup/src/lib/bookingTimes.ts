/**
 * Booking in the chat (A-242, approved 2026-10-13, redrawn and built 2026-10-28; change and cancel the same day).
 *
 * When a customer wants to meet (they asked to see a home, or said yes to
 * FollowUp's offer of a viewing or a call), the reply offers TWO concrete
 * times from the owner's free hours ("Saturday at 11 am or Sunday at 2 pm.
 * Which works for you?") instead of the next question or the booking link.
 * When they pick one, FollowUp answers "Great. Let me confirm that and get
 * right back to you.", the owner gets one buzz and a card with one black
 * button (Confirm), and only after Confirm is anything booked or said to be.
 *
 * Pure: words in, words out. The free times come from src/lib/booking.ts
 * (offerTwoTimes); the engine wiring is in src/lib/scoring.ts; the owner's
 * three buttons are POST /api/leads/[id]/picked-time.
 */
import type { Message } from "@/lib/types";
import { dayOffset } from "@/lib/todayWords";
import { declineIn } from "@/lib/declinePhrases";

/** What is stored on Lead.offeredTimes while the offer is the last thing FollowUp said. */
export type OfferedTimes = { at: string[]; said: string[]; offeredAt?: string };
/** Two (or, on a thin calendar, one) free times, as instants and as words. */
export type OfferedPair = { at: string[]; said: string[] };

/** Their message asks to see, visit, tour, meet, call, book or schedule something. */
const MEET =
  /\b(see (it|this|that|the|an?|\d+)|view(ing)?|showing|visit|tour|walk[- ]?through|open house|come (by|over|see|through)|meet( up)?|(a |phone |quick )?call|call me|chat|book|appointment|schedule|free (on|this|next|to))\b/i;
/** A day or time word, the sign that a question is about when, not whether. */
const WHEN =
  /\b(today|tomorrow|tonight|weekend|weekday|morning|afternoon|evening|noon|mon|tue|tues|wed|thu|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week|\d{1,2}(:\d\d)?\s?(am|pm))\b/i;
/** A plain no, said first or on its own: not a request to meet. */
const REFUSAL = /^(no|nope|nah|not)\b|\b(not interested|no thanks|no thank you|unsubscribe|stop)\b/i;

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function isAck(m: Message): boolean {
  return m.direction === "outbound" && (m.trigger === "instant_ack" || m.trigger === "instant_ack_dm");
}

/** FollowUp's (or the owner's) last real message: the one an offer would be in. */
export function lastOurs(conversation: readonly Message[]): Message | null {
  return [...conversation].reverse().find((m) => m.direction === "outbound" && !isAck(m)) ?? null;
}

/**
 * Their newest message asks to meet: it names seeing, visiting, calling,
 * booking or meeting AND asks (a question mark) or names a day or time.
 * A yes to FollowUp's own offer is read separately (saidYesToMeeting).
 */
export function asksToMeet(conversation: readonly Message[]): boolean {
  const newest = conversation[conversation.length - 1];
  if (!newest || newest.direction !== "inbound") return false;
  const text = newest.body.trim();
  if (text.length === 0 || text.length > 400 || REFUSAL.test(text)) return false;
  return MEET.test(text) && (/\?/.test(text) || WHEN.test(text));
}

function parts(iso: string, timeZone: string): { day: number; hour: number; minute: number; ymd: string } {
  const at = new Date(iso);
  const f = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const day = SHORT.indexOf(String(p.weekday).slice(0, 3).toLowerCase() as (typeof SHORT)[number]);
  return { day, hour: Number(p.hour) % 24, minute: Number(p.minute), ymd: `${p.year}-${p.month}-${p.day}` };
}

/** The weekday (0 = Sunday) their message names, or null. "Tomorrow" and "today" count; "weekend" means Saturday. */
export function wantedDay(text: string, now: Date, timeZone: string): number | null {
  const t = text.toLowerCase();
  const today = parts(now.toISOString(), timeZone).day;
  if (/\btoday\b/.test(t)) return today;
  if (/\btomorrow\b/.test(t)) return (today + 1) % 7;
  for (let i = 0; i < 7; i++) if (new RegExp(`\\b(${DAYS[i]}|${SHORT[i]})\\b`).test(t)) return i;
  if (/\bweekend\b/.test(t)) return 6;
  return null;
}

/**
 * Two free times to offer, on two different days, from the open slots
 * (ISO, ascending): the first on the day they asked for when there is one,
 * else the first open day; the second on the next open day. Within a day
 * a whole hour from mid-morning (or early afternoon for the second) reads
 * like a person's suggestion, not a calendar's first slot. One time when
 * only one day is open; null when nothing is.
 */
export function chooseTwo(
  slots: readonly string[],
  opts: { timeZone: string; now: Date; wantDay?: number | null; avoid?: readonly string[] }
): string[] | null {
  const avoid = new Set((opts.avoid ?? []).map((s) => new Date(s).getTime()));
  const byDay = new Map<string, { day: number; slots: string[] }>();
  for (const iso of slots) {
    if (avoid.has(new Date(iso).getTime())) continue;
    const p = parts(iso, opts.timeZone);
    const entry = byDay.get(p.ymd) ?? { day: p.day, slots: [] };
    entry.slots.push(iso);
    byDay.set(p.ymd, entry);
  }
  const days = [...byDay.values()];
  if (days.length === 0) return null;
  const pickIn = (day: string[], from: number): string => {
    const whole = day.filter((iso) => parts(iso, opts.timeZone).minute === 0);
    return whole.find((iso) => parts(iso, opts.timeZone).hour >= from) ?? whole[0] ?? day[0];
  };
  const wanted = opts.wantDay == null ? -1 : days.findIndex((d) => d.day === opts.wantDay);
  const firstIndex = wanted >= 0 ? wanted : 0;
  const first = pickIn(days[firstIndex].slots, 10);
  const second = days.find((_, i) => i !== firstIndex);
  return second ? [first, pickIn(second.slots, 13)] : [first];
}

function clock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(":00", "")
    .toLowerCase();
}

function longDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));
}

/** "Saturday at 11 am", "tomorrow at 2 pm", "today at 3:30 pm"; a week or more out, "Saturday, Nov 8 at 11 am". */
export function sayTime(iso: string, timeZone: string, now: Date): string {
  const at = new Date(iso);
  const offset = dayOffset(at, now, timeZone);
  const time = clock(iso, timeZone);
  if (offset === 0) return `today at ${time}`;
  if (offset === 1) return `tomorrow at ${time}`;
  if (offset < 7) return `${DAYS[parts(iso, timeZone).day][0].toUpperCase()}${DAYS[parts(iso, timeZone).day].slice(1)} at ${time}`;
  return `${longDay(iso, timeZone)} at ${time}`;
}

/** "Saturday at 11 am or Sunday at 2 pm". */
export function sayTimes(said: readonly string[]): string {
  return said.length <= 1 ? said.join("") : `${said.slice(0, -1).join(", ")} or ${said[said.length - 1]}`;
}

/** The reply chip under a DM offer: short, under Meta's 20 characters ("Sat 11 am", "Tomorrow 2 pm"). */
export function offerButtons(pair: OfferedPair, timeZone: string, now: Date): string[] {
  return pair.at.map((iso) => {
    const offset = dayOffset(new Date(iso), now, timeZone);
    const day = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : `${SHORT[parts(iso, timeZone).day][0].toUpperCase()}${SHORT[parts(iso, timeZone).day].slice(1)}`;
    return `${day} ${clock(iso, timeZone)}`.slice(0, 20);
  });
}

/** The DM reply that offers the times: fixed words, so the calendar rule never has to judge an invented day. */
export function offerText(said: readonly string[]): string {
  if (said.length === 1) return `I can do ${said[0]}. Does that work for you?`;
  return `I can do ${sayTimes(said)}. Which works for you?`;
}

/** The paragraph the email writer gets: these exact times, one job, no other question. */
export function offerTimesPromptBlock(said: readonly string[] | null | undefined, moving = false): string {
  if (!said || said.length === 0) return "";
  return (
    (moving
      ? "\n\nTHEY WANT TO MOVE THE TIME THEY HAD BOOKED. Say that's no problem. Your reply's one job is then to offer "
      : "\n\nTHEY WANT TO MEET. Your reply's one job is to offer ") +
    (said.length === 1 ? "this time" : "these two times") +
    `, word for word, and ask which works for them: ${sayTimes(said)}. ` +
    "Each is free in this business's calendar. Never offer or suggest any other day or time, never say anything is " +
    "booked or confirmed (the owner confirms after they choose), and ask no other question in this reply. Keep it " +
    "to two or three short sentences."
  );
}

/** What the customer hears the moment they pick: nothing is promised yet. */
export function pickAck(): string {
  return "Great. Let me confirm that and get right back to you.";
}

/** After the owner's Confirm: the time and, when known, the place. No reminder is promised: none is sent. */
export function bookedText(iso: string, timeZone: string, where: string | null): string {
  return `Booked: ${longDay(iso, timeZone)} at ${clock(iso, timeZone)}${where ? `, ${where}` : ""}. See you then.`;
}

/** After "Another time": the owner's side couldn't, two new times. */
export function anotherTimeText(said: readonly string[]): string {
  return `Sorry, that one doesn't work on my side after all. ${offerText(said)}`;
}

/** The DM reply when they asked to move their booked time: fine, two new times. */
export function moveOfferText(said: readonly string[]): string {
  return `Sure, let's find another time. ${offerText(said)}`;
}

/** After the owner's Confirm on a move: the new time and, when known, the place. */
export function movedText(iso: string, timeZone: string, where: string | null): string {
  return `Moved: ${longDay(iso, timeZone)} at ${clock(iso, timeZone)}${where ? `, ${where}` : ""}. See you then.`;
}

/** After "Keep <old>": the owner can't do the new time; the old one stands if they can still make it. */
export function keepText(oldSaid: string, newSaid: string): string {
  return `Sorry, ${newSaid} doesn't work on my side after all. Can you still make ${oldSaid}? If not, tell me and I'll find another time.`;
}

/** What the customer hears when they cancel: the slot is free, the door stays open. Nothing else is asked. */
export function cancelAckText(said: string): string {
  return `No problem, I've taken ${said} off the calendar. Whenever you'd like to set up another time, just let me know.`;
}

/** The owner pressed Change on a booked time: the old one is off, two new ones offered. */
export function ownerChangeText(oldSaid: string, said: readonly string[]): string {
  return `Sorry, something came up on my side and I can't do ${oldSaid} anymore. ${offerText(said)}`;
}

/** The owner pressed Cancel on a booked time. No new time is offered: that was their choice. */
export function ownerCancelText(oldSaid: string): string {
  return `Sorry, I have to cancel ${oldSaid}. I'll get back to you about another time.`;
}

/** "Offer another time" after a customer cancelled: two free times, offered once, gently. */
export function reofferText(said: readonly string[]): string {
  return `If it helps, ${offerText(said)}`;
}

/** The grey line under a reply that carries the offer: information, not a check. */
export function offerReason(first: string): string {
  return `FollowUp offered ${first} two times from your free hours. Nothing is booked until you confirm.`;
}

/** The owner's one buzz when a customer picks; on a move, what they had. */
export function pickedBuzz(first: string, saidPicked: string, from: string | null = null): { title: string; body: string } {
  if (from) return { title: `${first} wants to move`, body: `${first} wants ${saidPicked} instead of ${from}. Tap to confirm.` };
  return { title: `${first} picked a time`, body: `${first} wants ${saidPicked}. Tap to confirm.` };
}

/** The owner's one buzz when a customer cancels their booked time. */
export function cancelledBuzz(first: string, said: string): { title: string; body: string } {
  return { title: `${first} cancelled`, body: `${first} cancelled ${said}. Offer another time?` };
}

/** The black button's words: "Saturday 11 AM", "Tomorrow 2 PM". */
export function confirmLabel(iso: string, timeZone: string, now: Date): string {
  const offset = dayOffset(new Date(iso), now, timeZone);
  const day = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : `${DAYS[parts(iso, timeZone).day][0].toUpperCase()}${DAYS[parts(iso, timeZone).day].slice(1)}`;
  return `${day} ${clock(iso, timeZone).toUpperCase()}`;
}

/** The card's day line ("Saturday, Nov 1"; "Today" / "Tomorrow" first when it is) and time line ("11:00 AM"). */
export function pickedLines(iso: string, timeZone: string, now: Date): { day: string; time: string } {
  const offset = dayOffset(new Date(iso), now, timeZone);
  const date = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(new Date(iso));
  const day = offset === 0 ? `Today, ${date}` : offset === 1 ? `Tomorrow, ${date}` : longDay(iso, timeZone);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return { day, time };
}

/** What they are meeting for, from the words either side used last: a viewing, a home visit, or a call. */
export function whatFor(conversation: readonly Message[]): "Viewing" | "Home visit" | "Call" {
  const text = conversation
    .slice(-4)
    .map((m) => m.body)
    .join("\n");
  if (/\b(view|viewing|see (it|the)|showing|show (you|it)|tour|walk[- ]?through|open house)\b/i.test(text)) return "Viewing";
  if (/\b(visit|come (by|over|through)|come and see|appraisal|valuation)\b/i.test(text)) return "Home visit";
  if (/\b(call|chat|phone)\b/i.test(text)) return "Call";
  return "Viewing";
}

function hits(text: string, iso: string, timeZone: string, now: Date): { day: boolean; time: boolean } {
  const t = text.toLowerCase();
  const p = parts(iso, timeZone);
  const offset = dayOffset(new Date(iso), now, timeZone);
  const date = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(new Date(iso)).toLowerCase();
  const dateLong = new Intl.DateTimeFormat("en-US", { timeZone, month: "long", day: "numeric" }).format(new Date(iso)).toLowerCase();
  const day =
    new RegExp(`\\b(${DAYS[p.day]}|${SHORT[p.day]})\\b`).test(t) ||
    (offset === 0 && /\btoday\b/.test(t)) ||
    (offset === 1 && /\btomorrow\b/.test(t)) ||
    t.includes(date) ||
    t.includes(dateLong);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const ampm = p.hour < 12 ? "am" : "pm";
  const mm = String(p.minute).padStart(2, "0");
  // "11", "11 am", "11:00", "11:30 am", "at 11", "11am"; a bare number needs "at", a colon, am/pm or o'clock beside it.
  const time = new RegExp(`(\\bat\\s+${h12}(:${mm})?\\s?(${ampm}|a\\.m\\.|p\\.m\\.|o'?clock)?\\b|\\b${h12}:${mm}\\s?(${ampm}|a\\.m\\.|p\\.m\\.)?\\b|\\b${h12}\\s?(${ampm}|a\\.m\\.|p\\.m\\.|o'?clock)\\b)`).test(t);
  const wrongHalf = new RegExp(`\\b${h12}(:${mm})?\\s?(${ampm === "am" ? "pm" : "am"})\\b`).test(t);
  return { day, time: time && !wrongHalf };
}

/** Does this text name each offered time (its day and its hour)? Used on FollowUp's own offer and on the writer's draft. */
export function carriesOffer(text: string, offer: Pick<OfferedTimes, "at">, timeZone: string, now: Date): boolean {
  if (!text || offer.at.length === 0) return false;
  return offer.at.every((iso) => {
    const h = hits(text, iso, timeZone, now);
    return h.day && h.time;
  });
}

const NAMES_A_TIME = /(\b\d{1,2}:\d\d\b|\b\d{1,2}\s?(am|pm|a\.m\.|p\.m\.|o'?clock)\b|\bat\s+\d{1,2}\b)/i;
const NAMES_A_DAY = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/i;
const NEITHER = /\b(neither|none|no(ne)? of (those|them|these)|don'?t work|doesn'?t work|won'?t work|can'?t (do|make) (either|those|them|any)|not (free|available) (then|those|either))\b/i;
const FIRST = /\b(the )?(first|1st|earlier|earliest)( one| time)?\b/i;
const SECOND = /\b(the )?(second|2nd|later|latter|other)( one| time)?\b/i;
const EITHER = /\b(either|both( work| are fine)?|any( of (them|those))?|whichever|anytime|any time)\b/i;
const NOT = /\b(can'?t|cannot|won'?t|don'?t|doesn'?t|not|no|nope|unable)\b/i;
const YES = /\b(yes|yeah|yep|yup|sure|ok|okay|perfect|great|works|that works|sounds good|see you then|deal|confirmed|let'?s do it)\b/i;

/**
 * Which offered time their message picks: 0 or 1, or null when it picks
 * neither, both, or nothing readable. A button's title ("Sat 11 am"), the
 * day alone ("Saturday works"), the time alone ("11 is good"), "the first
 * one", or "either" all read; "neither" and a plain "thanks" do not.
 */
export function readPick(text: string, offer: Pick<OfferedTimes, "at">, timeZone: string, now: Date): number | null {
  const t = text.trim();
  if (!t || t.length > 400 || offer.at.length === 0) return null;
  // "Can't do Thursday" names a day that was offered and is not a pick. A no beside a yes ("yes, no problem") is fine.
  if (NEITHER.test(t) || (NOT.test(t) && !YES.test(t))) return null;
  if (offer.at.length === 1) {
    const h = hits(t, offer.at[0], timeZone, now);
    return h.day || h.time || YES.test(t) ? 0 : null;
  }
  const scores = offer.at.map((iso) => {
    const h = hits(t, iso, timeZone, now);
    return (h.day ? 2 : 0) + (h.time ? 1 : 0);
  });
  const best = Math.max(...scores);
  if (best > 0) {
    const winners = scores.filter((s) => s === best).length;
    if (winners !== 1) return null;
    const i = scores.indexOf(best);
    const h = hits(t, offer.at[i], timeZone, now);
    // "Can we do 10 am Friday instead?" names Friday, which was offered, and 10 am, which was not: that is a new
    // ask, not a pick. The same for a time that was offered on a day that was not. Nothing is read; the normal reply
    // (and, if they are still asking to meet, a fresh offer) answers it.
    if (!h.time && NAMES_A_TIME.test(t)) return null;
    if (!h.day && NAMES_A_DAY.test(t)) return null;
    return i;
  }
  if (FIRST.test(t)) return 0;
  if (SECOND.test(t)) return 1;
  if (EITHER.test(t)) return 0;
  return null;
}

/**
 * Change or cancel in the chat (A-242, part 2): what a customer with a BOOKED
 * time says about it. Read only while a confirmed booking is coming up.
 */
const MOVE_WORDS =
  /\b(re-?schedule|move (it|the|our|my|that|this|to)|push (it|that|back|to)|different (time|day|date)|another (time|day|date|slot)|other (time|day|date)|change (it|that|the time|the day|the date|our time|my time|time|the appointment|the viewing|the call|the booking)|instead|postpone|rain ?check|bump|(later|earlier) (in the|that|this|next|on)|sooner|(can|could) (we|you|i|u) (do|make|meet|try|switch to)|switch (it|that|to))\b/i;
const CANCEL_WORDS =
  /\b(cancel(l?ing|l?ed)?|call (it|this|that) off|no longer (need|want)|don'?t need (it|this|that|the \w+)( any ?more)?|changed (my|our) mind|forget (it|about it)|never ?mind|scrap (it|that)|won'?t be (coming|able to come|there)|not (going to|gonna) (come|make it|be there)|have to pass|(let'?s|we'?ll) (skip|drop) (it|that))\b/i;
const CANT_MAKE =
  /\b((can'?t|cannot|won'?t|unable to|not able to|not going to|not gonna) (make|do|be there|come|attend)|(something|sth|smth) (came|has come|'?s come) up|conflict|clash|double[- ]booked|out of town|not (free|available) (then|that day|anymore|any more))\b/i;

/** Their words name a day or a time that isn't the booked one. */
function namesAnotherTime(text: string, booked: string, timeZone: string, now: Date): boolean {
  const h = hits(text, booked, timeZone, now);
  return (NAMES_A_DAY.test(text) && !h.day) || (NAMES_A_TIME.test(text) && !h.time);
}

/**
 * They want to move their booked time: they say so, or they can't make it
 * and don't cancel outright, or they cancel and name another day. The
 * answer is two new free times (the engine), never a cancel.
 */
export function asksToMove(text: string, booked: string, timeZone: string, now: Date): boolean {
  const t = text.trim();
  if (!t || t.length > 400) return false;
  if (MOVE_WORDS.test(t)) return true;
  if ((CANT_MAKE.test(t) || CANCEL_WORDS.test(t)) && namesAnotherTime(t, booked, timeZone, now)) return true;
  return CANT_MAKE.test(t) && !CANCEL_WORDS.test(t);
}

/**
 * They cancel their booked time without asking for another: the slot is
 * freed and the owner decides whether to offer one. A real no ("not
 * interested", "stop", "have an agent") is not this: the no safety net
 * (A-326) reads those, and the booking waits for the owner.
 */
export function asksToCancel(text: string, booked: string, timeZone: string, now: Date): boolean {
  const t = text.trim();
  if (!t || t.length > 400) return false;
  if (declineIn(t)) return false;
  if (MOVE_WORDS.test(t) || !CANCEL_WORDS.test(t)) return false;
  return !namesAnotherTime(t, booked, timeZone, now);
}

/** Lead.offeredTimes as stored, or null when it isn't an offer. */
export function readOfferedTimes(raw: unknown): OfferedTimes | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const at = Array.isArray(o.at) ? o.at.filter((x): x is string => typeof x === "string" && !Number.isNaN(Date.parse(x))) : [];
  const said = Array.isArray(o.said) ? o.said.filter((x): x is string => typeof x === "string") : [];
  if (at.length === 0 || said.length !== at.length) return null;
  return { at, said, ...(typeof o.offeredAt === "string" ? { offeredAt: o.offeredAt } : {}) };
}

type CardLead = {
  name: string;
  conversation: readonly Message[];
  pickedTime?: string | null;
  sellerHome?: string | null;
  upcomingBooking?: { id: string; at: string } | null;
  cancelledBooking?: { id: string; at: string } | null;
};

/**
 * The owner's card, in words: what and where, the day and time lines, the
 * black button's label. With a booked time still standing, the pick is a
 * move: `from` carries the old time's words and label.
 */
export function pickedCardWords(
  lead: CardLead,
  timeZone: string,
  now: Date
): { first: string; what: string; where: string | null; day: string; time: string; label: string; from: { said: string; label: string } | null } | null {
  if (!lead.pickedTime) return null;
  const what = whatFor(lead.conversation);
  const old = lead.upcomingBooking?.at ?? null;
  return {
    first: lead.name.trim().split(/\s+/)[0] || lead.name,
    what,
    where: what === "Home visit" ? (lead.sellerHome ?? null) : null,
    ...pickedLines(lead.pickedTime, timeZone, now),
    label: confirmLabel(lead.pickedTime, timeZone, now),
    from: old ? { said: sayTime(old, timeZone, now), label: confirmLabel(old, timeZone, now) } : null,
  };
}

/** The Booked card (A-242, part 2): a confirmed time still to come, with Change and Cancel for the owner. */
export function bookedCardWords(
  lead: CardLead,
  timeZone: string,
  now: Date
): { id: string; first: string; what: string; where: string | null; day: string; time: string; said: string; label: string } | null {
  const b = lead.upcomingBooking;
  if (!b || new Date(b.at).getTime() < now.getTime()) return null;
  const what = whatFor(lead.conversation);
  return {
    id: b.id,
    first: lead.name.trim().split(/\s+/)[0] || lead.name,
    what,
    where: what === "Home visit" ? (lead.sellerHome ?? null) : null,
    ...pickedLines(b.at, timeZone, now),
    said: sayTime(b.at, timeZone, now),
    label: confirmLabel(b.at, timeZone, now),
  };
}

/** The cancelled card (A-242, part 2): the customer cancelled their time; the owner offers another or lets it be. */
export function cancelledCardWords(lead: CardLead, timeZone: string, now: Date): { id: string; first: string; said: string } | null {
  const b = lead.cancelledBooking;
  if (!b) return null;
  return { id: b.id, first: lead.name.trim().split(/\s+/)[0] || lead.name, said: sayTime(b.at, timeZone, now) };
}

/** The grey line under a drafted reply that carries the offer, or null. */
export function offerLineFor(
  lead: { name: string; suggestedMessage?: string | null; offeredTimes?: { at: string[] } | null },
  timeZone: string,
  now: Date
): string | null {
  if (!lead.offeredTimes || !lead.suggestedMessage) return null;
  if (!carriesOffer(lead.suggestedMessage, lead.offeredTimes, timeZone, now)) return null;
  return offerReason(lead.name.trim().split(/\s+/)[0] || lead.name);
}
