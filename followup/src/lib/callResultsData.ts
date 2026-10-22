import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { REAL_CUSTOMER } from "@/lib/pilotNumbersData";
import { readQualification } from "@/lib/qualification";
import { tallyCalls, type CallTally } from "@/lib/followUpCall";

/** "FollowUp's calls · last 30 days" on Results (A-310): customers who first wrote in the window. */
export const CALLS_WINDOW_DAYS = 30;

const DAY = 86_400_000;

/** How FollowUp sorted this business's new customers in the window, and what came of the Ready ones. Never the practice customer. */
export async function getCallTally(businessId: string, now: Date = new Date()): Promise<CallTally> {
  const since = new Date(now.getTime() - CALLS_WINDOW_DAYS * DAY);
  const leads = await prisma.lead.findMany({
    where: { businessId, createdAt: { gte: since }, qualification: { not: Prisma.DbNull }, ...REAL_CUSTOMER },
    select: { qualification: true, stage: true, bookings: { where: { status: "confirmed" }, select: { id: true }, take: 1 } },
    take: 5000,
  });
  return tallyCalls(
    leads.map((l) => ({ tier: readQualification(l.qualification)?.tier ?? null, booked: l.bookings.length > 0, won: l.stage === "WON" }))
  );
}
