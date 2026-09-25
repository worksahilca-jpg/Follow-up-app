import { prisma } from "@/lib/db";

/**
 * One notification per held lead is right for one lead. It is wrong for
 * ninety.
 *
 * ## The burst
 *
 * Connecting Gmail pulls up to 100 threads from the last 90 days
 * (src/lib/integrations/gmail.ts). Every one of those is a lead whose
 * newest message predates the lead row, so `isBackfilledThread` holds its
 * draft rather than sending it — correctly, and for a reason written in
 * blood on 2026-09-09, when the alternative answered a 84-day-old supplier
 * thread with a payment commitment in the founder's voice.
 *
 * Held is right. Held *and announced one row at a time* is what this file
 * fixes. As shipped on 2026-09-21, the first automation tick after a fresh
 * connect would put up to a hundred notifications in a new owner's bell,
 * and the stale-approval reminder would do it again a day later. The first
 * ten testers would each have met the product that way.
 *
 * ## Why this is worth its own module
 *
 * The module that introduced the per-hold notification argued, in its own
 * header, that repeating a reminder every tick "would be a product nagging
 * about its own safety feature, and the owner would learn to ignore the
 * bell — which costs more than the lead." That reasoning was applied to
 * the same lead over time and not to many leads at one moment, which is
 * the same failure at a different axis. A bell showing 100 is not more
 * informative than a bell showing 1; it is less, because the owner stops
 * reading either.
 *
 * `brand-principles.md` #2 — urgency is stated once, precisely, where it
 * is actionable. A hundred rows is not precision, and the place it is
 * actionable is the approval queue, which one line can point at.
 *
 * ## The rule
 *
 * Per recipient, per flush: at or under the threshold, each lead is named
 * individually — that is the normal day and the naming is the value.
 * Over it, one line with the count, pointing at the queue.
 *
 * Deliberately per RECIPIENT rather than per business: the bell is per
 * person, so a team where one assignee holds ninety and another holds one
 * should give the second person their lead's name, not a count of one.
 */

/**
 * Above this many for one person in one flush, the individual rows become
 * one summary.
 *
 * Three, because it is the largest number that still reads as a list
 * rather than a pile — an owner who sees three names can hold them in mind
 * and act on them, and a fourth is already "some leads". Not tuned against
 * data; there is none yet. Worth revisiting once testers are using it,
 * which is a real reason to keep it named here rather than inline.
 */
export const HOLD_BURST_THRESHOLD = 3;

/**
 * The phrase that makes a summary recognisable as one.
 *
 * Same load-bearing-text trade as STALE_APPROVAL_MARKER in
 * staleApprovals.ts, and the same reason: no new column for a state that
 * can be read off the text the owner is already shown.
 */
export const HOLD_SUMMARY_MARKER = "waiting for your approval";

export type HoldNotice = {
  leadId: string;
  businessId: string;
  assignedToId: string | null;
  /** What this lead's own notification would have said. */
  message: string;
};

/** Every admin on a business, cached across the leads in one flush. */
async function adminsOf(businessId: string, cache: Map<string, string[]>): Promise<string[]> {
  const hit = cache.get(businessId);
  if (hit) return hit;
  const admins = await prisma.user.findMany({
    where: { businessId, role: "ADMIN" },
    select: { id: true },
  });
  const ids = admins.map((a) => a.id);
  cache.set(businessId, ids);
  return ids;
}

/**
 * Who hears about a held lead: its assignee, or every admin on the
 * business when nobody is assigned. Grouped by person, because both the
 * bell and the burst collapse below are per person.
 *
 * Exported for src/lib/ownerAlerts.ts, which tells the same people the
 * same thing outside the app. One resolver, so a phone alert can never go
 * to someone the bell did not, or skip someone it did.
 */
