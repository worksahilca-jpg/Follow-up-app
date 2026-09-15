/**
 * The back catalogue: leads that came in from a connected inbox, went
 * quiet, and have been sitting there ever since.
 *
 * Why this is a separate pass and not part of the sync
 * ---------------------------------------------------
 * Import (src/lib/integrations/gmail.ts, outlook.ts) answers exactly one
 * question per thread — "is this a sales conversation at all" — and lands
 * every survivor at stage NEW. It has never judged how a thread ENDED,
 * because until a quiet lead could be messaged, it didn't need to: a
 * closed deal sitting in a list is untidy, not harmful.
 *
 * Reactivation changes that. Asking "still interested?" of someone who
 * bought six weeks ago, or who politely said no, is worse than sending
 * nothing — it tells the recipient this business doesn't know who its own
 * customers are. So before any of it can be offered to an owner, someone
 * has to judge what happened. That someone is classifyThreadOutcome().
 *
 * It runs here rather than inside the sync for three reasons:
 *   1. Cost. One extra OpenAI call per imported thread would roughly
 *      double a first sync's bill, for a verdict most businesses will
 *      never look at.
 *   2. Latency. The post-connect sync is the slowest thing a new user
 *      sits through. This is not worth adding to it.
 *   3. Scope. Only quiet leads need a verdict at all, and "quiet" is a
 *      property of time, not of import — a lead can become eligible
 *      months after it was imported, with no sync involved.
 *
 * Nothing in this file sends anything. It only decides what a human is
 * allowed to be offered.
 */

import { prisma } from "@/lib/db";
import { classifyThreadOutcome, type ThreadOutcome } from "@/lib/integrations/openai";
import { DEAD_LEAD_DEFAULT_DAYS, DEAD_LEAD_ACTION } from "@/lib/automation";
import { mapWithConcurrency } from "@/lib/concurrency";
import { recordAudit } from "@/lib/audit";
import type { Message } from "@/lib/types";
import type { PipelineStage, QuietOutcome } from "@prisma/client";

/**
 * The two stages that mean the owner has already answered the question
 * this file exists to ask. Their own record beats anything an AI would
 * infer from the thread, so these are excluded from both the classify pass
 * and every bucket.
 */
const OWNER_CONCLUDED_STAGES: PipelineStage[] = ["WON", "LOST"];

/**
 * How many leads one call will pay OpenAI to judge. A realtor connecting a
 * five-year-old inbox can import several hundred quiet threads at once;
 * classifying all of them in one request would take minutes and cost real
 * money before the owner has decided they even want this. The batch screen
 * is built to say "43 of your 200 judged so far" rather than to block.
 */
const DEFAULT_CLASSIFY_LIMIT = 60;

/**
 * Concurrency, not parallelism-for-its-own-sake: the same value the
 * automation run uses. High enough that 60 classifications finish in
 * seconds, low enough not to trip OpenAI's per-minute limits on a Free
 * tier key.
 */
const CLASSIFY_CONCURRENCY = 4;

/**
 * How long a claim on an unjudged lead is honoured before another run may
 * take it. Long enough that a slow OpenAI call is never stolen mid-flight,
 * short enough that a lead orphaned by a crashed or frozen run comes back
 * the same hour instead of sitting unjudged forever.
 */
const CLAIM_STALE_MINUTES = 10;

/**
 * The claim condition, shared by the eligibility query and the atomic
 * claim itself so the two can never disagree about what "available" means.
 * quietOutcomeAt does double duty: a timestamp with no verdict beside it
 * is a claim in progress; a timestamp WITH a verdict is when that verdict
 * was reached.
 */
function unclaimedOr() {
  const stale = new Date(Date.now() - CLAIM_STALE_MINUTES * 60 * 1000);
  return { OR: [{ quietOutcomeAt: null }, { quietOutcomeAt: { lt: stale } }] };
}

/**
 * The silence threshold this business actually configured, not the
 * default. The dead-lead reactivation rule already owns this number
 * (src/lib/automation.ts) and an owner who moved it to 90 days meant it —
 * judging their leads at 45 would offer them a batch of people they don't
 * consider cold yet. Falls back to the shared default when no rule exists.
 */
async function resolveQuietDays(businessId: string): Promise<number> {
  const rule = await prisma.automation.findFirst({ where: { businessId, action: DEAD_LEAD_ACTION } });
  return rule?.triggerDays ?? DEAD_LEAD_DEFAULT_DAYS;
}

type LoadedConversations = { channel: string; messages: { id: string; direction: string; body: string; sentAt: Date; opened: boolean }[] }[];

/** Flattens a lead's channels into one chronological transcript. */
function toConversation(conversations: LoadedConversations): Message[] {
  return conversations
    .flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction as Message["direction"],
        channel: c.channel as Message["channel"],
        body: m.body,
        date: m.sentAt.toISOString(),
        opened: m.opened,
      }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

const OUTCOME_TO_DB: Record<ThreadOutcome, QuietOutcome> = {
  cold: "COLD",
  closed: "CLOSED",
  off_platform: "OFF_PLATFORM",
  unclear: "UNCLEAR",
};

