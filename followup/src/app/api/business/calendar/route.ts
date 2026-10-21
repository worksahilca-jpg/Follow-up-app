import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getGmailStatus } from "@/lib/integrations/gmail";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";
import { CALENDAR_LABEL, calendarLabel, calendarOutcome, isCalendarKey, sourceForOutcome } from "@/lib/calendarUsed";

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

/**
 * POST /api/business/calendar — which calendar the owner books in (A-305, src/lib/calendarUsed.ts).
 *
 *  - { calendar }: from the one question on Today (A-101) or "Your calendar" in Settings. Saved as what they use. When
 *    FollowUp can book into it (Google Calendar with Gmail connected), or they use none (FollowUp's calendar), where
 *    customers book follows at once; otherwise the answer says the owner still has to pick (outcome "choose") or
 *    connect Gmail ("connect_gmail"), and where customers book stays as it was.
 *  - { notNow: true }: the card's "Not now". Not asked on Today again; Settings can still set it.
 *
 * Admin only, like where customers book (booking-source). Audited with the calendar's name, never anything else.
 */
const schema = z.union([
  z.object({ calendar: z.string().refine(isCalendarKey, "Pick one of the calendars.") }),
  z.object({ notNow: z.literal(true) }),
]);

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Not signed in.", 401);
  if (!(await requireAdmin(ctx))) return fail("Only an admin can change this.", 403);
  if (await tooManyRecentActions(ctx.businessId, "business.calendar", { windowMinutes: 60, max: 30 })) {
    return fail("Too many changes. Wait a few minutes and try again.", 429);
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { calendarUsed: true, questionsSkipped: true, bookingCalendarSource: true },
  });
  if (!business) return fail("Business not found.", 404);
  const next = new Date(Date.now() + NEXT_QUESTION_GAP_MS);

  if ("notNow" in body) {
    const skipped = business.questionsSkipped.includes(CALENDAR_LABEL) ? business.questionsSkipped : [...business.questionsSkipped, CALENDAR_LABEL];
    await prisma.business.update({ where: { id: ctx.businessId }, data: { questionAfter: next, questionsSkipped: skipped } });
    void recordAudit(ctx, "business.calendar", { targetType: "business", targetId: ctx.businessId, meta: { decision: "not_now" } });
    return NextResponse.json({ success: true });
  }

  const key = body.calendar as Parameters<typeof calendarOutcome>[0];
  const gmailConnected = (await getGmailStatus(ctx.businessId)).connected;
  const outcome = calendarOutcome(key, gmailConnected);
  const source = sourceForOutcome(outcome);
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      calendarUsed: key,
      ...(source ? { bookingCalendarSource: source } : {}),
      // The first answer is Today's question for the day; a change from Settings later doesn't push the next one back.
      ...(business.calendarUsed ? {} : { questionAfter: next }),
    },
  });
  void recordAudit(ctx, "business.calendar", { targetType: "business", targetId: ctx.businessId, meta: { calendar: key, outcome } });
  return NextResponse.json({
    success: true,
    calendarUsed: key,
    label: calendarLabel(key),
    outcome,
    gmailConnected,
    bookingCalendarSource: source ?? business.bookingCalendarSource,
  });
}
