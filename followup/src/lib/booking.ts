/**
 * Booking slot generation and creation — the logic behind a lead's public
 * booking link (/book/[leadId]).
 *
 * Booking hours are the business's own since A-078 (founder, 2026-10-01):
 * days, start and end from Business.bookingDays / bookingStartMinute /
 * bookingEndMinute (src/lib/bookingHours.ts), in the business's timezone.
 * Before that they were a fixed Mon–Fri 9–5, which is not when a realtor
 * shows homes. Wall-clock time is computed with Intl.DateTimeFormat rather
 * than a date library, since all this needs is "what's the wall-clock
 * hour/weekday for this UTC instant in timezone X," which Intl handles
 * correctly across DST without an extra dependency.
 */

import { prisma } from "@/lib/db";
import { createCalendarEvent, getGoogleCalendarBusyTimes } from "@/lib/integrations/gmail";
import { SLOT_MINUTES, bookingHoursOf, type BookingHours } from "@/lib/bookingHours";
import { isUniqueViolation } from "@/lib/uniqueViolation";
import type { Prisma } from "@prisma/client";
import { bookingWhen, isReady, mergeQualification, readQualification, templateFor } from "@/lib/qualification";

const LOOKAHEAD_DAYS = 10;
const MIN_NOTICE_MINUTES = 60; // don't offer a slot starting less than an hour out

const WEEKDAY_NUMBER: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function wallClock(instant: Date, timeZone: string): { hour: number; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(instant);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    hour: Number(get("hour")) % 24, // Intl can format midnight as "24" with hour12: false
    minute: Number(get("minute")),
    weekday: WEEKDAY_NUMBER[get("weekday")] ?? -1,
  };
}

/** Exported for the tests; the engine and the booking page both go through it. */
export function isWithinBookingHours(instant: Date, timeZone: string, hours: BookingHours): boolean {
  const { hour, minute, weekday } = wallClock(instant, timeZone);
  if (!hours.days.includes(weekday)) return false;
  if (minute !== 0 && minute !== 30) return false; // slots are always on the grid; guards a stray instant
  const minuteOfDay = hour * 60 + minute;
  return minuteOfDay >= hours.startMinute && minuteOfDay < hours.endMinute;
}

function roundUpToSlot(ms: number): number {
  const slotMs = SLOT_MINUTES * 60 * 1000;
  return Math.ceil(ms / slotMs) * slotMs;
}

/** Whether a candidate [slotStart, slotStart+slotMs) overlaps any busy interval — half-open on both ends, matching how calendar busy blocks are normally compared. */
function overlapsBusy(slotStartMs: number, slotEndMs: number, busy: { start: string; end: string }[]): boolean {
  return busy.some((b) => {
    const busyStart = new Date(b.start).getTime();
    const busyEnd = new Date(b.end).getTime();
    return slotStartMs < busyEnd && slotEndMs > busyStart;
  });
}

/**
 * Is a slot starting at `t` one the link offers at all: at least the
 * minimum notice out, and inside the lookahead window? The slot list and
 * the confirm step ask the same question, so a posted time the page could
 * never have shown (five minutes from now, or next month) is refused.
 */
function isOfferableAt(t: number, now: number): boolean {
  return t >= now + MIN_NOTICE_MINUTES * 60 * 1000 && t <= now + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
}

export interface BookingContext {
  leadName: string;
  businessName: string;
  durationMinutes: number;
  /** The weekdays this business takes bookings on (0 = Sunday), so the page can tell a closed day from a full one. */
  bookingDays: number[];
}

/**
 * What the public booking page needs to render — who this is for, nothing else.
 *
 * First name only. This answers anyone holding the link, with no sign-in,
 * and the link travels: in follow-up emails, in the outbound-webhook
 * payload's leadId, in whatever the lead forwards. The page has only ever
 * shown the first name ("Hi Priya —"), so the full name was disclosure
 * with no use (audits 2026-09-16 M-2, 2026-09-26).
 */
export async function getBookingContext(leadId: string): Promise<BookingContext | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, business: { select: { name: true, bookingDays: true } } },
  });
  if (!lead) return null;
  const firstName = lead.name.trim().split(/\s+/)[0] ?? "";
  return { leadName: firstName, businessName: lead.business.name, durationMinutes: SLOT_MINUTES, bookingDays: bookingHoursOf(lead.business).days };
}