export type ClassifyQuietLeadsResult = {
  /** How many leads got a verdict written in this run. */
  classified: number;
  /** How many were eligible but not reached because of the limit. */
  remaining: number;
  /** Leads whose classification threw. They keep quietOutcome null and are retried next run. */
  failed: number;
};

/**
 * Which leads are eligible for a verdict, and why each exclusion is there:
 *
 *   stage not WON/LOST — the owner has already told us how this ended.
 *     Their answer outranks anything an AI would infer from the text, and
 *     re-judging it would be both wasteful and faintly insulting.
 *   quietOutcome null — judged once. A verdict doesn't expire; if new
 *     messages arrive the lead stops being quiet anyway.
 *   optedOutAt null — someone who sent STOP is never a reactivation
 *     candidate, whatever the thread says. Cheaper to exclude here than to
 *     classify them and have the send path refuse later.
 *   lastContacted older than the threshold — the definition of quiet. A
 *     lead with no lastContacted at all has no conversation to judge.
 *   has at least one message — a manual-entry or CSV lead with an empty
 *     thread gives the classifier nothing to read.
 */
function eligibilityWhere(businessId: string, cutoff: Date) {
  return {
    businessId,
    stage: { notIn: OWNER_CONCLUDED_STAGES },
    quietOutcome: null,
    optedOutAt: null,
    lastContacted: { lte: cutoff },
    conversations: { some: { messages: { some: {} } } },
    // Skip leads another run is mid-way through judging right now. Without
    // this the atomic claim below still prevents the double OpenAI call,
    // but every overlapping run would fill its whole batch with leads it
    // then immediately skips — doing no work while reporting none left.
    ...unclaimedOr(),
  };
}

/**
 * Judges up to `limit` of this business's quiet leads and writes each
 * verdict to the lead.
 *
 * Deliberately idempotent and resumable: a verdict is written per lead as
 * it completes, so a timeout, a deploy, or a serverless function being
 * frozen mid-run leaves behind the work already done rather than losing
 * all of it. Calling it again picks up where it stopped.
 */
export async function classifyQuietLeads(
  businessId: string,
  options: { limit?: number; quietDays?: number } = {}
): Promise<ClassifyQuietLeadsResult> {
  const limit = options.limit ?? DEFAULT_CLASSIFY_LIMIT;
  const quietDays = options.quietDays ?? (await resolveQuietDays(businessId));
  const cutoff = new Date(Date.now() - quietDays * 24 * 60 * 60 * 1000);
  const where = eligibilityWhere(businessId, cutoff);

  const [candidates, eligibleTotal, business] = await Promise.all([
    prisma.lead.findMany({
      where,
      // Oldest first. If only some of a big back catalogue gets judged in
      // this run, the ones judged are the ones furthest gone — the leads
      // an owner is least likely to remember on their own, and so the ones
      // this is actually for.
      orderBy: { lastContacted: "asc" },
      take: limit,
      include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
    }),
    prisma.lead.count({ where }),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true, industry: true } }),
  ]);

  let classified = 0;
  let failed = 0;

  await mapWithConcurrency(candidates, CLASSIFY_CONCURRENCY, async (lead) => {
    const conversation = toConversation(lead.conversations);
    if (conversation.length === 0) return;

    // Claim the lead BEFORE paying for the verdict, with the same atomic
    // conditional update the rest of the codebase uses for exactly this
    // (see Lead.lastRapidEngagementNotifiedAt). Two runs overlapping — a
    // cron tick and an owner opening the batch screen — would otherwise
    // both read quietOutcome null, both call OpenAI for the same lead, and
    // bill twice for one answer. The claim writes the timestamp only;
    // quietOutcome stays null so a crash between here and the verdict
    // below leaves the lead re-judgeable rather than permanently blank.
    const claim = await prisma.lead.updateMany({
      where: { id: lead.id, quietOutcome: null, ...unclaimedOr() },
      data: { quietOutcomeAt: new Date() },
    });
    if (claim.count === 0) return; // someone else got there first

    const last = conversation[conversation.length - 1];
    const daysQuiet = Math.floor((Date.now() - new Date(last.date).getTime()) / (24 * 60 * 60 * 1000));

    try {
      const { outcome, reason } = await classifyThreadOutcome(conversation, {
        business: business ? { name: business.name, industry: business.industry } : undefined,
        daysQuiet,
        lastMessageFrom: last.direction === "inbound" ? "lead" : "business",
      });

      // Who dropped it is a fact, not a judgment: the last message's
      // direction says it exactly. The model is only ever asked whether
      // the thread was dropped at all — splitting COLD here rather than
      // adding a fifth thing for it to get wrong.
      const stored: QuietOutcome =
        outcome === "cold" && last.direction === "inbound" ? "COLD_UNANSWERED" : OUTCOME_TO_DB[outcome];

      await prisma.lead.update({
        where: { id: lead.id },
        data: { quietOutcome: stored, quietOutcomeReason: reason, quietOutcomeAt: new Date() },
      });
      classified += 1;

      // An AI decision that gates whether a real person gets messaged
      // belongs in the audit trail next to every other one. Without it,
      // "why did FollowUp write to a customer I'd already closed" has no
      // answer anywhere in the product — and that question is exactly the
      // one an owner asks at the worst possible moment.
      void recordAudit({ businessId }, "ai.quiet_outcome_classified", {
        targetType: "lead",
        targetId: lead.id,
        meta: { outcome: stored, reason, daysQuiet, lastMessageFrom: last.direction },
      });
    } catch (err) {
      // A failed verdict must never look like a verdict. Releasing the
      // claim (quietOutcomeAt back to null) keeps the lead out of every
      // bucket below — it is not cold, not closed, not anything — and the
      // next run retries it. The alternative (defaulting to UNCLEAR on
      // error) would quietly turn an outage into a screen full of "we
      // couldn't tell", which reads to an owner like a judgment about
      // their leads rather than a failure of ours.
      console.error(`Failed to classify quiet lead ${lead.id}:`, err);
      await prisma.lead
        .updateMany({ where: { id: lead.id, quietOutcome: null }, data: { quietOutcomeAt: null } })
        .catch(() => {});
      failed += 1;
    }
  });

  return { classified, remaining: Math.max(0, eligibleTotal - candidates.length), failed };
}

