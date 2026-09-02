import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { fetchSalesConversations } from "@/lib/integrations/gmail";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { detectReplies } from "@/lib/outcomes";
import { mapWithConcurrency } from "@/lib/concurrency";

// A full sync (up to 30 Gmail threads, each possibly classified, plus two
// OpenAI calls per resulting lead for scoring/drafting) comfortably exceeds
// a default serverless timeout even with the concurrency below. Needs a
// Vercel plan that honors maxDuration above the Hobby tier's 10s cap.
export const maxDuration = 300;

// POST /api/integrations/gmail/sync — pulls recent inbox threads for the
// signed-in user's own business, upserts them as real Lead/Conversation/
// Message rows, then (if OPENAI_API_KEY is set) scores each one and drafts
// a follow-up message. Triggered by the "Sync now" button on Settings once
// Gmail is connected.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }

  try {
    const leads = await fetchSalesConversations(ctx.businessId);

    const scoredFlags = await mapWithConcurrency(leads, 5, async (lead) => {
      try {
        return await scoreAndDraftForLead(lead.id);
      } catch (err) {
        // One lead failing to score shouldn't fail the whole sync.
        console.error(`Failed to score lead ${lead.id}:`, err);
        return false;
      }
    });
    const scored = scoredFlags.filter(Boolean).length;

    // New inbound messages just landed — this is the one point where it's
    // worth checking whether any of them are a reply to a follow-up we
    // already sent.
    let repliesDetected = 0;
    try {
      repliesDetected = await detectReplies(ctx.businessId);
    } catch (err) {
      // Outcome tracking failing shouldn't fail the sync that just
      // succeeded — leads are still saved and scored either way.
      console.error(`Failed to detect replies for business ${ctx.businessId}:`, err);
    }

    return NextResponse.json({ success: true, count: leads.length, scored, repliesDetected, leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
