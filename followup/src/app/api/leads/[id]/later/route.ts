import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { isLocalWeekend, laterTime, laterTodayAvailable } from "@/lib/later";

/**
 * POST /api/leads/[id]/later — set a waiting reply aside (A-046).
 *
 * { when: "later_today" | "tomorrow_morning" } hides it from Today until
 * then; { when: "clear" } is Undo. It comes back on its own, or as soon as
 * the customer writes (getPendingApprovals compares their next message
 * with laterSetAt). Nothing is sent and the draft is untouched.
 */
const schema = z.object({ when: z.enum(["later_today", "tomorrow_morning", "clear"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false }, { status: 401 });
  const parsed = await parseJsonBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;

  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } });
  const tz = business?.timezone ?? "America/New_York";
  const now = new Date();
  const { when } = parsed.data;

  if (when === "later_today" && !laterTodayAvailable(now, tz)) {
    return NextResponse.json({ success: false, message: "It's too late in the day for that. Try tomorrow morning." }, { status: 400 });
  }
  const until = when === "clear" ? null : laterTime(when, now, tz);

  const updated = await prisma.lead.updateMany({
    where: { id, businessId: ctx.businessId },
    data: { laterUntil: until, laterSetAt: until ? now : null },
  });
  if (updated.count === 0) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  // A Later on a weekend message, on the weekend, is what the weekend_wait
  // habit learns from (src/lib/habits.ts).
  let weekend = false;
  if (until && isLocalWeekend(now, tz)) {
    const latest = await prisma.message.findFirst({
      where: { direction: "inbound", conversation: { leadId: id, lead: { businessId: ctx.businessId } } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });
    weekend = !!latest && isLocalWeekend(latest.sentAt, tz);
  }
  void recordAudit(ctx, when === "clear" ? "lead.later_cleared" : "lead.later", {
    targetType: "lead",
    targetId: id,
    ...(until ? { meta: { until: until.toISOString(), ...(weekend ? { weekend: true } : {}) } } : {}),
  });
  return NextResponse.json({ success: true, until: until ? until.toISOString() : null });
}