export type ReactivationLead = {
  id: string;
  name: string;
  email: string | null;
  lastContacted: Date | null;
  reason: string | null;
};

/** A bucket as the screen needs it: the true total, and enough rows to show. */
export type ReactivationBucket = {
  total: number;
  leads: ReactivationLead[];
};

export type ReactivationBatch = {
  /**
   * Judged dropped by the LEAD — they stopped replying to us. The only
   * bucket a "still interested?" message may be drafted for.
   */
  cold: ReactivationBucket;
  /**
   * Judged dropped by US — the lead's own message was the last thing in
   * the thread and nobody here ever answered it. Split out of `cold`
   * because the correct message is not the same message. "Just checking
   * in — still interested?" to someone whose question you ignored for two
   * months is not a follow-up, it's an insult; that person is owed an
   * apology and an actual answer. Computed from the thread, not guessed.
   */
  neverReplied: ReactivationBucket;
  /** Judged finished — shown as a count, left alone. */
  closed: ReactivationBucket;
  /** The conversation moved somewhere FollowUp can't see. Needs one human answer each. */
  offPlatform: ReactivationBucket;
  /** Judged, but not confidently. Shown, never messaged on its own. */
  unclear: ReactivationBucket;
  /** Eligible leads with no verdict yet — the "still counting" number. */
  unjudged: number;
};

/**
 * How many rows of each bucket come back. The screen shows a handful and a
 * count, never a wall of 200 cards — and an unbounded findMany on a
 * five-year inbox would load thousands of rows to render a number.
 */
const BUCKET_PREVIEW = 25;

const REACTIVATION_SELECT = {
  id: true,
  name: true,
  email: true,
  lastContacted: true,
  quietOutcomeReason: true,
} as const;

/**
 * The bucketed view behind the batch consent screen.
 *
 * The buckets are shown together on purpose. An owner asked "send to 43
 * cold leads?" with no other context has no way to judge whether 43 is
 * right — but "43 went cold · 9 you never replied to · 112 look finished ·
 * 6 moved to a phone call" shows them the whole catalogue and what was
 * done with each part of it. That is the difference between a permission
 * request and a number.
 */
export async function getReactivationBatch(
  businessId: string,
  options: { quietDays?: number } = {}
): Promise<ReactivationBatch> {
  const quietDays = options.quietDays ?? (await resolveQuietDays(businessId));
  const cutoff = new Date(Date.now() - quietDays * 24 * 60 * 60 * 1000);

  const base = {
    businessId,
    stage: { notIn: OWNER_CONCLUDED_STAGES },
    optedOutAt: null,
    lastContacted: { lte: cutoff },
  };

  // Every bucket is one indexed count plus a short preview. Nothing here
  // loads a whole back catalogue to render a number — a five-year inbox can
  // hold thousands of closed threads, and the screen shows a handful of
  // each and a total.
  const bucket = async (outcome: QuietOutcome): Promise<ReactivationBucket> => {
    const [total, leads] = await Promise.all([
      prisma.lead.count({ where: { ...base, quietOutcome: outcome } }),
      prisma.lead.findMany({
        where: { ...base, quietOutcome: outcome },
        select: REACTIVATION_SELECT,
        orderBy: { lastContacted: "asc" },
        take: BUCKET_PREVIEW,
      }),
    ]);
    return {
      total,
      leads: leads.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        lastContacted: l.lastContacted,
        reason: l.quietOutcomeReason,
      })),
    };
  };

  const [cold, neverReplied, closed, offPlatform, unclear, unjudged] = await Promise.all([
    bucket("COLD"),
    bucket("COLD_UNANSWERED"),
    bucket("CLOSED"),
    bucket("OFF_PLATFORM"),
    bucket("UNCLEAR"),
    prisma.lead.count({ where: { ...base, quietOutcome: null } }),
  ]);

  return { cold, neverReplied, closed, offPlatform, unclear, unjudged };
}
