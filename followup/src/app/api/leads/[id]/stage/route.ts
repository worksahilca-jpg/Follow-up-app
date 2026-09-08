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
    await prisma.deal.create({
      data: {
        leadId: lead.id,
        value: lead.dealValue,
        stage,
        wonAt: stage === "WON" ? new Date() : undefined,
        lostAt: stage === "LOST" ? new Date() : undefined,
      },
    });
  }

  void notifyLeadEvent(ctx.businessId, "lead.stage_changed", updated, { previousStage: lead.stage });

  return NextResponse.json({ success: true, stage: updated.stage });
}
