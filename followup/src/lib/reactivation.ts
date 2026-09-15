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
import { DEAD_LEAD_DEFAULT_DAYS } from "@/lib/automation";
import { mapWithConcurrency } from "@/lib/concurrency";
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
  const quietDays = options.quietDays ?? DEAD_LEAD_DEFAULT_DAYS;
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
    const conversation: Message[] = lead.conversations.flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction as Message["direction"],
        channel: c.channel as Message["channel"],
        body: m.body,
        date: m.sentAt.toISOString(),
        opened: m.opened,
      }))
    );
    conversation.sort((a, b) => a.date.localeCompare(b.date));
    if (conversation.length === 0) return;

    try {
      const { outcome, reason } = await classifyThreadOutcome(
        conversation,
        business ? { name: business.name, industry: business.industry } : undefined
      );
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          quietOutcome: OUTCOME_TO_DB[outcome],
          quietOutcomeReason: reason,
          quietOutcomeAt: new Date(),
        },
      });
      classified += 1;
    } catch (err) {
      // A failed verdict must never look like a verdict. Leaving
      // quietOutcome null keeps the lead out of every bucket below — it is
      // not cold, not closed, not anything — and the next run retries it.
      // The alternative (defaulting to UNCLEAR on error) would quietly
      // turn an outage into a screen full of "we couldn't tell", which
      // reads to an owner like a judgment rather than a failure.
      console.error(`Failed to classify quiet lead ${lead.id}:`, err);
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

export type ReactivationBatch = {
  /** Judged dropped, and the only bucket a message may be drafted for. */
  cold: ReactivationLead[];
  /** Judged finished — shown as a count, left alone. */
  closed: ReactivationLead[];
  /** The conversation moved somewhere FollowUp can't see. Needs one human answer each. */
  offPlatform: ReactivationLead[];
  /** Judged, but not confidently. Shown, never messaged on its own. */
  unclear: ReactivationLead[];
  /** Eligible leads with no verdict yet — the "still counting" number. */
  unjudged: number;
};

const REACTIVATION_SELECT = {
  id: true,
  name: true,
  email: true,
  lastContacted: true,
  quietOutcomeReason: true,
} as const;

/**
 * The three-bucket view behind the batch consent screen.
 *
 * The buckets are shown together on purpose. An owner asked "send to 43
 * cold leads?" with no other context has no way to judge whether 43 is
 * right — but "43 cold · 112 look finished · 9 moved to a phone call"
 * shows them the whole catalogue and what was done with each part of it.
 * That is the difference between a permission request and a number.
 */
export async function getReactivationBatch(
  businessId: string,
  options: { quietDays?: number } = {}
): Promise<ReactivationBatch> {
  const quietDays = options.quietDays ?? DEAD_LEAD_DEFAULT_DAYS;
  const cutoff = new Date(Date.now() - quietDays * 24 * 60 * 60 * 1000);

  const base = {
    businessId,
    stage: { notIn: OWNER_CONCLUDED_STAGES },
    optedOutAt: null,
    lastContacted: { lte: cutoff },
  };

  const [cold, closed, offPlatform, unclear, unjudged] = await Promise.all([
    prisma.lead.findMany({
      where: { ...base, quietOutcome: "COLD" },
      select: REACTIVATION_SELECT,
      orderBy: { lastContacted: "asc" },
    }),
    prisma.lead.findMany({
      where: { ...base, quietOutcome: "CLOSED" },
      select: REACTIVATION_SELECT,
      orderBy: { lastContacted: "asc" },
    }),
    prisma.lead.findMany({
      where: { ...base, quietOutcome: "OFF_PLATFORM" },
      select: REACTIVATION_SELECT,
      orderBy: { lastContacted: "asc" },
    }),
    prisma.lead.findMany({
      where: { ...base, quietOutcome: "UNCLEAR" },
      select: REACTIVATION_SELECT,
      orderBy: { lastContacted: "asc" },
    }),
    prisma.lead.count({ where: { ...base, quietOutcome: null } }),
  ]);

  const shape = (rows: typeof cold): ReactivationLead[] =>
    rows.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      lastContacted: l.lastContacted,
      reason: l.quietOutcomeReason,
    }));

  return {
    cold: shape(cold),
    closed: shape(closed),
    offPlatform: shape(offPlatform),
    unclear: shape(unclear),
    unjudged,
  };
}
