import { prisma } from "@/lib/db";
import { MAX_RULE_NOTE, MAX_RULE_TEXT, RULES_IN_PROMPT } from "@/lib/trainingRuleLines";
import { scrub } from "@/lib/trainingParse";
import { LIVE_STATUS, learningEventWrite, recordLearningEvent } from "@/lib/learning";

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
 * Emails, phone numbers, addresses and links are taken out of both the rule and the founder's words before they are
 * kept. The callers are founder-only.
 */

export type TrainingRuleRow = { id: string; trade: string; text: string; createdAt: Date };

const clean = (t: string, max: number) => scrub(t, [], "").replace(/\s+/g, " ").trim().slice(0, max);

/** The newest active rules for this kind of business, for a reply's instructions. Never throws: a draft never stops over them. */
export async function getTrainingRules(trade: string | null | undefined): Promise<string[]> {
  if (!trade) return [];
  try {
    const rows = await prisma.trainingRule.findMany({
      where: { trade, status: LIVE_STATUS },
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
    select: { id: true, trade: true, text: true, createdAt: true },
  });
}

/** A new rule. The founder writing it is the approval (A-297), so it is active at once, and recorded as such. */
export async function saveTrainingRule(
  input: { trade: string; text: string; note: string },
  addedById: string | null
): Promise<{ id: string; text: string }> {
  const row = await prisma.trainingRule.create({
    data: {
      trade: input.trade,
      text: clean(input.text, MAX_RULE_TEXT),
      note: clean(input.note, MAX_RULE_NOTE),
      addedById,
      status: LIVE_STATUS,
      version: 1,
      approvedById: addedById,
      approvedAt: new Date(),
    },
    select: { id: true, text: true },
  });
  await recordLearningEvent({
    trade: input.trade,
    kind: "training_rule",
    targetId: row.id,
    action: "created",
    toStatus: LIVE_STATUS,
    version: 1,
    after: { text: row.text },
    byUserId: addedById,
    note: "Set by the founder on Talk to it; in use at once (A-297).",
  });
  return row;
}

/**
 * "Change the wording". The new words and their history are written in one transaction, so the old words are never
 * lost: if the history can't be written, the wording doesn't change either. A second change racing this one finds the
 * version moved and changes nothing.
 */
export async function updateTrainingRule(id: string, text: string, byUserId: string | null = null): Promise<boolean> {
  const value = clean(text, MAX_RULE_TEXT);
  if (!value) return false;
  const current = await prisma.trainingRule.findFirst({
    where: { id, status: LIVE_STATUS },
    select: { text: true, version: true, trade: true },
  });
  if (!current) return false;
  if (current.text === value) return true;
  const version = current.version + 1;
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.trainingRule.updateMany({ where: { id, status: LIVE_STATUS, version: current.version }, data: { text: value, version } });
    if (count === 0) return false;
    await learningEventWrite(tx, {
      trade: current.trade,
      kind: "training_rule",
      targetId: id,
      action: "edited",
      fromStatus: LIVE_STATUS,
      toStatus: LIVE_STATUS,
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
