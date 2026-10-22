import { prisma } from "@/lib/db";
import { FIRST_QUESTION_AFTER_MS } from "@/lib/dailyQuestion";
import { knowsLine, showTellCard, tellState, type TellState } from "@/lib/tellFollowUp";

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
