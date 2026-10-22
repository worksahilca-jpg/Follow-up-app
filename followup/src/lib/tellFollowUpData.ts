import { prisma } from "@/lib/db";
import { FIRST_QUESTION_AFTER_MS, WHAT_YOU_DO_LABEL } from "@/lib/dailyQuestion";
import { labelKey, type FactLine } from "@/lib/factLines";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { wordTellQuestion } from "@/lib/integrations/openai";
import { checkedWording, knowsLine, showTellCard, tellState, type TellState, type TellTopic } from "@/lib/tellFollowUp";

/** How long the owner waits for a question worded for their business before the plain one is asked instead. */
const WORDING_WAIT_MS = 4000;

/**
 * The question to ask now, worded for this business when FollowUp can (A-313), the plain one otherwise. The opener,
 * and any question while nothing is known yet, stay plain: there is nothing to fit the words to. Counts toward the
 * daily AI ceiling. Never throws, and never keeps the owner waiting more than a few seconds.
 */
export async function wordedTopic(businessId: string, topic: TellTopic | null, facts: readonly FactLine[]): Promise<TellTopic | null> {
  if (!topic) return null;
  if (labelKey(topic.label) === labelKey(WHAT_YOU_DO_LABEL) || facts.length === 0) return topic;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
    if (await tooManyRecentActions(businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY)) return topic;
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), WORDING_WAIT_MS);
    });
    const proposed = await Promise.race([wordTellQuestion(topic, facts), late]);
    return checkedWording(proposed, topic) ?? topic;
  } catch (err) {
    console.error(`Could not word a "Tell FollowUp" question for business ${businessId}:`, err instanceof Error ? err.message : err);
    return topic;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Where this business's conversation is (src/lib/tellFollowUp.ts), from what FollowUp knows and what was skipped. */
export async function loadTellState(businessId: string, again = false): Promise<TellState | null> {
  const [business, facts] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { industry: true, questionsSkipped: true } }),
    prisma.businessFact.findMany({
      where: { businessId, approvedAt: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { label: true, value: true },
    }),
  ]);
  if (!business) return null;
  return tellState(business.industry, facts, business.questionsSkipped ?? [], again);
}

export type TellCardProps = { knows: string };

/**
 * The card on Today (A-311), or null. Offered once, with the quiet rules of the one question a day (A-101): not in
 * the first hour, not while a question is resting. Never throws: Today never fails over a card.
 */
export async function tellCardOffer(businessId: string, now: Date = new Date()): Promise<TellCardProps | null> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { createdAt: true, questionAfter: true, tellCardClosedAt: true },
    });
    if (!business || business.tellCardClosedAt) return null;
    if (now.getTime() - business.createdAt.getTime() < FIRST_QUESTION_AFTER_MS) return null;
    if (business.questionAfter && business.questionAfter > now) return null;
    const state = await loadTellState(businessId);
    if (!state || !showTellCard(state.open.length, business.tellCardClosedAt)) return null;
    return { knows: knowsLine(state.facts.length) };
  } catch (err) {
    console.error(`Could not check the "Tell FollowUp" card for business ${businessId}:`, err);
    return null;
  }
}
