import { prisma } from "@/lib/db";
import { startOfLocalDay } from "@/lib/calmToday";
import { readCallBrief } from "@/lib/callBrief";
import { noteWords } from "@/lib/missedByCrm";
import { personLine, readQualification } from "@/lib/qualification";
import { DAYS_IN_WEEK, inWeek, type WeekBooking, type WhichWeek } from "@/lib/callsWeek";

const HOUR = 3_600_000;

/**
 * The stretch of time a week's bookings can fall in, a little wide at both ends (a call that started up to four hours
 * ago, and an hour either side of a clock change); inWeek and callsWeek pick the exact days on the owner's clock.
 */
function windowFor(now: Date, timeZone: string, week: WhichWeek): { gte: Date; lt: Date } {
  const dayStart = startOfLocalDay(now, timeZone).getTime();
  const from = week === "this" ? 0 : DAYS_IN_WEEK;
  return {
    gte: week === "this" ? new Date(now.getTime() - 4 * HOUR) : new Date(dayStart + from * 24 * HOUR - 2 * HOUR),
    lt: new Date(dayStart + (from + DAYS_IN_WEEK) * 24 * HOUR + 2 * HOUR),
  };
}

/**
 * The owner's confirmed calls for a week (A-317), each with one line on what it is about: what the customer wants
 * from the call note (A-268) when there is one, else where they stand (Today's line, A-286), else their latest words
 * in quotes, else nothing (the page then says how long the call is). Only bookings made through FollowUp; a
 * calendar's own events aren't read here.
 */
export async function loadCallsWeek(businessId: string, now: Date, timeZone: string, week: WhichWeek): Promise<WeekBooking[]> {
  const rows = await prisma.booking.findMany({
    where: { businessId, status: "confirmed", scheduledAt: windowFor(now, timeZone, week) },
    select: {
      id: true,
      leadId: true,
      scheduledAt: true,
      durationMinutes: true,
      brief: true,
      lead: {
        select: {
          name: true,
          qualification: true,
          // Their latest message, for a call FollowUp knows little else about.
          conversations: { select: { messages: { where: { direction: "inbound" }, orderBy: { sentAt: "desc" }, take: 1, select: { body: true, sentAt: true } } } },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });
  return rows.map((r) => {
    const last = r.lead.conversations
      .flatMap((c) => c.messages)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
    const words = last ? noteWords(last.body, 90) : "";
    return {
      id: r.id,
      leadId: r.leadId,
      name: r.lead.name,
      scheduledAt: r.scheduledAt,
      durationMinutes: r.durationMinutes,
      about: readCallBrief(r.brief)?.wants[0]?.text ?? personLine(readQualification(r.lead.qualification)) ?? (words ? `“${words}”` : null),
    };
  });
}

/** How many calls this week still has to come: the number on Today's "Calls this week" row. */
export async function countCallsThisWeek(businessId: string, now: Date, timeZone: string): Promise<number> {
  const rows = await prisma.booking.findMany({
    where: { businessId, status: "confirmed", scheduledAt: windowFor(now, timeZone, "this") },
    select: { scheduledAt: true, durationMinutes: true },
    take: 200,
  });
  return inWeek(rows, now, timeZone, "this").length;
}
