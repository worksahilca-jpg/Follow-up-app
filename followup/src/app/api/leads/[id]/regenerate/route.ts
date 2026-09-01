import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateFollowUpMessage } from "@/lib/integrations/openai";
import { composeFollowUpEmail } from "@/lib/sender";
import type { Message } from "@/lib/types";

// POST /api/leads/[id]/regenerate — asks the AI for a fresh draft against
// this lead's real conversation, and saves it as the new suggested message.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });
  if (!lead) return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });

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
    const draftBody = await generateFollowUpMessage({ name: lead.name, conversation });
    const newMessage = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draftBody);
    await prisma.lead.update({ where: { id: lead.id }, data: { suggestedMessage: newMessage } });
    return NextResponse.json({ success: true, message: newMessage });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Regeneration failed.";
    return NextResponse.json({ success: false, message: reason }, { status: 500 });
  }
}
