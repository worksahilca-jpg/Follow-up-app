import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";

// POST /api/leads/[id]/automation — flips the per-lead auto-send opt-in.
// Off by default (Lead.automationOn defaults to false in the schema);
// this is the only way it turns on for a given lead, one at a time.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const owned = await prisma.lead.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true } });
  if (!owned) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ success: false, message: "Missing 'enabled' boolean." }, { status: 400 });
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: { automationOn: body.enabled },
  });

  return NextResponse.json({ success: true, automationOn: lead.automationOn });
}
