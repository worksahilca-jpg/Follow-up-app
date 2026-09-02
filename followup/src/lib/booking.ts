/**
 * Booking slot generation and creation — the logic behind a lead's public
 * booking link (/book/[leadId]).
 *
 * Business hours are fixed for now — Mon-Fri, 9am-5pm in the business's
 * timezone — computed with Intl.DateTimeFormat rather than a date library,
 * since all this needs is "what's the wall-clock hour/weekday for this UTC
 * instant in timezone X," which Intl handles correctly across DST without
 * an extra dependency.
 */

import { prisma } from "@/lib/db";
import { createCalendarEvent } from "@/lib/integrations/gmail";

const SLOT_MINUTES = 30;
const BUSINESS_HOURS = { start: 9, end: 17 }; // 9am–5pm, exclusive end
const LOOKAHEAD_DAYS = 10;
const MIN_NOTICE_MINUTES = 60; // don't offer a slot starting less than an hour out

function wallClock(instant: Date, timeZone: string): { hour: number; minute: number; weekday: string } {
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
    weekday: get("weekday"),
  };
}

function isWithinBusinessHours(instant: Date, timeZone: string): boolean {
  const { hour, minute, weekday } = wallClock(instant, timeZone);
  if (weekday === "Sat" || weekday === "Sun") return false;
  if (hour < BUSINESS_HOURS.start || hour >= BUSINESS_HOURS.end) return false;
  return minute === 0 || minute === 30; // slots are always on the grid; guards a stray instant
}

function roundUpToSlot(ms: number): number {
  const slotMs = SLOT_MINUTES * 60 * 1000;
  return Math.ceil(ms / slotMs) * slotMs;
}

export interface BookingContext {
  leadName: string;
  businessName: string;
  durationMinutes: number;
}

/** What the public booking page needs to render — who this is for, nothing else. */
export async function getBookingContext(leadId: string): Promise<BookingContext | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, business: { select: { name: true } } },
  });
  if (!lead) return null;
  return { leadName: lead.name, businessName: lead.business.name, durationMinutes: SLOT_MINUTES };
}

/** Open slots for this lead's business over the next LOOKAHEAD_DAYS, as ISO strings. */
export async function getAvailableSlots(leadId: string): Promise<string[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { businessId: true } });
  if (!lead) return [];

  const business = await prisma.business.findUnique({
    where: { id: lead.businessId },
    select: { timezone: true },
  });
  if (!business) return [];

  const booked = await prisma.booking.findMany({
    where: { businessId: lead.businessId, status: "confirmed", scheduledAt: { gte: new Date() } },
    select: { scheduledAt: true },
  });
  const bookedTimes = new Set(booked.map((b) => b.scheduledAt.getTime()));

  const now = Date.now();
  const earliest = now + MIN_NOTICE_MINUTES * 60 * 1000;
  const horizon = now + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
  const slotMs = SLOT_MINUTES * 60 * 1000;

  const slots: string[] = [];
  for (let t = roundUpToSlot(now); t <= horizon; t += slotMs) {
    if (t < earliest || bookedTimes.has(t)) continue;
    const instant = new Date(t);
    if (!isWithinBusinessHours(instant, business.timezone)) continue;
    slots.push(instant.toISOString());
  }
  return slots;
}

type CreateBookingResult =
  | { success: true; scheduledAt: string }
  | { success: false; message: string };

/** Books a slot for this lead, re-validating everything server-side rather than trusting the client's slot list. */
export async function createBooking(leadId: string, scheduledAtIso: string): Promise<CreateBookingResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      businessId: true,
      business: { select: { name: true, timezone: true } },
    },
  });
  if (!lead) return { success: false, message: "This booking link isn't valid." };

  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    return { success: false, message: "That time isn't valid anymore — pick another." };
  }
  if (!isWithinBusinessHours(scheduledAt, lead.business.timezone)) {
    return { success: false, message: "That time is outside business hours — pick another." };
  }

  try {
    const booking = await prisma.booking.create({
      data: { businessId: lead.businessId, leadId: lead.id, scheduledAt },
    });
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

    return { success: true, scheduledAt: booking.scheduledAt.toISOString() };
  } catch {
    // Unique constraint on (businessId, scheduledAt) — someone else just took this slot.
    return { success: false, message: "That time was just booked by someone else — pick another." };
  }
}
