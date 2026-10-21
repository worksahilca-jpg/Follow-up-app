import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { templateFor } from "@/lib/qualification";
import { isCalendarKey } from "@/lib/calendarUsed";

/**
 * GET /api/business/booking-source — the signed-in business's current
 * choice of where FollowUp checks availability and books meetings (see
 * Business.bookingCalendarSource's doc comment in schema.prisma), plus
 * whether Gmail is connected at all, since the "My Google Calendar"
 * option only makes sense when it is. Also which calendar the owner says
 * they book in (A-305), for "Your calendar" above it, and whether they are
 * a realtor (the showing services are offered only to them).
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const [business, gmailStatus] = await Promise.all([
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { bookingCalendarSource: true, calendarUsed: true, industry: true } }),
    getGmailStatus(ctx.businessId),
  ]);
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });

  return NextResponse.json({
    success: true,
    bookingCalendarSource: business.bookingCalendarSource,
    gmailConnected: gmailStatus.connected,
    calendarUsed: isCalendarKey(business.calendarUsed) ? business.calendarUsed : null,
    realtor: Boolean(templateFor(business.industry)),
  });
}

const bodySchema = z.object({ bookingCalendarSource: z.enum(["followup", "google"]) });

/**
 * POST /api/business/booking-source — switch between FollowUp's own
 * built-in scheduler and the business's real Google Calendar as the
 * source of truth for booking availability. Refuses "google" without a
 * connected Gmail — there'd be nothing to read busy times from, and
 * silently falling back (rather than rejecting) would leave the owner
 * thinking they got real-calendar protection when they didn't.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { bookingCalendarSource } = parsed.data;

  if (bookingCalendarSource === "google") {
    const gmailStatus = await getGmailStatus(ctx.businessId);
    if (!gmailStatus.connected) {
      return NextResponse.json(
        { success: false, message: "Connect Gmail first — there's no Google Calendar to check without it." },
        { status: 400 }
      );
    }
  }

  await prisma.business.update({ where: { id: ctx.businessId }, data: { bookingCalendarSource } });
  void recordAudit(ctx, "business.booking_source.update", { targetType: "business", targetId: ctx.businessId, meta: { bookingCalendarSource } });

  return NextResponse.json({ success: true, bookingCalendarSource });
}
