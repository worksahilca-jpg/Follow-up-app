import { prisma } from "@/lib/db";
import { FIRST_QUESTION_AFTER_MS, pickDailyQuestion, whyAsk } from "@/lib/dailyQuestion";
import { stayingSummary, shouldAskForNews } from "@/lib/stayInTouchData";
import { MAX_NEWS, newsExample, newsQuestion, newsWhy, STAY_IN_TOUCH_TRIGGER } from "@/lib/stayInTouch";
import type { DailyQuestionProps } from "@/components/DailyQuestion";
import { ASK_PLAN_LABEL, MAX_WORDS, readAskPlan } from "@/lib/askPlan";
import { templateFor } from "@/lib/qualification";

/**
 * Today's one question for this business (A-101, src/lib/dailyQuestion.ts),
 * ready for the card. Never throws: Today never fails over a question.
 */
export async function todaysQuestion(businessId: string, now: Date = new Date()): Promise<DailyQuestionProps | null> {
  try {
    const [business, facts] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { industry: true, createdAt: true, questionAfter: true, questionsSkipped: true, askPlan: true },
      }),
      prisma.businessFact.findMany({ where: { businessId }, select: { label: true } }),
    ]);
    if (!business) return null;
    // Customers staying in touch who are due a note come first (A-260): the
    // question is how they hear from the business at all. Same quiet rules
    // as every question (A-101): not in the first hour, one a day.
    const quietNow = now.getTime() - business.createdAt.getTime() >= FIRST_QUESTION_AFTER_MS && !(business.questionAfter && business.questionAfter > now);
    if (quietNow) {
      const staying = await stayingSummary(businessId, now).catch(() => null);
      if (staying && shouldAskForNews(staying, now)) {
        const firsts = staying.due.map((d) => d.first);
        return {
          kind: "stay",
          label: STAY_IN_TOUCH_TRIGGER,
          question: newsQuestion(firsts.length, firsts),
          why: newsWhy(firsts),
          example: newsExample(business.industry),
          maxLength: MAX_NEWS,
        };
      }
    }
    const question = pickDailyQuestion(
      {
        trade: business.industry,
        createdAt: business.createdAt,
        questionAfter: business.questionAfter,
        questionsSkipped: business.questionsSkipped ?? [],
        knownLabels: facts.map((f) => f.label),
        wantsAskPlan: Boolean(templateFor(business.industry)) && !readAskPlan(business.askPlan),
      },
      now
    );
    if (!question) return null;
    const why = whyAsk(question, business.industry);
    // The owner's own questions (A-302) are saved as their plan, not as a fact.
    return question.label === ASK_PLAN_LABEL ? { ...question, why, kind: "plan", maxLength: MAX_WORDS } : { ...question, why };
  } catch (err) {
    console.error(`Could not pick today's question for business ${businessId}:`, err);
    return null;
  }
}
