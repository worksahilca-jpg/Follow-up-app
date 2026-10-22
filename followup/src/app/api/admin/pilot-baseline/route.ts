import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";

const SAVES_PER_DAY = 200;

/** A number the owner said, or nothing. Hours a week can't pass 168. */
const said = (max: number) => z.number().finite().min(0).max(max).nullable();

const bodySchema = z.object({
  businessId: z.string().min(1).max(64),
  inquiriesPerMonth: said(100_000),
  appointmentsPerMonth: said(100_000),
  hoursPerWeek: said(168),
});

function fromAnotherSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

/**
 * POST /api/admin/pilot-baseline — the pilot (founder, 2026-10-22): what a pilot owner said on the setup call about
 * how they work today, before FollowUp (inquiries and appointments a month, hours a week replying). Founder only;
 * anyone else gets a 404. All three empty clears it.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx || !isPlatformAdmin(ctx.email)) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  if (fromAnotherSite(request)) {
    return NextResponse.json({ success: false, message: "Refused: this request came from another site." }, { status: 403 });
  }
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  if (await tooManyRecentActions(ctx.businessId, "admin.pilot_baseline", { windowMinutes: 24 * 60, max: SAVES_PER_DAY })) {
    return NextResponse.json({ success: false, message: "That's a lot of saves today. Try again tomorrow." }, { status: 429 });
  }

  const { businessId, ...numbers } = parsed.data;
  const empty = numbers.inquiriesPerMonth === null && numbers.appointmentsPerMonth === null && numbers.hoursPerWeek === null;
  const result = await prisma.business.updateMany({
    where: { id: businessId },
    data: { pilotBaseline: empty ? Prisma.DbNull : numbers },
  });
  if (result.count === 0) return NextResponse.json({ success: false, message: "That business is gone." }, { status: 404 });
  void recordAudit(ctx, "admin.pilot_baseline", { targetType: "business", targetId: businessId, meta: { cleared: empty } });
  return NextResponse.json({ success: true });
}
