import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail } from "@/lib/sender";
import { getVoiceSamples } from "@/lib/voice";
import type { Message } from "@/lib/types";

// POST /api/leads/[id]/regenerate — asks the AI for a fresh draft against
// this lead's real conversation, and saves it as the new suggested message.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });
  if (!lead || lead.businessId !== ctx.businessId) {
    return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
  }

  const conversation: Message[] = lead.conversations.flatMap((c) =>
    c.messages.map((m) => ({
      id: m.id,
      direction: m.direction as Message["direction"],
      channel: c.channel as Message["channel"],
      body: m.body,
      date: m.sentAt.toISOString(),
      opened: m.opened,
    }))
  );

  try {
    const voiceSamples = await getVoiceSamples(lead.businessId);
    const draftBody = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples);
    const newMessage = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draftBody);
    // A manually-requested regenerate makes a brand new draft — whatever
    // reason the old one was held for doesn't describe this one, so it's
    // cleared rather than left stale next to text nobody's assessed yet.
    await prisma.lead.update({
      where: { id: lead.id },
      data: { suggestedMessage: newMessage, suggestedMessageHoldReason: null },
    });
    return NextResponse.json({ success: true, message: newMessage });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Regeneration failed.";
    return NextResponse.json({ success: false, message: reason }, { status: 500 });
  }
}
