import { prisma } from "@/lib/db";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { mapWithConcurrency } from "@/lib/concurrency";

/**
 * One nudge for a lead that has been waiting too long.
 *
 * ## Why this exists on top of the notification at hold time
 *
 * Production, 2026-09-21: twenty-three leads in the approval queue, the
 * oldest waiting **175 hours** — seven days. Nine more past 55.
 *
 * Telling somebody at the moment of holding is the first half, and it
 * shipped separately. It does nothing for a notification that was missed,
 * and missing one is the normal case: the ICP is an owner running the
 * business *and* the follow-ups, who opens FollowUp between jobs, on a
 * phone, with ninety seconds. The weekly digest is the only other voice
 * in the product and it goes out on Mondays — a lead that arrives on
 * Tuesday waits six days before anything mentions it again, which is
 * precisely how a seven-day wait happens without anyone being careless.
 *
 * ## Why exactly one
 *
 * `brand-principles.md` #2, calm over urgent: *"urgency is stated once,
 * precisely, where it's actionable. Not repeated across every surface."*
 * An hourly cron that re-notified every tick would be a product nagging
 * about its own safety feature, and the owner would learn to ignore the
 * bell — which costs more than the lead.
 *
 * So: one notification when the draft is held, one reminder a day later,
 * and then silence. If both are ignored, the honest reading is that this
 * lead is not a priority for that owner, and more notifications will not
 * change that. The queue is still on the dashboard, and the weekly digest
 * still counts it.
 *
 * ## How "exactly one" is enforced without a new column
 *
 * A reminder is identified by the marker below appearing in a
 * Notification for that lead, written after the hold. No schema change,
 * no flag to keep in sync with a queue that is itself derived rather than
 * stored (see pendingApprovals.ts). The cost is that the marker is load-
 * bearing text: it appears in what the owner reads, and changing its
 * wording would make every already-reminded lead eligible again, once.
 */

/** A day. Long enough that the hold-time notification has had its chance,
 *  short enough that a lead is not stale by the time anyone hears twice. */
export const STALE_APPROVAL_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * The phrase that marks a notification as the reminder.
 *
 * Deliberately a whole clause rather than a tag like "[reminder]": it has
 * to read naturally, because the owner sees it. See the note above about
 * it being load-bearing.
 */
export const STALE_APPROVAL_MARKER = "still waiting for your approval";

export type StaleApprovalResult = { checked: number; reminded: number };

/**
 * Remind the owners of every approval this business has left sitting.
 *
 * Best-effort throughout: this runs inside the hourly automation cron,
 * and a failure to write a reminder must never be able to fail an actual
 * send. Returns counts for the cron's summary.
 */
export async function remindStaleApprovals(
  businessId: string,
  now: Date = new Date()
): Promise<StaleApprovalResult> {
  let reminded = 0;
  let pending: Awaited<ReturnType<typeof getPendingApprovals>>;
  try {
    pending = await getPendingApprovals(businessId);
  } catch (err) {
    console.error(`Stale-approval check failed for business ${businessId}:`, err);
    return { checked: 0, reminded: 0 };
  }

  const stale = pending.filter((p) => now.getTime() - p.heldAt.getTime() >= STALE_APPROVAL_AFTER_MS);
  if (stale.length === 0) return { checked: pending.length, reminded: 0 };

  // Who to tell, resolved once for the whole business rather than per
  // lead: the assignee where there is one, every admin otherwise — the
  // same fallback notifyNeglect and notifyLeadOwners already use.
  const admins = await prisma.user.findMany({
    where: { businessId, role: "ADMIN" },
    select: { id: true },
  });

  await mapWithConcurrency(stale, 4, async (approval) => {
    try {
      // Already reminded? The marker, written after this hold began. A
      // lead held again after being resolved gets a fresh hold time, so
      // it becomes eligible again — which is right: that is a new wait.
      const already = await prisma.notification.count({
        where: {
          leadId: approval.leadId,
          message: { contains: STALE_APPROVAL_MARKER },
          createdAt: { gte: approval.heldAt },
        },
      });
      if (already > 0) return;

      const lead = await prisma.lead.findUnique({
        where: { id: approval.leadId },
        select: { assignedToId: true },
      });
      const userIds = lead?.assignedToId ? [lead.assignedToId] : admins.map((a) => a.id);
      if (userIds.length === 0) return;

      const days = Math.max(1, Math.floor((now.getTime() - approval.heldAt.getTime()) / STALE_APPROVAL_AFTER_MS));
      const waited = days === 1 ? "a day" : `${days} days`;
      const message = `${approval.leadName} has been ${STALE_APPROVAL_MARKER} for ${waited}.`;

      for (const userId of userIds) {
        await prisma.notification.create({ data: { userId, leadId: approval.leadId, message } });
      }
      reminded += 1;
    } catch (err) {
      console.error(`Stale-approval reminder failed for lead ${approval.leadId}:`, err);
    }
  });

  return { checked: pending.length, reminded };
}

/**
 * Every business with a user, once an hour.
 *
 * Deliberately NOT only businesses with automation enabled, unlike the
 * send paths this runs beside. A business that has switched automation
 * off still has an approval queue — in fact it is more likely to, since
 * holding is what it asked for — and it is exactly the account that would
 * otherwise never hear about a waiting lead.
 */
export async function remindStaleApprovalsForAllBusinesses(now: Date = new Date()): Promise<StaleApprovalResult> {
  const businesses = await prisma.business.findMany({
    where: { users: { some: {} } },
    select: { id: true },
  });

  let checked = 0;
  let reminded = 0;
  await mapWithConcurrency(businesses, 3, async (b) => {
    const result = await remindStaleApprovals(b.id, now);
    checked += result.checked;
    reminded += result.reminded;
  });
  return { checked, reminded };
}
