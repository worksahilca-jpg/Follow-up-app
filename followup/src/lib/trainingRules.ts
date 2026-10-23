import { prisma } from "@/lib/db";
import { MAX_RULE_NOTE, MAX_RULE_TEXT, RULES_IN_PROMPT } from "@/lib/trainingRuleLines";
import { scrub } from "@/lib/trainingParse";
import { LIVE_STATUS, WAITING_STATUS, learningEventWrite, lessonStatusWhere, recordLearningEvent } from "@/lib/learning";

/**
 * "Tell FollowUp what's wrong" (A-297, founder 2026-10-19: "deploy an agent whom I can talk to and help that model to
 * improve … I can't paste everything here and then send you screenshots"). On Train → Talk to it the founder says, in
 * their own words, what's wrong with an answer. FollowUp turns that into one rule for that kind of business
 * (writeCoachRule in src/lib/integrations/openai.ts), keeps it here, and every draft and first reply for that kind
 * reads the newest few (rulesPromptBlock). Nothing is forgotten: the rules live in the database, not in anyone's
 * memory. The founder can change the wording or undo one.
 *
 * Milestone 1 (2026-10-22): a rule has a status and a version, and every change is kept in its history
 * (src/lib/learning.ts). Only an ACTIVE rule reaches a reply. "Change the wording" keeps the old words in the history
 * and can be reverted; "Undo" rolls the rule back instead of deleting it, so it can be put back.
 *
 * A-319 (2026-10-23): a new rule waits (TESTING) until a test and the founder's "Put them to work" make it ACTIVE
 * (src/lib/lessonReview.ts); only the practice chat and the test read it before then. New wording for a rule in use
 * waits the same way, as a new rule that replaces the old one when it is put to work; the old words stay in use until
 * then.
 *
 * Emails, phone numbers, addresses and links are taken out of both the rule and the founder's words before they are
 * kept. The callers are founder-only.
 */

export type TrainingRuleRow = { id: string; trade: string; text: string; createdAt: Date; approvedAt: Date | null };

const clean = (t: string, max: number) => scrub(t, [], "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * The newest active rules for this kind of business, for a reply's instructions, and the waiting ones too inside the
 * practice chat or the test (withWaitingLessons). Never throws: a draft never stops over them.
 */
export async function getTrainingRules(trade: string | null | undefined): Promise<string[]> {
  if (!trade) return [];
  try {
    const rows = await prisma.trainingRule.findMany({
      where: { trade, status: lessonStatusWhere(trade) },
      orderBy: { createdAt: "desc" },
      take: RULES_IN_PROMPT,
      select: { text: true },
    });
    return (rows ?? []).map((r) => r.text);
  } catch {
    return [];
  }
}

/** Every active rule, newest first, for the list on Talk to it. */
export async function listTrainingRules(): Promise<TrainingRuleRow[]> {
  return prisma.trainingRule.findMany({
    where: { status: LIVE_STATUS },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, trade: true, text: true, createdAt: true, approvedAt: true },
  });
}

/**
 * A new rule. It waits for a test and the founder's OK (A-319): the founder's practice chat uses it at once, real
 * replies only once it is put to work. `replacesId` is a rule in use that this new wording takes over from.
 */
export async function saveTrainingRule(
  input: { trade: string; text: string; note: string; replacesId?: string | null },
  addedById: string | null
): Promise<{ id: string; text: string }> {
  const row = await prisma.trainingRule.create({
    data: {
      trade: input.trade,
      text: clean(input.text, MAX_RULE_TEXT),
      note: clean(input.note, MAX_RULE_NOTE),
      addedById,
      status: WAITING_STATUS,
      version: 1,
      replacesId: input.replacesId ?? null,
    },
    select: { id: true, text: true },
  });
  await recordLearningEvent({
    trade: input.trade,
    kind: "training_rule",
    targetId: row.id,
    action: "created",
    toStatus: WAITING_STATUS,
    version: 1,
    after: { text: row.text },
    byUserId: addedById,
    note: input.replacesId
      ? `New wording for rule ${input.replacesId}; waits for a test and the founder's OK (A-319).`
      : "Set by the founder on Talk to it; waits for a test and the founder's OK (A-319).",
  });
  return row;
}

/**
 * "Change the wording". A waiting rule changes in place: the new words and their history are written in one
 * transaction, so the old words are never lost, and a second change racing this one finds the version moved and
 * changes nothing. A rule in use keeps its words until the new ones are put to work (A-319): they wait as a new rule
 * that replaces it, and changing them again changes that waiting rule.
 */
