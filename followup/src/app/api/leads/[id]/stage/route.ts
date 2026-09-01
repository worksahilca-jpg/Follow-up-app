import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { PipelineStage } from "@prisma/client";

const VALID_STAGES: PipelineStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

// POST /api/leads/[id]/stage — moves a lead through the pipeline. Landing
// on WON or LOST also logs a real Deal record (win/loss + value + date),
// so the Deal table actually gets used instead of sitting empty.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const stage = body.stage as PipelineStage;
  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ success: false, message: "Invalid stage." }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

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

  return NextResponse.json({ success: true, stage: updated.stage });
}
