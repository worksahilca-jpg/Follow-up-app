/**
 * Lead assignment & routing.
 *
 * Auto-assignment is "least loaded": whichever team member currently has
 * the fewest leads assigned to them gets the next one. No round-robin
 * cursor to maintain — it's just a live count, so it self-corrects if
 * someone's leads get reassigned or a lead gets deleted, and there's
 * nothing to get out of sync. Only ever runs on brand-new leads (Gmail
 * sync, manual entry, CSV import) — never reassigns an existing one.
 *
 * A team of one just gets that one person every time, which is exactly
 * right — this only starts doing real routing once there's more than one
 * person to route to.
 */

import { prisma } from "@/lib/db";

/** The least-loaded team member for this business, or null if the business somehow has no users. */
export async function pickAssignee(businessId: string): Promise<string | null> {
  const users = await prisma.user.findMany({
    where: { businessId },
    select: { id: true, _count: { select: { assignedLeads: true } } },
  });
  if (users.length === 0) return null;

  return users.reduce((least, u) => (u._count.assignedLeads < least._count.assignedLeads ? u : least)).id;
}

/**
 * Same idea as pickAssignee(), but for distributing a whole CSV batch at
 * once without a DB round-trip per row: starts from each member's current
 * count, then hands out leads in-memory, incrementing as it goes, so a
 * 500-row import actually spreads across the team instead of every row
 * re-reading the same stale counts (or worse, all landing on whoever
 * happened to be least-loaded before the batch started).
 */
export async function makeBatchAssigner(businessId: string): Promise<() => string | null> {
  const users = await prisma.user.findMany({
    where: { businessId },
    select: { id: true, _count: { select: { assignedLeads: true } } },
  });
  const counts = users.map((u) => ({ id: u.id, count: u._count.assignedLeads }));
  if (counts.length === 0) return () => null;

  return () => {
    const pick = counts.reduce((least, c) => (c.count < least.count ? c : least));
    pick.count += 1;
    return pick.id;
  };
}

export async function assignLead(
  leadId: string,
  businessId: string,
  assignedToId: string | null
): Promise<{ success: true } | { success: false; message: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { businessId: true } });
  if (!lead || lead.businessId !== businessId) return { success: false, message: "Lead not found." };

  if (assignedToId) {
    const target = await prisma.user.findUnique({ where: { id: assignedToId }, select: { businessId: true } });
    if (!target || target.businessId !== businessId) {
      return { success: false, message: "That person isn't on your team." };
    }
  }

  await prisma.lead.update({ where: { id: leadId }, data: { assignedToId } });
  return { success: true };
}
