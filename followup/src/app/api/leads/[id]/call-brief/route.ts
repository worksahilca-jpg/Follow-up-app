import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getLeadById } from "@/lib/leads-data";
import { prisma } from "@/lib/db";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { currentCallBrief } from "@/lib/callBriefStore";

// GET /api/leads/[id]/call-brief?booking=… — "Before your call" (design brain A-268): the note for one booked call
// with this customer, opened from Today's row. Kept with the booking and written again only when the conversation
// has moved on; every line is checked against the messages first (src/lib/callBrief.ts). Read-only for the owner:
// nothing is sent from here.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.call-brief", { windowMinutes: 10, max: 120 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  const { id } = await params;
  const bookingId = request.nextUrl.searchParams.get("booking") ?? "";
  if (!bookingId || bookingId.length > 64) return NextResponse.json({ success: false, message: "Which call?" }, { status: 400 });

  // This business's call with this customer, and nobody else's.
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, leadId: id, businessId: ctx.businessId, status: "confirmed" },
    select: { id: true, brief: true, lead: { select: { qualification: true } } },
  });
  if (!booking) return NextResponse.json({ success: false, message: "Call not found." }, { status: 404 });
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ success: false, message: "Call not found." }, { status: 404 });

  const brief = await currentCallBrief({
    bookingId: booking.id,
    businessId: ctx.businessId,
    leadId: id,
    leadName: lead.name,
    conversation: lead.conversation,
    qualification: booking.lead.qualification,
    stored: booking.brief,
  });
  return NextResponse.json({ success: true, brief, messages: lead.conversation.length });
}
