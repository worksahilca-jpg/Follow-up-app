import { prisma } from "@/lib/db";
import type { OwnerExampleLine } from "@/lib/ownerExampleLines";
import { MAX_EXAMPLE_TEXT } from "@/lib/ownerExampleLines";
import {
  guessAgent,
  parseConversation,
  scrub,
  toExamples,
  toTurns,
  type TrainingChannel,
  type TrainingTurn,
} from "@/lib/trainingParse";
import { LIVE_STATUS, WAITING_STATUS, lessonStatusWhere, recordLearningEvent } from "@/lib/learning";

/**
 * "Train FollowUp" (A-292, founder 2026-10-18: "I'll be asking Realtor and other owner to share their conversations
 * with me … make something that we can train. Not just I have to send screenshots every time"). The founder pastes a
 * real conversation on /admin/train and says what kind of business it came from; each good reply from the business
 * becomes an example; the drafts of every business of that same kind read the newest few, after the owner's own
 * "Write it better" examples (A-290), which always come first. Founder, same day: "we will be training different
 * businesses with different replies and different strategies": a realtor's examples never reach a clinic.
 *
 * The scorecard replays each example's moment through the real reply writer, as that kind of business, and the
 * founder says which answer is better. An example where FollowUp's answer was better stops being used.
 *
 * Only scrubbed text is stored (src/lib/trainingParse.ts). The callers are founder-only.
 *
 * Milestone 1 (2026-10-22): an example has a status (src/lib/learning.ts) and only an ACTIVE one reaches a draft.
 * Undo rolls it back instead of deleting it, so it can be put back; every change is kept in its history. A pasted
 * conversation keeps when its "I have permission" box was ticked, and by whom. Removing a whole conversation still
 * deletes it and every example from it, for good: that is the founder's way to take a shared conversation out.
 *
 * A-319 (2026-10-23): a new example, pasted or taught on Talk to it, waits (TESTING) until a test and the founder's "Put
 * them to work" make it ACTIVE (src/lib/lessonReview.ts). Only the practice chat and the test read it before then.
 */

export type Verdict = "followup" | "same" | "agent";
export const VERDICTS: readonly Verdict[] = ["followup", "same", "agent"];

/** Training examples a draft can use, after the owner's own. */
export const TRAINING_IN_PROMPT = 3;

export type ReadResult = {
  speakers: string[];
  agent: string | null;
  turns: TrainingTurn[];
  examples: number;
};

/** What "Read it" shows: the scrubbed turns and how many examples they make. Nothing is saved. */
export function readConversation(raw: string, agent?: string | null): ReadResult {
  const { speakers, lines } = parseConversation(raw);
  const chosen = agent && speakers.includes(agent) ? agent : guessAgent(lines);
  if (!chosen) return { speakers, agent: null, turns: [], examples: 0 };
  const turns = toTurns(lines, chosen);
  return { speakers, agent: chosen, turns, examples: toExamples(turns).length };
}

/** Saves the scrubbed conversation and its examples. Reads the paste again here: the browser's copy is never trusted. */
export async function saveConversation(
  input: { trade: string; channel: TrainingChannel; raw: string; agent: string },
  addedById: string | null
): Promise<{ id: string; examples: number }> {
  const { speakers, lines } = parseConversation(input.raw);
  if (!speakers.includes(input.agent)) throw new Error("agent-not-found");
  const turns = toTurns(lines, input.agent);
  const examples = toExamples(turns);
  if (examples.length === 0) throw new Error("no-examples");
  const now = new Date();
  const row = await prisma.trainingConversation.create({
    data: {
      trade: input.trade,
      channel: input.channel,
      addedById,
      turnCount: turns.length,
      // The route only saves with the permission box ticked (POST /api/admin/train, "save"); this keeps that answer.
      source: "pasted",
      consentConfirmedAt: now,
      consentById: addedById,
      examples: {
        create: examples.map((e) => ({
          trade: input.trade,
          channel: input.channel,
          context: e.context,
          customerSaid: e.customerSaid,
          reply: e.reply,
          status: WAITING_STATUS,
        })),
      },
    },
    select: { id: true },
  });
  await recordLearningEvent({
    trade: input.trade,
    kind: "training_conversation",
    targetId: row.id,
    action: "created",
    toStatus: WAITING_STATUS,
    after: { source: "pasted", examples: examples.length, permissionConfirmed: true },
    byUserId: addedById,
    note: "A pasted conversation, saved with the permission box ticked; its examples wait for a test and the founder's OK (A-319).",
  });
  return { id: row.id, examples: examples.length };
}

