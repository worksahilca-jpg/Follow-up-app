import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

/**
 * The owner's tap, and its Undo. Scoped to the owner's own business, and
 * written to the audit trail either way, so the lead's history can say
 * when it happened and who did it.
 */
export async function markTalked(
  leadId: string,
  businessId: string,
  userId: string | null,
  undo = false
): Promise<{ success: boolean; talkedAt?: string | null; message?: string }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true } });
  if (!lead) return { success: false, message: "Lead not found." };
  const talkedAt = undo ? null : new Date();
  await prisma.lead.update({ where: { id: leadId }, data: { talkedAt } });
  await recordAudit({ businessId, userId }, undo ? "lead.talked_undone" : "lead.talked", { targetType: "lead", targetId: leadId });
  return { success: true, talkedAt: talkedAt ? talkedAt.toISOString() : null };
}
