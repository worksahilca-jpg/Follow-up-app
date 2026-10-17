import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { meetingStage } from "@/lib/crm/stages";

/**
 * "When they book a meeting, move them to" (A-275), for the CRM window in Settings. Admins only, like the rest of the
 * CRM's controls.
 *
 * GET: the owner's own stages in their CRM, and which one a booking moves them to (their choice, or the one that reads
 * like a meeting while they haven't chosen). PUT { stageId }: their choice; null is "Don't move them".
 */

const putSchema = z.object({ stageId: z.string().max(200).nullable() });

async function connection(businessId: string) {
  const conn = await prisma.crmConnection.findUnique({
    where: { businessId },
    select: { provider: true, apiKey: true, bookedStage: true, bookedStageLabel: true },
  });
  if (!conn?.apiKey || !isCrmProvider(conn.provider)) return null;
  return { ...conn, provider: conn.provider, apiKey: conn.apiKey };
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const conn = await connection(ctx.businessId);
  if (!conn) return NextResponse.json({ success: false, message: "No CRM is connected." }, { status: 400 });
  const stages = await CRM_PROVIDERS[conn.provider].client.listStages(conn.apiKey);
  const chosen =
    conn.bookedStage === ""
      ? null
      : conn.bookedStage
        ? { id: conn.bookedStage, name: conn.bookedStageLabel ?? conn.bookedStage }
        : meetingStage(stages);
  return NextResponse.json({ success: true, stages, chosen, dontMove: conn.bookedStage === "" });
}

export async function PUT(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const parsed = await parseJsonBody(request, putSchema);
  if (!parsed.ok) return parsed.response;
  const conn = await connection(ctx.businessId);
  if (!conn) return NextResponse.json({ success: false, message: "No CRM is connected." }, { status: 400 });
  const { stageId } = parsed.data;
  // Only one of their own stages: what the CRM lists now.
  const stage = stageId === null ? null : (await CRM_PROVIDERS[conn.provider].client.listStages(conn.apiKey)).find((s) => s.id === stageId);
  if (stageId !== null && !stage) return NextResponse.json({ success: false, message: "That stage isn't in your CRM any more." }, { status: 400 });
  await prisma.crmConnection.update({
    where: { businessId: ctx.businessId },
    data: { bookedStage: stage ? stage.id : "", bookedStageLabel: stage ? stage.name : null },
  });
  void recordAudit(ctx, "integration.crm.booked_stage", { meta: { stage: stage ? stage.name : "none" } });
  return NextResponse.json({ success: true, chosen: stage ?? null, dontMove: !stage });
}
