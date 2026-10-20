import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import { meetingStage, readTierStages, SORT_TIERS, type SortTier } from "@/lib/crm/stages";

/**
 * "When they book a meeting, move them to" (A-275) and "When FollowUp sorts them" (A-303), for the CRM window in
 * Settings. Admins only, like the rest of the CRM's controls.
 *
 * GET: the owner's own stages in their CRM; which one a booking moves them to, and which ones Ready, Warm and Later
 * move them to (only what they picked: until then nobody moves, founder 2026-10-20); and "Read my notes".
 * PUT { stageId, for? }: their choice for a booking (the default) or a tier; null is "Don't move them".
 * PUT { readNotes }: "Read my notes" on or off (GoHighLevel).
 */

const putSchema = z.union([
  z.object({ stageId: z.string().max(200).nullable(), for: z.enum(["booked", "ready", "warm", "later"]).optional() }),
  z.object({ readNotes: z.boolean() }),
]);

async function connection(businessId: string) {
  const conn = await prisma.crmConnection.findUnique({
    where: { businessId },
    select: { provider: true, apiKey: true, bookedStage: true, bookedStageLabel: true, tierStages: true, readNotes: true },
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
  const picked = readTierStages(conn.tierStages);
  const tiers = Object.fromEntries(
    SORT_TIERS.map((t) => [t, { chosen: picked[t] ?? null, dontMove: picked[t] === null }])
  );
  return NextResponse.json({
    success: true,
    stages,
    chosen,
    dontMove: conn.bookedStage === "",
    tiers,
    readNotes: conn.readNotes,
    notesAvailable: Boolean(CRM_PROVIDERS[conn.provider].client.listNotes),
    // A GoHighLevel key is given its permissions one by one; without Opportunities it lists no stages.
    stagesHelp:
      stages.length === 0 && conn.provider === "gohighlevel"
        ? "FollowUp can't see your stages. In GoHighLevel, open the Private Integration and turn on Opportunities (read and write)."
        : null,
  });
}

export async function PUT(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const parsed = await parseJsonBody(request, putSchema);
  if (!parsed.ok) return parsed.response;
  const conn = await connection(ctx.businessId);
  if (!conn) return NextResponse.json({ success: false, message: "No CRM is connected." }, { status: 400 });
  if ("readNotes" in parsed.data) {
    await prisma.crmConnection.update({ where: { businessId: ctx.businessId }, data: { readNotes: parsed.data.readNotes } });
    void recordAudit(ctx, "integration.crm.read_notes", { meta: { on: parsed.data.readNotes } });
    return NextResponse.json({ success: true, readNotes: parsed.data.readNotes });
  }
  const { stageId } = parsed.data;
  const which = parsed.data.for ?? "booked";
  // Only one of their own stages: what the CRM lists now.
  const stage = stageId === null ? null : (await CRM_PROVIDERS[conn.provider].client.listStages(conn.apiKey)).find((s) => s.id === stageId);
  if (stageId !== null && !stage) return NextResponse.json({ success: false, message: "That stage isn't in your CRM any more." }, { status: 400 });
  if (which !== "booked") {
    const tier: SortTier = which;
    const next = { ...readTierStages(conn.tierStages), [tier]: stage ? { id: stage.id, name: stage.name } : null };
    await prisma.crmConnection.update({ where: { businessId: ctx.businessId }, data: { tierStages: next as unknown as Prisma.InputJsonValue } });
    void recordAudit(ctx, "integration.crm.tier_stage", { meta: { tier, stage: stage ? stage.name : "none" } });
    return NextResponse.json({ success: true, for: tier, chosen: stage ?? null, dontMove: !stage });
  }
  await prisma.crmConnection.update({
    where: { businessId: ctx.businessId },
    data: { bookedStage: stage ? stage.id : "", bookedStageLabel: stage ? stage.name : null },
  });
  void recordAudit(ctx, "integration.crm.booked_stage", { meta: { stage: stage ? stage.name : "none" } });
  return NextResponse.json({ success: true, chosen: stage ?? null, dontMove: !stage });
}
