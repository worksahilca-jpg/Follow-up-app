import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { requireRecentAuth } from "@/lib/reauth";
import { prisma } from "@/lib/db";
import { deleteBusinessData } from "@/lib/businessData";
import { parseJsonBody } from "@/lib/validation";

const deleteSchema = z.object({ confirmation: z.string().min(1) });

// GET /api/business/delete — just the business's own name, so the Settings
// page's confirmation dialog can tell the admin exactly what to type back
// (rather than the client guessing, or a generic "type DELETE" that's too
// easy to do on reflex for something this irreversible).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }
  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } });
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });
  return NextResponse.json({ success: true, businessName: business.name });
}

// POST /api/business/delete — permanently deletes the caller's entire
// business: every lead, conversation, message, deal, task, booking,
// sequence, team member, and everything else scoped to it (see
// deleteBusinessData in src/lib/businessData.ts for the exact list and
// order), plus cancels any active Stripe subscription. Irreversible, so it
// requires the business's own name typed back exactly (case-insensitive)
// rather than a bare confirm-flag a client could send by accident, AND a
// recently, actually re-proven session (requireRecentAuth) — the one
// action in this app where "still has a valid cookie" shouldn't be enough
// on its own.
//
// Not gated on requireActiveBilling on purpose — the right to be erased
// can't depend on still having an active subscription.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }
  const reauth = requireRecentAuth(ctx);
  if (reauth) return reauth;

  const parsed = await parseJsonBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;

  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { name: true } });
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });

  if (parsed.data.confirmation.trim().toLowerCase() !== business.name.trim().toLowerCase()) {
    return NextResponse.json(
      { success: false, message: `Type "${business.name}" exactly to confirm — this can't be undone.` },
      { status: 400 }
    );
  }

  const result = await deleteBusinessData(ctx.businessId, { userId: ctx.userId, email: ctx.email });
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ success: true });
}