export async function updateTrainingRule(id: string, text: string, byUserId: string | null = null): Promise<boolean> {
  const value = clean(text, MAX_RULE_TEXT);
  if (!value) return false;
  const current = await prisma.trainingRule.findFirst({
    where: { id, status: { in: [WAITING_STATUS, LIVE_STATUS] } },
    select: { text: true, version: true, trade: true, note: true, status: true },
  });
  if (!current) return false;
  if (current.status === LIVE_STATUS) {
    const waiting = await prisma.trainingRule.findFirst({ where: { replacesId: id, status: WAITING_STATUS }, select: { id: true } });
    if (waiting) return updateTrainingRule(waiting.id, value, byUserId);
    if (current.text === value) return true;
    await saveTrainingRule({ trade: current.trade, text: value, note: current.note, replacesId: id }, byUserId);
    return true;
  }
  if (current.text === value) return true;
  const version = current.version + 1;
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.trainingRule.updateMany({ where: { id, status: WAITING_STATUS, version: current.version }, data: { text: value, version } });
    if (count === 0) return false;
    await learningEventWrite(tx, {
      trade: current.trade,
      kind: "training_rule",
      targetId: id,
      action: "edited",
      fromStatus: WAITING_STATUS,
      toStatus: WAITING_STATUS,
      version,
      before: { text: current.text },
      after: { text: value },
      byUserId,
    });
    return true;
  });
}

/** Undo the latest change of wording: the words before it come back, as a new version. */
export async function revertTrainingRuleWording(id: string, byUserId: string | null = null): Promise<boolean> {
  const last = await prisma.learningEvent.findFirst({
    where: { kind: "training_rule", targetId: id, businessId: null, action: "edited" },
    orderBy: { createdAt: "desc" },
    select: { before: true },
  });
  const previous = last?.before && typeof last.before === "object" && "text" in last.before ? (last.before as { text?: unknown }).text : null;
  if (typeof previous !== "string" || !previous) return false;
  return updateTrainingRule(id, previous, byUserId);
}

/** Undo. The rule stops reaching replies at once, and is kept so it can be put back. */
export async function rollBackTrainingRule(id: string, byUserId: string | null = null): Promise<boolean> {
  const rule = await prisma.trainingRule.findFirst({ where: { id, status: LIVE_STATUS }, select: { trade: true, version: true } });
  if (!rule) return false;
  const { count } = await prisma.trainingRule.updateMany({ where: { id, status: LIVE_STATUS }, data: { status: "ROLLED_BACK", endedAt: new Date() } });
  if (count === 0) return false;
  // New wording waiting to replace it goes too: it would otherwise come back as a rule of its own.
  const waiting = await prisma.trainingRule.findMany({ where: { replacesId: id, status: WAITING_STATUS }, select: { id: true } });
  for (const w of waiting) await dropTrainingRule(w.id, byUserId);
  await recordLearningEvent({
    trade: rule.trade,
    kind: "training_rule",
    targetId: id,
    action: "rolled_back",
    fromStatus: LIVE_STATUS,
    toStatus: "ROLLED_BACK",
    version: rule.version,
    byUserId,
  });
  return true;
}

/** Put back a rule that was undone. */
export async function restoreTrainingRule(id: string, byUserId: string | null = null): Promise<boolean> {
  const rule = await prisma.trainingRule.findFirst({ where: { id, status: "ROLLED_BACK" }, select: { trade: true, version: true } });
  if (!rule) return false;
  const { count } = await prisma.trainingRule.updateMany({ where: { id, status: "ROLLED_BACK" }, data: { status: LIVE_STATUS, endedAt: null } });
  if (count === 0) return false;
  await recordLearningEvent({
    trade: rule.trade,
    kind: "training_rule",
    targetId: id,
    action: "restored",
    fromStatus: "ROLLED_BACK",
    toStatus: LIVE_STATUS,
    version: rule.version,
    byUserId,
  });
  return true;
}

/** "Drop it": a waiting rule never goes in use. Kept, as REJECTED, with its history. */
export async function dropTrainingRule(id: string, byUserId: string | null = null): Promise<boolean> {
  const rule = await prisma.trainingRule.findFirst({ where: { id, status: WAITING_STATUS }, select: { trade: true, version: true } });
  if (!rule) return false;
  const { count } = await prisma.trainingRule.updateMany({ where: { id, status: WAITING_STATUS }, data: { status: "REJECTED", endedAt: new Date() } });
  if (count === 0) return false;
  await recordLearningEvent({
    trade: rule.trade,
    kind: "training_rule",
    targetId: id,
    action: "removed",
    fromStatus: WAITING_STATUS,
    toStatus: "REJECTED",
    version: rule.version,
    byUserId,
    note: "Dropped by the founder before it went in use (A-319).",
  });
  return true;
}
