import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { readQualification, templateFor, tierOf, type Qualification } from "@/lib/qualification";
import { moveLeadForTier, tierMoveWhy } from "@/lib/crm/stages";

/**
 * "Keep following up anyway" (A-246). A customer who said they already
 * have an agent is no longer followed up; the owner can overrule that, for
 * this customer, with one tap. Their reminders start again and they are
 * sorted as if the agent had never been mentioned. Scoped to the owner's
 * own business and written to the audit trail.
 */
export async function keepFollowing(
  leadId: string,
  businessId: string,
  userId: string | null
): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId },
    select: { id: true, businessId: true, name: true, crmProvider: true, crmId: true, qualification: true, business: { select: { industry: true, askPlan: true } } },
  });
  if (!lead) return { success: false, message: "Customer not found." };
  const template = templateFor(lead.business.industry, lead.business.askPlan);
  const before = readQualification(lead.qualification);
  if (!template || !before) return { success: false, message: "Nothing to change for this customer." };

  const { tier: _old, ...rest } = before;
  void _old;
  const kept: Qualification = { ...rest, keepGoing: true };
  const tier = tierOf(template, kept);
  const qualification: Qualification = tier ? { ...kept, tier } : kept;
  await prisma.lead.update({
    where: { id: leadId },
    data: { qualification: qualification as unknown as Prisma.InputJsonValue, saidNoAt: null },
  });
  await recordAudit({ businessId, userId }, "lead.keep_following", { targetType: "lead", targetId: leadId });
  // Sorted again, so their CRM stage follows (A-303).
  await moveLeadForTier(lead, qualification.tier, tierMoveWhy(qualification, qualification.tier));
  return { success: true };
}
