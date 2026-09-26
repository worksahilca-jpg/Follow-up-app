import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookingContext, getAvailableSlots, createBooking } from "@/lib/booking";
import { parseJsonBody } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { tooManyRecentActions } from "@/lib/rateLimit";

const bookSchema = z.object({
  // Loosely validated on purpose: createBooking() re-validates this
  // against real, currently-open slots server-side (see its own doc
  // comment) — a garbage string just fails to match and returns a clean
  // "not available" error there, so this only needs to rule out an
  // empty/missing value before it gets that far. The max is only a size
  // bound on a public field: an ISO timestamp is about 24 characters.
  scheduledAt: z.string().min(1, "scheduledAt is required.").max(64),
});

// Public and unauthenticated, and every accepted POST writes a Booking row
// and a real event on the business's Google Calendar (src/lib/booking.ts).
// Without a ceiling, whoever holds one booking link could take every open
// slot for ten days (research/audit/2026-09-16-security-audit-auth-tenancy-
// and-api.md, M-2). Per link: 10 an hour covers a lead retrying after
// "that time was just taken" several times over. Per business: 60 an hour
// is more bookings than any small business takes in a day.
const BOOK_LIMIT_PER_LEAD = { windowMinutes: 60, max: 10 };
const BOOK_LIMIT_PER_BUSINESS = { windowMinutes: 60, max: 60 };
const BOOK_VIEW_LIMIT_PER_LEAD = { windowMinutes: 10, max: 120 };

// GET /api/book/[leadId] — public, unauthenticated: the lead viewing their
// own booking link isn't a FollowUp user. Deliberately returns only what
// the page needs to render (lead first name, business name, open slots) —
// never anything else about the lead or business.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  const context = await getBookingContext(leadId);
  if (!context) {
    return NextResponse.json({ success: false, message: "This booking link isn't valid." }, { status: 404 });
  }

  // Reading the slots can ask Google Calendar for the business's busy
  // times (src/lib/booking.ts), on the business's own Google quota, once
  // per request. The page loads this once; 120 per 10 minutes per link is
  // a lot of reloads, and stops a loop run against someone's calendar.
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { businessId: true } });
  if (lead && (await tooManyRecentActions(lead.businessId, `book.view:${leadId}`, BOOK_VIEW_LIMIT_PER_LEAD))) {
    return NextResponse.json(
      { success: false, message: "Too many requests right now — please try again in a little while." },
      { status: 429 }
    );
  }

  const slots = await getAvailableSlots(leadId);
  return NextResponse.json({ success: true, ...context, slots });
}

// POST /api/book/[leadId] — public: confirms a slot. Re-validates
// everything server-side (see createBooking) rather than trusting that the
// slot the client posted back was actually in the list it was offered.
export async function POST(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;

  // RateLimitHit rows hang off a business, so the limit needs the lead's.
  // An unknown id has none and is refused here, with the same words
  // createBooking() uses, before any other work.
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { businessId: true } });
  if (!lead) {
    return NextResponse.json({ success: false, message: "This booking link isn't valid." }, { status: 409 });
  }
  if (
    (await tooManyRecentActions(lead.businessId, `book.create:${leadId}`, BOOK_LIMIT_PER_LEAD)) ||
    (await tooManyRecentActions(lead.businessId, "book.create", BOOK_LIMIT_PER_BUSINESS))
  ) {
    return NextResponse.json(
      { success: false, message: "Too many booking attempts right now — please try again in a little while." },
      { status: 429 }
    );
  }

  const parsed = await parseJsonBody(request, bookSchema);
  if (!parsed.ok) return parsed.response;

  const result = await createBooking(leadId, parsed.data.scheduledAt);
  if (!result.success) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
