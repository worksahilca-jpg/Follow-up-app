import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { tooManyRecentActions } from "@/lib/rateLimit";

/**
 * POST /api/leads/[id]/opened — the owner opened this customer (Customers
 * panel, Inbox pane or the customer's page), so the list row stops reading
 * bold (Lead.openedAt). A note of fact, not an action: nothing is sent,
 * dismissed or changed about what FollowUp does. Only the business's own
 * customers; a wrong id is a no-op.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.opened", { windowMinutes: 10, max: 600 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }
  const { id } = await params;
  const r = await prisma.lead.updateMany({ where: { id, businessId: ctx.businessId }, data: { openedAt: new Date() } });
  return NextResponse.json({ success: r.count === 1 });
}
