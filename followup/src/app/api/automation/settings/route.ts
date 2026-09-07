import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { INSTANT_ACK_ACTION, INSTANT_ACK_NAME, isInstantAckEnabled } from "@/lib/acknowledge";
import { UNANSWERED_ACTION, UNANSWERED_DEFAULT_HOURS, UNANSWERED_NAME } from "@/lib/automation";

async function getUnansweredReplySetting(businessId: string): Promise<{ enabled: boolean; hours: number }> {
  const rule = await prisma.automation.findFirst({ where: { businessId, action: UNANSWERED_ACTION } });
  return { enabled: rule?.enabled ?? true, hours: rule?.triggerHours ?? UNANSWERED_DEFAULT_HOURS };
}
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

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
    enabled: automation?.enabled ?? true,
    triggerDays: automation?.triggerDays ?? 5,
    instantAck: await isInstantAckEnabled(ctx.businessId),
    unansweredReply: await getUnansweredReplySetting(ctx.businessId),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "automation.settings.update");
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));

  // The unanswered-reply rule is saved on its own (see src/lib/automation.ts).
  if (body.unansweredReply && typeof body.unansweredReply === "object" && body.enabled === undefined && body.instantAck === undefined) {
    const enabled = Boolean(body.unansweredReply.enabled);
    const raw = Number(body.unansweredReply.hours);
    const hours = Number.isFinite(raw) ? Math.max(1, Math.min(168, Math.round(raw))) : UNANSWERED_DEFAULT_HOURS;
    const existingRule = await prisma.automation.findFirst({ where: { businessId: ctx.businessId, action: UNANSWERED_ACTION } });
    if (existingRule) {
      await prisma.automation.update({ where: { id: existingRule.id }, data: { enabled, triggerHours: hours } });
    } else {
      await prisma.automation.create({
        data: { businessId: ctx.businessId, name: UNANSWERED_NAME, action: UNANSWERED_ACTION, enabled, triggerDays: 1, triggerHours: hours },
      });
    }
    return NextResponse.json({ success: true, unansweredReply: { enabled, hours } });
  }

  // The instant-reply switch is saved on its own (see src/lib/acknowledge.ts);
  // a request carrying only `instantAck` must not touch the silence settings.
  if (typeof body.instantAck === "boolean" && body.enabled === undefined) {
    const existingAck = await prisma.automation.findFirst({
      where: { businessId: ctx.businessId, action: INSTANT_ACK_ACTION },
    });
    if (existingAck) {
      await prisma.automation.update({ where: { id: existingAck.id }, data: { enabled: body.instantAck } });
    } else {
      await prisma.automation.create({
        data: { businessId: ctx.businessId, name: INSTANT_ACK_NAME, action: INSTANT_ACK_ACTION, enabled: body.instantAck, triggerDays: 0 },
      });
    }
    return NextResponse.json({ success: true, instantAck: body.instantAck });
  }

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
