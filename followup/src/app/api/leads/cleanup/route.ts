import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { hasActiveAccess, billingLockedMessage } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { deleteLeadCascade } from "@/lib/leads-admin";
import { classifyAsProspect } from "@/lib/integrations/openai";
import { mapWithConcurrency } from "@/lib/concurrency";
import { tooManyRecentActions } from "@/lib/rateLimit";
import type { Message } from "@/lib/types";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

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
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "leads.cleanup");

  // A live paid subscription, checked with hasActiveAccess directly rather
  // than through requireActiveBilling — identical reasoning to POST
  // /api/reactivation/classify, which this route is the older twin of. Both
  // run one OpenAI call per lead across an unbounded Gmail backlog on the
  // platform's own shared key, and Free tier's defining restriction is that
  // AI processing stops after 20 leads a month
  // (research/market/2026-09-11-tier-pricing-recommendation.md §2.2).
  // requireActiveBilling() admits Free tier by design, so it is not the
  // right gate here: it let a $0 account classify its entire back catalogue,
  // which is precisely the spend that cap exists to prevent.
  //
  // Only the plain column this decision needs — Business carries AES-GCM
  // encrypted third-party secrets (ENCRYPTED_FIELDS in src/lib/db.ts).
  const gate = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { subscriptionStatus: true },
  });
  if (!hasActiveAccess(gate?.subscriptionStatus)) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  // The rate limit below bounds how OFTEN this runs; this bounds how much
  // one run can spend. Without it the findMany below took every Gmail lead
  // the business had, so the ceiling on a single call was the size of the
  // backlog — the last unbounded-per-run AI path in the app. At 5,000 leads
  // and the 2-runs-per-hour limit that is roughly $46/day of classification
  // on one $39 account (research/product/2026-09-15-ai-cost-per-lead.md
  // §5). A batch is not a restriction on the feature: clean-up is
  // resumable by design, each run works forward through the oldest leads,
  // and the response says how many are left.
  const CLEANUP_BATCH_SIZE = 200;

  // 2 per hour. This was the only AI-spending route in the app with no rate
  // limit at all (Gmail sync, spam scan, regenerate and reactivation/classify
  // all have one), while being the most expensive of them: every call is one
  // OpenAI classification per Gmail lead the business has, with no ceiling on
  // how many that is. A retry loop or a compromised admin session could
  // re-run the whole backlog as fast as the function returns. Two runs an
  // hour is more than a genuine one-off clean-up ever needs.
  if (await tooManyRecentActions(ctx.businessId, "leads.cleanup", { windowMinutes: 60, max: 2 })) {
    return NextResponse.json(
      { success: false, message: "Clean-up already ran recently — try again in an hour." },
      { status: 429 }
    );
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
    // Oldest first, so repeated runs work forward through the backlog
    // rather than re-checking the same newest leads every time.
    orderBy: { createdAt: "asc" },
    take: CLEANUP_BATCH_SIZE,
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

  // A batched run has to say so, or "checked: 200" on a 5,000-lead account
  // reads as "we looked at everything and it was fine". Counted after the
  // deletions above, so it reflects what is actually left to do.
  const remaining = Math.max(
    0,
    (await prisma.lead.count({ where: { businessId: ctx.businessId, source: "Gmail" } })) - checked.length
  );

  return NextResponse.json({
    success: true,
    checked: checked.length,
    removedCount: removed.length,
    // How many Gmail leads this run did not reach. Non-zero means run it
    // again; the next run picks up where this one stopped.
    remaining,
    removed,
    // Every lead the AI looked at and kept, with its stated reason — the
    // diagnostic trail for "why didn't this get removed."
    kept: checked.filter((o) => !o.removed),
  });
}
