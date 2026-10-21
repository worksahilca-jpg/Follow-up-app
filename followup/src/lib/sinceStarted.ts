import { prisma } from "@/lib/db";

/**
 * "Since you started" (A-307, the app organised the way Wispr Flow organises: the owner's own numbers at the top of
 * Today). Three counts from the owner's own records, all time:
 *  - answered: customers who got at least one message from the business through FollowUp;
 *  - booked: calls and visits booked and not cancelled;
 *  - won: customers marked won.
 * The practice customer (POST /api/leads/test-lead) is never counted. Null when all three are 0 (a new account has
 * nothing to show yet) or the counts can't be read: Today never fails over this line.
 */
export type SinceStarted = { answered: number; booked: number; won: number };

const PRACTICE_SOURCE = "Test lead";

export async function sinceStartedFor(businessId: string): Promise<SinceStarted | null> {
  try {
    const realCustomer = { OR: [{ source: null }, { source: { not: PRACTICE_SOURCE } }] };
    const [answered, booked, won] = await Promise.all([
      prisma.lead.count({
        where: { businessId, ...realCustomer, conversations: { some: { messages: { some: { direction: "outbound" } } } } },
      }),
      prisma.booking.count({ where: { businessId, status: "confirmed" } }),
      prisma.lead.count({ where: { businessId, ...realCustomer, stage: "WON" } }),
    ]);
    return sinceStartedOrNull({ answered, booked, won });
  } catch (err) {
    console.error(`Could not count "since you started" for business ${businessId}:`, err);
    return null;
  }
}

/** The line only shows once there is something to show. */
export function sinceStartedOrNull(s: SinceStarted): SinceStarted | null {
  return s.answered + s.booked + s.won > 0 ? s : null;
}
