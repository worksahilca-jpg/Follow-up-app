import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { REAL_CUSTOMER } from "@/lib/pilotNumbersData";
import { readQualification, templateFor } from "@/lib/qualification";
import { tallyCalls, tierFromScore, type CallTally } from "@/lib/followUpCall";

/** "FollowUp's calls · last 30 days" on Results (A-310): customers who first wrote in the window. */
export const CALLS_WINDOW_DAYS = 30;

const DAY = 86_400_000;

/** How FollowUp sorted this business's new customers in the window, and what came of the Ready ones. Never the practice customer. */
export async function getCallTally(businessId: string, now: Date = new Date()): Promise<CallTally> {
  const since = new Date(now.getTime() - CALLS_WINDOW_DAYS * DAY);
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { industry: true } });
  // Real estate is sorted by its checklist; every other kind by the interest score FollowUp already keeps (A-310).
  const checklist = Boolean(templateFor(business?.industry));
  const leads = await prisma.lead.findMany({
    where: { businessId, createdAt: { gte: since }, ...(checklist ? { qualification: { not: Prisma.DbNull } } : {}), ...REAL_CUSTOMER },
    select: { qualification: true, score: true, scoreReason: true, stage: true, bookings: { where: { status: "confirmed" }, select: { id: true }, take: 1 } },
    take: 5000,
  });
  return tallyCalls(
    leads.map((l) => ({
      tier: checklist ? (readQualification(l.qualification)?.tier ?? null) : tierFromScore(l.score, l.scoreReason != null),
      booked: l.bookings.length > 0,
      won: l.stage === "WON",
    }))
  );
}
