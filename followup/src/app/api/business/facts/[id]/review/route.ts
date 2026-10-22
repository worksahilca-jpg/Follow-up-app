import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";

/**
 * POST /api/business/facts/[id]/review — the owner's answer to something FollowUp learned from a reply (A-308,
 * founder 2026-10-22: what it learns waits for an OK before any reply uses it).
 *
 *  - { decision: "use" }: in use from now on. New words about a fact already in use replace the old ones.
 *  - { decision: "not_right" }: something new is removed; new words beside a fact in use are dropped and the old
 *    words stay.
 *
 * Admin only, like every other change to what FollowUp knows; the fact must belong to the signed-in business,
 * checked in the same query that changes it. Audited without the words.
 */
type Params = { params: Promise<{ id: string }> };

const schema = z.object({ decision: z.enum(["use", "not_right"]) });

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });
  if (await tooManyRecentActions(ctx.businessId, "business.facts", { windowMinutes: 60, max: 120 })) {
    return NextResponse.json({ success: false, message: "Too many changes. Wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;

  const fact = await prisma.businessFact.findFirst({
    where: { id, businessId: ctx.businessId },
    select: { id: true, approvedAt: true, proposedValue: true },
  });
  if (!fact) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  if (fact.approvedAt && fact.proposedValue === null) {
    // Nothing waits on this one (already answered, maybe on another device): nothing to do.
    return NextResponse.json({ success: true });
  }

  if (parsed.data.decision === "use") {
    await prisma.businessFact.updateMany({
      where: { id, businessId: ctx.businessId },
      data: fact.proposedValue !== null ? { value: fact.proposedValue, proposedValue: null, approvedAt: new Date() } : { approvedAt: new Date() },
    });
  } else if (fact.approvedAt) {
    await prisma.businessFact.updateMany({ where: { id, businessId: ctx.businessId }, data: { proposedValue: null } });
  } else {
    await prisma.businessFact.deleteMany({ where: { id, businessId: ctx.businessId } });
  }
  void recordAudit(ctx, "business.fact.review", { targetType: "business_fact", targetId: id, meta: { decision: parsed.data.decision } });
  return NextResponse.json({ success: true });
}