/** Open slots for this lead's business over the next LOOKAHEAD_DAYS, as ISO strings. */
export async function getAvailableSlots(leadId: string): Promise<string[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { businessId: true } });
  if (!lead) return [];

  const business = await prisma.business.findUnique({
    where: { id: lead.businessId },
    select: { timezone: true, bookingCalendarSource: true, bookingDays: true, bookingStartMinute: true, bookingEndMinute: true },
  });
  if (!business) return [];
  const hours = bookingHoursOf(business);

  const booked = await prisma.booking.findMany({
    where: { businessId: lead.businessId, status: "confirmed", scheduledAt: { gte: new Date() } },
    select: { scheduledAt: true },
  });
  const bookedTimes = new Set(booked.map((b) => b.scheduledAt.getTime()));

  const now = Date.now();
  const horizon = now + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
  const slotMs = SLOT_MINUTES * 60 * 1000;

  // "google" ADDS this on top of the fixed grid below, it never replaces
  // it — a lead should never be offered 2am just because Google Calendar
  // happens to show nothing there. Fetched once for the whole window
  // rather than once per candidate slot. getGoogleCalendarBusyTimes is
  // itself best-effort (no connection, a stale token, an API error all
  // just mean an empty list) — this can never make booking fail, only
  // ever narrow it.
  const googleBusy =
    business.bookingCalendarSource === "google"
      ? await getGoogleCalendarBusyTimes(lead.businessId, new Date(now).toISOString(), new Date(horizon).toISOString())
      : [];

  const slots: string[] = [];
  for (let t = roundUpToSlot(now); t <= horizon; t += slotMs) {
    if (!isOfferableAt(t, now) || bookedTimes.has(t)) continue;
    const instant = new Date(t);
    if (!isWithinBookingHours(instant, business.timezone, hours)) continue;
    if (googleBusy.length > 0 && overlapsBusy(t, t + slotMs, googleBusy)) continue;
    slots.push(instant.toISOString());
  }
  return slots;
}

type CreateBookingResult =
  | { success: true; scheduledAt: string }
  | { success: false; message: string };

/** Marks the viewing known on the lead's checklist, and stamps the ready moment if that completes it. */
export async function noteBookingOnChecklist(leadId: string, at: Date, timeZone: string): Promise<void> {
  const row = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { qualification: true, qualifiedAt: true, business: { select: { industry: true } } },
  });
  const template = templateFor(row?.business.industry);
  if (!row || !template) return;
  const qualification = mergeQualification(template, readQualification(row.qualification), null, [], bookingWhen(at, timeZone));
  await prisma.lead.update({ where: { id: leadId }, data: { qualification: qualification as unknown as Prisma.InputJsonValue } });
  if (!row.qualifiedAt && isReady(template, qualification)) {
    await prisma.lead.updateMany({ where: { id: leadId, qualifiedAt: null }, data: { qualifiedAt: new Date() } });
  }
}

