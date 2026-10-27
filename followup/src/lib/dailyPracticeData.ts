import { prisma } from "@/lib/db";
import { practiceDue, practiceFor, type PracticeMessage } from "@/lib/dailyPractice";

/**
 * Today's practice customer for this business (A-330, src/lib/dailyPractice.ts), or null when the daily slot isn't
 * open. Never throws: Today never fails over a practice card.
 */
export async function todaysPractice(businessId: string, now: Date = new Date()): Promise<PracticeMessage | null> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { industry: true, createdAt: true, questionAfter: true },
    });
    if (!business || !practiceDue(business, now)) return null;
    return practiceFor(business.industry, businessId, now);
  } catch (err) {
    console.error(`Could not pick today's practice for business ${businessId}:`, err);
    return null;
  }
}
