import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";

// DELETE /api/leads/[id] — permanently removes a lead and everything under
// it (conversations, messages, deals, follow-ups, tasks, AI insights).
// Used to clean up a lead that shouldn't have existed in the first place —
// e.g. a personal email or newsletter Gmail sync mistook for a sales
// conversation before the AI prospect check was added. There's no undo.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, include: { conversations: true } });
  if (!lead || lead.businessId !== ctx.businessId) {
    return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  }

  const conversationIds = lead.conversations.map((c) => c.id);

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } }),
    prisma.conversation.deleteMany({ where: { leadId: id } }),
    prisma.deal.deleteMany({ where: { leadId: id } }),
    prisma.followUp.deleteMany({ where: { leadId: id } }),
    prisma.task.deleteMany({ where: { leadId: id } }),
    prisma.aIInsight.deleteMany({ where: { leadId: id } }),
    prisma.lead.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
