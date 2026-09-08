import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { sendFollowUpToLead } from "@/lib/sending";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const sendSchema = z.object({
  message: z.string().trim().min(1, "Message can't be empty."),
  // Optional: the composer only shows/requires a Subject field for leads
  // being emailed (see MessageComposer.tsx) — a text/WhatsApp/Instagram
  // send has no subject concept.
  subject: z.string().trim().min(1).optional(),
});

// POST /api/leads/[id]/send — the one place a real email actually goes out.
// Always requires a person to have clicked "Send now" with the message
// visible in front of them first; automated sends go through
// src/lib/automation.ts instead, which calls sendFollowUpToLead directly.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.send", { windowMinutes: 10, max: 60 })) return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const owned = await prisma.lead.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true } });
  if (!owned) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

  const parsed = await parseJsonBody(request, sendSchema);
  if (!parsed.ok) return parsed.response;
  const { message, subject } = parsed.data;

  const result = await sendFollowUpToLead(id, message, { trigger: "manual", subject });
  if (result.success) void recordAudit(ctx, "lead.send", { targetType: "lead", targetId: id, meta: { length: message.length } });
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
