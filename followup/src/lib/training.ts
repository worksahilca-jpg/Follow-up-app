import { prisma } from "@/lib/db";
import type { OwnerExampleLine } from "@/lib/ownerExampleLines";
import {
  guessAgent,
  parseConversation,
  toExamples,
  toTurns,
  type TrainingChannel,
  type TrainingTurn,
} from "@/lib/trainingParse";

/**
 * "Train FollowUp" (A-292, founder 2026-10-18: "I'll be asking Realtor and other owner to share their conversations
 * with me … make something that we can train. Not just I have to send screenshots every time"). The founder pastes a
 * real conversation on /admin/train; each good agent reply becomes an example; every real estate business's drafts
 * read the newest few, after the owner's own "Write it better" examples (A-290), which always come first.
 *
 * The scorecard replays each example's moment through the real reply writer and the founder says which answer is
 * better. An example where FollowUp's answer was better stops being used: it is not a good example.
 *
 * Only scrubbed text is stored (src/lib/trainingParse.ts). The callers are founder-only.
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
  input: { channel: TrainingChannel; raw: string; agent: string },
  addedById: string | null
): Promise<{ id: string; examples: number }> {
  const { speakers, lines } = parseConversation(input.raw);
  if (!speakers.includes(input.agent)) throw new Error("agent-not-found");
  const turns = toTurns(lines, input.agent);
  const examples = toExamples(turns);
  if (examples.length === 0) throw new Error("no-examples");
  const row = await prisma.trainingConversation.create({
    data: {
      channel: input.channel,
      addedById,
      turnCount: turns.length,
      examples: {
        create: examples.map((e) => ({ channel: input.channel, context: e.context, customerSaid: e.customerSaid, reply: e.reply })),
      },
    },
    select: { id: true },
  });
  return { id: row.id, examples: examples.length };
}

export async function deleteConversation(id: string): Promise<boolean> {
  const { count } = await prisma.trainingConversation.deleteMany({ where: { id } });
  return count > 0;
}

export type TrainingSummary = {
  conversations: number;
  examples: number;
  scored: Record<Verdict, number>;
};

export async function getTrainingSummary(): Promise<TrainingSummary> {
  const [conversations, examples, groups] = await Promise.all([
    prisma.trainingConversation.count(),
    prisma.trainingExample.count(),
    prisma.trainingExample.groupBy({ by: ["verdict"], _count: { _all: true } }),
  ]);
  const scored: Record<Verdict, number> = { followup: 0, same: 0, agent: 0 };
  for (const g of groups) if (g.verdict && (VERDICTS as readonly string[]).includes(g.verdict)) scored[g.verdict as Verdict] = g._count._all;
  return { conversations, examples, scored };
}

export type ExampleToScore = {
  id: string;
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

/** The oldest example not judged yet. */
export async function nextToScore(): Promise<ExampleToScore | null> {
  const row = await prisma.trainingExample.findFirst({
    where: { verdict: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, channel: true, context: true, customerSaid: true, reply: true, followUpReply: true },
  });
  return row ? { ...row, channel: row.channel as TrainingChannel, context: readContext(row.context) } : null;
}

export async function getExample(id: string): Promise<ExampleToScore | null> {
  const row = await prisma.trainingExample.findUnique({
    where: { id },
    select: { id: true, channel: true, context: true, customerSaid: true, reply: true, followUpReply: true },
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

export type ExampleRow = { id: string; conversationId: string; channel: string; customerSaid: string; reply: string; verdict: string | null };

export async function listExamples(take = 50): Promise<ExampleRow[]> {
  return prisma.trainingExample.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, conversationId: true, channel: true, customerSaid: true, reply: true, verdict: true },
  });
}

/**
 * The newest examples a draft can learn from: never one where FollowUp's own answer was judged better, and never the
 * one being scored (it would be answering with the answer in front of it). Never throws.
 */
export async function getTrainingExamples(take: number, excludeId?: string): Promise<OwnerExampleLine[]> {
  if (take <= 0) return [];
  try {
    const rows = await prisma.trainingExample.findMany({
      where: {
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