/** Takes a conversation out for good, with every example from it. Only the fact that it happened is kept, no words. */
export async function deleteConversation(id: string, byUserId: string | null = null): Promise<boolean> {
  const found = await prisma.trainingConversation.findUnique({ where: { id }, select: { trade: true, _count: { select: { examples: true } } } });
  const { count } = await prisma.trainingConversation.deleteMany({ where: { id } });
  if (count > 0) {
    await recordLearningEvent({
      trade: found?.trade ?? null,
      kind: "training_conversation",
      targetId: id,
      action: "removed",
      after: { examples: found?._count.examples ?? null },
      byUserId,
      note: "Removed with every example taken from it.",
    });
  }
  return count > 0;
}

export type TrainingSummary = {
  conversations: number;
  examples: number;
  scored: Record<Verdict, number>;
};

export async function getTrainingSummary(): Promise<TrainingSummary> {
  const [conversations, examples, groups] = await Promise.all([
    // Only conversations with an example in use: one still waiting for the founder's OK (A-319) isn't teaching yet.
    prisma.trainingConversation.count({ where: { examples: { some: { status: LIVE_STATUS } } } }),
    prisma.trainingExample.count({ where: { status: LIVE_STATUS } }),
    prisma.trainingExample.groupBy({ by: ["verdict"], where: { status: LIVE_STATUS }, _count: { _all: true } }),
  ]);
  const scored: Record<Verdict, number> = { followup: 0, same: 0, agent: 0 };
  for (const g of groups) if (g.verdict && (VERDICTS as readonly string[]).includes(g.verdict)) scored[g.verdict as Verdict] = g._count._all;
  return { conversations, examples, scored };
}

export type ExampleToScore = {
  id: string;
  trade: string;
  channel: TrainingChannel;
  context: TrainingTurn[];
  customerSaid: string;
  reply: string;
  followUpReply: string | null;
};

function readContext(v: unknown): TrainingTurn[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((t) =>
    t && typeof t === "object" && (t.from === "customer" || t.from === "agent") && typeof t.text === "string" ? [{ from: t.from, text: t.text }] : []
  );
}

/** The oldest example in use not judged yet. */
export async function nextToScore(): Promise<ExampleToScore | null> {
  const row = await prisma.trainingExample.findFirst({
    where: { verdict: null, status: LIVE_STATUS },
    orderBy: { createdAt: "asc" },
    select: { id: true, trade: true, channel: true, context: true, customerSaid: true, reply: true, followUpReply: true },
  });
  return row ? { ...row, channel: row.channel as TrainingChannel, context: readContext(row.context) } : null;
}

export async function getExample(id: string): Promise<ExampleToScore | null> {
  const row = await prisma.trainingExample.findUnique({
    where: { id },
    select: { id: true, trade: true, channel: true, context: true, customerSaid: true, reply: true, followUpReply: true },
  });
  return row ? { ...row, channel: row.channel as TrainingChannel, context: readContext(row.context) } : null;
}

export async function saveFollowUpReply(id: string, followUpReply: string): Promise<void> {
  await prisma.trainingExample.updateMany({ where: { id }, data: { followUpReply } });
}

export async function setVerdict(id: string, verdict: Verdict): Promise<boolean> {
  const { count } = await prisma.trainingExample.updateMany({ where: { id }, data: { verdict, scoredAt: new Date() } });
  return count > 0;
}

/** "Run again": every verdict cleared, so each moment is replayed with today's rules. */
export async function clearVerdicts(): Promise<number> {
  const { count } = await prisma.trainingExample.updateMany({ data: { verdict: null, scoredAt: null, followUpReply: null } });
  return count;
}

export type ExampleRow = { id: string; conversationId: string; trade: string; channel: string; customerSaid: string; reply: string; verdict: string | null };

export async function listExamples(take = 50): Promise<ExampleRow[]> {
  return prisma.trainingExample.findMany({
    where: { status: LIVE_STATUS },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, conversationId: true, trade: true, channel: true, customerSaid: true, reply: true, verdict: true },
  });
}

/**
 * The newest examples a draft can learn from, from this kind of business only: never one where FollowUp's own answer
 * was judged better, and never the one being scored (it would be answering with the answer in front of it). Active
 * ones, and the waiting ones too inside the practice chat or the test (withWaitingLessons). Never throws.
 */
