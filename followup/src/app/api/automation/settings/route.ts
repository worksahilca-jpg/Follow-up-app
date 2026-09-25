import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { SILENCE_DEFAULT_TRIGGER_DAYS } from "@/lib/reminderCadence";
import { INSTANT_ACK_ACTION, INSTANT_ACK_NAME, isInstantAckEnabled } from "@/lib/acknowledge";
import {
  UNANSWERED_ACTION,
  UNANSWERED_DEFAULT_HOURS,
  UNANSWERED_NAME,
  DEAD_LEAD_ACTION,
  DEAD_LEAD_DEFAULT_DAYS,
  DEAD_LEAD_NAME,
} from "@/lib/automation";

async function getUnansweredReplySetting(businessId: string): Promise<{ enabled: boolean; hours: number }> {
  const rule = await prisma.automation.findFirst({ where: { businessId, action: UNANSWERED_ACTION } });
  return { enabled: rule?.enabled ?? true, hours: rule?.triggerHours ?? UNANSWERED_DEFAULT_HOURS };
}

async function getDeadLeadReactivationSetting(businessId: string): Promise<{ enabled: boolean; days: number }> {
  const rule = await prisma.automation.findFirst({ where: { businessId, action: DEAD_LEAD_ACTION } });
  return { enabled: rule?.enabled ?? true, days: rule?.triggerDays ?? DEAD_LEAD_DEFAULT_DAYS };
}
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

const AUTOMATION_NAME = "Auto follow-up on silence";
const AUTOMATION_ACTION = "auto_send";

/**
 * The permission to send without asking.
 *
 * Stored as `Business.holdAllForApproval`, which is the NEGATIVE of what
 * the owner is actually deciding, and that inversion is the dangerous
 * part: get it backwards and FollowUp starts messaging every customer a
 * business has, unasked. So the wire never carries the negative. The API
 * takes and returns `autoSendPermission` — true means "yes, send on my
 * behalf" — and the single `!` that translates it lives in one place in
 * each direction, below, with a test pinning both.
 *
 * Founder, 2026-09-22: "followup will be sending automatically followups
 * if they have allowed and given the permission." Off unless granted:
 * `holdAllForApproval` keeps its `@default(true)`, so silence on this
 * field, an older client, or a failed write all land on "still holding".
 */
const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  triggerDays: z.coerce.number().int().optional(),
  instantAck: z.boolean().optional(),
  autoSendPermission: z.boolean().optional(),
  // Business.autonomousAllowed — may any lead skip the risk check?
  autonomousAllowed: z.boolean().optional(),
  unansweredReply: z
    .object({
      enabled: z.boolean().optional(),
      hours: z.coerce.number().optional(),
    })
    .optional(),
  deadLeadReactivation: z
    .object({
      enabled: z.boolean().optional(),
      days: z.coerce.number().optional(),
    })
    .optional(),
});

