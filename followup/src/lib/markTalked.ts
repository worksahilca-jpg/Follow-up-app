import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { recordSpoke } from "@/lib/calls";

/**
 * The owner's tap, and its Undo. Scoped to the owner's own business, and
 * written to the audit trail either way, so the lead's history can say
 * when it happened and who did it.
 */
export async function markTalked(
  leadId: string,
  businessId: string,
  userId: string | null,
  undo = false,
  // "I replied" on a lead site (b018, A-075): the same stop as "We talked",
  // said as what happened, with the site in the history.
  onSite = false
): Promise<{ success: boolean; talkedAt?: string | null; message?: string }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, viaSite: true } });
  if (!lead) return { success: false, message: "Lead not found." };
  const talkedAt = undo ? null : new Date();
  await prisma.lead.update({ where: { id: leadId }, data: { talkedAt } });
  const action = onSite ? (undo ? "lead.replied_on_site_undone" : "lead.replied_on_site") : undo ? "lead.talked_undone" : "lead.talked";
  // On a team that calls customers (A-103), "Already spoke" is also a call
  // that reached them: counted on the Team page, and no further call planned.
  if (!onSite) await recordSpoke(leadId, businessId, userId, undo);
  await recordAudit({ businessId, userId }, action, {
    targetType: "lead",
    targetId: leadId,
    ...(onSite && lead.viaSite ? { meta: { site: lead.viaSite } } : {}),
  });
  return { success: true, talkedAt: talkedAt ? talkedAt.toISOString() : null };
}
