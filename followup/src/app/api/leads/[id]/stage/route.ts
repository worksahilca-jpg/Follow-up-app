import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { moveLeadStage, PIPELINE_STAGES } from "@/lib/leadStage";
import { parseJsonBody } from "@/lib/validation";

const stageSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
});

// POST /api/leads/[id]/stage — moves a lead through the pipeline. Landing
// on WON or LOST also logs a real Deal record (src/lib/leadStage.ts, shared
// with "How did it go?" after a call, A-263).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, stageSchema);
  if (!parsed.ok) return parsed.response;
  const { stage } = parsed.data;

  const moved = await moveLeadStage(ctx.businessId, id, stage);
  if (!moved) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  return NextResponse.json({ success: true, stage: moved.stage });
}
