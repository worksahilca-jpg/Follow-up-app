import { prisma } from "@/lib/db";
import { notifyLeadEvent } from "@/lib/outboundWebhook";

export const PIPELINE_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export type PipelineStageName = (typeof PIPELINE_STAGES)[number];

/**
 * Moves a customer through the pipeline: the Won/Lost switch in Details
 * (POST /api/leads/[id]/stage) and "How did it go?" after a call (A-263,
 * src/lib/meetingOutcomeData.ts) both come through here, so a close means
 * the same thing wherever it was tapped.
 *
 * Landing on WON or LOST also logs a real Deal record (win/loss + value +
 * date). One Deal per lead, not one per transition: a lead cycled
 * WON -> NEGOTIATION -> WON again (a mis-click corrected, or genuinely
 * re-closing after reopening) used to insert a second Deal row every time,
 * silently inflating any count/sum over the Deal table (e.g.
 * businessData.ts's account-data export, which reads it raw). The lead's
 * existing deal record is updated instead of appending a duplicate.
 */
export async function moveLeadStage(businessId: string, leadId: string, stage: PipelineStageName): Promise<{ stage: PipelineStageName } | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.businessId !== businessId) return null;

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage,
      // A closed lead doesn't need a pending follow-up date hanging around.
      nextFollowUp: stage === "WON" || stage === "LOST" ? null : lead.nextFollowUp,
    },
  });

  if (stage === "WON" || stage === "LOST") {
    const existingDeal = await prisma.deal.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" } });
    const dealData = {
      value: lead.dealValue,
      stage,
      wonAt: stage === "WON" ? new Date() : null,
      lostAt: stage === "LOST" ? new Date() : null,
    };
    if (existingDeal) {
      await prisma.deal.update({ where: { id: existingDeal.id }, data: dealData });
    } else {
      await prisma.deal.create({ data: { leadId: lead.id, ...dealData } });
    }
  } else {
    // Reopened (an "Undo" after "How did it go?", or the stage moved back): the deal is no longer won or lost.
    // Left alone, Results counted "Won 1" this week beside "Won, all time 0" (2026-10-16).
    await prisma.deal.updateMany({ where: { leadId: lead.id, OR: [{ wonAt: { not: null } }, { lostAt: { not: null } }] }, data: { stage, wonAt: null, lostAt: null } });
  }

  void notifyLeadEvent(businessId, "lead.stage_changed", updated, { previousStage: lead.stage });
  return { stage: updated.stage as PipelineStageName };
}
