import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { bookingHoursOf, bookingHoursProblem, isValidTimeZone, normalizeBookingHours } from "@/lib/bookingHours";

/**
 * GET /api/business/booking-hours — when customers can book a call through
 * their link (Business.bookingDays / bookingStartMinute / bookingEndMinute,
 * see src/lib/bookingHours.ts) and the business's time zone, which the
 * same Settings card now sets (A-078).
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { timezone: true, bookingDays: true, bookingStartMinute: true, bookingEndMinute: true },
  });
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });

  return NextResponse.json({ success: true, timezone: business.timezone, ...bookingHoursOf(business) });
}

const bodySchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startMinute: z.number().int().min(0).max(24 * 60),
  endMinute: z.number().int().min(0).max(24 * 60),
  timezone: z.string().min(1).max(64),
});

/**
 * POST /api/business/booking-hours — save the days, hours and time zone.
 * The shape is checked by zod; the meaning (at least one day, on the half
 * hour, end after start) by the same bookingHoursProblem() the Settings
 * card runs before it sends, so the two never disagree about what is
 * allowed. The time zone has to be one Intl can resolve: it is read by
 * Intl everywhere it is used, and a name Intl rejects would throw on
 * every booking page and every send-window check.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { timezone, ...hours } = parsed.data;

  const problem = bookingHoursProblem(hours);
  if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 });
  if (!isValidTimeZone(timezone)) return NextResponse.json({ success: false, message: "That isn't a time zone FollowUp knows." }, { status: 400 });

  const normalized = normalizeBookingHours(hours);
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      timezone,
      bookingDays: normalized.days,
      bookingStartMinute: normalized.startMinute,
      bookingEndMinute: normalized.endMinute,
    },
  });
  void recordAudit(ctx, "business.booking_hours.update", {
    targetType: "business",
    targetId: ctx.businessId,
    meta: { timezone, days: normalized.days, startMinute: normalized.startMinute, endMinute: normalized.endMinute },
  });

  return NextResponse.json({ success: true, timezone, ...normalized });
}
