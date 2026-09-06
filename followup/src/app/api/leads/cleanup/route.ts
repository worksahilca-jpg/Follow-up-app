import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { deleteLeadCascade } from "@/lib/leads-admin";
import { classifyAsProspect } from "@/lib/integrations/openai";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Message } from "@/lib/types";

// A business with a large backlog means one OpenAI classification call per
// Gmail-sourced lead — comfortably past a default serverless timeout even
// with the concurrency below. Needs a Vercel plan that honors maxDuration
// above the Hobby tier's 10s cap.
export const maxDuration = 300;

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

  // Diagnostic-grade outcome for every checked lead, not just the removed
  // ones — a run that removes nothing is ambiguous otherwise: did the AI
  // genuinely judge each one a real prospect, or did every call quietly
  // error and fall back to "kept" (see the catch below)? This is the only
  // way to tell those apart from the API response alone.
  type Outcome = { id: string; name: string; removed: boolean; reason: string } | undefined;

  // Each lead is classified and (if it fails) deleted independently, so
  // this is safe to run several at a time instead of one OpenAI round trip
  // at a time.
  // Same business context the inbox sync gives the classifier — without it,
  // a realtor's active deals read as "not about the business" and this
  // route would delete them.
  const businessContext = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true, industry: true },
  });

  const outcomes = await mapWithConcurrency(leads, 5, async (lead): Promise<Outcome> => {
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
    if (messages.length === 0) return undefined; // nothing to judge it by — leave it, and don't count it as checked

    try {
      const { isProspect, reason } = await classifyAsProspect(
        messages,
        { name: lead.name, email: lead.email ?? "unknown" },
        businessContext ?? undefined
      );
      if (!isProspect) {
        await deleteLeadCascade(lead.id);
        return { id: lead.id, name: lead.name, removed: true, reason };
      }
      return { id: lead.id, name: lead.name, removed: false, reason };
    } catch (err) {
      // One lead failing to classify shouldn't fail the whole clean-up —
      // and better to leave a lead in place than delete it on a guess.
      // Still surfaced below (reason carries the actual error) instead of
      // silently looking identical to a real "kept" judgment.
      console.error(`Failed to classify lead ${lead.id} during cleanup:`, err);
      return {
        id: lead.id,
        name: lead.name,
        removed: false,
        reason: `Classification error: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  });

  const checked = outcomes.filter((o): o is NonNullable<Outcome> => o !== undefined);
  const removed = checked.filter((o) => o.removed);

  return NextResponse.json({
    success: true,
    checked: checked.length,
    removedCount: removed.length,
    removed,
    // Every lead the AI looked at and kept, with its stated reason — the
    // diagnostic trail for "why didn't this get removed."
    kept: checked.filter((o) => !o.removed),
  });
}
