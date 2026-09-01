import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const AUTOMATION_NAME = "Auto follow-up on silence";
const AUTOMATION_ACTION = "auto_send";

// GET /api/automation/settings — the business-level automation master
// switch + trigger delay, backing the "Automation" section in Settings.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ enabled: false, triggerDays: 5 }, { status: 401 });

  const business = await prisma.business.findFirst();
  if (!business) return NextResponse.json({ enabled: false, triggerDays: 5 });

  const automation = await prisma.automation.findFirst({
    where: { businessId: business.id, action: AUTOMATION_ACTION },
  });
  return NextResponse.json({
    enabled: automation?.enabled ?? false,
    triggerDays: automation?.triggerDays ?? 5,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ success: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const triggerDays = Number.isFinite(body.triggerDays) ? Math.max(1, Math.min(30, Math.round(body.triggerDays))) : 5;

  const business = await prisma.business.findFirst();
  if (!business) {
    return NextResponse.json({ success: false, message: "No business yet — connect Gmail first." }, { status: 400 });
  }

  const existing = await prisma.automation.findFirst({
    where: { businessId: business.id, action: AUTOMATION_ACTION },
  });

  if (existing) {
    await prisma.automation.update({
      where: { id: existing.id },
      data: { enabled, triggerDays },
    });
  } else {
    await prisma.automation.create({
      data: { businessId: business.id, name: AUTOMATION_NAME, action: AUTOMATION_ACTION, enabled, triggerDays },
    });
  }

  return NextResponse.json({ success: true, enabled, triggerDays });
}
