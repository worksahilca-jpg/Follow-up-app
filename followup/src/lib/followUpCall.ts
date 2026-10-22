import { homeOf, isSeller, viewingOf, type Qualification, type Tier } from "@/lib/qualification";
import type { PlanCard } from "@/lib/planCard";
import { scoreLevel } from "@/lib/scoreThresholds";

/**
 * "FollowUp's call" (founder, 2026-10-22: "build this follow-up call … it should be totally automated … we are
 * judging if it is warm or cold. The business owner … will not come again and again … to select whether it is a warm
 * lead or a hot lead"). FollowUp's own judgement of where a customer stands, and the one next step, who takes it and
 * when. The owner is never asked to grade it: FollowUp sorts the customer again every time they write (and from the
 * owner's CRM call notes, A-303), and the step comes from the same plan the engine sends by (planCard.ts), so it can't
 * promise a message that won't go.
 *
 * Pure: the pages pass in what they already read.
 */

/** The word on a tag and on the card. */
export const TIER_WORD: Record<Tier, string> = { ready: "Ready", warm: "Warm", later: "Later", agent: "Has an agent" };

/**
 * Where a customer stands for a kind of business with no checklist of its own (everything but real estate today):
 * from the interest score FollowUp already gives every customer it has read (scoring.ts, with its written reason), so
 * no extra AI runs. High is Ready, medium Warm, low Later; nothing until FollowUp has read them.
 */
export function tierFromScore(score: number, reviewed: boolean): Tier | null {
  if (!reviewed || score <= 0) return null;
  const level = scoreLevel(score);
  return level === "high" ? "ready" : level === "medium" ? "warm" : "later";
}

export type ReadyFacts = {
  first: string;
  /** A kind of business with no checklist: FollowUp knows they're keen, not what they want to see or sell. */
  general?: boolean;
  /** Whole days since FollowUp found them Ready, when known: said when it's a day or more. */
  daysReady?: number | null;
  seller: boolean;
  /** A seller's home, "18 Birch Cres", when known. */
  home: string | null;
  /** They asked to see the home (or a seller, to have it seen). */
  viewing: boolean;
  /** The viewing or home visit is booked through the booking link. */
  booked: boolean;
  /** There is a number to call. */
  canCall: boolean;
};

export function readyFacts(q: Qualification, first: string, canCall: boolean): ReadyFacts {
  const seller = isSeller(q);
  return {
    first,
    seller,
    home: homeOf(q),
    viewing: viewingOf(q) !== null,
    booked: q.items.some((i) => (i.key === "viewing" || i.key === "visit") && i.source === "booking"),
    canCall,
  };
}

/**
 * The owner's next step for a Ready customer, starting lower-case so it can follow "Next:" or "Send this, then".
 * A Ready customer is the owner's: a person who wants to see a home (or sell one) hears from a person, the same day.
 */
export function readyNext(r: ReadyFacts): string {
  const step = readyStep(r);
  // An old Ready call still says "today", and how long they have waited, so the day doesn't read as news.
  const d = r.daysReady ?? 0;
  return !r.booked && d >= 1 ? `${step} ${r.first} has been ready for ${d} ${d === 1 ? "day" : "days"}.` : step;
}

function readyStep(r: ReadyFacts): string {
  const { first } = r;
  if (r.general) return r.canCall ? `call ${first} today.` : `reply to ${first} today.`;
  if (r.booked) return r.seller ? "the home visit is booked. Nothing to do before it." : "the showing is booked. Nothing to do before it.";
  if (r.seller) {
    const home = r.home ?? "the home";
    return r.canCall ? `call ${first} today to book a visit to ${home}.` : `reply to ${first} with a time to visit ${home}.`;
  }
  if (r.viewing) return r.canCall ? `call ${first} today to set up the showing.` : `reply to ${first} with a time for the showing.`;
  return r.canCall ? `call ${first} today. ${first} is ready to start viewing.` : `offer ${first} a time to see homes.`;
}

/**
 * What happens after the reply on Today for a customer FollowUp keeps in touch with (Warm or Later), from the plan the
 * engine sends by. Null when there is nothing honest to add.
 */
export function afterReply(plan: Pick<PlanCard, "title" | "sentence" | "status" | "staying" | "waitingFor"> | null, first: string, holdAll: boolean): string | null {
  if (!plan) return null;
  // Nothing can go out on its own: the plan's own sentence says why, with the fix.
  if (plan.status === "paused") return plan.sentence;
  const yours = holdAll ? " Each one waits for your OK." : " Nothing more for you to do.";
  if (plan.staying) return `Then FollowUp keeps in touch with ${first} when you have something new.${yours}`;
  if (plan.waitingFor) return `Then FollowUp waits until ${plan.waitingFor}, as ${first} asked, and follows up from there.${yours}`;
  if (/^On (the|your)/.test(plan.title)) return `Then FollowUp follows up ${plan.title.replace(/^On/, "on")}.${yours}`;
  // A special plan (a workflow) runs instead: its sentence names it.
  return plan.sentence;
}

/** Today's one line under the open person: what to do with the reply that waits, and what comes after it. */
export function todayCall(
  tier: Tier,
  p: { first: string; ready: ReadyFacts | null; plan: Parameters<typeof afterReply>[0]; holdAll: boolean }
): string | null {
  if (tier === "ready" && p.ready) return `Send this, then ${readyNext(p.ready)}`;
  if (tier === "agent") return `${p.first} already has an agent. After this, FollowUp stops following up.`;
  if (tier === "warm" || tier === "later") {
    const after = afterReply(p.plan, p.first, p.holdAll);
    return after ? `Send this. ${after}` : null;
  }
  return null;
}

/** What FollowUp's calls came to over a window (Results, A-310): how many it sorted into each, and how many it called
 * Ready went on to book or buy. Counted from the record alone: nobody grades anything. */
export type CallTally = { sorted: number; ready: number; warm: number; later: number; agent: number; readyBooked: number };

/** Below this many sorted customers the numbers say little, so Results doesn't show them yet. */
export const CALLS_SHOWN_FROM = 5;

export function tallyCalls(customers: readonly { tier: Tier | null; booked: boolean; won: boolean }[]): CallTally {
  const t: CallTally = { sorted: 0, ready: 0, warm: 0, later: 0, agent: 0, readyBooked: 0 };
  for (const c of customers) {
    if (!c.tier) continue;
    t.sorted++;
    t[c.tier]++;
    if (c.tier === "ready" && (c.booked || c.won)) t.readyBooked++;
  }
  return t;
}

/** The one sentence under the counts: what came of the Ready calls. */
export function readyOutcome(t: CallTally): string {
  if (t.ready === 0) return "Nobody was Ready yet. FollowUp tells you the moment someone is.";
  if (t.ready === 1) return t.readyBooked ? "Your Ready customer booked a time with you." : "Your Ready customer hasn't booked yet. Call them today.";
  if (t.readyBooked === 0) return `Your ${t.ready} Ready customers haven't booked yet. Call them today.`;
  return `${t.readyBooked} of your ${t.ready} Ready customers booked a time with you.`;
}