/** Books a slot for this lead, re-validating everything server-side rather than trusting the client's slot list. */
export async function createBooking(leadId: string, scheduledAtIso: string): Promise<CreateBookingResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      businessId: true,
      business: { select: { name: true, timezone: true, bookingCalendarSource: true, bookingDays: true, bookingStartMinute: true, bookingEndMinute: true } },
    },
  });
  if (!lead) return { success: false, message: "This booking link isn't valid." };

  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime()) || !isOfferableAt(scheduledAt.getTime(), Date.now())) {
    return { success: false, message: "That time isn't valid anymore — pick another." };
  }
  if (!isWithinBookingHours(scheduledAt, lead.business.timezone, bookingHoursOf(lead.business))) {
    return { success: false, message: "That time is outside booking hours — pick another." };
  }
  // The same calendar check the slot list made, asked again for this one
  // slot at the moment of confirming (bug hunt, 2026-10-02): the owner can
  // put a meeting on their calendar between the page loading and the
  // customer pressing Book, and the page's list is minutes old by then.
  // Best-effort like the list: a read that fails returns nothing busy.
  if (lead.business.bookingCalendarSource === "google") {
    const slotEnd = new Date(scheduledAt.getTime() + SLOT_MINUTES * 60 * 1000);
    const busy = await getGoogleCalendarBusyTimes(lead.businessId, scheduledAt.toISOString(), slotEnd.toISOString());
    if (overlapsBusy(scheduledAt.getTime(), slotEnd.getTime(), busy)) {
      return { success: false, message: "That time was just taken on the calendar — pick another." };
    }
  }

  // Only the create is inside the slot-taken try. It used to wrap all three
  // statements below while its catch asserted a single cause — "someone else
  // just took this slot" — so ANY failure after the booking was committed
  // told the lead their booking hadn't happened.
  //
  // The damaging case: the Booking row commits, `lead.update` then fails, and
  // the lead is told the slot was taken. They pick another time and book
  // again. Now there are two bookings, the first is a phantom nobody is going
  // to attend, it blocks that slot against everyone else, and it counts in
  // the digest. The business shows up for one of them.
  //
  // One upcoming call per lead. The link is unauthenticated and travels
  // (emails, forwards, the outbound-webhook payload), and nothing capped
  // it: whoever held one link could POST every open slot for ten days —
  // ~160 bookings, each a real event on the owner's Google Calendar with
  // an invite to the lead's address, and no slot left for any other lead
  // (audits 2026-09-16 M-2, 2026-09-26 A-11). The check and the insert
  // share a per-lead advisory lock so two tabs posting at once cannot
  // both pass it.
  let booking;
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${lead.id}`}))`;
      const upcoming = await tx.booking.findFirst({
        where: { leadId: lead.id, status: "confirmed", scheduledAt: { gte: new Date() } },
        select: { id: true },
      });
      if (upcoming) return { alreadyBooked: true as const };
      return {
        alreadyBooked: false as const,
        booking: await tx.booking.create({ data: { businessId: lead.businessId, leadId: lead.id, scheduledAt } }),
      };
    });
    if (outcome.alreadyBooked) {
      return {
        success: false,
        message: "You already have a call booked. To change it, reply to the message that sent you this link.",
      };
    }
    booking = outcome.booking;
  } catch (err) {
    // Unique constraint on (businessId, scheduledAt) — this one really is
    // "someone else got there first", and nothing has been committed. Any
    // other failure (the database itself) is not, and used to be reported
    // in the same words; the customer then picked another time that was
    // never the problem. Logged, and told honestly.
    if (!isUniqueViolation(err)) {
      console.error(`Booking for lead ${lead.id} could not be written:`, err);
      return { success: false, message: "Something went wrong on our side — please try again in a moment." };
    }
    return { success: false, message: "That time was just booked by someone else — pick another." };
  }

  // Past this point the booking EXISTS. Everything below is bookkeeping, and
  // no failure in it may be reported to the lead as a failed booking.
  try {
    // Surface it wherever the salesperson already looks for what's coming up.
    await prisma.lead.update({ where: { id: lead.id }, data: { nextFollowUp: scheduledAt } });

    // Best-effort — the booking above has already succeeded regardless of
    // whether this puts it on an actual Google Calendar. Awaited (rather
    // than fire-and-forget) because this runs in a serverless function:
    // the process can be frozen the instant the response is sent, so an
    // un-awaited call here could simply never run. createCalendarEvent()
    // already swallows its own errors and returns {created: false}, so
    // this can't turn a real booking failure into a thrown error.
    await createCalendarEvent(lead.businessId, {
      summary: `Call with ${lead.name}`,
      description: "Booked via FollowUp.",
      startIso: booking.scheduledAt.toISOString(),
      durationMinutes: SLOT_MINUTES,
      attendeeEmail: lead.email ?? undefined,
    });

  } catch (err) {
    // The booking is real and the slot is held. Telling the lead it failed
    // would make them book a second one, so this is logged and swallowed:
    // the worst case is a confirmed call that isn't mirrored onto
    // `nextFollowUp` or a calendar, which is a far smaller problem than a
    // duplicate booking and a no-show.
    console.error(`Booking ${booking.id} committed but post-booking steps failed:`, err);
  }

  // A booked call is the next step the realtor's checklist waits for
  // (src/lib/qualification.ts), so it can be what makes a customer ready.
  // Bookkeeping like the above: never reported to the customer as a failure.
  try {
    await noteBookingOnChecklist(lead.id, booking.scheduledAt, lead.business.timezone);
  } catch (err) {
    console.error(`Booking ${booking.id} committed but the checklist could not be updated:`, err);
  }

  return { success: true, scheduledAt: booking.scheduledAt.toISOString() };
}
