import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { factInputSchema, labelKey } from "@/lib/factLines";

/**
 * PATCH/DELETE /api/business/facts/[id] — edit or remove one thing FollowUp
 * knows (src/lib/businessFacts.ts). Admin-only; the fact must belong to the
 * signed-in business, checked in the same query that changes it. An edited
 * fact becomes the owner's own, which a later reply never overwrites.
 */
type Params = { params: Promise<{ id: string }> };

async function guard() {
  const ctx = await getSessionContext();
  if (!ctx) return { error: NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 }) };
  if (!(await requireAdmin(ctx))) return { error: NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 }) };
  if (await tooManyRecentActions(ctx.businessId, "business.facts", { windowMinutes: 60, max: 120 })) {
    return { error: NextResponse.json({ success: false, message: "Too many changes. Wait a few minutes and try again." }, { status: 429 }) };
  }
  return { ctx };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { ctx, error } = await guard();
  if (error) return error;
  const { id } = await params;
  const parsed = await parseJsonBody(request, factInputSchema);
  if (!parsed.ok) return parsed.response;
  const label = parsed.data.label.replace(/\s+/g, " ");
  const value = parsed.data.value.replace(/\s+/g, " ");

  const others = await prisma.businessFact.findMany({ where: { businessId: ctx.businessId, id: { not: id } }, select: { label: true } });
  if (others.some((f) => labelKey(f.label) === labelKey(label))) {
    return NextResponse.json({ success: false, message: `There's already one called "${label}". Change that one instead.` }, { status: 409 });
  }
  const updated = await prisma.businessFact.updateMany({
    where: { id, businessId: ctx.businessId },
    data: { label, value, source: "owner", sourceLeadId: null },
  });
  if (updated.count === 0) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  void recordAudit(ctx, "business.fact.save", { targetType: "business_fact", targetId: id });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { ctx, error } = await guard();
  if (error) return error;
  const { id } = await params;
  const removed = await prisma.businessFact.deleteMany({ where: { id, businessId: ctx.businessId } });
  if (removed.count === 0) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  void recordAudit(ctx, "business.fact.delete", { targetType: "business_fact", targetId: id });
  return NextResponse.json({ success: true });
}
