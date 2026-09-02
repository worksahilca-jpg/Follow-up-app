import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

// POST /api/leads/[id]/followup — the dashboard's quick actions on a
// "today's follow-ups" card (see FollowUpCard.tsx). Both actions just move
// nextFollowUp so the lead drops off today's list — same field
// getTodaysFollowUps() already reads, so this doesn't need its own
// separate "dismissed" concept:
//   snooze   — push nextFollowUp to this time tomorrow.
//   complete — clear nextFollowUp and refresh lastContacted to now, as if
//              you'd just followed up (by phone, in person, wherever) —
//              nothing was sent through the app, but the record reflects
//              that contact happened.
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  if (action !== "snooze" && action !== "complete") {
    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id }, select: { businessId: true } });
  if (!lead || lead.businessId !== ctx.businessId) {
    return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  }

  const now = new Date();
  await prisma.lead.update({
    where: { id },
    data:
      action === "snooze"
        ? { nextFollowUp: new Date(now.getTime() + DAY_MS) }
        : { nextFollowUp: null, lastContacted: now },
  });

  return NextResponse.json({ success: true });
}
