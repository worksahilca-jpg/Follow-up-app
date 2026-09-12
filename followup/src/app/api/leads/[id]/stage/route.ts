import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { parseJsonBody } from "@/lib/validation";

const stageSchema = z.object({
  stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]),
});

// POST /api/leads/[id]/stage — moves a lead through the pipeline. Landing
// on WON or LOST also logs a real Deal record (win/loss + value + date),
// so the Deal table actually gets used instead of sitting empty.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, stageSchema);
  if (!parsed.ok) return parsed.response;
  const { stage } = parsed.data;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.businessId !== ctx.businessId) {
    return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      stage,
      // A closed lead doesn't need a pending follow-up date hanging around.
      nextFollowUp: stage === "WON" || stage === "LOST" ? null : lead.nextFollowUp,
    },
  });

  if (stage === "WON" || stage === "LOST") {
    // One Deal per lead, not one per WON/LOST transition — a lead cycled
    // WON -> NEGOTIATION -> WON again (a mis-click corrected, or genuinely
    // re-closing after reopening) used to insert a second Deal row every
    // time, since this always created rather than checking for an
    // existing one first, silently inflating any count/sum over the Deal
    // table (e.g. businessData.ts's account-data export, which reads it
    // raw). Update the lead's existing deal record if it already has one
    // instead of appending a duplicate.
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
  }

  void notifyLeadEvent(ctx.businessId, "lead.stage_changed", updated, { previousStage: lead.stage });

  return NextResponse.json({ success: true, stage: updated.stage });
}
