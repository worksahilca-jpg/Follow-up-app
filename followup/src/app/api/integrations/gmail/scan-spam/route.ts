import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { requireActiveBilling, BILLING_LOCKED_MESSAGE } from "@/lib/billing";
import { fetchSpamProspects } from "@/lib/integrations/gmail";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { mapWithConcurrency } from "@/lib/concurrency";
import { tooManyRecentActions } from "@/lib/rateLimit";

// Same time-limit reasoning as the regular sync route — see that file.
export const maxDuration = 300;

// POST /api/integrations/gmail/scan-spam — a deliberately separate, manual
// action from "Sync now": pulls threads from the connected account's spam
// folder specifically, upserts the ones that pass the same AI prospect
// classification as a normal sync, and scores/drafts each one. New leads
// found this way are tagged source: "Gmail (spam)" by fetchSpamProspects()
// itself, so they stay honestly distinguishable in the leads list rather
// than blending in unlabeled. Triggered by the "Scan spam for missed
// leads" button on Settings, next to Gmail — never run automatically,
// since spam has a much higher false-positive rate than an inbox sync.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: BILLING_LOCKED_MESSAGE }, { status: 402 });
  }
  // Same reasoning and limit as the regular sync route — this is just as
  // expensive per call.
  if (await tooManyRecentActions(ctx.businessId, "gmail-scan-spam", { windowMinutes: 10, max: 5 })) {
    return NextResponse.json({ success: false, message: "Too many scans right now — try again in a few minutes." }, { status: 429 });
  }

  try {
    const leads = await fetchSpamProspects(ctx.businessId);

    const scoredFlags = await mapWithConcurrency(leads, 5, async (lead) => {
      try {
        return await scoreAndDraftForLead(lead.id);
      } catch (err) {
        console.error(`Failed to score spam-found lead ${lead.id}:`, err);
        return false;
      }
    });
    const scored = scoredFlags.filter(Boolean).length;

    return NextResponse.json({ success: true, count: leads.length, scored });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Spam scan failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
