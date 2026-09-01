import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";

// POST /api/leads/[id]/send — the one place a real email actually goes out.
// Always requires a person to have clicked "Send now" with the message
// visible in front of them first; automated sends go through
// src/lib/automation.ts instead, which calls sendFollowUpToLead directly.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const owned = await prisma.lead.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true } });
  if (!owned) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ success: false, message: "Message can't be empty." }, { status: 400 });
  }

  const result = await sendFollowUpToLead(id, message);
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
