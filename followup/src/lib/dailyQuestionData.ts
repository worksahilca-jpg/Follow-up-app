import { prisma } from "@/lib/db";
import { pickDailyQuestion, whyAsk } from "@/lib/dailyQuestion";
import type { DailyQuestionProps } from "@/components/DailyQuestion";

/**
 * Today's one question for this business (A-101, src/lib/dailyQuestion.ts),
 * ready for the card. Never throws: Today never fails over a question.
 */
export async function todaysQuestion(businessId: string, now: Date = new Date()): Promise<DailyQuestionProps | null> {
  try {
    const [business, facts] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { industry: true, createdAt: true, questionAfter: true, questionsSkipped: true },
      }),
      prisma.businessFact.findMany({ where: { businessId }, select: { label: true } }),
    ]);
    if (!business) return null;
    const question = pickDailyQuestion(
      {
        trade: business.industry,
        createdAt: business.createdAt,
        questionAfter: business.questionAfter,
        questionsSkipped: business.questionsSkipped ?? [],
        knownLabels: facts.map((f) => f.label),
      },
      now
    );
    return question ? { ...question, why: whyAsk(question, business.industry) } : null;
  } catch (err) {
    console.error(`Could not pick today's question for business ${businessId}:`, err);
    return null;
  }
}