export async function groupByRecipient<T extends { leadId: string; businessId: string; assignedToId: string | null }>(
  items: T[]
): Promise<Map<string, T[]>> {
  const byUser = new Map<string, T[]>();
  const adminCache = new Map<string, string[]>();
  for (const item of items) {
    let userIds: string[];
    try {
      userIds = item.assignedToId ? [item.assignedToId] : await adminsOf(item.businessId, adminCache);
    } catch (err) {
      console.error(`Could not resolve owners for lead ${item.leadId}:`, err);
      continue;
    }
    for (const userId of userIds) {
      const list = byUser.get(userId);
      if (list) list.push(item);
      else byUser.set(userId, [item]);
    }
  }
  return byUser;
}

export type FlushResult = {
  /** Notification rows actually created. One summary counts as one. */
  rows: number;
  /** Distinct leads a real recipient was actually told about. */
  leads: number;
};

/**
 * Write the notifications for a run's held leads, collapsing a burst.
 *
 * Best-effort, like every notify path it replaces: this runs at the end of
 * the automation cron, beside real sends, and a notification that cannot
 * be written must never fail one.
 *
 * Two counts, because after collapsing they genuinely differ and a caller
 * wants the second: ninety held leads become one row, and reporting
 * "reminded: 1" for that would understate the work as badly as reporting
 * "rows: 90" would overstate it. `leads` counts only what a write actually
 * succeeded for, so a failed flush cannot report leads nobody heard about.
 */
export async function flushHoldNotices(
  notices: HoldNotice[],
  options: {
    /**
     * How the collapsed line reads. Callers that dedup on their own marker
     * MUST pass one containing it: a summary carries no leadId, so a
     * per-lead "have we said this already?" lookup can only find it by
     * text. staleApprovals.ts learned this the hard way — with the default
     * wording its reminder would have re-sent every hour forever, which is
     * the exact nagging the reminder was written to avoid.
     */
    summary?: (count: number) => string;
  } = {}
): Promise<FlushResult> {
  if (notices.length === 0) return { rows: 0, leads: 0 };
  const summaryFor =
    options.summary ?? ((count: number) => `${count} leads are ${HOLD_SUMMARY_MARKER}. Open Approvals to read them.`);

  // Fan each notice out to its recipients first — the assignee where there
  // is one, every admin otherwise. The same fallback notifyNeglect and
  // notifyLeadOwners already use, and the reason the grouping below is by
  // user rather than by lead.
  const byUser = await groupByRecipient(notices);

  let rows = 0;
  const covered = new Set<string>();

  for (const [userId, forUser] of byUser) {
    if (forUser.length <= HOLD_BURST_THRESHOLD) {
      // Caught per write, not per user: one lead whose notification fails
      // must not silence the other two. The batched version of this had
      // the try around the whole loop, and staleApprovals' "keeps going
      // when one lead's reminder fails" test caught it immediately — the
      // per-lead resilience it was asserting was real and worth keeping.
      for (const notice of forUser) {
        try {
          await prisma.notification.create({
            data: { userId, leadId: notice.leadId, message: notice.message },
          });
          rows += 1;
          covered.add(notice.leadId);
        } catch (err) {
          console.error(`Hold notification failed for lead ${notice.leadId}:`, err);
        }
      }
      continue;
    }

    try {
      // The summary. leadId is deliberately null: it is about the queue,
      // not one lead, and a notification that links to an arbitrary one of
      // ninety would be worse than one that links to the list. The bell's
      // dropdown already tolerates a null leadId (see the Notification
      // model — leadId is optional precisely so a notification can outlive
      // or not concern a single lead).
      await prisma.notification.create({
        data: {
          userId,
          leadId: null,
          message: summaryFor(forUser.length),
        },
      });
      rows += 1;
      for (const notice of forUser) covered.add(notice.leadId);
    } catch (err) {
      console.error(`Hold summary failed for user ${userId}:`, err);
    }
  }

  return { rows, leads: covered.size };
}
