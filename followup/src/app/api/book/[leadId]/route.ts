import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBookingContext, getAvailableSlots, createBooking } from "@/lib/booking";
import { parseJsonBody } from "@/lib/validation";

const bookSchema = z.object({
  // Loosely validated on purpose: createBooking() re-validates this
  // against real, currently-open slots server-side (see its own doc
  // comment) — a garbage string just fails to match and returns a clean
  // "not available" error there, so this only needs to rule out an
  // empty/missing value before it gets that far.
  scheduledAt: z.string().min(1, "scheduledAt is required."),
});

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

  const slots = await getAvailableSlots(leadId);
  return NextResponse.json({ success: true, ...context, slots });
}

// POST /api/book/[leadId] — public: confirms a slot. Re-validates
// everything server-side (see createBooking) rather than trusting that the
// slot the client posted back was actually in the list it was offered.
export async function POST(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const parsed = await parseJsonBody(request, bookSchema);
  if (!parsed.ok) return parsed.response;

  const result = await createBooking(leadId, parsed.data.scheduledAt);
  if (!result.success) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
