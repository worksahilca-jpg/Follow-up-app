/**
 * The booking link in a reply (A-263, 2026-10-15): when FollowUp has offered
 * a viewing, a visit, a call or a meeting and the customer says yes, the
 * next reply carries the customer's own booking page (/book/<leadId>), so
 * they pick a time from the owner's free hours instead of the thread going
 * "what day suits you?" / "how about Saturday?" for three more messages.
 * The reply still waits for the owner's Send (src/lib/automation.ts holds a
 * draft that carries the link, with BOOKING_LINK_REASON).
 *
 * Pure: reads the thread, says nothing about where the link comes from.
 */
import type { Message } from "@/lib/types";

/** Our last message offered to meet: a viewing, a visit, a call, a tour, a time. Only as a question. */
const OFFERED =
  /\b(see (it|the (home|house|place|property|unit|condo|listing))|view(ing)?|visit|tour|walk[- ]?through|come (by|over|see)|show (you|it)|meet( up)?|a (call|chat)|hop on a call|have a look|take a look|find a time|set up a time|pick a time)\b/i;

/** Their reply is a yes, not a no. Short and plain, the way people answer "would you like to see it?". */
const YES = /\b(yes|yeah|yep|yup|sure|love to|would love|i'?d like|we'?d like|sounds (good|great|perfect)|that works|works for (me|us)|let'?s do (it|that)|please do|absolutely|definitely|for sure|ok(ay)?|count (me|us) in|happy to|keen|interested)\b/i;
const NO = /\b(no|not (yet|now|really|interested|at the moment)|can'?t|cannot|don'?t|won'?t|maybe later|not sure|rather not|hold off|pass)\b/i;

function isAck(m: Message): boolean {
  return m.direction === "outbound" && (m.trigger === "instant_ack" || m.trigger === "instant_ack_dm");
}

/**
 * They said yes to meeting: our last real message asked whether they'd like
 * to see, visit, tour, call or meet, and their newest message is a yes
 * without a no in it. A time or day they name alongside ("weekends are
 * easier") is still a yes; the booking page is where it becomes a time.
 */
export function saidYesToMeeting(conversation: readonly Message[]): boolean {
  const newest = conversation[conversation.length - 1];
  if (!newest || newest.direction !== "inbound") return false;
  const ours = [...conversation].reverse().find((m) => m.direction === "outbound" && !isAck(m));
  if (!ours || !OFFERED.test(ours.body) || !/\?/.test(ours.body)) return false;
  const text = newest.body.trim();
  if (text.length > 400) return false;
  return YES.test(text) && !NO.test(text);
}

/** Does this draft carry this customer's booking page? */
export function carriesBookingLink(text: string, leadId: string): boolean {
  return text.includes(`/book/${leadId}`);
}

/** The hold's reason, as the card says it: information, not a check, so the card shows it without the dot. */
export function bookingLinkReason(first: string): string {
  return `FollowUp added your booking link because ${first} said yes to meeting. ${first} picks a time from your free hours`;
}

export function isBookingLinkReason(reason: string | null | undefined): boolean {
  return /^FollowUp added your booking link because /.test(reason ?? "");
}

/**
 * The paragraph the reply writer gets when they said yes. One job for this
 * reply: the link, plainly, and no new question beside it.
 */
export function bookingLinkPromptBlock(link: string | null | undefined): string {
  if (!link) return "";
  return (
    "\n\nTHEY SAID YES TO MEETING. Your reply's one job is to let them pick a time. Include this exact link once, " +
    `unchanged, as the place where they choose a time from this business's free hours: ${link} . Say they can pick ` +
    "any time that suits them there and you will confirm it, and that if the day they want isn't there, they can " +
    "tell you the day. Never name or suggest a day or time yourself, never say anything is booked or confirmed, " +
    "and ask no other question in this reply. Keep it to two or three short sentences."
  );
}