// GET /api/automation/settings — the business-level automation master
// switch + trigger delay for the SIGNED-IN user's own business, backing
// the "Automation" section in Settings.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ enabled: false, triggerDays: SILENCE_DEFAULT_TRIGGER_DAYS }, { status: 401 });

  const automation = await prisma.automation.findFirst({
    where: { businessId: ctx.businessId, action: AUTOMATION_ACTION },
  });
  // Business.holdAllForApproval — true by default since 2026-09-21. It
  // changes what ALL FOUR of the rules below actually DO: the silence
  // nudge, the unanswered-reply step-in, the dead-lead reactivation and
  // the instant acknowledgement all still run, but their drafts go to the
  // approval queue instead of out.
  //
  // This comment named the instant acknowledgement as an exception that
  // "really does send on a holding account". That stopped being true on
  // 2026-09-20 (founder: "don't send any replies without asking me"); see
  // the hold-all branch in acknowledge.ts. The claim outlived the code by
  // a day here and in Settings' own sentence, which told a holding owner
  // their leads were being answered automatically when nothing was going
  // out at all — the quiet kind of wrong, since a product that overstates
  // what it sends is the one an owner stops checking.
  //
  // Settings' summary sentence is the one place that states all four as
  // fact, so it is the one place that has to know.
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { holdAllForApproval: true, autonomousAllowed: true },
  });
  return NextResponse.json({
    enabled: automation?.enabled ?? true,
    triggerDays: automation?.triggerDays ?? SILENCE_DEFAULT_TRIGGER_DAYS,
    instantAck: await isInstantAckEnabled(ctx.businessId),
    unansweredReply: await getUnansweredReplySetting(ctx.businessId),
    deadLeadReactivation: await getDeadLeadReactivationSetting(ctx.businessId),
    holdAllForApproval: business?.holdAllForApproval ?? false,
    // The same fact the positive way round, so no client ever writes the
    // `!` itself. See settingsSchema's header for why that matters.
    autoSendPermission: !(business?.holdAllForApproval ?? true),
    autonomousAllowed: business?.autonomousAllowed ?? false,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "automation.settings.update");
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const parsed = await parseJsonBody(request, settingsSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Granting or withdrawing the permission to send is saved on its own,
  // ahead of every other branch, and never rides along with another
  // setting. Two reasons, and both are about the same risk: it is the one
  // switch on this route that causes real messages to reach real
  // customers, so it must not be flipped as a side effect of someone
  // saving the silence delay; and a request that carries it alone is the
  // only shape the Settings panel sends, so anything else arriving with
  // it is a client that should not be trusted to have meant it.
  if (typeof body.autoSendPermission === "boolean") {
    const granted = body.autoSendPermission;
    await prisma.business.update({
      where: { id: ctx.businessId },
      // The one inversion inbound. `granted` is the owner's decision;
      // `holdAllForApproval` is its opposite.
      data: {
        holdAllForApproval: !granted,
        // Stamped on grant, cleared when the hold goes back on. This is
        // what stops the switch releasing the whole queue at once: the
        // send path refuses to act on any conversation older than this
        // moment, so what was already waiting stays waiting until the
        // owner releases it deliberately.
        autoSendAllowedAt: granted ? new Date() : null,
      },
    });
    // Named for what happened rather than for the field, so the trail
    // reads as a decision someone made. recordAudit already carries who
    // and when, and the IP.
    void recordAudit(ctx, granted ? "automation.autosend.granted" : "automation.autosend.revoked");
    return NextResponse.json({ success: true, autoSendPermission: granted });
  }

  /**
   * May a lead skip the risk check entirely (the Auto mode)?
   *
   * Saved on its own for the same reason as the switch above, and it is
   * a genuinely different question. That one asks "does anything send by
   * itself"; this asks "may something send WITHOUT BEING CHECKED". An
   * owner can answer yes to the first and no to the second forever.
   *
   * Founder, 2026-09-23: "Auto should be permitted by the user that is
   * using followup."
   */
  if (typeof body.autonomousAllowed === "boolean") {
    const granted = body.autonomousAllowed;
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: {
        autonomousAllowed: granted,
        // Stamped on grant, cleared on revoke. This is what makes the
        // permission mean "from now on": the send path refuses to act
        // unreviewed on any conversation older than this moment, so
        // turning it on cannot flush a back catalogue. Clearing it on
        // revoke means granting again starts a fresh window rather than
        // reaching back to the first time.
        autonomousAllowedAt: granted ? new Date() : null,
      },
    });
    void recordAudit(ctx, granted ? "automation.autonomous.granted" : "automation.autonomous.revoked");
    return NextResponse.json({ success: true, autonomousAllowed: granted });
  }

  // The unanswered-reply rule is saved on its own (see src/lib/automation.ts).
  if (
    body.unansweredReply &&
    typeof body.unansweredReply === "object" &&
    body.enabled === undefined &&
    body.instantAck === undefined &&
    body.deadLeadReactivation === undefined
  ) {
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

  // The dead-lead reactivation rule is saved on its own too — same
  // isolation reasoning as the unanswered-reply rule above.
  if (
    body.deadLeadReactivation &&
    typeof body.deadLeadReactivation === "object" &&
    body.enabled === undefined &&
    body.instantAck === undefined &&
    body.unansweredReply === undefined
  ) {
    const enabled = Boolean(body.deadLeadReactivation.enabled);
    const raw = Number(body.deadLeadReactivation.days);
    const days = Number.isFinite(raw) ? Math.max(30, Math.min(180, Math.round(raw))) : DEAD_LEAD_DEFAULT_DAYS;
    const existingRule = await prisma.automation.findFirst({ where: { businessId: ctx.businessId, action: DEAD_LEAD_ACTION } });
    if (existingRule) {
      await prisma.automation.update({ where: { id: existingRule.id }, data: { enabled, triggerDays: days } });
    } else {
      await prisma.automation.create({
        data: { businessId: ctx.businessId, name: DEAD_LEAD_NAME, action: DEAD_LEAD_ACTION, enabled, triggerDays: days },
      });
    }
    return NextResponse.json({ success: true, deadLeadReactivation: { enabled, days } });
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
  const triggerDays = body.triggerDays !== undefined && Number.isFinite(body.triggerDays) ? Math.max(1, Math.min(30, Math.round(body.triggerDays))) : SILENCE_DEFAULT_TRIGGER_DAYS;

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
