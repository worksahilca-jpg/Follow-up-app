import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getLeadById } from "@/lib/leads-data";
import { prisma } from "@/lib/db";
import { summarizeConversation } from "@/lib/integrations/openai";
import { requireActiveBilling, billingLockedMessage, leadAiRefusal } from "@/lib/billing";

/** Below this many messages the thread is short enough to just read. */
const CATCH_UP_MIN_MESSAGES = 7;

// GET /api/leads/[id]/catch-up — "Catching up" for a long conversation
// (design brain A-043). Cached on the lead and regenerated only when the
// number of messages changes.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ success: false }, { status: 404 });
  const count = lead.conversation.length;
  if (count < CATCH_UP_MIN_MESSAGES) return NextResponse.json({ success: true, text: null, count });

  const cached = await prisma.lead.findUnique({ where: { id }, select: { catchUpText: true, catchUpCount: true } });
  if (cached?.catchUpText && cached.catchUpCount === count) {
    return NextResponse.json({ success: true, text: cached.catchUpText, count });
  }
  // A new summary counts towards the plan's monthly allowance; past it, the
  // card simply doesn't show (a saved summary above still does).
  if (await leadAiRefusal(ctx.businessId, id)) return NextResponse.json({ success: true, text: null, count });
  try {
    const text = await summarizeConversation(lead.conversation, lead.name.split(" ")[0] ?? "");
    if (text) await prisma.lead.update({ where: { id }, data: { catchUpText: text, catchUpCount: count } });
    return NextResponse.json({ success: true, text, count });
  } catch {
    return NextResponse.json({ success: true, text: null, count });
  }
}
