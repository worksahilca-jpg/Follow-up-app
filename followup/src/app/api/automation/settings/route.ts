import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";

const AUTOMATION_NAME = "Auto follow-up on silence";
const AUTOMATION_ACTION = "auto_send";

// GET /api/automation/settings — the business-level automation master
// switch + trigger delay for the SIGNED-IN user's own business, backing
// the "Automation" section in Settings.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ enabled: false, triggerDays: 5 }, { status: 401 });

  const automation = await prisma.automation.findFirst({
    where: { businessId: ctx.businessId, action: AUTOMATION_ACTION },
  });
  return NextResponse.json({
    enabled: automation?.enabled ?? false,
    triggerDays: automation?.triggerDays ?? 5,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const triggerDays = Number.isFinite(body.triggerDays) ? Math.max(1, Math.min(30, Math.round(body.triggerDays))) : 5;

  const existing = await prisma.automation.findFirst({
    where: { businessId: ctx.businessId, action: AUTOMATION_ACTION },
  });

  if (existing) {
    await prisma.automation.update({
      where: { id: existing.id },
      data: { enabled, triggerDays },
    });
  } else {
    await prisma.automation.create({
      data: { businessId: ctx.businessId, name: AUTOMATION_NAME, action: AUTOMATION_ACTION, enabled, triggerDays },
    });
  }

  return NextResponse.json({ success: true, enabled, triggerDays });
}
