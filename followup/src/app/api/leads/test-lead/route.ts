import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { tooManyRecentActions } from "@/lib/rateLimit";

// A realistic, generic first inquiry — deliberately asks about price and
// availability, the exact lead segment research/product/2026-09-10-
// instant-ack-safety-gate.md was written about, so this button also shows
// off that the instant ack handles that case honestly rather than just
// picking an easy message to demo.
const TEST_LEAD_MESSAGE =
  "Hi, I saw your listing online and I'm interested. Do you have availability this week, and what would it cost?";

/**
 * POST /api/leads/test-lead — "Send a test lead to myself"
 * (research/product/2026-09-10-ux-simplification.md §3, implementation
 * plan item #4). The one way to demonstrate the core promise — an
 * instant, honest, in-your-language reply going out with no one lifting
 * a finger — to a business whose real inbox is quiet right now. Reuses
 * the exact same lead-creation shape and instant-ack path a real "Website
 * form" submission goes through (see the embed lead route), just with
 * the owner's own address as the "lead" so they see the real reply land
 * in their own inbox.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "leads.test", { windowMinutes: 10, max: 5 })) {
    return NextResponse.json({ success: false, message: "Too many requests — try again in a few minutes." }, { status: 429 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true, name: true } });
  if (!user?.email) return NextResponse.json({ success: false, message: "Couldn't find your email address." }, { status: 400 });

  const now = new Date();
  const firstName = user.name?.trim().split(" ")[0] || "You";

  async function seedMessage(leadId: string) {
    const conversation = await prisma.conversation.create({ data: { leadId, channel: "email" } });
    await prisma.message.create({
      data: { conversationId: conversation.id, direction: "inbound", body: TEST_LEAD_MESSAGE, sentAt: now },
    });
    await scoreAndDraftForLead(leadId);
    const result = await acknowledgeNewLead(leadId, { channel: "email", inboundText: TEST_LEAD_MESSAGE, inboundAt: now });
    return result;
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        businessId: ctx.businessId,
        name: `Test Lead (${firstName})`,
        email: user.email,
        source: "Test lead",
        stage: "NEW",
        lastContacted: now,
        assignedToId: ctx.userId,
      },
    });
    const result = await seedMessage(lead.id);
    return NextResponse.json({
      success: true,
      leadId: lead.id,
      sent: result.sent,
      message: result.sent
        ? `Sent — check ${user.email} for the reply.`
        : "Created the test lead, but the reply didn't go out (check that Gmail is connected in Settings).",
    });
  } catch (err) {
    // Re-running this button when a prior test lead is still on file (same
    // business, same owner email) hits the same unique constraint a real
    // duplicate submission would — treat it the same way the embed route
    // does: reuse the existing lead and post a fresh inbound message
    // rather than erroring.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.lead.findUnique({ where: { businessId_email: { businessId: ctx.businessId, email: user.email } } });
      if (existing) {
        const result = await seedMessage(existing.id);
        let message: string;
        if (result.sent) message = `Sent — check ${user.email} for the reply.`;
        else if (result.reason === "already acknowledged") message = "You already got a reply from your last test lead — open it to see it again.";
        else message = "Used your existing test lead, but the reply didn't go out (check that Gmail is connected in Settings).";
        return NextResponse.json({ success: true, leadId: existing.id, sent: result.sent, message });
      }
    }
    throw err;
  }
}
