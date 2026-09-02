import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { deleteLeadCascade } from "@/lib/leads-admin";
import { classifyAsProspect } from "@/lib/integrations/openai";
import type { Message } from "@/lib/types";

// POST /api/leads/cleanup — retroactively re-runs the AI prospect check
// (see fetchSalesConversations in gmail.ts) against leads that already
// exist, and deletes the ones that fail it. Only exists because that check
// was added after sync had already been pulling in personal email,
// recruiters, vendors, and newsletters as "leads" — this is the one-time
// pass to clear that backlog instead of deleting them one at a time.
//
// Scoped to Gmail-sourced leads with at least one real message — manual
// entries and CSV imports were never subject to the old heuristic, and a
// lead with no conversation yet can't be classified either way, so both
// are left alone rather than guessed at.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, message: "AI clean-up needs OPENAI_API_KEY configured." },
      { status: 400 }
    );
  }

  const leads = await prisma.lead.findMany({
    where: { businessId: ctx.businessId, source: "Gmail" },
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });

  let checked = 0;
  const removed: { id: string; name: string; reason: string }[] = [];

  for (const lead of leads) {
    const messages = lead.conversations.flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        channel: c.channel,
        body: m.body,
        date: m.sentAt.toISOString(),
        opened: m.opened,
      }))
    ) as Message[];
    if (messages.length === 0) continue; // nothing to judge it by — leave it

    checked++;
    try {
      const { isProspect, reason } = await classifyAsProspect(messages);
      if (!isProspect) {
        await deleteLeadCascade(lead.id);
        removed.push({ id: lead.id, name: lead.name, reason });
      }
    } catch (err) {
      // One lead failing to classify shouldn't fail the whole clean-up —
      // and better to leave a lead in place than delete it on a guess.
      console.error(`Failed to classify lead ${lead.id} during cleanup:`, err);
    }
  }

  return NextResponse.json({ success: true, checked, removedCount: removed.length, removed });
}
