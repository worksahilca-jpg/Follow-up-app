import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { MEETING_OUTCOMES } from "@/lib/meetingOutcome";
import { recordMeetingOutcome, undoMeetingOutcome } from "@/lib/meetingOutcomeData";

const schema = z.object({
  bookingId: z.string().min(1).max(64),
  outcome: z.enum(MEETING_OUTCOMES).optional(),
  undo: z.boolean().optional(),
});

// POST /api/leads/[id]/meeting — "How did it go?" on Today after a booked
// call (design brain A-263), and its Undo with { undo: true }. One tap ends
// the conversation the right way; nothing is sent from here. See
// src/lib/meetingOutcomeData.ts.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.meeting", { windowMinutes: 10, max: 300 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { bookingId, outcome, undo } = parsed.data;
  if (!undo && !outcome) return NextResponse.json({ success: false, message: "Pick an answer." }, { status: 400 });

  const result = undo
    ? await undoMeetingOutcome(id, ctx.businessId, ctx.userId, bookingId)
    : await recordMeetingOutcome(id, ctx.businessId, ctx.userId, bookingId, outcome!);
  const status = result.success ? 200 : "message" in result && result.message === "Lead not found." ? 404 : 400;
  return NextResponse.json(result, { status });
}
