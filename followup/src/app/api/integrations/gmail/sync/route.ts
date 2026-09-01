import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { fetchSalesConversations } from "@/lib/integrations/gmail";
import { scoreAndDraftForLead } from "@/lib/scoring";

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

    let scored = 0;
    for (const lead of leads) {
      try {
        if (await scoreAndDraftForLead(lead.id)) scored++;
      } catch (err) {
        // One lead failing to score shouldn't fail the whole sync.
        console.error(`Failed to score lead ${lead.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, count: leads.length, scored, leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
