import { prisma } from "@/lib/db";
import { MAX_RULE_NOTE, MAX_RULE_TEXT, RULES_IN_PROMPT } from "@/lib/trainingRuleLines";
import { scrub } from "@/lib/trainingParse";

/**
 * "Tell FollowUp what's wrong" (A-297, founder 2026-10-19: "deploy an agent whom I can talk to and help that model to
 * improve … I can't paste everything here and then send you screenshots"). On Train → Talk to it the founder says, in
 * his own words, what's wrong with an answer. FollowUp turns that into one rule for that kind of business
 * (writeCoachRule in src/lib/integrations/openai.ts), keeps it here, and every draft and first reply for that kind
 * reads the newest few (rulesPromptBlock). Nothing is forgotten: the rules live in the database, not in anyone's
 * memory. The founder can change the wording or undo one.
 *
 * Emails, phone numbers, addresses and links are taken out of both the rule and his words before they are kept.
 * The callers are founder-only.
 */

export type TrainingRuleRow = { id: string; trade: string; text: string; createdAt: Date };

const clean = (t: string, max: number) => scrub(t, [], "").replace(/\s+/g, " ").trim().slice(0, max);

/** The newest rules for this kind of business, for a reply's instructions. Never throws: a draft never stops over them. */
export async function getTrainingRules(trade: string | null | undefined): Promise<string[]> {
  if (!trade) return [];
  try {
    const rows = await prisma.trainingRule.findMany({
      where: { trade },
      orderBy: { createdAt: "desc" },
      take: RULES_IN_PROMPT,
      select: { text: true },
    });
    return (rows ?? []).map((r) => r.text);
  } catch {
    return [];
  }
}

/** Every rule, newest first, for the list on Talk to it. */
export async function listTrainingRules(): Promise<TrainingRuleRow[]> {
  return prisma.trainingRule.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, trade: true, text: true, createdAt: true },
  });
}

export async function saveTrainingRule(
  input: { trade: string; text: string; note: string },
  addedById: string | null
): Promise<{ id: string; text: string }> {
  const row = await prisma.trainingRule.create({
    data: { trade: input.trade, text: clean(input.text, MAX_RULE_TEXT), note: clean(input.note, MAX_RULE_NOTE), addedById },
    select: { id: true, text: true },
  });
  return row;
}

/** "Change the wording". */
export async function updateTrainingRule(id: string, text: string): Promise<boolean> {
  const value = clean(text, MAX_RULE_TEXT);
  if (!value) return false;
  const { count } = await prisma.trainingRule.updateMany({ where: { id }, data: { text: value } });
  return count > 0;
}

/** Undo. */
export async function deleteTrainingRule(id: string): Promise<boolean> {
  const { count } = await prisma.trainingRule.deleteMany({ where: { id } });
  return count > 0;
}
