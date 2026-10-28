/**
 * One practice reply a day on Today (A-330, founder 2026-10-27: "something that will help the business to train
 * FollowUp more accurately and every day").
 *
 * FollowUp learned only when real customers wrote: a quiet owner taught it nothing. On a quiet day the card shows one
 * made-up customer message for this kind of business and the reply FollowUp would write (the real reply writer,
 * src/lib/practiceReply.ts). "Looks right", or "Change it" and the owner's version is kept the way "Write it better"
 * keeps one (A-290, src/lib/ownerExamples.ts), so the next real reply reads it.
 *
 * It shares the daily question's slot and gate (A-101, src/lib/dailyQuestion.ts): one card a day, never in the first
 * hour after setup, a question first when FollowUp needs to know something. The page adds the rest: only when nobody
 * waits on the owner, admins only, never beside a setup card.
 *
 * The customers are made up and generic on purpose: no real person, no address that exists, no price. Nothing about
 * them is stored and nothing is sent.
 */
import { FIRST_QUESTION_AFTER_MS } from "@/lib/dailyQuestion";

export type PracticeMessage = { name: string; text: string };

const REAL_ESTATE: PracticeMessage[] = [
  { name: "Jordan", text: "Hi! Saw your listing on Maple Ave. Is it still available? Could I see it this weekend?" },
  { name: "Priya", text: "Just browsing for now. We're probably moving next spring. What's the market like right now?" },
  { name: "Mei", text: "We already have an agent, but we saw your open house post. Can we still come by?" },
  { name: "Daniel", text: "How much do you charge to sell a house?" },
  { name: "Sara", text: "What would my 3-bedroom townhouse sell for these days?" },
  { name: "Omar", text: "Not ready to buy for about 6 months. Should I talk to someone now or wait?" },
  { name: "Chris", text: "Is this a real person or a bot?" },
  { name: "Aisha", text: "Can you send me a few listings for a first home? Two bedrooms, close to the GO train." },
  { name: "Lucas", text: "We saw a house we love but we haven't talked to a bank yet. Is that a problem?" },
  { name: "Grace", text: "Thanks for the info last week. We've decided to wait a bit." },
];

const MORTGAGE: PracticeMessage[] = [
  { name: "Jordan", text: "What rate can I get right now?" },
  { name: "Priya", text: "I'm self-employed. Can I still get a mortgage?" },
  { name: "Daniel", text: "How much could I borrow? We make about $120k together." },
  { name: "Mei", text: "Our mortgage renews in 4 months. Is it too early to talk?" },
  { name: "Chris", text: "Is this a real person or a bot?" },
];

const HOME_SERVICES: PracticeMessage[] = [
  { name: "Jordan", text: "Can you give me a rough price to redo a small bathroom?" },
  { name: "Priya", text: "Do you work on weekends? I can't take time off work." },
  { name: "Daniel", text: "How soon could you start? We'd like it done before the holidays." },
  { name: "Mei", text: "I got a quote from someone else. Can you do better?" },
  { name: "Chris", text: "Is this a real person or a bot?" },
];

const CLINIC: PracticeMessage[] = [
  { name: "Jordan", text: "Are you taking new patients?" },
  { name: "Priya", text: "How much is a cleaning without insurance?" },
  { name: "Daniel", text: "I have a bad toothache. Can I come in today?" },
  { name: "Mei", text: "Do you have anything on Saturdays for my two kids?" },
  { name: "Chris", text: "Is this a real person or a bot?" },
];

const MARKETING: PracticeMessage[] = [
  { name: "Jordan", text: "How much for a website?" },
  { name: "Priya", text: "Can you get us more customers from Instagram?" },
  { name: "Daniel", text: "We tried an agency before and it didn't work. Why would you be different?" },
  { name: "Mei", text: "We're a small shop with a small budget. Is it even worth talking?" },
  { name: "Chris", text: "Is this a real person or a bot?" },
];

/** For a kind of business without its own list: what any customer asks. */
const GENERAL: PracticeMessage[] = [
  { name: "Jordan", text: "Hi, how much do you charge?" },
  { name: "Priya", text: "Do you have anything available this week?" },
  { name: "Daniel", text: "Just looking around for now, thanks." },
  { name: "Mei", text: "I got a quote from someone else. Can you do better?" },
  { name: "Chris", text: "Is this a real person or a bot?" },
];

/** Keyed like the trade playbooks (src/lib/tradePlaybooks.ts), lower case. */
const BY_TRADE: Record<string, PracticeMessage[]> = {
  "real estate": REAL_ESTATE,
  "mortgage brokerage": MORTGAGE,
  "home services (contractor, cleaning, etc.)": HOME_SERVICES,
  "dental / medical clinic": CLINIC,
  "marketing agency": MARKETING,
};

const norm = (t: string) => t.trim().toLowerCase().replace(/_/g, " ");

export function practiceMessages(trade: string | null | undefined): PracticeMessage[] {
  return (trade && BY_TRADE[norm(trade)]) || GENERAL;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A small, steady number per business, so two businesses don't see the same customer on the same day. */
function offsetFor(businessId: string): number {
  let n = 0;
  for (const ch of businessId) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return n;
}

/** Today's made-up customer: a different one each day, the whole list before any comes back. */
export function practiceFor(trade: string | null | undefined, businessId: string, now: Date = new Date()): PracticeMessage {
  const list = practiceMessages(trade);
  const day = Math.floor(now.getTime() / DAY_MS);
  return list[(day + offsetFor(businessId)) % list.length];
}

export type PracticeGate = { createdAt: Date; questionAfter: Date | null };

/** The daily question's gate (A-101): past the first hour after setup, and no card answered or set aside today. */
export function practiceDue(gate: PracticeGate, now: Date = new Date()): boolean {
  if (now.getTime() - gate.createdAt.getTime() < FIRST_QUESTION_AFTER_MS) return false;
  return !(gate.questionAfter && gate.questionAfter > now);
}