export async function getTrainingExamples(trade: string | null, take: number, excludeId?: string): Promise<OwnerExampleLine[]> {
  if (!trade || take <= 0) return [];
  try {
    const rows = await prisma.trainingExample.findMany({
      where: {
        trade,
        status: lessonStatusWhere(trade),
        OR: [{ verdict: null }, { verdict: { not: "followup" } }],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: { customerSaid: true, reply: true },
    });
    return rows ?? [];
  } catch {
    return [];
  }
}

/**
 * "Talk to it" (A-294): the founder plays the customer and keeps FollowUp's answer ("Good") or writes what it should
 * have said. Either way the moment becomes an example for that kind of business, already judged: a kept answer counts
 * as "Same", a taught one as "Business better", with FollowUp's own answer kept beside it for the scorecard. One
 * conversation row per chat, created with its first example. Emails, phone numbers, addresses and links are taken out;
 * the founder is making the customer up, so there are no speakers' names to look for.
 */
export async function saveTalkExample(
  input: {
    conversationId?: string | null;
    trade: string;
    channel: TrainingChannel;
    context: TrainingTurn[];
    customerSaid: string;
    followUpReply: string;
    taught: string | null;
  },
  addedById: string | null
): Promise<{ id: string; conversationId: string }> {
  const clean = (t: string) => scrub(t, [], "").trim().slice(0, MAX_EXAMPLE_TEXT);
  let conversationId = input.conversationId ?? null;
  if (conversationId) {
    const found = await prisma.trainingConversation.findUnique({ where: { id: conversationId }, select: { trade: true } });
    if (!found || found.trade !== input.trade) conversationId = null;
  }
  if (!conversationId) {
    const row = await prisma.trainingConversation.create({
      // Made up by the founder playing the customer: nobody's conversation, so no permission to keep.
      data: { trade: input.trade, channel: input.channel, addedById, turnCount: input.context.length + 2, source: "practice" },
      select: { id: true },
    });
    conversationId = row.id;
  }
  const followUpReply = clean(input.followUpReply);
  const example = await prisma.trainingExample.create({
    data: {
      conversationId,
      trade: input.trade,
      channel: input.channel,
      context: input.context.map((t) => ({ from: t.from, text: clean(t.text) })),
      customerSaid: clean(input.customerSaid),
      reply: input.taught ? clean(input.taught) : followUpReply,
      followUpReply,
      verdict: input.taught ? "agent" : "same",
      scoredAt: new Date(),
      status: WAITING_STATUS,
    },
    select: { id: true },
  });
  await recordLearningEvent({
    trade: input.trade,
    kind: "training_example",
    targetId: example.id,
    action: "created",
    toStatus: WAITING_STATUS,
    after: { customerSaid: clean(input.customerSaid), reply: input.taught ? clean(input.taught) : followUpReply, kept: input.taught ? "taught" : "good" },
    byUserId: addedById,
    note: "Kept on Talk to it; waits for a test and the founder's OK (A-319).",
  });
  return { id: example.id, conversationId };
}

/**
 * Undo one taught or kept moment. One in use stops reaching drafts at once and is kept so it can be put back; one still
 * waiting for the founder's OK is dropped (REJECTED) and never goes in use. Either way it stays in the history.
 */
export async function rollBackExample(id: string, byUserId: string | null = null): Promise<boolean> {
  const found = await prisma.trainingExample.findFirst({ where: { id, status: { in: [LIVE_STATUS, WAITING_STATUS] } }, select: { trade: true, status: true } });
  if (!found) return false;
  const waiting = found.status === WAITING_STATUS;
  const to = waiting ? "REJECTED" : "ROLLED_BACK";
  const { count } = await prisma.trainingExample.updateMany({ where: { id, status: found.status }, data: { status: to, endedAt: new Date() } });
  if (count === 0) return false;
  await recordLearningEvent({
    trade: found.trade,
    kind: "training_example",
    targetId: id,
    action: waiting ? "removed" : "rolled_back",
    fromStatus: waiting ? WAITING_STATUS : LIVE_STATUS,
    toStatus: to,
    byUserId,
    ...(waiting ? { note: "Dropped by the founder before it went in use (A-319)." } : {}),
  });
  return true;
}

/** Put back an example that was undone. */
export async function restoreExample(id: string, byUserId: string | null = null): Promise<boolean> {
  const found = await prisma.trainingExample.findFirst({ where: { id, status: "ROLLED_BACK" }, select: { trade: true } });
  if (!found) return false;
  const { count } = await prisma.trainingExample.updateMany({ where: { id, status: "ROLLED_BACK" }, data: { status: LIVE_STATUS, endedAt: null } });
  if (count === 0) return false;
  await recordLearningEvent({ trade: found.trade, kind: "training_example", targetId: id, action: "restored", fromStatus: "ROLLED_BACK", toStatus: LIVE_STATUS, byUserId });
  return true;
}

/** Good examples a kind of business needs before it gets a model of its own (founder, 2026-10-18). */
export const OWN_MODEL_AT = 500;

/**
 * How close each kind of business is to its own model: its good examples, the ones a draft can use (never one where
 * FollowUp's own answer was judged better).
 */
export async function goodExamplesByTrade(): Promise<Record<string, number>> {
  const groups = await prisma.trainingExample.groupBy({
    by: ["trade"],
    where: { status: LIVE_STATUS, OR: [{ verdict: null }, { verdict: { not: "followup" } }] },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of groups) out[g.trade] = g._count._all;
  return out;
}
