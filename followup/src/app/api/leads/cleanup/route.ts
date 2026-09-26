import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { hasActiveAccess, billingLockedMessage } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { deleteLeadCascade, archiveLeadThreadsAsFiltered } from "@/lib/leads-admin";
import { classifyAsProspect } from "@/lib/integrations/openai";
import { mapWithConcurrency } from "@/lib/concurrency";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { toTranscript } from "@/lib/transcript";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";
import { publicErrorMessage } from "@/lib/publicError";

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
//
// That source scope alone is NOT enough to make this safe, and used to be
// the whole of it: a customer who bought, booked, and has been emailing
// for a year still carries source "Gmail", and was judged on their first
// three emails like anything else. The `deletable` filter below is what
// actually decides who may be deleted; read it before changing anything
// here. Nothing it excludes is a cost — a lead left in the list is a tap
// to remove by hand, and there is no equivalent for a customer deleted
// along with their appointment.
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

  // WHO THIS PASS IS ALLOWED TO TOUCH.
  //
  // Everything below is a hard exclusion, not a signal weighed against the
  // classifier's verdict, and every one of them errs the same way: this
  // route's two possible mistakes are "left a newsletter in the list"
  // (costs an owner one tap) and "permanently deleted a paying customer,
  // their thread, their deal and their booked appointment, with no undo"
  // (costs them the customer). Those are not comparable, so anything
  // ambiguous is kept.
  //
  //   stage NEW — every imported thread lands at NEW
  //     (processThreadRefs in src/lib/integrations/gmail.ts). Any other
  //     stage means a human moved this lead through their own pipeline,
  //     which is a statement about this person that outranks anything a
  //     model infers from their first three emails. WON is the one that
  //     matters most and it is the one a source-scoped delete was most
  //     likely to hit: a won customer still carries source "Gmail" forever.
  //   no deals — a Deal row is only ever written when an owner moves a lead
  //     to WON/LOST (POST /api/leads/[id]/stage). It is money they recorded.
  //   no bookings — an appointment with a real human on the other end.
  //     deleteLeadCascade removes Booking rows too, so deleting this lead
  //     silently cancels a meeting that is still in someone's calendar.
  //   no outbound message — somebody replied in this thread. FollowUp
  //     stores no "was this automated" flag it could rely on here
  //     (Message.source only marks Meta-side echoes), and guessing wrong
  //     costs a real conversation, so any reply at all makes the lead
  //     off-limits. A vendor pitch the owner answered stays; a customer
  //     they answered is never deleted.
  //   classificationOverriddenAt null — a human already overruled this
  //     exact verdict once (Settings → "this was a lead"). Re-judging it
  //     is not a second opinion, it is ignoring them.
  //   has at least one message — unchanged in effect from the old
  //     `messages.length === 0` skip below, but stated in the query so an
  //     unjudgeable lead doesn't consume a slot in the batch or inflate
  //     `remaining` with work that can never be done.
  const deletable: Prisma.LeadWhereInput = {
    businessId: ctx.businessId,
    source: "Gmail",
    stage: "NEW",
    classificationOverriddenAt: null,
    deals: { none: {} },
    bookings: { none: {} },
    // Both are conditions on `conversations`, so they go in an AND rather
    // than one overwriting the other as two keys of the same object.
    AND: [
      { conversations: { none: { messages: { some: { direction: "outbound" } } } } },
      { conversations: { some: { messages: { some: {} } } } },
    ],
  };

  const leads = await prisma.lead.findMany({
    where: deletable,
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
    // One chronological transcript across ALL of this lead's threads, with
    // a total ordering — not `conversations.flatMap(...)` in whatever order
    // Postgres returned them. classifyAsProspect reads only the first three
    // messages, a lead is keyed (businessId, email) so one contact
    // routinely holds several threads, and the include above orders
    // messages WITHIN a conversation but never the conversations
    // themselves. So "the first three messages" was really "the first three
    // messages of an arbitrary thread": the same lead could be judged on
    // last year's newsletter on one run and on this month's quote request
    // on the next, and the delete-or-keep verdict flips with it. Same
    // ordering, same module, as the quiet-lead classifier
    // (src/lib/transcript.ts).
    const messages = toTranscript(lead.conversations);
    if (messages.length === 0) return undefined; // nothing to judge it by — leave it, and don't count it as checked

    let verdict: { isProspect: boolean; reason: string };
    try {
      verdict = await classifyAsProspect(
        messages,
        { name: lead.name, email: lead.email ?? "unknown" },
        businessContext ?? undefined
      );
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
        reason: `Classification error: ${publicErrorMessage(err, "the AI check didn't answer")}`,
      };
    }

    if (verdict.isProspect) return { id: lead.id, name: lead.name, removed: false, reason: verdict.reason };

    try {
      // Record before destroying, in this order:
      //
      //  1. A FilteredEmail row per mailbox thread — the same record the
      //     sync writes when this same classifier rejects a thread at
      //     import. It puts the deletion in Settings with the reason and a
      //     one-click "this was a lead" that re-imports the thread and
      //     now permanently exempts it from being judged again. That is
      //     the undo this route never had.
      //  2. The delete, scoped to this business so the last call before
      //     rows are gone states its own tenant.
      //  3. An AWAITED audit row per lead. The HTTP response already lists
      //     what was removed, but this route can run for minutes and a
      //     serverless timeout throws that response away — leaving the
      //     owner with deleted customers and, before this, one meta-less
      //     "leads.cleanup" event that named none of them. Awaited, not
      //     `void`d, for exactly that reason: a fire-and-forget write is
      //     not a record that survives the thing it exists to survive.
      const archivedThreads = await archiveLeadThreadsAsFiltered(ctx.businessId, lead, verdict.reason);
      await deleteLeadCascade(lead.id, ctx.businessId);
      await recordAudit(ctx, "lead.cleanup_deleted", {
        targetType: "lead",
        targetId: lead.id,
        meta: {
          name: lead.name,
          email: lead.email,
          reason: verdict.reason,
          messageCount: messages.length,
          // Zero means nothing in Settings can bring this one back — the
          // audit row is then the only record that it existed.
          archivedThreads,
        },
      });
      return { id: lead.id, name: lead.name, removed: true, reason: verdict.reason };
    } catch (err) {
      // A deletion that failed must never be reported as one. Kept, with
      // the real error, so the owner sees a lead that is still there.
      console.error(`Failed to remove lead ${lead.id} during cleanup:`, err);
      return {
        id: lead.id,
        name: lead.name,
        removed: false,
        reason: `Removal failed: ${publicErrorMessage(err, "the database refused the delete")}`,
      };
    }
  });

  const checked = outcomes.filter((o): o is NonNullable<Outcome> => o !== undefined);
  const removed = checked.filter((o) => o.removed);

  // A batched run has to say so, or "checked: 200" on a 5,000-lead account
  // reads as "we looked at everything and it was fine". Counted after the
  // deletions above, so it reflects what is actually left to do.
  // Counted over the same `deletable` set the batch was drawn from, not
  // over every Gmail lead the business has. Counting the wider set would
  // report every won customer and every lead with a booking as still
  // "remaining" — work this route will now never do, so a number that
  // could never reach zero.
  const remaining = Math.max(0, (await prisma.lead.count({ where: deletable })) - checked.length);

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
